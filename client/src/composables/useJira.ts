import { ref } from 'vue'
import axios from 'axios'
import type { 
  JiraBoard, 
  BoardsResponse, 
  JiraSprint, 
  SprintsResponse, 
  JiraIssue, 
  IssuesResponse,
  GroupedIssues,
  AssigneeGroup
} from '../types/jira'

const api = axios.create({
  baseURL: '/api'
})

// Global Jira domain - set once on health check
let jiraDomain: string | null = null

export function useJira() {
  const boards = ref<JiraBoard[]>([])
  const sprints = ref<JiraSprint[]>([])
  const issues = ref<JiraIssue[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Get Jira issue URL
  function getIssueUrl(issueKey: string): string {
    if (jiraDomain) {
      return `https://${jiraDomain}/browse/${issueKey}`
    }
    return `#${issueKey}`
  }

  // Fetch all Scrum boards
  async function fetchBoards(): Promise<JiraBoard[]> {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.get<BoardsResponse>('/boards')
      boards.value = response.data.values
      return boards.value
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch boards'
      console.error('Error fetching boards:', err)
      return []
    } finally {
      loading.value = false
    }
  }

  // Fetch sprints for a board
  async function fetchSprints(boardId: number, state?: string): Promise<JiraSprint[]> {
    loading.value = true
    error.value = null
    
    try {
      const params = state ? { state } : {}
      const response = await api.get<SprintsResponse>(`/boards/${boardId}/sprints`, { params })
      sprints.value = response.data.values
      return sprints.value
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch sprints'
      console.error('Error fetching sprints:', err)
      return []
    } finally {
      loading.value = false
    }
  }

  // Fetch ALL issues for a sprint (handles pagination)
  async function fetchSprintIssues(sprintId: number): Promise<JiraIssue[]> {
    loading.value = true
    error.value = null
    
    try {
      const allIssues: JiraIssue[] = []
      let startAt = 0
      const maxResults = 100
      let total = 0
      
      // Fetch all pages of issues
      do {
        const response = await api.get<IssuesResponse>(`/sprints/${sprintId}/issues`, {
          params: { startAt, maxResults }
        })
        
        allIssues.push(...response.data.issues)
        total = response.data.total
        startAt += maxResults
        
        console.log(`Fetched ${allIssues.length} of ${total} issues`)
      } while (startAt < total)
      
      issues.value = allIssues
      return issues.value
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch issues'
      console.error('Error fetching issues:', err)
      return []
    } finally {
      loading.value = false
    }
  }

  // Group issues by status category
  function groupIssuesByStatus(issueList: JiraIssue[]): GroupedIssues {
    const grouped: GroupedIssues = {
      todo: [],
      inProgress: [],
      done: []
    }

    for (const issue of issueList) {
      const categoryKey = issue.status.statusCategory.key
      
      if (categoryKey === 'new') {
        grouped.todo.push(issue)
      } else if (categoryKey === 'indeterminate') {
        grouped.inProgress.push(issue)
      } else if (categoryKey === 'done') {
        grouped.done.push(issue)
      }
    }

    return grouped
  }

  // Group issues by assignee
  function groupIssuesByAssignee(issueList: JiraIssue[]): AssigneeGroup[] {
    const assigneeMap = new Map<string, AssigneeGroup>()
    
    for (const issue of issueList) {
      const key = issue.assignee?.accountId || 'unassigned'
      
      if (!assigneeMap.has(key)) {
        assigneeMap.set(key, {
          assignee: issue.assignee,
          issues: [],
          totalPoints: 0
        })
      }
      
      const group = assigneeMap.get(key)!
      group.issues.push(issue)
      group.totalPoints += issue.storyPoints || 0
    }

    // Sort by assignee name, with unassigned at the end
    return Array.from(assigneeMap.values()).sort((a, b) => {
      if (!a.assignee) return 1
      if (!b.assignee) return -1
      return a.assignee.displayName.localeCompare(b.assignee.displayName)
    })
  }

  // Check API health and get Jira domain
  async function checkHealth(): Promise<boolean> {
    try {
      const response = await api.get('/health')
      if (response.data.jiraDomain) {
        jiraDomain = response.data.jiraDomain
      }
      return response.data.configured
    } catch {
      return false
    }
  }

  // Get the Jira domain
  function getJiraDomain(): string | null {
    return jiraDomain
  }

  return {
    boards,
    sprints,
    issues,
    loading,
    error,
    fetchBoards,
    fetchSprints,
    fetchSprintIssues,
    groupIssuesByStatus,
    groupIssuesByAssignee,
    checkHealth,
    getIssueUrl,
    getJiraDomain
  }
}
