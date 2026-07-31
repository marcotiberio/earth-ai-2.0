/**
 * Delivery helpers for the scroll-scrub videos.
 *
 * prefetchScrubVideo — a sequential warm-up queue. Each scrub section registers
 * its chosen clip URL on mount; after the window has loaded and the main thread
 * is idle, the queue fetches the clips ONE AT A TIME in registration (≈ page)
 * order to warm the HTTP cache. Compared to letting every <video> buffer in
 * parallel, this keeps page-load bandwidth free for the hero and means deeper
 * sections are usually cached before their lazy src even attaches.
 */

import { isManagedAsset, MEDIA_FETCH_INIT } from '../composables/useAssetLoader'

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
    // The launch overlay's asset loader already downloads every homepage clip in
    // full (composables/useAssetLoader.js). Re-fetching one here is pure
    // duplicate work — and with different request options it can miss that
    // download's cache entry and compete with it for mobile bandwidth. Skip the
    // ones the loader owns; only warm clips it isn't already pulling (e.g. on
    // routes other than the homepage). Checked here at drain time, not on
    // enqueue, so the loader has had time to register its assets first.
    if (isManagedAsset(url)) continue
    try {
      // Reuse the loader's exact request options — including the `Range:
      // bytes=0-` that makes this land in the SAME cache entry the <video>
      // element later reads. Without it the warm-up is worse than useless: the
      // clip is downloaded here and then downloaded a second time by the
      // element (see MEDIA_FETCH_INIT).
      const res = await fetch(url, { ...MEDIA_FETCH_INIT, priority: 'low' })
      // Drain the body so the response lands in the HTTP cache (the <video>'s
      // later range requests are then served from it) without holding the whole
      // clip in memory the way res.arrayBuffer() would.
      if (res.body) {
        const reader = res.body.getReader()
        for (;;) { const { done } = await reader.read(); if (done) break }
      } else {
        await res.arrayBuffer()
      }
    } catch { /* network hiccup — the video element will fetch it itself */ }
  }
  draining = false
}

// --- Playback primitives shared by the scrub consumers -----------------------
// useScrubVideo (the play-chase engine), ScrubScene (lazy-src attach) and
// DrilledStats (in-frame scrub) all need the same low-level pieces; they live
// here so the iOS/decoder workarounds are written and tuned once.

/**
 * Kick the decode pipeline. iOS Safari ignores preload="auto" — it won't fetch
 * the clip (and won't paint seeked frames) until a muted inline play() has run.
 * A muted play() needs no user gesture, so it both starts buffering and unlocks
 * painting; we pause immediately and drive currentTime from scroll instead. Only
 * force load() when the element is idle with nothing buffered (the iOS case) so
 * we don't interrupt / re-fetch an already-loading desktop clip.
 */
export function kickScrubVideo(video) {
  if (!video) return
  video.muted = true // required for an unattended play()
  if (video.readyState === 0 && video.networkState !== 2 /* LOADING */) {
    try { video.load() } catch { /* ignore */ }
  }
  const p = video.play()
  if (p && p.then) p.then(() => video.pause()).catch(() => {})
}

/**
 * Resolve once the clip reports a real, finite duration. No timeout: a lazy clip
 * only gets its src when its section nears the viewport (which can be seconds
 * after mount), so a timeout would fire first and hand back duration 0.
 */
export function whenDurationKnown(video) {
  const hasDuration = () => Number.isFinite(video.duration) && video.duration > 0
  return new Promise((resolve) => {
    if (hasDuration()) return resolve()
    const events = ['loadedmetadata', 'durationchange', 'loadeddata', 'canplay']
    const check = () => {
      if (!hasDuration()) return
      events.forEach((e) => video.removeEventListener(e, check))
      resolve()
    }
    events.forEach((e) => video.addEventListener(e, check))
  })
}

/**
 * Full prime before scroll-driving a clip's currentTime: kick the pipeline, wait
 * for a real duration, then reset to the first frame.
 */
export async function primeScrubVideo(video) {
  if (!video) return
  kickScrubVideo(video)
  await whenDurationKnown(video)
  try { video.pause(); video.currentTime = 0 } catch { /* ignore */ }
}

// Seek-gating: re-issuing currentTime every frame cancels the in-flight seek
// before it can paint, so on mobile almost no frame completes and the scrub
// stutters (worse now the encodes are GOP=5, each seek decoding up to 5 frames
// from a keyframe). Issue a new seek only after the previous one has painted.
// For large gaps (fast flicks) fastSeek trades frame-accuracy for nearest-
// keyframe speed; at GOP=5 that's ≤ 5/fps s off, invisible mid-flick.
const SEEK_STALL_MS = 250 // re-issue if a seek silently never completes
const FAST_SEEK_GAP = 0.5 // s — beyond this, keyframe accuracy is enough

/** Build a gated seek(target) closure bound to one <video> element. */
export function createSeeker(video) {
  let lastSeekAt = 0
  return (target) => {
    const now = performance.now()
    if (video.seeking && now - lastSeekAt <= SEEK_STALL_MS) return
    lastSeekAt = now
    if (typeof video.fastSeek === 'function' &&
        Math.abs(target - video.currentTime) > FAST_SEEK_GAP) {
      video.fastSeek(target)
    } else {
      video.currentTime = target
    }
  }
}

/**
 * Fire `cb` once `el` scrolls within `margin` of the viewport (or immediately
 * when IntersectionObserver is unavailable). Used to defer the network-touching
 * prime/kick until a section is near, instead of pulling every clip at mount.
 * Returns a disconnect fn for cleanup if the element unmounts before it fires.
 */
export function observeNear(el, cb, margin = '200%') {
  if (!el || typeof IntersectionObserver === 'undefined') {
    cb()
    return () => {}
  }
  let io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect()
      io = null
      cb()
    }
  }, { rootMargin: `${margin} 0px ${margin} 0px` })
  io.observe(el)
  return () => io?.disconnect()
}
