<script setup lang="ts">
import { computed } from 'vue'
import IssueCard from './IssueCard.vue'
import { useJira } from '../composables/useJira'
import type { JiraIssue, AssigneeGroup } from '../types/jira'

const props = defineProps<{
  issues: JiraIssue[]
}>()

const { groupIssuesByAssignee } = useJira()

const assigneeGroups = computed(() => groupIssuesByAssignee(props.issues))

const getStatusBreakdown = (issues: JiraIssue[]) => {
  const breakdown = {
    todo: 0,
    inProgress: 0,
    done: 0
  }
  
  for (const issue of issues) {
    const categoryKey = issue.status.statusCategory.key
    if (categoryKey === 'new') breakdown.todo++
    else if (categoryKey === 'indeterminate') breakdown.inProgress++
    else if (categoryKey === 'done') breakdown.done++
  }
  
  return breakdown
}

const getCompletionPercentage = (issues: JiraIssue[]) => {
  if (issues.length === 0) return 0
  const done = issues.filter(i => i.status.statusCategory.key === 'done').length
  return Math.round((done / issues.length) * 100)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Summary Stats -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 class="text-sm font-medium text-gray-700 mb-3">Team Workload</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div 
          v-for="group in assigneeGroups" 
          :key="group.assignee?.accountId || 'unassigned'"
          class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
        >
          <img 
            v-if="group.assignee"
            :src="group.assignee.avatarUrls['32x32']" 
            :alt="group.assignee.displayName"
            class="w-10 h-10 rounded-full"
          />
          <div 
            v-else 
            class="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center"
          >
            <svg class="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-gray-900 truncate">
              {{ group.assignee?.displayName || 'Unassigned' }}
            </p>
            <p class="text-xs text-gray-500">
              {{ group.issues.length }} issues · {{ group.totalPoints }} pts
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Assignee Groups -->
    <div 
      v-for="group in assigneeGroups" 
      :key="group.assignee?.accountId || 'unassigned'"
      class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
    >
      <!-- Assignee Header -->
      <div class="bg-gray-50 border-b border-gray-200 px-4 py-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <img 
              v-if="group.assignee"
              :src="group.assignee.avatarUrls['32x32']" 
              :alt="group.assignee.displayName"
              class="w-10 h-10 rounded-full ring-2 ring-white shadow"
            />
            <div 
              v-else 
              class="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center ring-2 ring-white shadow"
            >
              <svg class="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-gray-900">
                {{ group.assignee?.displayName || 'Unassigned' }}
              </h3>
              <p class="text-sm text-gray-500">
                {{ group.issues.length }} issues · {{ group.totalPoints }} story points
              </p>
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="hidden md:flex items-center gap-4">
            <div class="flex items-center gap-2 text-xs text-gray-500">
              <span class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-blue-400"></span>
                {{ getStatusBreakdown(group.issues).todo }}
              </span>
              <span class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-yellow-400"></span>
                {{ getStatusBreakdown(group.issues).inProgress }}
              </span>
              <span class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-green-400"></span>
                {{ getStatusBreakdown(group.issues).done }}
              </span>
            </div>
            <div class="w-32 bg-gray-200 rounded-full h-2">
              <div 
                class="bg-green-500 h-2 rounded-full transition-all duration-300"
                :style="{ width: `${getCompletionPercentage(group.issues)}%` }"
              ></div>
            </div>
            <span class="text-sm font-medium text-gray-700">
              {{ getCompletionPercentage(group.issues) }}%
            </span>
          </div>
        </div>
      </div>

      <!-- Issues Grid -->
      <div class="p-4">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <IssueCard 
            v-for="issue in group.issues" 
            :key="issue.id" 
            :issue="issue" 
          />
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div 
      v-if="assigneeGroups.length === 0" 
      class="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200"
    >
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">No issues found</h3>
      <p class="mt-1 text-sm text-gray-500">Select a sprint to view team assignments.</p>
    </div>
  </div>
</template>
