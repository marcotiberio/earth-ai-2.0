<template>
  <!-- Launch overlay: holds the viewport until the homepage media is fully
       downloaded (or the safety cap fires). The four bars of the Earth AI
       logomark fill from the bottom up, one per 25% of real download progress;
       at 100% the overlay fades away. -->
  <Transition name="loader-fade" @after-leave="onHidden">
    <div v-if="visible" class="app-loader" role="status" aria-live="polite" aria-label="Loading">
      <svg
        class="app-loader__mark"
        width="46"
        height="61"
        viewBox="0 0 46 61"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <!-- Each bar fills in turn; `barStyle(order)` ramps its opacity across
             its 25% slice of the total progress. Order 0 = top, 3 = bottom. -->
        <!-- top bar -->
        <path :style="barStyle(0)" d="M43.2372 11.3064H2.41163C2.05586 11.3064 1.7667 11.0996 1.71263 10.7877L0.0145125 1.04382C-0.0779559 0.511721 0.278592 0 0.88042 0H44.643C45.1735 0 45.621 0.434923 45.5309 0.95448L43.8398 10.6983C43.7865 11.004 43.6345 11.1944 43.238 11.3057L43.2372 11.3064Z" fill="#FAF3E4" />
        <!-- second-from-top bar -->
        <path :style="barStyle(1)" d="M30.9329 27.7399H14.7407C14.3826 27.7391 14.1029 27.4985 14.0653 27.1545L12.8984 16.4773C12.9165 16.0933 13.1461 15.8449 13.5489 15.7939H31.9861C32.3967 15.7947 32.6436 16.0902 32.6585 16.4749L31.4908 27.1874C31.4195 27.4577 31.2753 27.6294 30.9329 27.7399Z" fill="#FAF3E4" />
        <!-- third-from-top bar -->
        <path :style="barStyle(2)" d="M28.8733 44.2035L16.6996 44.2051C16.3838 44.2051 16.0578 43.9825 16.021 43.6503L14.855 32.9707C14.815 32.6063 15.1324 32.2607 15.4999 32.2607H30.0245C30.3904 32.2607 30.7102 32.6063 30.6702 32.9715L29.5057 43.6589C29.4783 43.9136 29.1915 44.2035 28.8733 44.2035Z" fill="#FAF3E4" />
        <!-- bottom bar -->
        <path :style="barStyle(3)" d="M26.9623 60.671L18.4537 60.6663C18.0039 60.6663 17.6708 60.2917 17.6246 59.863L16.4883 49.4538C16.446 49.0636 16.7477 48.707 17.1442 48.707H28.3627C28.7459 48.7078 29.0672 49.0753 29.0256 49.4546L27.8917 59.8591C27.8353 60.3755 27.4694 60.6702 26.9631 60.6702L26.9623 60.671Z" fill="#FAF3E4" />
      </svg>
    </div>
  </Transition>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { collectMediaUrls, registerAssets, startLoading, useAssetLoader } from '~/composables/useAssetLoader'

// The bars track REAL byte progress: we fully download every homepage video so
// any scrub position is instantly seekable, even on a fast scroll. A hard cap in
// startLoading() (its `timeout`) guarantees the overlay still lifts on a slow
// connection — past the cap, stragglers finish in the background.

// Smallest time the overlay stays up, so a fast/cached load doesn't flash.
const MIN_DISPLAY_MS = 600

const { progress, state } = useAssetLoader()
const prismic = usePrismic()
const { $lenis } = useNuxtApp()

const visible = ref(true)
const displayed = ref(0) // eased value the bars actually render
let rafId = null
let startedAt = 0
let hiding = false

// Dim baseline → full beige across each bar's 25% slice of total progress.
const DIM = 0.14
function barStyle(order) {
  const t = Math.min(Math.max((displayed.value - order * 0.25) / 0.25, 0), 1)
  return { fillOpacity: DIM + (1 - DIM) * t }
}

function tick() {
  // Ease toward live progress; only ever move forward, and snap to a clean 1
  // once loading is done (all assets buffered, or the safety cap fired).
  const target = state.done ? 1 : Math.max(displayed.value, progress.value)
  displayed.value += (target - displayed.value) * 0.1

  const elapsed = performance.now() - startedAt
  if (state.done && displayed.value > 0.99 && elapsed >= MIN_DISPLAY_MS && !hiding) {
    displayed.value = 1
    hiding = true
    // Hold the filled mark a beat, then trigger the fade-out.
    setTimeout(() => { visible.value = false }, 220)
    return
  }
  rafId = requestAnimationFrame(tick)
}

onMounted(async () => {
  // Lock the page while we load: stop Lenis and pin the scroll to the top so the
  // videos below can buffer without the user scrolling into them.
  $lenis?.stop?.()
  document.documentElement.style.overflow = 'hidden'
  window.scrollTo(0, 0)

  // Collect every homepage media URL straight from the Prismic document, then
  // download them all in full before lifting the overlay.
  try {
    const doc = await prismic.client.getSingle('home_page')
    registerAssets([...collectMediaUrls(doc)])
  } catch { /* no document / offline → overlay still resolves via the cap */ }

  startLoading()
  startedAt = performance.now()
  rafId = requestAnimationFrame(tick)
})

function onHidden() {
  // Hand scrolling back and re-measure pinned scenes now the media has size.
  document.documentElement.style.overflow = ''
  $lenis?.start?.()
  ScrollTrigger.refresh()
}

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  document.documentElement.style.overflow = ''
})
</script>

<style scoped>
.app-loader {
  position: fixed;
  inset: 0;
  z-index: 100; /* above the fixed nav (z-50) */
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0d111b; /* darkblue */
}

.app-loader__mark {
  width: 52px;
  height: auto;
}

/* rAF drives the fill, so no per-bar transition is needed — keep it crisp. */
.loader-fade-leave-active {
  transition: opacity 0.6s ease;
}
.loader-fade-leave-to {
  opacity: 0;
}
</style>
