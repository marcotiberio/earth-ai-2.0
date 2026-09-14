import { reactive, computed, readonly } from 'vue'

const state = reactive({
  assets: [],
  started: false,
  done: false,
})

let launchClaimed = false
let releaseLaunch = null
const launchSettled = new Promise((resolve) => { releaseLaunch = resolve })

export function claimLaunch() {
  launchClaimed = true
}

export function whenLaunchSettled() {
  if (!launchClaimed || state.done) return Promise.resolve()
  return Promise.race([
    launchSettled,
    new Promise((resolve) => setTimeout(resolve, 30000)),
  ])
}

function gatingAssets() {
  return PERF_MODE ? state.assets.filter((a) => a.critical) : state.assets
}

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

    const hasVideoPair = 'video_url' in node || 'video_url_mobile' in node
    const mobileVal = node.video_url_mobile
    const mobileUrl = typeof mobileVal === 'string' ? mobileVal : mobileVal?.url
    const chosenVideo = (MOBILE_VIDEO_ENABLED && opts.mobile && mobileUrl) ? mobileVal : node.video_url

    for (const key in node) {
      if (key === 'url') continue
      if (key === 'video_url' || key === 'video_url_mobile') continue
      collectMediaUrls(node[key], found, opts)
    }
    if (hasVideoPair) collectMediaUrls(chosenVideo, found, opts)
    return found
  }

  return found
}

export function isManagedAsset(url) {
  return state.assets.some((a) => a.url === url && a.fetching)
}

export function registerAssets(entries) {
  for (const [url, type, critical = true] of entries) {
    if (!state.assets.some((a) => a.url === url)) {
      state.assets.push({ url, type, loaded: 0, total: 0, done: false, critical, fetching: false })
    }
  }
}

export const MEDIA_FETCH_INIT = {
  mode: 'cors',
  credentials: 'omit',
  headers: { Range: 'bytes=0-' },
}

let observedMbps = 0

function recordThroughput(bytes, ms) {
  if (bytes < 512 * 1024 || ms < 200) return
  const mbps = (bytes * 8) / (ms / 1000) / 1e6
  observedMbps = Math.max(observedMbps, mbps)
}

export function observedThroughputMbps() {
  return observedMbps
}

async function loadViaFetch(a) {
  const res = await fetch(a.url, MEDIA_FETCH_INIT)
  if (!res.ok || !res.body) throw new Error(`bad response ${res.status}`)

  const total = Number(res.headers.get('content-length')) || 0
  a.total = total

  const startedAt = performance.now()
  const reader = res.body.getReader()
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.length
    a.loaded = received
  }
  recordThroughput(received, performance.now() - startedAt)

  if (!total) {
    a.total = 1
    a.loaded = 1
  }
  a.done = true
}

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
      v.crossOrigin = 'anonymous'
      v.oncanplaythrough = finish
      v.onloadeddata = finish
      v.onerror = finish
      v.src = a.url
      try { v.load() } catch {}
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

export async function startLoading() {
  if (state.started) return
  state.started = true

  await Promise.all(gatingAssets().map(loadOne))
  state.done = true
  releaseLaunch()
}

export function useAssetLoader() {
  return { progress, state: readonly(state) }
}
