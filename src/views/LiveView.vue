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
.page-header { padding: 18px 16px 0; max-width: 480px; margin: 0 auto; }
h1 { font-size: 1.15rem; font-weight: 600; color: var(--text); letter-spacing: -0.01em; margin: 0 0 16px; }
.content { max-width: 480px; margin: 0 auto; padding: 0 16px 20px; display: flex; flex-direction: column; gap: 16px; }
.search-form {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
  display: flex; flex-direction: column; gap: 10px;
}
.search-btn {
  background: var(--text); color: var(--bg);
  border: none; border-radius: 8px;
  padding: 12px;
  font-size: 0.95rem; font-weight: 500;
  cursor: pointer;
}
.search-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.search-btn:not(:disabled):hover { opacity: 0.9; }
.refresh-hint { text-align: center; font-size: 0.76rem; color: var(--text-muted); margin: 0; }

.error-msg {
  background: var(--danger-soft);
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 10px 14px;
  color: var(--danger);
  font-size: 0.88rem;
}

.train-list { display: flex; flex-direction: column; gap: 6px; }
.train-card {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  transition: border-color 0.15s;
}
.train-card:hover { border-color: var(--border-strong); }

.left { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
.row-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.train-type { font-size: 0.75rem; color: var(--text-dim); }
.train-no {
  font-size: 0.95rem; font-weight: 600; color: var(--text);
  font-variant-numeric: tabular-nums;
}
.dir-chip {
  font-size: 0.68rem; font-weight: 500;
  padding: 2px 7px; border-radius: 4px;
  border: 1px solid;
}
.dir-chip.down { color: var(--success); border-color: #bbf7d0; background: var(--success-soft); }
.dir-chip.up { color: var(--danger); border-color: #fecaca; background: var(--danger-soft); }
.row-meta {
  display: flex; gap: 10px;
  font-size: 0.74rem; color: var(--text-muted);
  flex-wrap: wrap;
}
.sched-time { font-variant-numeric: tabular-nums; }

.right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.status-chip {
  padding: 2px 8px; border-radius: 4px;
  font-size: 0.7rem; font-weight: 500;
  border: 1px solid;
}
.status-chip.approaching { color: var(--info); border-color: var(--info-soft); background: var(--info-soft); }
.status-chip.at-station { color: var(--purple); border-color: var(--purple-soft); background: var(--purple-soft); }
.status-chip.departed { color: var(--text-dim); border-color: var(--border); background: var(--surface-soft); }
.status-chip.passing { color: var(--pink); border-color: var(--pink-soft); background: var(--pink-soft); }

.delay-badge {
  padding: 3px 10px; border-radius: 999px;
  font-size: 0.76rem; font-weight: 500;
  border: 1px solid;
}
.on-time { color: var(--success); border-color: #bbf7d0; background: var(--success-soft); }
.slight { color: var(--warning); border-color: #fed7aa; background: var(--warning-soft); }
.late { color: var(--danger); border-color: #fecaca; background: var(--danger-soft); }

.skeleton-card {
  background: var(--surface-soft);
  border: 1px solid var(--border);
  border-radius: 8px;
  height: 60px;
  animation: pulse 1.5s infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
</style>
