<template>
  <section
    ref="rootRef"
    class="relative w-full bg-darkblue"
    :style="tall ? { height: `${totalVh}vh` } : null"
  >
    <div
      class="w-full boxed"
      :class="tall ? 'sticky top-0 flex h-screen flex-col justify-between overflow-hidden' : 'flex min-h-screen flex-col justify-between md:justify-center py-24'"
    >
      <div class="flex shrink-0 flex-col gap-6 md:gap-8 md:flex-row md:items-start md:justify-start lg:gap-sm">
        <h2
          class="ea-display font-serif text-beige font-h2 w-full md:w-1/2"
          v-html="headingHtml"
        />
        <p
          v-if="body"
          class="text-beige font-body md:pt-2 w-full md:w-1/2 lg:w-1/4"
        >
          {{ body }}
        </p>
      </div>

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

          <g>
            <line :x1="mapX(0)" :y1="mapY(capY)" :x2="mapX(1000)" :y2="mapY(capY)" stroke="#FAF3E4" stroke-width="2" stroke-linecap="round" stroke-dasharray="0.1 15" />
            <g v-for="(g, i) in gridLines" :key="i">
              <text :x="mapX(0)" :y="mapY(g.y) - 8" fill="#FAF3E4" font-size="12" opacity="1">{{ g.label }}</text>
              <line :x1="mapX(0)" :y1="mapY(g.y)" :x2="mapX(1000)" :y2="mapY(g.y)" stroke="#FAF3E4" stroke-width="2" stroke-linecap="round" stroke-dasharray="0.1 15" />
            </g>
          </g>

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

          <g :style="{ clipPath: clipDemand }">
            <path :d="demandArea" fill="url(#sg-demand-fill)" />
            <path :d="demandLine" fill="none" stroke="#FAF3E4" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
            <circle v-for="(p, i) in mappedDemand" :key="`dd-${i}`" :cx="p[0]" :cy="p[1]" r="4.5" fill="#FAF3E4" />
          </g>

          <g :style="{ clipPath: clipSupply }">
            <path :d="supplyArea" fill="url(#sg-supply-fill)" />
            <path :d="supplyLine" fill="none" :stroke="ORANGE" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
            <circle v-for="(p, i) in mappedSupply" :key="`sd-${i}`" :cx="p[0]" :cy="p[1]" r="4.5" :fill="ORANGE" />
          </g>
        </svg>

        <div
          class="absolute flex flex-col items-end text-right leading-none"
          :style="{ top: `${mapY(capY) - demandOffset}px`, right: `${rightOffset}px`, opacity: fadeDemand, color: BEIGE }"
        >
          <div class="font-serif font-h3 tabular-nums tracking-tight md:font-h2">{{ demandTotal }}</div>
          <div class="mt-1 font-body uppercase text-beige">{{ demand.label }}</div>
        </div>
        <div
          class="absolute flex max-w-[60%] flex-col items-end text-right leading-none"
          :style="{ top: `${mapY(252) - supplyOffset}px`, right: `${rightOffset}px`, opacity: fadeSupply, color: ORANGE }"
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

const inlineSerializer = { paragraph: ({ children }) => children }
const toHtml = (field) => {
  if (!field) return ''
  return typeof field === 'string' ? field : asHTML(field, { serializer: inlineSerializer }) || ''
}
const obj   = (g) => (Array.isArray(g) ? g[0] : g) || {}
const items = (g) => (Array.isArray(g) ? g : []).map((it) => (it && typeof it === 'object' ? it.value : it))

const headingHtml = computed(() => toHtml(props.slice.primary.heading))
const body    = computed(() => props.slice.primary.body || '')
const scrollLength = computed(() => Number(props.slice.primary.scroll_length) || 300)

const rootRef = ref(null)
const { progress, tall, coarse } = useScrollProgress(rootRef, {
  start: 'top top',
  end: (trigger) => `+=${trigger.offsetHeight - window.innerHeight * (1 + dwellVh.value / 100)}`,
  scrub: { fine: 1.2, coarse: 3 },
  waitForLayout: true,
})

const COARSE_LENGTH_MULT = 1.4
const dwellVh = computed(() => (coarse.value ? 100 : 60))
const totalVh = computed(
  () => scrollLength.value * (coarse.value ? COARSE_LENGTH_MULT : 1) + dwellVh.value,
)
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

const demandPoints = [
  [0, 96], [100, 96], [200, 80], [300, 80], [400, 80],
  [500, 56], [600, 40], [700, 40], [800, 24], [900, 8], [1000, 8],
]
const supplyPoints = [
  [0, 160], [100, 168], [200, 184], [300, 192], [400, 192],
  [500, 192], [600, 200], [700, 240], [800, 240], [900, 248], [1000, 252],
]
const Y_TOP = 0
const Y_BOTTOM = 320
const Y_LINE_COUNT = 5
const gridLines = computed(() => {
  const raw = props.slice.primary.y_ticks || []
  const ticks = (Array.isArray(raw) && raw.some((v) => v && typeof v === 'object') ? items(raw) : raw)
    .filter((v) => v != null && String(v).trim() !== '')
  const labels = ticks.length ? [...ticks].reverse() : Array(Y_LINE_COUNT).fill('')
  const n = labels.length
  return labels.map((label, i) => ({
    label,
    y: n > 1 ? Y_TOP + (Y_BOTTOM - Y_TOP) * (i / (n - 1)) : Y_TOP,
  }))
})

const capY = computed(() => {
  const rows = gridLines.value
  const gap = rows.length > 1 ? rows[1].y - rows[0].y : Y_BOTTOM - Y_TOP
  return rows[0].y - gap
})

const PAD_TOP = 36
const PAD_BOTTOM = 64
const bounds = ref({ width: 1000, height: 460 })

const mapX = (x) => (x / 1000) * bounds.value.width
const mapY = (y) => PAD_TOP + ((y + 40) / 480) * (bounds.value.height - PAD_TOP - PAD_BOTTOM)

const demandPeak = Math.min(...demandPoints.map((p) => p[1]))
const demandLift = computed(() => capY.value - demandPeak)
const mappedDemand = computed(() => demandPoints.map((p) => [mapX(p[0]), mapY(p[1] + demandLift.value)]))
const mappedSupply = computed(() => supplyPoints.map((p) => [mapX(p[0]), mapY(p[1])]))

const toPath    = (pts) => 'M ' + pts.map((p) => `${p[0]} ${p[1]}`).join(' L ')
const toPolygon = (pts) => toPath(pts) + ` L ${mapX(1000)} ${mapY(400)} L ${mapX(0)} ${mapY(400)} Z`

const demandLine = computed(() => toPath(mappedDemand.value))
const supplyLine = computed(() => toPath(mappedSupply.value))
const demandArea = computed(() => toPolygon(mappedDemand.value))
const supplyArea = computed(() => toPolygon(mappedSupply.value))

const isMobile = ref(false)
const demandOffset = computed(() => (isMobile.value ? 60 : 50))
const supplyOffset = computed(() => (isMobile.value ? 100 : 55))

const rightInset = computed(() => (isMobile.value ? 10 : 20))
const rightOffset = computed(() => bounds.value.width - mapX(1000) + rightInset.value)

const dProg = computed(() => clamp01(progress.value / 0.45))
const sProg = computed(() => clamp01((progress.value - 0.45) / 0.45))

const clipDemand = computed(() => `inset(0% ${(1 - dProg.value) * 100}% 0% 0%)`)
const clipSupply = computed(() => `inset(0% ${(1 - sProg.value) * 100}% 0% 0%)`)

const demandTotal = computed(() => fmt(Math.round(num(demand.value.value) * dProg.value)))
const supplyTotal = computed(() => fmt(Math.round(num(supply.value.value) * sProg.value)))

const fadeDemand = computed(() => lerp(0, 1, (progress.value - 0.40) / 0.06))
const fadeSupply = computed(() => lerp(0, 1, (progress.value - 0.85) / 0.05))

const chartRef = ref(null)
let ro = null
let mqlMobile = null
const onMobileChange = (e) => { isMobile.value = e.matches }

function measure() {
  const el = chartRef.value
  if (el) bounds.value = { width: el.clientWidth, height: el.clientHeight }
}

onMounted(() => {
  measure()
  ro = new ResizeObserver(measure)
  if (chartRef.value) ro.observe(chartRef.value)

  mqlMobile = window.matchMedia('(max-width: 767px)')
  isMobile.value = mqlMobile.matches
  mqlMobile.addEventListener('change', onMobileChange)
})

onUnmounted(() => {
  ro?.disconnect()
  mqlMobile?.removeEventListener('change', onMobileChange)
})
</script>
