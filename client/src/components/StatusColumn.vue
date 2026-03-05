<script setup lang="ts">
import IssueCard from './IssueCard.vue'
import type { JiraIssue } from '../types/jira'

const props = defineProps<{
  title: string
  issues: JiraIssue[]
  color: 'blue' | 'yellow' | 'green'
}>()

const colorClasses = {
  blue: {
    header: 'bg-blue-50 border-blue-200',
    title: 'text-blue-800',
    count: 'bg-blue-200 text-blue-800'
  },
  yellow: {
    header: 'bg-yellow-50 border-yellow-200',
    title: 'text-yellow-800',
    count: 'bg-yellow-200 text-yellow-800'
  },
  green: {
    header: 'bg-green-50 border-green-200',
    title: 'text-green-800',
    count: 'bg-green-200 text-green-800'
  }
}

const totalPoints = props.issues.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0)
</script>

<template>
  <div class="flex flex-col bg-gray-50 rounded-lg border border-gray-200 min-h-[500px]">
    <!-- Column Header -->
    <div 
      :class="[
        'flex items-center justify-between px-4 py-3 rounded-t-lg border-b',
        colorClasses[color].header
      ]"
    >
      <div class="flex items-center gap-2">
        <h3 :class="['font-semibold', colorClasses[color].title]">
          {{ title }}
        </h3>
        <span 
          :class="[
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
            colorClasses[color].count
          ]"
        >
          {{ issues.length }}
        </span>
      </div>
      <span 
        v-if="totalPoints > 0"
        class="text-xs text-gray-500"
      >
        {{ totalPoints }} pts
      </span>
    </div>

    <!-- Issues List -->
    <div class="flex-1 p-3 space-y-3 overflow-y-auto">
      <IssueCard 
        v-for="issue in issues" 
        :key="issue.id" 
        :issue="issue" 
      />
      
      <!-- Empty State -->
      <div 
        v-if="issues.length === 0" 
        class="flex flex-col items-center justify-center h-32 text-gray-400"
      >
        <svg class="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p class="text-sm">No issues</p>
      </div>
    </div>
  </div>
</template>
