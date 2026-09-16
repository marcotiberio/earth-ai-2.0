<template>
  <ScrubScene
    v-if="slice.variation === 'overlay'"
    :video-url="videoUrl"
    :video-url-mobile="videoUrlMobile"
    :image="slice.primary.image || {}"
    :image-mobile="slice.primary.image_mobile || {}"
    :scroll-length="scrollLength"
    :tail-vh="hasDwell ? DWELL_VH : 0"
    :scrub-start="slice.primary.scrub_start || ''"
    :section-label="slice.primary.section_label || ''"
    :align="slice.primary.title_align_vertical || 'bottom'"
    :align-x="slice.primary.title_align_horizontal || 'left'"
    :frame="slice.primary.frame || false"
    overlay-class=""
  >
    <template #pinned="{ copyOpacity }">
      <div v-if="slice.primary.gradient_top !== false" class="bg-gradient-to-b from-darkblue via-darkblue/20 to-transparent absolute inset-x-0 top-0 h-1/4 pointer-events-none" />
      <div v-if="slice.primary.gradient_bottom !== false" class="hidden bg-gradient-to-t from-darkblue via-darkblue/20 to-transparent absolute inset-x-0 bottom-0 h-1/4 pointer-events-none" />

      <div
        v-if="subtitleHtml"
        class="absolute inset-x-0 inset-y-sm z-10 flex px-xs md:px-sm pointer-events-none"
        :class="[subtitleAlignClass, subtitleAlignXClass]"
        :style="{ opacity: copyOpacity }"
      >
        <p
          class="text-beige font-h3 w-full lg:w-1/2"
          v-html="subtitleHtml"
        />
      </div>
    </template>
    <h2
      class="ea-display font-serif text-beige font-h2 w-full md:w-2/3 mx-auto"
      v-html="titleHtml"
    />
  </ScrubScene>

  <section v-else ref="rootRef" class="relative w-full bg-darkblue px-6 py-20 md:px-10 md:py-28">
    <div class="relative w-full overflow-hidden">
      <video
        v-if="videoUrl"
        ref="videoRef"
        :src="videoSrc"
        :poster="imgixUrl(activeImage?.url, { w: 1280 }) || undefined"
        class="w-full h-[40vh] md:h-[55vh] object-cover"
        muted
        playsinline
        preload="metadata"
        crossorigin="anonymous"
      />
      <img
        v-else-if="activeImage?.url"
        :src="imgixUrl(activeImage.url, { w: 1280 })"
        :srcset="imgixSrcset(activeImage.url, [768, 1280, 1920])"
        sizes="100vw"
        :alt="resolveImageAlt(activeImage)"
        class="w-full h-[40vh] md:h-[55vh] object-cover"
      />
      <div v-if="slice.primary.gradient_top !== false" class="bg-gradient-to-b from-darkblue via-darkblue/20 to-transparent absolute inset-x-0 top-0 h-1/4 pointer-events-none" />
      <div v-if="slice.primary.gradient_bottom !== false" class="bg-gradient-to-t from-darkblue via-darkblue/20 to-transparent absolute inset-x-0 bottom-0 h-1/4 pointer-events-none" />
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
import { ref, computed, onBeforeUnmount, onMounted } from 'vue'
import { asHTML } from '@prismicio/client'

const props = defineProps({
  slice:   { type: Object, required: true },
  context: { type: Object },
  index:   { type: Number },
  slices:  { type: Array },
})

const inlineSerializer = {
  heading1:  ({ children }) => `<span class="block leading-[1.1] font-h1">${children}</span>`,
  heading2:  ({ children }) => `<span class="block leading-[1.1] font-h2">${children}</span>`,
  heading3:  ({ children }) => `<span class="block leading-[1.1] text-base md:font-h3">${children}</span>`,
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
const activeImage    = useMobileImage(() => props.slice.primary.image, () => props.slice.primary.image_mobile)

const DWELL_VH = 100
const hasDwell = computed(() =>
  Boolean(videoUrl.value) && !props.slice.primary.scrub_start && props.slice.variation === 'overlay',
)
const scrollLength = computed(
  () => (props.slice.primary.scroll_length || 300) + (hasDwell.value ? DWELL_VH : 0),
)

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

const rootRef  = ref(null)
const videoRef = ref(null)
const videoSrc = ref(videoUrl.value)

let stopWarmObserve = null

if (props.slice.variation !== 'overlay' && props.slice.primary.video_url) {
  onMounted(() => {
    if (MOBILE_VIDEO_ENABLED
      && typeof window !== 'undefined'
      && window.matchMedia('(max-width: 767px)').matches
      && videoUrlMobile.value) {
      videoSrc.value = videoUrlMobile.value
    }
    if (PERF_MODE) {
      stopWarmObserve = observeNear(rootRef.value, () => prefetchScrubVideo(videoSrc.value), scrubLeadMargin(200))
    } else {
      prefetchScrubVideo(videoSrc.value)
    }
  })
  onBeforeUnmount(() => stopWarmObserve?.())
  useScrubVideo(videoRef, rootRef, { startAt: props.slice.primary.scrub_start })
}
</script>
