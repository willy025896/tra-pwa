<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useStationsStore } from '@/stores/stations'
import type { Station } from '@/lib/tdx'

const props = defineProps<{ modelValue: Station | null; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [Station | null] }>()

const store = useStationsStore()
const open = ref(false)
const query = ref('')
const root = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)

const VARIANT_MAP: Record<string, string> = { 臺: '台' }
function normalize(s: string) {
  return s.toLowerCase().replace(/[臺]/g, (c) => VARIANT_MAP[c] ?? c)
}

const filtered = computed(() => {
  const q = normalize(query.value.trim())
  if (!q) return store.stations
  return store.stations.filter(
    (s) =>
      normalize(s.StationName.Zh_tw).includes(q) ||
      s.StationName.En.toLowerCase().includes(q) ||
      s.StationID.includes(q),
  )
})

function toggle() {
  open.value = !open.value
  if (open.value) {
    query.value = ''
    nextTick(() => searchInput.value?.focus())
  }
}

function select(s: Station) {
  emit('update:modelValue', s)
  open.value = false
}

function clear(e: Event) {
  e.stopPropagation()
  emit('update:modelValue', null)
}

function onDocPointer(e: MouseEvent) {
  if (!root.value) return
  if (!root.value.contains(e.target as Node)) open.value = false
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('mousedown', onDocPointer)
  document.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocPointer)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="station-input" ref="root">
    <div
      class="trigger"
      :class="{ active: open }"
      role="button"
      tabindex="0"
      @click="toggle"
      @keydown.enter.prevent="toggle"
      @keydown.space.prevent="toggle"
    >
      <span class="icon">🚉</span>
      <span class="label" :class="{ placeholder: !modelValue }">
        {{ modelValue ? modelValue.StationName.Zh_tw : (placeholder ?? '選擇車站') }}
      </span>
      <button v-if="modelValue" type="button" class="clear-btn" @click="clear" aria-label="清除">✕</button>
      <span class="caret" :class="{ open }">▾</span>
    </div>

    <div v-if="open" class="dropdown">
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input
          ref="searchInput"
          v-model="query"
          class="search-input"
          placeholder="搜尋車站名稱或代碼"
          autocomplete="off"
        />
      </div>
      <ul class="list">
        <li v-if="filtered.length === 0" class="empty-row">無符合車站</li>
        <li
          v-for="s in filtered"
          :key="s.StationID"
          class="item"
          :class="{ selected: modelValue?.StationID === s.StationID }"
          @click="select(s)"
        >
          <span class="zh">{{ s.StationName.Zh_tw }}</span>
          <span class="en">{{ s.StationName.En }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.station-input {
  position: relative;
}
.trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  transition: border-color 0.2s;
  user-select: none;
}
.trigger:hover,
.trigger.active {
  border-color: var(--accent);
}
.icon {
  font-size: 1.1rem;
}
.label {
  flex: 1;
  font-size: 1rem;
  color: var(--text);
  font-weight: 600;
}
.label.placeholder {
  color: var(--text-dim);
  font-weight: 400;
}
.clear-btn {
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 4px 6px;
  border-radius: 6px;
}
.clear-btn:hover {
  background: var(--surface-hover);
  color: var(--text);
}
.caret {
  color: var(--text-dim);
  font-size: 0.8rem;
  transition: transform 0.2s;
}
.caret.open {
  transform: rotate(180deg);
}

.dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--surface-elevated);
  border: 1.5px solid var(--border);
  border-radius: 12px;
  z-index: 100;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 320px;
}
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.search-icon {
  font-size: 0.9rem;
  color: var(--text-dim);
}
.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.95rem;
  color: var(--text);
  outline: none;
  font-family: inherit;
  padding: 4px 0;
}
.search-input::placeholder {
  color: var(--text-dim);
}
.list {
  list-style: none;
  margin: 0;
  padding: 6px;
  overflow-y: auto;
  flex: 1;
}
.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.item:hover {
  background: var(--surface-hover);
}
.item.selected {
  background: var(--surface-hover);
}
.item.selected .zh {
  color: var(--accent);
}
.zh {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
}
.en {
  font-size: 0.75rem;
  color: var(--text-dim);
}
.empty-row {
  padding: 16px;
  text-align: center;
  color: var(--text-dim);
  font-size: 0.9rem;
}
</style>
