import { computed, onBeforeUnmount, onMounted, ref, unref } from 'vue'

/**
 * Progress of the footer's sticky reveal, plus the two opacities that turn it
 * from a hard wipe into a crossfade.
 *
 * The footer is a viewport-high panel pinned behind the page (see AppFooter)
 * and uncovered in place as `#page-content`'s bottom edge — the seam — travels
 * up the viewport. That one edge is the whole measurement:
 *
 *   seam === innerHeight → progress 0 (footer fully covered)
 *   seam === 0           → progress 1 (footer fully uncovered)
 *
 * (AppNav reads the same seam directly for its push-away; it needs the raw px
 * rather than this normalised progress.)
 *
 * Both halves of the crossfade land on the same darkblue, so they read as one
 * dissolve: the outgoing screen is veiled into the page background while the
 * footer's content fades up out of it.
 *
 * Returns:
 *   progress      — ref 0→1 across the reveal (0 until the client measures).
 *   footerOpacity — ref, for the footer's *content* (leave the panel's own
 *                   background opaque, or the reveal band goes translucent).
 *   outgoingVeil  — ref, opacity of app.vue's darkblue veil over the last
 *                   screen of page content.
 */

// Where each half of the crossfade sits on the 0→1 reveal. The ranges overlap:
// the outgoing screen is mostly gone by the time the footer starts coming up,
// but the two are never both at zero, so the handover never shows a dead frame.
const OUT_RANGE = [0.05, 0.55]
const IN_RANGE  = [0.30, 0.85]

// Held copy (headline, section label, caption) in the last section leads the
// dissolve: it clears while the seam is still below it, so the line lifts off
// deliberately instead of being sliced by the rising seam or flatly dimmed
// under the veil. Ends well before OUT_RANGE does, leaving the imagery to
// dissolve on its own.
const COPY_RANGE = [0, 0.28]

// Normalise p into [a, b], then smoothstep it — a linear opacity ramp reads as
// a flat wash; this one eases in and settles at both ends.
const ramp = (p, [a, b]) => {
  const t = Math.min(Math.max((p - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

// --- shared driver ---------------------------------------------------------
// One scroll listener and one layout read per tick however many components are
// watching. This module state is only ever touched on the client (subscriptions
// happen in onMounted), so nothing leaks between SSR requests.
const subscribers = new Set()
let contentEl = null
let teardown = null
let progress = 0
let engaged = false

function measure() {
  if (!contentEl || !contentEl.isConnected) contentEl = document.getElementById('page-content')
  if (!contentEl) return
  const vh = window.innerHeight || 1
  // A page too short to ever cover the footer (a legal page, say) has no reveal
  // to stage: part of the footer is simply visible at rest. Leave it alone.
  engaged = contentEl.offsetHeight >= vh
  const seam = contentEl.getBoundingClientRect().bottom
  progress = engaged ? Math.min(Math.max(1 - seam / vh, 0), 1) : 0
  subscribers.forEach((notify) => notify())
}

function subscribe(notify, lenis) {
  subscribers.add(notify)
  if (subscribers.size === 1) {
    // Lenis owns the scroll position when it's enabled; fall back to native.
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
  // Read on the composable's own line, before any caller's top-level await:
  // `useNuxtApp` needs the Nuxt instance that only holds until the first await.
  const { $lenis } = useNuxtApp()

  const progressRef = ref(0)
  // SSR and first paint render the settled state (footer visible, no veil), so
  // the reveal degrades to the plain wipe if JS never runs. Flips on once the
  // client has measured an actual reveal — and stays off under reduced motion.
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
    outgoingVeil:  computed(() => (animate.value ? ramp(progressRef.value, OUT_RANGE) : 0)),
  }
}

/**
 * Opacity for the copy held over the *last* section before the footer, so it
 * leads the crossfade. Pass the section's root element; every other section
 * gets a flat 1 and never subscribes, so this stays free for the rest of the
 * page.
 *
 * Last-ness is read once on mount: DOM order decides it, and nothing after
 * mount reorders sections. It survives an unsettled layout too — a last
 * section still growing (fonts, images) grows the wrapper with it, so the two
 * bottoms stay level either way, while any earlier section's bottom is a whole
 * pinned travel short of the wrapper's.
 */
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
    if (Math.abs(gap) > 2) return // something follows this section; nothing to do

    unsubscribe = subscribe(() => {
      animate.value = engaged
      progressRef.value = progress
    }, $lenis)
  })

  onBeforeUnmount(() => unsubscribe?.())

  return computed(() => (animate.value ? 1 - ramp(progressRef.value, COPY_RANGE) : 1))
}
