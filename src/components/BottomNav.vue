<script setup lang="ts">
import { useRoute } from 'vue-router'
const route = useRoute()

const tabs = [
  { path: '/', icon: '⭐', label: '常用' },
  { path: '/timetable', icon: '🕐', label: '時刻' },
  { path: '/live', icon: '📡', label: '動態' },
  { path: '/fare', icon: '💰', label: '票價' }
]
</script>

<template>
  <nav class="bottom-nav">
    <router-link
      v-for="tab in tabs"
      :key="tab.path"
      :to="tab.path"
      class="tab"
      :class="{ active: route.path === tab.path }"
    >
      <span class="tab-icon">{{ tab.icon }}</span>
      <span class="tab-label">{{ tab.label }}</span>
    </router-link>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  display: flex;
  background: var(--surface-elevated);
  border-top: 1.5px solid var(--border);
  padding: 8px 0 max(8px, env(safe-area-inset-bottom));
  z-index: 50;
}
.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  text-decoration: none;
  color: var(--text-dim);
  transition: color 0.2s;
  padding: 4px 0;
}
.tab.active { color: var(--accent); }
.tab-icon { font-size: 1.4rem; }
.tab-label { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.03em; }
</style>
