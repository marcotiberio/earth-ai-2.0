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
      class="sticky top-0 h-dvh w-full flex flex-col-reverse gap-8 md:gap-12"
      :class="frame ? 'px-xs md:px-sm pb-6 md:pb-16 pt-md' : ''"
    >
      <!-- Media stage. Full-bleed by default; a bordered, inset box when framed. -->
      <div
        class="relative w-full overflow-hidden"
        :class="frame ? 'flex-1 rounded' : 'h-full'"
      >
        <!-- crossorigin="anonymous" is required for cache reuse, not for
             pixel access. Prismic's CDN answers with `Vary: Origin`; a <video>
             with no crossorigin sends NO Origin header, so it can never match
             the entry the loader's `fetch` (which does send one) just cached,
             and the clip downloads a second time. Measured: 16.2 MB over the
             wire for the 8.1 MB hero until this attribute was added. Safe here
             because the CDN sends `Access-Control-Allow-Origin: *` — on a host
             that doesn't, this attribute would break playback outright. -->
        <video
          v-if="videoUrl"
          ref="videoRef"
          :src="videoSrc || undefined"
          :poster="imgixUrl(activeImage?.url, { w: 1600 }) || undefined"
          muted
          playsinline
          preload="auto"
          crossorigin="anonymous"
          class="absolute inset-0 w-full h-full object-cover"
        />
        <img
          v-else-if="activeImage && activeImage.url"
          :src="imgixUrl(activeImage.url, { w: 1280 })"
          :srcset="imgixSrcset(activeImage.url, [768, 1280, 1920])"
          sizes="100vw"
          :alt="resolveImageAlt(activeImage)"
          class="absolute inset-0 w-full h-full object-cover"
        />
        <div class="absolute inset-0" :class="overlayClass" />

        <!-- Decorative layers that should stay pinned with the video.
             `copyOpacity` is handed down so a caller's own held text (VideoScroll's
             subtitle) can leave with the headline below; the gradients in the same
             slot belong to the imagery and should NOT take it. -->
        <slot name="pinned" :copy-opacity="copyOpacity" />

        <!-- Full-bleed content: overlaid on the video, scrolls in with the
             section then holds at the chosen alignment while the video scrubs.
             The inner column stacks the optional section label above the slot;
             it's `w-full` so slotted content (which is itself `w-full` in every
             caller) resolves its width against the same box as before.
             In the last section before the footer, `copyOpacity` fades the
             held copy out ahead of the reveal crossfade — otherwise it's a
             constant 1 and this is inert (see useFooterRevealCopy). -->
        <div
          v-if="!frame"
          class="absolute inset-0 z-10 flex px-xs md:px-sm"
          :class="[alignClass, alignXClass]"
          :style="{ opacity: copyOpacity }"
        >
          <div class="w-full flex flex-col gap-xs">
            <SectionLabel v-if="sectionLabel" :text="sectionLabel" />
            <slot />
          </div>
        </div>
      </div>

      <!-- Framed content: sits in a caption band below the inset media. Same
           copy, same lead-out. -->
      <div
        v-if="frame"
        class="flex pt-sm lg:max-w-screen-full"
        :class="alignXClass"
        :style="{ opacity: copyOpacity }"
      >
        <div class="w-full flex flex-col gap-xs">
          <SectionLabel v-if="sectionLabel" :text="sectionLabel" />
          <slot />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  videoUrl:     { type: String, default: '' },
  // Optional lighter, mobile-optimised encode of the same clip. When set, phones
  // load this instead of `videoUrl` (desktop always uses `videoUrl`). Falls back
  // to `videoUrl` when empty, so it's safe to leave unset per section.
  videoUrlMobile: { type: String, default: '' },
  image:        { type: Object, default: () => ({}) },
  // Optional alternate crop for phones (same gate as the mobile video). When set,
  // mobile shows this instead of `image`; falls back to `image` when empty.
  imageMobile:  { type: Object, default: () => ({}) },
  // Total pinned scroll distance in vh. With 200, the video stays pinned for
  // ~one full screen of scroll, over which the content travels in and out.
  scrollLength: { type: Number, default: 200 },
  // Small mono eyebrow shown directly above the slotted content ("THE CHALLENGE"
  // in the design). Rendered uppercase, so the editor's casing doesn't matter.
  // Empty renders nothing and leaves the content exactly where it was.
  sectionLabel: { type: String, default: '' },
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

const rootRef  = ref(null)
const videoRef = ref(null)

// Lead-out for the held copy, but only in the last section before the footer:
// there the reveal crossfade is about to wipe this stage away, and the headline
// reads better lifting off first than being dimmed under the veil. A flat 1
// (and no scroll subscription) in every other section.
const copyOpacity = useFooterRevealCopy(rootRef)

// Poster-first: the src is attached on the client (immediately if eager, else as
// the section nears) so SSR/first paint is just the poster and the device picks
// its own source — phones never start fetching the heavy desktop clip.
const videoSrc = ref('')
let stopObserve = null

// Phones load the lighter mobile encode when one was uploaded; otherwise (and
// always on desktop) the standard clip. Read once from the viewport — `window`
// is present on the client, absent on the server (where onMounted never runs).
const isMobile = typeof window !== 'undefined'
  && window.matchMedia('(max-width: 767px)').matches
const sourceUrl = () => (MOBILE_VIDEO_ENABLED && isMobile && props.videoUrlMobile) ? props.videoUrlMobile : props.videoUrl

// Device-appropriate poster / fallback image: phones can show a different crop
// via `imageMobile`; SSR + first paint use `image` so hydration stays stable.
const activeImage = useMobileImage(() => props.image, () => props.imageMobile)

// Attach the device-appropriate src and kick its decode. Setting src alone isn't
// enough — load() + a muted inline play() makes the clip buffer and (on iOS)
// unlock frame painting for the scrub; we pause again immediately.
const attachSrc = () => {
  videoSrc.value = sourceUrl()
  nextTick(() => {
    const v = videoRef.value
    if (!v) return
    v.muted = true
    try { v.load() } catch { /* ignore */ }
    const p = v.play()
    if (p && p.then) p.then(() => v.pause()).catch(() => {})
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
  // Eager (the hero): it's visible the moment the overlay lifts, so attach as
  // soon as the launch loader settles rather than at mount. Attaching at mount
  // races that loader for the same clip and BOTH downloads miss the cache —
  // measured at 2× the hero's bytes. Resolves immediately when no overlay
  // claimed the launch, so a standalone route still attaches at once.
  if (props.eager) { whenLaunchSettled().then(attachSrc); return }
  // Queue a sequential background warm-up of the clip (starts after window
  // load + idle), so by the time the lazy src attaches it's usually cached.
  // Skipped under PERF_MODE: the queue drains the WHOLE page's clips regardless
  // of how far the visitor scrolls, which is most of the CDN bandwidth bill. The
  // observeNear attach below is then the only thing that pulls this clip, so a
  // section nobody reaches costs nothing.
  if (!PERF_MODE) prefetchScrubVideo(sourceUrl())
  // Attach the lazy src ~1.5 screens before the section enters (3 on mobile,
  // where slower networks need a longer head start) so it has time to buffer
  // for a smooth scrub by the time it pins. attachSrc sets the device-appropriate
  // source and kicks the decode; observeNear fires immediately when there's no
  // IntersectionObserver, so the clip still loads without IO support. The margin
  // widens on slow connections, where the default lead isn't enough runway to
  // buffer a 14–27 MB clip before its section pins (see scrubLeadMargin).
  //
  // Built after the launch settles, not at mount, so scrubLeadMargin can use the
  // throughput the loader actually measured instead of guessing. That costs no
  // lead time: the overlay locks scrolling for exactly that window, so no
  // section can be approached before it lifts.
  whenLaunchSettled().then(() => {
    if (!rootRef.value) return // unmounted while the overlay was up
    stopObserve = observeNear(rootRef.value, attachSrc, scrubLeadMargin(isMobile ? 300 : 150))
  })
})

onBeforeUnmount(() => stopObserve?.())

// Pinned scrub: map currentTime 0 → duration across the section's pinned travel
// (top hits viewport top → bottom hits viewport bottom), matching the sticky pin.
// A `scrubStart` preset overrides this with a per-section start ('top'|'middle').
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
    props.scrubStart
      ? { startAt: props.scrubStart }
      : { start: 'top top', end: defaultEnd },
  )
}

// Expose the section root so slotted content (e.g. VideoScrollTitles' per-title
// reveal) can anchor its own ScrollTrigger to the same pinned travel.
defineExpose({ root: rootRef })
</script>
