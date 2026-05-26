<script setup lang="ts">
import { computed } from 'vue'
import { useThemeStore } from '@/stores/theme'
import Icon from '@/components/Icon.vue'

const themeStore = useThemeStore()

const iconName = computed(() => {
  if (themeStore.mode === 'light') return 'sun'
  if (themeStore.mode === 'dark') return 'moon'
  return 'monitor'
})

const nextLabel = computed(() => {
  if (themeStore.mode === 'light') return '切換為深色模式'
  if (themeStore.mode === 'dark') return '切換為跟隨系統'
  return '切換為亮色模式'
})
</script>

<template>
  <button class="toggle" @click="themeStore.toggle()" :title="nextLabel" :aria-label="nextLabel">
    <Icon :name="iconName" :size="18" />
  </button>
</template>

<style scoped>
.toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-dim);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.toggle:hover {
  color: var(--text);
  border-color: var(--border-strong);
  background: var(--surface-hover);
}
</style>
