import { onMounted, onUnmounted, unref } from 'vue'
import { primeScrubVideo, createSeeker, observeNear } from '../utils/scrubVideo'

/**
 * Drive a <video> from scroll position (scroll-scrub), instead of autoplaying
 * it. Pass a ref to the video and a ref to the element that acts as the
 * ScrollTrigger trigger (usually the section root).
 *
 * Uses "play-chase": rather than paused-seeking each frame (which doesn't
 * repaint on Android Chrome — the picture freezes while the timestamp moves),
 * it plays the clip forward toward the scroll target and only seeks for
 * backward motion. On WebKit (iOS browsers, macOS Safari) the trade-off
 * inverts — seeks paint fine but rate-boosted playback judders — so both
 * directions scrub via gated seeks there. See the chase loop for details.
 *
 * Options:
 *   startAt     — named start preset ('top' | 'middle'); see SCRUB_PRESETS.
 *   start / end — explicit ScrollTrigger positions. Override the preset when
 *                 given; otherwise default to the full transit through view.
 *   maxRate     — cap on forward playbackRate while catching up (default 8).
 *   rateGain    — how aggressively playbackRate tracks the gap (default 4).
 *
 * Priming still matters: we wait for the duration and kick the decode pipeline
 * with a muted play()/pause() so the clip buffers and (on iOS) unlocks paint.
 */

// WebKit scrubs by seeking, not play-chase. Safari is the inverse of Android
// Chrome: paused `currentTime` seeks DO repaint reliably, while playback at
// elevated playbackRate (the chase's catch-up mechanism, up to 8×) drops and
// judders frames — so the chase makes Safari look worse than a plain seek
// would. Covers every iOS browser (all WebKit by platform rule; iPadOS
// masquerades as Mac, hence the touch-points check) plus macOS Safari.
const isSeekScrubEngine = () => {
  const ua = navigator.userAgent
  const iOS = /iP(hone|ad|od)/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const macSafari = /Safari\//.test(ua) && !/Chrom(e|ium)|Edg\/|OPR\//.test(ua)
  return iOS || macSafari
}

// Named start/end presets, selectable per section (e.g. via a `scrub_start`
// content field). Both scrub across the section's transit — they differ only
// in where in the viewport the scrub begins and ends.
export const SCRUB_PRESETS = {
  // Scrub begins when the section's top reaches the top of the viewport.
  top:    { start: 'top top',    end: 'bottom top' },
  // Scrub begins when the section's top reaches the centre of the viewport.
  middle: { start: 'top center', end: 'bottom center' },
}

export function useScrubVideo(videoRef, triggerRef, options = {}) {
  let ctx = null
  let rafId = 0
  let stopObserve = null

  // Resolve a named preset into positions. An explicit start/end always wins.
  const preset = SCRUB_PRESETS[options.startAt] || {}
  const start  = options.start || preset.start || 'top bottom'
  const end    = options.end   || preset.end   || 'bottom top'

  onMounted(async () => {
    // `enabled` lets a caller veto scrubbing at mount time — used by ScrubScene
    // so the scroll-scrub loop only wires up for the 'full' media tier. The
    // scrub <video> is briefly rendered on first paint for every visitor (it
    // matches SSR), so an autoplay/static visitor can reach here before the
    // hydration swap removes it; the guard bails cleanly instead of priming a
    // clip that tier will never play. Defaults to enabled (existing callers).
    if (options.enabled && !options.enabled()) return

    const video   = unref(videoRef)
    const trigger = unref(triggerRef)
    if (!video || !trigger) return

    const { gsap }              = await import('gsap')
    const { ScrollTrigger: ST } = await import('gsap/ScrollTrigger')
    gsap.registerPlugin(ST)

    // Don't touch the network until the section is anywhere near the viewport.
    // The prime below forces a full fetch, and running it for every section at
    // mount made all clips download in parallel on page load — starving the
    // hero's scrub on mobile connections. ~2 screens out is still early enough
    // to buffer before the section pins. (ScrubScene lazy-attaches the src with
    // its own observer; this gate covers sections whose src is set at mount.)
    await new Promise((resolve) => { stopObserve = observeNear(trigger, resolve, '200%') })

    // Kick the decode pipeline, wait for a real duration, reset to frame 0. We
    // build the scrub off the clip's duration, so the wait can't be skipped: a
    // lazy scene only gets its src once near the viewport (seconds after mount),
    // so resolving early would build the tween with duration 0 and freeze the
    // section on its first frame. If a clip never loads it simply never wires up
    // (no harm). See primeScrubVideo for the iOS preload/paint workaround.
    await primeScrubVideo(video)

    // "Play-chase" scrub. A paused seek (`video.currentTime = t`) advances the
    // timestamp but does NOT repaint the picture on Android Chrome — the frame
    // freezes while the clip "scrubs" silently. The only thing that reliably
    // repaints there is active playback, so instead of seeking we keep the video
    // PLAYING toward the scroll-derived target: a playing clip paints every
    // frame, making forward scrubbing smooth cross-platform. Reverse playback
    // isn't possible, so scrolling backward falls back to a direct seek.
    let targetProgress = 0
    ctx = gsap.context(() => {
      // Bare ScrollTrigger (no tween): onUpdate hands us the raw scroll
      // progress; the chase loop below turns that into frame delivery. The
      // smoothing comes from the video physically catching up, so no `scrub`.
      ST.create({
        trigger,
        start,
        end,
        onUpdate: (self) => { targetProgress = self.progress },
      })
    }, trigger)

    const DEADBAND  = 0.05                  // s — don't micro-toggle play/pause at the target
    const MAX_RATE  = options.maxRate  ?? 8 // cap playbackRate so fast scrolls stay watchable
    const RATE_GAIN = options.rateGain ?? 4 // how aggressively playbackRate tracks the gap
    const BUF_MARGIN = 0.15                 // s — stay this far inside the buffered range

    // Backward scrubbing (and both directions on WebKit) seeks rather than
    // play-chases. createSeeker gates those seeks so each one paints before the
    // next is issued — see its definition for the GOP/fastSeek reasoning.
    const seekScrub = isSeekScrubEngine()
    const seekToward = createSeeker(video)

    // Furthest playable time contiguous with `t` (-1 when `t` isn't buffered).
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
      // Never chase into an unbuffered region: on a slow network the scrub then
      // lags smoothly behind the scroll and catches up as data arrives, instead
      // of stalling the decoder and freezing the picture.
      const limit = bufferedEndAt(video.currentTime)
      if (limit >= 0) target = Math.min(target, Math.max(0, limit - BUF_MARGIN))
      const diff   = target - video.currentTime
      if (Math.abs(diff) <= DEADBAND) {
        // Arrived → hold this frame.
        if (!video.paused) video.pause()
      } else if (seekScrub || diff < 0) {
        // Backward (can't play in reverse) — or WebKit in either direction,
        // where gated seeks paint better than rate-boosted playback.
        if (!video.paused) video.pause()
        video.playbackRate = 1
        seekToward(target)
      } else {
        // Behind the target → play forward to catch up (repaints every frame).
        if (video.paused) video.play().catch(() => {})
        video.playbackRate = Math.min(MAX_RATE, Math.max(1, diff * RATE_GAIN))
      }
    }
    rafId = requestAnimationFrame(loop)
  })

  onUnmounted(() => {
    if (rafId) cancelAnimationFrame(rafId)
    stopObserve?.()
    ctx?.revert()
  })
}

// Two ready-made instances a section can call directly. Both forward to the
// engine above with a fixed start preset.
export const useScrubVideoTop = (videoRef, triggerRef, options = {}) =>
  useScrubVideo(videoRef, triggerRef, { ...options, startAt: 'top' })

export const useScrubVideoMiddle = (videoRef, triggerRef, options = {}) =>
  useScrubVideo(videoRef, triggerRef, { ...options, startAt: 'middle' })
