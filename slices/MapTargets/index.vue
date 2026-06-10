<template>
  <!--
    A pinned two-column scene (a sibling of `drilled_stats`): a WYSIWYG title +
    count-up metrics on the left with a supporting paragraph anchored to the
    bottom-left, and a continental target map on the right whose orange markers
    wipe in left→right as the panel scrubs. The outer section is tall so the
    inner sticky panel has scroll distance to scrub against; under reduced motion
    we drop the height and show the finished state.
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
      <div class="flex h-full w-full flex-col gap-sm lg:flex-row lg:items-stretch lg:gap-0">
        <!-- Text column -->
        <div class="flex h-full w-full flex-col justify-start md:justify-between flex-wrap gap-sm md:gap-lg lg:w-6/12">
          
            <h2
              class="ea-display font-serif font-h2"
              v-html="titleHtml"
            />

          <div class="flex flex-col max-w-[550px] justify-start md:justify-between gap-6 md:gap-0 h-auto md:h-1/2">
            <ul class="h-full grid grid-cols-2 gap-6 md:gap-x-sm md:gap-y-sm">
              <li
                v-for="(stat, i) in stats"
                :key="i"
                class="relative flex flex-col"
                :class="stat.orange ? 'text-orange' : 'text-beige'"
              >
                <DottedLine color="currentColor" />
                <h2 class="my-2 font-serif font-h2 tabular-nums">
                  {{ counter(stat.value) }}
                </h2>
                <span class="font-caption">{{ stat.label }}</span>
              </li>
            </ul>
            <!-- Supporting paragraph, anchored bottom-left -->
            <p
              v-if="body"
              class="mt-0 md:mt-sm max-w-md font-body text-beige lg:mt-0"
            >
              {{ body }}
            </p>
          </div>
        </div>

        <!-- Target map -->
        <div class="flex w-full items-center justify-center lg:w-6/12 lg:justify-end">
          <svg
            viewBox="0 0 933 822"
            preserveAspectRatio="xMidYMid meet"
            class="h-auto max-h-[620px] w-full lg:max-h-[820px]"
            role="img"
            :aria-label="mapLabel"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <!-- Grey continental landmass (base layer, viewBox 933×822) -->
            <g v-html="AUSTRALIA" />
            <!-- Orange target markers. Each fades in on its own as the panel
                 scrubs, in a scattered (pseudo-random) order. The markers were
                 exported in their own 1005×926 box, so we scale them uniformly
                 (822/926) and re-centre onto the map's box. -->
            <g transform="translate(-70 -50) scale(1)">
              <g
                v-for="(m, i) in markers"
                :key="i"
                :style="{ opacity: markerOpacity(i) }"
                v-html="m"
              />
            </g>
          </svg>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { asHTML } from '@prismicio/client'
import australiaRaw from './australia.svg?raw'
import markersRaw from './markers.svg?raw'

const props = defineProps({
  slice:   { type: Object, required: true },
  context: { type: Object },
  index:   { type: Number },
  slices:  { type: Array },
})

// --- Content (tolerate both static-string and live Prismic shapes) ----------
const inlineSerializer = { paragraph: ({ children }) => children }
const toHtml = (field) => {
  if (!field) return ''
  return typeof field === 'string'
    ? field
    : asHTML(field, { serializer: inlineSerializer }) || ''
}

const titleHtml = computed(() => toHtml(props.slice.primary.title))
const body      = computed(() => props.slice.primary.body || '')
// Group field lives in primary; cap at 4 rows (the design only has room for four).
const stats     = computed(() => (props.slice.primary.stats || []).slice(0, 4))
// Pinned scroll distance (vh) — editable per section; defaults to 220. (The
// scrub still finishes 50vh before unpin for the end-state dwell; tune the
// length up if the reveal feels rushed — this slice previously used 270.)
const scrollLength = computed(() => Number(props.slice.primary.scroll_length) || 300)

const mapLabel = computed(() =>
  stats.value.map((s) => `${counter(s.value)} ${s.label}`).join(', ') || 'Continental target map'
)

// --- Count-up formatting -----------------------------------------------------
// Parse the leading number out of a label like "1,500" or "83%" so we can
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
const progress = ref(0)
// `tall` controls the sticky/scroll-distance layout. It starts true so server
// and client render identically (no hydration mismatch); reduced-motion clients
// drop it to a normal-height section in onMounted, after the first paint.
const tall = ref(true)

let ctx = null

onMounted(async () => {
  // Reduced motion: collapse the scroll distance and show the finished scene.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    tall.value = false
    progress.value = 1
    return
  }

  const trigger = rootRef.value
  if (!trigger) return

  const { gsap }              = await import('gsap')
  const { ScrollTrigger: ST } = await import('gsap/ScrollTrigger')
  gsap.registerPlugin(ST)

  ctx = gsap.context(() => {
    const state = { p: 0 }
    gsap.to(state, {
      p: 1,
      ease: 'none',
      scrollTrigger: {
        trigger,
        start: 'top top',
        end: () => `bottom bottom+=${window.innerHeight * 0.5}`,
        scrub: 1,
      },
      onUpdate: () => { progress.value = state.p },
    })
  }, trigger)
})

onUnmounted(() => ctx?.revert())

// --- Map assets ------------------------------------------------------------
// The grey landmass (australia.svg, viewBox 933×822) and the orange target
// glyphs (map.svg, viewBox 1005×926) are imported raw and stripped of their
// outer <svg> wrapper so they can be composited into one inline SVG above.
const inner = (s) => s.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
const AUSTRALIA = inner(australiaRaw)
const MARKERS   = inner(markersRaw)

// Split the markers layer into individual target glyphs so each can fade in on
// its own. Every marker gets a stable pseudo-random "appear" threshold — keyed
// off its index so SSR and client agree (no hydration mismatch) — and as
// `progress` passes that threshold the marker ramps from 0→1 opacity over a
// short band. The result reads as targets lighting up in scattered order
// rather than a left→right sweep.
const markers = MARKERS.match(/<g opacity="0.85">[\s\S]*?<\/g>/g) || []

// Deterministic [0,1) hash from an integer index (mulberry-style mixing).
const seededRand = (i) => {
  let t = Math.imul(i + 1, 2654435761) >>> 0
  t ^= t >>> 15; t = Math.imul(t, 2246822519)
  t ^= t >>> 13; t = Math.imul(t, 3266489917)
  t ^= t >>> 16
  return (t >>> 0) / 4294967296
}

const REVEAL_SPREAD = 0.82 // last markers begin appearing around here
const REVEAL_BAND   = 0.12 // each marker's individual fade length (progress units)
const thresholds = markers.map((_, i) => seededRand(i) * REVEAL_SPREAD)
const markerOpacity = (i) =>
  Math.max(0, Math.min(1, (progress.value - thresholds[i]) / REVEAL_BAND))

</script>
