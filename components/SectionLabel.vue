<template>
  <p class="font-mono font-light font-body uppercase text-beige">
    <span class="mr-[0.32em] inline-block h-[0.72em] w-[0.68em] rounded-[4px] bg-current align-baseline" />{{ text }}
  </p>
</template>

<script setup>
defineProps({
  text: { type: String, default: '' },
})
</script>
