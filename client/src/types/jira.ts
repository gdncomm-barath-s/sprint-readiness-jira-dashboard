// Board types
export interface JiraBoard {
  id: number
  name: string
  type: string
  location?: {
    projectId: number
    projectName: string
    projectKey: string
  }
}

export interface BoardsResponse {
  maxResults: number
  startAt: number
  total: number
  isLast: boolean
  values: JiraBoard[]
}

// Sprint types
export interface JiraSprint {
  id: number
  name: string
  state: 'active' | 'future' | 'closed'
  startDate?: string
  endDate?: string
  completeDate?: string
  originBoardId: number
  goal?: string
}

export interface SprintsResponse {
  maxResults: number
  startAt: number
  total: number
  isLast: boolean
  values: JiraSprint[]
}

// Issue types
export interface JiraStatus {
  id: string
  name: string
  statusCategory: {
    id: number
    key: string
    name: string
    colorName: string
  }
}

export interface JiraAssignee {
  accountId: string
  displayName: string
  emailAddress?: string
  avatarUrls: {
    '16x16': string
    '24x24': string
    '32x32': string
    '48x48': string
  }
  active: boolean
}

export interface JiraIssueType {
  id: string
  name: string
  iconUrl: string
  subtask: boolean
}

export interface JiraPriority {
  id: string
  name: string
  iconUrl: string
}

// Time tracking types
export interface TimeTracking {
  originalEstimate: string | null
  originalEstimateSeconds: number | null
  remainingEstimate: string | null
  remainingEstimateSeconds: number | null
  timeSpent: string | null
  timeSpentSeconds: number | null
}

// Component types
export interface JiraComponent {
  id: string
  name: string
  description?: string
}

// Parent issue reference
export interface JiraParent {
  id: string
  key: string
  summary?: string
}

export interface JiraIssue {
  id: string
  key: string
  summary: string
  status: JiraStatus
  assignee: JiraAssignee | null
  issueType: JiraIssueType
  priority: JiraPriority
  created: string
  updated: string
  labels: string[]
  components: JiraComponent[]
  timeTracking: TimeTracking | null
  parent: JiraParent | null
  storyPoints: number | null
  completionCriteria: string | null
  webLiveDate: string | null
  devPic: JiraAssignee | string | null
  dueDate: string | null
}

// Dev PIC breakdown for widget
export interface DevPicBreakdown {
  devPic: JiraAssignee | string | null
  displayName: string
  issues: JiraIssue[]
  readyCount: number
  notReadyCount: number
}

export interface IssuesResponse {
  issues: JiraIssue[]
  total: number
  maxResults: number
  startAt: number
}

// Status category keys for grouping
export type StatusCategoryKey = 'new' | 'indeterminate' | 'done'

// Grouped issues by status category
export interface GroupedIssues {
  todo: JiraIssue[]
  inProgress: JiraIssue[]
  done: JiraIssue[]
}

// Grouped issues by assignee
export interface AssigneeGroup {
  assignee: JiraAssignee | null
  issues: JiraIssue[]
  totalPoints: number
}

// User estimate breakdown for time tracking widget
export interface UserEstimateBreakdown {
  assignee: JiraAssignee | null
  totalSeconds: number
  totalDays: number
  issues: {
    key: string
    summary: string
    estimateSeconds: number
    estimateDays: number
    isSubtask: boolean
    hasSubtasks?: boolean
    subtaskCount?: number
    estimatedSubtasks?: number
    parentKey?: string
  }[]
}

// Label summary for labels widget
export interface LabelSummary {
  name: string
  count: number
  issues: { key: string; summary: string }[]
}

// Component summary for components widget
export interface ComponentSummary {
  component: JiraComponent
  count: number
  issues: { key: string; summary: string }[]
}

// Completion criteria group for widget
export interface CompletionCriteriaGroup {
  issue: JiraIssue
  criteria: string | null
  subtasks: JiraIssue[]
}

// Web live date entry for widget
export interface WebLiveDateEntry {
  issue: JiraIssue
  webLiveDate: string
  daysUntil: number
  isOverdue: boolean
}

// Jira field for field discovery
export interface JiraField {
  id: string
  name: string
  custom: boolean
  schema?: {
    type: string
    custom?: string
  }
}

export interface FieldsResponse {
  total: number
  fields: JiraField[]
}
