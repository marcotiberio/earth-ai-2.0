import { ref, unref, nextTick, onMounted, onUnmounted } from 'vue'

/**
 * Shared pinned-scrub progress driver for the chart/metric slices (SupplyGap,
 * RaceBars, DrilledStats, MapTargets). Each of those sections is a tall block
 * whose inner panel sticks while a linear 0→1 `progress` is scrubbed across the
 * pinned travel; that progress then drives the slice's own reveal (bars, curves,
 * count-ups, marker fades). The GSAP wiring, the reduced-motion fallback and the
 * coarse-pointer handling were identical across all four, so they live here.
 *
 * Returns:
 *   progress — ref 0→1, updated on every scroll tick (1 under reduced motion).
 *   tall     — ref, true so SSR/first paint render the tall pinned layout; set
 *              false under reduced motion so the section collapses to normal
 *              height and shows the finished state.
 *   coarse   — ref, true on coarse pointers (touch). Set in onMounted, so it's
 *              false during SSR/first paint; templates can read it reactively
 *              for length/dwell multipliers.
 *
 * Options:
 *   start         — ScrollTrigger start (default 'top top').
 *   end           — ScrollTrigger end. A function (trigger, coarse) => string |
 *                   number is re-evaluated on every refresh (use this for
 *                   `+=`/viewport-relative offsets that depend on element or
 *                   window size); a plain string is passed through.
 *   scrub         — number, or { fine, coarse } picked by pointer type.
 *   waitForLayout — await nextTick before building the trigger, so a coarse
 *                   length multiplier has reached the section height before
 *                   ScrollTrigger measures it.
 *   onUpdate(p)   — called after `progress` is set each tick (e.g. to scrub a
 *                   video's currentTime off the same source).
 *   onReady(coarse) — called once in onMounted, in BOTH the normal and
 *                   reduced-motion paths, before the trigger is built (e.g. to
 *                   kick a clip's lazy load regardless of motion preference).
 */
export function useScrollProgress(triggerRef, options = {}) {
  const progress = ref(0)
  const tall     = ref(true)
  const coarse   = ref(false)

  const resolveScrub = () =>
    typeof options.scrub === 'object'
      ? (coarse.value ? options.scrub.coarse : options.scrub.fine)
      : options.scrub

  let ctx = null

  onMounted(async () => {
    coarse.value = window.matchMedia('(pointer: coarse)').matches
    options.onReady?.(coarse.value)

    // Reduced motion: collapse the scroll distance and show the finished state.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      tall.value = false
      progress.value = 1
      options.onUpdate?.(1)
      return
    }

    const trigger = unref(triggerRef)
    if (!trigger) return

    // Let a coarse length multiplier reach the section's height before the
    // trigger measures it.
    if (options.waitForLayout) await nextTick()

    const { gsap }              = await import('gsap')
    const { ScrollTrigger: ST } = await import('gsap/ScrollTrigger')
    gsap.registerPlugin(ST)

    ctx = gsap.context(() => {
      const state = { p: 0 }
      gsap.to(state, {
        p: 1,
        // Linear scroll→progress mapping; any per-segment easing is the slice's
        // own job, so a curve here would skew it.
        ease: 'none',
        scrollTrigger: {
          trigger,
          start: options.start || 'top top',
          end: typeof options.end === 'function'
            ? () => options.end(trigger, coarse.value)
            : options.end,
          scrub: resolveScrub(),
        },
        onUpdate: () => {
          progress.value = state.p
          options.onUpdate?.(state.p)
        },
      })
    }, trigger)
  })

  onUnmounted(() => ctx?.revert())

  return { progress, tall, coarse }
}
