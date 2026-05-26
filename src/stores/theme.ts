import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const LS_KEY = 'tra-pwa:theme'
const THEME_COLOR_LIGHT = '#f4f4f5'
const THEME_COLOR_DARK = '#09090b'
const DARK_QUERY = '(prefers-color-scheme: dark)'

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(
    (localStorage.getItem(LS_KEY) as ThemeMode | null) ?? 'system'
  )

  const systemPrefers = ref<'light' | 'dark'>(
    matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
  )

  const resolvedTheme = computed<'light' | 'dark'>(() =>
    mode.value === 'system' ? systemPrefers.value : mode.value
  )

  function apply() {
    document.documentElement.dataset.theme = resolvedTheme.value
    const metaTheme = document.querySelector('meta[name="theme-color"]')
    if (metaTheme) {
      metaTheme.setAttribute(
        'content',
        resolvedTheme.value === 'dark' ? THEME_COLOR_DARK : THEME_COLOR_LIGHT
      )
    }
  }

  function toggle() {
    const next: Record<ThemeMode, ThemeMode> = {
      light: 'dark',
      dark: 'system',
      system: 'light'
    }
    mode.value = next[mode.value]
    localStorage.setItem(LS_KEY, mode.value)
    apply()
  }

  let _mediaQuery: MediaQueryList | null = null
  let _listener: ((e: MediaQueryListEvent) => void) | null = null

  function init() {
    apply()
    if (_mediaQuery && _listener) {
      _mediaQuery.removeEventListener('change', _listener)
    }
    _mediaQuery = matchMedia(DARK_QUERY)
    _listener = (e) => {
      systemPrefers.value = e.matches ? 'dark' : 'light'
      if (mode.value === 'system') apply()
    }
    _mediaQuery.addEventListener('change', _listener)
  }

  return { mode, resolvedTheme, toggle, init }
})
