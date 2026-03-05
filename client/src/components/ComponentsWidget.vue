<script setup lang="ts">
import { computed, ref } from 'vue'
import type { JiraIssue, ComponentSummary } from '../types/jira'

const props = defineProps<{
  issues: JiraIssue[]
}>()

const emit = defineEmits<{
  (e: 'filter-component', componentId: string | null): void
}>()

const selectedComponent = ref<string | null>(null)

const componentSummaries = computed((): ComponentSummary[] => {
  const componentMap = new Map<string, ComponentSummary>()
  
  for (const issue of props.issues) {
    for (const component of issue.components) {
      if (!componentMap.has(component.id)) {
        componentMap.set(component.id, {
          component: component,
          count: 0,
          issues: []
        })
      }
      
      const summary = componentMap.get(component.id)!
      summary.count++
      summary.issues.push({
        key: issue.key,
        summary: issue.summary
      })
    }
  }
  
  return Array.from(componentMap.values()).sort((a, b) => b.count - a.count)
})

const issuesWithoutComponents = computed(() => 
  props.issues.filter(i => i.components.length === 0)
)

const totalIssuesWithComponents = computed(() => 
  props.issues.filter(i => i.components.length > 0).length
)

const selectComponent = (componentId: string) => {
  if (selectedComponent.value === componentId) {
    selectedComponent.value = null
    emit('filter-component', null)
  } else {
    selectedComponent.value = componentId
    emit('filter-component', componentId)
  }
}

const getPercentage = (count: number) => {
  if (props.issues.length === 0) return 0
  return Math.round((count / props.issues.length) * 100)
}
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <div class="px-4 py-3 bg-gray-50 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-gray-900">Components</h3>
        <span class="text-sm text-gray-500">
          {{ componentSummaries.length }} component{{ componentSummaries.length !== 1 ? 's' : '' }}
        </span>
      </div>
    </div>
    
    <div class="p-4 max-h-64 overflow-y-auto">
      <div class="space-y-3">
        <button
          v-for="comp in componentSummaries" 
          :key="comp.component.id"
          @click="selectComponent(comp.component.id)"
          :class="[
            'w-full text-left p-3 rounded-lg border transition-colors',
            selectedComponent === comp.component.id 
              ? 'bg-blue-50 border-blue-200' 
              : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
          ]"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="font-medium text-gray-900">{{ comp.component.name }}</span>
            <span class="text-sm text-gray-600">{{ comp.count }} issues</span>
          </div>
          
          <!-- Progress Bar -->
          <div class="w-full bg-gray-200 rounded-full h-1.5">
            <div 
              class="bg-blue-500 h-1.5 rounded-full transition-all"
              :style="{ width: `${getPercentage(comp.count)}%` }"
            ></div>
          </div>
          <div class="text-xs text-gray-500 mt-1">
            {{ getPercentage(comp.count) }}% of sprint
          </div>
        </button>
      </div>
      
      <!-- No Component Issues -->
      <div v-if="issuesWithoutComponents.length > 0" class="mt-4 pt-4 border-t border-gray-100">
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-600">Without component</span>
          <span class="font-medium text-amber-600">
            {{ issuesWithoutComponents.length }} issue{{ issuesWithoutComponents.length !== 1 ? 's' : '' }}
          </span>
        </div>
      </div>
      
      <!-- Empty State -->
      <div v-if="componentSummaries.length === 0" class="text-center py-4 text-gray-500">
        <svg class="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p class="text-sm">No components in this sprint</p>
      </div>
    </div>
  </div>
</template>
