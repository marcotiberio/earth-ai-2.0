<template>
  <section class="bg-darkblue px-6 py-24 md:px-10 md:py-32">
    <div
      :class="[
        'flex flex-col gap-16',
        slice.primary.image?.url ? 'lg:flex-row lg:items-center lg:gap-20' : '',
      ]"
    >
      <!-- Text column -->
      <div class="flex-1">
        <h2
          v-if="slice.primary.heading"
          class="ea-display font-serif text-beige font-h2 font-normal leading-[1.1] mb-16 max-w-xl"
          v-html="slice.primary.heading"
        />

        <ul
          :class="[
            'grid gap-x-8 gap-y-12',
            slice.variation === 'large' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 md:grid-cols-3',
          ]"
        >
          <li v-for="(item, i) in slice.items" :key="i" class="flex flex-col gap-3">
            <span
              :class="[
                'font-serif text-beige leading-none',
                slice.variation === 'large' ? 'font-h1' : 'font-h2',
              ]"
            >
              {{ item.value }}
            </span>
            <span class="font-caption text-grey">{{ item.label }}</span>
          </li>
        </ul>
      </div>

      <!-- Optional media (Slide 8.4 has an accompanying render, scroll-scrubbed) -->
      <div v-if="slice.primary.image?.url || slice.primary.video_url" ref="rootRef" class="flex-1">
        <video
          v-if="slice.primary.video_url"
          ref="videoRef"
          :src="slice.primary.video_url"
          class="w-full h-auto object-cover"
          muted playsinline preload="metadata"
        />
        <img
          v-else
          :src="slice.primary.image.url"
          :alt="slice.primary.image.alt || ''"
          class="w-full h-auto object-cover"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  slice:   { type: Object, required: true },
  context: { type: Object },
  index:   { type: Number },
  slices:  { type: Array },
})

const rootRef  = ref(null)
const videoRef = ref(null)

if (props.slice.primary.video_url) {
  // `scrub_start` ('top' | 'middle') is set per section in content/home.js.
  useScrubVideo(videoRef, rootRef, { startAt: props.slice.primary.scrub_start })
}
</script>
