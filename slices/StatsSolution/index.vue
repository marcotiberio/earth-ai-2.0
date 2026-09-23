<template>
  <section ref="rootRef" class="relative w-full overflow-x-clip bg-darkblue text-beige">
    <div
      ref="innerRef"
      class="boxed lg:flex lg:min-h-svh lg:flex-col lg:pb-[clamp(2rem,5vh,4rem)] lg:pt-[clamp(3rem,8rem,8rem)]"
      :class="pinned ? 'sticky' : ''"
      :style="pinned ? { top: `${stickyTop}px` } : null"
    >
      <div v-if="sectionLabel || titleHtml" class="flex flex-col gap-xs">
        <SectionLabel v-if="sectionLabel" :text="sectionLabel" />
        <h2
          v-if="titleHtml"
          class="ea-display font-serif font-h2 max-w-screen-lg"
          v-html="titleHtml"
        />
      </div>

      <div class="mt-sm flex flex-col gap-xs lg:mt-[clamp(1.5rem,4vh,4.5rem)] lg:flex-1 lg:gap-[clamp(0.75rem,1.5vh,1.3rem)]">
        <div
          v-if="top.value"
          ref="topRef"
          class="flex flex-col gap-sm rounded bg-beige p-xs text-black will-change-[opacity] md:min-h-[11.5rem] md:flex-row md:items-end md:justify-between md:gap-xs lg:min-h-fit lg:flex-1 lg:justify-start lg:p-[clamp(0.75rem,1.6vh,1rem)]"
          :style="{ opacity: topProgress }"
        >
          <div class="flex flex-col self-stretch md:w-[13.4rem] md:shrink-0">
            <p v-if="top.label" class="font-mono font-caption uppercase">
              <span :class="squareClass" />{{ top.label }}
            </p>
            <p class="mt-auto pt-xs font-serif text-[3.5rem] leading-[1.1] lg:text-[min(3.5rem,7vh)] xl:text-[min(5rem,9vh)]">{{ top.value }}</p>
            <p v-if="top.caption" class="font-mono font-caption uppercase">{{ top.caption }}</p>
          </div>
          <p v-if="top.description" class="max-w-[28rem] font-sansLight font-body leading-[1.2]">
            {{ top.description }}
          </p>
        </div>

        <ul
          v-if="cards.length"
          ref="cardsRef"
          class="grid grid-cols-1 gap-xs md:grid-cols-2 lg:flex-[1.4] lg:grid-cols-4 lg:gap-[clamp(0.75rem,1.5vh,1.3rem)]"
        >
          <li
            v-for="(card, i) in cards"
            :key="i"
            class="flex flex-col justify-between rounded-[6px] bg-[#152238]/50 p-xs will-change-[opacity,transform] md:min-h-[15rem] lg:min-h-fit lg:p-[clamp(0.75rem,1.6vh,1rem)]"
            :style="cardStyle(i)"
          >
            <p v-if="card.label" class="font-mono font-caption uppercase">
              <span :class="squareClass" />{{ card.label }}
            </p>
            <div>
              <p class="mt-[0.35rem] font-serif text-[3.5rem] leading-[1.1] lg:text-[min(3.5rem,7vh)] xl:text-[min(5rem,9vh)]">{{ card.value }}</p>
              <p v-if="card.caption" class="font-mono font-caption uppercase">{{ card.caption }}</p>
            </div>
            <p v-if="card.description" class="mt-auto max-w-[22rem] pt-sm font-sansLight font-body leading-[1.2] lg:pt-[clamp(0.75rem,2vh,2.5rem)]">
              {{ card.description }}
            </p>
          </li>
        </ul>

        <div
          v-if="bottom.value"
          ref="bottomRef"
          class="grid overflow-hidden rounded will-change-[opacity] lg:flex-1"
          :style="{ opacity: bottomReveal }"
        >
          <div
            v-for="layer in bottomLayers"
            :key="layer.key"
            class="flex flex-col gap-sm p-xs [grid-area:1/1] md:min-h-[11.5rem] md:flex-row md:items-end md:justify-between md:gap-xs lg:min-h-fit lg:justify-start lg:p-[clamp(0.75rem,1.6vh,1rem)]"
            :class="layer.class"
            :style="layer.style"
            :aria-hidden="layer.hidden ? 'true' : undefined"
          >
            <div class="flex flex-col self-stretch md:w-[13.4rem] md:shrink-0">
              <p v-if="bottom.label" class="font-mono font-caption uppercase">
                <span :class="squareClass" />{{ bottom.label }}
              </p>
              <p class="mt-auto pt-xs font-serif text-[3.5rem] leading-[1.1] tabular-nums lg:text-[min(3.5rem,7vh)] xl:text-[min(5rem,9vh)]">{{ bottomCount }}</p>
              <p v-if="bottom.caption" class="font-mono font-caption uppercase">{{ bottom.caption }}</p>
            </div>
            <p v-if="bottom.description" class="max-w-[28rem] font-sansLight font-body leading-[1.2]">
              {{ bottom.description }}
            </p>
          </div>
        </div>
      </div>
    </div>
    <div v-if="pinned" aria-hidden="true" :style="{ height: `${holdVh}vh` }" />
  </section>
</template>

<script setup>
import { ref, computed, inject, onMounted, onUnmounted } from 'vue'
import { asHTML } from '@prismicio/client'

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

const squareClass = 'mr-[0.5em] inline-block h-[0.8em] w-[0.75em] rounded-[3px] bg-current align-[-0.05em]'

const primary = computed(() => props.slice.primary)

const sectionLabel = computed(() => primary.value.section_label || '')
const titleHtml    = computed(() => toHtml(primary.value.title))

const statFrom = (group) => {
  const item = (Array.isArray(group) ? group[0] : group) || {}
  return {
    label:       item.label || '',
    value:       item.value || '',
    caption:     item.caption || '',
    description: item.description || '',
  }
}

const top    = computed(() => statFrom(primary.value.top))
const bottom = computed(() => statFrom(primary.value.bottom))
const cards  = computed(() => (primary.value.cards || []).filter((card) => card.value))

const inSimulator = inject('inSliceSimulator', false)
const rootRef   = ref(null)
const innerRef  = ref(null)
const topRef    = ref(null)
const cardsRef  = ref(null)
const bottomRef = ref(null)

const { progress, tall } = inSimulator
  ? { progress: ref(1), tall: ref(false) }
  : useScrollProgress(rootRef, { start: 'top bottom', end: 'bottom top', scrub: 1 })

const pinned = computed(() => tall.value)

const HOLD_ROW_VH = 170
const DWELL_VH    = 40
const LEAD_VH     = 0.1
const GAP_VH      = 0.12
const TOP_VH      = 0.5
const REVEAL_VH   = 0.3
const FILL_VH     = 0.65
const CARD_SLIDE  = 3

const CARD_DELAY      = 0.25
const CARD_STAGGER_VH = 0.24
const CARD_FADE_VH    = 0.48

const CARD_ENTER_VH         = 1
const CARD_STAGGER_STACK_VH = 0.15
const CARD_FADE_STACK_VH    = 0.3
const BAR_ENTER_VH          = 1

const box = ref({ vh: 0, sectionH: 0, innerH: 0, top: 0, cardTops: [], cardH: 0, bottom: 0 })

function measure() {
  const root  = rootRef.value
  const inner = innerRef.value
  if (!root || !inner) return
  box.value = {
    vh:       window.innerHeight,
    sectionH: root.offsetHeight,
    innerH:   inner.offsetHeight,
    top:      topRef.value?.offsetTop ?? 0,
    cardTops: cardsRef.value ? [...cardsRef.value.children].map((el) => el.offsetTop) : [],
    cardH:    cardsRef.value?.firstElementChild?.offsetHeight ?? 0,
    bottom:   bottomRef.value?.offsetTop ?? 0,
  }
}

const stickyTop = computed(() => Math.min(0, box.value.vh - box.value.innerH))

const oneRow = computed(() => {
  const tops = box.value.cardTops
  return tops.length > 1 && tops.every((t) => Math.abs(t - tops[0]) < 2)
})

const cardTiming = computed(() => {
  const { vh, top, cardTops, cardH } = box.value
  const first = cardTops[0] ?? 0
  if (!oneRow.value) {
    return {
      base:    first + (1 - CARD_ENTER_VH) * vh,
      stagger: CARD_STAGGER_STACK_VH * vh,
      fade:    CARD_FADE_STACK_VH * vh,
    }
  }
  const topEnd    = LEAD_VH * vh + top + TOP_VH * vh
  const cardShift = CARD_DELAY * (0.2 * vh + cardH)
  return {
    base:    Math.max(LEAD_VH * vh + first + cardShift, topEnd + GAP_VH * vh),
    stagger: CARD_STAGGER_VH * vh,
    fade:    CARD_FADE_VH * vh,
  }
})

function cardWindow(i) {
  const { cardTops } = box.value
  const { base, stagger, fade } = cardTiming.value
  const row  = cardTops[i] ?? 0
  const col  = i - cardTops.findIndex((t) => Math.abs(t - row) < 2)
  const from = base + (row - (cardTops[0] ?? 0)) + stagger * col
  return [from, from + fade]
}

const cardsEnd = computed(() => {
  let end = cardTiming.value.base
  for (let i = 0; i < box.value.cardTops.length; i += 1) {
    end = Math.max(end, cardWindow(i)[1])
  }
  return end
})

const stackBar = computed(() => {
  const { vh, bottom } = box.value
  const barStart  = Math.max(bottom + (1 - BAR_ENTER_VH) * vh, cardsEnd.value)
  const fillStart = barStart + REVEAL_VH * vh
  return { barStart, fillStart, fillEnd: fillStart + FILL_VH * vh }
})

const holdVh = computed(() => {
  if (oneRow.value) return HOLD_ROW_VH
  const { vh, innerH } = box.value
  if (!vh) return DWELL_VH
  const pinStart = Math.max(vh, innerH)
  return Math.max(DWELL_VH, ((stackBar.value.fillEnd - pinStart) / vh) * 100 + DWELL_VH)
})

const timeline = computed(() => {
  const { vh, innerH, top } = box.value
  const pinEnd   = Math.max(vh, innerH) + (vh * holdVh.value) / 100
  const dwellEnd = pinEnd - (vh * DWELL_VH) / 100

  const topStart = LEAD_VH * vh + top
  const topEnd   = topStart + TOP_VH * vh

  if (oneRow.value) {
    return {
      top:     [topStart, topEnd],
      reveal:  [topStart, topEnd],
      fill:    null,
      headEnd: dwellEnd,
    }
  }

  const { barStart, fillStart, fillEnd } = stackBar.value

  return {
    top:     [topStart, topEnd],
    reveal:  [barStart, fillStart],
    fill:    [fillStart, fillEnd],
    headEnd: barStart,
  }
})

const scrolled = computed(() => progress.value * (box.value.sectionH + box.value.vh))

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const easeInOut = (t) => t * t * (3 - 2 * t)

function phase(key) {
  if (!pinned.value) return 1
  const [from, to] = timeline.value[key]
  if (to <= from) return scrolled.value > from ? 1 : 0
  return clamp01((scrolled.value - from) / (to - from))
}

const topProgress = computed(() => easeInOut(phase('top')))

function cardProgress(i) {
  if (!pinned.value) return 1
  const [from, span] = cardWindow(i)
  const to = Math.min(span, timeline.value.headEnd)
  if (to <= from) return scrolled.value > from ? 1 : 0
  return easeInOut(clamp01((scrolled.value - from) / (to - from)))
}

function cardStyle(i) {
  const t = cardProgress(i)
  return { opacity: t, transform: `translateX(${(t - 1) * CARD_SLIDE}rem)` }
}

const bottomReveal = computed(() => easeInOut(phase('reveal')))

const bottomFill = computed(() => {
  if (timeline.value.fill) return phase('fill')
  const n = cards.value.length
  if (!n) return pinned.value ? 0 : 1
  let sum = 0
  for (let i = 0; i < n; i += 1) sum += cardProgress(i)
  return sum / n
})

let resizeObserver = null
onMounted(() => {
  measure()
  window.addEventListener('resize', measure)
  if (typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(measure)
  resizeObserver.observe(innerRef.value)
  resizeObserver.observe(rootRef.value)
})
onUnmounted(() => {
  window.removeEventListener('resize', measure)
  resizeObserver?.disconnect()
})

function parseValue(str) {
  const s = String(str ?? '')
  const m = s.match(/-?[\d,]*\.?\d+/)
  if (!m) return { raw: s, target: null }
  const numStr = m[0]
  return {
    target:   parseFloat(numStr.replace(/,/g, '')),
    decimals: numStr.includes('.') ? numStr.split('.')[1].length : 0,
    prefix:   s.slice(0, m.index),
    suffix:   s.slice(m.index + numStr.length),
  }
}

const bottomCount = computed(() => {
  const p = parseValue(bottom.value.value)
  if (p.target === null) return p.raw
  const num = (p.target * bottomFill.value).toLocaleString('en-US', {
    minimumFractionDigits: p.decimals,
    maximumFractionDigits: p.decimals,
  })
  return `${p.prefix}${num}${p.suffix}`
})

const bottomLayers = computed(() => [
  { key: 'track', class: 'bg-[#152238]/50 text-beige' },
  {
    key: 'fill',
    class: 'bg-yellow text-black',
    hidden: true,
    style: { clipPath: `inset(0 ${(1 - bottomFill.value) * 100}% 0 0)` },
  },
])
</script>
