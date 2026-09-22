<template>
  <section
    ref="rootRef"
    class="relative w-full bg-darkblue text-beige"
    :style="pinned ? { height: `calc(100vh + ${LEAD_VH}vh + ${runwayVh}vh + ${DWELL_VH}vh)` } : null"
    aria-roledescription="carousel"
    :aria-label="sectionLabel || 'Image slider'"
  >
    <div
      class="boxed flex flex-col"
      :class="pinned ? 'sticky top-0 h-screen overflow-hidden' : ''"
    >
      <div v-if="sectionLabel || titleHtml" class="mb-[1.875rem] flex flex-col gap-xs">
        <SectionLabel v-if="sectionLabel" :text="sectionLabel" />
        <h2
          v-if="titleHtml"
          class="ea-display font-serif font-h2 max-w-screen-lg"
          v-html="titleHtml"
        />
      </div>

      <div
        class="relative w-full overflow-hidden rounded-t-[5px] bg-beige/5"
        :class="pinned ? 'min-h-0 flex-1' : 'aspect-[4/3] md:aspect-[16/7]'"
      >
        <div
          v-for="(slide, i) in slides"
          :key="i"
          class="absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none"
          :class="i === activeIndex ? 'opacity-100' : 'opacity-0'"
          :aria-hidden="i === activeIndex ? undefined : 'true'"
        >
          <img
            v-if="imageUrl(slide)"
            :src="imgixUrl(imageUrl(slide), { w: 1600 })"
            :srcset="imgixSrcset(imageUrl(slide), [640, 960, 1280, 1920, 2560, 3200])"
            sizes="(min-width: 780px) calc(100vw - 5rem), calc(100vw - 2rem)"
            :alt="resolveImageAlt(slide.image, slide.title)"
            loading="lazy"
            decoding="async"
            class="absolute inset-0 h-full w-full object-cover"
          />
          <video
            v-if="videoSrcs[i]"
            :ref="(el) => { videoEls[i] = el }"
            :src="videoSrcs[i]"
            muted
            loop
            playsinline
            preload="auto"
            crossorigin="anonymous"
            aria-hidden="true"
            class="absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-out motion-reduce:transition-none"
            :class="videoReady[i] ? 'opacity-100' : 'opacity-0'"
            @loadeddata="videoReady[i] = true"
            @error="videoFailed[i] = true"
          />
        </div>
      </div>

      <nav v-if="slides.length > 1" aria-label="Slides">
        <ol class="flex gap-[0.75rem] md:gap-[1.45rem]">
          <li v-for="(slide, i) in slides" :key="i" class="min-w-0 flex-1">
            <button
              type="button"
              class="group block w-full select-none pt-xs text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-beige/50"
              :class="scrubbable(i) ? 'touch-pan-y' : ''"
              :aria-label="slide.title ? `Slide ${i + 1}: ${slide.title}` : `Slide ${i + 1}`"
              :aria-current="i === activeIndex ? 'step' : undefined"
              @click="onBarClick(i)"
              @keydown="onBarKey($event, i)"
              @pointerdown="onBarPointerDown($event, i)"
              @pointermove="onBarPointerMove"
              @pointerup="onBarPointerUp"
              @pointercancel="onBarPointerCancel"
            >
              <span
                class="relative block h-[4px] overflow-hidden rounded-full transition-[background-color,transform] duration-300 motion-reduce:transition-none"
                :class="[
                  i === activeIndex ? 'bg-beige/20' : 'bg-beige/20 group-hover:bg-beige/50',
                  scrubbable(i) ? (scrubbing ? 'scale-y-150' : '[@media(hover:hover)]:group-hover:scale-y-150') : '',
                ]"
              >
                <span
                  class="absolute inset-0 rounded-full bg-beige"
                  :class="scrubbing || pinned ? '' : 'transition-transform duration-300 ease-out motion-reduce:transition-none'"
                  :style="{ transform: `translateX(${(barFill(i) - 1) * 100}%)` }"
                />
              </span>
              <span
                class="mt-[0.35rem] block font-mono font-body leading-[1.2] transition-opacity duration-300 motion-reduce:transition-none"
                :class="barFill(i) > 0 ? 'opacity-100' : 'opacity-25 group-hover:opacity-60'"
              >{{ i + 1 }}</span>
            </button>
          </li>
        </ol>
      </nav>

      <div class="mt-xs grid">
        <div
          v-for="(slide, i) in slides"
          :key="i"
          class="[grid-area:1/1] self-start transition-opacity duration-500 ease-out motion-reduce:transition-none"
          :class="i === activeIndex ? 'opacity-100' : 'pointer-events-none opacity-0'"
          :inert="i !== activeIndex"
        >
          <h3
            v-if="slide.title"
            class="font-serif font-h3"
          >
            {{ slide.title }}
          </h3>
          <div
            v-if="descriptionsHtml[i]"
            class="max-w-screen-tablet 
                    mt-xs lg:mt-xs 
                    font-sansLight font-small leading-[1.2]
                    [&_strong]:font-sans [&_strong]:font-normal [&_em]:font-serifItalic [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-orange"
            v-html="descriptionsHtml[i]"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch, inject, nextTick, onMounted, onUnmounted } from 'vue'
import { asHTML, isFilled } from '@prismicio/client'

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

const imageUrl = (slide) =>
  typeof slide.image === 'string' ? slide.image : slide.image?.url || ''

const titleHtml    = computed(() => toHtml(props.slice.primary.title))
const sectionLabel = computed(() => props.slice.primary.section_label || '')
const slides       = computed(() => props.slice.primary.slides || [])

const descriptionsHtml = computed(() =>
  slides.value.map(({ description }) => {
    if (typeof description === 'string') return description
    return isFilled.richText(description) ? asHTML(description) : ''
  }),
)

const inSimulator = inject('inSliceSimulator', false)

const LEAD_VH  = 50
const DWELL_VH = 50

const STEP_VH = 70

const runwayVh = computed(() => Math.max(slides.value.length - 1, 0) * STEP_VH)

const rootRef = ref(null)

const scrubbed = !inSimulator && slides.value.length > 1

const { progress, tall } = useScrollProgress(scrubbed ? rootRef : ref(null), {
  start: `top -${LEAD_VH}%`,
  end: (trigger) =>
    `+=${trigger.offsetHeight - window.innerHeight * (1 + (LEAD_VH + DWELL_VH) / 100)}`,
  scrub: 1,
})

const pinned = computed(() => tall.value && scrubbed)

const scrollIndex = computed(() =>
  Math.min(slides.value.length - 1, Math.floor(progress.value * slides.value.length)),
)

const selected = ref(0)

const held = ref(null)
watch(scrollIndex, (i) => { if (i === held.value) held.value = null })

const activeIndex = computed(() =>
  pinned.value ? (held.value ?? scrollIndex.value) : selected.value,
)

const { $lenis } = useNuxtApp()

function goTo(i) {
  if (!pinned.value) {
    selected.value = i
    return
  }
  const root = rootRef.value
  if (!root) return
  const vh     = window.innerHeight
  const start  = root.getBoundingClientRect().top + window.scrollY + vh * LEAD_VH / 100
  const runway = root.offsetHeight - vh * (1 + (LEAD_VH + DWELL_VH) / 100)
  const top    = start + (i / slides.value.length) * runway

  held.value = i === scrollIndex.value ? null : i
  if ($lenis) $lenis.scrollTo(top)
  else window.scrollTo({ top, behavior: 'smooth' })
}

const release = () => { held.value = null }

const mediaUrl = (field) =>
  typeof field === 'string' ? field : field?.url || ''

const videoSource = (slide) => {
  const mobile = mediaUrl(slide.video_url_mobile)
  return MOBILE_VIDEO_ENABLED && mobile && window.matchMedia('(max-width: 767px)').matches
    ? mobile
    : mediaUrl(slide.video_url)
}

const hasVideo = slides.value.some((slide) => mediaUrl(slide.video_url))

const videoSrcs   = ref([])
const videoReady  = ref([])
const videoFailed = ref([])
const videoEls    = []
const near         = ref(false)
const inView       = ref(false)
const reduceMotion = ref(false)

function attach(i) {
  const slide = slides.value[i]
  if (!slide || videoSrcs.value[i]) return
  if (reduceMotion.value && imageUrl(slide)) return
  const src = videoSource(slide)
  if (src) videoSrcs.value[i] = src
}

function syncPlayback(restart) {
  videoEls.forEach((v, k) => {
    if (!v) return
    if (k === activeIndex.value && inView.value && !reduceMotion.value && !scrubbing.value) {
      if (restart) v.currentTime = 0
      v.muted = true
      v.play()?.catch(() => {})
    } else if (!v.paused) {
      v.pause()
    }
  })
}

function attachAround(restart) {
  attach(activeIndex.value)
  attach(activeIndex.value + 1)
  nextTick(() => syncPlayback(restart))
}

watch(activeIndex, () => {
  scrubbing.value = false
  press = null
  if (near.value) attachAround(true)
})
watch(inView, () => syncPlayback(false))

const scrubbing     = ref(false)
const scrubFraction = ref(0)
const seekers       = []
let press = null

const KEY_STEP = 0.1

const scrubbable = (i) =>
  i === activeIndex.value && Boolean(videoSrcs.value[i]) && !videoFailed.value[i] && !reduceMotion.value

const clamp01 = (x) => Math.min(1, Math.max(0, x))

const barFill = (i) => {
  if (scrubbing.value) return i === activeIndex.value ? scrubFraction.value : 0
  if (!pinned.value) return i <= activeIndex.value ? 1 : 0
  return clamp01(progress.value * slides.value.length - i)
}

const fractionAt = (e) => {
  const rect = e.currentTarget.getBoundingClientRect()
  return clamp01((e.clientX - rect.left) / rect.width)
}

function seekClip(i, fraction) {
  const v = videoEls[i]
  if (!v?.duration) return
  v.currentTime = clamp01(fraction) * v.duration
}

function scrubClip(i, fraction) {
  const v = videoEls[i]
  if (!v?.duration) return
  scrubFraction.value = fraction
  if (!seekers[i]) seekers[i] = createSeeker(v)
  seekers[i](fraction * v.duration)
}

function beginScrub(e) {
  e.currentTarget.setPointerCapture(e.pointerId)
  scrubbing.value = true
  syncPlayback(false)
  scrubClip(press.i, fractionAt(e))
}

function finishScrub(i) {
  seekClip(i, scrubFraction.value)
  scrubbing.value = false
  syncPlayback(false)
}

function onBarPointerDown(e, i) {
  if (!scrubbable(i) || e.button > 0) return
  press = { i, x: e.clientX, y: e.clientY }
  if (e.pointerType === 'mouse') beginScrub(e)
}

function onBarPointerMove(e) {
  if (!press) return
  if (!scrubbing.value) {
    const dx = Math.abs(e.clientX - press.x)
    if (dx < 6 || dx < Math.abs(e.clientY - press.y)) return
    beginScrub(e)
  }
  scrubClip(press.i, fractionAt(e))
}

function onBarPointerUp(e) {
  if (!press) return
  if (scrubbing.value) finishScrub(press.i)
  else seekClip(press.i, fractionAt(e))
  press = null
}

function onBarPointerCancel() {
  if (press && scrubbing.value) finishScrub(press.i)
  press = null
}

function onBarClick(i) {
  if (!scrubbable(i)) goTo(i)
}

function onBarKey(e, i) {
  const step = { ArrowLeft: -KEY_STEP, ArrowRight: KEY_STEP }[e.key]
  const v = videoEls[i]
  if (!step || !scrubbable(i) || !v?.duration) return
  e.preventDefault()
  seekClip(i, v.currentTime / v.duration + step)
}

let stopNear     = null
let viewObserver = null
onMounted(() => {
  window.addEventListener('wheel', release, { passive: true })
  window.addEventListener('touchstart', release, { passive: true })

  if (!hasVideo) return
  reduceMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  whenLaunchSettled().then(() => {
    if (!rootRef.value) return
    stopNear = observeNear(rootRef.value, () => {
      near.value = true
      attachAround(false)
    }, '100%')
  })

  if (typeof IntersectionObserver === 'undefined') {
    inView.value = true
    return
  }
  viewObserver = new IntersectionObserver(([entry]) => { inView.value = entry.isIntersecting })
  viewObserver.observe(rootRef.value)
})
onUnmounted(() => {
  window.removeEventListener('wheel', release)
  window.removeEventListener('touchstart', release)
  stopNear?.()
  viewObserver?.disconnect()
})
</script>
