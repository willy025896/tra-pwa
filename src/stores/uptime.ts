import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

/**
 * 服務上線天數。資料由 GitHub Actions 每天呼叫 bump_uptime() 累加，
 * 前端只唯讀顯示（service_uptime 開了 select policy 給 anon）。
 */
export const useUptimeStore = defineStore('uptime', () => {
  const days = ref<number | null>(null)

  async function load() {
    if (days.value !== null) return // 一次 session 讀一次就夠
    const { data, error } = await supabase
      .from('service_uptime')
      .select('days')
      .eq('id', 1)
      .maybeSingle() // 0 列回 null（不像 .single() 會丟 406），footer 單純不顯示
    if (!error && data) days.value = data.days
  }

  return { days, load }
})
