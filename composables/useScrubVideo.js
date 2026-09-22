import { onMounted, onUnmounted, unref } from 'vue'
import { createSeeker } from '../utils/scrubVideo'

const isSeekScrubEngine = () => {
  const ua = navigator.userAgent
  const iOS = /iP(hone|ad|od)/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const macSafari = /Safari\//.test(ua) && !/Chrom(e|ium)|Edg\/|OPR\//.test(ua)
  return iOS || macSafari
}

export const SCRUB_PRESETS = {
  top:    { start: 'top top',    end: 'bottom top' },
  middle: { start: 'top center', end: 'bottom center' },
}

export function useScrubVideo(videoRef, triggerRef, options = {}) {
  let ctx = null
  let rafId = 0
  let disposed = false

  const preset = SCRUB_PRESETS[options.startAt] || {}
  const start  = options.start || preset.start || 'top bottom'
  const end    = options.end   || preset.end   || 'bottom top'

  onMounted(async () => {
    const video   = unref(videoRef)
    const trigger = unref(triggerRef)
    if (!video || !trigger) return

    const { gsap }              = await import('gsap')
    const { ScrollTrigger: ST } = await import('gsap/ScrollTrigger')
    gsap.registerPlugin(ST)

    await options.ready
    if (disposed) return

    let targetProgress = 0
    ctx = gsap.context(() => {
      ST.create({
        trigger,
        start,
        end,
        onUpdate: (self) => { targetProgress = self.progress },
      })
    }, trigger)

    const DEADBAND  = 0.05
    const MAX_RATE  = options.maxRate  ?? 8
    const RATE_GAIN = options.rateGain ?? 4
    const BUF_MARGIN = 0.15

    const seekScrub = isSeekScrubEngine()
    const seekToward = createSeeker(video)

    const bufferedEndAt = (t) => {
      const b = video.buffered
      for (let i = 0; i < b.length; i++) {
        if (b.start(i) - 0.1 <= t && t <= b.end(i)) return b.end(i)
      }
      return -1
    }

    const loop = () => {
      rafId = requestAnimationFrame(loop)
      const dur = video.duration
      if (!Number.isFinite(dur) || dur <= 0) return
      let target = targetProgress * dur
      const limit = bufferedEndAt(video.currentTime)
      if (limit >= 0) target = Math.min(target, Math.max(0, limit - BUF_MARGIN))
      const diff   = target - video.currentTime
      if (Math.abs(diff) <= DEADBAND) {
        if (!video.paused) video.pause()
      } else if (seekScrub || diff < 0) {
        if (!video.paused) video.pause()
        video.playbackRate = 1
        seekToward(target)
      } else {
        if (video.paused) video.play().catch(() => {})
        video.playbackRate = Math.min(MAX_RATE, Math.max(1, diff * RATE_GAIN))
      }
    }
    rafId = requestAnimationFrame(loop)
  })

  onUnmounted(() => {
    disposed = true
    if (rafId) cancelAnimationFrame(rafId)
    ctx?.revert()
  })
}

export const useScrubVideoTop = (videoRef, triggerRef, options = {}) =>
  useScrubVideo(videoRef, triggerRef, { ...options, startAt: 'top' })

export const useScrubVideoMiddle = (videoRef, triggerRef, options = {}) =>
  useScrubVideo(videoRef, triggerRef, { ...options, startAt: 'middle' })
