<script setup lang="ts">
import { computed } from 'vue'
import { useThemeStore, type ThemeMode } from '@/stores/theme'
import Icon, { type IconName } from '@/components/Icon.vue'

const themeStore = useThemeStore()

const THEME_META: Record<ThemeMode, { icon: IconName; nextLabel: string }> = {
  light:  { icon: 'sun',     nextLabel: '切換為深色模式' },
  dark:   { icon: 'moon',    nextLabel: '切換為跟隨系統' },
  system: { icon: 'monitor', nextLabel: '切換為亮色模式' }
}

const meta = computed(() => THEME_META[themeStore.mode])
</script>

<template>
  <button class="toggle" @click="themeStore.toggle()" :title="meta.nextLabel" :aria-label="meta.nextLabel">
    <Icon :name="meta.icon" :size="18" />
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
