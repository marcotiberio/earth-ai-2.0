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

// --- Launch handshake --------------------------------------------------------
// Aligning cache keys is not enough on its own to stop a clip downloading twice:
// two CONCURRENT requests for the same URL both miss, because the cache entry
// isn't written until the first one finishes. That's what happened with the hero
// — the loader's fetch and the eager <video>'s own request raced, and 16.2 MB
// crossed the wire for an 8.1 MB clip even once both were ranged 206s.
//
// So the eager consumer waits for the loader instead of racing it. This costs
// nothing visually: the overlay covers the viewport for exactly that window, and
// by the time it lifts the bytes are in the cache the element reads.
//
// `claimLaunch` must be called SYNCHRONOUSLY by AppLoader before it awaits the
// Prismic document — the scrub sections mount during that await, and a consumer
// that asks before anything is claimed has to be told "nobody is loading this,
// fetch it yourself" rather than wait forever.
let launchClaimed = false
let releaseLaunch = null
const launchSettled = new Promise((resolve) => { releaseLaunch = resolve })

export function claimLaunch() {
  launchClaimed = true
}

/**
 * Resolves once the launch overlay has finished its gating downloads — or
 * immediately when no overlay claimed the launch (e.g. a route that renders
 * scrub sections without AppLoader), where the caller IS the downloader.
 *
 * The timeout is a safety net, not a schedule: if the overlay were ever wedged
 * (unmounted mid-load, a hung request the fallback didn't catch) an eager hero
 * would otherwise sit on its poster forever. Worst case it costs the duplicate
 * download this handshake exists to prevent, which is the right way to fail.
 */
export function whenLaunchSettled() {
  if (!launchClaimed || state.done) return Promise.resolve()
  return Promise.race([
    launchSettled,
    new Promise((resolve) => setTimeout(resolve, 30000)),
  ])
}

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
 * True once the launch overlay has actually STARTED pulling `url` down in full.
 * The scrub prefetch queue (utils/scrubVideo.js) checks this so it doesn't fetch
 * a clip the loader is already downloading.
 *
 * Registration alone is deliberately not enough: under PERF_MODE the loader
 * registers every homepage asset (so `progress` and the flag-off path still see
 * the whole set) but only fetches the gating ones, leaving the rest to their
 * sections' own proximity-triggered load. Keying off `fetching` rather than mere
 * presence means those deferred clips aren't mistaken for "already handled" and
 * silently dropped by both paths.
 */
export function isManagedAsset(url) {
  return state.assets.some((a) => a.url === url && a.fetching)
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
      state.assets.push({ url, type, loaded: 0, total: 0, done: false, critical, fetching: false })
    }
  }
}

/**
 * Request options for a media warm-up fetch. Shared with the scrub prefetch
 * queue (utils/scrubVideo.js) so the two can't drift and miss each other's cache
 * entry.
 *
 * `Range: bytes=0-` is load-bearing, not decoration. A <video> element ALWAYS
 * range-requests (`Range: bytes=0-` → 206); a plain fetch sends no Range and
 * gets a 200. Chrome files those as two separate cache entries that can never
 * serve each other, so warming a clip with a bare fetch downloaded it twice —
 * once here and again when the element attached. Measured: 16.2 MB over the wire
 * for the 8.1 MB hero. Asking for the whole file AS A RANGE produces the same
 * 206 the element wants, and the element then hits cache with zero requests.
 *
 * Two other conditions have to hold for that reuse, and all three are required —
 * fixing any one alone still downloads twice:
 *   - The element carries `crossorigin="anonymous"`. Prismic sends
 *     `Vary: Origin`, and an element without it sends no Origin header at all,
 *     so it can never match this fetch's cached entry.
 *   - The two requests are SEQUENTIAL, not concurrent (see the launch
 *     handshake above) — a cache entry isn't written until its request finishes.
 *
 * Range is not CORS-safelisted, so this makes the request preflighted. Prismic's
 * CDN answers with `Access-Control-Allow-Headers: range` and a 2h
 * `Access-Control-Max-Age`, so it costs one OPTIONS per origin per 2 hours. If a
 * future host refuses it, the fetch throws and loadOne falls back to
 * loadViaElement — which is itself a <video>, so the bytes still end up in the
 * one cache entry the real element reads.
 */
export const MEDIA_FETCH_INIT = {
  mode: 'cors',
  credentials: 'omit',
  headers: { Range: 'bytes=0-' },
}

// Stream the response so progress updates as bytes arrive. Warming the HTTP
// cache here also means the real <video>/<img> elements reuse these bytes.
async function loadViaFetch(a) {
  // 206 for the ranged video fetches above; images may still answer 200.
  const res = await fetch(a.url, MEDIA_FETCH_INIT)
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
      v.crossOrigin = 'anonymous' // same cache-key reason as the real elements
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
  a.fetching = true
  try {
    await loadViaFetch(a)
  } catch {
    await loadViaElement(a)
  }
}

/**
 * Begin downloading the assets the overlay is waiting on. Resolves once they're
 * ready. Idempotent.
 *
 * Without PERF_MODE that's every registered asset (no time cap — the overlay
 * holds until all homepage media is buffered; the original behaviour).
 *
 * With PERF_MODE we fetch ONLY the gating set. This is the CDN-bandwidth fix:
 * previously every asset was kicked here and the flag changed nothing but when
 * the overlay lifted, so a visitor who bounced at the hero still cost the full
 * ~130 MB of scrub clips. Now the deferred clips are downloaded by their own
 * sections as they approach the viewport (ScrubScene's `observeNear` attaches
 * the src ~1.5 screens out, 3 on mobile), so we only ever pay for footage the
 * visitor actually scrolls to. The scrubber already refuses to seek into an
 * unbuffered region, so a section reached early lags smoothly rather than
 * stalling.
 */
export async function startLoading() {
  if (state.started) return
  state.started = true

  // loadOne never rejects (a failed fetch falls back to element-load, which
  // resolves on error too), so the overlay can't be wedged by a dead asset.
  await Promise.all(gatingAssets().map(loadOne))
  state.done = true
  releaseLaunch() // eager consumers may now attach and read from cache
}

export function useAssetLoader() {
  return { progress, state: readonly(state) }
}
