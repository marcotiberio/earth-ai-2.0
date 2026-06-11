/**
 * Delivery helpers for the scroll-scrub videos.
 *
 * pickScrubSource — choose between the h264 clip and its optional HEVC sibling
 * (.scrub.hevc.mp4, hvc1-tagged). Safari/iOS hardware-decodes HEVC at ~40%
 * smaller files, which is exactly where the scrub starved on slow networks.
 * Detection is capability-based (canPlayType), so HEVC-capable Chrome benefits
 * too. Call it client-side only (SSR markup should keep the h264 URL so the
 * hydrated attribute matches; swap in onMounted).
 *
 * prefetchScrubVideo — a sequential warm-up queue. Each scrub section registers
 * its chosen clip URL on mount; after the window has loaded and the main thread
 * is idle, the queue fetches the clips ONE AT A TIME in registration (≈ page)
 * order to warm the HTTP cache. Compared to letting every <video> buffer in
 * parallel, this keeps page-load bandwidth free for the hero and means deeper
 * sections are usually cached before their lazy src even attaches.
 */

let hevcSupport = null

export function pickScrubSource(h264Url, hevcUrl) {
  if (!hevcUrl) return h264Url || ''
  if (typeof document === 'undefined') return h264Url || hevcUrl
  if (hevcSupport === null) {
    const probe = document.createElement('video')
    // Main profile, level 4.0 — covers our 1600×900@30 encodes.
    hevcSupport = probe.canPlayType('video/mp4; codecs="hvc1.1.6.L120.B0"') !== ''
  }
  return hevcSupport ? hevcUrl : (h264Url || hevcUrl)
}

const queue = []
const seen = new Set()
let started = false
let draining = false
let pageLoaded = false

export function prefetchScrubVideo(url) {
  if (!url || typeof window === 'undefined' || seen.has(url)) return
  // Respect an explicit data-saver preference (not exposed on iOS, where it
  // simply stays undefined and we prefetch as usual).
  if (navigator.connection?.saveData) return
  seen.add(url)
  queue.push(url)
  if (!started) {
    started = true
    const begin = () => {
      pageLoaded = true
      const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2000))
      idle(drain)
    }
    if (document.readyState === 'complete') begin()
    else window.addEventListener('load', begin, { once: true })
  } else if (pageLoaded) {
    drain() // late registration (lazy-mounted section) after the first drain
  }
}

async function drain() {
  if (draining) return
  draining = true
  while (queue.length) {
    const url = queue.shift()
    try {
      const res = await fetch(url, { priority: 'low' })
      // Pull the whole body so the response actually lands in the HTTP cache;
      // the <video> element's later range requests are then served from it.
      await res.arrayBuffer()
    } catch { /* network hiccup — the video element will fetch it itself */ }
  }
  draining = false
}
