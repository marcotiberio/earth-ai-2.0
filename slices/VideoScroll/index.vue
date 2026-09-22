<template>
  <ScrubScene
    v-if="slice.variation === 'overlay'"
    :video-url="videoUrl"
    :video-url-mobile="videoUrlMobile"
    :image="slice.primary.image || {}"
    :image-mobile="slice.primary.image_mobile || {}"
    :scroll-length="scrollLength"
    :tail-vh="hasDwell ? DWELL_VH : 0"
    :lead-vh="leadVh"
    :section-label="slice.primary.section_label || ''"
    :align="slice.primary.title_align_vertical || 'bottom'"
    :align-x="slice.primary.title_align_horizontal || 'left'"
    :frame="slice.primary.frame || false"
    overlay-class=""
  >
    <template #pinned>
      <div v-if="slice.primary.gradient_top !== false" class="bg-gradient-to-b from-darkblue via-darkblue/20 to-transparent absolute inset-x-0 top-0 h-1/4 pointer-events-none" />
      <div v-if="slice.primary.gradient_bottom !== false" class="bg-gradient-to-t from-darkblue via-darkblue/20 to-transparent absolute inset-x-0 bottom-0 h-1/4 pointer-events-none" />

      <div
        v-if="subtitleHtml"
        class="absolute inset-x-0 inset-y-sm z-10 flex px-xs md:px-sm pointer-events-none"
        :class="[subtitleAlignClass, subtitleAlignXClass]"
      >
        <p
          class="text-beige font-h3 w-full lg:w-1/2"
          v-html="subtitleHtml"
        />
      </div>
    </template>
    <h2
      class="ea-display font-serif text-beige font-h2 w-full"
      v-html="titleHtml"
    />
  </ScrubScene>

  <section v-else ref="rootRef" class="relative w-full bg-darkblue px-6 py-20 md:px-10 md:py-28">
    <div class="relative w-full overflow-hidden">
      <video
        v-if="videoUrl"
        ref="videoRef"
        :src="videoSrc || undefined"
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
import { ref, computed, nextTick, onBeforeUnmount, onMounted } from 'vue'
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

const PIN_VH   = 100
const DWELL_VH = 100
const LEAD_VH  = 50
const hasDwell = computed(() =>
  Boolean(videoUrl.value) && props.slice.variation === 'overlay',
)
const leadVh = computed(() => {
  const value = props.slice.primary.scrub_lead_in
  return Math.min(Math.max(Number.isFinite(value) ? value : LEAD_VH, 0), 100)
})
const scrollLength = computed(
  () => (props.slice.primary.scroll_length || 300)
    + PIN_VH
    + (hasDwell.value ? DWELL_VH : 0)
    - leadVh.value,
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
const videoSrc = ref('')

let stopWarmObserve = null
let attached = false

let resolveReady = null
const videoReady = new Promise((resolve) => { resolveReady = resolve })

const isMobile = typeof window !== 'undefined'
  && window.matchMedia('(max-width: 767px)').matches
const sourceUrl = () => (MOBILE_VIDEO_ENABLED && isMobile && videoUrlMobile.value) ? videoUrlMobile.value : videoUrl.value

const attachSrc = async () => {
  if (attached) return
  attached = true
  videoSrc.value = sourceUrl()
  await nextTick()
  const v = videoRef.value
  if (!v) return
  await primeScrubVideo(v)
  resolveReady()
}

if (props.slice.variation !== 'overlay' && props.slice.primary.video_url) {
  onMounted(() => {
    if (PERF_MODE) {
      stopWarmObserve = observeNear(rootRef.value, attachSrc, scrubLeadMargin(200))
    } else {
      prefetchScrubVideo(sourceUrl())
      attachSrc()
    }
  })
  onBeforeUnmount(() => stopWarmObserve?.())
  useScrubVideo(videoRef, rootRef, { startAt: props.slice.primary.scrub_start, ready: videoReady })
}
</script>
