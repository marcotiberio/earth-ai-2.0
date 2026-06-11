import { onMounted, onUnmounted, unref } from 'vue'

/**
 * Drive a <video> from scroll position (scroll-scrub), instead of autoplaying
 * it. Pass a ref to the video and a ref to the element that acts as the
 * ScrollTrigger trigger (usually the section root).
 *
 * Uses "play-chase": rather than paused-seeking each frame (which doesn't
 * repaint on Android Chrome — the picture freezes while the timestamp moves),
 * it plays the clip forward toward the scroll target and only seeks for
 * backward motion. See the chase loop below for the full rationale.
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
  let io = null

  // Resolve a named preset into positions. An explicit start/end always wins.
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

    video.muted = true // required for an unattended play()

    // Don't touch the network until the section is anywhere near the viewport.
    // The kick below forces a full fetch, and running it for every section at
    // mount made all clips download in parallel on page load — starving the
    // hero's scrub on mobile connections. ~2 screens out is still early enough
    // to buffer before the section pins. (ScrubScene lazy-attaches the src with
    // its own observer; this gate covers sections whose src is set at mount.)
    await new Promise((resolve) => {
      if (typeof IntersectionObserver === 'undefined') return resolve()
      io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          io = null
          resolve()
        }
      }, { rootMargin: '200% 0px 200% 0px' })
      io.observe(trigger)
    })

    // Kick the pipeline BEFORE waiting for data. iOS Safari ignores
    // preload="auto" — it won't fetch the clip (and won't paint seeked frames)
    // until a muted inline play() has run. Doing this after the wait deadlocks:
    // the data never arrives, so loadeddata never fires. A muted play() is
    // allowed without a user gesture, so it both starts buffering and unlocks
    // painting; we pause immediately and drive currentTime from scroll instead.
    // Only force a load() when the element is idle with nothing buffered (the
    // iOS case). On desktop it's already NETWORK_LOADING, so we skip it to
    // avoid interrupting / re-fetching.
    if (video.readyState === 0 && video.networkState !== 2 /* LOADING */) {
      try { video.load() } catch { /* ignore */ }
    }
    const kick = video.play()
    if (kick && kick.then) kick.then(() => video.pause()).catch(() => {})

    // Build the scrub off the clip's duration, so wait until the duration is
    // actually known. No timeout: lazy scenes only get their src when the
    // section nears the viewport (which can be many seconds after mount), so a
    // timeout would fire first and build the tween with duration 0 — leaving
    // deep sections frozen on the first frame. Resolve only once duration is
    // real; if a clip never loads, that section simply never wires up (no harm).
    const hasDuration = () => Number.isFinite(video.duration) && video.duration > 0
    await new Promise((resolve) => {
      if (hasDuration()) return resolve()
      const events = ['loadedmetadata', 'durationchange', 'loadeddata', 'canplay']
      const check = () => {
        if (!hasDuration()) return
        events.forEach((e) => video.removeEventListener(e, check))
        resolve()
      }
      events.forEach((e) => video.addEventListener(e, check))
    })

    try {
      video.pause()
      video.currentTime = 0
    } catch { /* ignore */ }

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

    // Backward scrubbing pays the GOP cost: every seek decodes forward from the
    // nearest keyframe (≤ GOP frames with the .scrub encodes). Setting
    // currentTime every rAF cancels the in-flight seek before it can paint, so
    // on mobile almost no frame completes and the reverse scrub stutters.
    // Instead, issue a new seek only after the previous one has painted —
    // frames then arrive at whatever rate the decoder sustains. For large gaps
    // (fast flick upward) fastSeek trades frame-accuracy for nearest-keyframe
    // speed; at GOP=5 that's ≤ 5/fps s off, invisible mid-flick.
    const SEEK_STALL_MS = 250 // re-issue if a seek silently never completes
    const FAST_SEEK_GAP = 0.5 // s — beyond this, keyframe accuracy is enough
    let lastSeekAt = 0

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
      if (diff > DEADBAND) {
        // Behind the target → play forward to catch up (repaints every frame).
        if (video.paused) video.play().catch(() => {})
        video.playbackRate = Math.min(MAX_RATE, Math.max(1, diff * RATE_GAIN))
      } else if (diff < -DEADBAND) {
        // Ahead of the target (scrolled up) → can't play in reverse, so seek.
        if (!video.paused) video.pause()
        video.playbackRate = 1
        const now = performance.now()
        if (!video.seeking || now - lastSeekAt > SEEK_STALL_MS) {
          lastSeekAt = now
          if (typeof video.fastSeek === 'function' && diff < -FAST_SEEK_GAP) {
            video.fastSeek(target)
          } else {
            video.currentTime = target
          }
        }
      } else if (!video.paused) {
        // Arrived → hold this frame.
        video.pause()
      }
    }
    rafId = requestAnimationFrame(loop)
  })

  onUnmounted(() => {
    if (rafId) cancelAnimationFrame(rafId)
    io?.disconnect()
    ctx?.revert()
  })
}

// Two ready-made instances a section can call directly. Both forward to the
// engine above with a fixed start preset.
export const useScrubVideoTop = (videoRef, triggerRef, options = {}) =>
  useScrubVideo(videoRef, triggerRef, { ...options, startAt: 'top' })

export const useScrubVideoMiddle = (videoRef, triggerRef, options = {}) =>
  useScrubVideo(videoRef, triggerRef, { ...options, startAt: 'middle' })
