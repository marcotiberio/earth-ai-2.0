<template>
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
