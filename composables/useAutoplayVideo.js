import { onMounted, onUnmounted, unref } from 'vue'
import { kickScrubVideo, observeNear } from '../utils/scrubVideo'

/**
 * Resolve once the page has loaded AND the main thread has gone idle. Autoplay
 * is deferred behind this so the video decode doesn't compete with the
 * critical-path work performance audits measure: a clip looping during the load
 * window inflates Total Blocking Time (decode on a throttled CPU), Speed Index
 * (the frame never settles) and can disturb LCP. Holding the poster until idle
 * keeps that window quiet; real users see playback start a beat after load,
 * which is imperceptible. Resolved once and shared across every section.
 */
let readyPromise = null
function whenReadyToPlay() {
  if (readyPromise) return readyPromise
  readyPromise = new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve()
    const idle = () => (window.requestIdleCallback || ((fn) => setTimeout(fn, 200)))(resolve)
    if (document.readyState === 'complete') idle()
    else window.addEventListener('load', idle, { once: true })
  })
  return readyPromise
}

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
    // A forward loop doesn't need the whole file buffered up front — metadata is
    // enough to start — and it keeps the clip off the critical download path.
    video.preload = 'metadata'

    // Honour reduced-motion: hold a still frame rather than looping motion.
    // kickScrubVideo runs a muted play()/pause(), which paints the first frame
    // (and on iOS unlocks painting) without leaving the clip in motion. This is
    // the ONLY place we kick — there's no IntersectionObserver here to race it.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      stopObserve = observeNear(trigger, () => kickScrubVideo(video), '200%')
      return
    }

    // Play only while BOTH the section is on screen AND the page is past its
    // load/idle gate; pause when either fails. The in-view play() is itself the
    // iOS paint-unlock, so we deliberately do NOT kick the clip first: a kick's
    // deferred pause() (from its play().then(pause)) could land on top of this
    // play() and freeze a section that's already visible at load. Tracking
    // visibility lets the ready-gate start a section that was already in view at
    // load (the hero) the moment the page goes idle — otherwise it would sit on
    // its poster forever. A play() rejection (autoplay blocked) leaves the poster
    // up rather than a black frame — a graceful failure.
    let visible = false
    let ready = false
    const maybePlay = () => { if (visible && ready) video.play().catch(() => {}) }

    whenReadyToPlay().then(() => { ready = true; maybePlay() })

    io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        visible = e.isIntersecting
        if (e.isIntersecting) maybePlay()
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
