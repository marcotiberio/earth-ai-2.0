<template>
  <section class="relative w-full bg-darkblue px-6 py-24 md:px-10 md:py-32">
    <h2
      class="ea-display font-serif text-beige font-h2 font-normal leading-[1.1] max-w-2xl"
      v-html="slice.primary.heading"
    />

    <div class="mt-16 flex flex-col gap-16">
      <div v-for="(group, gi) in slice.primary.items" :key="gi">
        <!-- metric label + rule -->
        <div class="font-caption tracking-[0.2em] text-grey">{{ group.metric }}</div>
        <hr class="ea-rule mt-3" />

        <!-- bars -->
        <div class="mt-8 flex flex-col gap-6">
          <div
            v-for="(row, ri) in group.rows"
            :key="ri"
            class="grid grid-cols-[8rem_1fr] items-center gap-4 md:grid-cols-[12rem_1fr] md:gap-8"
          >
            <span class="font-label" :class="row.highlight ? 'text-beige' : 'text-grey'">
              {{ row.label }}
            </span>

            <div class="relative h-9 md:h-11">
              <div
                class="h-full flex items-center justify-end pr-4 transition-[width] duration-700"
                :class="row.highlight ? 'bg-beige' : 'bg-beige/15'"
                :style="{ width: barWidth(group, row) }"
              >
                <span
                  class="font-serif font-h3 leading-none whitespace-nowrap"
                  :class="row.highlight ? 'text-darkblue' : 'text-beige'"
                >
                  {{ formatValue(group, row.value) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
const props = defineProps({
  slice:   { type: Object, required: true },
  context: { type: Object },
  index:   { type: Number },
  slices:  { type: Array },
})

// Bars are normalised to the largest value in their own group, with a small
// floor so a near-zero value (e.g. 0.5%) still shows a sliver.
function barWidth(group, row) {
  const max = Math.max(...group.rows.map(r => Number(r.value)))
  const pct = max ? (Number(row.value) / max) * 100 : 0
  return `${Math.max(pct, 4)}%`
}

function formatValue(group, value) {
  return group.unit === '%' ? `${value}%` : `${value} ${group.unit}`.trim()
}
</script>
