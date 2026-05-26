# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # runs type-check + vite build in parallel
npm run type-check   # vue-tsc --build
npm run preview      # preview built bundle
npm test             # vitest run (one-shot)
npm run test:watch   # vitest in watch mode
```

No linter or formatter is configured. CI surface is `type-check` + `build` + `test`.

## Environment

Four required env vars (see [.env.example](.env.example)) — Vite needs all of them at dev/build time or the TDX/Supabase clients throw at first call:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase project
- `VITE_TDX_CLIENT_ID`, `VITE_TDX_CLIENT_SECRET` — TDX OAuth2 client credentials

Supabase schema lives in [supabase-schema.sql](supabase-schema.sql) — a single `favorite_routes` table with RLS scoped to `auth.uid() = user_id`.

Path alias: `@/...` → `src/...` (see [vite.config.ts](vite.config.ts)).

## Architecture

### TDX API layer ([src/lib/tdx.ts](src/lib/tdx.ts))

All TDX calls go through one module that owns:

- **Token cache** — `getToken()` keeps the access token in-memory with a 60s expiry safety margin; client-credentials grant against `tdx.transportdata.tw/auth/...`.
- **Endpoint registry** — `ENDPOINTS` is the single source of truth for `{ version, path, listKey }` per endpoint. v3 responses are envelope objects keyed by `listKey` (e.g. `Stations`, `TrainTimetables`); `unwrap()` pulls the array out. When adding/migrating endpoints, edit this table — do not hardcode URLs in callers.
- **Sunset/Deprecation header detection** — logs once per endpoint key when TDX signals deprecation; useful early warning for API version migrations.

### Favorites: dual storage with login-time sync ([src/stores/favorites.ts](src/stores/favorites.ts))

`useFavoritesStore` branches on `authStore.isLoggedIn`:

- **Logged out** → `localStorage` key `tra_favorites`
- **Logged in** → Supabase `favorite_routes` table

`syncAfterLogin()` migrates local entries to Supabase via a **single batched insert**, then clears `localStorage` only if the insert succeeded — if it fails, the local copy is preserved so the user doesn't lose favorites. The auth store is responsible for calling it at the right moment after a successful OAuth callback.

### Stations cache ([src/stores/stations.ts](src/stores/stations.ts))

Station list (~240 entries) is cached in `localStorage` (`tra-pwa:stations`) with a 7-day TTL to avoid hitting TDX on every page load. `load()` is idempotent (`loaded` flag) and views call it on mount.

### LiveView: two endpoints joined by TrainNo ([src/views/LiveView.vue](src/views/LiveView.vue))

Live train board (`getLiveTrains`) only carries delay + status. To show destination, direction, and scheduled time, it's joined with `getStationTimetable` (today's station timetable) via a `Map<TrainNo, StationTimetableEntry>`. The timetable call is wrapped in `.catch` so live data still renders if the timetable endpoint fails. Auto-refreshes every 30s via `setInterval`; cleanup in `onUnmounted`.

### Station search variant matching ([src/components/StationInput.vue](src/components/StationInput.vue))

Search input normalizes `臺` → `台` so users typing either variant find both. If you add more legacy/simplified pairs, extend `VARIANT_MAP` and `normalize()`.

### Routing & document title ([src/router/index.ts](src/router/index.ts))

Routes are lazy-loaded. `router.afterEach` reads `route.meta.title` and sets `document.title` to `{title} · 台鐵時刻`. New routes should set a `meta.title`.

### UI design tokens

CSS custom properties live in [src/assets/main.css](src/assets/main.css) (`--bg`, `--surface`, `--surface-soft`, `--surface-hover`, `--border`, `--border-strong`, `--text`, `--text-dim`, `--text-muted`, plus semantic `--danger/--success/--warning/--info` with `*-soft` pairs). All component styles reference these — when changing the theme, edit the tokens, not individual components.

Line icons are centralized in [src/components/Icon.vue](src/components/Icon.vue) — a single component switching SVG paths by a `name` prop. `currentColor` strokes inherit from the parent's `color`, so styling is just `.icon-wrap { color: ... }`. Add new icons by extending the `IconName` union and adding a `<template v-else-if>` branch.

### PWA

Configured in [vite.config.ts](vite.config.ts) with `registerType: 'autoUpdate'` — clients pick up new builds without prompt. Manifest is portrait standalone.

## Testing

Vitest is configured in [vite.config.ts](vite.config.ts) with `environment: 'node'`, picking up `src/**/*.test.ts`. Currently only [src/lib/tdx.ts](src/lib/tdx.ts) has tests — the file owns all the high-risk logic (token cache, envelope unwrap, OData filter composition, station timetable flatten, sunset header dedup, URL composition).

When adding a new TDX endpoint to `ENDPOINTS`, add at least one URL-composition assertion in [src/lib/tdx.test.ts](src/lib/tdx.test.ts) to catch path typos.

See [docs/testing.md](docs/testing.md) for the full rationale: what to test, what not to, and the design decisions behind the existing suite (module reset between tests, fake timers for the 60s safety margin, mocking strategy).
