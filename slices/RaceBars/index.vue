<template>
  <!--
    Animated metric-vs-metric comparison: the bars grow left→right and their
    numbers count up the first time the section
    scrolls into view (a reveal port of the DrilledStats count-up). Each group is
    normalised to its own largest value; the highlighted row (EARTH AI) gets the
    orange gradient + number colour, everything else stays beige/grey. Under
    reduced motion we skip straight to the finished state.
  -->
  <section
    ref="rootRef"
    class="relative w-full bg-darkblue"
    :style="tall ? { height: `${totalVh}vh` } : null"
  >
    <div
      class="boxed"
      :class="tall ? 'sticky top-0 flex h-screen flex-col justify-between boxed overflow-hidden' : 'flex min-h-screen flex-col justify-between boxed'"
    >
      <h2
        class="ea-display font-serif text-beige font-h2 font-normal max-w-screen-lg"
        v-html="headingHtml"
      />

      <div class="mt-xs flex flex-col justify-end gap-xs">
        <div class="racebar p-xs bg-[#FAF3E40D] rounded" v-for="(group, gi) in groups" :key="gi">
          <!-- metric label + dotted rule -->
          <div class="font-caption text-beige uppercase">{{ group.metric }}</div>
          <DottedLine class="hidden md:block w-full mt-3" />

          <!-- bars -->
          <div class="mt-xs flex flex-col gap-xs md:gap-xs">
            <div
              v-for="(row, ri) in group.rows"
              :key="ri"
              class="grid grid-cols-1 items-center gap-2 md:grid-cols-[12rem_1fr] md:gap-8"
            >
              <span
                class="font-label"
                :class="row.highlight ? 'text-orange' : 'text-beige'"
              >
                {{ row.label }}
              </span>

              <div class="flex min-w-0 items-center">
                <!-- the bar itself — width is the normalised target scaled by progress -->
                <div
                  class="h-sm shrink-0 rounded-[3px] md:h-md"
                  :style="[barStyle(row), { width: barWidth(group, row, gi) }]"
                />

                <!-- count-up number, sitting just past the bar's tip -->
                <div
                  class="ml-4 flex shrink-0 flex-col leading-none whitespace-nowrap md:ml-5"
                  :class="row.highlight ? 'text-orange' : 'text-beige'"
                >
                  <span class="font-serif font-h3 tabular-nums md:font-h2">
                    {{ display(group, row, gi) }}
                  </span>
                  <span
                    v-if="group.unit && group.unit !== '%'"
                    class="mt-1 font-caption"
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
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
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
// Groups can hang off primary.items or the slice's repeatable items — accept
// whichever is present.
const groups = computed(() => props.slice.primary.items || props.slice.items || [])

// Pinned scroll distance (vh) — editable per section; defaults to 360. A larger
// value spreads the same 0→1 progress over more scrolling, so the bars grow more
// slowly. Each group only gets ~1/N of this, so bump it when adding groups.
const scrollLength = computed(() => Number(props.slice.primary.scroll_length) || 360)

// Touch scrolling is native (Lenis only smooths wheel input), so a momentum
// flick out of the tall pinned video sections rips through this scene. On
// coarse pointers the same animation is stretched over more scroll. On every
// device the animation finishes `dwellVh` of pinned scroll before the sticky
// releases, holding the completed bars + numbers on screen so they can be
// digested (the scrub lerp settles during this dwell too).
const COARSE_LENGTH_MULT = 1.4
const coarse  = ref(false)
const dwellVh = computed(() => (coarse.value ? 100 : 60))
const totalVh = computed(
  () => scrollLength.value * (coarse.value ? COARSE_LENGTH_MULT : 1) + dwellVh.value,
)

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

// Each racebar (group) animates in turn: group 0 plays over the first 1/N of the
// scroll, group 1 over the next, and so on — so #2 only starts once #1 finishes.
// The master progress is linear (see the tween below) so every group gets an
// equal scroll budget; we apply a smoothstep ease *within* each group's segment
// so the sweep accelerates in and settles softly into its finish.
const easeInOut = (t) => t * t * (3 - 2 * t)
function groupProgress(gi) {
  const n = groups.value.length || 1
  const seg = 1 / n
  const t = Math.min(1, Math.max(0, (progress.value - gi * seg) / seg))
  return easeInOut(t)
}

// Within a group every bar grows at the same constant speed (a single fill front
// sweeping right), so the smallest bar reaches its target first and the largest
// keeps growing until the group's segment ends. `barFill` is the 0→1 fraction of
// this bar's own target that's currently shown.
function maxTargetPct(group) {
  return Math.max(...group.rows.map((r) => targetPct(group, r)))
}
function barFill(group, row, gi) {
  const t = targetPct(group, row)
  if (!t) return 0
  const filled = groupProgress(gi) * maxTargetPct(group)
  return Math.min(filled / t, 1)
}
function barWidth(group, row, gi) {
  return `${targetPct(group, row) * barFill(group, row, gi)}%`
}

function decimalsFor(value) {
  const s = String(value)
  return s.includes('.') ? s.split('.')[1].length : 0
}
function countUp(value, fill) {
  const decimals = decimalsFor(value)
  const cur = Number(value) * fill
  return cur.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
function display(group, row, gi) {
  const fill = barFill(group, row, gi)
  return group.unit === '%' ? `${countUp(row.value, fill)}%` : countUp(row.value, fill)
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

  coarse.value = window.matchMedia('(pointer: coarse)').matches
  // Let the coarse multiplier reach the section's height before measuring.
  await nextTick()

  const { gsap }              = await import('gsap')
  const { ScrollTrigger: ST } = await import('gsap/ScrollTrigger')
  gsap.registerPlugin(ST)

  ctx = gsap.context(() => {
    const state = { p: 0 }
    gsap.to(state, {
      p: 1,
      duration: 2,
      // Linear scroll→progress mapping: each group's segment is shaped by its own
      // smoothstep ease (see groupProgress), so the per-group easing isn't skewed
      // by a curve spanning the whole section.
      ease: 'none',
      scrollTrigger: {
        trigger,
        // Start at the pin (not 'top center'): the section's scroll-in is the
        // momentum buffer after the video sections — the chart waits at 0%
        // while a flick decays instead of playing its first group off-screen.
        start: 'top top',
        // Finish `dwellVh` before the pin releases (cf. ScrubScene's tailVh).
        end: () => `+=${trigger.offsetHeight - window.innerHeight * (1 + dwellVh.value / 100)}`,
        scrub: coarse.value ? 3 : 2.5,
      },
      onUpdate: () => { progress.value = state.p },
    })
  }, trigger)
})

onUnmounted(() => ctx?.revert())
</script>
