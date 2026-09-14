import { onBeforeUnmount, onMounted, unref } from 'vue'

/**
 * Smooth a *mouse wheel* through one section while leaving trackpads native.
 *
 * With Lenis off, a mouse wheel moves the page in ~100px notches, so a scrub
 * scene's video lurches from frame to frame. A trackpad already delivers a
 * continuous stream of small deltas (plus the OS's momentum tail), so it scrubs
 * fluidly and must not be touched — easing it again would feel laggy. This
 * tells the two apart per wheel event and, only for the mouse and only while the
 * section is on screen, takes over the scroll: each notch pushes a target and a
 * frame-rate independent lerp eases the real scroll position toward it.
 *
 * The scroll stays native (window.scrollTo), so sticky pins, ScrollTrigger and
 * the scrollbar all keep working. Anything else that moves the page — a
 * trackpad, keys, the scrollbar, an anchor — cancels the ease and wins.
 *
 * Args:
 *   target  — ref or getter resolving to the section element.
 * Options:
 *   lerp    — share of the remaining distance covered per 60fps frame (0.1,
 *             matching the site's Lenis config).
 *   speed   — multiplier on each notch's scroll distance (1 = native).
 */

// Firefox reports mouse notches in lines (deltaMode 1); Lenis' conversion.
const LINE_HEIGHT = 100 / 3

// Wheel events closer together than this belong to the same gesture. Used to
// keep a trackpad swipe (and its momentum tail) classified as trackpad even if
// one of its events happens to look like a notch.
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

  // Heuristic, per event:
  //  - line/page deltas only come from wheels (Firefox).
  //  - any horizontal component means a 2D surface.
  //  - fractional pixel deltas come from precision touchpads.
  //  - Chromium/WebKit report a trackpad's legacy wheelDeltaY as exactly
  //    -3 × deltaY; a mouse notch reports ±120 against a ±100-ish deltaY.
  //  - otherwise (no legacy field) a notch is a big integer step.
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
    // Someone else moved the page since our last write — hand it over.
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
    if (e.defaultPrevented || e.ctrlKey || e.shiftKey) return // pinch-zoom / sideways
    // Launch overlay still holds the page (AppLoader locks <html> overflow).
    if (document.documentElement.style.overflow === 'hidden') return

    if (!isMouseWheel(e)) { cancel(); return }

    // Only while the section is on screen; once an ease is running, keep
    // feeding it so a notch that carries past the section doesn't turn jerky.
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

  // Read during setup: useNuxtApp is only resolvable while the instance is on
  // the stack.
  const { $lenis } = useNuxtApp()

  onMounted(() => {
    // Lenis (when enabled) already smooths every wheel; don't fight it.
    if ($lenis) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Wait for the launch overlay so its scroll lock stays authoritative.
    whenLaunchSettled().then(() => {
      if (stopped) return
      // Non-passive: preventDefault is how the mouse notch is taken over.
      window.addEventListener('wheel', onWheel, { passive: false })
    })
  })

  onBeforeUnmount(() => {
    stopped = true
    cancel()
    window.removeEventListener('wheel', onWheel)
  })
}
