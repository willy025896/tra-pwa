<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useStationsStore } from '@/stores/stations'
import StationInput from '@/components/StationInput.vue'
import { tdx } from '@/lib/tdx'
import type { Station, ODFare } from '@/lib/tdx'

const stationsStore = useStationsStore()
const fromStation = ref<Station | null>(null)
const toStation = ref<Station | null>(null)
const fare = ref<ODFare | null>(null)
const loading = ref(false)
const error = ref('')
const searched = ref(false)

onMounted(() => stationsStore.load())

async function search() {
  if (!fromStation.value || !toStation.value) return
  loading.value = true
  error.value = ''
  searched.value = true
  fare.value = null
  try {
    fare.value = await tdx.getFare(fromStation.value.StationID, toStation.value.StationID)
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
  fare.value = null
}

const fareClassMap: Record<string, string> = {
  'FullFare': '全票',
  'HalfFare': '半票',
  'ChildFare': '孩童票',
  'DisabledFare': '身障票',
  'ElderFare': '敬老票'
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

      <div v-else-if="fare" class="fare-result">
        <div class="route-title">
          {{ fare.OriginStationName.Zh_tw }} → {{ fare.DestinationStationName.Zh_tw }}
        </div>
        <div class="fare-grid">
          <div v-for="f in fare.Fares" :key="f.FareClass + f.TicketType" class="fare-item">
            <span class="fare-class">{{ fareClassMap[f.FareClass] ?? f.FareClass }}</span>
            <span class="fare-price">NT$ {{ f.Price }}</span>
          </div>
        </div>
      </div>

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
.fare-result { background: var(--surface); border: 1.5px solid var(--border); border-radius: 16px; overflow: hidden; }
.route-title { padding: 14px 16px; font-weight: 700; font-size: 1rem; color: var(--text); border-bottom: 1.5px solid var(--border); }
.fare-grid { display: flex; flex-direction: column; }
.fare-item { display: flex; justify-content: space-between; align-items: center; padding: 13px 16px; border-bottom: 1px solid var(--border); }
.fare-item:last-child { border-bottom: none; }
.fare-class { font-size: 0.92rem; color: var(--text-dim); }
.fare-price { font-size: 1.1rem; font-weight: 800; color: var(--accent); }
.skeleton-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: 16px; height: 200px; animation: pulse 1.5s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.empty { text-align: center; padding: 40px; color: var(--text-dim); }
.empty span { font-size: 2rem; display: block; margin-bottom: 8px; }
</style>
