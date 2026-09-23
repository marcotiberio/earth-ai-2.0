import { ref, unref, nextTick, onMounted, onUnmounted } from 'vue'

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

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      tall.value = false
      progress.value = 1
      options.onUpdate?.(1)
      return
    }

    const trigger = unref(triggerRef)
    if (!trigger) return

    if (options.waitForLayout) await nextTick()

    const { gsap }              = await import('gsap')
    const { ScrollTrigger: ST } = await import('gsap/ScrollTrigger')
    gsap.registerPlugin(ST)

    ctx = gsap.context(() => {
      const state = { p: 0 }
      gsap.to(state, {
        p: 1,
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
