<script setup lang="ts">
import { useRoute } from 'vue-router'
import Icon from '@/components/Icon.vue'

const route = useRoute()

const tabs = [
  { path: '/', icon: 'star', label: '常用' },
  { path: '/timetable', icon: 'clock', label: '時刻' },
  { path: '/live', icon: 'activity', label: '動態' },
  { path: '/fare', icon: 'wallet', label: '票價' }
] as const
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
      <Icon :name="tab.icon" :size="22" />
      <span class="tab-label">{{ tab.label }}</span>
    </router-link>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  display: flex;
  background: var(--bg);
  border-top: 1px solid var(--border);
  padding: 6px 0 max(6px, env(safe-area-inset-bottom));
  z-index: 50;
}
.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  text-decoration: none;
  color: var(--text-muted);
  transition: color 0.15s;
  padding: 6px 0;
}
.tab.active { color: var(--text); }
.tab-label { font-size: 0.7rem; font-weight: 500; letter-spacing: 0.02em; }
</style>
