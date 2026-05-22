<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useStationsStore } from '@/stores/stations'
import StationInput from '@/components/StationInput.vue'
import { tdx } from '@/lib/tdx'
import type { Station, LiveTrain } from '@/lib/tdx'

const stationsStore = useStationsStore()
const station = ref<Station | null>(null)
const trains = ref<LiveTrain[]>([])
const loading = ref(false)
const error = ref('')
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => stationsStore.load())
onUnmounted(() => { if (timer) clearInterval(timer) })

async function search() {
  if (!station.value) return
  loading.value = true
  error.value = ''
  try {
    trains.value = await tdx.getLiveTrains(station.value.StationID)
  } catch {
    error.value = '查詢失敗，請稍後再試'
  } finally {
    loading.value = false
  }
  if (timer) clearInterval(timer)
  timer = setInterval(async () => {
    if (station.value) {
      trains.value = await tdx.getLiveTrains(station.value.StationID)
    }
  }, 30000)
}

function delayColor(min: number) {
  if (min === 0) return 'on-time'
  if (min <= 5) return 'slight'
  return 'late'
}

function delayLabel(min: number) {
  if (min === 0) return '準時'
  return `誤點 ${min} 分`
}
</script>

<template>
  <div class="page">
    <header class="page-header">
      <h1>即時動態</h1>
    </header>

    <div class="content">
      <div class="search-form">
        <StationInput v-model="station" placeholder="選擇車站" />
        <button class="search-btn" @click="search" :disabled="!station || loading">
          {{ loading ? '查詢中...' : '查詢動態' }}
        </button>
        <p v-if="trains.length > 0" class="refresh-hint">每 30 秒自動更新</p>
      </div>

      <div v-if="error" class="error-msg">{{ error }}</div>

      <div v-if="loading" class="loading-list">
        <div v-for="i in 6" :key="i" class="skeleton-card" />
      </div>

      <div v-else-if="trains.length > 0" class="train-list">
        <div v-for="t in trains" :key="t.TrainNo" class="train-card">
          <div class="left">
            <span class="train-type">{{ t.TrainTypeName.Zh_tw }}</span>
            <span class="train-no">{{ t.TrainNo }}</span>
          </div>
          <div class="right">
            <span :class="['delay-badge', delayColor(t.DelayTime)]">
              {{ delayLabel(t.DelayTime) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { min-height: 100dvh; padding-bottom: 80px; }
.page-header { padding: 16px 16px 0; max-width: 480px; margin: 0 auto; }
h1 { font-size: 1.3rem; font-weight: 800; color: var(--text); letter-spacing: -0.03em; margin: 0 0 16px; }
.content { max-width: 480px; margin: 0 auto; padding: 0 16px 20px; display: flex; flex-direction: column; gap: 16px; }
.search-form { background: var(--surface); border: 1.5px solid var(--border); border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.search-btn { background: var(--accent); color: #000; border: none; border-radius: 12px; padding: 13px; font-size: 1rem; font-weight: 700; cursor: pointer; font-family: inherit; }
.search-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.refresh-hint { text-align: center; font-size: 0.78rem; color: var(--text-dim); margin: 0; }
.error-msg { background: #ff4d6d22; border: 1.5px solid #ff4d6d55; border-radius: 12px; padding: 12px 16px; color: #ff4d6d; font-size: 0.9rem; }
.train-list { display: flex; flex-direction: column; gap: 8px; }
.train-card { display: flex; align-items: center; justify-content: space-between; background: var(--surface); border: 1.5px solid var(--border); border-radius: 12px; padding: 12px 16px; }
.left { display: flex; flex-direction: column; gap: 2px; }
.train-type { font-size: 0.75rem; color: var(--text-dim); }
.train-no { font-size: 1rem; font-weight: 700; color: var(--text); }
.delay-badge { padding: 4px 10px; border-radius: 20px; font-size: 0.82rem; font-weight: 700; }
.on-time { background: #22c55e22; color: #22c55e; }
.slight { background: #f59e0b22; color: #f59e0b; }
.late { background: #ef444422; color: #ef4444; }
.skeleton-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: 12px; height: 60px; animation: pulse 1.5s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
</style>
