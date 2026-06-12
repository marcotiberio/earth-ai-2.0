<template>
  <div>
    <AppLoader />
    <!-- Page content paints above the footer (z-10 + opaque background): the
         footer pins behind the page bottom (sticky reveal, see AppFooter) and
         is uncovered in place as the last section scrolls away, instead of
         racing in after the long pinned scene before it. -->
    <div class="relative z-10 bg-darkblue">
      <AppNav />
      <NuxtPage />
    </div>
    <AppFooter />
  </div>
</template>
