<template>
  <!--
    Pinned horizontal gallery: a section label + headline over a row of cards
    (title, subtitle, and a scroll-scrubbed clip with its image as poster /
    fallback). The section is tall so its inner panel sticks while vertical
    scroll is translated into horizontal travel of the card track. The cards
    hold still for a short lead-in after the pin engages, then the track moves
    until the last card's right edge lands on the gutter, and after a matching
    hold the sticky releases — so the section only scrolls away once the final
    card has been seen. By default the runway is measured from the track itself,
    so a pixel of scroll moves the cards a pixel whatever the card count or
    viewport width. Each card's clip is scrubbed by the same scroll, starting
    once the card is fully in view (see clipWindow). Where one card fills the
    row (below desktop) the track also stops at each card with a clip, holding
    it pinned while the scroll plays the clip through before the next slides
    in (see holdsVh). Under reduced motion (and in the Slice Simulator) the pin
    collapses and the track becomes a native horizontal scroller instead.
  -->
  <section
    ref="rootRef"
    class="relative w-full bg-darkblue text-beige"
    :style="pinned ? { height: `calc(100vh + ${holdTotalVh}vh + ${runway})` } : null"
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
             reads their positions from the track's own left edge. -->
        <ul
          ref="trackRef"
          class="relative flex gap-xs md:gap-sm"
          :class="pinned ? 'h-full will-change-transform' : ''"
          :style="trackStyle"
        >
          <!-- Two cards and one gap fill the row on desktop, one card below it. -->
          <li
            v-for="(card, i) in cards"
            :key="i"
            :ref="(el) => { cardEls[i] = el }"
            class="group flex w-full shrink-0 snap-start flex-col overflow-hidden rounded lg:w-[calc((100%-2.5rem)/2)]"
            :class="pinned ? 'h-full' : ''"
          >
            <div class="bg-beige p-xs md:px-[1.5rem] md:py-[2rem] text-darkblue">
              <h3 class="font-sansLight font-h3">{{ card.title }}</h3>
              <p v-if="card.subtitle" class="mt-3 md:mt-4 font-mono font-light font-caption">
                {{ card.subtitle }}
              </p>
            </div>

            <div
              class="relative overflow-hidden bg-beige/5"
              :class="pinned ? 'min-h-0 flex-1' : 'aspect-[799/556]'"
            >
              <!-- The image doubles as the clip's poster: it shows until the
                   clip has a frame to paint, and stays as the fallback when
                   there's no clip, it fails to load, or under reduced motion
                   (where clips aren't fetched). -->
              <img
                v-if="imageUrl(card)"
                :src="imgixUrl(imageUrl(card), { w: 1200 })"
                :srcset="imgixSrcset(imageUrl(card), [600, 900, 1200, 1600, 2400])"
                sizes="(min-width: 1180px) 50vw, 100vw"
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

// Link-to-Media fields come back as an object ({ url, ... }); static content
// passes a plain string.
const mediaUrl = (field) =>
  typeof field === 'string' ? field : field?.url || ''

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
// section scrolls away (cf. RaceBars' dwellVh). Matches LEAD_VH so the travel
// is framed by equal holds at both ends.
const DWELL_VH = 50

// Where one card fills the row, the pinned scroll each card with a clip holds
// for while the clip plays through (cf. SliderImages' STEP_VH).
const CLIP_HOLD_VH = 70

const rootRef     = ref(null)
const viewportRef = ref(null)
const trackRef    = ref(null)

// How far (px) the track has to move for its last card to sit flush with the
// right gutter. Null until measured on mount; the SSR estimate below stands in
// until then (≈ half a viewport per card beyond the two that fit on desktop),
// keeping the hydration height jump small.
const travel = ref(null)

// True where one card fills the row (below desktop). Set on measure, so SSR
// and first paint assume the desktop layout.
const singleRow = ref(false)

// Each card's left edge and width within the track, and the clip box's width —
// the geometry timeline() and clipWindow() read.
let cardBoxes = []
let boxWidth  = 0

// Editors can override the runway in vh; left empty it tracks `travel` 1:1.
const scrollLength = computed(() => Number(props.slice.primary.scroll_length) || 0)
const runway = computed(() => {
  if (scrollLength.value) return `${scrollLength.value}vh`
  if (travel.value !== null) return `${travel.value}px`
  return `${Math.max(cards.value.length - 2, 0) * 50}vw`
})

// Pinned holds (vh), one per stop of the track. On desktop it stops only at its
// two ends: the lead-in and the dwell. Where one card fills the row it stops at
// every card, and a card with a clip holds for CLIP_HOLD_VH so the scroll can
// play the clip through before the next card slides in; the first and last
// stops keep at least the lead-in and dwell.
const holdsVh = computed(() => {
  if (!singleRow.value) return [LEAD_VH, DWELL_VH]
  const last = cards.value.length - 1
  return cards.value.map((card, i) => {
    let vh = mediaUrl(card.video_url) ? CLIP_HOLD_VH : 0
    if (i === 0) vh = Math.max(vh, LEAD_VH)
    if (i === last) vh = Math.max(vh, DWELL_VH)
    return vh
  })
})
const holdTotalVh = computed(() => holdsVh.value.reduce((sum, vh) => sum + vh, 0))

function measure() {
  const vp    = viewportRef.value
  const track = trackRef.value
  if (!vp || !track?.children.length) return
  cardBoxes = [...track.children].map((el) => ({ left: el.offsetLeft, width: el.offsetWidth }))
  boxWidth  = vp.clientWidth
  singleRow.value = cardBoxes[0].width > boxWidth / 1.5
  const last = cardBoxes[cardBoxes.length - 1]
  travel.value = Math.max(0, last.left + last.width - boxWidth)
}

// Flipped once the section nears the viewport (see observeNear below).
const nearby = ref(false)

// Registered before useScrollProgress so the measured height is in place when
// its trigger (built after a nextTick, see waitForLayout) first measures.
let resizeObserver = null
let stopNearImages = null
onMounted(() => {
  measure()
  // Card widths are viewport-relative, so a resize changes the travel. The
  // height update lands well before ScrollTrigger's own (debounced) resize
  // refresh, which then re-reads the `end` below.
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
// One progress across the whole pin — holds and travel alike — since the clips
// scrub through the holds as well as the travel. `tall` starts true so
// SSR and client render identically; reduced-motion clients drop to a
// normal-height section with a swipeable track.
const { progress, tall } = useScrollProgress(inSimulator ? ref(null) : rootRef, {
  start: 'top top',
  // Expressed as a `+=` px offset from the start (the whole pinned distance)
  // rather than `bottom bottom`, matching the other pinned slices.
  end: (trigger) => `+=${trigger.offsetHeight - window.innerHeight}`,
  scrub: 1,
  waitForLayout: true,
  onUpdate: (p) => syncVideos(p),
})

const pinned = computed(() => tall.value && !inSimulator)

const clamp01 = (x) => Math.min(1, Math.max(0, x))

// The pin's scroll laid out in px as segments: a hold at each stop (the track
// parked at offset t0 === t1) with a slide between consecutive stops (the track
// moving t0 → t1). The total is the trigger's own distance and the slides share
// whatever the holds leave, so the track always lands flush as the last hold
// begins.
function timeline() {
  const vh     = window.innerHeight / 100
  const total  = Math.max((rootRef.value?.offsetHeight || 0) - window.innerHeight, 1)
  const T      = travel.value || 0
  const holds  = holdsVh.value.map((h) => h * vh)
  const stops  = singleRow.value ? cardBoxes.map((box) => Math.min(box.left, T)) : [0, T]
  const holdPx = holds.reduce((sum, h) => sum + h, 0)
  const pxPerT = T ? Math.max(total - holdPx, 0) / T : 0

  const segments = []
  let s = 0
  stops.forEach((t, k) => {
    if (k > 0) {
      const len = (t - stops[k - 1]) * pxPerT
      segments.push({ s0: s, s1: s + len, t0: stops[k - 1], t1: t })
      s += len
    }
    const hold = holds[k] || 0
    segments.push({ s0: s, s1: s + hold, t0: t, t1: t })
    s += hold
  })
  return { segments, total }
}

// Track offset at scroll position s (px into the pin).
function offsetAt(tl, s) {
  for (const g of tl.segments) {
    if (s > g.s1) continue
    return g.t0 === g.t1 ? g.t0 : g.t0 + clamp01((s - g.s0) / (g.s1 - g.s0)) * (g.t1 - g.t0)
  }
  return travel.value || 0
}

// The first (or last) scroll position at which the track sits at offset t — a
// stop's hold spans a range, so a card reaching a stop and leaving it differ.
function scrollAt(tl, t, last) {
  const segments = last ? [...tl.segments].reverse() : tl.segments
  for (const g of segments) {
    if (g.t0 === g.t1) {
      if (Math.abs(t - g.t0) < 1) return last ? g.s1 : g.s0
    } else if (t > g.t0 - 1 && t < g.t1 + 1) {
      return g.s0 + clamp01((t - g.t0) / (g.t1 - g.t0)) * (g.s1 - g.s0)
    }
  }
  return last ? tl.total : 0
}

const trackStyle = computed(() => {
  if (!pinned.value || !travel.value) return null
  const tl = timeline()
  return { transform: `translate3d(${-offsetAt(tl, progress.value * tl.total)}px, 0, 0)` }
})

// --- Card videos -----------------------------------------------------------------

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
// below it) — so the rest wait until the track gets that far. An attached src
// is kept, so scrolling back never re-downloads.
const videoSrcs  = ref([])
const videoReady = ref([])
const videoEls   = []
const cardEls    = []
const cardNear   = []
// Per card, once primed: { video, seek, duration } (see prime()).
const clips = []
let near = false
let reduceMotion = false

function attach(i) {
  const card = cards.value[i]
  if (!card || videoSrcs.value[i]) return
  // Clips aren't scrubbed under reduced motion, so a card with an image keeps
  // it and skips the download; one without still gets its clip's first frame.
  if (reduceMotion && imageUrl(card)) return
  const src = videoSource(card)
  if (!src) return
  videoSrcs.value[i] = src
  // Attaching mounts the <video>, so it primes after the render.
  nextTick(() => prime(i))
}

// Kick the decoder and wait for a real duration (see primeScrubVideo), then
// bind a gated seeker and land on the current scroll position.
async function prime(i) {
  const video = videoEls[i]
  if (!video) return
  await primeScrubVideo(video)
  clips[i] = { video, seek: createSeeker(video), duration: video.duration }
  syncVideos()
}

// The scroll span (px into the pin) over which card i's clip scrubs: from the
// moment the card is fully in view to the moment it starts to slide out, so
// each clip plays through while its whole card is on screen. On desktop the
// first pair is in full view from the start and runs through the lead-in, and
// the last ones run on through the dwell. Where one card fills the row, a card
// is only fully in view while the track holds at its stop, so the window is
// exactly that hold.
function clipWindow(i, tl) {
  const box    = cardBoxes[i]
  const fullAt = Math.max(0, box.left + box.width - boxWidth) // right edge in
  return [scrollAt(tl, fullAt, false), scrollAt(tl, box.left, true)]
}

// Seek every primed clip to its share of the current scroll. Runs on each
// scrub tick (the same smoothed progress that moves the track, so footage and
// cards stay in step); clips parked at either end of their window are skipped
// rather than re-seeked every frame.
function syncVideos(p = progress.value) {
  if (!pinned.value || !cardBoxes.length) return
  const tl = timeline()
  const s  = p * tl.total
  clips.forEach((clip, i) => {
    if (!clip) return
    const [start, end] = clipWindow(i, tl)
    if (end <= start) return
    const target = clamp01((s - start) / (end - start)) * clip.duration
    if (!Number.isFinite(target)) return
    if (!clip.video.seeking && Math.abs(clip.video.currentTime - target) < 0.01) return
    clip.seek(target)
  })
}

let nearObserver = null
let stopNear     = null
onMounted(() => {
  if (!hasVideo || typeof IntersectionObserver === 'undefined') return
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Rooted on the clip box rather than the page: the cards off to the right are
  // clipped by it, so a page-rooted observer would never see them coming. It
  // tracks the track's transform (and the native scroller when unpinned) frame
  // by frame, with no scroll listener of our own.
  const attachNear = () => cards.value.forEach((_, i) => { if (cardNear[i]) attach(i) })
  nearObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const i = cardEls.indexOf(entry.target)
      if (i !== -1) cardNear[i] = entry.isIntersecting
    }
    if (near) attachNear()
  }, { root: viewportRef.value, rootMargin: '0px 100%' })
  cardEls.forEach((el) => el && nearObserver.observe(el))

  // Built after the launch overlay settles, as in ScrubScene: it locks
  // scrolling until then, and a clip pulled during it would only compete with
  // the downloads the overlay is waiting on.
  whenLaunchSettled().then(() => {
    if (!rootRef.value) return // unmounted while the overlay was up
    stopNear = observeNear(rootRef.value, () => {
      near = true
      attachNear()
    }, '100%')
  })
})
onUnmounted(() => {
  nearObserver?.disconnect()
  stopNear?.()
})
</script>
