<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useStationsStore } from '@/stores/stations'
import Icon from '@/components/Icon.vue'
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
      <Icon name="map-pin" :size="16" class="leading" />
      <span class="label" :class="{ placeholder: !modelValue }">
        {{ modelValue ? modelValue.StationName.Zh_tw : (placeholder ?? '選擇車站') }}
      </span>
      <button v-if="modelValue" type="button" class="clear-btn" @click="clear" aria-label="清除">
        <Icon name="x" :size="14" />
      </button>
      <Icon name="chevron-down" :size="16" class="caret" :class="{ open }" />
    </div>

    <div v-if="open" class="dropdown">
      <div class="search-bar">
        <Icon name="search" :size="16" class="search-icon" />
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
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: border-color 0.15s;
  user-select: none;
}
.trigger:hover { border-color: var(--border-strong); }
.trigger.active { border-color: var(--text); }
.leading { color: var(--text-muted); }
.label {
  flex: 1;
  font-size: 0.95rem;
  color: var(--text);
  font-weight: 500;
}
.label.placeholder {
  color: var(--text-muted);
  font-weight: 400;
}
.clear-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: inline-flex; align-items: center; justify-content: center;
}
.clear-btn:hover { background: var(--surface-hover); color: var(--text); }
.caret {
  color: var(--text-muted);
  transition: transform 0.2s;
}
.caret.open { transform: rotate(180deg); }

.dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  z-index: 100;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
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
}
.search-icon { color: var(--text-muted); }
.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.92rem;
  color: var(--text);
  outline: none;
  font-family: inherit;
  padding: 2px 0;
}
.search-input::placeholder { color: var(--text-muted); }

.list {
  list-style: none;
  margin: 0;
  padding: 4px;
  overflow-y: auto;
  flex: 1;
}
.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s;
}
.item:hover { background: var(--surface-hover); }
.item.selected { background: var(--surface-hover); }
.item.selected .zh { color: var(--text); }
.zh {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text);
}
.en {
  font-size: 0.75rem;
  color: var(--text-muted);
}
.empty-row {
  padding: 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.88rem;
}
</style>
