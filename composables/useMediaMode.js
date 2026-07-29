import { onMounted, readonly, ref } from 'vue'
import { PERF_MODE } from '../utils/featureFlags'

/**
 * Match the media experience to a visitor's connection — the core of the
 * low-bandwidth work. Three tiers:
 *
 *   'full'     — scroll-scrub video (current behaviour). Needs the whole clip
 *                buffered up front, so it's reserved for fast connections.
 *   'autoplay' — a lighter, low-res clip on a muted loop, streamed
 *                progressively (no full download). Keeps the motion on a
 *                moderate connection without the scrub's up-front cost.
 *   'static'   — poster still image only; no clip is fetched at all. For
 *                Data-Saver / very slow links, and for reduced-motion users.
 *
 * Decision order (highest priority first):
 *   1. Explicit override — the `?media=full|autoplay|static` URL param, which
 *      persists to localStorage so it survives client-side navigation. This is
 *      the QA lever on staging AND the runtime "play motion" control (setMode),
 *      so a visitor can always step up to a richer tier.
 *   2. Reduced-motion preference → 'static' (the visitor asked for no motion).
 *   3. Browser bandwidth signals — Save-Data / 2G → 'static'; a middling
 *      `effectiveType`/`downlink` → 'autoplay'. (Absent on iOS/Safari, where
 *      they stay undefined and we keep the full experience.)
 *   4. Default → 'full'.
 *
 * While PERF_MODE is off this always resolves to 'full', so every consumer is a
 * no-op until the flag is switched on (staging).
 */

const MODES = ['full', 'autoplay', 'static']
const OVERRIDE_KEY = 'ea:media-mode'

// Read the sticky override. URL param wins and is persisted; otherwise fall back
// to a previously-stored choice. Client-only (guards window/localStorage).
function readOverride() {
  if (typeof window === 'undefined') return null
  try {
    const param = new URLSearchParams(window.location.search).get('media')
    if (MODES.includes(param)) {
      window.localStorage.setItem(OVERRIDE_KEY, param)
      return param
    }
    const stored = window.localStorage.getItem(OVERRIDE_KEY)
    return MODES.includes(stored) ? stored : null
  } catch {
    return null
  }
}

// True when the visitor has asked the OS for reduced motion.
function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Infer a tier from the Network Information API. Absent on iOS/Safari → 'full'.
//   Save-Data or 2G            → 'static'  (honour the data-saving intent)
//   slow-3g, or downlink <1.5  → 'autoplay' (keep motion, but lighter)
//   otherwise                  → 'full'
function detectFromConnection() {
  if (typeof navigator === 'undefined') return 'full'
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  if (!c) return 'full'
  if (c.saveData) return 'static'
  const et = typeof c.effectiveType === 'string' ? c.effectiveType : ''
  if (/(^|-)2g$/.test(et)) return 'static'
  const downlink = typeof c.downlink === 'number' ? c.downlink : null
  if (et === 'slow-2g' || et === '3g' || (downlink !== null && downlink > 0 && downlink < 1.5)) {
    return 'autoplay'
  }
  return 'full'
}

/**
 * Resolve the tier synchronously (client-side). Returns { mode, reason }; the
 * `reason` is for diagnostics/QA overlays. Callers outside a component (e.g. the
 * asset loader deciding which clip, if any, to download) use this directly;
 * components use `useMediaMode()` below for a hydration-safe ref.
 */
export function resolveMediaMode() {
  if (!PERF_MODE) return { mode: 'full', reason: 'perf-mode-off' }
  const override = readOverride()
  if (override) return { mode: override, reason: 'override' }
  if (prefersReducedMotion()) return { mode: 'static', reason: 'reduced-motion' }
  const mode = detectFromConnection()
  const reason = mode === 'full' ? 'default' : `connection-${mode}`
  return { mode, reason }
}

// Persist an explicit tier choice (the "play motion" control / QA). Written to
// the same key readOverride() consults, so it sticks across navigations.
export function persistMediaMode(mode) {
  if (typeof window === 'undefined' || !MODES.includes(mode)) return
  try { window.localStorage.setItem(OVERRIDE_KEY, mode) } catch { /* ignore */ }
}

/**
 * Hydration-safe composable. Server render + first client paint are always
 * 'full' (no `navigator` on the server) so markup matches; we re-resolve after
 * mount and let consumers react to the swap.
 *
 * Returns:
 *   mode    — readonly tier ref ('full' | 'autoplay' | 'static')
 *   reason  — readonly diagnostic ref
 *   setMode — escalate/override the tier at runtime (the "play motion" control);
 *             persists the choice and updates the ref immediately.
 */
export function useMediaMode() {
  const mode = ref('full')
  const reason = ref('ssr-default')
  onMounted(() => {
    const resolved = resolveMediaMode()
    mode.value = resolved.mode
    reason.value = resolved.reason
  })
  const setMode = (next) => {
    if (!MODES.includes(next)) return
    persistMediaMode(next)
    mode.value = next
    reason.value = 'user'
  }
  return { mode: readonly(mode), reason: readonly(reason), setMode }
}
