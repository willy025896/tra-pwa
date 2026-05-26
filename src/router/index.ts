import { createRouter, createWebHistory } from 'vue-router'

const APP_NAME = '台鐵時刻'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: () => import('@/views/HomeView.vue'), meta: { title: '常用' } },
    { path: '/timetable', component: () => import('@/views/TimetableView.vue'), meta: { title: '時刻' } },
    { path: '/live', component: () => import('@/views/LiveView.vue'), meta: { title: '動態' } },
    { path: '/fare', component: () => import('@/views/FareView.vue'), meta: { title: '票價' } }
  ]
})

router.afterEach((to) => {
  const pageTitle = to.meta.title as string | undefined
  document.title = pageTitle ? `${pageTitle} · ${APP_NAME}` : APP_NAME
})

export default router
