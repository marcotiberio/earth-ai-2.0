<template>
  <!--
    An animated take on `ComparisonBars`: the same metric-vs-metric data, but the
    bars grow left→right and their numbers count up the first time the section
    scrolls into view (a reveal port of the DrilledStats count-up). Each group is
    normalised to its own largest value; the highlighted row (EARTH AI) gets the
    orange gradient + number colour, everything else stays beige/grey. Under
    reduced motion we skip straight to the finished state.
  -->
  <section
    ref="rootRef"
    class="relative w-full bg-darkblue"
    :class="tall ? 'h-[220vh]' : ''"
  >
    <div
      class="boxed"
      :class="tall ? 'sticky top-0 flex h-screen flex-col justify-between pt-md pb-md lg:pt-lg md:pb-sm overflow-hidden' : 'flex min-h-screen flex-col justify-between py-lg'"
    >
      <h2
        class="ea-display font-serif text-beige font-h2 font-normal max-w-screen-lg"
        v-html="headingHtml"
      />

      <div class="mt-sm flex flex-col justify-end gap-sm">
        <div v-for="(group, gi) in groups" :key="gi">
          <!-- metric label + dotted rule -->
          <div class="font-caption font-medium tracking-[0.25em] text-grey">{{ group.metric }}</div>
          <hr class="ea-rule mt-3" />

          <!-- bars -->
          <div class="mt-sm flex flex-col gap-xs md:gap-sm">
            <div
              v-for="(row, ri) in group.rows"
              :key="ri"
              class="grid grid-cols-[7rem_1fr] items-center gap-4 md:grid-cols-[12rem_1fr] md:gap-8"
            >
              <span
                class="font-label"
                :class="row.highlight ? 'text-[#E66F3E]' : 'text-beige'"
              >
                {{ row.label }}
              </span>

              <div class="flex min-w-0 items-center">
                <!-- the bar itself — width is the normalised target scaled by progress -->
                <div
                  class="h-sm shrink-0 rounded-[3px] md:h-md"
                  :style="[barStyle(row), { width: barWidth(group, row) }]"
                />

                <!-- count-up number, sitting just past the bar's tip -->
                <div
                  class="ml-4 flex shrink-0 flex-col leading-none whitespace-nowrap md:ml-5"
                  :class="row.highlight ? 'text-[#E66F3E]' : 'text-beige'"
                >
                  <span class="font-serif font-h3 tabular-nums md:font-h2">
                    {{ display(group, row.value) }}
                  </span>
                  <span
                    v-if="group.unit && group.unit !== '%'"
                    class="mt-1 font-caption font-medium tracking-[0.2em]"
                  >
                    {{ group.unit }}
                  </span>
                </div>
              </div>
            </div>
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

const ORANGE = '#E66F3E'

// --- Content (tolerate static-string and live Prismic shapes) ----------------
const inlineSerializer = { paragraph: ({ children }) => children }
const toHtml = (field) => {
  if (!field) return ''
  return typeof field === 'string'
    ? field
    : asHTML(field, { serializer: inlineSerializer }) || ''
}

const headingHtml = computed(() => toHtml(props.slice.primary.heading))
// Groups can hang off primary.items (mirrors ComparisonBars) or the slice's
// repeatable items — accept whichever is present.
const groups = computed(() => props.slice.primary.items || props.slice.items || [])

// --- Bar width + count-up (both driven by the same reveal progress) ----------
// Bars are normalised to the largest value in their own group, scaled by FILL
// so the longest bar still leaves room for the number sitting past its tip, with
// a small floor so a near-zero value (e.g. 0.5%) still shows a sliver.
const FILL = 0.82
function targetPct(group, row) {
  const max = Math.max(...group.rows.map((r) => Number(r.value)))
  const pct = max ? (Number(row.value) / max) * 100 * FILL : 0
  return Math.max(pct, 1.5)
}
function barWidth(group, row) {
  return `${targetPct(group, row) * progress.value}%`
}

function decimalsFor(value) {
  const s = String(value)
  return s.includes('.') ? s.split('.')[1].length : 0
}
function countUp(value) {
  const decimals = decimalsFor(value)
  const cur = Number(value) * progress.value
  return cur.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
function display(group, value) {
  return group.unit === '%' ? `${countUp(value)}%` : countUp(value)
}

function barStyle(row) {
  return row.highlight
    ? {
        borderTop: `2px solid ${ORANGE}`,
        background: 'linear-gradient(180deg, rgba(230,111,62,0.55) 0%, rgba(230,111,62,0.04) 100%)',
      }
    : {
        borderTop: '2px solid rgba(250,243,228,0.85)',
        background: 'linear-gradient(180deg, rgba(138,147,166,0.40) 0%, rgba(138,147,166,0.02) 100%)',
      }
}

// --- Scroll-driven progress (pinned scrub) -----------------------------------
// The section is tall so its inner panel can stick and scrub progress 0→1 as you
// scroll past, growing every bar's width and counting its number up together.
// `tall` starts true so SSR and client render identically; reduced-motion
// clients drop it to a normal-height section and show the finished state.
const rootRef  = ref(null)
const progress = ref(0)
const tall     = ref(true)

let ctx = null

onMounted(async () => {
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
      duration: 1.6,
      ease: 'power2.out',
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

onUnmounted(() => ctx?.revert())
</script>
