<template>
  <section class="relative w-full bg-darkblue px-6 py-24 md:px-10 md:py-32">
    <!-- Heading + intro -->
    <div class="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
      <h2
        class="ea-display font-serif text-beige font-h2 font-normal leading-[1.1] max-w-xl"
        v-html="slice.primary.heading"
      />
      <p
        v-if="slice.primary.body"
        class="text-grey font-body leading-relaxed max-w-md"
      >
        {{ slice.primary.body }}
      </p>
    </div>

    <!-- Chart -->
    <div class="mt-16 flex gap-4 md:gap-8">
      <!-- Y axis ticks -->
      <div class="flex flex-col-reverse justify-between font-caption text-grey py-1">
        <span v-for="t in slice.primary.y_ticks" :key="t">{{ t }}</span>
      </div>

      <div class="flex-1">
        <svg
          viewBox="0 0 1000 460"
          preserveAspectRatio="none"
          class="w-full h-[42vh] md:h-[52vh]"
          role="img"
          :aria-label="`Projected demand of ${demand.value} against ${supply.value} ${supply.label}`"
        >
          <!-- horizontal gridlines, one per y tick -->
          <g stroke="currentColor" class="text-beige/10" stroke-dasharray="2 6">
            <line v-for="(t, i) in slice.primary.y_ticks" :key="i"
              x1="0" :x2="1000" :y1="gridY(i)" :y2="gridY(i)" />
          </g>

          <!-- the deficit gap (between supply ceiling and demand curve) -->
          <path :d="gapArea" class="fill-beige/10" />
          <!-- demand curve -->
          <path :d="demandLine" fill="none" stroke="currentColor"
            class="text-beige" stroke-width="3" />
          <!-- supply curve -->
          <path :d="supplyLine" fill="none" stroke="currentColor"
            class="text-grey" stroke-width="3" stroke-dasharray="8 6" />
        </svg>

        <!-- X axis labels -->
        <div class="mt-4 flex justify-between font-caption text-grey">
          <span v-for="x in slice.primary.x_labels" :key="x">{{ x }}</span>
        </div>
      </div>

      <!-- Endpoint annotations -->
      <div class="flex flex-col justify-between w-28 md:w-44 py-1">
        <div>
          <div class="font-serif text-beige font-h2 leading-none">{{ demand.value }}</div>
          <div class="mt-2 font-caption tracking-widest text-grey">{{ demand.label }}</div>
        </div>
        <div>
          <div class="font-serif text-beige font-h2 leading-none">{{ supply.value }}</div>
          <div class="mt-2 font-caption tracking-widest text-grey">{{ supply.label }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  slice:   { type: Object, required: true },
  context: { type: Object },
  index:   { type: Number },
  slices:  { type: Array },
})

const demand = computed(() => props.slice.primary.demand || { label: 'DEMAND', value: '' })
const supply = computed(() => props.slice.primary.supply || { label: '', value: '' })

// Editorial curves: demand outruns a plateauing supply, leaving the visible deficit.
// Coordinates are in the 1000×460 viewBox (y grows downward).
const demandLine = 'M0,400 C320,360 520,260 1000,40'
const supplyLine = 'M0,420 C320,400 560,330 1000,290'
// Gap = area enclosed between the two curves.
const gapArea = `${demandLine} L1000,290 C560,330 320,400 0,420 Z`

const ticks = computed(() => props.slice.primary.y_ticks?.length || 1)
const gridY = (i) => 440 - (i / (ticks.value - 1 || 1)) * 420
</script>
