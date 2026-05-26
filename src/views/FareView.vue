<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useStationsStore } from '@/stores/stations'
import StationInput from '@/components/StationInput.vue'
import { tdx, TRAIN_TYPE_NAME, FARE_CLASS_NAME } from '@/lib/tdx'
import type { Station, ODFare } from '@/lib/tdx'

const stationsStore = useStationsStore()
const fromStation = ref<Station | null>(null)
const toStation = ref<Station | null>(null)
const fares = ref<ODFare[]>([])
const loading = ref(false)
const error = ref('')
const searched = ref(false)

onMounted(() => stationsStore.load())

const header = computed(() => fares.value[0] ?? null)

async function search() {
  if (!fromStation.value || !toStation.value) return
  loading.value = true
  error.value = ''
  searched.value = true
  fares.value = []
  try {
    fares.value = await tdx.getFare(fromStation.value.StationID, toStation.value.StationID)
  } catch {
    error.value = '查詢失敗，請稍後再試'
  } finally {
    loading.value = false
  }
}

function swap() {
  const tmp = fromStation.value
  fromStation.value = toStation.value
  toStation.value = tmp
  fares.value = []
}

function trainTypeName(code: number) {
  return TRAIN_TYPE_NAME[code] ?? `車種 ${code}`
}

function fareClassName(code: number) {
  return FARE_CLASS_NAME[code] ?? `類別 ${code}`
}

function fullFarePrice(f: ODFare): number | null {
  return f.Fares.find(x => x.FareClass === 1)?.Price ?? null
}
</script>

<template>
  <div class="page">
    <header class="page-header">
      <h1>票價查詢</h1>
    </header>

    <div class="content">
      <div class="search-form">
        <StationInput v-model="fromStation" placeholder="出發站" />
        <button class="swap-btn" @click="swap">⇅</button>
        <StationInput v-model="toStation" placeholder="到達站" />
        <button class="search-btn" @click="search" :disabled="!fromStation || !toStation || loading">
          {{ loading ? '查詢中...' : '查詢票價' }}
        </button>
      </div>

      <div v-if="error" class="error-msg">{{ error }}</div>

      <div v-if="loading" class="skeleton-card" />

      <template v-else-if="header">
        <div class="route-header">
          <div class="route-title">
            {{ header.OriginStationName.Zh_tw }} → {{ header.DestinationStationName.Zh_tw }}
          </div>
          <div v-if="header.TravelDistance" class="route-distance">
            約 {{ header.TravelDistance }} 公里
          </div>
        </div>

        <div class="fare-list">
          <div v-for="f in fares" :key="f.TrainType" class="fare-card">
            <div class="fare-card-head">
              <span class="train-type-badge">{{ trainTypeName(f.TrainType) }}</span>
              <span class="full-price">NT$ {{ fullFarePrice(f) ?? '—' }}</span>
            </div>
            <div class="fare-breakdown">
              <span
                v-for="d in f.Fares"
                :key="d.FareClass + '-' + d.TicketType"
                class="fare-chip"
              >
                {{ fareClassName(d.FareClass) }} {{ d.Price }}
              </span>
            </div>
          </div>
        </div>
      </template>

      <div v-else-if="searched && !loading" class="empty">
        <span>🎫</span>
        <p>查無票價資料</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { min-height: 100dvh; padding-bottom: 80px; }
.page-header { padding: 16px 16px 0; max-width: 480px; margin: 0 auto; }
h1 { font-size: 1.3rem; font-weight: 800; color: var(--text); letter-spacing: -0.03em; margin: 0 0 16px; }
.content { max-width: 480px; margin: 0 auto; padding: 0 16px 20px; display: flex; flex-direction: column; gap: 16px; }
.search-form { background: var(--surface); border: 1.5px solid var(--border); border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 10px; align-items: stretch; }
.swap-btn { align-self: center; background: var(--surface-hover); border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 1.1rem; cursor: pointer; color: var(--text); }
.search-btn { background: var(--accent); color: #000; border: none; border-radius: 12px; padding: 13px; font-size: 1rem; font-weight: 700; cursor: pointer; font-family: inherit; }
.search-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.error-msg { background: #ff4d6d22; border: 1.5px solid #ff4d6d55; border-radius: 12px; padding: 12px 16px; color: #ff4d6d; font-size: 0.9rem; }
.route-header { background: var(--surface); border: 1.5px solid var(--border); border-radius: 14px; padding: 12px 16px; display: flex; align-items: baseline; justify-content: space-between; }
.route-title { font-weight: 700; font-size: 1rem; color: var(--text); }
.route-distance { font-size: 0.78rem; color: var(--text-dim); }
.fare-list { display: flex; flex-direction: column; gap: 10px; }
.fare-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: 14px; padding: 12px 14px; }
.fare-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.train-type-badge { background: var(--accent); color: #000; border-radius: 6px; padding: 3px 10px; font-size: 0.82rem; font-weight: 800; }
.full-price { font-size: 1.15rem; font-weight: 800; color: var(--accent); font-variant-numeric: tabular-nums; }
.fare-breakdown { display: flex; flex-wrap: wrap; gap: 6px; }
.fare-chip { font-size: 0.72rem; color: var(--text-dim); background: var(--surface-hover); border-radius: 6px; padding: 3px 8px; font-variant-numeric: tabular-nums; }
.skeleton-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: 16px; height: 200px; animation: pulse 1.5s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.empty { text-align: center; padding: 40px; color: var(--text-dim); }
.empty span { font-size: 2rem; display: block; margin-bottom: 8px; }
</style>
