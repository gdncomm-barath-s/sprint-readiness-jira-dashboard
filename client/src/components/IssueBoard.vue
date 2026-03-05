<script setup lang="ts">
import { computed } from 'vue'
import StatusColumn from './StatusColumn.vue'
import { useJira } from '../composables/useJira'
import type { JiraIssue } from '../types/jira'

const props = defineProps<{
  issues: JiraIssue[]
}>()

const { groupIssuesByStatus } = useJira()

const groupedIssues = computed(() => groupIssuesByStatus(props.issues))

const totalPoints = computed(() => 
  props.issues.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0)
)

const completedPoints = computed(() =>
  groupedIssues.value.done.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0)
)

const completionPercentage = computed(() => {
  if (totalPoints.value === 0) return 0
  return Math.round((completedPoints.value / totalPoints.value) * 100)
})
</script>

<template>
  <div>
    <!-- Sprint Progress -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-medium text-gray-700">Sprint Progress</h3>
        <span class="text-sm text-gray-500">
          {{ completedPoints }} / {{ totalPoints }} story points ({{ completionPercentage }}%)
        </span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2.5">
        <div 
          class="bg-green-500 h-2.5 rounded-full transition-all duration-500"
          :style="{ width: `${completionPercentage}%` }"
        ></div>
      </div>
      <div class="flex justify-between mt-2 text-xs text-gray-500">
        <span>{{ groupedIssues.todo.length }} To Do</span>
        <span>{{ groupedIssues.inProgress.length }} In Progress</span>
        <span>{{ groupedIssues.done.length }} Done</span>
      </div>
    </div>

    <!-- Kanban Board -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatusColumn 
        title="To Do" 
        :issues="groupedIssues.todo" 
        color="blue"
      />
      <StatusColumn 
        title="In Progress" 
        :issues="groupedIssues.inProgress" 
        color="yellow"
      />
      <StatusColumn 
        title="Done" 
        :issues="groupedIssues.done" 
        color="green"
      />
    </div>
  </div>
</template>
