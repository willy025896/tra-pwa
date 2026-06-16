<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useFavoritesStore } from '@/stores/favorites'
import { useAuthStore } from '@/stores/auth'
import { useStationsStore } from '@/stores/stations'
import { useUptimeStore } from '@/stores/uptime'
import StationInput from '@/components/StationInput.vue'
import Icon from '@/components/Icon.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import type { Station } from '@/lib/tdx'
import type { FavoriteRoute } from '@/types'
import dayjs from 'dayjs'

const router = useRouter()
const favStore = useFavoritesStore()
const authStore = useAuthStore()
const stationsStore = useStationsStore()
const uptimeStore = useUptimeStore()

const fromStation = ref<Station | null>(null)
const toStation = ref<Station | null>(null)
const addingNew = ref(false)
const newLabel = ref('')

onMounted(async () => {
  await stationsStore.load()
  await favStore.load()
  uptimeStore.load() // 不 await，footer 晚一點出現也無妨
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
          <Icon name="train" :size="20" />
          <span class="logo-text">台鐵快查</span>
        </div>
        <div class="header-actions">
          <ThemeToggle />
          <button v-if="!authStore.isLoggedIn" class="login-btn" @click="authStore.loginWithGoogle">
            Google 登入
          </button>
          <div v-else class="user-chip">
            <img v-if="authStore.user?.avatarUrl" :src="authStore.user.avatarUrl" class="avatar" />
            <span>{{ authStore.user?.name?.split(' ')[0] }}</span>
            <button class="logout-btn" @click="authStore.logout">登出</button>
          </div>
        </div>
      </div>
    </header>

    <main class="content">
      <section class="favorites-section">
        <div class="section-header">
          <h2>常用路線</h2>
          <button class="add-btn" @click="addingNew = !addingNew">
            <Icon :name="addingNew ? 'x' : 'plus'" :size="14" />
            {{ addingNew ? '取消' : '新增' }}
          </button>
        </div>

        <div v-if="addingNew" class="add-form">
          <StationInput v-model="fromStation" placeholder="出發站" />
          <button class="swap-btn" @click="swap" aria-label="對調">
            <Icon name="swap" :size="18" />
          </button>
          <StationInput v-model="toStation" placeholder="到達站" />
          <input v-model="newLabel" class="label-input" placeholder="備註名稱（選填）" />
          <button class="confirm-btn" :disabled="!fromStation || !toStation" @click="addFavorite">
            儲存常用路線
          </button>
        </div>

        <div v-if="favStore.routes.length === 0 && !addingNew" class="empty-state">
          <Icon name="route" :size="32" />
          <p>還沒有常用路線</p>
          <p class="sub">點右上角「新增」加入</p>
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
                <Icon name="arrow-right" :size="16" class="arrow" />
                <span class="station-name">{{ route.toName }}</span>
              </div>
            </div>
            <div class="route-actions">
              <button
                class="delete-btn"
                aria-label="刪除"
                @click.stop="favStore.remove(route.id)"
              >
                <Icon name="trash" :size="16" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <div class="quick-nav">
        <router-link to="/timetable" class="quick-card">
          <Icon name="clock" :size="22" />
          <span>時刻查詢</span>
        </router-link>
        <router-link to="/live" class="quick-card">
          <Icon name="activity" :size="22" />
          <span>即時動態</span>
        </router-link>
        <router-link to="/fare" class="quick-card">
          <Icon name="wallet" :size="22" />
          <span>票價查詢</span>
        </router-link>
      </div>
    </main>

    <footer class="site-footer">
      <span class="logo-text-footer">台鐵快查</span>
      <span v-if="uptimeStore.days !== null" class="uptime">
        服務已上線 {{ uptimeStore.days }} 天
      </span>
    </footer>
  </div>
</template>

<style scoped>
.home { min-height: 100dvh; padding-bottom: 80px; }
.header {
  position: sticky; top: 0;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  z-index: 40;
  padding: 0 16px;
}
.header-inner {
  max-width: 480px; margin: 0 auto;
  display: flex; align-items: center; justify-content: space-between;
  height: 56px;
}
.logo { display: flex; align-items: center; gap: 8px; color: var(--text); }
.logo-text { font-size: 1rem; font-weight: 600; letter-spacing: -0.01em; }
.header-actions { display: flex; align-items: center; gap: 8px; }
.login-btn {
  background: var(--text); color: var(--bg);
  border: none; border-radius: 8px;
  padding: 7px 14px;
  font-size: 0.82rem; font-weight: 500;
  cursor: pointer;
}
.login-btn:hover { opacity: 0.9; }
.user-chip { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text); }
.avatar { width: 26px; height: 26px; border-radius: 50%; object-fit: cover; }
.logout-btn {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-dim);
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 0.75rem;
  cursor: pointer;
}
.logout-btn:hover { border-color: var(--border-strong); color: var(--text); }

.content { max-width: 480px; margin: 0 auto; padding: 20px 16px; display: flex; flex-direction: column; gap: 28px; }
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
h2 { font-size: 0.95rem; font-weight: 600; color: var(--text); letter-spacing: -0.01em; }

.add-btn {
  display: inline-flex; align-items: center; gap: 4px;
  background: none;
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 0.8rem; font-weight: 500;
  cursor: pointer;
}
.add-btn:hover { border-color: var(--border-strong); background: var(--surface-hover); }

.add-form {
  display: flex; flex-direction: column; gap: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 12px;
}
.swap-btn {
  align-self: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 50%;
  width: 34px; height: 34px;
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer;
  color: var(--text-dim);
}
.swap-btn:hover { color: var(--text); border-color: var(--border-strong); }

.label-input {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 0.92rem;
  color: var(--text);
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}
.label-input::placeholder { color: var(--text-muted); }
.label-input:focus { border-color: var(--text); }

.confirm-btn {
  background: var(--text); color: var(--bg);
  border: none; border-radius: 8px;
  padding: 11px;
  font-size: 0.92rem; font-weight: 500;
  cursor: pointer;
}
.confirm-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.confirm-btn:not(:disabled):hover { opacity: 0.9; }

.empty-state {
  text-align: center; padding: 40px 20px;
  color: var(--text-muted);
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.empty-state p { font-size: 0.9rem; }
.sub { font-size: 0.8rem; color: var(--text-muted); }

.route-list { display: flex; flex-direction: column; gap: 8px; }
.route-card {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 16px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.route-card:hover { border-color: var(--border-strong); background: var(--surface-soft); }
.route-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.route-label {
  font-size: 0.7rem; color: var(--text-dim);
  font-weight: 500; letter-spacing: 0.02em;
  text-transform: uppercase;
}
.route-stations { display: flex; align-items: center; gap: 8px; }
.station-name { font-size: 0.95rem; font-weight: 600; color: var(--text); }
.arrow { color: var(--text-muted); }

.route-actions { display: flex; align-items: center; gap: 4px; }
.delete-btn {
  background: none; border: none;
  color: var(--text-muted);
  width: 32px; height: 32px;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.delete-btn:hover { background: var(--danger-soft); color: var(--danger); }

.quick-nav { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.quick-card {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 18px 10px;
  text-decoration: none;
  color: var(--text);
  font-size: 0.82rem; font-weight: 500;
  transition: border-color 0.15s, background 0.15s;
}
.quick-card:hover { border-color: var(--border-strong); background: var(--surface-soft); }

.site-footer {
  max-width: 480px; margin: 0 auto;
  padding: 24px 16px 12px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  text-align: center;
}
.logo-text-footer { font-size: 0.8rem; font-weight: 600; color: var(--text-dim); letter-spacing: -0.01em; }
.uptime { font-size: 0.72rem; color: var(--text-muted); }
</style>
