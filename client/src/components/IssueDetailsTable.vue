<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import axios from 'axios'
import type { JiraIssue } from '../types/jira'
import { useJira } from '../composables/useJira'

const { getIssueUrl } = useJira()

const props = defineProps<{
  issues: JiraIssue[]
  sprintName?: string
}>()

// Teams notification state
const teamsConfigured = ref(false)
const sendingNotifications = ref(false)
const notificationResult = ref<{ success: boolean; message: string } | null>(null)

// Filter panel visibility
const showFilters = ref(false)

// Filter for not ready issues only
const showOnlyNotReady = ref(false)

// Dynamic filter state - users to exclude (by accountId)
const excludedUserIds = ref<Set<string>>(new Set())

// Dynamic filter state - labels to exclude
const excludedLabels = ref<Set<string>>(new Set())

// Dynamic filter state - labels to skip web live date validation
const skipWebLiveDateLabels = ref<Set<string>>(new Set())

// Default excluded users/labels (pre-selected on load)
const DEFAULT_EXCLUDED_USERS: string[] = []  // No users excluded by default
const DEFAULT_EXCLUDED_LABELS: string[] = []  // No labels excluded by default

// Default labels to skip web live date validation
const DEFAULT_SKIP_LIVE_DATE_LABELS = ['analysis', 'automation', 'support', 'release_support', 'release support', 'release-support']

// Labels that require web live date
// Web Live Date is now only checked when Completion Criteria = "live"

// Check Teams status on mount
onMounted(async () => {
  try {
    const response = await axios.get('/api/teams/status')
    teamsConfigured.value = response.data.configured
  } catch {
    teamsConfigured.value = false
  }
  
  // Pre-select default excluded users
  allUsers.value.forEach(user => {
    if (DEFAULT_EXCLUDED_USERS.some(name => 
      user.displayName.toLowerCase().includes(name.toLowerCase())
    )) {
      excludedUserIds.value.add(user.accountId)
    }
  })
  
  // Pre-select default excluded labels
  DEFAULT_EXCLUDED_LABELS.forEach(label => {
    allLabels.value.forEach(l => {
      if (l.toLowerCase().includes(label.toLowerCase())) {
        excludedLabels.value.add(l)
      }
    })
  })
  
  // Pre-select default labels to skip web live date validation
  DEFAULT_SKIP_LIVE_DATE_LABELS.forEach(label => {
    allLabels.value.forEach(l => {
      if (l.toLowerCase().includes(label.toLowerCase()) || 
          label.toLowerCase().includes(l.toLowerCase())) {
        skipWebLiveDateLabels.value.add(l)
      }
    })
  })
})

// Get all unique users from issues (excluding subtasks)
const allUsers = computed(() => {
  const userMap = new Map<string, { accountId: string; displayName: string; avatarUrl: string }>()
  
  props.issues
    .filter(issue => !issue.issueType.subtask)
    .forEach(issue => {
      if (issue.assignee && !userMap.has(issue.assignee.accountId)) {
        userMap.set(issue.assignee.accountId, {
          accountId: issue.assignee.accountId,
          displayName: issue.assignee.displayName,
          avatarUrl: issue.assignee.avatarUrls['24x24']
        })
      }
    })
  
  return Array.from(userMap.values()).sort((a, b) => 
    a.displayName.localeCompare(b.displayName)
  )
})

// Get all unique labels from issues (excluding subtasks)
const allLabels = computed(() => {
  const labels = new Set<string>()
  
  props.issues
    .filter(issue => !issue.issueType.subtask)
    .forEach(issue => {
      issue.labels.forEach(label => labels.add(label))
    })
  
  return Array.from(labels).sort()
})

// Toggle user exclusion
const toggleUserExclusion = (accountId: string) => {
  if (excludedUserIds.value.has(accountId)) {
    excludedUserIds.value.delete(accountId)
  } else {
    excludedUserIds.value.add(accountId)
  }
  excludedUserIds.value = new Set(excludedUserIds.value) // Trigger reactivity
}

// Toggle label exclusion
const toggleLabelExclusion = (label: string) => {
  if (excludedLabels.value.has(label)) {
    excludedLabels.value.delete(label)
  } else {
    excludedLabels.value.add(label)
  }
  excludedLabels.value = new Set(excludedLabels.value) // Trigger reactivity
}

// Toggle skip web live date for label
const toggleSkipWebLiveDate = (label: string) => {
  if (skipWebLiveDateLabels.value.has(label)) {
    skipWebLiveDateLabels.value.delete(label)
  } else {
    skipWebLiveDateLabels.value.add(label)
  }
  skipWebLiveDateLabels.value = new Set(skipWebLiveDateLabels.value) // Trigger reactivity
}

// Helper to check if issue should be excluded
const shouldExcludeIssue = (issue: JiraIssue): boolean => {
  // Exclude by user
  if (issue.assignee && excludedUserIds.value.has(issue.assignee.accountId)) {
    return true
  }
  
  // Exclude by label
  if (issue.labels.some(label => excludedLabels.value.has(label))) {
    return true
  }
  
  return false
}

// Check if issue is in "Done" status category
// Check if issue is NOT done (i.e., still open/in progress)
const isOpen = (issue: JiraIssue): boolean => {
  // Use status category - 'done' means completed, anything else is open
  return issue.status.statusCategory?.key !== 'done' && issue.status.name.toLowerCase() !== 'closed'
}

// Filter out subtasks, excluded issues, and done issues
const filteredIssues = computed(() => {
  let issues = props.issues.filter(issue => 
    !issue.issueType.subtask && 
    !shouldExcludeIssue(issue) && 
    isOpen(issue)  // Only show open issues
  )
  
  // Apply "not ready" filter if enabled
  if (showOnlyNotReady.value) {
    issues = issues.filter(issue => !getIssueStatus(issue).isReady)
  }
  
  return issues
})

// Group issues by assignee
interface IssueGroup {
  assignee: JiraIssue['assignee']
  displayName: string
  issues: JiraIssue[]
  readyCount: number
  notReadyCount: number
}

const issuesGroupedByAssignee = computed((): IssueGroup[] => {
  const groupMap = new Map<string, IssueGroup>()
  
  for (const issue of filteredIssues.value) {
    const key = issue.assignee?.accountId || 'unassigned'
    
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        assignee: issue.assignee,
        displayName: issue.assignee?.displayName || 'Unassigned',
        issues: [],
        readyCount: 0,
        notReadyCount: 0
      })
    }
    
    const group = groupMap.get(key)!
    group.issues.push(issue)
    
    if (getIssueStatus(issue).isReady) {
      group.readyCount++
    } else {
      group.notReadyCount++
    }
  }
  
  // Sort by display name
  return Array.from(groupMap.values()).sort((a, b) => 
    a.displayName.localeCompare(b.displayName)
  )
})

// Get subtasks for a parent issue
const getSubtasks = (parentKey: string) => {
  return props.issues.filter(issue => 
    issue.issueType.subtask && issue.parent?.key === parentKey
  )
}

// Check if issue has estimate (considering subtasks)
const hasEstimateOrSubtaskEstimates = (issue: JiraIssue): { hasEstimate: boolean; subtaskCount: number; estimatedSubtasks: number } => {
  const subtasks = getSubtasks(issue.key)
  
  if (subtasks.length > 0) {
    // Issue has subtasks - check if any subtask has an estimate
    const estimatedSubtasks = subtasks.filter(st => 
      st.timeTracking?.originalEstimateSeconds && st.timeTracking.originalEstimateSeconds > 0
    ).length
    return {
      hasEstimate: estimatedSubtasks > 0,
      subtaskCount: subtasks.length,
      estimatedSubtasks
    }
  } else {
    // No subtasks - check issue's own estimate
    const hasOwnEstimate = !!(issue.timeTracking?.originalEstimateSeconds && issue.timeTracking.originalEstimateSeconds > 0)
    return {
      hasEstimate: hasOwnEstimate,
      subtaskCount: 0,
      estimatedSubtasks: 0
    }
  }
}

// Labels that SKIP component, completion criteria, and estimate validation
const LABELS_SKIP_VALIDATION = ['cross_collab', 'cross-collab', 'crosscollab', 'cross collab', 'support']

// Check if issue has a label that skips certain validations
const shouldSkipValidation = (issue: JiraIssue): boolean => {
  return issue.labels.some(label => 
    LABELS_SKIP_VALIDATION.some(skip => label.toLowerCase().includes(skip.toLowerCase()))
  )
}

// Check if issue is missing required fields (not ready)
const getIssueStatus = (issue: JiraIssue) => {
  const warnings: string[] = []
  const skipValidation = shouldSkipValidation(issue)
  
  // Check for missing labels - ALL issues
  if (issue.labels.length === 0) {
    warnings.push('No labels')
  }
  
  // Check for missing completion criteria - ALL issues, skip for cross_collab/support
  if (!skipValidation && !issue.completionCriteria) {
    warnings.push('No completion criteria')
  }
  
  // Check for missing components - ALL issues, skip for cross_collab/support
  if (!skipValidation && issue.components.length === 0) {
    warnings.push('No component')
  }
  
  // Check for missing web live date - ONLY when Completion Criteria is "live"
  const completionCriteriaIsLive = issue.completionCriteria?.toLowerCase() === 'live'
  
  if (completionCriteriaIsLive && !issue.webLiveDate) {
    warnings.push('No web live date')
  }
  
  // Check for missing estimates - ALL issues, skip for cross_collab/support
  if (!skipValidation) {
    const estimateInfo = hasEstimateOrSubtaskEstimates(issue)
    if (!estimateInfo.hasEstimate) {
      if (estimateInfo.subtaskCount > 0) {
        warnings.push(`No subtask estimates (0/${estimateInfo.subtaskCount})`)
      } else {
        warnings.push('No estimate')
      }
    } else if (estimateInfo.subtaskCount > 0 && estimateInfo.estimatedSubtasks < estimateInfo.subtaskCount) {
      // Some subtasks missing estimates
      warnings.push(`Partial estimates (${estimateInfo.estimatedSubtasks}/${estimateInfo.subtaskCount} subtasks)`)
    }
  }
  
  // Check for missing due date - ALL issues
  if (!issue.dueDate) {
    warnings.push('No due date')
  }
  
  return {
    isReady: warnings.length === 0,
    warnings
  }
}

// Get all issues with warnings (not ready)
const issuesWithWarnings = computed(() => {
  return filteredIssues.value
    .map(issue => ({
      issue,
      ...getIssueStatus(issue)
    }))
    .filter(item => !item.isReady)
})

// Group issues by assignee for notification
const issuesByAssignee = computed(() => {
  const groups = new Map<string, { displayName: string; email: string | null; issues: typeof issuesWithWarnings.value }>()
  
  for (const item of issuesWithWarnings.value) {
    const key = item.issue.assignee?.accountId || 'unassigned'
    const email = item.issue.assignee?.emailAddress || null
    
    if (!groups.has(key)) {
      groups.set(key, {
        displayName: item.issue.assignee?.displayName || 'Unassigned',
        email,
        issues: []
      })
    }
    groups.get(key)!.issues.push(item)
  }
  
  return Array.from(groups.values())
})

// Send Teams notifications to all users
const sendTeamsNotifications = async () => {
  sendingNotifications.value = true
  notificationResult.value = null
  
  try {
    const response = await axios.post('/api/teams/notify', {
      issues: issuesWithWarnings.value.map(item => ({
        issue: item.issue,
        warnings: item.warnings
      })),
      sprintName: props.sprintName || 'Current Sprint'
    })
    
    notificationResult.value = {
      success: true,
      message: response.data.message || 'Notification sent to Teams channel'
    }
  } catch (error: any) {
    notificationResult.value = {
      success: false,
      message: error.response?.data?.error || 'Failed to send notifications'
    }
  } finally {
    sendingNotifications.value = false
    
    // Clear message after 5 seconds
    setTimeout(() => {
      notificationResult.value = null
    }, 5000)
  }
}

// Send notification to a single user
const sendNotificationToUser = async (email: string, issues: typeof issuesWithWarnings.value) => {
  if (!email) {
    notificationResult.value = {
      success: false,
      message: 'User has no email address'
    }
    return
  }
  
  sendingNotifications.value = true
  notificationResult.value = null
  
  try {
    await axios.post('/api/teams/notify-user', {
      email,
      issues: issues.map(item => ({
        key: item.issue.key,
        summary: item.issue.summary,
        warnings: item.warnings
      })),
      sprintName: props.sprintName || 'Current Sprint'
    })
    
    notificationResult.value = {
      success: true,
      message: `Notification sent to ${email}`
    }
  } catch (error: any) {
    notificationResult.value = {
      success: false,
      message: error.response?.data?.error || 'Failed to send notification'
    }
  } finally {
    sendingNotifications.value = false
    
    setTimeout(() => {
      notificationResult.value = null
    }, 5000)
  }
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

const getDateStatus = (dateString: string | null) => {
  if (!dateString) return null
  const date = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  
  const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 7) return 'upcoming'
  return 'future'
}

const getIssueTypeIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'story': return { icon: '📖', color: 'text-green-600' }
    case 'bug': return { icon: '🐛', color: 'text-red-600' }
    case 'task': return { icon: '✅', color: 'text-blue-600' }
    case 'epic': return { icon: '⚡', color: 'text-purple-600' }
    default: return { icon: '📋', color: 'text-gray-600' }
  }
}

const truncateText = (text: string | null, maxLength: number = 50) => {
  if (!text) return '-'
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

const getLabelColor = (index: number) => {
  const colors = [
    'bg-purple-100 text-purple-800',
    'bg-blue-100 text-blue-800',
    'bg-green-100 text-green-800',
    'bg-yellow-100 text-yellow-800',
    'bg-pink-100 text-pink-800',
    'bg-indigo-100 text-indigo-800'
  ]
  return colors[index % colors.length]
}
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <div class="px-6 py-4 bg-gray-50 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Issue Details</h2>
          <p class="text-sm text-gray-500 mt-1">
            {{ filteredIssues.length }} issues 
            <span v-if="showOnlyNotReady" class="text-red-600 font-medium">(Not Ready only)</span>
            <span v-else>(Stories, Tasks, Bugs only)</span>
            <span class="text-gray-400">• {{ issuesGroupedByAssignee.length }} assignees</span>
          </p>
        </div>
        <div class="flex items-center gap-4">
          <!-- Filter Toggle Button -->
          <button
            @click="showFilters = !showFilters"
            :class="[
              'inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors',
              showFilters || excludedUserIds.size > 0 || excludedLabels.size > 0
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            ]"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            <span 
              v-if="excludedUserIds.size > 0 || excludedLabels.size > 0"
              class="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-blue-600 text-white rounded-full"
            >
              {{ excludedUserIds.size + excludedLabels.size }}
            </span>
          </button>
          
          <!-- Ready Count -->
          <button
            @click="showOnlyNotReady = false"
            :class="[
              'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors',
              !showOnlyNotReady 
