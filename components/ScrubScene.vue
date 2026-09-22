<template>
  <section
    ref="rootRef"
    class="relative w-full bg-darkblue h-[min(var(--scrub-length),calc(400dvh+var(--scrub-tail)))] md:h-[var(--scrub-length)]"
    :style="{ '--scrub-length': inSimulator ? '100dvh' : `${scrollLength}dvh`, '--scrub-tail': inSimulator ? '0dvh' : `${tailVh}dvh` }"
  >
    <div
      class="sticky top-0 h-dvh w-full flex flex-col-reverse gap-8 md:gap-12"
      :class="frame ? 'px-xs md:px-sm pb-6 md:pb-16 pt-md' : ''"
    >
      <div
        class="relative w-full overflow-hidden"
        :class="frame ? 'flex-1 rounded' : 'h-full'"
      >
        <video
          v-if="videoUrl"
          ref="videoRef"
          :src="videoSrc || undefined"
          :poster="imgixUrl(activeImage?.url, { w: 1600 }) || undefined"
          muted
          playsinline
          preload="auto"
          crossorigin="anonymous"
          class="absolute inset-0 w-full h-full object-cover"
        />
        <img
          v-else-if="activeImage && activeImage.url"
          :src="imgixUrl(activeImage.url, { w: 1280 })"
          :srcset="imgixSrcset(activeImage.url, [768, 1280, 1920])"
          sizes="100vw"
          :alt="resolveImageAlt(activeImage)"
          class="absolute inset-0 w-full h-full object-cover"
        />
        <div class="absolute inset-0" :class="overlayClass" />

        <slot name="pinned" :copy-opacity="copyOpacity" />

        <div
          v-if="!frame"
          class="absolute inset-0 z-10 flex px-xs md:px-sm"
          :class="[alignClass, alignXClass]"
          :style="{ opacity: copyOpacity }"
        >
          <div class="w-full flex flex-col gap-xs">
            <SectionLabel v-if="sectionLabel" :text="sectionLabel" />
            <slot />
          </div>
        </div>
      </div>

      <div
        v-if="frame"
        class="flex pt-sm lg:max-w-screen-full"
        :class="alignXClass"
        :style="{ opacity: copyOpacity }"
      >
        <div class="w-full flex flex-col gap-xs">
          <SectionLabel v-if="sectionLabel" :text="sectionLabel" />
          <slot />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  videoUrl:     { type: String, default: '' },
  videoUrlMobile: { type: String, default: '' },
  image:        { type: Object, default: () => ({}) },
  imageMobile:  { type: Object, default: () => ({}) },
  scrollLength: { type: Number, default: 200 },
  sectionLabel: { type: String, default: '' },
  align:        { type: String, default: 'bottom' },
  alignX:       { type: String, default: 'left' },
  tailVh:       { type: Number, default: 0 },
  scrubUntilExit: { type: Boolean, default: false },
  overlayClass: { type: String, default: 'bg-darkblue/40' },
  frame:        { type: Boolean, default: false },
  eager:        { type: Boolean, default: false },
})

const inSimulator = inject('inSliceSimulator', false)

const rootRef  = ref(null)
const videoRef = ref(null)

const copyOpacity = useFooterRevealCopy(rootRef)

const videoSrc = ref('')
let stopObserve = null
let attached = false

let resolveReady = null
const videoReady = new Promise((resolve) => { resolveReady = resolve })

const isMobile = typeof window !== 'undefined'
  && window.matchMedia('(max-width: 767px)').matches
const sourceUrl = () => (MOBILE_VIDEO_ENABLED && isMobile && props.videoUrlMobile) ? props.videoUrlMobile : props.videoUrl

const activeImage = useMobileImage(() => props.image, () => props.imageMobile)

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

const alignClass = computed(() => ({
  top:    'items-start pt-[5vh]',
  center: 'items-center',
  bottom: 'items-end pb-md',
}[props.align] || 'items-end pb-md'))

const alignXClass = computed(() => ({
  left:   'justify-start text-left',
  center: 'justify-center text-center',
  right:  'justify-end text-right',
}[props.alignX] || 'justify-start text-left'))

onMounted(() => {
  if (!props.videoUrl) return
  if (props.eager) { whenLaunchSettled().then(attachSrc); return }
  if (!PERF_MODE) prefetchScrubVideo(sourceUrl())
  whenLaunchSettled().then(() => {
    if (!rootRef.value) return
    stopObserve = observeNear(rootRef.value, attachSrc, scrubLeadMargin(isMobile ? 300 : 150))
  })
})

onBeforeUnmount(() => stopObserve?.())

if (props.videoUrl && !inSimulator) {
  useScrubVideo(videoRef, rootRef, {
    ready: videoReady,
    start: 'top top',
    end: props.scrubUntilExit
      ? 'bottom top'
      : () => `+=${rootRef.value.offsetHeight - window.innerHeight * (1 + props.tailVh / 100)}`,
  })
}

defineExpose({ root: rootRef })
</script>
