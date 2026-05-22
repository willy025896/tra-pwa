import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth'
import type { FavoriteRoute } from '@/types'

const LS_KEY = 'tra_favorites'

function loadFromLS(): FavoriteRoute[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveToLS(routes: FavoriteRoute[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(routes))
}

export const useFavoritesStore = defineStore('favorites', () => {
  const routes = ref<FavoriteRoute[]>([])
  const authStore = useAuthStore()

  async function load() {
    if (authStore.isLoggedIn && authStore.user) {
      const { data } = await supabase
        .from('favorite_routes')
        .select('*')
        .eq('user_id', authStore.user.id)
        .order('created_at', { ascending: false })
      routes.value = (data ?? []).map((r) => ({
        id: r.id,
        fromId: r.from_id,
        fromName: r.from_name,
        toId: r.to_id,
        toName: r.to_name,
        label: r.label,
        createdAt: r.created_at
      }))
    } else {
      routes.value = loadFromLS()
    }
  }

  async function add(route: Omit<FavoriteRoute, 'id' | 'createdAt'>) {
    const newRoute: FavoriteRoute = {
      ...route,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    }

    if (authStore.isLoggedIn && authStore.user) {
      const { data, error } = await supabase
        .from('favorite_routes')
        .insert({
          user_id: authStore.user.id,
          from_id: route.fromId,
          from_name: route.fromName,
          to_id: route.toId,
          to_name: route.toName,
          label: route.label
        })
        .select()
        .single()
      if (!error && data) {
        newRoute.id = data.id
        newRoute.createdAt = data.created_at
      }
    } else {
      const updated = [newRoute, ...loadFromLS()]
      saveToLS(updated)
    }

    routes.value.unshift(newRoute)
  }

  async function remove(id: string) {
    routes.value = routes.value.filter((r) => r.id !== id)
    if (authStore.isLoggedIn) {
      await supabase.from('favorite_routes').delete().eq('id', id)
    } else {
      saveToLS(routes.value)
    }
  }

  // 登入後把 localStorage 的資料同步到 Supabase
  async function syncAfterLogin() {
    const local = loadFromLS()
    if (local.length === 0 || !authStore.user) return
    for (const r of local) {
      await supabase.from('favorite_routes').insert({
        user_id: authStore.user.id,
        from_id: r.fromId,
        from_name: r.fromName,
        to_id: r.toId,
        to_name: r.toName,
        label: r.label
      })
    }
    localStorage.removeItem(LS_KEY)
    await load()
  }

  return { routes, load, add, remove, syncAfterLogin }
})
