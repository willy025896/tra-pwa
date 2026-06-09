<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useStationsStore } from '@/stores/stations'
import StationInput from '@/components/StationInput.vue'
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

// 將 "HH:mm" 或 "HH:mm:ss" 轉成當日分鐘數；無值回傳 NaN
function toMinutes(t?: string): number {
  if (!t) return NaN
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

// 打字即時格式化：只留數字、最多 4 位，採「右兩位＝分鐘」於倒數第 2 位前補冒號
// 123 → 1:23、1230 → 12:30、830 → 8:30（消除部分輸入的歧義）
function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  // 滿 4 位即定型並夾限，避免停留在 23:99、9:99 之類的非法顯示
  if (digits.length === 4) return normalizeTime(digits)
  return `${digits.slice(0, -2)}:${digits.slice(-2)}`
}

// 失焦時正規化成合法 24 小時制 HH:mm：右兩位＝分、其餘＝時，超界各自夾到 23 / 59
function normalizeTime(v: string): string {
  const digits = v.replace(/\D/g, '')
  if (!digits) return ''
  const h = Math.min(23, Number(digits.slice(0, -2) || '0'))
  const m = Math.min(59, Number(digits.slice(-2)))
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function onTimeInput(which: 'start' | 'end', e: Event) {
  const formatted = formatTimeInput((e.target as HTMLInputElement).value)
  if (which === 'start') startTime.value = formatted
  else endTime.value = formatted
}

function onTimeBlur(which: 'start' | 'end') {
  if (which === 'start') startTime.value = normalizeTime(startTime.value)
  else endTime.value = normalizeTime(endTime.value)
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
        <div class="middle-row">
          <button class="swap-btn" @click="swap" aria-label="對調">
            <Icon name="swap" :size="16" />
          </button>
          <div class="date-wrap">
            <Icon name="calendar" :size="16" class="date-icon" />
            <input type="date" v-model="date" class="date-input" />
          </div>
        </div>
        <div class="time-range">
          <Icon name="clock" :size="16" class="date-icon" />
          <input
            :value="startTime"
            @input="onTimeInput('start', $event)"
            @blur="onTimeBlur('start')"
            type="text"
            inputmode="numeric"
            maxlength="5"
            placeholder="00:00"
            class="time-input"
            aria-label="最早出發時間"
          />
          <span class="time-sep">~</span>
          <input
            :value="endTime"
            @input="onTimeInput('end', $event)"
            @blur="onTimeBlur('end')"
            type="text"
            inputmode="numeric"
            maxlength="5"
            placeholder="23:59"
            class="time-input"
            aria-label="最晚出發時間"
          />
          <button
            v-if="startTime || endTime"
            class="time-clear"
            @click="startTime = ''; endTime = ''"
            aria-label="清除時間範圍"
          >
            <Icon name="x" :size="14" />
          </button>
        </div>
        <StationInput v-model="toStation" placeholder="到達站" />
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
.middle-row { display: flex; gap: 10px; align-items: center; }
.swap-btn {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 50%;
  width: 36px; height: 36px;
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer;
  color: var(--text-dim);
  flex-shrink: 0;
}
.swap-btn:hover { color: var(--text); border-color: var(--border-strong); }
.date-wrap {
  flex: 1;
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
.time-input {
  background: transparent;
  border: none;
  font-size: 0.92rem;
  color: var(--text);
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  outline: none;
  flex: 1;
  min-width: 0;
}
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
