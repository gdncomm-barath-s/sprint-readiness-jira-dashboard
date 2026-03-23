<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useJira } from '../composables/useJira'
import type { JiraBoard, JiraSprint, JiraIssue } from '../types/jira'

const emit = defineEmits<{
  (e: 'sprint-change', sprintId: number, issues: JiraIssue[], sprintName: string): void
  (e: 'loading', value: boolean): void
}>()

const { 
  fetchBoards, 
  fetchSprints, 
  fetchSprintIssues, 
  checkHealth,
  loading,
  error 
} = useJira()

const boards = ref<JiraBoard[]>([])
const sprints = ref<JiraSprint[]>([])
const selectedBoardId = ref<number | null>(null)
const selectedSprintId = ref<number | null>(null)
const isConfigured = ref(true)
const sprintFilter = ref<'all' | 'active' | 'future' | 'closed'>('future')

// Default board name to auto-select
const DEFAULT_BOARD_NAME = 'Bliklan'

onMounted(async () => {
  isConfigured.value = await checkHealth()
  if (isConfigured.value) {
    boards.value = await fetchBoards()
    
    // Auto-select default board (Bliklan)
    const defaultBoard = boards.value.find(b => 
      b.name.toLowerCase().includes(DEFAULT_BOARD_NAME.toLowerCase())
    )
    if (defaultBoard) {
      selectedBoardId.value = defaultBoard.id
    }
  }
})

// Watch for board selection changes
watch(selectedBoardId, async (boardId) => {
  if (boardId) {
    sprints.value = []
    selectedSprintId.value = null
    const state = sprintFilter.value === 'all' ? undefined : sprintFilter.value
    sprints.value = await fetchSprints(boardId, state)
    
    // Auto-select first future sprint, or first sprint if none are future
    const futureSprints = sprints.value.filter(s => s.state === 'future')
    if (futureSprints.length > 0) {
      selectedSprintId.value = futureSprints[0].id
    } else if (sprints.value.length > 0) {
      selectedSprintId.value = sprints.value[0].id
    }
  }
})

// Watch for sprint filter changes
watch(sprintFilter, async () => {
  if (selectedBoardId.value) {
    const state = sprintFilter.value === 'all' ? undefined : sprintFilter.value
    sprints.value = await fetchSprints(selectedBoardId.value, state)
  }
})

// Watch for sprint selection changes
watch(selectedSprintId, async (sprintId) => {
  if (sprintId) {
    emit('loading', true)
    const issues = await fetchSprintIssues(sprintId)
    emit('loading', false)
    const sprint = sprints.value.find(s => s.id === sprintId)
    emit('sprint-change', sprintId, issues, sprint?.name || `Sprint ${sprintId}`)
  }
})

// Watch loading state
watch(loading, (value) => {
  emit('loading', value)
})

const getSprintBadgeClass = (state: string) => {
  switch (state) {
    case 'active':
      return 'bg-green-100 text-green-800'
    case 'future':
      return 'bg-blue-100 text-blue-800'
    case 'closed':
      return 'bg-gray-100 text-gray-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const formatDate = (dateString?: string) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString()
}
</script>

<template>
  <!-- Configuration Warning -->
  <div 
    v-if="!isConfigured" 
    class="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4"
  >
    <div class="flex">
      <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
      <div class="ml-3">
        <h3 class="text-sm font-medium text-yellow-800">Configuration Required</h3>
        <p class="mt-1 text-sm text-yellow-700">
          Please configure your Jira credentials in the <code class="bg-yellow-100 px-1 rounded">.env</code> file. 
          See the README for setup instructions.
        </p>
      </div>
    </div>
  </div>

  <!-- Error Message -->
  <div 
    v-if="error" 
    class="mb-6 bg-red-50 border border-red-200 rounded-lg p-4"
  >
    <div class="flex">
      <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
      </svg>
      <div class="ml-3">
        <p class="text-sm text-red-700">{{ error }}</p>
      </div>
    </div>
  </div>

  <!-- Selector Controls -->
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- Board Selector -->
      <div>
        <label for="board" class="block text-sm font-medium text-gray-700 mb-1">
          Board
        </label>
        <select
          id="board"
          v-model="selectedBoardId"
          :disabled="!isConfigured || boards.length === 0"
          class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option :value="null" disabled>Select a board...</option>
          <option v-for="board in boards" :key="board.id" :value="board.id">
            {{ board.name }}
          </option>
        </select>
      </div>

      <!-- Sprint Filter -->
      <div>
        <label for="sprint-filter" class="block text-sm font-medium text-gray-700 mb-1">
          Sprint Filter
        </label>
        <select
          id="sprint-filter"
          v-model="sprintFilter"
          :disabled="!selectedBoardId"
          class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="all">All Sprints</option>
          <option value="active">Active Only</option>
          <option value="future">Future Only</option>
          <option value="closed">Closed Only</option>
        </select>
      </div>

      <!-- Sprint Selector -->
      <div>
        <label for="sprint" class="block text-sm font-medium text-gray-700 mb-1">
          Sprint
        </label>
        <select
          id="sprint"
          v-model="selectedSprintId"
          :disabled="!selectedBoardId || sprints.length === 0"
          class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option :value="null" disabled>Select a sprint...</option>
          <option v-for="sprint in sprints" :key="sprint.id" :value="sprint.id">
            {{ sprint.name }}
          </option>
        </select>
      </div>
    </div>

    <!-- Selected Sprint Details -->
    <div 
      v-if="selectedSprintId" 
      class="mt-4 pt-4 border-t border-gray-200"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span 
            v-if="sprints.find(s => s.id === selectedSprintId)"
            :class="[
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
              getSprintBadgeClass(sprints.find(s => s.id === selectedSprintId)?.state || '')
            ]"
          >
            {{ sprints.find(s => s.id === selectedSprintId)?.state?.toUpperCase() }}
          </span>
          <span class="text-sm text-gray-500">
            {{ formatDate(sprints.find(s => s.id === selectedSprintId)?.startDate) }}
            –
            {{ formatDate(sprints.find(s => s.id === selectedSprintId)?.endDate) }}
          </span>
        </div>
        <p 
          v-if="sprints.find(s => s.id === selectedSprintId)?.goal"
          class="text-sm text-gray-600 italic"
        >
          "{{ sprints.find(s => s.id === selectedSprintId)?.goal }}"
        </p>
      </div>
    </div>
  </div>
</template>
