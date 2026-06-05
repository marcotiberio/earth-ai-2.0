<template>
  <ScrubScene
    :video-url="videoUrl"
    :image="slice.primary.image || {}"
    :scroll-length="slice.primary.scroll_length || 200"
    :scrub-start="slice.primary.scrub_start || ''"
    align="bottom"
    overlay-class="bg-darkblue/40"
    eager
  >

    <!-- Content that scrolls over the pinned hero video -->
    <div class="w-full flex flex-col gap-8 md:flex-row md:items-end md:justify-start">
      <h1
        class="ea-display font-serif text-beige text-h1 w-full md:w-1/2"
        v-html="titleHtml"
      />
      <p
        v-if="subtitleHtml"
        class="text-beige/85 text-body max-w-sm md:mb-3 w-full md:w-1/2"
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

// Tolerate both the static string shape (content/home.js) and real Prismic
// rich text (the simulator and the live API).
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
</script>
