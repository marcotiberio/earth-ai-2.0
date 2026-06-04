import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Site-wide smooth scrolling (Lenis), driven by GSAP's ticker so it shares a
 * single RAF loop with ScrollTrigger. This keeps the pinned scrub scenes
 * (ScrubScene / useScrubVideo) perfectly in sync — Lenis owns the scroll
 * position, and ScrollTrigger updates from it on every Lenis emit.
 *
 * Lenis smooths the *native* scroll (no transformed wrapper), so `position:
 * sticky`, 100vh sections, anchor links and the real scrollbar all keep
 * working. We disable smoothing under prefers-reduced-motion.
 *
 * The instance is provided as `$lenis` for programmatic scrolling, e.g.
 *   const { $lenis } = useNuxtApp()
 *   $lenis.scrollTo('#section', { offset: -80 })
 */
export default defineNuxtPlugin((nuxtApp) => {
  gsap.registerPlugin(ScrollTrigger)

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const lenis = new Lenis({
    // 0 = no smoothing (honour the accessibility preference); otherwise a calm,
    // weighted feel that suits the long scrub sections.
    lerp: reduceMotion ? 1 : 0.1,
    smoothWheel: !reduceMotion,
  })

  // Keep ScrollTrigger's measurements in step with Lenis.
  lenis.on('scroll', ScrollTrigger.update)

  // Single RAF loop: drive Lenis from GSAP's ticker. GSAP gives time in
  // seconds; Lenis wants milliseconds.
  const raf = (time) => lenis.raf(time * 1000)
  gsap.ticker.add(raf)
  gsap.ticker.lagSmoothing(0)

  // Recalculate on layout shifts (lazy videos, font swaps, route changes).
  ScrollTrigger.addEventListener('refresh', () => lenis.resize())

  nuxtApp.provide('lenis', lenis)

  nuxtApp.hook('app:unmounted', () => {
    gsap.ticker.remove(raf)
    lenis.destroy()
  })
})
