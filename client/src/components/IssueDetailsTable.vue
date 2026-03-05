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
