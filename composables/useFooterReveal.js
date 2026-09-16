import { computed, onBeforeUnmount, onMounted, ref, unref } from 'vue'

const NIGHT_RANGE = [0.02, 0.55]
const SEAM_RANGE  = [0, 0.12]
const IN_RANGE    = [0.18, 0.70]
const LIFT_RANGE  = [0.05, 0.95]
const LIFT_VH     = 12

const COPY_RANGE = [0, 0.28]

const ramp = (p, [a, b]) => {
  const t = Math.min(Math.max((p - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

const subscribers = new Set()
let contentEl = null
let teardown = null
let progress = 0
let engaged = false

function measure() {
  if (!contentEl || !contentEl.isConnected) contentEl = document.getElementById('page-content')
  if (!contentEl) return
  const vh = window.innerHeight || 1
  engaged = contentEl.offsetHeight >= vh
  const seam = contentEl.getBoundingClientRect().bottom
  progress = engaged ? Math.min(Math.max(1 - seam / vh, 0), 1) : 0
  subscribers.forEach((notify) => notify())
}

function subscribe(notify, lenis) {
  subscribers.add(notify)
  if (subscribers.size === 1) {
    if (lenis) lenis.on('scroll', measure)
    else window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    teardown = () => {
      if (lenis) lenis.off('scroll', measure)
      else window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }
  measure()
  return () => {
    subscribers.delete(notify)
    if (!subscribers.size) {
      teardown?.()
      teardown = null
    }
  }
}

export function useFooterReveal() {
  const { $lenis } = useNuxtApp()

  const progressRef = ref(0)
  const animate = ref(false)

  let unsubscribe = null

  onMounted(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    unsubscribe = subscribe(() => {
      animate.value = engaged
      progressRef.value = progress
    }, $lenis)
  })

  onBeforeUnmount(() => unsubscribe?.())

  return {
    progress: progressRef,
    footerOpacity: computed(() => (animate.value ? ramp(progressRef.value, IN_RANGE) : 1)),
    footerLift:    computed(() => (animate.value ? (1 - ramp(progressRef.value, LIFT_RANGE)) * LIFT_VH : 0)),
    nightfall:     computed(() => (animate.value ? ramp(progressRef.value, NIGHT_RANGE) : 0)),
    seamShade:     computed(() => (animate.value ? ramp(progressRef.value, SEAM_RANGE) : 0)),
  }
}

export function useFooterRevealCopy(elRef) {
  const { $lenis } = useNuxtApp()

  const progressRef = ref(0)
  const animate = ref(false)

  let unsubscribe = null

  onMounted(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const content = document.getElementById('page-content')
    const el = unref(elRef)
    if (!content || !el) return
    const gap = content.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom
    if (Math.abs(gap) > 2) return

    unsubscribe = subscribe(() => {
      animate.value = engaged
      progressRef.value = progress
    }, $lenis)
  })

  onBeforeUnmount(() => unsubscribe?.())

  return computed(() => (animate.value ? 1 - ramp(progressRef.value, COPY_RANGE) : 1))
}
