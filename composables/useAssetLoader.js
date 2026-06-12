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

// Overall progress 0..1 across every registered asset. Each contributes its real
// byte fraction when the server sends a Content-Length; otherwise it counts 0
// until it finishes, then 1.
const progress = computed(() => {
  if (!state.assets.length) return state.done ? 1 : 0
  let sum = 0
  for (const a of state.assets) {
    sum += a.total > 0 ? Math.min(a.loaded / a.total, 1) : a.done ? 1 : 0
  }
  return sum / state.assets.length
})

const VIDEO_RE = /\.(mp4|webm|mov|m4v)(\?|#|$)/i
const IMAGE_RE = /\.(jpe?g|png|webp|avif|gif)(\?|#|$)/i

/**
 * Walk an arbitrary Prismic document tree and collect every media URL, keyed by
 * URL → type. Prismic image / link-to-media fields are objects carrying a
 * `.url`; static fields may be bare strings. Returns a Map (dedupes by URL).
 */
export function collectMediaUrls(node, found = new Map()) {
  if (!node) return found

  if (typeof node === 'string') {
    if (VIDEO_RE.test(node)) found.set(node, 'video')
    else if (IMAGE_RE.test(node)) found.set(node, 'image')
    return found
  }

  if (Array.isArray(node)) {
    for (const v of node) collectMediaUrls(v, found)
    return found
  }

  if (typeof node === 'object') {
    if (typeof node.url === 'string') {
      const u = node.url
      if (VIDEO_RE.test(u)) found.set(u, 'video')
      else if (IMAGE_RE.test(u)) found.set(u, 'image')
    }
    for (const key in node) {
      if (key === 'url') continue
      collectMediaUrls(node[key], found)
    }
    return found
  }

  return found
}

/** Register [url, type] entries (e.g. from collectMediaUrls(...).entries()). */
export function registerAssets(entries) {
  for (const [url, type] of entries) {
    if (!state.assets.some((a) => a.url === url)) {
      state.assets.push({ url, type, loaded: 0, total: 0, done: false })
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
 * Begin downloading every registered asset in full. Resolves only once all are
 * ready — there's no time cap, so the overlay holds until the media is genuinely
 * buffered. Idempotent.
 */
export async function startLoading() {
  if (state.started) return
  state.started = true

  await Promise.all(state.assets.map(loadOne))
  state.done = true
}

export function useAssetLoader() {
  return { progress, state: readonly(state) }
}
