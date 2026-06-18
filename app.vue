<template>
  <div>
    <AppLoader />
    <!-- The footer flows in normally at the document bottom (see AppFooter).
         The id anchors AppNav's push-away logic: the wrapper's bottom edge is
         the seam where the footer meets the content, so the nav lifts away
         instead of overlapping the footer's beige header. -->
    <div id="page-content" class="relative z-10 bg-darkblue">
      <AppNav />
      <NuxtPage />
    </div>
    <AppFooter />
  </div>
</template>
