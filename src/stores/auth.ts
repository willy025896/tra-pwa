import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(true)

  const isLoggedIn = computed(() => !!user.value)

  async function init() {
    loading.value = true
    const { data } = await supabase.auth.getSession()
    if (data.session?.user) {
      user.value = {
        id: data.session.user.id,
        email: data.session.user.email,
        name: data.session.user.user_metadata?.full_name,
        avatarUrl: data.session.user.user_metadata?.avatar_url
      }
    }
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        user.value = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.full_name,
          avatarUrl: session.user.user_metadata?.avatar_url
        }
      } else {
        user.value = null
      }
    })
    loading.value = false
  }

  async function loginWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
  }

  async function logout() {
    await supabase.auth.signOut()
    user.value = null
  }

  return { user, loading, isLoggedIn, init, loginWithGoogle, logout }
})
