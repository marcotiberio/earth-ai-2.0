<template>
  <!--
    Pinned horizontal gallery: a section label + headline over a row of cards
    (title, subtitle, and a play-once clip with its image as poster / fallback).
    The section is tall so its inner panel sticks while vertical scroll steps
    the card track sideways one card at a time: the track snaps, gliding
    between rest positions where exactly two cards fill the row on desktop (one
    below it) and none peeks in at the edges. The first pair holds for a short
    lead-in after the pin engages, each further card takes one step of scroll,
    and after a matching hold on the last pair the sticky releases — so the
    section only scrolls away once the final card has been seen. Under reduced
    motion (and in the Slice Simulator) the pin collapses and the track becomes
    a native horizontal scroller, snapping to the same positions.
  -->
  <section
    ref="rootRef"
    class="relative w-full bg-darkblue text-beige"
    :style="pinned ? { height: `calc(100vh + ${LEAD_VH}vh + ${runway} + ${DWELL_VH}vh)` } : null"
  >
    <div
      class="boxed flex flex-col gap-sm lg:gap-[4rem]"
      :class="pinned ? 'sticky top-0 h-screen overflow-hidden' : ''"
    >
      <div v-if="sectionLabel || titleHtml" class="flex flex-col gap-xs">
        <SectionLabel v-if="sectionLabel" :text="sectionLabel" />
        <h2
          v-if="titleHtml"
          class="ea-display font-serif font-h2 max-w-screen-lg"
          v-html="titleHtml"
        />
      </div>

      <!-- Clips the track at the gutters rather than letting cards bleed off
           screen: the Figma masks the next card at the right padding edge. -->
      <div
        ref="viewportRef"
        class="min-h-0 flex-1"
        :class="pinned ? 'overflow-hidden' : 'overflow-x-auto snap-x snap-mandatory'"
      >
        <!-- `relative` makes the track the cards' offsetParent, so measure()
             reads their positions from the track's own left edge. The
             transition is the snap: each step glides to its rest position. -->
        <ul
          ref="trackRef"
          class="relative flex gap-xs md:gap-sm"
          :class="pinned ? 'h-full will-change-transform transition-transform duration-[900ms] ease-[cubic-bezier(0.65,0,0.35,1)]' : ''"
          :style="trackStyle"
        >
          <!-- Widths divide the row exactly (two cards and one gap on desktop,
               one card below it), so a rest position never shows a sliver of
               the next card. -->
          <li
            v-for="(card, i) in cards"
            :key="i"
            :ref="(el) => { cardEls[i] = el }"
            class="group flex w-full shrink-0 snap-start flex-col overflow-hidden rounded lg:w-[calc((100%-2.5rem)/2)]"
            :class="pinned ? 'h-full' : ''"
          >
            <div class="bg-beige px-[1.375rem] pt-[1.875rem] pb-[1.5rem] text-darkblue">
              <h3 class="font-sansLight font-h3">{{ card.title }}</h3>
              <p v-if="card.subtitle" class="mt-[1.2em] font-mono font-light font-caption">
                {{ card.subtitle }}
              </p>
            </div>

            <div
              class="relative overflow-hidden bg-beige/5"
              :class="pinned ? 'min-h-0 flex-1' : 'aspect-[799/556]'"
            >
              <!-- Desktop only: the media rests zoomed to 2× anchored top-centre,
                   and eases back to the full frame on hover. The zoom sits on a
                   wrapper so the image and its clip scale together. -->
              <div class="absolute inset-0 lg:origin-top lg:scale-[2] lg:transition-transform lg:duration-700 lg:ease-out lg:group-hover:scale-100 motion-reduce:transition-none">
                <!-- The image doubles as the clip's poster: it shows until the
                     clip has a frame to paint, and stays as the fallback when
                     there's no clip, it fails to load, or under reduced motion
                     (where clips aren't played). `sizes` is 100vw everywhere:
                     a full-width card below desktop, and on desktop a half-width
                     card doubled so the 2× zoom is still sharp. -->
                <img
                  v-if="imageUrl(card)"
                  :src="imgixUrl(imageUrl(card), { w: 1200 })"
                  :srcset="imgixSrcset(imageUrl(card), [600, 900, 1200, 1600, 2400, 3200])"
                  sizes="100vw"
                  :alt="resolveImageAlt(card.image, card.title)"
                  :loading="nearby ? 'eager' : 'lazy'"
                  decoding="async"
                  class="absolute inset-0 h-full w-full object-cover"
                />
                <!-- Client-only: the element exists once its src is attached (see
                     attach()), so SSR and first paint are just the images.
                     crossorigin="anonymous" keeps the request on the same cache
                     key as the launch loader's fetch (see ScrubScene). -->
                <video
                  v-if="videoSrcs[i]"
                  :ref="(el) => { videoEls[i] = el }"
                  :src="videoSrcs[i]"
                  muted
                  playsinline
                  preload="auto"
                  crossorigin="anonymous"
                  aria-hidden="true"
                  class="absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-out motion-reduce:transition-none"
                  :class="videoReady[i] ? 'opacity-100' : 'opacity-0'"
                  @loadeddata="videoReady[i] = true"
                />
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, inject, nextTick, onMounted, onUnmounted } from 'vue'
import { asHTML } from '@prismicio/client'

const props = defineProps({
  slice:   { type: Object, required: true },
  context: { type: Object },
  index:   { type: Number },
  slices:  { type: Array },
})

// --- Content (tolerate both static-string and live Prismic shapes) ----------

// Strip the block wrapper so rich text renders inline inside our <h2>.
const inlineSerializer = { paragraph: ({ children }) => children }
const toHtml = (field) => {
  if (!field) return ''
  return typeof field === 'string'
    ? field
    : asHTML(field, { serializer: inlineSerializer }) || ''
}

// Image fields come back as an object ({ url, alt, ... }); static content may
// pass a plain string url.
const imageUrl = (card) =>
  typeof card.image === 'string' ? card.image : card.image?.url || ''

const titleHtml    = computed(() => toHtml(props.slice.primary.title))
// Small mono eyebrow above the headline (rendered uppercase by SectionLabel).
const sectionLabel = computed(() => props.slice.primary.section_label || '')
const cards        = computed(() => props.slice.primary.cards || [])

// --- Pin + runway --------------------------------------------------------------

// Inside the Page Builder preview a tall pinned section would only show its
// cropped top, so render the collapsed (native scroller) layout instead.
// Provided by pages/slice-simulator.vue.
const inSimulator = inject('inSliceSimulator', false)

// Pinned scroll before the cards start moving, so the headline and the first
// cards settle on screen before the horizontal travel kicks in.
const LEAD_VH = 50

// Pinned scroll held on the last card before the sticky releases, so the end of
// the travel registers (and the scrub's smoothing lag settles) before the
// section scrolls away (cf. RaceBars' dwellVh).
// Matches LEAD_VH so the travel is framed by equal holds at both ends.
const DWELL_VH = 50

const rootRef     = ref(null)
const viewportRef = ref(null)
const trackRef    = ref(null)

// Pinned scroll per card step (as in SliderImages). Each rest position owns the
// step centred on its point in the runway, so the middle ones each hold for
// STEP_VH while the first and last hold for half a step plus the lead / dwell.
const STEP_VH = 70

// `travel`: how far (px) the track moves for its last card to sit flush with
// the right gutter. `stepPx`: one card plus its gap, the distance between rest
// positions. Both measured on mount (and on resize).
const travel = ref(null)
const stepPx = ref(0)

// Steps between the first and last rest positions: cards beyond the two that
// fit on desktop, or beyond the one below it. Until measured, assume desktop.
const steps = computed(() =>
  stepPx.value
    ? Math.round(travel.value / stepPx.value)
    : Math.max(cards.value.length - 2, 0),
)

// Editors can override the runway in vh; left empty it's STEP_VH per step.
const scrollLength = computed(() => Number(props.slice.primary.scroll_length) || 0)
const runway = computed(() => `${scrollLength.value || steps.value * STEP_VH}vh`)

function measure() {
  const vp    = viewportRef.value
  const track = trackRef.value
  const last  = track?.lastElementChild
  if (!vp || !last) return
  travel.value = Math.max(0, last.offsetLeft + last.offsetWidth - vp.clientWidth)
  const [first, second] = track.children
  stepPx.value = second ? second.offsetLeft - first.offsetLeft : 0
}

// Flipped once the section nears the viewport (see observeNear below).
const nearby = ref(false)

// Registered before useScrollProgress so the measured height is in place when
// its trigger (built after a nextTick, see waitForLayout) first measures.
let resizeObserver = null
let stopNearImages = null
onMounted(() => {
  measure()
  // Card widths are viewport-relative, so a resize changes the travel (and
  // crossing the desktop breakpoint the step count). The height update lands
  // well before ScrollTrigger's own (debounced) resize refresh, which then
  // re-reads the `end` below.
  resizeObserver = new ResizeObserver(measure)
  if (viewportRef.value) resizeObserver.observe(viewportRef.value)

  // Cards waiting off to the right sit outside the clipped viewport, so native
  // lazy loading would only fetch each one as it slides in (a visible pop-in).
  // Once the section is within a screen, flip every image to eager instead.
  stopNearImages = observeNear(rootRef.value, () => { nearby.value = true }, '100%')
})
onUnmounted(() => {
  resizeObserver?.disconnect()
  stopNearImages?.()
})

// --- Scroll-driven progress (pinned scrub) -----------------------------------
// `tall` starts true so SSR and client render identically; reduced-motion
// clients drop to a normal-height section with a swipeable track.
const { progress, tall } = useScrollProgress(inSimulator ? ref(null) : rootRef, {
  // Start LEAD_VH after the pin engages (the section top that far above the
  // viewport top; a negative % is a fraction of the viewport height).
  start: `top -${LEAD_VH}%`,
  // Finish the travel DWELL_VH before the pin releases. Expressed as a `+=` px
  // offset from the (lead-shifted) start: a `bottom bottom-=` offset would push
  // the end past the scrollable max and never complete.
  end: (trigger) =>
    `+=${trigger.offsetHeight - window.innerHeight * (1 + (LEAD_VH + DWELL_VH) / 100)}`,
  // Unsmoothed: progress only picks the rest position, and the track's own
  // transition does the easing, so a scrub lag would just delay each snap.
  scrub: true,
  waitForLayout: true,
})

const pinned = computed(() => tall.value && !inSimulator)

// Rest position i sits at progress i / steps; rounding hands over halfway
// between. The last one is clamped to `travel` so it lands flush even if the
// step maths leaves a sub-pixel remainder.
const trackStyle = computed(() => {
  if (!pinned.value || !travel.value || !steps.value) return null
  const index = Math.round(progress.value * steps.value)
  return { transform: `translate3d(${-Math.min(index * stepPx.value, travel.value)}px, 0, 0)` }
})

// --- Card videos -----------------------------------------------------------------

// Link-to-Media fields come back as an object ({ url, ... }); static content
// passes a plain string.
const mediaUrl = (field) =>
  typeof field === 'string' ? field : field?.url || ''

// Phones load the lighter mobile encode when one was uploaded (same gate and
// breakpoint as ScrubScene); otherwise, and always on desktop, the standard
// clip. The field names matter beyond this file: collectMediaUrls pairs
// `video_url` / `video_url_mobile` wherever they sit, so the launch loader
// registers only the clip this device will play. Client-only (reads window).
const videoSource = (card) => {
  const mobile = mediaUrl(card.video_url_mobile)
  return MOBILE_VIDEO_ENABLED && mobile && window.matchMedia('(max-width: 767px)').matches
    ? mobile
    : mediaUrl(card.video_url)
}

const hasVideo = cards.value.some((card) => mediaUrl(card.video_url))

// Clips are only fetched once the section nears the viewport, so a visitor who
// never reaches it downloads none of its footage (see PERF_MODE). From then on
// a card's clip is attached once the card is within the clip box's width of it
// — the cards on screen plus the next screenful (two cards on desktop, one
// below it) — so the rest wait until the track gets that far. An attached src is
// kept, so scrolling back never re-downloads. A clip only plays while its whole
// card is in view.
const videoSrcs  = ref([])
const videoReady = ref([])
const videoEls   = []
const cardEls    = []
const cardNear   = []
const cardFull   = []
let near = false
let reduceMotion = false

// "Fully in view" allows a hair under 1: the track's fractional translate can
// leave a card's edge a sub-pixel short of the clip box even when it's flush.
const FULL_RATIO = 0.99

function attach(i) {
  const card = cards.value[i]
  if (!card || videoSrcs.value[i]) return
  // Clips aren't played under reduced motion, so a card with an image keeps it
  // and skips the download; one without still gets its clip's first frame.
  if (reduceMotion && imageUrl(card)) return
  const src = videoSource(card)
  if (src) videoSrcs.value[i] = src
}

// Clips play once: a card that scrolls out mid-clip resumes where it paused,
// and a finished one holds its last frame. The `ended` guard matters because
// this re-runs whenever any card's visibility changes, and play() on an ended
// clip would restart it from the top.
function syncPlayback() {
  videoEls.forEach((v, i) => {
    if (!v || v.ended) return
    if (cardFull[i] && !reduceMotion) {
      v.muted = true // autoplay policies require it set before play()
      v.play()?.catch(() => {})
    } else if (!v.paused) {
      v.pause()
    }
  })
}

// Attaching mounts the <video>, so playback syncs after the render.
function updateVideos() {
  if (near) cards.value.forEach((_, i) => { if (cardNear[i]) attach(i) })
  nextTick(syncPlayback)
}

// Per-card observers. They track the track's transform (and the native
// scroller when unpinned) frame by frame, with no scroll listener of our own.
const cardObserver = (flags, test, options) =>
  new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const i = cardEls.indexOf(entry.target)
      if (i !== -1) flags[i] = test(entry)
    }
    updateVideos()
  }, options)

let observers = []
let stopNear  = null
onMounted(() => {
  if (!hasVideo || typeof IntersectionObserver === 'undefined') return
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  observers = [
    // Rooted on the clip box rather than the page: the cards off to the right
    // are clipped by it, so a page-rooted observer would never see them coming.
    cardObserver(cardNear, (e) => e.isIntersecting, {
      root: viewportRef.value,
      rootMargin: '0px 100%',
    }),
    // Page-rooted, so the ratio counts both the clip box cutting a card off at
    // the gutters and the page viewport cutting it off before the pin engages.
    cardObserver(cardFull, (e) => e.intersectionRatio >= FULL_RATIO, {
      threshold: [0, FULL_RATIO],
    }),
  ]
  cardEls.forEach((el) => el && observers.forEach((o) => o.observe(el)))

  // Built after the launch overlay settles, as in ScrubScene: it locks
  // scrolling until then, and a clip pulled during it would only compete with
  // the downloads the overlay is waiting on.
  whenLaunchSettled().then(() => {
    if (!rootRef.value) return // unmounted while the overlay was up
    stopNear = observeNear(rootRef.value, () => {
      near = true
      updateVideos()
    }, '100%')
  })
})
onUnmounted(() => {
  observers.forEach((o) => o.disconnect())
  stopNear?.()
})
</script>
