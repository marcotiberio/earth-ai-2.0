<template>
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
            <p
              v-if="body"
              class="mt-0 md:mt-sm max-w-md font-body text-beige lg:mt-0"
            >
              {{ body }}
            </p>
          </div>
        </div>

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
            <g v-html="AUSTRALIA" />
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
import { ref, computed } from 'vue'
import { asHTML } from '@prismicio/client'
import australiaRaw from './australia.svg?raw'
import markersRaw from './markers.svg?raw'

const props = defineProps({
  slice:   { type: Object, required: true },
  context: { type: Object },
  index:   { type: Number },
  slices:  { type: Array },
})

const inlineSerializer = { paragraph: ({ children }) => children }
const toHtml = (field) => {
  if (!field) return ''
  return typeof field === 'string'
    ? field
    : asHTML(field, { serializer: inlineSerializer }) || ''
}

const titleHtml = computed(() => toHtml(props.slice.primary.title))
const body      = computed(() => props.slice.primary.body || '')
const stats     = computed(() => (props.slice.primary.stats || []).slice(0, 4))
const scrollLength = computed(() => Number(props.slice.primary.scroll_length) || 300)

const mapLabel = computed(() =>
  stats.value.map((s) => `${counter(s.value)} ${s.label}`).join(', ') || 'Continental target map'
)

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

const rootRef = ref(null)
const { progress, tall } = useScrollProgress(rootRef, {
  start: 'top center',
  end: (_, coarse) => `bottom bottom+=${window.innerHeight * (coarse ? 0.75 : 0.5)}`,
  scrub: { fine: 1, coarse: 3 },
})

const inner = (s) => s.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
const AUSTRALIA = inner(australiaRaw)
const MARKERS   = inner(markersRaw)

const markers = MARKERS.match(/<g opacity="0.85">[\s\S]*?<\/g>/g) || []

const seededRand = (i) => {
  let t = Math.imul(i + 1, 2654435761) >>> 0
  t ^= t >>> 15; t = Math.imul(t, 2246822519)
  t ^= t >>> 13; t = Math.imul(t, 3266489917)
  t ^= t >>> 16
  return (t >>> 0) / 4294967296
}

const REVEAL_SPREAD = 0.82
const REVEAL_BAND   = 0.12
const thresholds = markers.map((_, i) => seededRand(i) * REVEAL_SPREAD)
const markerOpacity = (i) =>
  Math.max(0, Math.min(1, (progress.value - thresholds[i]) / REVEAL_BAND))

</script>
