import { defineStore } from 'pinia'
import { ref } from 'vue'
import { tdx } from '@/lib/tdx'
import type { Station } from '@/lib/tdx'

const CACHE_KEY = 'tra-pwa:stations'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

interface CacheShape {
  fetchedAt: number
  stations: Station[]
}

function readCache(): Station[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheShape
    if (!parsed.fetchedAt || !Array.isArray(parsed.stations)) return null
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null
    return parsed.stations
  } catch {
    return null
  }
}

function writeCache(stations: Station[]) {
  try {
    const payload: CacheShape = { fetchedAt: Date.now(), stations }
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
  } catch {
    // quota exceeded or storage disabled — fail silently, in-memory state still works
  }
}

export const useStationsStore = defineStore('stations', () => {
  const stations = ref<Station[]>([])
  const loaded = ref(false)

  async function load() {
    if (loaded.value) return

    const cached = readCache()
    if (cached) {
      stations.value = cached
      loaded.value = true
      return
    }

    stations.value = await tdx.getStations()
    loaded.value = true
    writeCache(stations.value)
  }

  function search(query: string): Station[] {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return stations.value
      .filter(
        (s) =>
          s.StationName.Zh_tw.includes(q) ||
          s.StationName.En.toLowerCase().includes(q) ||
          s.StationID.includes(q),
      )
      .slice(0, 10)
  }

  function findById(id: string): Station | undefined {
    return stations.value.find((s) => s.StationID === id)
  }

  return { stations, loaded, load, search, findById }
})
