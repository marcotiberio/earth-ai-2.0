<template>
  <!--
    A pinned two-column scene: a
    WYSIWYG title + count-up metrics on the left, and a drilling arrow that
    grows skyward on scroll on the right (a port of the React `Slide1`/`RightViz`).
    The outer section is tall so the inner sticky panel has scroll distance to
    scrub against; under reduced motion we drop the height and show the end state.
  -->
  <section
    ref="rootRef"
    class="relative w-full bg-darkblue text-beige"
    :class="tall ? 'h-[270vh]' : ''"
  >
    <div
      class="w-full overflow-hidden px-6 md:px-10"
      :class="tall ? 'sticky top-0 flex h-screen items-center' : 'flex min-h-screen items-center py-24'"
    >
      <div class="flex h-full w-full flex-col gap-0 lg:flex-row lg:items-stretch lg:gap-16">
        <!-- Text column -->
        <div class="w-full h-full flex flex-col justify-evenly gap-lg lg:w-5/12 pt-[6rem] lg:py-10">
          <h2
            class="ea-display font-serif text-4xl md:text-5xl xl:text-6xl font-normal leading-[1.05] tracking-tight"
            v-html="titleHtml"
          />

          <ul class="mt-14 grid max-w-[550px] grid-cols-2 gap-x-10 gap-y-12 lg:mt-20 xl:gap-x-20">
            <li v-for="(stat, i) in stats" :key="i" class="relative flex flex-col">
              <svg width="238" height="2" viewBox="0 0 238 2" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1H237" stroke="#FAF3E4" stroke-width="2" stroke-linecap="round" stroke-dasharray="0.1 15"/>
              </svg>
              <h2 class="mt-5 mb-2 font-serif text-4xl md:text-5xl xl:text-6xl font-normal leading-[1.05] tracking-tight tabular-nums">
                {{ counter(stat.value) }}
              </h2>
              <span class="text-xs font-medium tracking-wide md:text-sm">{{ stat.label }}</span>
            </li>
          </ul>
        </div>

        <!-- Drilling viz -->
        <div class="flex w-full items-end justify-center lg:w-7/12 lg:justify-end">
          <svg
            viewBox="0 0 800 1000"
            preserveAspectRatio="xMidYMid meet"
            class="h-auto max-h-[650px] w-[120%] lg:max-h-[850px] lg:w-full"
            role="img"
            :aria-label="`${counter(feetValue)} ${feetLabel}`"
          >
            <defs>
              <linearGradient id="ds-fade" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" :stop-color="ORANGE" stop-opacity="0.15" />
                <stop offset="100%" :stop-color="ORANGE" stop-opacity="0" />
              </linearGradient>
              <clipPath id="ds-arc-clip">
                <rect x="0" y="0" width="800" :height="START_Y" />
              </clipPath>
            </defs>

            <!-- Concentric "ground" arcs, radiating from the baseline -->
            <g clip-path="url(#ds-arc-clip)" stroke="#FAF3E4" stroke-opacity="0.2" stroke-width="2" stroke-dasharray="4 12" fill="none">
              <circle cx="400" :cy="START_Y" r="200" />
              <circle cx="400" :cy="START_Y" r="400" />
              <circle cx="400" :cy="START_Y" r="600" />
            </g>

            <!-- Soft trail to the right of the line -->
            <rect x="400" :y="lineY" width="60" :height="START_Y - lineY" fill="url(#ds-fade)" />

            <!-- Vertical drill line -->
            <line x1="400" :y1="START_Y" x2="400" :y2="lineY" :stroke="ORANGE" stroke-width="2.5" />

            <!-- Arrow head -->
            <path
              :d="arrowPath"
              :stroke="ORANGE"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"
              :opacity="progress > 0 ? 1 : 0"
            />

            <!-- Start dot -->
            <circle cx="400" :cy="START_Y" r="4.5" :fill="ORANGE" />

            <!-- Number + label, anchored to the arrow tip -->
            <text x="400" :y="lineY - 45" text-anchor="middle" :fill="ORANGE" class="font-serif tabular-nums" font-size="64" font-weight="400">
              {{ counter(feetValue) }}
            </text>
            <text x="400" :y="lineY - 12" text-anchor="middle" :fill="ORANGE" class="font-sans" font-size="15" font-weight="500">
              {{ feetLabel }}
            </text>
          </svg>
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

const ORANGE = '#E66F3E'

// --- Content (tolerate both static-string and live Prismic shapes) ----------

// Strip the block wrapper so rich text renders inline inside our <h2>.
const inlineSerializer = { paragraph: ({ children }) => children }
const toHtml = (field) => {
  if (!field) return ''
  return typeof field === 'string'
    ? field
    : asHTML(field, { serializer: inlineSerializer }) || ''
}

const titleHtml = computed(() => toHtml(props.slice.primary.title))
const feetValue = computed(() => props.slice.primary.feet_value || '')
const feetLabel = computed(() => props.slice.primary.feet_label || '')
// Group field lives in primary; cap at 4 rows (the design only has room for four).
const stats = computed(() => (props.slice.primary.stats || []).slice(0, 4))

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
const progress = ref(0)
// `tall` controls the sticky/scroll-distance layout. It starts true so server
// and client render identically (no hydration mismatch); reduced-motion clients
// drop it to a normal-height section in onMounted, after the first paint.
const tall = ref(true)

// Drill line rises from the section's bottom edge (the viewBox foot, y=1000) up
// to y=250 as progress fills. The start dot and the "ground" arcs share this
// baseline, and the SVG is bottom-aligned (items-end) so y=1000 lands on the
// section's bottom edge.
const START_Y = 1000
const END_Y   = 250
const lineY     = computed(() => START_Y - (START_Y - END_Y) * progress.value)
const arrowPath = computed(() => `M 388 ${lineY.value + 12} L 400 ${lineY.value} L 412 ${lineY.value + 12}`)

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

  // Scrub progress 0→1 across the section's sticky travel, mirroring the
  // React scene's useScroll/useTransform mapping. Lenis already drives
  // ScrollTrigger.update, so this stays in sync with the smooth scroll.
  ctx = gsap.context(() => {
    const state = { p: 0 }
    gsap.to(state, {
      p: 1,
      ease: 'none',
      scrollTrigger: {
        // Begin the scrub when the section's top reaches the middle of the
        // viewport, and finish it 50vh before the panel unpins — that trailing
        // 50vh keeps the section pinned so the completed stats sit on screen
        // before the next section scrolls in. (Section height carries +50vh to
        // fund this dwell; keep the two in step if you tune it.)
        trigger,
        start: 'top center',
        end: () => `bottom bottom+=${window.innerHeight * 0.5}`,
        scrub: 1,
      },
      onUpdate: () => { progress.value = state.p },
    })
  }, trigger)
})

onUnmounted(() => ctx?.revert())
</script>
