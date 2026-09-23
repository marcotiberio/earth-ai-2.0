<template>
  <ScrubScene
    ref="sceneRef"
    :video-url="videoUrl"
    :video-url-mobile="videoUrlMobile"
    :image="slice.primary.image || {}"
    :image-mobile="slice.primary.image_mobile || {}"
    :scroll-length="slice.primary.scroll_length || 300"
    align="bottom"
    overlay-class=""
    scrub-until-exit
    eager
  >

    <template #pinned>
      <div v-if="slice.primary.gradient_bottom !== false" class="bg-gradient-to-t from-darkblue via-darkblue/20 to-transparent absolute inset-x-0 bottom-0 h-1/4 pointer-events-none" />

      <div
        class="hidden pointer-events-none absolute inset-x-xs md:inset-x-sm top-[22%] bottom-[14%] flex-col justify-between"
      >
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

    <div class="w-full flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-start">
      <h1
        class="ea-display font-serif text-beige font-h1 w-full lg:w-1/2"
        v-html="titleHtml"
      />
      <p
        v-if="subtitleHtml"
        class="text-beige font-body md:mb-3 w-full md:w-1/2 lg:w-1/4"
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

const inlineSerializer = {
  heading1:  ({ children }) => children,
  heading2:  ({ children }) => children,
  paragraph: ({ children }) => children,
}

const toHtml = (field) => {
  if (!field) return ''
  return typeof field === 'string'
    ? field
    : asHTML(field, { serializer: inlineSerializer }) || ''
}

const mediaUrl = (field) =>
  typeof field === 'string' ? field : field?.url || ''

const titleHtml      = computed(() => toHtml(props.slice.primary.title))
const subtitleHtml   = computed(() => toHtml(props.slice.primary.subtitle))
const videoUrl       = computed(() => mediaUrl(props.slice.primary.video_url))
const videoUrlMobile = computed(() => mediaUrl(props.slice.primary.video_url_mobile))

const LINE_COUNT = 4

const sceneRef = ref(null)
if (!inject('inSliceSimulator', false)) {
  useSmoothMouseWheel(() => sceneRef.value?.root, { speed: 1.5 })
}
</script>
