<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import BottomNav from '@/components/BottomNav.vue'

const authStore = useAuthStore()
onMounted(() => authStore.init())
</script>

<template>
  <RouterView />
  <BottomNav />
</template>
