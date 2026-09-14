<template>
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
          <div class="font-caption text-beige uppercase">{{ group.metric }}</div>
          <DottedLine class="hidden md:block w-full mt-3" />

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
                <div
                  class="h-sm shrink-0 rounded-[3px] md:h-md"
                  :style="[barStyle(row), { width: barWidth(group, row, gi) }]"
                />

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
import { ref, computed } from 'vue'
import { asHTML } from '@prismicio/client'

const props = defineProps({
  slice:   { type: Object, required: true },
  context: { type: Object },
  index:   { type: Number },
  slices:  { type: Array },
})

const ORANGE = '#E66F3E'

const inlineSerializer = { paragraph: ({ children }) => children }
const toHtml = (field) => {
  if (!field) return ''
  return typeof field === 'string'
    ? field
    : asHTML(field, { serializer: inlineSerializer }) || ''
}

const headingHtml = computed(() => toHtml(props.slice.primary.heading))
const groups = computed(() => props.slice.primary.items || props.slice.items || [])

const scrollLength = computed(() => Number(props.slice.primary.scroll_length) || 360)

const rootRef = ref(null)
const { progress, tall, coarse } = useScrollProgress(rootRef, {
  start: 'top top',
  end: (trigger) => `+=${trigger.offsetHeight - window.innerHeight * (1 + dwellVh.value / 100)}`,
  scrub: { fine: 2.5, coarse: 3 },
  waitForLayout: true,
})

const COARSE_LENGTH_MULT = 1.4
const dwellVh = computed(() => (coarse.value ? 100 : 60))
const totalVh = computed(
  () => scrollLength.value * (coarse.value ? COARSE_LENGTH_MULT : 1) + dwellVh.value,
)

const FILL = 0.82
function targetPct(group, row) {
  const max = Math.max(...group.rows.map((r) => Number(r.value)))
  const pct = max ? (Number(row.value) / max) * 100 * FILL : 0
  return Math.max(pct, 1.5)
}

const easeInOut = (t) => t * t * (3 - 2 * t)
function groupProgress(gi) {
  const n = groups.value.length || 1
  const seg = 1 / n
  const t = Math.min(1, Math.max(0, (progress.value - gi * seg) / seg))
  return easeInOut(t)
}

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

</script>
