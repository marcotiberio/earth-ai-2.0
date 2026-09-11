<template>
  <div>
    <AppLoader />
    <!-- Page content paints above the footer (z-10 + opaque background): the
         footer pins behind the page bottom (sticky reveal, see AppFooter) and
         is uncovered in place as the last section scrolls away, instead of
         racing in after the long pinned scene before it. -->
    <!-- The id anchors AppNav's push-away logic: the wrapper's bottom edge is
         the visible seam where the footer reveal begins. -->
    <div id="page-content" class="relative z-10 bg-darkblue">
      <AppNav />
      <NuxtPage />
      <!-- Outgoing half of the reveal crossfade. Anchored to the wrapper's
           bottom edge and exactly one screen tall, it covers precisely the last
           screen of page content — which, while the seam travels, is the last
           section's pinned stage — and never extends past the seam into the
           uncovered footer below. Fading it in dissolves whatever is leaving
           (video, headline and all) into the page background rather than letting
           the wipe cut it off mid-frame; the footer fades up out of that same
           darkblue on the way in. Slice-agnostic on purpose: no section needs to
           know it happens to be last. -->
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
