import { isManagedAsset, MEDIA_FETCH_INIT, observedThroughputMbps } from '../composables/useAssetLoader'

const queue = []
const seen = new Set()
let started = false
let draining = false
let pageLoaded = false

export function prefetchScrubVideo(url) {
  if (!url || typeof window === 'undefined' || seen.has(url)) return
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
    drain()
  }
}

async function drain() {
  if (draining) return
  draining = true
  while (queue.length) {
    const url = queue.shift()
    if (isManagedAsset(url)) continue
    try {
      const res = await fetch(url, { ...MEDIA_FETCH_INIT, priority: 'low' })
      if (res.body) {
        const reader = res.body.getReader()
        for (;;) { const { done } = await reader.read(); if (done) break }
      } else {
        await res.arrayBuffer()
      }
    } catch {}
  }
  draining = false
}

export function kickScrubVideo(video) {
  if (!video) return
  video.muted = true
  if (video.readyState === 0 && video.networkState !== 2) {
    try { video.load() } catch {}
  }
  const p = video.play()
  if (p && p.then) p.then(() => video.pause()).catch(() => {})
}

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

export async function primeScrubVideo(video) {
  if (!video) return
  kickScrubVideo(video)
  await whenDurationKnown(video)
  try { video.pause(); video.currentTime = 0 } catch {}
}

const SEEK_STALL_MS = 250
const FAST_SEEK_GAP = 0.5

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

const LEAD_CAP = 700
const LEAD_TIER = { slow: 3, moderate: 2, fast: 1 }

function connectionTier() {
  const measured = observedThroughputMbps()
  if (measured > 0) {
    if (measured < 2) return 'slow'
    if (measured < 6) return 'moderate'
    return 'fast'
  }
  const type = typeof navigator !== 'undefined' ? navigator.connection?.effectiveType : null
  if (type === '2g' || type === 'slow-2g') return 'slow'
  if (type === '3g') return 'moderate'
  return 'fast'
}

export function scrubLeadMargin(base) {
  if (typeof navigator !== 'undefined' && navigator.connection?.saveData) return `${base}%`
  return `${Math.min(base * LEAD_TIER[connectionTier()], LEAD_CAP)}%`
}
