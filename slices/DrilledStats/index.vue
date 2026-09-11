<template>
  <!--
    A pinned two-column scene: a WYSIWYG title + count-up metrics on the left,
    and an in-frame video on the right whose playback is scrubbed by scroll. The
    same scroll progress drives both the count-ups and the video's currentTime,
    so the footage and the metrics advance together. The outer section is tall so
    the inner sticky panel has scroll distance to scrub against; under reduced
    motion we drop the height and show the end state (last frame + final counts).
  -->
  <section
    ref="rootRef"
    class="relative w-full bg-darkblue text-beige"
    :style="tall ? { height: `${scrollLength}vh` } : null"
  >
    <div
      class="w-full overflow-hidden boxed"
      :class="tall ? 'sticky top-0 flex h-screen items-center' : 'flex min-h-screen items-center py-lg'"
    >
      <div class="flex h-full w-full flex-col gap-xs lg:flex-row lg:items-stretch md:gap-sm lg:gap-lg">
        <!-- Text column -->
        <div class="w-full h-full flex flex-col justify-start lg:justify-between gap-xs md:gap-sm lg:gap-lg lg:w-5/12">
          <!-- Label + title are one flex item so `lg:justify-between` still
               spreads the headline block against the stats, rather than
               treating the label as a third thing to space out. -->
          <div class="flex flex-col gap-xs">
            <SectionLabel v-if="sectionLabel" :text="sectionLabel" />
            <h2
              class="ea-display font-serif font-h2"
              v-html="titleHtml"
            />
          </div>

          <ul class="mt-0 grid grid-cols-2 gap-4">
            <li v-for="(stat, i) in stats" :key="i" class="relative flex h-full flex-col justify-between bg-beige/5 p-xs rounded">
              <p class="font-mono font-caption font-medium tracking-wide leading-snug uppercase text-beige">
                <span class="mr-3 inline-block h-3 w-3 rounded-[2px] bg-current align-baseline" />{{ stat.label }}
              </p>
              <h2 class="mt-8 font-serif font-h2">
                {{ counter(stat.value) }}
              </h2>
            </li>
          </ul>
        </div>

        <!-- In-frame scrub video: an inset, bordered clip whose currentTime is
             driven by the same scroll progress that powers the count-ups, so the
             footage and the metrics scrub together. -->
        <div class="flex w-full items-center justify-center lg:w-7/12 lg:justify-end">
          <div
            class="relative aspect-[8/7] md:aspect-4/3 lg:aspect-[4/5] w-full max-h-[650px] overflow-hidden rounded lg:max-h-[850px]"
            role="img"
            :aria-label="`${counter(feetValue)} ${feetLabel}`"
          >
            <video
              v-if="videoUrl"
              ref="videoRef"
              :src="videoSrc || undefined"
              :poster="imgixUrl(posterUrl, { w: 1600 }) || undefined"
              muted
              playsinline
              preload="auto"
              crossorigin="anonymous"
              class="absolute inset-0 h-full w-full object-cover"
            />
            <img
              v-else-if="posterUrl"
              :src="imgixUrl(posterUrl, { w: 1280 })"
              :srcset="imgixSrcset(posterUrl, [768, 1280, 1920])"
              sizes="100vw"
              :alt="resolveImageAlt(activeImage)"
              class="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, nextTick, onUnmounted } from 'vue'
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

// Link-to-Media fields come back as an object ({ url, ... }); static content
// passes a plain string.
const mediaUrl = (field) =>
  typeof field === 'string' ? field : field?.url || ''

const titleHtml = computed(() => toHtml(props.slice.primary.title))
// Small mono eyebrow above the headline (rendered uppercase by SectionLabel).
const sectionLabel = computed(() => props.slice.primary.section_label || '')
const feetValue = computed(() => props.slice.primary.feet_value || '')
const feetLabel = computed(() => props.slice.primary.feet_label || '')
// Scrub video (Link-to-Media) + optional lighter mobile encode + poster/fallback image.
const videoUrl       = computed(() => mediaUrl(props.slice.primary.video_url))
const videoUrlMobile = computed(() => mediaUrl(props.slice.primary.video_url_mobile))
const activeImage    = useMobileImage(() => props.slice.primary.image, () => props.slice.primary.image_mobile)
const posterUrl      = computed(() => activeImage.value?.url || '')
// Under PERF_MODE the src starts empty and is attached only once the section
// nears the viewport (see attachSrc): the element is preload="auto", so an
// SSR-rendered src downloads the whole clip at first paint on every visit —
// and, before the post-hydration mobile swap can run, the DESKTOP clip even on
// phones. Poster-first costs nothing and is the same pattern ScrubScene uses.
// With the flag off we keep the SSR src (main's behaviour).
const videoSrc = ref(PERF_MODE ? '' : videoUrl.value)
// Group field lives in primary; cap at 6 rows (the design only has room for six).
const stats = computed(() => (props.slice.primary.stats || []).slice(0, 6))
// Pinned scroll distance (vh) — editable per section; defaults to 300. (The
// scrub still finishes 50vh before unpin for the end-state dwell; tune the
// length up if the count-up feels rushed — this slice previously used 270.)
const scrollLength = computed(() => Number(props.slice.primary.scroll_length) || 300)

// --- Count-up formatting -----------------------------------------------------
// Parse the leading number out of a label like "4.1 mil" or "96,000" so we can
// animate it from zero while keeping any prefix/suffix and decimal precision.
function parseValue(str) {
  const s = String(str ?? '')
  const m = s.match(/-?[\d,]*\.?\d+/)
  if (!m) return { raw: s, target: null }
  const numStr   = m[0]
  const target   = parseFloat(numStr.replace(/,/g, ''))
  const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 0
  return {
    target,
    decimals,
    prefix: s.slice(0, m.index),
    suffix: s.slice(m.index + numStr.length),
  }
}

function counter(value) {
  const p = parseValue(value)
  if (p.target === null) return p.raw
  const cur = p.target * progress.value
  const num = cur.toLocaleString('en-US', {
    minimumFractionDigits: p.decimals,
    maximumFractionDigits: p.decimals,
  })
  return `${p.prefix}${num}${p.suffix}`
}

// --- In-frame video scrub ----------------------------------------------------
// Drive the clip's currentTime straight off the same `progress` that powers the
// count-ups, so footage and metrics share one scrub source and stay in step (no
// second ScrollTrigger). `videoDuration`/`seek` fill once the clip primes; until
// then syncVideo is a no-op.
const rootRef  = ref(null)
const videoRef = ref(null)
let videoDuration = 0
let seek = null

function syncVideo(p) {
  const v = videoRef.value
  if (!v || !videoDuration || !seek) return
  const t = videoDuration * p
  if (Number.isFinite(t)) seek(t)
}

// Pick the device-appropriate encode and attach it. Phones get the lighter
// mobile clip when one was uploaded; otherwise (and always on desktop) the
// standard one. Called from the proximity observer under PERF_MODE, so the
// download starts with the section ~2 screens out rather than at page load.
function attachSrc() {
  const mobile = window.matchMedia('(max-width: 767px)').matches
  videoSrc.value = (MOBILE_VIDEO_ENABLED && mobile && videoUrlMobile.value)
    ? videoUrlMobile.value
    : videoUrl.value
}

// Prime the clip for scrubbing (kick the decoder, wait for a real duration — see
// primeScrubVideo), then bind a gated seeker and land on the current scroll
// position.
async function primeVideo() {
  const v = videoRef.value
  if (!v || !videoUrl.value) return
  // Attach before priming: primeScrubVideo waits on a real duration, which never
  // arrives if the element still has no source.
  if (!videoSrc.value) {
    attachSrc()
    await nextTick()
  }
  await primeScrubVideo(v)
  videoDuration = v.duration
  seek = createSeeker(v)
  syncVideo(progress.value) // land on the current scroll position (or last frame)
}

// Priming forces a full fetch, so defer it until the section nears the viewport
// (cf. useScrubVideo) instead of pulling every clip at mount and starving the
// hero on mobile connections.
let stopPrimeObserve = null
function primeWhenNear() {
  // Deferred to the launch settling for the same reason as ScrubScene: the
  // margin is then sized by measured throughput, and scroll is locked until
  // then anyway so no runway is lost.
  whenLaunchSettled().then(() => {
    if (!rootRef.value) return
    stopPrimeObserve = observeNear(rootRef.value, primeVideo, scrubLeadMargin(200))
  })
}

// --- Scroll-driven progress (pinned scrub) -----------------------------------
// One source drives the count-ups (via `progress`) and the video (via onUpdate
// → syncVideo). `tall` starts true so SSR/first paint match; reduced-motion
// collapses the section and shows the finished scene (final counts + last frame).
const { progress, tall } = useScrollProgress(rootRef, {
  start: 'top top',
  // Finish 50vh (75vh on coarse pointers, where a momentum flick rips through)
  // before the panel unpins, holding the completed stats + last frame on screen.
  // The section height carries the extra travel to fund this dwell.
  end: (_, coarse) => `bottom bottom+=${window.innerHeight * (coarse ? 0.75 : 0.5)}`,
  scrub: { fine: 1, coarse: 3 },
  // Warm + prime the clip regardless of motion preference, before the trigger.
  onReady: () => {
    if (!videoUrl.value) return
    // Off PERF_MODE: swap to the mobile encode post-hydration (from the SSR
    // desktop src, so no markup mismatch) and queue the background warm-up —
    // main's behaviour. On PERF_MODE both the src attach and the download are
    // deferred to primeWhenNear, so a visitor who never reaches this section
    // never pays for its clip.
    if (!PERF_MODE) {
      attachSrc()
      prefetchScrubVideo(videoSrc.value)
    }
    primeWhenNear()
  },
  onUpdate: syncVideo,
})

onUnmounted(() => stopPrimeObserve?.())
</script>
