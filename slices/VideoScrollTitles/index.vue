<template>
  <!-- Pinned full-bleed scroll-scrub video, built on ScrubScene (same scaffolding
       as VideoScroll's "overlay"). Instead of a single headline it overlays a
       repeatable group of h1 titles; as the section scrubs the video down, each
       title brightens in turn from 20% → 100% opacity. -->
  <ScrubScene
    ref="sceneRef"
    :video-url="videoUrl"
    :image="slice.primary.image || {}"
    :scroll-length="slice.primary.scroll_length || 300"
    align="bottom"
    align-x="left"
    overlay-class=""
  >
    <!-- Top and bottom fades so the pinned video feathers into its neighbours. -->
    <template #pinned>
      <div class="bg-gradient-to-b from-darkblue via-darkblue/20 to-transparent absolute inset-x-0 top-0 h-1/4 pointer-events-none" />
      <div class="bg-gradient-to-t from-darkblue via-darkblue/20 to-transparent absolute inset-x-0 bottom-0 h-1/4 pointer-events-none" />
    </template>

    <!-- Overlaid titles: held bottom-left, brightening in sequence as we scroll. -->
    <div class="flex flex-col">
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

const props = defineProps({
  slice:   { type: Object, required: true },
  context: { type: Object },
  index:   { type: Number },
  slices:  { type: Array },
})

// Inside the Slice Simulator the section collapses to one static screen, so the
// scroll-driven reveal can't run — show every title at full opacity for a clean
// thumbnail instead. ScrubScene reads the same flag for its own layout.
const inSimulator = inject('inSliceSimulator', false)

// Link-to-Media fields come back as an object ({ url, ... }); static content
// passes a plain string.
const mediaUrl = (field) =>
  typeof field === 'string' ? field : field?.url || ''

const videoUrl = computed(() => mediaUrl(props.slice.primary.video_url))

// The repeatable group of titles. Real Prismic returns it under
// `primary.items` (a Group field); a plain static shape may use top-level `items`.
const titles = computed(() => props.slice.primary.items || props.slice.items || [])

const sceneRef  = ref(null) // ScrubScene instance — exposes its section root
const titleRefs = []        // collected per-element via the v-for function ref

let ctx = null

onMounted(() => {
  if (!inSimulator) setupTitleScrub()
})

// Sequentially brighten each title from 20% → 100% opacity across the section's
// pinned travel, staggered so they reveal one after another (see reference).
// Anchored to ScrubScene's root section, the same element driving the video scrub.
async function setupTitleScrub() {
  const els     = titleRefs.filter(Boolean)
  const trigger = sceneRef.value?.root
  if (!els.length || !trigger) return

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
  }, trigger)
}

onBeforeUnmount(() => {
  ctx?.revert()
})
</script>
