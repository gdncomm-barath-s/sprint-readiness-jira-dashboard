<script setup lang="ts">
import { computed } from 'vue'
import type { JiraIssue, WebLiveDateEntry } from '../types/jira'

const props = defineProps<{
  issues: JiraIssue[]
}>()

const today = new Date()
today.setHours(0, 0, 0, 0)

const liveDateEntries = computed((): WebLiveDateEntry[] => {
  return props.issues
    .filter(issue => issue.webLiveDate)
    .map(issue => {
      const liveDate = new Date(issue.webLiveDate!)
      liveDate.setHours(0, 0, 0, 0)
      const diffTime = liveDate.getTime() - today.getTime()
      const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      return {
        issue,
        webLiveDate: issue.webLiveDate!,
        daysUntil,
        isOverdue: daysUntil < 0
      }
    })
    .sort((a, b) => new Date(a.webLiveDate).getTime() - new Date(b.webLiveDate).getTime())
})

const overdueCount = computed(() => 
  liveDateEntries.value.filter(e => e.isOverdue).length
)

const upcomingCount = computed(() => 
  liveDateEntries.value.filter(e => !e.isOverdue && e.daysUntil <= 7).length
)

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

const getDaysLabel = (days: number) => {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return '1 day ago'
  if (days < 0) return `${Math.abs(days)} days ago`
  return `In ${days} days`
}

const getDateBadgeClass = (entry: WebLiveDateEntry) => {
  if (entry.isOverdue) {
    return 'bg-red-100 text-red-800'
  }
  if (entry.daysUntil <= 3) {
    return 'bg-amber-100 text-amber-800'
  }
  if (entry.daysUntil <= 7) {
    return 'bg-yellow-100 text-yellow-800'
  }
  return 'bg-green-100 text-green-800'
}

const getStatusIcon = (entry: WebLiveDateEntry) => {
  const status = entry.issue.status.statusCategory.key
  if (status === 'done') return { icon: '✓', class: 'text-green-600' }
  if (status === 'indeterminate') return { icon: '●', class: 'text-yellow-600' }
  return { icon: '○', class: 'text-blue-600' }
}
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <div class="px-4 py-3 bg-gray-50 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-gray-900">Web Live Dates</h3>
        <div class="flex items-center gap-3 text-sm">
          <span v-if="overdueCount > 0" class="text-red-600 font-medium">
            {{ overdueCount }} overdue
          </span>
          <span v-if="upcomingCount > 0" class="text-amber-600">
            {{ upcomingCount }} this week
          </span>
        </div>
      </div>
    </div>
    
    <div class="divide-y divide-gray-100 max-h-80 overflow-y-auto">
      <div 
        v-for="entry in liveDateEntries" 
        :key="entry.issue.key"
        class="px-4 py-3 hover:bg-gray-50"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span 
                :class="['text-sm', getStatusIcon(entry).class]"
                :title="entry.issue.status.name"
              >
                {{ getStatusIcon(entry).icon }}
              </span>
              <span class="text-blue-600 font-medium">{{ entry.issue.key }}</span>
              <span class="text-gray-600 truncate">{{ entry.issue.summary }}</span>
            </div>
            
            <!-- Assignee -->
            <div v-if="entry.issue.assignee" class="mt-1 flex items-center gap-2">
              <img 
                :src="entry.issue.assignee.avatarUrls['16x16']" 
                :alt="entry.issue.assignee.displayName"
                class="w-4 h-4 rounded-full"
              />
              <span class="text-xs text-gray-500">{{ entry.issue.assignee.displayName }}</span>
            </div>
          </div>
          
          <div class="flex flex-col items-end shrink-0 ml-3">
            <span 
              :class="[
                'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                getDateBadgeClass(entry)
              ]"
            >
              {{ formatDate(entry.webLiveDate) }}
            </span>
            <span 
              :class="[
                'text-xs mt-1',
                entry.isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'
              ]"
            >
              {{ getDaysLabel(entry.daysUntil) }}
            </span>
          </div>
        </div>
      </div>
      
      <!-- Empty State -->
      <div v-if="liveDateEntries.length === 0" class="px-4 py-8 text-center text-gray-500">
        <svg class="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p class="text-sm">No web live dates set</p>
        <p class="text-xs text-gray-400 mt-1">Configure the custom field ID in server/config.js</p>
      </div>
    </div>
  </div>
</template>
