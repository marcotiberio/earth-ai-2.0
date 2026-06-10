<template>
  <!--
    Pinned demand-vs-supply scene. The section is tall so its inner panel sticks
    and scrubs progress 0→1 as you
    scroll: the demand curve draws + counts up first (0→0.45), then the supply
    curve (0.45→0.9), each revealed with a left→right clip wipe. The deficit reads
    as the band between the rising demand curve and the falling supply curve.
    Geometry is mapped into the live pixel bounds of the plot so the lines fill
    their box and the dots stay round. Reduced motion shows the finished chart.
  -->
  <section
    ref="rootRef"
    class="relative w-full bg-darkblue"
    :style="tall ? { height: `${scrollLength}vh` } : null"
  >
    <div
      class="w-full boxed"
      :class="tall ? 'sticky top-0 flex h-screen flex-col justify-between overflow-hidden' : 'flex min-h-screen flex-col justify-between md:justify-center py-24'"
    >
      <!-- Heading + intro -->
      <div class="flex shrink-0 flex-col gap-6 md:flex-row md:items-start md:justify-start md:gap-sm">
        <h2
          class="ea-display font-serif text-beige font-h2 w-full md:w-1/2"
          v-html="headingHtml"
        />
        <p
          v-if="body"
          class="text-beige font-body md:pt-2 w-full md:w-1/4"
        >
          {{ body }}
        </p>
      </div>

      <!-- Chart -->
      <div
        ref="chartRef"
        class="relative mt-10 h-[50vh] w-full overflow-visible md:mt-16"
        style="height: 50vh"
      >
        <svg class="absolute inset-0 h-full md:mt-16 w-full overflow-visible" :aria-label="`Projected demand of ${demand.value} against ${supply.value} ${supply.label}`" role="img">
          <defs>
            <linearGradient id="sg-demand-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stop-color="#D6DDE9" stop-opacity="0.30" />
              <stop offset="100%" stop-color="#D6DDE9" stop-opacity="0" />
            </linearGradient>
            <linearGradient id="sg-supply-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   :stop-color="ORANGE" stop-opacity="0.40" />
              <stop offset="100%" :stop-color="ORANGE" stop-opacity="0" />
            </linearGradient>
          </defs>

          <!-- gridlines + y labels -->
          <g>
            <g v-for="g in gridLines" :key="g.label">
              <text :x="mapX(0)" :y="mapY(g.y) - 8" fill="#FAF3E4" font-size="12" opacity="1">{{ g.label }}</text>
              <line :x1="mapX(0)" :y1="mapY(g.y)" :x2="mapX(1000)" :y2="mapY(g.y)" stroke="#FAF3E4" stroke-width="2" stroke-linecap="round" stroke-dasharray="0.1 15" />
            </g>
          </g>

          <!-- x axis + labels -->
          <line :x1="mapX(0)" :y1="mapY(400)" :x2="mapX(1000)" :y2="mapY(400)" stroke="#FAF3E4" stroke-width="1" opacity="0.35" />
          <text
            v-for="(x, i) in xLabels"
            :key="`x-${i}`"
            :x="mapX((i / Math.max(xLabels.length - 1, 1)) * 1000)"
            :y="mapY(400) + 26"
            fill="#FAF3E4"
            font-size="13"
            opacity="1"
            :text-anchor="i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'"
          >{{ x }}</text>

          <!-- demand curve (draws first, 0→0.45) -->
          <g :style="{ clipPath: clipDemand }">
            <path :d="demandArea" fill="url(#sg-demand-fill)" />
            <path :d="demandLine" fill="none" stroke="#FAF3E4" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
            <circle v-for="(p, i) in mappedDemand" :key="`dd-${i}`" :cx="p[0]" :cy="p[1]" r="4.5" fill="#FAF3E4" />
          </g>

          <!-- supply curve (draws second, 0.45→0.9) -->
          <g :style="{ clipPath: clipSupply }">
            <path :d="supplyArea" fill="url(#sg-supply-fill)" />
            <path :d="supplyLine" fill="none" :stroke="ORANGE" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
            <circle v-for="(p, i) in mappedSupply" :key="`sd-${i}`" :cx="p[0]" :cy="p[1]" r="4.5" :fill="ORANGE" />
          </g>
        </svg>

        <!-- endpoint figures (HTML overlay, counting up) -->
        <div
          class="absolute flex flex-col items-end text-right leading-none"
          :style="{ top: `${mapY(8) - 30}px`, right: `${rightOffset}px`, opacity: fadeDemand, color: BEIGE }"
        >
          <div class="font-serif font-h3 tabular-nums tracking-tight md:font-h2">{{ demandTotal }}</div>
          <div class="mt-1 font-body uppercase text-beige">{{ demand.label }}</div>
        </div>
        <div
          class="absolute flex max-w-[60%] flex-col items-end text-right leading-none"
          :style="{ top: `${mapY(252) - 35}px`, right: `${rightOffset}px`, opacity: fadeSupply, color: ORANGE }"
        >
          <div class="font-serif font-h3 tabular-nums tracking-tight md:font-h2">{{ supplyTotal }}</div>
          <div class="mt-1 font-body uppercase">{{ supply.label }}</div>
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
const BEIGE  = '#FAF3E4'

// --- Content (tolerate static-string and live Prismic shapes) ----------------
const inlineSerializer = { paragraph: ({ children }) => children }
const toHtml = (field) => {
  if (!field) return ''
  return typeof field === 'string' ? field : asHTML(field, { serializer: inlineSerializer }) || ''
}
// A repeatable Prismic Group arrives as [{ value: '…' }], while a plain static
// shape passes a plain array/object — accept both.
const obj   = (g) => (Array.isArray(g) ? g[0] : g) || {}
const items = (g) => (Array.isArray(g) ? g : []).map((it) => (it && typeof it === 'object' ? it.value : it))

const headingHtml = computed(() => toHtml(props.slice.primary.heading))
const body    = computed(() => props.slice.primary.body || '')
// Pinned scroll distance (vh) — editable per section; defaults to 220.
const scrollLength = computed(() => Number(props.slice.primary.scroll_length) || 220)
const demand  = computed(() => ({ label: 'DEMAND', value: '', ...obj(props.slice.primary.demand) }))
const supply  = computed(() => ({ label: '', value: '', ...obj(props.slice.primary.supply) }))
const xLabels = computed(() => {
  const x = props.slice.primary.x_labels || []
  return Array.isArray(x) && x.some((v) => v && typeof v === 'object') ? items(x) : x
})

const num = (v) => Number(String(v ?? '').replace(/,/g, '')) || 0
const fmt = (n) => n.toLocaleString('en-US')
const clamp01 = (n) => Math.max(0, Math.min(1, n))
const lerp = (a, b, t) => a + (b - a) * clamp01(t)

// --- Geometry ----------------------------------------------------------------
// Editorial point series in a fixed 0–1000 × 0–480 space (y grows downward, so a
// small y sits high on the chart). Demand climbs to the top; supply slips down,
// opening the deficit between them.
const demandPoints = [
  [0, 96], [100, 96], [200, 80], [300, 80], [400, 80],
  [500, 56], [600, 40], [700, 40], [800, 24], [900, 8], [1000, 8],
]
const supplyPoints = [
  [0, 160], [100, 168], [200, 184], [300, 192], [400, 192],
  [500, 192], [600, 200], [700, 240], [800, 240], [900, 248], [1000, 252],
]
// Gridline rows (value → y in the same space), top (50) to bottom (10).
const gridLines = [
  { label: '50', y: 0 },
  { label: '40', y: 80 },
  { label: '30', y: 160 },
  { label: '20', y: 240 },
  { label: '10', y: 320 },
]

const PAD_X = 24
const PAD_TOP = 36
const PAD_BOTTOM = 64
const bounds = ref({ width: 1000, height: 460 }) // SSR/first-paint default

const mapX = (x) => PAD_X + (x / 1000) * (bounds.value.width - PAD_X - 40)
const mapY = (y) => PAD_TOP + ((y + 40) / 480) * (bounds.value.height - PAD_TOP - PAD_BOTTOM)

const mappedDemand = computed(() => demandPoints.map((p) => [mapX(p[0]), mapY(p[1])]))
const mappedSupply = computed(() => supplyPoints.map((p) => [mapX(p[0]), mapY(p[1])]))

const toPath    = (pts) => 'M ' + pts.map((p) => `${p[0]} ${p[1]}`).join(' L ')
const toPolygon = (pts) => toPath(pts) + ` L ${mapX(1000)} ${mapY(400)} L ${mapX(0)} ${mapY(400)} Z`

const demandLine = computed(() => toPath(mappedDemand.value))
const supplyLine = computed(() => toPath(mappedSupply.value))
const demandArea = computed(() => toPolygon(mappedDemand.value))
const supplyArea = computed(() => toPolygon(mappedSupply.value))

const rightOffset = computed(() => bounds.value.width - mapX(1000) + 20)

// --- Progress-driven reveal (sequential: demand, then supply) ----------------
const dProg = computed(() => clamp01(progress.value / 0.45))
const sProg = computed(() => clamp01((progress.value - 0.45) / 0.45))

const clipDemand = computed(() => `inset(0% ${(1 - dProg.value) * 100}% 0% 0%)`)
const clipSupply = computed(() => `inset(0% ${(1 - sProg.value) * 100}% 0% 0%)`)

const demandTotal = computed(() => fmt(Math.round(num(demand.value.value) * dProg.value)))
const supplyTotal = computed(() => fmt(Math.round(num(supply.value.value) * sProg.value)))

const fadeDemand = computed(() => lerp(0, 1, (progress.value - 0.40) / 0.06))
const fadeSupply = computed(() => lerp(0, 1, (progress.value - 0.85) / 0.05))

// --- Scroll-driven progress (pinned scrub) -----------------------------------
// `tall` starts true so SSR and client render identically; reduced-motion
// clients drop to a normal-height section and show the finished chart.
const rootRef  = ref(null)
const chartRef = ref(null)
const progress = ref(0)
const tall     = ref(true)

let ctx = null
let ro = null

function measure() {
  const el = chartRef.value
  if (el) bounds.value = { width: el.clientWidth, height: el.clientHeight }
}

onMounted(async () => {
  measure()
  ro = new ResizeObserver(measure)
  if (chartRef.value) ro.observe(chartRef.value)

  // Reduced motion: collapse the scroll distance and show the finished chart.
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
        scrub: 1.2,
      },
      onUpdate: () => { progress.value = state.p },
    })
  }, trigger)
})

onUnmounted(() => {
  ctx?.revert()
  ro?.disconnect()
})
</script>
