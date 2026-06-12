<template>
  <!-- It hides the whole site until an editor flips the slice's "Hide slice"
       toggle — or removes it — in Prismic. -->
  <section
    class="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-12 bg-darkblue text-beige"
    role="status"
    aria-label="Coming soon"
  >
    <svg
      class="h-auto w-[52px]"
      width="46"
      height="61"
      viewBox="0 0 46 61"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <!-- top bar -->
      <path d="M43.2372 11.3064H2.41163C2.05586 11.3064 1.7667 11.0996 1.71263 10.7877L0.0145125 1.04382C-0.0779559 0.511721 0.278592 0 0.88042 0H44.643C45.1735 0 45.621 0.434923 45.5309 0.95448L43.8398 10.6983C43.7865 11.004 43.6345 11.1944 43.238 11.3057L43.2372 11.3064Z" fill="#FAF3E4" />
      <!-- second-from-top bar -->
      <path d="M30.9329 27.7399H14.7407C14.3826 27.7391 14.1029 27.4985 14.0653 27.1545L12.8984 16.4773C12.9165 16.0933 13.1461 15.8449 13.5489 15.7939H31.9861C32.3967 15.7947 32.6436 16.0902 32.6585 16.4749L31.4908 27.1874C31.4195 27.4577 31.2753 27.6294 30.9329 27.7399Z" fill="#FAF3E4" />
      <!-- third-from-top bar -->
      <path d="M28.8733 44.2035L16.6996 44.2051C16.3838 44.2051 16.0578 43.9825 16.021 43.6503L14.855 32.9707C14.815 32.6063 15.1324 32.2607 15.4999 32.2607H30.0245C30.3904 32.2607 30.7102 32.6063 30.6702 32.9715L29.5057 43.6589C29.4783 43.9136 29.1915 44.2035 28.8733 44.2035Z" fill="#FAF3E4" />
      <!-- bottom bar -->
      <path d="M26.9623 60.671L18.4537 60.6663C18.0039 60.6663 17.6708 60.2917 17.6246 59.863L16.4883 49.4538C16.446 49.0636 16.7477 48.707 17.1442 48.707H28.3627C28.7459 48.7078 29.0672 49.0753 29.0256 49.4546L27.8917 59.8591C27.8353 60.3755 27.4694 60.6702 26.9631 60.6702L26.9623 60.671Z" fill="#FAF3E4" />
    </svg>
    <p v-if="slice.primary.label" class="font-label leading-tight text-center">
      {{ slice.primary.label }}
    </p>
  </section>
</template>

<script setup>
import { onBeforeUnmount, onMounted } from 'vue'

defineProps({
  slice:   { type: Object, required: true },
  context: { type: Object },
  index:   { type: Number },
  slices:  { type: Array },
})

const { $lenis } = useNuxtApp()

// Keep the page pinned to the top: the homepage AppLoader restores scrolling
// once the media has buffered, so a scroll listener (not just overflow:hidden)
// guarantees nothing behind the gate ever moves while it's up.
function pinToTop() {
  window.scrollTo(0, 0)
}

onMounted(() => {
  $lenis?.stop?.()
  document.documentElement.style.overflow = 'hidden'
  window.scrollTo(0, 0)
  window.addEventListener('scroll', pinToTop)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', pinToTop)
  document.documentElement.style.overflow = ''
  $lenis?.start?.()
})
</script>
