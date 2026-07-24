import { onMounted, readonly, ref } from 'vue'
import { PERF_MODE } from '../utils/featureFlags'

/**
 * Decide whether a visitor gets the full scroll-scrub VIDEO experience or a
 * lightweight STILL-IMAGE fallback — the core of the low-bandwidth work.
 *
 *   'full'   — scrub videos (current behaviour)
 *   'static' — poster still images only; clips are never downloaded
 *
 * Decision order (highest priority first):
 *   1. Explicit override — the `?media=static` / `?media=full` URL param, which
 *      persists to localStorage so it survives client-side navigation. This is
 *      both the QA lever on the staging deploy AND the manual toggle we ship, so
 *      a visitor stuck in a mode can escape it.
 *   2. Browser bandwidth signals — Save-Data, a 2G `effectiveType`, or a very
 *      low `downlink`. (Not exposed on iOS, where these stay undefined and we
 *      keep the full experience.)
 *   3. Default → 'full'.
 *
 * SCAFFOLD STATE: while PERF_MODE is off this always resolves to 'full', so
 * wiring it into a component is a no-op until the flag is switched on staging.
 */

const OVERRIDE_KEY = 'ea:media-mode'

// Read the sticky override. URL param wins and is persisted; otherwise fall back
// to a previously-stored choice. Client-only (guards window/localStorage).
function readOverride() {
  if (typeof window === 'undefined') return null
  try {
    const param = new URLSearchParams(window.location.search).get('media')
    if (param === 'static' || param === 'full') {
      window.localStorage.setItem(OVERRIDE_KEY, param)
      return param
    }
    return window.localStorage.getItem(OVERRIDE_KEY)
  } catch {
    return null
  }
}

// Infer a mode from the Network Information API. Absent on iOS/Safari → 'full'.
function detectFromConnection() {
  if (typeof navigator === 'undefined') return 'full'
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  if (!c) return 'full'
  if (c.saveData) return 'static'
  if (typeof c.effectiveType === 'string' && /(^|-)2g$/.test(c.effectiveType)) return 'static'
  if (typeof c.downlink === 'number' && c.downlink > 0 && c.downlink < 1.5) return 'static'
  return 'full'
}

/**
 * Resolve the mode synchronously (client-side). Returns { mode, reason }; the
 * `reason` is for diagnostics/QA overlays. Callers that need this outside a
 * component (e.g. the asset loader deciding whether to register a clip) use this
 * directly; components use `useMediaMode()` below for a hydration-safe ref.
 */
export function resolveMediaMode() {
  if (!PERF_MODE) return { mode: 'full', reason: 'perf-mode-off' }
  const override = readOverride()
  if (override) return { mode: override, reason: 'override' }
  const mode = detectFromConnection()
  return { mode, reason: mode === 'static' ? 'low-bandwidth' : 'default' }
}

/**
 * Hydration-safe composable. Server render + first client paint are always
 * 'full' (no `navigator` on the server) so markup matches; we re-resolve after
 * mount and let consumers react to the swap. Returns readonly refs.
 */
export function useMediaMode() {
  const mode = ref('full')
  const reason = ref('ssr-default')
  onMounted(() => {
    const resolved = resolveMediaMode()
    mode.value = resolved.mode
    reason.value = resolved.reason
  })
  return { mode: readonly(mode), reason: readonly(reason) }
}
