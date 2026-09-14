<template>
  <!--
    Pinned image slider: a section label (+ optional headline) over one slide's
    media at a time (a video, or the image when there's no clip), a row of
    numbered bars as navigation, and the active slide's title and description.
    The section is tall so its inner panel sticks while the vertical scroll
    steps through the slides: the first slide holds for a short lead-in after
    the pin engages, each further slide takes one step of scroll, and after a
    matching hold on the last slide the sticky releases — so the section only
    scrolls away once the final slide has been seen. Clicking a bar, or a clip
    playing to its end, scrolls the page to that (or the next) slide's point in
    the runway, so scroll and navigation never disagree. Under reduced motion (and in the Slice Simulator)
    the pin collapses and the bars are the only control.
  -->
  <section
    ref="rootRef"
    class="relative w-full bg-darkblue text-beige"
    :style="pinned ? { height: `calc(100vh + ${LEAD_VH}vh + ${runwayVh}vh + ${DWELL_VH}vh)` } : null"
    aria-roledescription="carousel"
    :aria-label="sectionLabel || 'Image slider'"
  >
    <div
      class="boxed flex flex-col"
      :class="pinned ? 'sticky top-0 h-screen overflow-hidden' : ''"
    >
      <div v-if="sectionLabel || titleHtml" class="mb-[1.875rem] flex flex-col gap-xs">
        <SectionLabel v-if="sectionLabel" :text="sectionLabel" />
        <h2
          v-if="titleHtml"
          class="ea-display font-serif font-h2 max-w-screen-lg"
          v-html="titleHtml"
        />
      </div>

      <!-- Every slide's media is stacked in the same box and cross-faded, so the
           images all sit in the viewport together and native lazy loading
           fetches them as a set, before any is needed. A slide's image doubles
           as its video's poster: it shows until the clip has a frame to paint,
           and stays as the fallback when there's no clip, it fails to load, or
           under reduced motion (where clips aren't played). -->
      <div
        class="relative overflow-hidden rounded-t-[5px] bg-beige/5"
        :class="pinned ? 'min-h-0 flex-1' : 'aspect-[4/3] md:aspect-[1639/714]'"
      >
        <div
          v-for="(slide, i) in slides"
          :key="i"
          class="absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none"
          :class="i === activeIndex ? 'opacity-100' : 'opacity-0'"
          :aria-hidden="i === activeIndex ? undefined : 'true'"
        >
          <img
            v-if="imageUrl(slide)"
            :src="imgixUrl(imageUrl(slide), { w: 1600 })"
            :srcset="imgixSrcset(imageUrl(slide), [640, 960, 1280, 1920, 2560, 3200])"
            sizes="(min-width: 780px) calc(100vw - 5rem), calc(100vw - 2rem)"
            :alt="resolveImageAlt(slide.image, slide.title)"
            loading="lazy"
            decoding="async"
            class="absolute inset-0 h-full w-full object-cover"
          />
          <!-- Client-only: the element exists once its src is attached (see
               attach()), so SSR and first paint are just the images.
               crossorigin="anonymous" keeps the request on the same cache key as
               the launch loader's fetch (see ScrubScene). Every clip but the
               last plays once and hands on to the next slide (onClipEnded);
               the last has nowhere to go, so it loops. -->
          <video
            v-if="videoSrcs[i]"
            :ref="(el) => { videoEls[i] = el }"
            :src="videoSrcs[i]"
            muted
            :loop="i === slides.length - 1"
            playsinline
            preload="auto"
            crossorigin="anonymous"
            aria-hidden="true"
            class="absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-out motion-reduce:transition-none"
            :class="videoReady[i] ? 'opacity-100' : 'opacity-0'"
            @loadeddata="videoReady[i] = true"
            @error="videoFailed[i] = true"
            @ended="onClipEnded(i)"
          />
        </div>
      </div>

      <!-- Bars + index. The button's top padding stands in for the gap under
           the image, so the thin bar gets a finger-sized hit area. -->
      <nav v-if="slides.length > 1" aria-label="Slides">
        <ol class="flex gap-[0.75rem] md:gap-[1.45rem]">
          <li v-for="(slide, i) in slides" :key="i" class="min-w-0 flex-1">
            <button
              type="button"
              class="group block w-full pt-xs text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-beige/50"
              :aria-label="slide.title ? `Slide ${i + 1}: ${slide.title}` : `Slide ${i + 1}`"
              :aria-current="i === activeIndex ? 'step' : undefined"
              @click="goTo(i)"
            >
              <!-- Track + fill. The fill slides in from the left (a transform,
                   so it stays on the compositor) and the track's clip rounds
                   its trailing end; see barFill() for how full it is. -->
              <span
                class="relative block h-[4px] overflow-hidden rounded-full transition-colors duration-300 motion-reduce:transition-none"
                :class="i === activeIndex ? 'bg-beige/20' : 'bg-beige/20 group-hover:bg-beige/50'"
              >
                <span
                  class="absolute inset-0 rounded-full bg-beige"
                  :style="{ transform: `translateX(${(barFill(i) - 1) * 100}%)` }"
                />
              </span>
              <span
                class="mt-[0.35rem] block font-mono font-body leading-[1.2] transition-opacity duration-300 motion-reduce:transition-none"
                :class="i === activeIndex ? 'opacity-100' : 'opacity-25 group-hover:opacity-60'"
              >{{ i + 1 }}</span>
            </button>
          </li>
        </ol>
      </nav>

      <!-- All captions share one grid cell so they can cross-fade. Pinned, the
           block is sized to the ACTIVE caption (measured, see captionStyle) and
           eases between heights, so the flex-1 media above takes every pixel a
           shorter description leaves free; the taller captions fading out are
           clipped rather than pushing the panel. Unpinned, the media has a fixed
           aspect and gains nothing, so the block keeps the tallest caption's
           height and the page below never shifts. Hidden captions are `inert` so
           their links drop out of the tab order along with the a11y tree. -->
      <div
        class="mt-xs grid"
        :class="captionStyle ? 'overflow-hidden transition-[height] duration-500 ease-out motion-reduce:transition-none' : ''"
        :style="captionStyle"
      >
        <div
          v-for="(slide, i) in slides"
          :key="i"
          :ref="(el) => { captionEls[i] = el }"
          class="[grid-area:1/1] self-start transition-opacity duration-500 ease-out motion-reduce:transition-none"
          :class="i === activeIndex ? 'opacity-100' : 'pointer-events-none opacity-0'"
          :inert="i !== activeIndex"
        >
          <h3
            v-if="slide.title"
            class="font-serif text-[1.75rem] leading-[1.2] md:text-[2.25rem] xl:text-[2.5rem]"
          >
            {{ slide.title }}
          </h3>
          <!-- Rich text: paragraphs, bullet lists, bold / italic / links.
               Preflight strips list styling, so bullets and block spacing are
               restored here. <strong> steps up to the Regular cut instead of a
               faux bold of the Light; <em> is the site's serif italic accent. -->
          <div
            v-if="descriptionsHtml[i]"
            class="mt-xs max-w-screen-tablet font-sansLight font-body leading-[1.2] lg:mt-[1.625rem] [&>*+*]:mt-[0.6em] [&_ul]:list-disc [&_ul]:pl-[1.1em] [&_li+li]:mt-[0.3em] [&_strong]:font-sans [&_strong]:font-normal [&_em]:font-serifItalic [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-orange"
            v-html="descriptionsHtml[i]"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch, inject, nextTick, onMounted, onUnmounted } from 'vue'
import { asHTML, isFilled } from '@prismicio/client'

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
const imageUrl = (slide) =>
  typeof slide.image === 'string' ? slide.image : slide.image?.url || ''

const titleHtml    = computed(() => toHtml(props.slice.primary.title))
// Small mono eyebrow above the slider (rendered uppercase by SectionLabel).
const sectionLabel = computed(() => props.slice.primary.section_label || '')
const slides       = computed(() => props.slice.primary.slides || [])

// Slide descriptions keep their blocks (paragraphs, lists), unlike the inline
// title above. An emptied field comes back as one blank paragraph, which
// isFilled screens out so no empty block holds the caption's spacing.
const descriptionsHtml = computed(() =>
  slides.value.map(({ description }) => {
    if (typeof description === 'string') return description
    return isFilled.richText(description) ? asHTML(description) : ''
  }),
)

// --- Pin + runway --------------------------------------------------------------

// Inside the Page Builder preview a tall pinned section would only show its
// cropped top, so render the collapsed (click-only) layout instead.
// Provided by pages/slice-simulator.vue.
const inSimulator = inject('inSliceSimulator', false)

// Same framing as HorizontalScroll: the first slide holds for LEAD_VH of pinned
// scroll before stepping starts, and the last one holds for DWELL_VH before the
// sticky releases.
const LEAD_VH  = 50
const DWELL_VH = 50

// Pinned scroll between two slides. Each slide owns the step centred on its
// point in the runway, so the middle slides each show for STEP_VH while the
// first and last show for half a step plus the lead / dwell hold.
const STEP_VH = 70

const runwayVh = computed(() => Math.max(slides.value.length - 1, 0) * STEP_VH)

const rootRef = ref(null)

// A single slide has nothing to step through, so it doesn't pin at all.
const scrubbed = !inSimulator && slides.value.length > 1

// --- Scroll-driven progress (pinned scrub) -----------------------------------
// `tall` starts true so SSR and client render identically; reduced-motion
// clients drop to a normal-height section driven by the bars alone.
const { progress, tall } = useScrollProgress(scrubbed ? rootRef : ref(null), {
  // Start LEAD_VH after the pin engages (the section top that far above the
  // viewport top; a negative % is a fraction of the viewport height).
  start: `top -${LEAD_VH}%`,
  // Finish the runway DWELL_VH before the pin releases. Expressed as a `+=` px
  // offset from the (lead-shifted) start, as in HorizontalScroll: a
  // `bottom bottom-=` offset would push the end past the scrollable max.
  end: (trigger) =>
    `+=${trigger.offsetHeight - window.innerHeight * (1 + (LEAD_VH + DWELL_VH) / 100)}`,
  scrub: 1,
})

const pinned = computed(() => tall.value && scrubbed)

// --- Active slide ------------------------------------------------------------

// Slide i sits at progress i / (n - 1); rounding hands over halfway between.
const scrollIndex = computed(() => Math.round(progress.value * (slides.value.length - 1)))

// Unpinned, the bars are the only control, so they own the index outright.
const selected = ref(0)

// Pinned, a click scrolls the page to the chosen slide, and the smooth scroll
// (plus the scrub's smoothing lag) would otherwise flick through every slide in
// between. `held` shows the target straight away and lets go once the scroll
// arrives — or as soon as the reader takes over the scroll themselves.
const held = ref(null)
watch(scrollIndex, (i) => { if (i === held.value) held.value = null })

const activeIndex = computed(() =>
  pinned.value ? (held.value ?? scrollIndex.value) : selected.value,
)

const { $lenis } = useNuxtApp()

function goTo(i) {
  if (!pinned.value) {
    selected.value = i
    return
  }
  const root = rootRef.value
  if (!root) return
  // Mirrors the trigger's start / end above, in document px.
  const vh     = window.innerHeight
  const start  = root.getBoundingClientRect().top + window.scrollY + vh * LEAD_VH / 100
  const runway = root.offsetHeight - vh * (1 + (LEAD_VH + DWELL_VH) / 100)
  const top    = start + (i / (slides.value.length - 1)) * runway

  // Already showing it: just settle onto its exact point, nothing to hold.
  held.value = i === scrollIndex.value ? null : i
  if ($lenis) $lenis.scrollTo(top)
  else window.scrollTo({ top, behavior: 'smooth' })
}

// A wheel or touch interrupts the smooth scroll, which then never reaches the
// held slide — hand the index back to the scroll position.
const release = () => { held.value = null }

// --- Caption height ------------------------------------------------------------

// Each caption's own height (they're `self-start`, so the shared grid row
// doesn't stretch them all to the tallest). Observed rather than read once:
// the text re-wraps on resize, and the webfonts land after mount.
const captionEls     = []
const captionHeights = ref([])
let captionObserver  = null

// Null until measured, so SSR and first paint keep the tallest-caption layout.
const captionStyle = computed(() => {
  const h = captionHeights.value[activeIndex.value]
  return pinned.value && h != null ? { height: `${h}px` } : null
})

// --- Slide videos --------------------------------------------------------------

// Link-to-Media fields come back as an object ({ url, ... }); static content
// passes a plain string.
const mediaUrl = (field) =>
  typeof field === 'string' ? field : field?.url || ''

// Phones load the lighter mobile encode when one was uploaded (same gate and
// breakpoint as ScrubScene); otherwise, and always on desktop, the standard
// clip. The field names matter beyond this file: collectMediaUrls pairs
// `video_url` / `video_url_mobile` wherever they sit, so the launch loader
// registers only the clip this device will play. Client-only (reads window).
const videoSource = (slide) => {
  const mobile = mediaUrl(slide.video_url_mobile)
  return MOBILE_VIDEO_ENABLED && mobile && window.matchMedia('(max-width: 767px)').matches
    ? mobile
    : mediaUrl(slide.video_url)
}

const hasVideo = slides.value.some((slide) => mediaUrl(slide.video_url))

// Clips are only fetched once the section nears the viewport, so a visitor who
// never reaches the slider downloads none of its footage (see PERF_MODE). From
// then on only the active slide and the one after it are attached — the next
// clip buffers while the current one plays — and the rest wait until the reader
// gets that far. An attached src is kept, so stepping back never re-downloads.
const videoSrcs   = ref([])
const videoReady  = ref([])
const videoFailed = ref([])
const videoEls    = []
const near         = ref(false)
const inView       = ref(false)
const reduceMotion = ref(false)

function attach(i) {
  const slide = slides.value[i]
  if (!slide || videoSrcs.value[i]) return
  // Clips aren't played under reduced motion, so a slide with an image keeps
  // it and skips the download; one without still gets its clip's first frame.
  if (reduceMotion.value && imageUrl(slide)) return
  const src = videoSource(slide)
  if (src) videoSrcs.value[i] = src
}

// Only the active slide's clip plays, and only while the section is on screen.
// A slide that becomes active restarts its clip from the top.
function syncPlayback(restart) {
  let playing = false
  videoEls.forEach((v, k) => {
    if (!v) return
    if (k === activeIndex.value && inView.value && !reduceMotion.value) {
      if (restart) v.currentTime = 0
      v.muted = true // autoplay policies require it set before play()
      v.play()?.catch(() => {})
      playing = true
    } else if (!v.paused) {
      v.pause()
    }
  })
  if (playing) startClipClock()
  else stopClipClock()
}

// Attaching mounts the <video>, so playback syncs after the render.
function attachAround(restart) {
  attach(activeIndex.value)
  attach(activeIndex.value + 1)
  nextTick(() => syncPlayback(restart))
}

watch(activeIndex, () => {
  // The new slide's bar starts empty rather than inheriting the last clip's
  // position for the frame before its own restart lands.
  clipProgress.value = 0
  if (near.value) attachAround(true)
})
watch(inView, () => syncPlayback(false))

// A clip that plays to its end moves the slider on. It goes through goTo, so
// pinned, the page scrolls to the next slide's point and scroll and slide keep
// agreeing (a wheel or touch still takes over, as with a click). Only while the
// reader is inside the pinned stage, though: with the section merely passing
// through the viewport, advancing would drag the page into it, so the clip goes
// round again instead.
function onClipEnded(i) {
  if (i !== activeIndex.value) return
  const rect = rootRef.value?.getBoundingClientRect()
  const engaged = !pinned.value
    || (rect && rect.top <= 1 && rect.bottom >= window.innerHeight - 1)
  if (engaged) {
    goTo(i + 1)
    return
  }
  const v = videoEls[i]
  if (!v) return
  v.currentTime = 0
  v.play()?.catch(() => {})
}

// --- Bar fill ------------------------------------------------------------------

// The active bar fills with its clip's playhead, reaching full as the clip
// ends and hands on (or wraps, on the looping last slide). Read every frame rather than on `timeupdate`, which only fires a few
// times a second and would make the fill visibly step. The clock only runs
// while the active clip is meant to be playing.
const clipProgress = ref(0)
let clipFrame = 0

function readClip() {
  const v = videoEls[activeIndex.value]
  if (v?.duration) clipProgress.value = v.currentTime / v.duration
  clipFrame = requestAnimationFrame(readClip)
}
function startClipClock() {
  if (!clipFrame) clipFrame = requestAnimationFrame(readClip)
}
function stopClipClock() {
  cancelAnimationFrame(clipFrame)
  clipFrame = 0
}

// 0–1 fill for bar i. Only the active bar fills, and it tracks the clip only
// when there's one that will actually play; an image slide, a clip that failed
// to load, or reduced motion (clips held still) shows it full, as before.
const barFill = (i) => {
  if (i !== activeIndex.value) return 0
  const timed = videoSrcs.value[i] && !videoFailed.value[i] && !reduceMotion.value
  return timed ? clipProgress.value : 1
}

let stopNear     = null
let viewObserver = null
onMounted(() => {
  window.addEventListener('wheel', release, { passive: true })
  window.addEventListener('touchstart', release, { passive: true })

  if (typeof ResizeObserver !== 'undefined') {
    captionObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const i = captionEls.indexOf(entry.target)
        if (i !== -1) captionHeights.value[i] = entry.target.offsetHeight
      }
    })
    captionEls.forEach((el) => el && captionObserver.observe(el))
  }

  if (!hasVideo) return
  reduceMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Built after the launch overlay settles, as in ScrubScene: it locks
  // scrolling until then, and a clip pulled during it would only compete with
  // the downloads the overlay is waiting on.
  whenLaunchSettled().then(() => {
    if (!rootRef.value) return // unmounted while the overlay was up
    stopNear = observeNear(rootRef.value, () => {
      near.value = true
      attachAround(false)
    }, '100%')
  })

  if (typeof IntersectionObserver === 'undefined') {
    inView.value = true
    return
  }
  viewObserver = new IntersectionObserver(([entry]) => { inView.value = entry.isIntersecting })
  viewObserver.observe(rootRef.value)
})
onUnmounted(() => {
  window.removeEventListener('wheel', release)
  window.removeEventListener('touchstart', release)
  stopNear?.()
  viewObserver?.disconnect()
  captionObserver?.disconnect()
  stopClipClock()
})
</script>
