<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useStationsStore } from '@/stores/stations'
import StationInput from '@/components/StationInput.vue'
import { tdx } from '@/lib/tdx'
import type { Station, TrainTime } from '@/lib/tdx'
import dayjs from 'dayjs'

const route = useRoute()
const stationsStore = useStationsStore()

const fromStation = ref<Station | null>(null)
const toStation = ref<Station | null>(null)
const date = ref(dayjs().format('YYYY-MM-DD'))
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

function getDuration(t: TrainTime) {
  const dep = t.OriginStopTime.DepartureTime
  const arr = t.DestinationStopTime.ArrivalTime
  const depParts = dep.split(':').map(Number)
  const arrParts = arr.split(':').map(Number)
  const dh = depParts[0] ?? 0, dm = depParts[1] ?? 0
  const ah = arrParts[0] ?? 0, am = arrParts[1] ?? 0
  const mins = (ah * 60 + am) - (dh * 60 + dm)
  if (mins < 60) return `${mins}分`
  return `${Math.floor(mins / 60)}時${mins % 60}分`
}
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
          <button class="swap-btn" @click="swap">⇅</button>
          <input type="date" v-model="date" class="date-input" />
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
        <span>🔍</span>
        <p>找不到班次</p>
      </div>

      <div v-else class="train-list">
        <div v-for="t in trains" :key="t.TrainNo" class="train-card">
          <div class="train-type-badge">{{ t.TrainTypeName.Zh_tw }}</div>
          <div class="times">
            <div class="time-block">
              <span class="time">{{ t.OriginStopTime.DepartureTime }}</span>
              <span class="station">{{ fromStation?.StationName.Zh_tw }}</span>
            </div>
            <div class="duration-block">
              <span class="duration">{{ getDuration(t) }}</span>
              <span class="duration-line">──────</span>
            </div>
            <div class="time-block right">
              <span class="time">{{ t.DestinationStopTime.ArrivalTime }}</span>
              <span class="station">{{ toStation?.StationName.Zh_tw }}</span>
            </div>
          </div>
          <div class="train-no">車次 {{ t.TrainNo }}</div>
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
.middle-row { display: flex; gap: 10px; align-items: center; }
.swap-btn { background: var(--surface-hover); border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 1.1rem; cursor: pointer; color: var(--text); flex-shrink: 0; }
.date-input { flex: 1; background: var(--surface); border: 2px solid var(--border); border-radius: 12px; padding: 10px 12px; font-size: 0.95rem; color: var(--text); font-family: inherit; outline: none; }
.date-input:focus { border-color: var(--accent); }
.search-btn { background: var(--accent); color: #000; border: none; border-radius: 12px; padding: 13px; font-size: 1rem; font-weight: 700; cursor: pointer; font-family: inherit; transition: opacity 0.2s; }
.search-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.error-msg { background: #ff4d6d22; border: 1.5px solid #ff4d6d55; border-radius: 12px; padding: 12px 16px; color: #ff4d6d; font-size: 0.9rem; }
.train-list { display: flex; flex-direction: column; gap: 10px; }
.train-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: 14px; padding: 14px 16px; }
.train-type-badge { display: inline-block; background: var(--accent); color: #000; border-radius: 6px; padding: 2px 8px; font-size: 0.75rem; font-weight: 800; margin-bottom: 10px; }
.times { display: flex; align-items: center; justify-content: space-between; }
.time-block { display: flex; flex-direction: column; gap: 2px; }
.time-block.right { align-items: flex-end; }
.time { font-size: 1.3rem; font-weight: 800; color: var(--text); font-variant-numeric: tabular-nums; }
.station { font-size: 0.78rem; color: var(--text-dim); }
.duration-block { display: flex; flex-direction: column; align-items: center; gap: 2px; color: var(--text-dim); }
.duration { font-size: 0.75rem; font-weight: 600; }
.duration-line { font-size: 0.6rem; letter-spacing: -2px; }
.train-no { font-size: 0.75rem; color: var(--text-dim); margin-top: 10px; border-top: 1px solid var(--border); padding-top: 8px; }
.skeleton-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: 14px; height: 100px; animation: pulse 1.5s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.empty { text-align: center; padding: 40px; color: var(--text-dim); font-size: 0.95rem; }
.empty span { font-size: 2rem; display: block; margin-bottom: 8px; }
</style>
