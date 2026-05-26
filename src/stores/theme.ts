import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const LS_KEY = 'tra-pwa:theme'
const THEME_COLOR_LIGHT = '#f4f4f5'
const THEME_COLOR_DARK = '#09090b'

function getSystemTheme(): 'light' | 'dark' {
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(
    (localStorage.getItem(LS_KEY) as ThemeMode | null) ?? 'system'
  )

  const resolvedTheme = computed<'light' | 'dark'>(() =>
    mode.value === 'system' ? getSystemTheme() : mode.value
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

  function init() {
    apply()
    _mediaQuery = matchMedia('(prefers-color-scheme: dark)')
    _mediaQuery.addEventListener('change', () => {
      if (mode.value === 'system') apply()
    })
  }

  return { mode, resolvedTheme, toggle, init }
})
