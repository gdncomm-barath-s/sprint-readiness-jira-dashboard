<script setup lang="ts">
import { computed, ref } from 'vue'
import axios from 'axios'
import type { JiraIssue, LabelSummary } from '../types/jira'

const props = defineProps<{
  issues: JiraIssue[]
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
}>()

const showAddModal = ref(false)
const selectedIssues = ref<string[]>([])
const newLabel = ref('')
const isAdding = ref(false)
const error = ref<string | null>(null)

const labelSummaries = computed((): LabelSummary[] => {
  const labelMap = new Map<string, LabelSummary>()
  
  for (const issue of props.issues) {
    for (const label of issue.labels) {
      if (!labelMap.has(label)) {
        labelMap.set(label, {
          name: label,
          count: 0,
          issues: []
        })
      }
      
      const summary = labelMap.get(label)!
      summary.count++
      summary.issues.push({
        key: issue.key,
        summary: issue.summary
      })
    }
  }
  
  return Array.from(labelMap.values()).sort((a, b) => b.count - a.count)
})

const totalLabels = computed(() => labelSummaries.value.length)

const issuesWithoutLabels = computed(() => 
  props.issues.filter(i => i.labels.length === 0)
)

const openAddModal = () => {
  showAddModal.value = true
  selectedIssues.value = []
  newLabel.value = ''
  error.value = null
}

const closeModal = () => {
  showAddModal.value = false
  selectedIssues.value = []
  newLabel.value = ''
  error.value = null
}

const toggleIssue = (issueKey: string) => {
  const index = selectedIssues.value.indexOf(issueKey)
  if (index === -1) {
    selectedIssues.value.push(issueKey)
  } else {
    selectedIssues.value.splice(index, 1)
  }
}

const addLabelToIssues = async () => {
  if (!newLabel.value.trim() || selectedIssues.value.length === 0) {
    error.value = 'Please enter a label and select at least one issue'
    return
  }
  
  isAdding.value = true
  error.value = null
  
  try {
    // Add label to each selected issue
    await Promise.all(
      selectedIssues.value.map(issueKey =>
        axios.post(`/api/issues/${issueKey}/labels`, {
          label: newLabel.value.trim()
        })
      )
    )
    
    closeModal()
    emit('refresh')
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to add labels'
  } finally {
    isAdding.value = false
  }
}

const getLabelColor = (index: number) => {
  const colors = [
    'bg-purple-100 text-purple-800',
    'bg-blue-100 text-blue-800',
    'bg-green-100 text-green-800',
    'bg-yellow-100 text-yellow-800',
    'bg-pink-100 text-pink-800',
    'bg-indigo-100 text-indigo-800'
  ]
  return colors[index % colors.length]
}
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <div class="px-4 py-3 bg-gray-50 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-gray-900">Labels</h3>
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-500">{{ totalLabels }} labels</span>
          <button
            @click="openAddModal"
            class="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
          >
            <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Add
          </button>
        </div>
      </div>
    </div>
    
    <div class="p-4 max-h-64 overflow-y-auto">
      <div class="flex flex-wrap gap-2">
        <span 
          v-for="(label, index) in labelSummaries" 
          :key="label.name"
          :class="[
            'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
            getLabelColor(index)
          ]"
          :title="`${label.count} issue(s)`"
        >
          {{ label.name }}
          <span class="ml-1.5 bg-white/50 rounded-full px-1.5 text-xs">
            {{ label.count }}
          </span>
        </span>
      </div>
      
      <!-- Unlabeled Issues Warning -->
      <div v-if="issuesWithoutLabels.length > 0" class="mt-4 pt-4 border-t border-gray-100">
        <p class="text-xs text-gray-500">
          <span class="font-medium text-amber-600">{{ issuesWithoutLabels.length }}</span> 
          issue{{ issuesWithoutLabels.length !== 1 ? 's' : '' }} without labels
        </p>
      </div>
      
      <!-- Empty State -->
      <div v-if="labelSummaries.length === 0" class="text-center py-4 text-gray-500">
        <svg class="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        <p class="text-sm">No labels in this sprint</p>
      </div>
    </div>
  </div>
  
  <!-- Add Label Modal -->
  <Teleport to="body">
    <div 
      v-if="showAddModal" 
      class="fixed inset-0 z-50 overflow-y-auto"
    >
      <div class="flex min-h-full items-center justify-center p-4">
        <!-- Backdrop -->
        <div 
          class="fixed inset-0 bg-black/50 transition-opacity"
          @click="closeModal"
        ></div>
        
        <!-- Modal -->
        <div class="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Add Label to Issues</h3>
          
          <!-- Label Input -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Label Name
            </label>
            <input
              v-model="newLabel"
              type="text"
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Enter label name..."
            />
          </div>
          
          <!-- Issue Selection -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Select Issues ({{ selectedIssues.length }} selected)
            </label>
            <div class="max-h-48 overflow-y-auto border border-gray-200 rounded-md">
              <label 
                v-for="issue in issues" 
                :key="issue.key"
                class="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
              >
                <input
                  type="checkbox"
                  :checked="selectedIssues.includes(issue.key)"
                  @change="toggleIssue(issue.key)"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span class="ml-2 text-sm text-blue-600 font-medium">{{ issue.key }}</span>
                <span class="ml-2 text-sm text-gray-600 truncate">{{ issue.summary }}</span>
              </label>
            </div>
          </div>
          
          <!-- Error Message -->
          <div v-if="error" class="mb-4 text-sm text-red-600">
            {{ error }}
          </div>
          
          <!-- Actions -->
          <div class="flex justify-end gap-3">
            <button
              @click="closeModal"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              @click="addLabelToIssues"
              :disabled="isAdding"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {{ isAdding ? 'Adding...' : 'Add Label' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
