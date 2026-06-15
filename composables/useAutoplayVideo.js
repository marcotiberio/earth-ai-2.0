import { onMounted, onUnmounted, unref } from 'vue'
import { kickScrubVideo, observeNear } from '../utils/scrubVideo'

/**
 * Drive a <video> as a muted, looping, inline autoplay clip that plays only
 * while its section is on screen (and pauses when it leaves view).
 *
 * This is the reliable alternative to useScrubVideo for atmospheric full-bleed
 * footage. Scroll-scrubbing seeks the decoder to arbitrary timestamps every
 * frame — which mobile silicon handles poorly, so it stalls and judders per
 * device (the "video doesn't play at all" / jitter reports). Autoplay only ever
 * decodes FORWARD, the one path every mobile decoder is built for, so it can't
 * stall the way scrubbing does. The trade-off is the footage runs on its own
 * clock instead of the scroll position — use this only where that coupling
 * isn't load-bearing (the content reveals here are driven by their own
 * ScrollTriggers, not by video time, so they're unaffected).
 *
 * Pass a ref to the video and a ref to the section element used to gate
 * playback (usually the section root). Playback is paused while the section is
 * off screen so we never hold several hardware decoders open at once.
 */
export function useAutoplayVideo(videoRef, triggerRef) {
  let stopObserve = null
  let io = null

  onMounted(() => {
    const video   = unref(videoRef)
    const trigger = unref(triggerRef)
    if (!video || !trigger) return

    // Forward-only loop, inline, no sound (a muted clip may autoplay with no
    // user gesture). Set imperatively so it holds even if the element was
    // created without the attributes.
    video.muted = true
    video.loop = true
    video.playsInline = true

    // Honour reduced-motion: hold a still frame rather than looping motion.
    // kickScrubVideo runs a muted play()/pause(), which paints the first frame
    // (and on iOS unlocks painting) without leaving the clip in motion.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      observeNear(trigger, () => kickScrubVideo(video), '200%')
      return
    }

    // Warm the decode pipeline ~2 screens out so the clip is buffered and (on
    // iOS) paint-unlocked by the time the section enters and we play it.
    stopObserve = observeNear(trigger, () => kickScrubVideo(video), '200%')

    // Play while the section is on screen; pause when it leaves. A play()
    // rejection (autoplay blocked) leaves the poster up rather than a black
    // frame — the failure mode is graceful, unlike a stalled scrub.
    io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) video.play().catch(() => {})
        else video.pause()
      }
    }, { threshold: 0 })
    io.observe(trigger)
  })

  onUnmounted(() => {
    stopObserve?.()
    io?.disconnect()
  })
}
