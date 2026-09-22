<template>
  <div>
    <AppLoader />
    <div id="page-content" class="relative z-10 bg-darkblue">
      <AppNav />
      <NuxtPage />
      <div
        class="pointer-events-none absolute bottom-0 left-0 z-30 hidden h-dvh w-full overflow-hidden lg:block"
        aria-hidden="true"
      >
        <div
          class="absolute inset-x-0 top-0 h-[200dvh] bg-gradient-to-b from-darkblue from-35% to-transparent to-65% will-change-transform"
          :style="{ transform: `translate3d(0, ${-130 + 160 * nightfall}dvh, 0)` }"
        />
        <div
          class="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-darkblue to-transparent"
          :style="{ opacity: seamShade }"
        />
      </div>
      <div
        class="pointer-events-none absolute left-0 top-full z-30 hidden h-[20dvh] w-full origin-top bg-gradient-to-b from-darkblue to-transparent will-change-transform lg:block"
        :style="{ transform: `scaleY(${seamTail})` }"
        aria-hidden="true"
      />
    </div>
    <AppFooter />
  </div>
</template>

<script setup>
const { nightfall, seamShade, seamTail } = useFooterReveal()
</script>
