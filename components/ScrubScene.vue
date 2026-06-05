<template>
  <!-- Pinned scroll-scrub scene (mirrors earth-ai.com):
       a tall section holds a sticky, full-viewport video that stays pinned to
       the top as the background while the content slot scrolls up over it. The
       video's currentTime is scrubbed across the pinned scroll distance. When
       the section ends, the sticky releases and the next section enters. -->
  <section
    ref="rootRef"
    class="relative w-full bg-darkblue"
    :style="{ height: `${scrollLength}vh` }"
  >
    <!-- Pinned stage: video background AND content both pin to the top for the
         whole scrub, then wipe away together when the section ends. -->
    <div class="sticky top-0 h-screen w-full overflow-hidden">
      <video
        v-if="videoUrl"
        ref="videoRef"
        :src="videoSrc || undefined"
        :poster="image && image.url ? image.url : undefined"
        muted
        playsinline
        preload="auto"
        class="absolute inset-0 w-full h-full object-cover"
      />
      <img
        v-else-if="image && image.url"
        :src="image.url"
        :alt="image.alt || ''"
        class="absolute inset-0 w-full h-full object-cover"
      />
      <div class="absolute inset-0" :class="overlayClass" />

      <!-- Decorative layers that should stay pinned with the video -->
      <slot name="pinned" />

      <!-- Content: scrolls in with the section, then holds at bottom 5% (or the
           chosen alignment) while the video scrubs, then wipes away with it. -->
      <div class="absolute inset-0 z-10 flex px-6 md:px-10" :class="[alignClass, alignXClass]">
        <slot />
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  videoUrl:     { type: String, default: '' },
  image:        { type: Object, default: () => ({}) },
  // Total pinned scroll distance in vh. With 200, the video stays pinned for
  // ~one full screen of scroll, over which the content travels in and out.
  scrollLength: { type: Number, default: 200 },
  align:        { type: String, default: 'bottom' }, // 'top' | 'center' | 'bottom'
  alignX:       { type: String, default: 'left' },   // 'left' | 'center' | 'right'
  // Named scrub start preset ('top' | 'middle'). Empty keeps the pinned
  // default below (scrub spans the full sticky travel).
  scrubStart:   { type: String, default: '' },
  overlayClass: { type: String, default: 'bg-darkblue/40' },
  // Eager = download on page load (use for the hero). Otherwise the clip is
  // fetched lazily as the section approaches, so we don't pull every video at
  // once on first paint.
  eager:        { type: Boolean, default: false },
})

const rootRef  = ref(null)
const videoRef = ref(null)

// Lazy src: empty until the section nears the viewport (or immediately if eager).
const videoSrc = ref(props.eager ? props.videoUrl : '')
let observer = null

// Vertical resting position while pinned. Bottom anchors the content 5% up
// from the bottom edge (per design), matching the live site's held caption.
const alignClass = computed(() => ({
  top:    'items-start pt-[5vh]',
  center: 'items-center',
  bottom: 'items-end pb-md',
}[props.align] || 'items-end pb-md'))

// Horizontal resting position of the content along the main (row) axis.
const alignXClass = computed(() => ({
  left:   'justify-start text-left',
  center: 'justify-center text-center',
  right:  'justify-end text-right',
}[props.alignX] || 'justify-start text-left'))

onMounted(() => {
  if (!props.videoUrl || props.eager) return
  const el = rootRef.value
  if (!el || typeof IntersectionObserver === 'undefined') {
    videoSrc.value = props.videoUrl // no IO support → just load it
    return
  }
  // Start fetching ~1.5 screens before the section enters so it has time to
  // buffer enough for a smooth scrub by the time it pins.
  observer = new IntersectionObserver((entries) => {
    if (entries.some(e => e.isIntersecting)) {
      videoSrc.value = props.videoUrl
      // Setting src alone isn't enough — kick load() + a muted inline play() so
      // the clip actually buffers and (on iOS) unlocks frame painting for the
      // scrub. The composable's own kick already ran at mount, before this src
      // existed, so we re-trigger it here once the source is attached.
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
})

onBeforeUnmount(() => observer?.disconnect())

// Pinned scrub: map currentTime 0 → duration across the section's pinned travel
// (top hits viewport top → bottom hits viewport bottom), matching the sticky pin.
// A `scrubStart` preset overrides this with a per-section start ('top'|'middle').
if (props.videoUrl) {
  useScrubVideo(
    videoRef,
    rootRef,
    props.scrubStart
      ? { startAt: props.scrubStart }
      : { start: 'top top', end: 'bottom bottom' },
  )
}
</script>
