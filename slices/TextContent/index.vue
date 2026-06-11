<template>
  <section class="boxed bg-darkblue text-beige">
    <div class="max-w-screen-xl">
      <!-- Heading + optional sub-line -->
      <header v-if="slice.primary.title || slice.primary.subtitle" class="mb-md">
        <h1
          v-if="slice.primary.title"
          class="font-serif font-h2 font-normal leading-[1.05] tracking-tight"
        >
          {{ slice.primary.title }}
        </h1>
        <p v-if="slice.primary.subtitle" class="mt-xs font-label text-grey">
          {{ slice.primary.subtitle }}
        </p>
      </header>

      <!-- Rich-text body -->
      <div class="text-content font-body">
        <PrismicRichText :field="slice.primary.content" />
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({
  slice:   { type: Object, required: true },
  context: { type: Object },
  index:   { type: Number },
  slices:  { type: Array },
})
</script>

<style scoped>
/* Readable vertical rhythm for a long-form text page. Headings use the brand
   serif; body, lists and links inherit the beige palette. (Plain CSS here —
   the project's `.font-*` sizes are component classes, not @apply-able
   utilities.) */
.text-content :deep(h2) {
  font-size: 2rem;
  line-height: 1.1;
  letter-spacing: -0.015em;
  margin-block-end: 1rem;

  @screen sm {
    font-size: 2.75rem;  
  }
  
  @screen xl {
    font-size: 3.75rem;  
  }
}

.text-content :deep(h3) { 
  font-size: 1.375rem;
  line-height: 1.1;
  letter-spacing: 0;
  margin-block-end: 1rem;

  @screen sm {
    font-size: 1.575rem;  
  }
  
  @screen xl {
    font-size: 1.875rem;  
  }
}

.text-content :deep(h4) { 
  font-size: 1.2rem;
  line-height: 1.1;
  letter-spacing: 0;
  margin-block-end: 1rem;
  @screen sm {
    font-size: 1.3rem;  
  }
  
  @screen xl {
    font-size: 1.6rem;  
  }
}

.text-content :deep(p) {
  font-size: 1rem;
  line-height: 1.1;
  letter-spacing: 0;
  margin-block-end: 1rem;

  @screen sm {
    font-size: 1.2rem;
  }

  @screen xl {
    font-size: 1.375rem;  
  }
}

.text-content :deep(ul),
.text-content :deep(ol) {
  @apply mb-xs pl-6 leading-relaxed;
}

.text-content :deep(ul) { @apply list-disc; }
.text-content :deep(ol) { @apply list-decimal; }
.text-content :deep(li) { @apply mb-2; }

.text-content :deep(em) { @apply font-serifItalic; }
.text-content :deep(strong) { @apply font-medium; }

.text-content :deep(a) {
  @apply text-beige underline underline-offset-2 transition-colors hover:text-orange;
}
</style>
