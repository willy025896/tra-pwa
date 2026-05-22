<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useFavoritesStore } from '@/stores/favorites'
import { useAuthStore } from '@/stores/auth'
import { useStationsStore } from '@/stores/stations'
import StationInput from '@/components/StationInput.vue'
import type { Station } from '@/lib/tdx'
import type { FavoriteRoute } from '@/types'
import dayjs from 'dayjs'

const router = useRouter()
const favStore = useFavoritesStore()
const authStore = useAuthStore()
const stationsStore = useStationsStore()

const fromStation = ref<Station | null>(null)
const toStation = ref<Station | null>(null)
const addingNew = ref(false)
const newLabel = ref('')

onMounted(async () => {
  await stationsStore.load()
  await favStore.load()
})

function goSearch(route: FavoriteRoute) {
  router.push({
    path: '/timetable',
    query: {
      fromId: route.fromId,
      fromName: route.fromName,
      toId: route.toId,
      toName: route.toName,
      date: dayjs().format('YYYY-MM-DD')
    }
  })
}

async function addFavorite() {
  if (!fromStation.value || !toStation.value) return
  await favStore.add({
    fromId: fromStation.value.StationID,
    fromName: fromStation.value.StationName.Zh_tw,
    toId: toStation.value.StationID,
    toName: toStation.value.StationName.Zh_tw,
    label: newLabel.value || undefined
  })
  fromStation.value = null
  toStation.value = null
  newLabel.value = ''
  addingNew.value = false
}

function swap() {
  const tmp = fromStation.value
  fromStation.value = toStation.value
  toStation.value = tmp
}
</script>

<template>
  <div class="home">
    <header class="header">
      <div class="header-inner">
        <div class="logo">
          <span class="logo-icon">🚂</span>
          <span class="logo-text">台鐵快查</span>
        </div>
        <button v-if="!authStore.isLoggedIn" class="login-btn" @click="authStore.loginWithGoogle">
          Google 登入
        </button>
        <div v-else class="user-chip">
          <img v-if="authStore.user?.avatarUrl" :src="authStore.user.avatarUrl" class="avatar" />
          <span>{{ authStore.user?.name?.split(' ')[0] }}</span>
          <button class="logout-btn" @click="authStore.logout">登出</button>
        </div>
      </div>
    </header>

    <main class="content">
      <section class="favorites-section">
        <div class="section-header">
          <h2>常用路線</h2>
          <button class="add-btn" @click="addingNew = !addingNew">
            {{ addingNew ? '取消' : '＋ 新增' }}
          </button>
        </div>

        <div v-if="addingNew" class="add-form">
          <StationInput v-model="fromStation" placeholder="出發站" />
          <button class="swap-btn" @click="swap">⇅</button>
          <StationInput v-model="toStation" placeholder="到達站" />
          <input v-model="newLabel" class="label-input" placeholder="備註名稱（選填）" />
          <button class="confirm-btn" :disabled="!fromStation || !toStation" @click="addFavorite">
            儲存常用路線
          </button>
        </div>

        <div v-if="favStore.routes.length === 0 && !addingNew" class="empty-state">
          <span class="empty-icon">🛤️</span>
          <p>還沒有常用路線</p>
          <p class="sub">點右上角「＋ 新增」加入</p>
        </div>

        <div class="route-list">
          <div
            v-for="route in favStore.routes"
            :key="route.id"
            class="route-card"
            @click="goSearch(route)"
          >
            <div class="route-info">
              <span v-if="route.label" class="route-label">{{ route.label }}</span>
              <div class="route-stations">
                <span class="station-name">{{ route.fromName }}</span>
                <span class="arrow">→</span>
                <span class="station-name">{{ route.toName }}</span>
              </div>
            </div>
            <div class="route-actions">
              <button class="query-btn">查詢</button>
              <button class="delete-btn" @click.stop="favStore.remove(route.id)">✕</button>
            </div>
          </div>
        </div>
      </section>

      <div class="quick-nav">
        <router-link to="/timetable" class="quick-card">
          <span class="quick-icon">🕐</span>
          <span>時刻查詢</span>
        </router-link>
        <router-link to="/live" class="quick-card">
          <span class="quick-icon">📡</span>
          <span>即時動態</span>
        </router-link>
        <router-link to="/fare" class="quick-card">
          <span class="quick-icon">💰</span>
          <span>票價查詢</span>
        </router-link>
      </div>
    </main>
  </div>
</template>

<style scoped>
.home { min-height: 100dvh; padding-bottom: 80px; }
.header { position: sticky; top: 0; background: var(--bg); border-bottom: 1.5px solid var(--border); z-index: 40; padding: 0 16px; }
.header-inner { max-width: 480px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; height: 56px; }
.logo { display: flex; align-items: center; gap: 8px; }
.logo-icon { font-size: 1.4rem; }
.logo-text { font-size: 1.15rem; font-weight: 800; color: var(--text); letter-spacing: -0.02em; }
.login-btn { background: var(--accent); color: #000; border: none; border-radius: 20px; padding: 6px 14px; font-size: 0.85rem; font-weight: 700; cursor: pointer; font-family: inherit; }
.user-chip { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--text); }
.avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
.logout-btn { background: none; border: 1px solid var(--border); color: var(--text-dim); border-radius: 10px; padding: 2px 8px; font-size: 0.75rem; cursor: pointer; font-family: inherit; }
.content { max-width: 480px; margin: 0 auto; padding: 20px 16px; display: flex; flex-direction: column; gap: 24px; }
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
h2 { font-size: 1.1rem; font-weight: 800; color: var(--text); letter-spacing: -0.02em; }
.add-btn { background: var(--surface); border: 1.5px solid var(--border); color: var(--accent); border-radius: 20px; padding: 5px 12px; font-size: 0.82rem; font-weight: 700; cursor: pointer; font-family: inherit; }
.add-form { display: flex; flex-direction: column; gap: 10px; background: var(--surface); border: 1.5px solid var(--border); border-radius: 16px; padding: 16px; margin-bottom: 14px; }
.swap-btn { align-self: center; background: var(--surface-hover); border: none; border-radius: 50%; width: 36px; height: 36px; font-size: 1.1rem; cursor: pointer; color: var(--text); }
.label-input { background: var(--surface); border: 2px solid var(--border); border-radius: 12px; padding: 12px; font-size: 0.95rem; color: var(--text); font-family: inherit; outline: none; }
.label-input::placeholder { color: var(--text-dim); }
.label-input:focus { border-color: var(--accent); }
.confirm-btn { background: var(--accent); color: #000; border: none; border-radius: 12px; padding: 12px; font-size: 0.95rem; font-weight: 700; cursor: pointer; font-family: inherit; }
.confirm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.empty-state { text-align: center; padding: 40px 20px; color: var(--text-dim); }
.empty-icon { font-size: 2.5rem; display: block; margin-bottom: 10px; }
.sub { font-size: 0.85rem; margin-top: 4px; }
.route-list { display: flex; flex-direction: column; gap: 10px; }
.route-card { display: flex; align-items: center; justify-content: space-between; background: var(--surface); border: 1.5px solid var(--border); border-radius: 14px; padding: 14px 16px; cursor: pointer; transition: border-color 0.2s, transform 0.15s; }
.route-card:hover { border-color: var(--accent); transform: translateY(-1px); }
.route-info { display: flex; flex-direction: column; gap: 4px; }
.route-label { font-size: 0.75rem; color: var(--accent); font-weight: 700; }
.route-stations { display: flex; align-items: center; gap: 8px; }
.station-name { font-size: 1rem; font-weight: 700; color: var(--text); }
.arrow { color: var(--text-dim); }
.route-actions { display: flex; align-items: center; gap: 8px; }
.query-btn { background: var(--accent); color: #000; border: none; border-radius: 8px; padding: 6px 12px; font-size: 0.82rem; font-weight: 700; cursor: pointer; font-family: inherit; }
.delete-btn { background: none; border: 1px solid var(--border); color: var(--text-dim); border-radius: 8px; width: 30px; height: 30px; cursor: pointer; font-size: 0.75rem; }
.quick-nav { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.quick-card { display: flex; flex-direction: column; align-items: center; gap: 8px; background: var(--surface); border: 1.5px solid var(--border); border-radius: 14px; padding: 18px 10px; text-decoration: none; color: var(--text); font-size: 0.85rem; font-weight: 600; transition: border-color 0.2s, transform 0.15s; }
.quick-card:hover { border-color: var(--accent); transform: translateY(-2px); }
.quick-icon { font-size: 1.6rem; }
</style>
