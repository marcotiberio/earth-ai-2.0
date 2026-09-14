<template>
  <div>
    <AppLoader />
    <div id="page-content" class="relative z-10 bg-darkblue">
      <AppNav />
      <NuxtPage />
      <div
        class="pointer-events-none absolute bottom-0 left-0 z-30 h-dvh w-full bg-darkblue"
        :style="{ opacity: outgoingVeil }"
        aria-hidden="true"
      />
    </div>
    <AppFooter />
  </div>
</template>

<script setup>
const { outgoingVeil } = useFooterReveal()
</script>
