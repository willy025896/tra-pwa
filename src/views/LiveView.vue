<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useStationsStore } from '@/stores/stations'
import StationInput from '@/components/StationInput.vue'
import { tdx, TRAIN_STATION_STATUS_NAME, DIRECTION_NAME } from '@/lib/tdx'
import type { Station, LiveTrain, StationTimetableEntry } from '@/lib/tdx'

const stationsStore = useStationsStore()
const station = ref<Station | null>(null)
const trains = ref<LiveTrain[]>([])
const scheduleMap = ref<Map<string, StationTimetableEntry>>(new Map())
const loading = ref(false)
const error = ref('')
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => stationsStore.load())
onUnmounted(() => { if (timer) clearInterval(timer) })

async function loadLive(stationId: string) {
  const [live, schedule] = await Promise.all([
    tdx.getLiveTrains(stationId),
    tdx.getStationTimetable(stationId).catch(err => {
      console.warn('[LiveView] getStationTimetable failed:', err)
      return [] as StationTimetableEntry[]
    })
  ])
  trains.value = live
  scheduleMap.value = new Map(schedule.map(e => [e.TrainNo, e]))
}

async function search() {
  if (!station.value) return
  loading.value = true
  error.value = ''
  try {
    await loadLive(station.value.StationID)
  } catch {
    error.value = '查詢失敗，請稍後再試'
  } finally {
    loading.value = false
  }
  if (timer) clearInterval(timer)
  timer = setInterval(async () => {
    if (station.value) {
      try { await loadLive(station.value.StationID) } catch { /* keep last data */ }
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

function statusLabel(s: number | undefined) {
  if (s === undefined) return ''
  return TRAIN_STATION_STATUS_NAME[s] ?? ''
}

function statusClass(s: number | undefined) {
  if (s === 0) return 'approaching'
  if (s === 1) return 'at-station'
  if (s === 4) return 'passing'
  return 'departed'
}

function scheduleOf(trainNo: string) {
  return scheduleMap.value.get(trainNo)
}

function directionLabel(d: number | undefined) {
  if (d === undefined) return ''
  return DIRECTION_NAME[d] ?? ''
}

function trimSec(t: string | undefined) {
  if (!t) return ''
  return t.length >= 5 ? t.slice(0, 5) : t
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
            <div class="row-top">
              <span class="train-type">{{ t.TrainTypeName.Zh_tw }}</span>
              <span
                v-if="directionLabel(scheduleOf(t.TrainNo)?.Direction)"
                :class="['dir-chip', scheduleOf(t.TrainNo)?.Direction === 1 ? 'up' : 'down']"
              >
                {{ directionLabel(scheduleOf(t.TrainNo)?.Direction) }}
              </span>
              <span class="train-no">{{ t.TrainNo }}</span>
            </div>
            <div v-if="scheduleOf(t.TrainNo)" class="row-meta">
              <span v-if="scheduleOf(t.TrainNo)?.DestinationStationName">
                往 {{ scheduleOf(t.TrainNo)!.DestinationStationName!.Zh_tw }}
              </span>
              <span class="sched-time">
                預計 {{ trimSec(scheduleOf(t.TrainNo)?.ArrivalTime) || trimSec(scheduleOf(t.TrainNo)?.DepartureTime) }}
              </span>
            </div>
          </div>
          <div class="right">
            <span
              v-if="statusLabel(t.TrainStationStatus)"
              :class="['status-chip', statusClass(t.TrainStationStatus)]"
            >
              {{ statusLabel(t.TrainStationStatus) }}
            </span>
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
.train-card { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: var(--surface); border: 1.5px solid var(--border); border-radius: 12px; padding: 12px 16px; }
.left { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
.row-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.train-type { font-size: 0.75rem; color: var(--text-dim); }
.train-no { font-size: 1rem; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
.dir-chip { font-size: 0.7rem; font-weight: 700; padding: 2px 7px; border-radius: 6px; }
.dir-chip.down { background: #22c55e22; color: #22c55e; }
.dir-chip.up { background: #ef444422; color: #ef4444; }
.row-meta { display: flex; gap: 10px; font-size: 0.74rem; color: var(--text-dim); flex-wrap: wrap; }
.sched-time { font-variant-numeric: tabular-nums; }
.right { display: flex; align-items: center; gap: 6px; }
.status-chip { padding: 3px 8px; border-radius: 8px; font-size: 0.72rem; font-weight: 700; }
.status-chip.approaching { background: #38bdf822; color: #38bdf8; }
.status-chip.at-station { background: #a78bfa22; color: #a78bfa; }
.status-chip.departed { background: #64748b22; color: #94a3b8; }
.status-chip.passing { background: #fb718533; color: #fb7185; }
.delay-badge { padding: 4px 10px; border-radius: 20px; font-size: 0.82rem; font-weight: 700; }
.on-time { background: #22c55e22; color: #22c55e; }
.slight { background: #f59e0b22; color: #f59e0b; }
.late { background: #ef444422; color: #ef4444; }
.skeleton-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: 12px; height: 60px; animation: pulse 1.5s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
</style>
