<template>
  <!-- Pinned full-bleed scroll-scrub video, built on ScrubScene (same scaffolding
       as VideoScroll's "overlay"). Instead of a single headline it overlays a
       repeatable group of h1 titles; as the section scrubs the video down, each
       title brightens in turn from 20% → 100% opacity. -->
  <ScrubScene
    ref="sceneRef"
    :video-url="videoUrl"
    :image="slice.primary.image || {}"
    :scroll-length="scrollLength"
    :tail-vh="titleHtml ? DWELL_VH : 0"
    align="bottom"
    align-x="left"
    overlay-class=""
  >
    <!-- Top and bottom fades so the pinned video feathers into its neighbours. -->
    <template #pinned>
      <div v-if="slice.primary.gradient_top !== false" class="bg-gradient-to-b from-darkblue via-darkblue/20 to-transparent absolute inset-x-0 top-0 h-1/4 pointer-events-none" />
      <div v-if="slice.primary.gradient_bottom !== false" class="bg-gradient-to-t from-darkblue via-darkblue/20 to-transparent absolute inset-x-0 bottom-0 h-1/4 pointer-events-none" />

      <!-- End title: parked one screen below by default, then scrolls up into
           place over the second half as the titles scroll away above it. Its own
           alignment is independent of the bottom-left scrolling titles. -->
      <div
        v-if="titleHtml"
        ref="headingRef"
        class="absolute inset-0 z-20 flex px-xs md:px-sm opacity-0"
        :class="[titleAlignClass, titleAlignXClass]"
      >
        <h2 class="ea-display font-serif text-beige font-h1 w-full md:w-screen-md" v-html="titleHtml" />
      </div>
    </template>

    <!-- Overlaid titles: held bottom-left, brightening in sequence as we scroll. -->
    <div ref="titlesWrapRef" class="flex flex-col">
      <h1
        v-for="(item, i) in titles"
        :key="i"
        :ref="el => { if (el) titleRefs[i] = el }"
        class="ea-display text-beige font-h1 !leading-none"
        :class="inSimulator ? 'opacity-100' : 'opacity-20'"
      >
        {{ item.title }}
      </h1>
    </div>
  </ScrubScene>
</template>

<script setup>
import { ref, computed, inject, onMounted, onBeforeUnmount } from 'vue'
import { asHTML } from '@prismicio/client'

const props = defineProps({
  slice:   { type: Object, required: true },
  context: { type: Object },
  index:   { type: Number },
  slices:  { type: Array },
})

// Inside the Slice Simulator the section collapses to one static screen, so the
// scroll-driven reveal can't run — show every title at full opacity for a clean
// thumbnail instead. ScrubScene reads the same flag for its own layout.
const inSimulator = inject('inSliceSimulator', false)

// Link-to-Media fields come back as an object ({ url, ... }); static content
// passes a plain string.
const mediaUrl = (field) =>
  typeof field === 'string' ? field : field?.url || ''

const videoUrl     = computed(() => mediaUrl(props.slice.primary.video_url))

// The repeatable group of titles. Real Prismic returns it under
// `primary.items` (a Group field); a plain static shape may use top-level `items`.
const titles = computed(() => props.slice.primary.items || props.slice.items || [])

// Once the end title lands we hold it pinned for an extra screen of scroll
// before the section unpins. We grow the section by that much (so there's real
// scroll distance to dwell over) and end the title timeline a screen early, so
// GSAP holds it at its final state across the dwell.
const DWELL_VH = 200
const scrollLength = computed(
  () => (props.slice.primary.scroll_length || 300) + (titleHtml.value ? DWELL_VH : 0),
)

// End title (the WYSIWYG h2 that wipes in over the second half). Rendered as
// inline HTML so paragraph formatting (strong/em) is kept but the <p> wrapper is
// stripped — the heading stays a single h2. Tolerates both the live Prismic
// rich-text shape and a plain static string.
const inlineSerializer = { paragraph: ({ children }) => children }
const titleHtml = computed(() => {
  const field = props.slice.primary.title
  if (!field) return ''
  return typeof field === 'string'
    ? field
    : asHTML(field, { serializer: inlineSerializer }) || ''
})

const titleAlignClass = computed(() => ({
  top:    'items-start pt-[5vh]',
  center: 'items-center',
  bottom: 'items-end pb-md',
}[props.slice.primary.title_align] || 'items-center'))

const titleAlignXClass = computed(() => ({
  left:   'justify-start text-left',
  center: 'justify-center text-center',
  right:  'justify-end text-right',
}[props.slice.primary.title_align_x] || 'justify-center text-center'))

const sceneRef     = ref(null) // ScrubScene instance — exposes its section root
const titlesWrapRef = ref(null) // the scrolling-titles container (scrolled as a unit)
const headingRef   = ref(null) // the end-title overlay element
const titleRefs    = []        // collected per-element via the v-for function ref

let ctx = null

onMounted(() => {
  if (!inSimulator) setupScrub()
})

// Drive two phases off the section's pinned travel:
//   • first half  — brighten each title from 20% → 100% in turn (the existing
//     one-at-a-time reveal), then
//   • second half — once the last title is lit, the titles scroll up and away
//     while the end <h2> scrolls up into place behind them (the video keeps
//     scrubbing throughout, driven independently by ScrubScene).
// When there's no end title we keep the original behaviour: the title reveal
// simply spans the full travel. Anchored to ScrubScene's root — the same
// element driving the video scrub.
async function setupScrub() {
  const els        = titleRefs.filter(Boolean)
  const titlesWrap = titlesWrapRef.value
  const heading    = headingRef.value
  const trigger    = sceneRef.value?.root
  if ((!els.length && !heading) || !trigger) return

  const { gsap }              = await import('gsap')
  const { ScrollTrigger: ST } = await import('gsap/ScrollTrigger')
  gsap.registerPlugin(ST)

  ctx = gsap.context(() => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger,
        start: 'top top',
        // With an end title the section is a dwell-screen taller (see
        // `scrollLength`); end the timeline that much before the pin releases so
        // GSAP holds the finished state — the title stays put — across the dwell.
        // Expressed as a px offset from the start: `bottom bottom-=Xvh` offsets
        // the *viewport* keyword the wrong way and pushes the end past the
        // scrollable max (unreachable), which is what threw the end marker off.
        end: heading
          ? () => `+=${trigger.offsetHeight - window.innerHeight * (1 + DWELL_VH / 100)}`
          : 'bottom bottom',
        scrub: 1,
      },
    })
    // Highlight one title at a time: brighten the first, then crossfade each
    // into the next — the outgoing title dims back to 20% as the new one rises.
    els.forEach((el, i) => {
      if (i === 0) {
        tl.fromTo(el, { opacity: 0.2 }, { opacity: 1, ease: 'none' })
      }
      const next = els[i + 1]
      if (next) {
        tl.to(el, { opacity: 0.2, ease: 'none' })
        tl.fromTo(next, { opacity: 0.2 }, { opacity: 1, ease: 'none' }, '<')
      }
    })

    // Second half: scroll the handoff. We pad it to the title reveal's length so
    // the reveal owns the first half of the scroll and the scroll-out/scroll-in
    // owns the second, the two moving together like a conveyor — titles travel
    // up by a screen and exit the top as the heading rises a screen from below
    // into its resting position.
    if (heading) {
      const firstHalf = tl.duration() || 1
      const screen    = window.innerHeight
      if (titlesWrap) {
        tl.fromTo(
          titlesWrap,
          { y: 0 },
          { y: -screen, ease: 'none', duration: firstHalf },
          firstHalf,
        )
      }
      // Slide the heading up a full screen into place — pixel-based `y`, exactly
      // mirroring the titles above so the motion matches and there's no inline
      // transform for GSAP to misparse. It's hidden by default via the
      // `opacity-0` class (covering the no-JS / simulator state and any
      // pre-scrub flash); GSAP fades it in as it rises.
      tl.fromTo(
        heading,
        { y: screen, opacity: 0 },
        { y: 0, opacity: 1, ease: 'none', duration: firstHalf },
        firstHalf,
      )
    }
  }, trigger)
}

onBeforeUnmount(() => {
  ctx?.revert()
})
</script>
