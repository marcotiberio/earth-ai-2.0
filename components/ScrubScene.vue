<template>
  <!-- Pinned scroll-scrub scene (mirrors earth-ai.com):
       a tall section holds a sticky, full-viewport video that stays pinned to
       the top as the background while the content slot scrolls up over it. The
       video's currentTime is scrubbed across the pinned scroll distance. When
       the section ends, the sticky releases and the next section enters. -->
  <!-- The editor's scroll_length is the desktop intent. On phones the pinned
       travel is capped (CSS min(), so SSR markup is already correct): very
       long pins train hard repeated flicking whose momentum then dumps into
       whatever follows the section, and they make the scrub feel sluggish.
       The tail dwell stays OUTSIDE the cap — min(length, 400dvh + tail) ==
       min(base, 400dvh) + tail when callers pass scrollLength = base + tail —
       otherwise capped sections would carve the dwell out of the scrub travel
       (finishing the video a full tail early) instead of appending it. -->
  <section
    ref="rootRef"
    class="relative w-full bg-darkblue h-[min(var(--scrub-length),calc(400dvh+var(--scrub-tail)))] md:h-[var(--scrub-length)]"
    :style="{ '--scrub-length': inSimulator ? '100dvh' : `${scrollLength}dvh`, '--scrub-tail': inSimulator ? '0dvh' : `${tailVh}dvh` }"
  >
    <!-- Pinned stage: video background AND content both pin to the top for the
         whole scrub, then wipe away together when the section ends. In `frame`
         mode the video no longer bleeds to the edges — it sits inset on the
         darkblue background with the content held in a caption band beneath it. -->
    <div
      class="sticky top-0 h-dvh w-full flex flex-col"
      :class="frame ? 'px-xs md:px-sm pt-6 md:pt-8 pb-md' : ''"
    >
      <!-- Media stage. Full-bleed by default; a bordered, inset box when framed. -->
      <div
        class="relative w-full overflow-hidden"
        :class="frame ? 'flex-1 rounded' : 'h-full'"
      >
        <!-- Media matched to the visitor's connection tier (useMediaMode):
             'full' scrubs the clip, 'autoplay' loops a lighter clip, 'static'
             shows the poster only and fetches no video. SSR + first client paint
             are always 'full', so the scrub <video> is what hydrates. -->
        <video
          v-if="videoUrl && mediaMode === 'full'"
          ref="videoRef"
          :src="videoSrc || undefined"
          :poster="posterUrl || undefined"
          muted
          playsinline
          preload="auto"
          class="absolute inset-0 w-full h-full object-cover"
        />
        <video
          v-else-if="videoUrl && mediaMode === 'autoplay'"
          ref="autoplayRef"
          :src="autoplaySrc || undefined"
          :poster="posterUrl || undefined"
          autoplay
          loop
          muted
          playsinline
          preload="auto"
          class="absolute inset-0 w-full h-full object-cover"
        />
        <img
          v-else-if="posterUrl"
          :src="posterUrl"
          :alt="resolveImageAlt(image)"
          class="absolute inset-0 w-full h-full object-cover"
        />
        <div class="absolute inset-0" :class="overlayClass" />

        <!-- Low-bandwidth escape hatch: a visitor served the still image can opt
             into motion (the lighter autoplay clip). Sits above the overlay,
             out of the way of the pinned caption. -->
        <button
          v-if="videoUrl && mediaMode === 'static'"
          type="button"
          class="absolute z-20 bottom-4 right-4 flex items-center gap-2 rounded-full bg-darkblue/70 px-4 py-2 text-beige text-sm backdrop-blur transition hover:bg-darkblue/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-beige"
          @click="setMode('autoplay')"
        >
          <span aria-hidden="true">&#9654;</span> Play motion
        </button>

        <!-- Decorative layers that should stay pinned with the video -->
        <slot name="pinned" />

        <!-- Full-bleed content: overlaid on the video, scrolls in with the
             section then holds at the chosen alignment while the video scrubs. -->
        <div
          v-if="!frame"
          class="absolute inset-0 z-10 flex px-xs md:px-sm"
          :class="[alignClass, alignXClass]"
        >
          <slot />
        </div>
      </div>

      <!-- Framed content: sits in a caption band below the inset media. -->
      <div v-if="frame" class="flex pt-sm" :class="alignXClass">
        <slot />
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  videoUrl:     { type: String, default: '' },
  // Optional lighter, mobile-optimised encode of the same clip. When set, phones
  // load this instead of `videoUrl` (desktop always uses `videoUrl`). Falls back
  // to `videoUrl` when empty, so it's safe to leave unset per section.
  videoUrlMobile: { type: String, default: '' },
  // Optional low-res, linear (autoplay) encode. Served to the 'autoplay' tier —
  // moderate connections — where it loops muted and streams progressively rather
  // than being fully downloaded for scrubbing. Falls back to `videoUrl` when
  // empty, so a section without a dedicated autoplay clip still shows motion.
  videoUrlAutoplay: { type: String, default: '' },
  image:        { type: Object, default: () => ({}) },
  // Total pinned scroll distance in vh. With 200, the video stays pinned for
  // ~one full screen of scroll, over which the content travels in and out.
  scrollLength: { type: Number, default: 200 },
  align:        { type: String, default: 'bottom' }, // 'top' | 'center' | 'bottom'
  alignX:       { type: String, default: 'left' },   // 'left' | 'center' | 'right'
  // Named scrub start preset ('top' | 'middle'). Empty keeps the pinned
  // default below (scrub spans the full sticky travel).
  scrubStart:   { type: String, default: '' },
  // Tail (in vh) at the end of the pinned travel where the video scrub is
  // already complete — it finishes at its natural pace and holds its last frame
  // across this dwell before the section unpins. 0 (default) scrubs the full
  // travel. Only applies to the default (non-`scrubStart`) scrub. Callers
  // grow scrollLength by the same amount (so the dwell is added travel, not a
  // compressed scrub); the height min() above keeps it intact under the
  // mobile cap.
  tailVh:       { type: Number, default: 0 },
  overlayClass: { type: String, default: 'bg-darkblue/40' },
  // Frame mode: render the video inset on the darkblue background (rather than
  // full-bleed) with the content shown in a caption band beneath it.
  frame:        { type: Boolean, default: false },
  // Eager = download on page load (use for the hero). Otherwise the clip is
  // fetched lazily as the section approaches, so we don't pull every video at
  // once on first paint.
  eager:        { type: Boolean, default: false },
})

// True when rendered inside the Slice Simulator (Page Builder sidebar previews
// + "Update screenshot"). There we collapse to a single fixed screen and skip
// the scroll pinning, so the preview shows a composed frame rather than the
// cropped top of a tall pinned section. Provided by pages/slice-simulator.vue.
const inSimulator = inject('inSliceSimulator', false)

const rootRef     = ref(null)
const videoRef    = ref(null)
const autoplayRef = ref(null)

// Connection-matched tier. `mediaMode` is 'full' on the server and first client
// paint (so the scrub <video> hydrates), then re-resolves after mount; `setMode`
// is the "play motion" escalation. Imperative attach logic below reads the
// synchronous resolveMediaMode() so it never acts on the transient 'full'.
const { mode: mediaMode, setMode } = useMediaMode()

const posterUrl = computed(() => props.image?.url || '')

// Poster-first: the src is attached on the client (immediately if eager, else as
// the section nears) so SSR/first paint is just the poster and the device picks
// its own source — phones never start fetching the heavy desktop clip.
const videoSrc    = ref('')
const autoplaySrc = ref('')
let stopObserve = null

// Phones load the lighter mobile encode when one was uploaded; otherwise (and
// always on desktop) the standard clip. Read once from the viewport — `window`
// is present on the client, absent on the server (where onMounted never runs).
const isMobile = typeof window !== 'undefined'
  && window.matchMedia('(max-width: 767px)').matches
const scrubUrl    = () => (MOBILE_VIDEO_ENABLED && isMobile && props.videoUrlMobile) ? props.videoUrlMobile : props.videoUrl
// Autoplay tier prefers the dedicated low-res clip; falls back to the scrub clip
// so a section without an autoplay encode still shows motion (just heavier).
const autoplayUrl = () => props.videoUrlAutoplay || props.videoUrl

// Attach the scrub src and kick its decode. Setting src alone isn't enough —
// load() + a muted inline play() makes the clip buffer and (on iOS) unlock frame
// painting for the scrub; we pause again immediately.
const attachScrubSrc = () => {
  if (videoSrc.value) return
  videoSrc.value = scrubUrl()
  nextTick(() => {
    const v = videoRef.value
    if (!v) return
    v.muted = true
    try { v.load() } catch { /* ignore */ }
    const p = v.play()
    if (p && p.then) p.then(() => v.pause()).catch(() => {})
  })
}

// Attach the autoplay src. The element carries the `autoplay` attribute, but a
// muted inline play() is the reliable cross-browser kick (iOS especially); it
// loops and streams progressively, so no full download or scrub priming.
const attachAutoplaySrc = () => {
  if (autoplaySrc.value) return
  autoplaySrc.value = autoplayUrl()
  nextTick(() => {
    const v = autoplayRef.value
    if (!v) return
    v.muted = true
    const p = v.play?.()
    if (p && p.then) p.catch(() => {})
  })
}

// Vertical resting position while pinned. Bottom anchors the content 5% up
// from the bottom edge (per design), matching the live site's held caption.
const alignClass = computed(() => ({
  top:    'items-start pt-[5vh]',
  center: 'items-center',
  bottom: 'items-end pb-md',
}[props.align] || 'items-end pb-md'))

// Horizontal resting position of the content along the main (row) axis.
const alignXClass = computed(() => ({
  left:   'justify-start text-left',
  center: 'justify-center text-center',
  right:  'justify-end text-right',
}[props.alignX] || 'justify-start text-left'))

onMounted(() => {
  if (!props.videoUrl) return

  // React to the resolved tier — and to a later manual escalation ("play
  // motion"). Each attach is idempotent (guards on its own src), so re-entry is
  // safe. 'static' attaches nothing: no clip is fetched at all.
  watch(mediaMode, (mode) => {
    if (mode === 'full') {
      if (props.eager) { attachScrubSrc(); return }
      // Queue a sequential background warm-up of the clip (starts after window
      // load + idle), so by the time the lazy src attaches it's usually cached.
      prefetchScrubVideo(scrubUrl())
      // Attach ~1.5 screens before the section enters (3 on mobile, where slower
      // networks need a longer head start) so it can buffer for a smooth scrub.
      if (!stopObserve) {
        const margin = isMobile ? '300%' : '150%'
        stopObserve = observeNear(rootRef.value, attachScrubSrc, margin)
      }
    } else if (mode === 'autoplay') {
      if (props.eager) { attachAutoplaySrc(); return }
      // Progressive stream — attach as the section nears; no full-download warm-up.
      if (!stopObserve) {
        const margin = isMobile ? '300%' : '150%'
        stopObserve = observeNear(rootRef.value, attachAutoplaySrc, margin)
      }
    }
    // 'static' → nothing to attach.
  }, { immediate: true })
})

onBeforeUnmount(() => stopObserve?.())

// Pinned scrub: map currentTime 0 → duration across the section's pinned travel
// (top hits viewport top → bottom hits viewport bottom), matching the sticky pin.
// A `scrubStart` preset overrides this with a per-section start ('top'|'middle').
// Only the 'full' tier scrubs — the `enabled` guard bails for autoplay/static.
if (props.videoUrl && !inSimulator) {
  // With a `tailVh`, end the scrub that many vh before the pin releases so the
  // video reaches its last frame at its natural pace, then holds across the
  // dwell. Expressed as a px offset from the start (`+=…`) — a `bottom bottom-=`
  // offset would push the end past the scrollable max and never complete.
  const defaultEnd = props.tailVh > 0
    ? () => `+=${rootRef.value.offsetHeight - window.innerHeight * (1 + props.tailVh / 100)}`
    : 'bottom bottom'
  useScrubVideo(
    videoRef,
    rootRef,
    {
      ...(props.scrubStart
        ? { startAt: props.scrubStart }
        : { start: 'top top', end: defaultEnd }),
      // Only wire the scrub loop for the 'full' tier (resolved synchronously,
      // so it agrees with the template's reactive mediaMode without the race).
      enabled: () => resolveMediaMode().mode === 'full',
    },
  )
}

// Expose the section root so slotted content (e.g. VideoScrollTitles' per-title
// reveal) can anchor its own ScrollTrigger to the same pinned travel.
defineExpose({ root: rootRef })
</script>
