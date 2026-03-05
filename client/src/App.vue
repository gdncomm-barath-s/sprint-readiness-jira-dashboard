<script setup lang="ts">
import { ref } from 'vue'
import SprintSelector from './components/SprintSelector.vue'
import IssueBoard from './components/IssueBoard.vue'
import AssigneeView from './components/AssigneeView.vue'
import IssueDetailsTable from './components/IssueDetailsTable.vue'
import UserEstimatesWidget from './components/UserEstimatesWidget.vue'
import DevPicWidget from './components/DevPicWidget.vue'
import { useJira } from './composables/useJira'
import type { JiraIssue } from './types/jira'

const { fetchSprintIssues } = useJira()

const issues = ref<JiraIssue[]>([])
const selectedSprintId = ref<number | null>(null)
const selectedSprintName = ref<string>('')
const viewMode = ref<'board' | 'assignee' | 'details'>('details')
const loading = ref(false)

const handleSprintChange = (sprintId: number, sprintIssues: JiraIssue[], sprintName?: string) => {
  selectedSprintId.value = sprintId
  issues.value = sprintIssues
  selectedSprintName.value = sprintName || `Sprint ${sprintId}`
}

const handleRefresh = async () => {
  if (selectedSprintId.value) {
    loading.value = true
    issues.value = await fetchSprintIssues(selectedSprintId.value)
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold text-gray-900">Jira Sprint Dashboard</h1>
          <div class="flex items-center gap-4">
            <!-- View Toggle -->
            <div class="flex bg-gray-100 rounded-lg p-1">
              <button
                @click="viewMode = 'board'"
                :class="[
                  'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                  viewMode === 'board'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                ]"
              >
                Board
              </button>
              <button
                @click="viewMode = 'assignee'"
                :class="[
                  'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                  viewMode === 'assignee'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                ]"
              >
                Assignee
              </button>
              <button
                @click="viewMode = 'details'"
                :class="[
                  'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                  viewMode === 'details'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                ]"
              >
                Details
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <!-- Sprint Selector -->
      <SprintSelector 
        @sprint-change="handleSprintChange"
        @loading="loading = $event"
      />

      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>

      <!-- No Sprint Selected -->
      <div v-else-if="!selectedSprintId" class="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">No sprint selected</h3>
        <p class="mt-1 text-sm text-gray-500">Select a board and sprint above to view issues.</p>
      </div>

      <!-- Board View -->
      <template v-else-if="viewMode === 'board'">
        <IssueBoard :issues="issues" />
      </template>

      <!-- Assignee View -->
      <template v-else-if="viewMode === 'assignee'">
        <AssigneeView :issues="issues" />
      </template>

      <!-- Details View (New Page with Table + User Estimates) -->
      <template v-else-if="viewMode === 'details'">
        <div class="space-y-6">
          <!-- Widgets Row -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- User Estimates -->
            <UserEstimatesWidget :issues="issues" />
            
            <!-- Dev PICs -->
            <DevPicWidget :issues="issues" />
          </div>
          
          <!-- Issue Details Table -->
          <IssueDetailsTable :issues="issues" :sprint-name="selectedSprintName" />
        </div>
      </template>
    </main>
  </div>
</template>
