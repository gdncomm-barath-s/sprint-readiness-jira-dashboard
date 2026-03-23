<script setup lang="ts">
import { computed, ref } from 'vue'
import type { JiraIssue, DevPicBreakdown } from '../types/jira'
import { useJira } from '../composables/useJira'

const props = defineProps<{
  issues: JiraIssue[]
}>()

const { getIssueUrl } = useJira()

const expandedPics = ref<Set<string>>(new Set())

// Check if issue is in "Done" status category
const isDone = (issue: JiraIssue): boolean => {
  return issue.status.statusCategory?.key === 'done'
}

// Get display name for Dev PIC
const getDevPicName = (devPic: JiraIssue['devPic']): string => {
  if (!devPic) return 'No Dev PIC'
  if (typeof devPic === 'string') return devPic
  return devPic.displayName || 'Unknown'
}

// Get Dev PIC key for grouping
const getDevPicKey = (devPic: JiraIssue['devPic']): string => {
  if (!devPic) return 'no-pic'
  if (typeof devPic === 'string') return devPic
  return devPic.accountId || 'unknown'
}

// Group issues by Dev PIC
const devPicBreakdown = computed((): DevPicBreakdown[] => {
  const picMap = new Map<string, DevPicBreakdown>()
  
  // Only process non-subtask, non-done issues
  const parentIssues = props.issues.filter(issue => 
    !issue.issueType.subtask && !isDone(issue)
  )
  
  for (const issue of parentIssues) {
    const key = getDevPicKey(issue.devPic)
    
    if (!picMap.has(key)) {
      picMap.set(key, {
        devPic: issue.devPic,
        displayName: getDevPicName(issue.devPic),
        issues: [],
        readyCount: 0,
        notReadyCount: 0
      })
    }
    
    const group = picMap.get(key)!
    group.issues.push(issue)
  }
  
  // Sort by issue count descending
  return Array.from(picMap.values())
    .filter(g => g.displayName !== 'No Dev PIC') // Optionally filter out issues without PIC
    .sort((a, b) => b.issues.length - a.issues.length)
})

// Get total issues with Dev PICs
const totalIssues = computed(() => 
  devPicBreakdown.value.reduce((sum, g) => sum + g.issues.length, 0)
)

const toggleExpand = (picKey: string) => {
  if (expandedPics.value.has(picKey)) {
    expandedPics.value.delete(picKey)
  } else {
    expandedPics.value.add(picKey)
  }
}

const getStatusBadgeClass = (status: string) => {
  const key = status.toLowerCase()
  if (key.includes('done') || key.includes('complete')) {
    return 'bg-green-100 text-green-800'
  } else if (key.includes('progress') || key.includes('review')) {
    return 'bg-blue-100 text-blue-800'
  }
  return 'bg-gray-100 text-gray-800'
}

const getIssueTypeIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'story': return '📖'
    case 'bug': return '🐛'
    case 'task': return '✅'
    case 'epic': return '⚡'
    default: return '📋'
  }
}
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <div class="px-4 py-3 bg-gray-50 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-gray-900">Dev PICs</h3>
        <span class="text-sm text-gray-500">
          {{ totalIssues }} issues across {{ devPicBreakdown.length }} PICs
        </span>
      </div>
    </div>
    
    <div class="divide-y divide-gray-100 max-h-96 overflow-y-auto">
      <div 
        v-for="pic in devPicBreakdown" 
        :key="getDevPicKey(pic.devPic)"
        class="hover:bg-gray-50"
      >
        <!-- PIC Header -->
        <button
          @click="toggleExpand(getDevPicKey(pic.devPic))"
          class="w-full px-4 py-3 flex items-center justify-between text-left"
        >
          <div class="flex items-center gap-3">
            <!-- Avatar for user-type PICs -->
            <template v-if="pic.devPic && typeof pic.devPic === 'object'">
              <img 
                :src="pic.devPic.avatarUrls?.['24x24']" 
                :alt="pic.displayName"
                class="w-8 h-8 rounded-full"
              />
            </template>
            <div 
              v-else 
              class="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center"
            >
              <span class="text-purple-600 font-semibold text-sm">
                {{ pic.displayName.charAt(0).toUpperCase() }}
              </span>
            </div>
            <div>
              <p class="font-medium text-gray-900">{{ pic.displayName }}</p>
              <p class="text-xs text-gray-500">
                {{ pic.issues.length }} issue{{ pic.issues.length !== 1 ? 's' : '' }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-lg font-semibold text-purple-600">
              {{ pic.issues.length }}
            </span>
            <svg 
              :class="[
                'w-5 h-5 text-gray-400 transition-transform',
                expandedPics.has(getDevPicKey(pic.devPic)) ? 'rotate-180' : ''
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
          v-if="expandedPics.has(getDevPicKey(pic.devPic))"
          class="px-4 pb-3 pl-16 space-y-2"
        >
          <div 
            v-for="issue in pic.issues" 
            :key="issue.key"
            class="flex items-center justify-between text-sm bg-gray-50 rounded-md px-3 py-2"
          >
            <div class="flex items-center gap-2 min-w-0">
              <span>{{ getIssueTypeIcon(issue.issueType.name) }}</span>
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
                  'px-2 py-0.5 rounded text-xs font-medium',
                  getStatusBadgeClass(issue.status.name)
                ]"
              >
                {{ issue.status.name }}
              </span>
              <img 
                v-if="issue.assignee"
                :src="issue.assignee.avatarUrls['24x24']" 
                :alt="issue.assignee.displayName"
                :title="issue.assignee.displayName"
                class="w-5 h-5 rounded-full"
              />
            </div>
          </div>
        </div>
      </div>
      
      <!-- Empty State -->
      <div v-if="devPicBreakdown.length === 0" class="px-4 py-8 text-center text-gray-500">
        <svg class="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <p class="text-sm">No Dev PICs assigned</p>
        <p class="text-xs text-gray-400 mt-1">Configure the Dev PIC custom field in server/config.js</p>
      </div>
    </div>
  </div>
</template>
