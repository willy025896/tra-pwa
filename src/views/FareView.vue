<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useStationsStore } from '@/stores/stations'
import StationInput from '@/components/StationInput.vue'
import Icon from '@/components/Icon.vue'
import { tdx, TRAIN_TYPE_NAME, FARE_CLASS_NAME, FARE_CLASS } from '@/lib/tdx'
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
  searched.value = false
}

function trainTypeName(code: number) {
  return TRAIN_TYPE_NAME[code] ?? `車種 ${code}`
}

function fareClassName(code: number) {
  return FARE_CLASS_NAME[code] ?? `類別 ${code}`
}

function fullFarePrice(f: ODFare): number | null {
  return f.Fares.find(x => x.FareClass === FARE_CLASS.FULL)?.Price ?? null
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
        <button class="swap-btn" @click="swap" aria-label="對調">
          <Icon name="swap" :size="16" />
        </button>
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
            {{ header.OriginStationName.Zh_tw }}
            <Icon name="arrow-right" :size="14" class="arrow" />
            {{ header.DestinationStationName.Zh_tw }}
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
        <Icon name="ticket" :size="32" />
        <p>查無票價資料</p>
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
  display: flex; flex-direction: column; gap: 10px; align-items: stretch;
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
}
.swap-btn:hover { color: var(--text); border-color: var(--border-strong); }

.search-btn {
  background: var(--text); color: var(--bg);
  border: none; border-radius: 8px;
  padding: 12px;
  font-size: 0.95rem; font-weight: 500;
  cursor: pointer;
}
.search-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.search-btn:not(:disabled):hover { opacity: 0.9; }

.route-header {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 16px;
  display: flex; align-items: center; justify-content: space-between;
}
.route-title {
  display: inline-flex; align-items: center; gap: 8px;
  font-weight: 600; font-size: 0.95rem; color: var(--text);
}
.arrow { color: var(--text-muted); }
.route-distance { font-size: 0.76rem; color: var(--text-muted); }

.fare-list { display: flex; flex-direction: column; gap: 8px; }
.fare-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 14px;
  transition: border-color 0.15s;
}
.fare-card:hover { border-color: var(--border-strong); }
.fare-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.train-type-badge {
  background: var(--surface-hover); color: var(--text);
  border-radius: 4px;
  padding: 2px 10px;
  font-size: 0.78rem; font-weight: 500;
}
.full-price {
  font-size: 1.1rem; font-weight: 600; color: var(--text);
  font-variant-numeric: tabular-nums;
}
.fare-breakdown { display: flex; flex-wrap: wrap; gap: 6px; }
.fare-chip {
  font-size: 0.72rem; color: var(--text-dim);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 8px;
  font-variant-numeric: tabular-nums;
}
.skeleton-card {
  background: var(--surface-soft);
  border: 1px solid var(--border);
  border-radius: 12px;
  height: 200px;
  animation: pulse 1.5s infinite;
}
.empty {
  text-align: center; padding: 40px;
  color: var(--text-muted);
  display: flex; flex-direction: column; align-items: center; gap: 10px;
}
.empty p { font-size: 0.92rem; }
</style>
