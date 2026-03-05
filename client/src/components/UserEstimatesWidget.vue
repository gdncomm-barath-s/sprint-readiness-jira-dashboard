<script setup lang="ts">
import { computed, ref } from 'vue'
import type { JiraIssue, UserEstimateBreakdown } from '../types/jira'
import { useJira } from '../composables/useJira'

const props = defineProps<{
  issues: JiraIssue[]
}>()

const { getIssueUrl } = useJira()

const SECONDS_PER_DAY = 8 * 60 * 60 // 8 hours per day

const expandedUsers = ref<Set<string>>(new Set())

// Filter toggle to hide/show done issues
const hideDone = ref(true)

// Check if issue is in "Done" status category
const isDone = (issue: JiraIssue): boolean => {
  return issue.status.statusCategory?.key === 'done'
}

// Get subtasks for a parent issue
const getSubtasks = (parentKey: string): JiraIssue[] => {
  return props.issues.filter(issue => 
    issue.issueType.subtask && issue.parent?.key === parentKey
  )
}

const userEstimates = computed((): UserEstimateBreakdown[] => {
  const userMap = new Map<string, UserEstimateBreakdown>()
  
  // Helper to add issue to user's group
  const addToUser = (assignee: JiraIssue['assignee'], issueData: UserEstimateBreakdown['issues'][0]) => {
    const key = assignee?.accountId || 'unassigned'
    
    if (!userMap.has(key)) {
      userMap.set(key, {
        assignee: assignee,
        totalSeconds: 0,
        totalDays: 0,
        issues: []
      })
    }
    
    const group = userMap.get(key)!
    group.totalSeconds += issueData.estimateSeconds
    group.issues.push(issueData)
  }
  
  // Get all parent issues (non-subtasks)
  const parentIssues = props.issues.filter(issue => !issue.issueType.subtask)
  
  for (const issue of parentIssues) {
    const subtasks = getSubtasks(issue.key)
    // Filter subtasks by done status independently from parent
    const activeSubtasks = hideDone.value ? subtasks.filter(st => !isDone(st)) : subtasks
    
    if (subtasks.length > 0) {
      // Has subtasks - add ONLY non-done subtasks to their respective assignees
      for (const subtask of activeSubtasks) {
        const stEstimate = subtask.timeTracking?.originalEstimateSeconds || 0
        
        addToUser(subtask.assignee, {
          key: subtask.key,
          summary: `${issue.key}: ${subtask.summary}`,
          estimateSeconds: stEstimate,
          estimateDays: stEstimate / SECONDS_PER_DAY,
          isSubtask: true,
          hasSubtasks: false,
          subtaskCount: 0,
          estimatedSubtasks: 0,
          parentKey: issue.key
        })
      }
    } else {
      // No subtasks - add the parent issue only if not done (or filter is off)
      if (hideDone.value && isDone(issue)) {
        continue
      }
      
      const estimate = issue.timeTracking?.originalEstimateSeconds || 0
      
      addToUser(issue.assignee, {
        key: issue.key,
        summary: issue.summary,
        estimateSeconds: estimate,
        estimateDays: estimate / SECONDS_PER_DAY,
        isSubtask: false,
        hasSubtasks: false,
        subtaskCount: 0,
        estimatedSubtasks: 0
      })
    }
  }
  
  // Calculate total days for each user
  for (const group of userMap.values()) {
    group.totalDays = group.totalSeconds / SECONDS_PER_DAY
  }
  
  // Sort by total estimate descending, then by issue count
  return Array.from(userMap.values())
    .sort((a, b) => {
      if (b.totalSeconds !== a.totalSeconds) return b.totalSeconds - a.totalSeconds
      return b.issues.length - a.issues.length
    })
})

const totalEstimateDays = computed(() => 
  userEstimates.value.reduce((sum, u) => sum + u.totalDays, 0)
)

const toggleExpand = (userId: string) => {
  if (expandedUsers.value.has(userId)) {
    expandedUsers.value.delete(userId)
  } else {
    expandedUsers.value.add(userId)
  }
}

const formatDays = (days: number) => {
  if (days < 1) {
    const hours = days * 8
    return `${hours.toFixed(1)}h`
  }
  return `${days.toFixed(1)}d`
}
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <div class="px-4 py-3 bg-gray-50 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <h3 class="font-semibold text-gray-900">User Estimates</h3>
          <!-- Hide Done Toggle -->
          <label class="inline-flex items-center gap-1.5 cursor-pointer">
            <input 
              type="checkbox" 
              v-model="hideDone"
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span class="text-xs text-gray-600">Hide Done</span>
          </label>
        </div>
        <span class="text-sm text-gray-500">
          Total: {{ formatDays(totalEstimateDays) }}
        </span>
      </div>
    </div>
    
    <div class="divide-y divide-gray-100 max-h-96 overflow-y-auto">
      <div 
        v-for="user in userEstimates" 
        :key="user.assignee?.accountId || 'unassigned'"
        class="hover:bg-gray-50"
      >
        <!-- User Header -->
        <button
          @click="toggleExpand(user.assignee?.accountId || 'unassigned')"
          class="w-full px-4 py-3 flex items-center justify-between text-left"
        >
          <div class="flex items-center gap-3">
            <img 
              v-if="user.assignee"
              :src="user.assignee.avatarUrls['24x24']" 
              :alt="user.assignee.displayName"
              class="w-8 h-8 rounded-full"
            />
            <div 
              v-else 
              class="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center"
            >
              <svg class="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
              </svg>
            </div>
            <div>
              <p class="font-medium text-gray-900">
                {{ user.assignee?.displayName || 'Unassigned' }}
              </p>
              <p class="text-xs text-gray-500">
                {{ user.issues.length }} issue{{ user.issues.length !== 1 ? 's' : '' }}
                <span 
                  v-if="user.issues.filter(i => i.estimateSeconds === 0).length > 0"
                  class="text-red-500 font-medium"
                >
                  ({{ user.issues.filter(i => i.estimateSeconds === 0).length }} missing estimates)
                </span>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-lg font-semibold text-blue-600">
              {{ formatDays(user.totalDays) }}
            </span>
            <svg 
              :class="[
                'w-5 h-5 text-gray-400 transition-transform',
                expandedUsers.has(user.assignee?.accountId || 'unassigned') ? 'rotate-180' : ''
              ]"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
        
        <!-- Expanded Issue List -->
        <div 
          v-if="expandedUsers.has(user.assignee?.accountId || 'unassigned')"
          class="px-4 pb-3 pl-16 space-y-2"
        >
          <div 
            v-for="issue in user.issues" 
            :key="issue.key"
            :class="[
              'flex items-center justify-between text-sm rounded-md px-3 py-2',
              issue.estimateSeconds === 0 ? 'bg-red-50' : 'bg-gray-50'
            ]"
          >
            <div class="flex items-center gap-2 min-w-0">
              <a 
                :href="getIssueUrl(issue.key)" 
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 font-medium shrink-0 hover:text-blue-800 hover:underline"
              >{{ issue.key }}</a>
              <span class="text-gray-600 truncate">{{ issue.summary }}</span>
            </div>
            <div class="flex items-center gap-2 shrink-0 ml-2">
              <span 
                :class="[
                  issue.estimateSeconds === 0 ? 'text-red-500 font-medium' : 'text-gray-500'
                ]"
              >
                {{ issue.estimateSeconds === 0 ? 'No estimate' : formatDays(issue.estimateDays) }}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Empty State -->
      <div v-if="userEstimates.length === 0" class="px-4 py-8 text-center text-gray-500">
        <svg class="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-sm">No time estimates found</p>
      </div>
    </div>
  </div>
</template>
