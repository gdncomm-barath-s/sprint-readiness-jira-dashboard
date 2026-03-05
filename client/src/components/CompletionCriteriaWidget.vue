<script setup lang="ts">
import { computed, ref } from 'vue'
import type { JiraIssue, CompletionCriteriaGroup } from '../types/jira'

const props = defineProps<{
  issues: JiraIssue[]
}>()

const expandedStories = ref<Set<string>>(new Set())

// Group stories with their subtasks and completion criteria
const criteriaGroups = computed((): CompletionCriteriaGroup[] => {
  const stories: JiraIssue[] = []
  const subtaskMap = new Map<string, JiraIssue[]>()
  
  // Separate stories/tasks and subtasks
  for (const issue of props.issues) {
    if (issue.issueType.subtask && issue.parent) {
      const parentKey = issue.parent.key
      if (!subtaskMap.has(parentKey)) {
        subtaskMap.set(parentKey, [])
      }
      subtaskMap.get(parentKey)!.push(issue)
    } else if (!issue.issueType.subtask) {
      stories.push(issue)
    }
  }
  
  // Create groups with stories and their subtasks
  return stories.map(story => ({
    issue: story,
    criteria: story.completionCriteria,
    subtasks: subtaskMap.get(story.key) || []
  })).sort((a, b) => {
    // Sort: with criteria first, then by key
    if (a.criteria && !b.criteria) return -1
    if (!a.criteria && b.criteria) return 1
    return a.issue.key.localeCompare(b.issue.key)
  })
})

const storiesWithCriteria = computed(() => 
  criteriaGroups.value.filter(g => g.criteria).length
)

const storiesWithoutCriteria = computed(() => 
  criteriaGroups.value.filter(g => !g.criteria).length
)

const toggleExpand = (issueKey: string) => {
  if (expandedStories.value.has(issueKey)) {
    expandedStories.value.delete(issueKey)
  } else {
    expandedStories.value.add(issueKey)
  }
}

const truncateCriteria = (text: string | null, maxLength: number = 100) => {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <div class="px-4 py-3 bg-gray-50 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-gray-900">Completion Criteria</h3>
        <div class="flex items-center gap-2 text-sm">
          <span class="text-green-600">{{ storiesWithCriteria }} defined</span>
          <span class="text-gray-400">|</span>
          <span class="text-amber-600">{{ storiesWithoutCriteria }} missing</span>
        </div>
      </div>
    </div>
    
    <div class="divide-y divide-gray-100 max-h-96 overflow-y-auto">
      <div 
        v-for="group in criteriaGroups" 
        :key="group.issue.key"
        class="hover:bg-gray-50"
      >
        <!-- Story Header -->
        <button
          @click="toggleExpand(group.issue.key)"
          class="w-full px-4 py-3 flex items-start justify-between text-left"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span 
                :class="[
                  'w-2 h-2 rounded-full shrink-0',
                  group.criteria ? 'bg-green-500' : 'bg-amber-400'
                ]"
              ></span>
              <span class="text-blue-600 font-medium">{{ group.issue.key }}</span>
              <span class="text-gray-600 truncate">{{ group.issue.summary }}</span>
            </div>
            
            <!-- Preview of criteria -->
            <p v-if="group.criteria" class="mt-1 text-sm text-gray-500 pl-4">
              {{ truncateCriteria(group.criteria) }}
            </p>
            <p v-else class="mt-1 text-sm text-amber-600 pl-4 italic">
              No completion criteria defined
            </p>
          </div>
          
          <div class="flex items-center gap-2 shrink-0 ml-2">
            <span 
              v-if="group.subtasks.length > 0"
              class="text-xs text-gray-500"
            >
              {{ group.subtasks.length }} subtask{{ group.subtasks.length !== 1 ? 's' : '' }}
            </span>
            <svg 
              :class="[
                'w-5 h-5 text-gray-400 transition-transform',
                expandedStories.has(group.issue.key) ? 'rotate-180' : ''
              ]"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
        
        <!-- Expanded Details -->
        <div 
          v-if="expandedStories.has(group.issue.key)"
          class="px-4 pb-4"
        >
          <!-- Full Criteria -->
          <div v-if="group.criteria" class="bg-green-50 rounded-lg p-3 mb-3">
            <h4 class="text-xs font-medium text-green-800 mb-1">Completion Criteria</h4>
            <p class="text-sm text-green-900 whitespace-pre-wrap">{{ group.criteria }}</p>
          </div>
          
          <!-- Subtasks -->
          <div v-if="group.subtasks.length > 0" class="space-y-2">
            <h4 class="text-xs font-medium text-gray-500">Subtasks</h4>
            <div 
              v-for="subtask in group.subtasks" 
              :key="subtask.key"
              class="flex items-center gap-2 text-sm bg-gray-50 rounded px-3 py-2"
            >
              <span 
                :class="[
                  'w-2 h-2 rounded-full shrink-0',
                  subtask.status.statusCategory.key === 'done' ? 'bg-green-500' : 
                  subtask.status.statusCategory.key === 'indeterminate' ? 'bg-yellow-500' : 'bg-blue-500'
                ]"
              ></span>
              <span class="text-blue-600 font-medium shrink-0">{{ subtask.key }}</span>
              <span class="text-gray-600 truncate">{{ subtask.summary }}</span>
              <span class="ml-auto text-xs text-gray-500 shrink-0">{{ subtask.status.name }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Empty State -->
      <div v-if="criteriaGroups.length === 0" class="px-4 py-8 text-center text-gray-500">
        <svg class="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-sm">No stories in this sprint</p>
      </div>
    </div>
  </div>
</template>
