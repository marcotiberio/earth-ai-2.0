<template>
  <!--
    Horizontal dotted divider drawn with a tiled radial-gradient instead of an
    SVG. Background tiles are sized in real pixels, so every dot keeps a fixed
    size/spacing on any screen width (only the number of dots changes) — unlike
    a stretched SVG viewBox, which squashes the dots. Pass `color="currentColor"`
    to inherit the parent's text colour; otherwise it defaults to beige.
    Layout (width / responsive visibility) is controlled by the caller's classes.
  -->
  <div class="dotted-line" aria-hidden="true" />
</template>

<script setup>
defineProps({
  color: { type: String, default: '#FAF3E4' },
})
</script>

<style scoped>
.dotted-line {
  height: 2px;
  background-image: radial-gradient(circle, currentColor 1px, transparent 1.5px);
  background-size: 15px 2px;
  background-position: -5px center;
  background-repeat: repeat-x;
  color: v-bind(color);
}
</style>
