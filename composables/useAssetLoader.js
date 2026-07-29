import { reactive, computed, readonly } from 'vue'

/**
 * App-wide asset preloader.
 *
 * Drives the launch overlay (components/AppLoader.vue): we collect every heavy
 * media URL referenced by the homepage (scrub videos + their poster/hero
 * images, pulled straight from the Prismic document) and download them in full
 * with real byte-level progress, so the four logo bars only reach 100% once the
 * site's media is genuinely buffered. Full downloads matter here because the
 * scrub interaction (composables/useScrubVideo.js) seeks to arbitrary timestamps
 * and plays faster than real-time — so every byte needs to be present for a
 * fast scroll to stay smooth, not just "enough to play at 1x". There's no time
 * cap: the overlay holds until the media is genuinely buffered.
 *
 * State lives at module scope so it's a single shared store across the app.
 */
const state = reactive({
  assets: [], // { url, type: 'video' | 'image', loaded, total, done }
  started: false,
  done: false,
})

// The assets the launch overlay actually waits on. With PERF_MODE we block only
// on the "critical" set (the hero image(s) + the FIRST scrub clip, tagged by
// AppLoader) and let the rest keep downloading in the background after the
// overlay lifts. Without the flag every asset is critical — the current
// behaviour (overlay holds until everything is buffered).
function gatingAssets() {
  return PERF_MODE ? state.assets.filter((a) => a.critical) : state.assets
}

// Overall progress 0..1 across the assets the overlay is waiting on. Each
// contributes its real byte fraction when the server sends a Content-Length;
// otherwise it counts 0 until it finishes, then 1.
const progress = computed(() => {
  const list = gatingAssets()
  if (!list.length) return state.done ? 1 : 0
  let sum = 0
  for (const a of list) {
    sum += a.total > 0 ? Math.min(a.loaded / a.total, 1) : a.done ? 1 : 0
  }
  return sum / list.length
})

const VIDEO_RE = /\.(mp4|webm|mov|m4v)(\?|#|$)/i
const IMAGE_RE = /\.(jpe?g|png|webp|avif|gif)(\?|#|$)/i

/**
 * Walk an arbitrary Prismic document tree and collect every media URL, keyed by
 * URL → type. Prismic image / link-to-media fields are objects carrying a
 * `.url`; static fields may be bare strings. Returns a Map (dedupes by URL).
 */
export function collectMediaUrls(node, found = new Map(), opts = {}) {
  if (!node) return found

  if (typeof node === 'string') {
    if (VIDEO_RE.test(node)) found.set(node, 'video')
    else if (IMAGE_RE.test(node)) found.set(node, 'image')
    return found
  }

  if (Array.isArray(node)) {
    for (const v of node) collectMediaUrls(v, found, opts)
    return found
  }

  if (typeof node === 'object') {
    if (typeof node.url === 'string') {
      const u = node.url
      if (VIDEO_RE.test(u)) found.set(u, 'video')
      else if (IMAGE_RE.test(u)) found.set(u, 'image')
    }

    // Device-aware video pairing: a slice's primary may carry both a desktop
    // (`video_url`) and a lighter mobile (`video_url_mobile`) clip. Collect only
    // the one THIS device will play, so the loader never downloads both. Mobile
    // falls back to the desktop clip when no mobile encode was uploaded.
    const hasVideoPair = 'video_url' in node || 'video_url_mobile' in node
    const mobileVal = node.video_url_mobile
    const mobileUrl = typeof mobileVal === 'string' ? mobileVal : mobileVal?.url
    const chosenVideo = (MOBILE_VIDEO_ENABLED && opts.mobile && mobileUrl) ? mobileVal : node.video_url

    for (const key in node) {
      if (key === 'url') continue
      if (key === 'video_url' || key === 'video_url_mobile') continue // handled below
      collectMediaUrls(node[key], found, opts)
    }
    if (hasVideoPair) collectMediaUrls(chosenVideo, found, opts)
    return found
  }

  return found
}

/**
 * True once `url` has been registered for full download by the launch overlay.
 * The scrub prefetch queue (utils/scrubVideo.js) checks this so it doesn't fetch
 * a clip the loader is already pulling down in full.
 */
export function isManagedAsset(url) {
  return state.assets.some((a) => a.url === url)
}

/**
 * Register [url, type] entries (e.g. from collectMediaUrls(...).entries()). An
 * optional third tuple element marks an asset non-critical (`false`) so the
 * overlay doesn't wait on it under PERF_MODE; it defaults to critical, which
 * keeps every existing caller (and the flag-off path) behaving as before.
 */
export function registerAssets(entries) {
  for (const [url, type, critical = true] of entries) {
    if (!state.assets.some((a) => a.url === url)) {
      state.assets.push({ url, type, loaded: 0, total: 0, done: false, critical })
    }
  }
}

// Stream the response so progress updates as bytes arrive. Warming the HTTP
// cache here also means the real <video>/<img> elements reuse these bytes.
async function loadViaFetch(a) {
  const res = await fetch(a.url, { mode: 'cors', credentials: 'omit' })
  if (!res.ok || !res.body) throw new Error(`bad response ${res.status}`)

  const total = Number(res.headers.get('content-length')) || 0
  a.total = total

  const reader = res.body.getReader()
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.length
    a.loaded = received
  }

  // No Content-Length (or chunked): count the finished asset as a whole unit.
  if (!total) {
    a.total = 1
    a.loaded = 1
  }
  a.done = true
}

// Fallback when fetch is blocked (CORS / opaque): load through a real element
// and treat "ready" as done. No byte progress, but it still gates completion.
function loadViaElement(a) {
  return new Promise((resolve) => {
    const finish = () => {
      a.total = 1
      a.loaded = 1
      a.done = true
      resolve()
    }
    if (a.type === 'video') {
      const v = document.createElement('video')
      v.muted = true
      v.preload = 'auto'
      v.oncanplaythrough = finish
      v.onloadeddata = finish
      v.onerror = finish
      v.src = a.url
      try { v.load() } catch { /* ignore */ }
    } else {
      const img = new Image()
      img.onload = finish
      img.onerror = finish
      img.src = a.url
    }
  })
}

async function loadOne(a) {
  try {
    await loadViaFetch(a)
  } catch {
    await loadViaElement(a)
  }
}

/**
 * Begin downloading every registered asset in full. Resolves once the gating set
 * is ready: without PERF_MODE that's every asset (there's no time cap, so the
 * overlay holds until all media is buffered — the original behaviour); with it,
 * only the critical set, while the remaining clips keep downloading in the
 * background and warm the cache their <video> elements later reuse. Idempotent.
 */
export async function startLoading() {
  if (state.started) return
  state.started = true

  // Kick every registered asset now (so the background clips warm too), tracking
  // each job so the overlay can await just the gating subset.
  const jobs = new Map(state.assets.map((a) => [a, loadOne(a)]))
  await Promise.all(gatingAssets().map((a) => jobs.get(a)))
  state.done = true
  // Let the non-critical jobs finish on their own; swallow any late error so
  // nothing rejects after the overlay is gone.
  Promise.all([...jobs.values()]).catch(() => {})
}

export function useAssetLoader() {
  return { progress, state: readonly(state) }
}
