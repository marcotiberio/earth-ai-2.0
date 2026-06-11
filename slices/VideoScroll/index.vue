<template>
  <!-- variation: "overlay" — pinned full-bleed video; the headline scrolls over it -->
  <ScrubScene
    v-if="slice.variation === 'overlay'"
    :video-url="videoUrl"
    :image="slice.primary.image || {}"
    :scroll-length="slice.primary.scroll_length || 300"
    :scrub-start="slice.primary.scrub_start || ''"
    :align="slice.primary.title_align_vertical || 'bottom'"
    :align-x="slice.primary.title_align_horizontal || 'left'"
    :frame="slice.primary.frame || false"
    overlay-class=""
  >
    <!-- Top and bottom fades (each a quarter of the section height) so the
         pinned video feathers into the sections above and below. -->
    <template #pinned>
      <div class="bg-gradient-to-b from-darkblue via-darkblue/20 to-transparent absolute inset-x-0 top-0 h-1/4 pointer-events-none" />
      <div class="bg-gradient-to-t from-darkblue via-darkblue/20 to-transparent absolute inset-x-0 bottom-0 h-1/4 pointer-events-none" />

      <!-- Subtitle: an independently-aligned caption layer over the video. Its
           own vertical/horizontal alignment lets it sit apart from the title. -->
      <div
        v-if="subtitleHtml"
        class="absolute inset-0 z-10 flex px-xs md:px-sm pointer-events-none"
        :class="[subtitleAlignClass, subtitleAlignXClass]"
      >
        <p
          class="text-beige font-body w-full md:w-1/2 lg:w-1/3"
          v-html="subtitleHtml"
        />
      </div>
    </template>
    <h2
      class="ea-display font-serif text-beige font-h2 w-full md:w-screen-md"
      v-html="titleHtml"
    />
  </ScrubScene>

  <!-- variation: "default" — media band with the headline set beneath it -->
  <section v-else ref="rootRef" class="relative w-full bg-darkblue px-6 py-20 md:px-10 md:py-28">
    <div class="relative w-full overflow-hidden">
      <video
        v-if="videoUrl"
        ref="videoRef"
        :src="videoUrl"
        class="w-full h-[40vh] md:h-[55vh] object-cover"
        muted
        playsinline
        preload="metadata"
      />
      <img
        v-else-if="slice.primary.image?.url"
        :src="slice.primary.image.url"
        :alt="resolveImageAlt(slice.primary.image)"
        class="w-full h-[40vh] md:h-[55vh] object-cover"
      />
      <!-- Top and bottom fades (each a quarter of the band height) so the media
           band feathers into the darkblue page background, blending each section
           into its neighbours. -->
      <div class="bg-gradient-to-b from-darkblue via-darkblue/20 to-transparent absolute inset-x-0 top-0 h-1/4 pointer-events-none" />
      <div class="bg-gradient-to-t from-darkblue via-darkblue/20 to-transparent absolute inset-x-0 bottom-0 h-1/4 pointer-events-none" />
    </div>

    <div class="mt-12 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
      <h2
        class="ea-display font-serif text-beige font-h2"
        v-html="titleHtml"
      />
      <p
        v-if="slice.primary.body"
        class="text-grey font-body leading-relaxed max-w-sm"
      >
        {{ slice.primary.body }}
      </p>
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

// Map each heading level chosen in the Prismic editor to a responsive size, so
// the "font size" picked in the WYSIWYG actually drives the rendered headline.
// Bold/italic (and links) from the field are preserved inside each block.
const inlineSerializer = {
  heading1:  ({ children }) => `<span class="block leading-[1.1] font-h1">${children}</span>`,
  heading2:  ({ children }) => `<span class="block leading-[1.1] font-h2">${children}</span>`,
  heading3:  ({ children }) => `<span class="block leading-[1.1] text-base md:font-h3">${children}</span>`,
  paragraph: ({ children }) => children,
}

// Tolerate both a plain static string shape and real Prismic rich text
// (the live API).
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

// Subtitle resting position over the pinned video. Mirrors ScrubScene's own
// alignment mapping so the subtitle can be placed independently of the title.
const subtitleAlignClass = computed(() => ({
  top:    'items-start pt-[5vh]',
  center: 'items-center',
  bottom: 'items-end pb-md',
}[props.slice.primary.subtitle_align_vertical] || 'items-end pb-md'))

const subtitleAlignXClass = computed(() => ({
  left:   'justify-start text-left',
  center: 'justify-center text-center',
  right:  'justify-end text-right',
}[props.slice.primary.subtitle_align_horizontal] || 'justify-start text-left'))

// Only used by the non-pinned "default" band variation.
const rootRef  = ref(null)
const videoRef = ref(null)

if (props.slice.variation !== 'overlay' && props.slice.primary.video_url) {
  // `scrub_start` ('top' | 'middle') is set per section in the Prismic field.
  useScrubVideo(videoRef, rootRef, { startAt: props.slice.primary.scrub_start })
}
</script>
