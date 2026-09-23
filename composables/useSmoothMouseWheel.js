import { onBeforeUnmount, onMounted, unref } from 'vue'

const LINE_HEIGHT = 100 / 3

const GESTURE_GAP_MS = 150

export function useSmoothMouseWheel(target, options = {}) {
  const LERP = options.lerp ?? 0.1
  const SPEED = options.speed ?? 1

  let rafId = 0
  let current = 0
  let goal = 0
  let lastWritten = 0
  let lastTime = 0
  let lastEventAt = 0
  let lastWasTrackpad = false
  let stopped = false

  const resolveEl = () => (typeof target === 'function' ? target() : unref(target))

  const classifyMouse = (e) => {
    if (e.deltaMode !== 0) return true
    if (e.deltaX !== 0) return false
    if (!Number.isInteger(e.deltaY)) return false
    if (e.wheelDeltaY) return e.wheelDeltaY !== -3 * e.deltaY
    return Math.abs(e.deltaY) >= 50
  }

  const isMouseWheel = (e) => {
    const now = performance.now()
    const sameGesture = now - lastEventAt < GESTURE_GAP_MS
    lastEventAt = now
    const mouse = !(sameGesture && lastWasTrackpad) && classifyMouse(e)
    lastWasTrackpad = !mouse
    return mouse
  }

  const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight

  const cancel = () => {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
  }

  const step = (now) => {
    if (Math.abs(window.scrollY - lastWritten) > 2) { cancel(); return }

    const dt = Math.min((now - lastTime) / (1000 / 60), 4)
    lastTime = now
    current += (goal - current) * (1 - Math.pow(1 - LERP, dt))
    if (Math.abs(goal - current) < 0.5) current = goal

    window.scrollTo({ top: current, behavior: 'instant' })
    lastWritten = window.scrollY

    rafId = current === goal ? 0 : requestAnimationFrame(step)
  }

  const onWheel = (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.shiftKey) return
    if (document.documentElement.style.overflow === 'hidden') return

    if (!isMouseWheel(e)) { cancel(); return }

    if (!rafId) {
      const el = resolveEl()
      if (!el) return
      const r = el.getBoundingClientRect()
      if (r.bottom <= 0 || r.top >= window.innerHeight) return
      current = goal = lastWritten = window.scrollY
    }

    const unit = e.deltaMode === 1 ? LINE_HEIGHT : e.deltaMode === 2 ? window.innerHeight : 1
    e.preventDefault()
    goal = Math.min(Math.max(goal + e.deltaY * unit * SPEED, 0), maxScroll())

    if (!rafId) {
      lastTime = performance.now()
      rafId = requestAnimationFrame(step)
    }
  }

  const { $lenis } = useNuxtApp()

  onMounted(() => {
    if ($lenis) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    whenLaunchSettled().then(() => {
      if (stopped) return
      window.addEventListener('wheel', onWheel, { passive: false })
    })
  })

  onBeforeUnmount(() => {
    stopped = true
    cancel()
    window.removeEventListener('wheel', onWheel)
  })
}
