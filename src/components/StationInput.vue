<script setup lang="ts">
import { ref, watch } from 'vue'
import { useStationsStore } from '@/stores/stations'
import type { Station } from '@/lib/tdx'

const props = defineProps<{ modelValue: Station | null; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [Station | null] }>()

const store = useStationsStore()
const query = ref(props.modelValue?.StationName.Zh_tw ?? '')
const results = ref<Station[]>([])
const open = ref(false)

watch(() => props.modelValue, (v) => {
  query.value = v?.StationName.Zh_tw ?? ''
})

function onInput() {
  results.value = store.search(query.value)
  open.value = results.value.length > 0
}

function select(s: Station) {
  emit('update:modelValue', s)
  query.value = s.StationName.Zh_tw
  open.value = false
}

function clear() {
  emit('update:modelValue', null)
  query.value = ''
  results.value = []
}

function onBlur() {
  globalThis.setTimeout(() => { open.value = false }, 150)
}
</script>

<template>
  <div class="station-input">
    <div class="input-wrap">
      <span class="icon">🚉</span>
      <input
        v-model="query"
        :placeholder="placeholder ?? '搜尋車站'"
        @input="onInput"
        @blur="onBlur"
        autocomplete="off"
      />
      <button v-if="query" class="clear-btn" @click="clear">✕</button>
    </div>
    <ul v-if="open" class="dropdown">
      <li v-for="s in results" :key="s.StationID" @mousedown="select(s)">
        <span class="zh">{{ s.StationName.Zh_tw }}</span>
        <span class="en">{{ s.StationName.En }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.station-input {
  position: relative;
}
.input-wrap {
  display: flex;
  align-items: center;
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 12px;
  padding: 0 12px;
  gap: 8px;
  transition: border-color 0.2s;
}
.input-wrap:focus-within {
  border-color: var(--accent);
}
.icon { font-size: 1.1rem; }
input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 12px 0;
  font-size: 1rem;
  color: var(--text);
  outline: none;
  font-family: inherit;
}
input::placeholder { color: var(--text-dim); }
.clear-btn {
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 4px;
}
.dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0; right: 0;
  background: var(--surface-elevated);
  border: 1.5px solid var(--border);
  border-radius: 12px;
  list-style: none;
  margin: 0; padding: 6px;
  z-index: 100;
  box-shadow: 0 8px 30px rgba(0,0,0,0.4);
  max-height: 260px;
  overflow-y: auto;
}
.dropdown li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.dropdown li:hover { background: var(--surface-hover); }
.zh { font-size: 1rem; font-weight: 600; color: var(--text); }
.en { font-size: 0.75rem; color: var(--text-dim); }
</style>
