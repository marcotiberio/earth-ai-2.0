<template>
  <ScrubScene
    :video-url="videoUrl"
    :image="slice.primary.image || {}"
    :scroll-length="slice.primary.scroll_length || 300"
    :scrub-start="slice.primary.scrub_start || ''"
    align="bottom"
    overlay-class="bg-darkblue/40"
    eager
  >

    <template #pinned>
      <div
        class="hidden pointer-events-none absolute inset-x-xs md:inset-x-sm top-[22%] bottom-[14%] flex-col justify-between"
      >
        <!-- Dashed telemetry-style guide lines. -->
        <div
          v-for="li in LINE_COUNT"
          :key="`line-${li}`"
          class="relative h-12 w-full overflow-hidden"
        >
          <DottedLine class="absolute bottom-0 left-0 w-full" />
        </div>
      </div>
      <span
        v-for="(m, i) in slice.primary.markers || []"
        :key="`marker-${i}`"
        class="absolute flex items-start gap-1 text-[11px] tracking-widest text-beige/70"
        :style="{ left: m.x, top: m.y }"
      >
        <span class="leading-none">+</span>
        <span class="inline-block origin-top-left -rotate-90 whitespace-nowrap leading-none">{{ m.value }}</span>
      </span>
    </template>

    <!-- Content that scrolls over the pinned hero video -->
    <div class="w-full flex flex-col gap-8 md:flex-row md:items-end md:justify-start">
      <h1
        class="ea-display font-serif text-beige font-h1 w-full md:w-1/2"
        v-html="titleHtml"
      />
      <p
        v-if="subtitleHtml"
        class="text-beige font-body max-w-sm md:mb-3 w-full md:w-1/2"
        v-html="subtitleHtml"
      />
    </div>
  </ScrubScene>
</template>

<script setup>
import { asHTML } from '@prismicio/client'

const props = defineProps({
  slice:   { type: Object, required: true },
  context: { type: Object },
  index:   { type: Number },
  slices:  { type: Array },
})

// Strip block wrappers so rich text renders as inline markup inside our own
// styled <h1>/<p>, keeping bold/italic (and links) from the Prismic field.
const inlineSerializer = {
  heading1:  ({ children }) => children,
  heading2:  ({ children }) => children,
  paragraph: ({ children }) => children,
}

// Tolerate both a plain static string shape and real Prismic rich text
// (the simulator and the live API).
const toHtml = (field) => {
  if (!field) return ''
  return typeof field === 'string'
    ? field
    : asHTML(field, { serializer: inlineSerializer }) || ''
}

// Link-to-Media fields come back as an object ({ url, ... }); static content
// passes a plain string.
const mediaUrl = (field) =>
  typeof field === 'string' ? field : field?.url || ''

const titleHtml    = computed(() => toHtml(props.slice.primary.title))
const subtitleHtml = computed(() => toHtml(props.slice.primary.subtitle))
const videoUrl     = computed(() => mediaUrl(props.slice.primary.video_url))

// Number of dashed telemetry-style guide lines drawn over the hero.
const LINE_COUNT = 4
</script>
