<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useStationsStore } from '@/stores/stations'
import StationInput from '@/components/StationInput.vue'
import TimeInput from '@/components/TimeInput.vue'
import Icon from '@/components/Icon.vue'
import { tdx } from '@/lib/tdx'
import type { Station, TrainTime } from '@/lib/tdx'
import dayjs from 'dayjs'

const route = useRoute()
const stationsStore = useStationsStore()

const fromStation = ref<Station | null>(null)
const toStation = ref<Station | null>(null)
const date = ref(dayjs().format('YYYY-MM-DD'))
const startTime = ref('')
const endTime = ref('')
const trains = ref<TrainTime[]>([])
const loading = ref(false)
const error = ref('')
const searched = ref(false)

onMounted(async () => {
  await stationsStore.load()
  if (route.query.fromId) {
    fromStation.value = stationsStore.findById(route.query.fromId as string) ?? null
    toStation.value = stationsStore.findById(route.query.toId as string) ?? null
    date.value = (route.query.date as string) ?? dayjs().format('YYYY-MM-DD')
    await search()
  }
})

async function search() {
  if (!fromStation.value || !toStation.value) return
  loading.value = true
  error.value = ''
  searched.value = true
  try {
    trains.value = await tdx.getTimeTable(
      fromStation.value.StationID,
      toStation.value.StationID,
      date.value
    )
  } catch (e) {
    error.value = '查詢失敗，請稍後再試'
    trains.value = []
  } finally {
    loading.value = false
  }
}

function swap() {
  const tmp = fromStation.value
  fromStation.value = toStation.value
  toStation.value = tmp
}

function originStop(t: TrainTime) {
  const fromId = fromStation.value?.StationID
  return t.StopTimes.find(s => s.StationID === fromId) ?? t.StopTimes[0]
}

function destStop(t: TrainTime) {
  const toId = toStation.value?.StationID
  return t.StopTimes.find(s => s.StationID === toId) ?? t.StopTimes[t.StopTimes.length - 1]
}

// 常用時段快捷：一鍵帶入起訖；再點同一顆則清除（手機點選免叫鍵盤）
const TIME_PRESETS = [
  { label: '清晨', start: '05:00', end: '08:00' },
  { label: '早上', start: '08:00', end: '12:00' },
  { label: '下午', start: '12:00', end: '18:00' },
  { label: '晚上', start: '18:00', end: '23:59' },
]

function isPresetActive(p: { start: string; end: string }) {
  return startTime.value === p.start && endTime.value === p.end
}

function applyPreset(p: { start: string; end: string }) {
  if (isPresetActive(p)) {
    startTime.value = ''
    endTime.value = ''
  } else {
    startTime.value = p.start
    endTime.value = p.end
  }
}

// 將 "HH:mm" 或 "HH:mm:ss" 轉成當日分鐘數；無值回傳 NaN
function toMinutes(t?: string): number {
  if (!t) return NaN
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function getDuration(t: TrainTime) {
  const dep = toMinutes(originStop(t)?.DepartureTime)
  const arr = toMinutes(destStop(t)?.ArrivalTime)
  if (Number.isNaN(dep) || Number.isNaN(arr)) return ''
  const mins = arr - dep
  if (mins < 60) return `${mins}分`
  return `${Math.floor(mins / 60)}時${mins % 60}分`
}

// 依出發站發車時間排序，並套用起訖時間範圍篩選（純前端，即時生效）
// 先一次算好各班的發車分鐘數，避免 filter 與 sort 重複呼叫 originStop
const displayTrains = computed(() => {
  const start = toMinutes(startTime.value)
  const end = toMinutes(endTime.value)
  return trains.value
    .map(t => ({ t, dep: toMinutes(originStop(t)?.DepartureTime) }))
    .filter(({ dep }) => {
      if (Number.isNaN(dep)) return true
      if (!Number.isNaN(start) && dep < start) return false
      if (!Number.isNaN(end) && dep > end) return false
      return true
    })
    .sort((a, b) => {
      // 無發車時間（NaN）的班次穩定地排到最後，避免 NaN 比較造成順序不定
      if (Number.isNaN(a.dep)) return Number.isNaN(b.dep) ? 0 : 1
      if (Number.isNaN(b.dep)) return -1
      return a.dep - b.dep
    })
    .map(({ t }) => t)
})

// 起始時間晚於結束時間（範圍顛倒）時，用來給出更明確的空狀態提示
const invalidTimeRange = computed(() => {
  const start = toMinutes(startTime.value)
  const end = toMinutes(endTime.value)
  return !Number.isNaN(start) && !Number.isNaN(end) && start > end
})
</script>

<template>
  <div class="page">
    <header class="page-header">
      <h1>時刻查詢</h1>
    </header>

    <div class="content">
      <div class="search-form">
        <StationInput v-model="fromStation" placeholder="出發站" />
        <button class="swap-btn" @click="swap" aria-label="對調">
          <Icon name="swap" :size="16" />
        </button>
        <StationInput v-model="toStation" placeholder="到達站" />
        <div class="date-wrap">
          <Icon name="calendar" :size="16" class="date-icon" />
          <input type="date" v-model="date" class="date-input" />
        </div>
        <div class="time-range">
          <Icon name="clock" :size="16" class="date-icon" />
          <TimeInput v-model="startTime" placeholder="00:00" aria-label="最早出發時間" />
          <span class="time-sep">~</span>
          <TimeInput v-model="endTime" placeholder="23:59" aria-label="最晚出發時間" />
          <button
            v-if="startTime || endTime"
            class="time-clear"
            @click="startTime = ''; endTime = ''"
            aria-label="清除時間範圍"
          >
            <Icon name="x" :size="14" />
          </button>
        </div>
        <div class="time-presets">
          <button
            v-for="p in TIME_PRESETS"
            :key="p.label"
            type="button"
            class="preset-chip"
            :class="{ active: isPresetActive(p) }"
            @click="applyPreset(p)"
          >{{ p.label }}</button>
        </div>
        <button class="search-btn" @click="search" :disabled="!fromStation || !toStation || loading">
          {{ loading ? '查詢中...' : '查詢時刻' }}
        </button>
      </div>

      <div v-if="error" class="error-msg">{{ error }}</div>

      <div v-if="loading" class="loading-list">
        <div v-for="i in 5" :key="i" class="skeleton-card" />
      </div>

      <div v-else-if="searched && trains.length === 0 && !error" class="empty">
        <Icon name="inbox" :size="32" />
        <p>找不到班次</p>
      </div>

      <div v-else-if="searched && displayTrains.length === 0 && !error" class="empty">
        <Icon name="inbox" :size="32" />
        <p>{{ invalidTimeRange ? '起始時間晚於結束時間' : '此時間範圍沒有班次' }}</p>
      </div>

      <div v-else class="train-list">
        <div v-for="t in displayTrains" :key="t.TrainInfo.TrainNo" class="train-card">
          <div class="train-type-badge">{{ t.TrainInfo.TrainTypeName.Zh_tw }}</div>
          <div class="times">
            <div class="time-block">
              <span class="time">{{ originStop(t)?.DepartureTime }}</span>
              <span class="station">{{ fromStation?.StationName.Zh_tw }}</span>
            </div>
            <div class="duration-block">
              <span class="duration">{{ getDuration(t) }}</span>
              <span class="duration-line"></span>
            </div>
            <div class="time-block right">
              <span class="time">{{ destStop(t)?.ArrivalTime }}</span>
              <span class="station">{{ toStation?.StationName.Zh_tw }}</span>
            </div>
          </div>
          <div class="train-no">車次 {{ t.TrainInfo.TrainNo }}</div>
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
.swap-btn {
  align-self: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 50%;
  width: 36px; height: 36px;
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer;
  color: var(--text-dim);
  margin: -2px 0;
}
.swap-btn:hover { color: var(--text); border-color: var(--border-strong); }
.date-wrap {
  display: flex; align-items: center; gap: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 12px;
  transition: border-color 0.15s;
}
.date-wrap:focus-within { border-color: var(--text); }
.date-icon { color: var(--text-muted); }
.date-input {
  flex: 1;
  background: transparent;
  border: none;
  font-size: 0.92rem;
  color: var(--text);
  font-family: inherit;
  outline: none;
}
.time-range {
  display: flex; align-items: center; gap: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 12px;
  transition: border-color 0.15s;
}
.time-range:focus-within { border-color: var(--text); }
.time-sep { color: var(--text-muted); font-size: 0.92rem; }
.time-clear {
  background: transparent;
  border: none;
  padding: 2px;
  display: inline-flex;
  cursor: pointer;
  color: var(--text-muted);
  flex-shrink: 0;
}
.time-clear:hover { color: var(--text); }

.time-presets { display: flex; gap: 8px; }
.preset-chip {
  flex: 1;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 9px 4px;
  font-size: 0.85rem;
  color: var(--text-dim);
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.12s;
}
.preset-chip:hover { border-color: var(--border-strong); color: var(--text); }
.preset-chip.active {
  background: var(--surface-hover);
  border-color: var(--text);
  color: var(--text);
  font-weight: 600;
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

.train-list { display: flex; flex-direction: column; gap: 8px; }
.train-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 16px;
  transition: border-color 0.15s;
}
.train-card:hover { border-color: var(--border-strong); }
.train-type-badge {
  display: inline-block;
  background: var(--surface-hover);
  color: var(--text);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 0.72rem;
  font-weight: 500;
  margin-bottom: 12px;
}
.times { display: flex; align-items: center; justify-content: space-between; }
.time-block { display: flex; flex-direction: column; gap: 3px; }
.time-block.right { align-items: flex-end; }
.time {
  font-size: 1.25rem; font-weight: 600; color: var(--text);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
.station { font-size: 0.76rem; color: var(--text-dim); }

.duration-block {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  color: var(--text-muted);
  flex: 1;
  padding: 0 12px;
}
.duration { font-size: 0.72rem; font-weight: 500; }
.duration-line {
  width: 100%;
  height: 1px;
  background: var(--border);
}

.train-no {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  font-variant-numeric: tabular-nums;
}
.skeleton-card {
  background: var(--surface-soft);
  border: 1px solid var(--border);
  border-radius: 10px;
  height: 100px;
  animation: pulse 1.5s infinite;
}
.empty {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
  font-size: 0.92rem;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
}
</style>
