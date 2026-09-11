<template>
  <!-- Section label / eyebrow ("THE CHALLENGE" in the design): a light mono line
       set above a section's headline, preceded by a small rounded beige square.
       The square is sized in em so it tracks the label's responsive font size,
       and sits on the baseline at roughly cap height (as drawn in Figma).
       `bg-current` keeps it the same colour as the text, so a caller that
       overrides the colour (class="text-orange") recolours both. -->
  <p class="font-mono font-light font-body uppercase text-beige">
    <span class="mr-[0.32em] inline-block h-[0.72em] w-[0.68em] rounded-[4px] bg-current align-baseline" />{{ text }}
  </p>
</template>

<script setup>
defineProps({
  text: { type: String, default: '' },
})
</script>
