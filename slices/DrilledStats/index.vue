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
          <h2
            class="ea-display font-serif font-h2"
            v-html="titleHtml"
          />

          <ul class="mt-0 grid lg:max-w-[550px] grid-cols-2 gap-x-8 gap-y-6 lg:mt-20 xl:gap-x-20">
            <li v-for="(stat, i) in stats" :key="i" class="relative flex flex-col">
              <DottedLine class="w-full" />
              <h2 class="mt-2 mb-2 font-serif font-h2">
                {{ counter(stat.value) }}
              </h2>
              <span class="font-caption font-medium tracking-wide">{{ stat.label }}</span>
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
              :src="videoSrc"
              :poster="posterUrl || undefined"
              muted
              playsinline
              preload="auto"
              class="absolute inset-0 h-full w-full object-cover"
            />
            <img
              v-else-if="posterUrl"
              :src="posterUrl"
              :alt="resolveImageAlt(slice.primary.image)"
              class="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
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
const feetValue = computed(() => props.slice.primary.feet_value || '')
const feetLabel = computed(() => props.slice.primary.feet_label || '')
// Scrub video (Link-to-Media) + optional lighter mobile encode + poster image.
const videoUrl       = computed(() => mediaUrl(props.slice.primary.video_url))
const videoUrlMobile = computed(() => mediaUrl(props.slice.primary.video_url_mobile))
const posterUrl      = computed(() => props.slice.primary.image?.url || '')
// SSR renders this src; the scrub setup below queues the background warm-up.
const videoSrc = ref(videoUrl.value)
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

// Prime the clip for scrubbing (kick the decoder, wait for a real duration — see
// primeScrubVideo), then bind a gated seeker and land on the current scroll
// position.
async function primeVideo() {
  const v = videoRef.value
  if (!v || !videoUrl.value) return
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
  stopPrimeObserve = observeNear(rootRef.value, primeVideo, '200%')
}

// On phones the in-frame clip autoplays instead of scrubbing (forward decode is
// robust where seek-scrubbing stalls); the count-ups still scrub with scroll.
const isMobile = typeof window !== 'undefined'
  && window.matchMedia('(max-width: 767px)').matches

// --- Scroll-driven progress (pinned scrub) -----------------------------------
// One source drives the count-ups (via `progress`) and — on desktop — the video
// (via onUpdate → syncVideo). `tall` starts true so SSR/first paint match;
// reduced-motion collapses the section and shows the finished scene.
const { progress, tall } = useScrollProgress(rootRef, {
  start: 'top top',
  // Finish 50vh (75vh on coarse pointers, where a momentum flick rips through)
  // before the panel unpins, holding the completed stats + last frame on screen.
  // The section height carries the extra travel to fund this dwell.
  end: (_, coarse) => `bottom bottom+=${window.innerHeight * (coarse ? 0.75 : 0.5)}`,
  scrub: { fine: 1, coarse: 3 },
  // Warm + prime the scrub clip — desktop only. On mobile the clip autoplays
  // (below), so there's nothing to prime and seek stays null (syncVideo no-ops).
  onReady: () => {
    if (!videoUrl.value || isMobile) return
    prefetchScrubVideo(videoUrl.value)
    primeWhenNear()
  },
  onUpdate: syncVideo,
})

// Mobile: drive the in-frame clip as a muted, forward-only autoplay loop instead
// of seeking it. Only the footage is decoupled — the count-ups keep scrubbing
// with scroll via `progress` above (so the section stays tall, uncapped).
if (isMobile && videoUrl.value) {
  // Serve the lighter mobile encode when one was uploaded — a post-hydration
  // swap from the SSR-rendered desktop src, so no markup mismatch.
  onMounted(() => { if (videoUrlMobile.value) videoSrc.value = videoUrlMobile.value })
  useAutoplayVideo(videoRef, rootRef)
}

onUnmounted(() => stopPrimeObserve?.())
</script>
