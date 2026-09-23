<template>
  <ScrubScene
    ref="sceneRef"
    :video-url="videoUrl"
    :video-url-mobile="videoUrlMobile"
    :image="slice.primary.image || {}"
    :image-mobile="slice.primary.image_mobile || {}"
    :scroll-length="scrollLength"
    :tail-vh="titleHtml ? DWELL_VH : 0"
    align="bottom"
    align-x="left"
    overlay-class=""
  >
    <template #pinned>
      <div v-if="slice.primary.gradient_top !== false" class="bg-gradient-to-b from-darkblue via-darkblue/20 to-transparent absolute inset-x-0 top-0 h-1/4 pointer-events-none" />
      <div v-if="slice.primary.gradient_bottom !== false" class="bg-gradient-to-t from-darkblue via-darkblue/20 to-transparent absolute inset-x-0 bottom-0 h-1/4 pointer-events-none" />

      <div
        v-if="titleHtml"
        ref="headingRef"
        class="absolute inset-0 z-20 flex px-xs md:px-sm opacity-0"
        :class="[titleAlignClass, titleAlignXClass]"
      >
        <h2 class="ea-display font-serif text-beige font-h1 w-full md:w-screen-md" v-html="titleHtml" />
      </div>
    </template>

    <div ref="titlesWrapRef" class="flex flex-col">
      <h1
        v-for="(item, i) in titles"
        :key="i"
        :ref="el => { if (el) titleRefs[i] = el }"
        class="ea-display text-beige font-h1 !leading-none"
        :class="inSimulator ? 'opacity-100' : 'opacity-20'"
      >
        {{ item.title }}
      </h1>
    </div>
  </ScrubScene>
</template>

<script setup>
import { ref, computed, inject, onMounted, onBeforeUnmount } from 'vue'
import { asHTML } from '@prismicio/client'

const props = defineProps({
  slice:   { type: Object, required: true },
  context: { type: Object },
  index:   { type: Number },
  slices:  { type: Array },
})

const inSimulator = inject('inSliceSimulator', false)

const mediaUrl = (field) =>
  typeof field === 'string' ? field : field?.url || ''

const videoUrl       = computed(() => mediaUrl(props.slice.primary.video_url))
const videoUrlMobile = computed(() => mediaUrl(props.slice.primary.video_url_mobile))

const titles = computed(() => props.slice.primary.items || props.slice.items || [])

const DWELL_VH = 200
const scrollLength = computed(
  () => (props.slice.primary.scroll_length || 300) + (titleHtml.value ? DWELL_VH : 0),
)

const inlineSerializer = { paragraph: ({ children }) => children }
const titleHtml = computed(() => {
  const field = props.slice.primary.title
  if (!field) return ''
  return typeof field === 'string'
    ? field
    : asHTML(field, { serializer: inlineSerializer }) || ''
})

const titleAlignClass = computed(() => ({
  top:    'items-start pt-[5vh]',
  center: 'items-center',
  bottom: 'items-end pb-md',
}[props.slice.primary.title_align] || 'items-center'))

const titleAlignXClass = computed(() => ({
  left:   'justify-start text-left',
  center: 'justify-center text-center',
  right:  'justify-end text-right',
}[props.slice.primary.title_align_x] || 'justify-center text-center'))

const sceneRef     = ref(null)
const titlesWrapRef = ref(null)
const headingRef   = ref(null)
const titleRefs    = []

let ctx = null

onMounted(() => {
  if (!inSimulator) setupScrub()
})

async function setupScrub() {
  const els        = titleRefs.filter(Boolean)
  const titlesWrap = titlesWrapRef.value
  const heading    = headingRef.value
  const trigger    = sceneRef.value?.root
  if ((!els.length && !heading) || !trigger) return

  const { gsap }              = await import('gsap')
  const { ScrollTrigger: ST } = await import('gsap/ScrollTrigger')
  gsap.registerPlugin(ST)

  ctx = gsap.context(() => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger,
        start: 'top center',
        end: heading
          ? () => `+=${trigger.offsetHeight - window.innerHeight * (1 + DWELL_VH / 100)}`
          : 'bottom bottom',
        scrub: 1,
      },
    })
    els.forEach((el, i) => {
      if (i === 0) {
        tl.fromTo(el, { opacity: 0.2 }, { opacity: 1, ease: 'none' })
      }
      const next = els[i + 1]
      if (next) {
        tl.to(el, { opacity: 0.2, ease: 'none' })
        tl.fromTo(next, { opacity: 0.2 }, { opacity: 1, ease: 'none' }, '<')
      }
    })

    if (heading) {
      const firstHalf = tl.duration() || 1
      const screen    = window.innerHeight
      if (titlesWrap) {
        tl.fromTo(
          titlesWrap,
          { y: 0 },
          { y: -screen, ease: 'none', duration: firstHalf },
          firstHalf,
        )
      }
      tl.fromTo(
        heading,
        { y: screen, opacity: 0 },
        { y: 0, opacity: 1, ease: 'none', duration: firstHalf },
        firstHalf,
      )
    }
  }, trigger)
}

onBeforeUnmount(() => {
  ctx?.revert()
})
</script>
