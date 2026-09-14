<template>
  <section
    ref="rootRef"
    class="relative w-full bg-darkblue text-beige"
    :style="pinned ? { height: `calc(100vh + ${holdTotalVh}vh + ${runway})` } : null"
  >
    <div
      class="boxed flex flex-col gap-sm lg:gap-[4rem]"
      :class="pinned ? 'sticky top-0 h-screen overflow-hidden' : ''"
    >
      <div v-if="sectionLabel || titleHtml" class="flex flex-col gap-xs">
        <SectionLabel v-if="sectionLabel" :text="sectionLabel" />
        <h2
          v-if="titleHtml"
          class="ea-display font-serif font-h2 max-w-screen-lg"
          v-html="titleHtml"
        />
      </div>

      <div
        ref="viewportRef"
        class="min-h-0 flex-1"
        :class="pinned ? 'overflow-hidden' : 'overflow-x-auto snap-x snap-mandatory'"
      >
        <ul
          ref="trackRef"
          class="relative flex gap-xs md:gap-sm"
          :class="pinned ? 'h-full will-change-transform' : ''"
          :style="trackStyle"
        >
          <li
            v-for="(card, i) in cards"
            :key="i"
            :ref="(el) => { cardEls[i] = el }"
            class="group flex w-full shrink-0 snap-start flex-col overflow-hidden rounded lg:w-[calc((100%-2.5rem)/2)]"
            :class="pinned ? 'h-full' : ''"
          >
            <div class="bg-beige p-xs md:px-[1.5rem] md:py-[2rem] text-darkblue">
              <h3 class="font-sansLight font-h3">{{ card.title }}</h3>
              <p v-if="card.subtitle" class="mt-3 md:mt-4 font-mono font-light font-caption">
                {{ card.subtitle }}
              </p>
            </div>

            <div
              class="relative overflow-hidden bg-beige/5"
              :class="pinned ? 'min-h-0 flex-1' : 'aspect-[799/556]'"
            >
              <img
                v-if="imageUrl(card)"
                :src="imgixUrl(imageUrl(card), { w: 1200 })"
                :srcset="imgixSrcset(imageUrl(card), [600, 900, 1200, 1600, 2400])"
                sizes="(min-width: 1180px) 50vw, 100vw"
                :alt="resolveImageAlt(card.image, card.title)"
                :loading="nearby ? 'eager' : 'lazy'"
                decoding="async"
                class="absolute inset-0 h-full w-full object-cover"
              />
              <video
                v-if="videoSrcs[i]"
                :ref="(el) => { videoEls[i] = el }"
                :src="videoSrcs[i]"
                muted
                playsinline
                preload="auto"
                crossorigin="anonymous"
                aria-hidden="true"
                class="absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-out motion-reduce:transition-none"
                :class="videoReady[i] ? 'opacity-100' : 'opacity-0'"
                @loadeddata="videoReady[i] = true"
              />
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, inject, nextTick, onMounted, onUnmounted } from 'vue'
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

const imageUrl = (card) =>
  typeof card.image === 'string' ? card.image : card.image?.url || ''

const mediaUrl = (field) =>
  typeof field === 'string' ? field : field?.url || ''

const titleHtml    = computed(() => toHtml(props.slice.primary.title))
const sectionLabel = computed(() => props.slice.primary.section_label || '')
const cards        = computed(() => props.slice.primary.cards || [])

const inSimulator = inject('inSliceSimulator', false)

const LEAD_VH = 30

const DWELL_VH = 100

const CLIP_HOLD_VH = 40

const rootRef     = ref(null)
const viewportRef = ref(null)
const trackRef    = ref(null)

const travel = ref(null)

const singleRow = ref(false)

let cardBoxes = []
let boxWidth  = 0

const scrollLength = computed(() => Number(props.slice.primary.scroll_length) || 0)
const runway = computed(() => {
  if (scrollLength.value) return `${scrollLength.value}vh`
  if (travel.value !== null) return `${travel.value}px`
  return `${Math.max(cards.value.length - 2, 0) * 50}vw`
})

const hasClip = (card) => Boolean(card && mediaUrl(card.video_url))
const holdsVh = computed(() => {
  const list = cards.value
  const last = list.length - 1
  const hold = (card, floor) => Math.max(hasClip(card) ? CLIP_HOLD_VH : 0, floor)
  if (!singleRow.value) return [hold(list[0], LEAD_VH), hold(list[last], DWELL_VH)]
  return list.map((card, i) =>
    hold(card, i === 0 ? LEAD_VH : i === last ? DWELL_VH : 0),
  )
})
const holdTotalVh = computed(() => holdsVh.value.reduce((sum, vh) => sum + vh, 0))

function measure() {
  const vp    = viewportRef.value
  const track = trackRef.value
  if (!vp || !track?.children.length) return
  cardBoxes = [...track.children].map((el) => ({ left: el.offsetLeft, width: el.offsetWidth }))
  boxWidth  = vp.clientWidth
  singleRow.value = cardBoxes[0].width > boxWidth / 1.5
  const last = cardBoxes[cardBoxes.length - 1]
  travel.value = Math.max(0, last.left + last.width - boxWidth)
}

const nearby = ref(false)

let resizeObserver = null
let stopNearImages = null
onMounted(() => {
  measure()
  resizeObserver = new ResizeObserver(measure)
  if (viewportRef.value) resizeObserver.observe(viewportRef.value)

  stopNearImages = observeNear(rootRef.value, () => { nearby.value = true }, '100%')
})
onUnmounted(() => {
  resizeObserver?.disconnect()
  stopNearImages?.()
})

const { progress, tall } = useScrollProgress(inSimulator ? ref(null) : rootRef, {
  start: 'top top',
  end: (trigger) => `+=${trigger.offsetHeight - window.innerHeight}`,
  scrub: 1,
  waitForLayout: true,
  onUpdate: (p) => syncVideos(p),
})

const pinned = computed(() => tall.value && !inSimulator)

const clamp01 = (x) => Math.min(1, Math.max(0, x))

function timeline() {
  const vh     = window.innerHeight / 100
  const total  = Math.max((rootRef.value?.offsetHeight || 0) - window.innerHeight, 1)
  const T      = travel.value || 0
  const holds  = holdsVh.value.map((h) => h * vh)
  const stops  = singleRow.value ? cardBoxes.map((box) => Math.min(box.left, T)) : [0, T]
  const holdPx = holds.reduce((sum, h) => sum + h, 0)
  const pxPerT = T ? Math.max(total - holdPx, 0) / T : 0

  const segments = []
  let s = 0
  stops.forEach((t, k) => {
    if (k > 0) {
      const len = (t - stops[k - 1]) * pxPerT
      segments.push({ s0: s, s1: s + len, t0: stops[k - 1], t1: t })
      s += len
    }
    const hold = holds[k] || 0
    segments.push({ s0: s, s1: s + hold, t0: t, t1: t })
    s += hold
  })
  return { segments, total }
}

function offsetAt(tl, s) {
  for (const g of tl.segments) {
    if (s > g.s1) continue
    return g.t0 === g.t1 ? g.t0 : g.t0 + clamp01((s - g.s0) / (g.s1 - g.s0)) * (g.t1 - g.t0)
  }
  return travel.value || 0
}

function scrollAt(tl, t, last) {
  const segments = last ? [...tl.segments].reverse() : tl.segments
  for (const g of segments) {
    if (g.t0 === g.t1) {
      if (Math.abs(t - g.t0) < 1) return last ? g.s1 : g.s0
    } else if (t > g.t0 - 1 && t < g.t1 + 1) {
      return g.s0 + clamp01((t - g.t0) / (g.t1 - g.t0)) * (g.s1 - g.s0)
    }
  }
  return last ? tl.total : 0
}

const trackStyle = computed(() => {
  if (!pinned.value || !travel.value) return null
  const tl = timeline()
  return { transform: `translate3d(${-offsetAt(tl, progress.value * tl.total)}px, 0, 0)` }
})

const videoSource = (card) => {
  const mobile = mediaUrl(card.video_url_mobile)
  return MOBILE_VIDEO_ENABLED && mobile && window.matchMedia('(max-width: 767px)').matches
    ? mobile
    : mediaUrl(card.video_url)
}

const hasVideo = cards.value.some((card) => mediaUrl(card.video_url))

const videoSrcs  = ref([])
const videoReady = ref([])
const videoEls   = []
const cardEls    = []
const cardNear   = []
const clips = []
let near = false
let reduceMotion = false

function attach(i) {
  const card = cards.value[i]
  if (!card || videoSrcs.value[i]) return
  if (reduceMotion && imageUrl(card)) return
  const src = videoSource(card)
  if (!src) return
  videoSrcs.value[i] = src
  nextTick(() => prime(i))
}

async function prime(i) {
  const video = videoEls[i]
  if (!video) return
  await primeScrubVideo(video)
  clips[i] = { video, seek: createSeeker(video), duration: video.duration }
  syncVideos()
}

function clipWindows(tl) {
  const spans = cardBoxes.map((box) => {
    const fullAt = Math.max(0, box.left + box.width - boxWidth)
    return [scrollAt(tl, fullAt, false), scrollAt(tl, box.left, true)]
  })
  const order   = cards.value.map((card, i) => (hasClip(card) ? i : -1)).filter((i) => i !== -1)
  const windows = []
  let prevEnd = 0
  order.forEach((i, k) => {
    if (!spans[i]) return
    const [fullStart, fullEnd] = spans[i]
    const start = Math.max(fullStart, prevEnd)
    const next = spans[order[k + 1]]?.[0] ?? Infinity
    const end  = next > start ? Math.min(fullEnd, next) : fullEnd
    windows[i] = [start, end]
    prevEnd = end
  })
  return windows
}

function syncVideos(p = progress.value) {
  if (!pinned.value || !cardBoxes.length) return
  const tl      = timeline()
  const s       = p * tl.total
  const windows = clipWindows(tl)
  clips.forEach((clip, i) => {
    if (!clip || !windows[i]) return
    const [start, end] = windows[i]
    if (end <= start) return
    const target = clamp01((s - start) / (end - start)) * clip.duration
    if (!Number.isFinite(target)) return
    if (!clip.video.seeking && Math.abs(clip.video.currentTime - target) < 0.01) return
    clip.seek(target)
  })
}

let nearObserver = null
let stopNear     = null
onMounted(() => {
  if (!hasVideo || typeof IntersectionObserver === 'undefined') return
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const attachNear = () => cards.value.forEach((_, i) => { if (cardNear[i]) attach(i) })
  nearObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const i = cardEls.indexOf(entry.target)
      if (i !== -1) cardNear[i] = entry.isIntersecting
    }
    if (near) attachNear()
  }, { root: viewportRef.value, rootMargin: '0px 100%' })
  cardEls.forEach((el) => el && nearObserver.observe(el))

  whenLaunchSettled().then(() => {
    if (!rootRef.value) return
    stopNear = observeNear(rootRef.value, () => {
      near = true
      attachNear()
    }, '100%')
  })
})
onUnmounted(() => {
  nearObserver?.disconnect()
  stopNear?.()
})
</script>
