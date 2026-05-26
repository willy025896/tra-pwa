<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import BottomNav from '@/components/BottomNav.vue'

const authStore = useAuthStore()
const themeStore = useThemeStore()
onMounted(() => {
  themeStore.init()
  authStore.init()
})
</script>

<template>
  <RouterView />
  <BottomNav />
</template>
