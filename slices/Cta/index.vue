<template>
  <!-- Pinned closing video; the CTA scrolls over it -->
  <ScrubScene
    :video-url="slice.primary.video_url || ''"
    :image="slice.primary.image || {}"
    :scroll-length="slice.primary.scroll_length || 200"
    :scrub-start="slice.primary.scrub_start || ''"
    align="center"
    overlay-class="bg-darkblue/40"
  >
    <div class="w-full">
      <h2
        class="ea-display font-serif text-beige font-h1 font-normal leading-[1.0] tracking-tight max-w-4xl"
        v-html="slice.primary.title"
      />
      <a
        v-if="slice.primary.button_link?.url"
        :href="slice.primary.button_link.url"
        class="mt-10 inline-block font-label tracking-wide text-beige border border-beige/40 px-8 py-4 hover:bg-beige hover:text-darkblue transition-colors"
      >
        {{ slice.primary.button_link.text }}
      </a>
    </div>
  </ScrubScene>
</template>

<script setup>
defineProps({
  slice:   { type: Object, required: true },
  context: { type: Object },
  index:   { type: Number },
  slices:  { type: Array },
})
</script>
