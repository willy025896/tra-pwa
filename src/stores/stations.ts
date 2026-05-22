import { defineStore } from 'pinia'
import { ref } from 'vue'
import { tdx } from '@/lib/tdx'
import type { Station } from '@/lib/tdx'

export const useStationsStore = defineStore('stations', () => {
  const stations = ref<Station[]>([])
  const loaded = ref(false)

  async function load() {
    if (loaded.value) return
    stations.value = await tdx.getStations()
    loaded.value = true
  }

  function search(query: string): Station[] {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return stations.value
      .filter(
        (s) =>
          s.StationName.Zh_tw.includes(q) ||
          s.StationName.En.toLowerCase().includes(q) ||
          s.StationID.includes(q)
      )
      .slice(0, 10)
  }

  function findById(id: string): Station | undefined {
    return stations.value.find((s) => s.StationID === id)
  }

  return { stations, loaded, load, search, findById }
})
