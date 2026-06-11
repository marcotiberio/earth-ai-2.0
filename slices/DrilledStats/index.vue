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
      <div class="flex h-full w-full flex-col gap-0 lg:flex-row lg:items-stretch lg:gap-lg">
        <!-- Text column -->
        <div class="w-full h-full flex flex-col justify-start md:justify-between gap-xs md:gap-lg lg:w-5/12">
          <h2
            class="ea-display font-serif font-h2 font-normal leading-[1.05] tracking-tight"
            v-html="titleHtml"
          />

          <ul class="mt-6 grid max-w-[550px] grid-cols-2 gap-x-8 gap-y-6 lg:mt-20 xl:gap-x-20">
            <li v-for="(stat, i) in stats" :key="i" class="relative flex flex-col">
              <DottedLine class="w-full" />
              <h2 class="mt-4 mb-2 font-serif font-h2">
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
            class="relative aspect-square lg:aspect-[4/5] w-full max-h-[650px] overflow-hidden rounded lg:max-h-[850px]"
            role="img"
            :aria-label="`${counter(feetValue)} ${feetLabel}`"
          >
            <video
              v-if="videoUrl"
              ref="videoRef"
              :src="videoUrl"
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
// Scrub video (Link-to-Media) + poster/fallback image.
const videoUrl  = computed(() => mediaUrl(props.slice.primary.video_url))
const posterUrl = computed(() => props.slice.primary.image?.url || '')
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

// --- Scroll-driven progress (GSAP ScrollTrigger scrub) -----------------------
const rootRef  = ref(null)
const videoRef = ref(null)
const progress = ref(0)
// `tall` controls the sticky/scroll-distance layout. It starts true so server
// and client render identically (no hydration mismatch); reduced-motion clients
// drop it to a normal-height section in onMounted, after the first paint.
const tall = ref(true)

// --- In-frame video scrub ----------------------------------------------------
// Rather than spawning a second ScrollTrigger for the video, we drive its
// currentTime straight off `progress` so the clip and the counters share one
// scrub source and stay perfectly in step. `videoDuration` is filled once the
// clip's metadata loads; until then syncVideo is a no-op.
let videoDuration = 0

function syncVideo(p) {
  const v = videoRef.value
  if (!v || !videoDuration) return
  const t = videoDuration * p
  if (Number.isFinite(t)) v.currentTime = t
}

// Prime the clip for scroll-scrubbing (mirrors useScrubVideo): a muted inline
// play()/pause() kicks the decode pipeline so seeks actually repaint (iOS
// Safari ignores preload="auto" otherwise), then we wait for a real duration
// before wiring currentTime to scroll.
async function primeVideo() {
  const v = videoRef.value
  if (!v || !videoUrl.value) return
  v.muted = true
  if (v.readyState === 0 && v.networkState !== 2 /* LOADING */) {
    try { v.load() } catch { /* ignore */ }
  }
  const kick = v.play()
  if (kick && kick.then) kick.then(() => v.pause()).catch(() => {})

  const hasDuration = () => Number.isFinite(v.duration) && v.duration > 0
  await new Promise((resolve) => {
    if (hasDuration()) return resolve()
    const events = ['loadedmetadata', 'durationchange', 'loadeddata', 'canplay']
    const check = () => {
      if (!hasDuration()) return
      events.forEach((e) => v.removeEventListener(e, check))
      resolve()
    }
    events.forEach((e) => v.addEventListener(e, check))
  })

  try { v.pause(); v.currentTime = 0 } catch { /* ignore */ }
  videoDuration = v.duration
  syncVideo(progress.value) // land on the current scroll position (or last frame)
}

let ctx = null

onMounted(async () => {
  // Reduced motion: collapse the scroll distance and show the finished scene
  // (final counts + the clip's last frame).
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    tall.value = false
    progress.value = 1
    primeVideo()
    return
  }

  const trigger = rootRef.value
  if (!trigger) return

  // Start priming the clip immediately so it has buffered enough to scrub
  // smoothly by the time the panel pins.
  primeVideo()

  const { gsap }              = await import('gsap')
  const { ScrollTrigger: ST } = await import('gsap/ScrollTrigger')
  gsap.registerPlugin(ST)

  // Scrub progress 0→1 across the section's sticky travel, mirroring the
  // React scene's useScroll/useTransform mapping. Lenis already drives
  // ScrollTrigger.update, so this stays in sync with the smooth scroll.
  ctx = gsap.context(() => {
    const state = { p: 0 }
    gsap.to(state, {
      p: 1,
      ease: 'none',
      scrollTrigger: {
        // Begin the scrub when the panel pins (section top hits the viewport
        // top), and finish it 50vh before the panel unpins — that trailing
        // 50vh keeps the section pinned so the completed stats sit on screen
        // before the next section scrolls in. (Section height carries +50vh to
        // fund this dwell; keep the two in step if you tune it.)
        trigger,
        start: 'top top',
        end: () => `bottom bottom+=${window.innerHeight * 0.5}`,
        scrub: 1,
      },
      onUpdate: () => {
        progress.value = state.p
        syncVideo(state.p)
      },
    })
  }, trigger)
})

onUnmounted(() => ctx?.revert())
</script>
