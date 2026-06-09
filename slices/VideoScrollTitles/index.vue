<template>
  <!-- Pinned full-bleed scroll-scrub video (mirrors VideoScroll's "overlay"),
       but instead of a single headline + body it overlays a repeatable group of
       simple h1 titles. As the section scrubs the video down, each title brightens
       in turn from 20% → 100% opacity. -->
  <section
    ref="rootRef"
    class="relative w-full bg-darkblue"
    :style="{ height: `${scrollLength}vh` }"
  >
    <div class="sticky top-0 h-screen w-full overflow-hidden">
      <video
        v-if="videoUrl"
        ref="videoRef"
        :src="videoSrc || undefined"
        :poster="slice.primary.image?.url || undefined"
        muted
        playsinline
        preload="auto"
        class="absolute inset-0 w-full h-full object-cover"
      />
      <img
        v-else-if="slice.primary.image?.url"
        :src="slice.primary.image.url"
        :alt="slice.primary.image.alt || ''"
        class="absolute inset-0 w-full h-full object-cover"
      />

      <!-- Top and bottom fades so the pinned video feathers into its neighbours. -->
      <div class="bg-gradient-to-b from-darkblue via-darkblue/20 to-transparent absolute inset-x-0 top-0 h-1/4 pointer-events-none" />
      <div class="bg-gradient-to-t from-darkblue via-darkblue/20 to-transparent absolute inset-x-0 bottom-0 h-1/4 pointer-events-none" />

      <!-- Overlaid titles: pinned bottom-left, brightening in sequence as we scroll. -->
      <div class="absolute inset-0 z-10 flex items-end pb-md justify-start text-left px-xs md:px-sm">
        <div class="flex flex-col">
          <h1
            v-for="(item, i) in titles"
            :key="i"
            :ref="el => { if (el) titleRefs[i] = el }"
            class="ea-display text-beige font-h1 !leading-none opacity-20"
          >
            {{ item.title }}
          </h1>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  slice:   { type: Object, required: true },
  context: { type: Object },
  index:   { type: Number },
  slices:  { type: Array },
})

// Link-to-Media fields come back as an object ({ url, ... }); static content
// passes a plain string.
const mediaUrl = (field) =>
  typeof field === 'string' ? field : field?.url || ''

const videoUrl = computed(() => mediaUrl(props.slice.primary.video_url))

// The repeatable group of titles. Real Prismic returns it under
// `primary.items` (a Group field); a plain static shape may use top-level `items`.
const titles = computed(() => props.slice.primary.items || props.slice.items || [])

// Total pinned scroll distance in vh. With 200 the video stays pinned for
// ~one full screen of scroll, over which the titles brighten in turn.
const scrollLength = computed(() => props.slice.primary.scroll_length || 200)

const rootRef   = ref(null)
const videoRef  = ref(null)
const titleRefs = [] // collected per-element via the v-for function ref

// Lazy src: empty until the section nears the viewport, so we don't pull every
// clip at once on first paint (mirrors ScrubScene's lazy load).
const videoSrc = ref('')
let observer = null

// Drive the video's currentTime from the section's pinned travel.
if (videoUrl.value) {
  useScrubVideo(videoRef, rootRef, { start: 'top top', end: 'bottom bottom' })
}

let ctx = null

onMounted(() => {
  // Lazy-attach the video src as the section approaches, then kick load()/play()
  // so it buffers and (on iOS) unlocks frame painting for the scrub.
  if (videoUrl.value) {
    const el = rootRef.value
    if (!el || typeof IntersectionObserver === 'undefined') {
      videoSrc.value = videoUrl.value
    } else {
      observer = new IntersectionObserver((entries) => {
        if (entries.some(e => e.isIntersecting)) {
          videoSrc.value = videoUrl.value
          nextTick(() => {
            const v = videoRef.value
            if (!v) return
            v.muted = true
            try { v.load() } catch { /* ignore */ }
            const p = v.play()
            if (p && p.then) p.then(() => v.pause()).catch(() => {})
          })
          observer.disconnect()
          observer = null
        }
      }, { rootMargin: '150% 0px 150% 0px' })
      observer.observe(el)
    }
  }

  setupTitleScrub()
})

// Sequentially brighten each title from 20% → 100% opacity across the section's
// pinned travel, staggered so they reveal one after another (see reference).
async function setupTitleScrub() {
  const titles = titleRefs.filter(Boolean)
  const trigger = rootRef.value
  if (!titles.length || !trigger) return

  const { gsap }              = await import('gsap')
  const { ScrollTrigger: ST } = await import('gsap/ScrollTrigger')
  gsap.registerPlugin(ST)

  ctx = gsap.context(() => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
      },
    })
    // Highlight one title at a time: brighten the first, then crossfade each
    // into the next — the outgoing title dims back to 20% as the new one rises.
    titles.forEach((el, i) => {
      if (i === 0) {
        tl.fromTo(el, { opacity: 0.2 }, { opacity: 1, ease: 'none' })
      }
      const next = titles[i + 1]
      if (next) {
        tl.to(el, { opacity: 0.2, ease: 'none' })
        tl.fromTo(next, { opacity: 0.2 }, { opacity: 1, ease: 'none' }, '<')
      }
    })
  }, trigger)
}

onBeforeUnmount(() => {
  observer?.disconnect()
  ctx?.revert()
})
</script>
