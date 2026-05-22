import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: () => import('@/views/HomeView.vue') },
    { path: '/timetable', component: () => import('@/views/TimetableView.vue') },
    { path: '/live', component: () => import('@/views/LiveView.vue') },
    { path: '/fare', component: () => import('@/views/FareView.vue') }
  ]
})

export default router
