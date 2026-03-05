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
                ? 'bg-green-100 ring-2 ring-green-500' 
                : 'hover:bg-green-50'
            ]"
          >
            <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100">
              <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <span class="text-sm font-medium text-green-700">
              {{ props.issues.filter(i => !i.issueType.subtask && !shouldExcludeIssue(i) && isOpen(i) && getIssueStatus(i).isReady).length }} Ready
            </span>
          </button>
          
          <!-- Not Ready Count (clickable filter) -->
          <button
            @click="showOnlyNotReady = !showOnlyNotReady"
            :class="[
              'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors',
              showOnlyNotReady 
                ? 'bg-red-100 ring-2 ring-red-500' 
                : 'hover:bg-red-50'
            ]"
            title="Click to filter only not ready issues"
          >
            <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100">
              <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
            <span class="text-sm font-medium text-red-700">
              {{ props.issues.filter(i => !i.issueType.subtask && !shouldExcludeIssue(i) && isOpen(i) && !getIssueStatus(i).isReady).length }} Not Ready
            </span>
            <span v-if="showOnlyNotReady" class="text-xs text-red-600">(filtered)</span>
          </button>
          
          <!-- Teams Notification Button -->
          <button
            v-if="issuesWithWarnings.length > 0"
            @click="sendTeamsNotifications"
            :disabled="sendingNotifications || !teamsConfigured"
            :class="[
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              teamsConfigured
                ? 'bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            ]"
            :title="teamsConfigured ? 'Send Teams notifications to users' : 'MS Teams not configured'"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.2 6.4h-2.4V4.8c0-1.32-1.08-2.4-2.4-2.4H9.6c-1.32 0-2.4 1.08-2.4 2.4v1.6H4.8c-.88 0-1.6.72-1.6 1.6v10.4c0 .88.72 1.6 1.6 1.6h14.4c.88 0 1.6-.72 1.6-1.6V8c0-.88-.72-1.6-1.6-1.6zM8.8 4.8c0-.44.36-.8.8-.8h4.8c.44 0 .8.36.8.8v1.6H8.8V4.8zM19.2 18.4H4.8V8h14.4v10.4z"/>
              <path d="M12 10.4c-1.32 0-2.4 1.08-2.4 2.4s1.08 2.4 2.4 2.4 2.4-1.08 2.4-2.4-1.08-2.4-2.4-2.4z"/>
            </svg>
            {{ sendingNotifications ? 'Sending...' : 'Notify via Teams' }}
          </button>
        </div>
      </div>
      
      <!-- Notification Result -->
      <div 
        v-if="notificationResult" 
        :class="[
          'mt-3 px-4 py-2 rounded-lg text-sm',
          notificationResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        ]"
      >
        {{ notificationResult.message }}
      </div>
      
      <!-- Teams Not Configured Warning -->
      <div 
        v-if="!teamsConfigured && issuesWithWarnings.length > 0" 
        class="mt-3 px-4 py-2 rounded-lg text-sm bg-amber-50 text-amber-800"
      >
        MS Teams integration not configured. Add TEAMS_WEBHOOK_URL to .env file to enable channel notifications.
      </div>
      
      <!-- Filter Panel -->
      <div v-if="showFilters" class="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- Exclude Users -->
          <div>
            <h4 class="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Exclude Users
            </h4>
            <div class="max-h-48 overflow-y-auto space-y-1">
              <label 
                v-for="user in allUsers" 
                :key="user.accountId"
                class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
              >
                <input 
                  type="checkbox" 
                  :checked="excludedUserIds.has(user.accountId)"
                  @change="toggleUserExclusion(user.accountId)"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <img :src="user.avatarUrl" :alt="user.displayName" class="w-5 h-5 rounded-full" />
                <span class="text-sm text-gray-700">{{ user.displayName }}</span>
              </label>
              <p v-if="allUsers.length === 0" class="text-sm text-gray-500 italic px-2">No users found</p>
            </div>
          </div>
          
          <!-- Exclude Labels -->
          <div>
            <h4 class="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Exclude Labels
            </h4>
            <div class="max-h-48 overflow-y-auto space-y-1">
              <label 
                v-for="label in allLabels" 
                :key="label"
                class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
              >
                <input 
                  type="checkbox" 
                  :checked="excludedLabels.has(label)"
                  @change="toggleLabelExclusion(label)"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                  {{ label }}
                </span>
              </label>
              <p v-if="allLabels.length === 0" class="text-sm text-gray-500 italic px-2">No labels found</p>
            </div>
          </div>
          
          <!-- Skip Web Live Date Validation -->
          <div>
            <h4 class="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Skip Web Live Date Check
            </h4>
            <p class="text-xs text-gray-500 mb-2">Issues with these labels won't be flagged for missing web live date</p>
            <div class="max-h-40 overflow-y-auto space-y-1">
              <label 
                v-for="label in allLabels" 
                :key="'skip-' + label"
                class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
              >
                <input 
                  type="checkbox" 
                  :checked="skipWebLiveDateLabels.has(label)"
                  @change="toggleSkipWebLiveDate(label)"
                  class="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                  {{ label }}
                </span>
              </label>
            </div>
          </div>
        </div>
        
        <!-- Filter Summary -->
        <div class="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between">
          <p class="text-sm text-gray-600">
            Excluding {{ excludedUserIds.size }} user(s) and {{ excludedLabels.size }} label(s)
            <span v-if="skipWebLiveDateLabels.size > 0">
              • Skipping web live date for {{ skipWebLiveDateLabels.size }} label(s)
            </span>
          </p>
          <button
            @click="excludedUserIds = new Set(); excludedLabels = new Set(); skipWebLiveDateLabels = new Set(['automation'])"
            class="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Reset Filters
          </button>
        </div>
      </div>
    </div>
    
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
              Ready
            </th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
              Type
            </th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
              Key
            </th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
              Summary
            </th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
              Estimate
            </th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Labels
            </th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Components
            </th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
              Completion Criteria
            </th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
              Web Live Date
            </th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
              Due Date
            </th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
              Status
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <!-- Grouped by Assignee -->
          <template v-for="group in issuesGroupedByAssignee" :key="group.displayName">
            <!-- Assignee Group Header -->
            <tr class="bg-gray-100 border-t-2 border-gray-300">
              <td colspan="11" class="px-4 py-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <img 
                      v-if="group.assignee"
                      :src="group.assignee.avatarUrls['24x24']" 
                      :alt="group.displayName"
                      class="w-7 h-7 rounded-full"
                    />
                    <div 
                      v-else 
                      class="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center"
                    >
                      <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <span class="font-semibold text-gray-900">{{ group.displayName }}</span>
                    <span class="text-sm text-gray-500">({{ group.issues.length }} issues)</span>
                  </div>
                  <div class="flex items-center gap-4">
                    <span class="text-sm text-green-700">
                      <span class="font-medium">{{ group.readyCount }}</span> ready
                    </span>
                    <span class="text-sm text-red-700">
                      <span class="font-medium">{{ group.notReadyCount }}</span> not ready
                    </span>
                  </div>
                </div>
              </td>
            </tr>
            
            <!-- Issues in this group -->
            <tr 
              v-for="issue in group.issues" 
              :key="issue.key"
              :class="[
                'transition-colors',
                getIssueStatus(issue).isReady 
                  ? 'hover:bg-gray-50' 
                  : 'bg-red-50 hover:bg-red-100'
              ]"
            >
            <!-- Ready Status -->
            <td class="px-4 py-3 whitespace-nowrap">
              <div 
                v-if="getIssueStatus(issue).isReady"
                class="flex items-center justify-center"
              >
                <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100">
                  <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              </div>
              <div 
                v-else 
                class="flex items-center justify-center"
                :title="getIssueStatus(issue).warnings.join(', ')"
              >
                <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100">
                  <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </span>
              </div>
            </td>
            
            <!-- Type -->
            <td class="px-4 py-3 whitespace-nowrap">
              <span 
                :class="getIssueTypeIcon(issue.issueType.name).color"
                :title="issue.issueType.name"
              >
                {{ getIssueTypeIcon(issue.issueType.name).icon }}
              </span>
            </td>
            
            <!-- Key -->
            <td class="px-4 py-3 whitespace-nowrap">
              <a 
                :href="getIssueUrl(issue.key)" 
                target="_blank" 
                rel="noopener noreferrer"
                class="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
              >
                {{ issue.key }}
              </a>
            </td>
            
            <!-- Summary -->
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <span class="text-sm text-gray-900">{{ issue.summary }}</span>
                <img 
                  v-if="issue.assignee"
                  :src="issue.assignee.avatarUrls['16x16']" 
                  :alt="issue.assignee.displayName"
                  :title="issue.assignee.displayName"
                  class="w-5 h-5 rounded-full"
                />
              </div>
              <!-- Warnings below summary -->
              <div v-if="!getIssueStatus(issue).isReady" class="mt-1 flex flex-wrap gap-1">
                <span 
                  v-for="warning in getIssueStatus(issue).warnings" 
                  :key="warning"
                  class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700"
                >
                  {{ warning }}
                </span>
              </div>
            </td>
            
            <!-- Estimate -->
            <td class="px-4 py-3 whitespace-nowrap">
              <template v-if="getSubtasks(issue.key).length > 0">
                <!-- Has subtasks - show subtask estimate summary -->
                <div class="text-sm">
                  <span 
                    :class="[
                      hasEstimateOrSubtaskEstimates(issue).estimatedSubtasks > 0 
                        ? 'text-gray-700' 
                        : 'text-red-500 font-medium'
                    ]"
                  >
                    {{ (getSubtasks(issue.key).reduce((sum, st) => sum + (st.timeTracking?.originalEstimateSeconds || 0), 0) / (8 * 60 * 60)).toFixed(1) }}d
                  </span>
                  <span class="text-xs text-gray-400 ml-1">
                    ({{ hasEstimateOrSubtaskEstimates(issue).estimatedSubtasks }}/{{ hasEstimateOrSubtaskEstimates(issue).subtaskCount }} subtasks)
                  </span>
                </div>
              </template>
              <template v-else>
                <!-- No subtasks - show issue's own estimate -->
                <span 
                  v-if="issue.timeTracking?.originalEstimateSeconds"
                  class="text-sm text-gray-700"
                >
                  {{ (issue.timeTracking.originalEstimateSeconds / (8 * 60 * 60)).toFixed(1) }}d
                </span>
                <span v-else class="text-sm text-red-500 font-medium">0</span>
              </template>
            </td>
            
            <!-- Labels -->
            <td class="px-4 py-3">
              <div class="flex flex-wrap gap-1">
                <span 
                  v-for="(label, idx) in issue.labels.slice(0, 3)" 
                  :key="label"
                  :class="[
                    'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                    getLabelColor(idx)
                  ]"
                >
                  {{ label }}
                </span>
                <span 
                  v-if="issue.labels.length > 3"
                  class="text-xs text-gray-500"
                >
                  +{{ issue.labels.length - 3 }}
                </span>
                <span v-if="issue.labels.length === 0" class="text-sm text-red-500 font-medium">Missing</span>
              </div>
            </td>
            
            <!-- Components -->
            <td class="px-4 py-3">
              <div class="flex flex-wrap gap-1">
                <span 
                  v-for="component in issue.components.slice(0, 2)" 
                  :key="component.id"
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                >
                  {{ component.name }}
                </span>
                <span 
                  v-if="issue.components.length > 2"
                  class="text-xs text-gray-500"
                >
                  +{{ issue.components.length - 2 }}
                </span>
                <span v-if="issue.components.length === 0" class="text-sm text-red-500 font-medium">Missing</span>
              </div>
            </td>
            
            <!-- Completion Criteria -->
            <td class="px-4 py-3">
              <span 
                v-if="issue.completionCriteria"
                class="text-sm text-gray-700"
                :title="issue.completionCriteria"
              >
                {{ truncateText(issue.completionCriteria, 40) }}
              </span>
              <span 
                v-else 
                :class="[
                  'text-sm italic',
                  issue.issueType.name.toLowerCase() === 'story' ? 'text-red-500 font-medium' : 'text-gray-400'
                ]"
              >
                {{ issue.issueType.name.toLowerCase() === 'story' ? 'Missing' : '-' }}
              </span>
            </td>
            
            <!-- Web Live Date -->
            <td class="px-4 py-3 whitespace-nowrap">
              <span 
                v-if="issue.webLiveDate"
                :class="[
                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                  getDateStatus(issue.webLiveDate) === 'overdue' ? 'bg-red-100 text-red-800' :
                  getDateStatus(issue.webLiveDate) === 'upcoming' ? 'bg-amber-100 text-amber-800' :
                  'bg-green-100 text-green-800'
                ]"
              >
                {{ formatDate(issue.webLiveDate) }}
              </span>
              <span 
                v-else 
                :class="[
                  'text-sm',
                  issue.labels.some(l => ['feature', 'bug', 'tech debt', 'tech-debt', 'techdebt'].some(req => l.toLowerCase().includes(req)))
                    ? 'text-red-500 font-medium' 
                    : 'text-gray-400'
                ]"
              >
                {{ issue.labels.some(l => ['feature', 'bug', 'tech debt', 'tech-debt', 'techdebt'].some(req => l.toLowerCase().includes(req))) ? 'Missing' : '-' }}
              </span>
            </td>
            
            <!-- Due Date -->
            <td class="px-4 py-3 whitespace-nowrap">
              <span 
                v-if="issue.dueDate"
                :class="[
                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                  getDateStatus(issue.dueDate) === 'overdue' ? 'bg-red-100 text-red-800' :
                  getDateStatus(issue.dueDate) === 'upcoming' ? 'bg-amber-100 text-amber-800' :
                  'bg-green-100 text-green-800'
                ]"
              >
                {{ formatDate(issue.dueDate) }}
              </span>
              <span v-else class="text-sm text-gray-400">-</span>
            </td>
            
            <!-- Status -->
            <td class="px-4 py-3 whitespace-nowrap">
              <span 
                :class="[
                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                  issue.status.statusCategory.key === 'done' ? 'bg-green-100 text-green-800' :
                  issue.status.statusCategory.key === 'indeterminate' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                ]"
              >
                {{ issue.status.name }}
              </span>
            </td>
          </tr>
          </template>
        </tbody>
      </table>
    </div>
    
    <!-- Empty State -->
    <div v-if="filteredIssues.length === 0" class="px-6 py-12 text-center">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">No issues found</h3>
      <p class="mt-1 text-sm text-gray-500">Select a sprint to view issue details.</p>
    </div>
  </div>
</template>
