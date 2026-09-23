<template>
  <section
    ref="rootRef"
    class="relative w-full bg-darkblue text-beige"
    :style="tall ? { height: `${scrollLength}vh` } : null"
  >
    <div
      class="w-full overflow-hidden boxed"
      :class="tall ? 'sticky top-0 flex h-screen items-center' : 'flex min-h-screen items-center py-lg'"
    >
      <div class="flex h-full w-full flex-col gap-xs lg:flex-row lg:items-stretch md:gap-sm lg:gap-lg">
        <div class="w-full h-full flex flex-col justify-start lg:justify-between gap-xs md:gap-0 lg:w-5/12">
          <div class="flex flex-col gap-xs">
            <SectionLabel v-if="sectionLabel" :text="sectionLabel" />
            <h2
              class="ea-display font-serif font-h2"
              v-html="titleHtml"
            />
          </div>

          <ul class="mt-0 grid grid-cols-2 gap-4">
            <li v-for="(stat, i) in stats" :key="i" class="relative flex h-full flex-col justify-between bg-beige/5 p-xs rounded">
              <p class="font-mono font-caption font-medium tracking-wide leading-snug uppercase text-beige">
                <span class="mr-3 inline-block h-3 w-3 rounded-[2px] bg-current align-baseline" />{{ stat.label }}
              </p>
              <h2 class="mt-2 lg:mt-8 font-serif font-h2">
                {{ counter(stat.value) }}
              </h2>
            </li>
          </ul>
        </div>

        <div class="flex w-full items-center justify-center lg:w-7/12 lg:justify-end">
          <div
            class="relative
                  aspect-[8/7] md:aspect-4/3 lg:aspect-[4/5] 
                  w-full max-h-[650px] lg:max-h-[850px] xl:max-h-full
                  overflow-hidden rounded"
            role="img"
            :aria-label="`${counter(feetValue)} ${feetLabel}`"
          >
            <video
              v-if="videoUrl"
              ref="videoRef"
              :src="videoSrc || undefined"
              :poster="imgixUrl(posterUrl, { w: 1600 }) || undefined"
              muted
              playsinline
              preload="auto"
              crossorigin="anonymous"
              class="absolute inset-0 h-full w-full object-cover"
            />
            <img
              v-else-if="posterUrl"
              :src="imgixUrl(posterUrl, { w: 1280 })"
              :srcset="imgixSrcset(posterUrl, [768, 1280, 1920])"
              sizes="100vw"
              :alt="resolveImageAlt(activeImage)"
              class="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, nextTick, onUnmounted } from 'vue'
import { asHTML } from '@prismicio/client'

const props = defineProps({
  slice:   { type: Object, required: true },
  context: { type: Object },
  index:   { type: Number },
  slices:  { type: Array },
})

const inlineSerializer = { paragraph: ({ children }) => children }
const toHtml = (field) => {
  if (!field) return ''
  return typeof field === 'string'
    ? field
    : asHTML(field, { serializer: inlineSerializer }) || ''
}

const mediaUrl = (field) =>
  typeof field === 'string' ? field : field?.url || ''

const titleHtml = computed(() => toHtml(props.slice.primary.title))
const sectionLabel = computed(() => props.slice.primary.section_label || '')
const feetValue = computed(() => props.slice.primary.feet_value || '')
const feetLabel = computed(() => props.slice.primary.feet_label || '')
const videoUrl       = computed(() => mediaUrl(props.slice.primary.video_url))
const videoUrlMobile = computed(() => mediaUrl(props.slice.primary.video_url_mobile))
const activeImage    = useMobileImage(() => props.slice.primary.image, () => props.slice.primary.image_mobile)
const posterUrl      = computed(() => activeImage.value?.url || '')
const videoSrc = ref(PERF_MODE ? '' : videoUrl.value)
const stats = computed(() => (props.slice.primary.stats || []).slice(0, 6))
const scrollLength = computed(() => Number(props.slice.primary.scroll_length) || 300)

function parseValue(str) {
  const s = String(str ?? '')
  const m = s.match(/-?[\d,]*\.?\d+/)
  if (!m) return { raw: s, target: null }
  const numStr   = m[0]
  const target   = parseFloat(numStr.replace(/,/g, ''))
  const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 0
  return {
    target,
    decimals,
    prefix: s.slice(0, m.index),
    suffix: s.slice(m.index + numStr.length),
  }
}

function counter(value) {
  const p = parseValue(value)
  if (p.target === null) return p.raw
  const cur = p.target * progress.value
  const num = cur.toLocaleString('en-US', {
    minimumFractionDigits: p.decimals,
    maximumFractionDigits: p.decimals,
  })
  return `${p.prefix}${num}${p.suffix}`
}

const rootRef  = ref(null)
const videoRef = ref(null)
let videoDuration = 0
let seek = null

function syncVideo(p) {
  const v = videoRef.value
  if (!v || !videoDuration || !seek) return
  const t = videoDuration * p
  if (Number.isFinite(t)) seek(t)
}

function attachSrc() {
  const mobile = window.matchMedia('(max-width: 767px)').matches
  videoSrc.value = (MOBILE_VIDEO_ENABLED && mobile && videoUrlMobile.value)
    ? videoUrlMobile.value
    : videoUrl.value
}

async function primeVideo() {
  const v = videoRef.value
  if (!v || !videoUrl.value) return
  if (!videoSrc.value) {
    attachSrc()
    await nextTick()
  }
  await primeScrubVideo(v)
  videoDuration = v.duration
  seek = createSeeker(v)
  syncVideo(progress.value)
}

let stopPrimeObserve = null
function primeWhenNear() {
  whenLaunchSettled().then(() => {
    if (!rootRef.value) return
    stopPrimeObserve = observeNear(rootRef.value, primeVideo, scrubLeadMargin(200))
  })
}

const { progress, tall } = useScrollProgress(rootRef, {
  start: 'top top',
  end: (_, coarse) => `bottom bottom+=${window.innerHeight * (coarse ? 0.75 : 0.5)}`,
  scrub: { fine: 1, coarse: 3 },
  onReady: () => {
    if (!videoUrl.value) return
    if (!PERF_MODE) {
      attachSrc()
      prefetchScrubVideo(videoSrc.value)
    }
    primeWhenNear()
  },
  onUpdate: syncVideo,
})

onUnmounted(() => stopPrimeObserve?.())
</script>
