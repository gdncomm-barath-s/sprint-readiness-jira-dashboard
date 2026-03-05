<script setup lang="ts">
import type { JiraIssue } from '../types/jira'
import { useJira } from '../composables/useJira'

const props = defineProps<{
  issue: JiraIssue
}>()

const { getIssueUrl } = useJira()

const getPriorityColor = (priority: string) => {
  switch (priority.toLowerCase()) {
    case 'highest':
      return 'text-red-600'
    case 'high':
      return 'text-orange-500'
    case 'medium':
      return 'text-yellow-500'
    case 'low':
      return 'text-blue-500'
    case 'lowest':
      return 'text-gray-400'
    default:
      return 'text-gray-500'
  }
}

const getIssueTypeIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'story':
      return '📖'
    case 'bug':
      return '🐛'
    case 'task':
      return '✅'
    case 'epic':
      return '⚡'
    case 'subtask':
    case 'sub-task':
      return '📌'
    default:
      return '📋'
  }
}
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md transition-shadow cursor-pointer">
    <!-- Header: Issue Key and Type -->
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2">
        <span class="text-lg" :title="issue.issueType.name">
          {{ getIssueTypeIcon(issue.issueType.name) }}
        </span>
        <a 
          :href="getIssueUrl(issue.key)" 
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
          @click.stop
        >
          {{ issue.key }}
        </a>
      </div>
      <span 
        v-if="issue.storyPoints"
        class="inline-flex items-center justify-center w-6 h-6 text-xs font-semibold bg-gray-100 text-gray-700 rounded-full"
        title="Story Points"
      >
        {{ issue.storyPoints }}
      </span>
    </div>

    <!-- Summary -->
    <p class="text-sm text-gray-900 mb-3 line-clamp-2">
      {{ issue.summary }}
    </p>

    <!-- Footer: Priority, Labels, Assignee -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <!-- Priority -->
        <span 
          :class="['text-sm font-medium', getPriorityColor(issue.priority.name)]"
          :title="issue.priority.name"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
          </svg>
        </span>

        <!-- Labels (show first 2) -->
        <div class="flex gap-1">
          <span 
            v-for="label in issue.labels.slice(0, 2)" 
            :key="label"
            class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800"
          >
            {{ label }}
          </span>
          <span 
            v-if="issue.labels.length > 2"
            class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
          >
            +{{ issue.labels.length - 2 }}
          </span>
        </div>
      </div>

      <!-- Assignee Avatar -->
      <div v-if="issue.assignee" class="flex-shrink-0">
        <img 
          :src="issue.assignee.avatarUrls['24x24']" 
          :alt="issue.assignee.displayName"
          :title="issue.assignee.displayName"
          class="w-6 h-6 rounded-full ring-2 ring-white"
        />
      </div>
      <div 
        v-else 
        class="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center"
        title="Unassigned"
      >
        <svg class="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
