<template>
  <section class="relative w-full bg-darkblue text-beige">
    <div class="boxed">
      <div v-if="sectionLabel || titleHtml" class="flex flex-col gap-xs">
        <SectionLabel v-if="sectionLabel" :text="sectionLabel" />
        <h2
          v-if="titleHtml"
          class="ea-display font-serif font-h2 max-w-screen-lg"
          v-html="titleHtml"
        />
      </div>

      <div class="mt-sm flex flex-col gap-xs lg:mt-[4.5rem] lg:gap-[1.3rem]">
        <div
          v-if="top.value"
          ref="topRef"
          class="flex flex-col gap-sm rounded bg-beige p-xs text-black will-change-[opacity] md:min-h-[11.5rem] md:flex-row md:items-end md:justify-between md:gap-xs lg:justify-start"
          :style="{ opacity: topProgress }"
        >
          <div class="flex flex-col self-stretch md:w-[13.4rem] md:shrink-0">
            <p v-if="top.label" class="font-mono font-caption uppercase">
              <span :class="squareClass" />{{ top.label }}
            </p>
            <p class="mt-auto pt-xs font-serif text-[3.5rem] leading-[1.1] xl:text-[5rem]">{{ top.value }}</p>
            <p v-if="top.caption" class="font-mono font-caption uppercase">{{ top.caption }}</p>
          </div>
          <p v-if="top.description" class="max-w-[28rem] font-sansLight font-body leading-[1.2]">
            {{ top.description }}
          </p>
        </div>

        <ul
          v-if="cards.length"
          ref="cardsRef"
          class="grid grid-cols-1 gap-xs md:grid-cols-2 lg:grid-cols-4 lg:gap-[1.3rem]"
        >
          <li
            v-for="(card, i) in cards"
            :key="i"
            class="flex flex-col rounded-[6px] bg-[#152238]/50 p-xs will-change-[opacity] md:min-h-[15rem] lg:min-h-[17.4rem]"
            :style="{ opacity: cardProgress(i) }"
          >
            <p v-if="card.label" class="font-mono font-caption uppercase">
              <span :class="squareClass" />{{ card.label }}
            </p>
            <p class="mt-[0.35rem] font-serif text-[3.5rem] leading-[1.1] xl:text-[5rem]">{{ card.value }}</p>
            <p v-if="card.caption" class="font-mono font-caption uppercase">{{ card.caption }}</p>
            <p v-if="card.description" class="mt-auto max-w-[22rem] pt-sm font-sansLight font-body leading-[1.2]">
              {{ card.description }}
            </p>
          </li>
        </ul>

        <div
          v-if="bottom.value"
          ref="bottomRef"
          class="grid overflow-hidden rounded will-change-[opacity]"
          :style="{ opacity: bottomReveal }"
        >
          <div
            v-for="layer in bottomLayers"
            :key="layer.key"
            class="flex flex-col gap-sm p-xs [grid-area:1/1] md:min-h-[11.5rem] md:flex-row md:items-end md:justify-between md:gap-xs lg:justify-start"
            :class="layer.class"
            :style="layer.style"
            :aria-hidden="layer.hidden ? 'true' : undefined"
          >
            <div class="flex flex-col self-stretch md:w-[13.4rem] md:shrink-0">
              <p v-if="bottom.label" class="font-mono font-caption uppercase">
                <span :class="squareClass" />{{ bottom.label }}
              </p>
              <p class="mt-auto pt-xs font-serif text-[3.5rem] leading-[1.1] tabular-nums xl:text-[5rem]">{{ bottomCount }}</p>
              <p v-if="bottom.caption" class="font-mono font-caption uppercase">{{ bottom.caption }}</p>
            </div>
            <p v-if="bottom.description" class="max-w-[28rem] font-sansLight font-body leading-[1.2]">
              {{ bottom.description }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
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

const topRef    = ref(null)
const cardsRef  = ref(null)
const bottomRef = ref(null)

const scrollProgress = (trigger, options) => {
  if (inSimulator) return { progress: ref(1) }
  return useScrollProgress(trigger, { scrub: 1, ...options })
}

const { progress: topProgress } = scrollProgress(topRef, {
  start: 'top 90%',
  end: 'top 55%',
})

const { progress: cardsProgress } = scrollProgress(cardsRef, {
  start: 'top 90%',
  end: 'bottom 70%',
})

const { progress: bottomProgress } = scrollProgress(bottomRef, {
  start: 'top 90%',
  end: 'bottom 65%',
})

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const easeInOut = (t) => t * t * (3 - 2 * t)

const CARD_SPAN = 0.4
function cardProgress(i) {
  const n = cards.value.length
  const stagger = n > 1 ? (1 - CARD_SPAN) / (n - 1) : 0
  return easeInOut(clamp01((cardsProgress.value - i * stagger) / CARD_SPAN))
}

const REVEAL_SPAN = 0.25
const bottomReveal = computed(() => easeInOut(clamp01(bottomProgress.value / REVEAL_SPAN)))
const bottomFill   = computed(() => clamp01((bottomProgress.value - REVEAL_SPAN) / (1 - REVEAL_SPAN)))

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
    class: 'bg-[#F6CF58] text-black',
    hidden: true,
    style: { clipPath: `inset(0 ${(1 - bottomFill.value) * 100}% 0 0)` },
  },
])
</script>
