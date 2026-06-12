<template>
  <footer
    ref="footerRef"
    class="text-darkblue boxed !pb-sm !pt-[62px] overflow-hidden"
    :class="reveal ? 'sticky bottom-0 z-0' : ''"
  >
    <!-- Inner wrapper is the drag target (fallback mode only): it slides up
         inside the (clipping) footer so the document's scroll height never
         changes mid-entrance. -->
    <div ref="innerRef">
    <!-- Top Bar -->
    <div class="flex flex-col items-start justify-between gap-sm mb-sm w-full">
      <div class="flex flex-row items-start justify-between gap-sm w-full">
        <div class="flex flex-col items-start justify-between gap-sm w-full md:w-1/2">
          <span class="font-h2 font-serif text-beige">{{ mainTitle }}</span>
          <!-- ToDo: Add contact link -->
          <a
            href="mailto:info@earth-ai.com"
            class="btn btn-primary mt-auto font-label text-darkblue hover:underline"
          >Contact us</a>
        </div>
        <NuxtLink
          v-if="footer?.data?.logo_footer?.url"
          to="/"
          aria-label="Earth AI home"
          @click="scrollToTop"
        >
          <PrismicImage
            :field="footer.data.logo_footer"
            class="h-md w-auto"
            alt="Earth AI logo"
          />
        </NuxtLink>
      </div>
      <ul v-if="footer?.data?.social_media_links?.length" class="flex gap-xs">
        <li v-for="(item, i) in footer.data.social_media_links" :key="i">
          <PrismicLink :field="item.link" class="block text-beige hover:text-orange hover:cursor-pointer transition-colors">
            <img
              :src="`/icons/${item.social.toLowerCase()}.svg`"
              :alt="item.social"
              class="h-6 w-6"
            />
          </PrismicLink>
        </li>
      </ul>
    </div>

    <!-- Press quotes -->
    <div class="grid gap-8 border-t border-beige pt-10 md:grid-cols-3">
      <SliceZone :slices="visibleSlices(press)" :components="components" />
    </div>

    <!-- Bottom bar -->
    <div class="mt-sm flex flex-col justify-start sm:flex-row sm:items-center sm:justify-end gap-sm border-t border-beige pt-sm font-label text-beige">
      <nav v-if="footer?.data?.legal_links?.length" class="w-full flex justify-center sm:justify-end gap-sm">
        <PrismicLink
          v-for="(item, i) in footer.data.legal_links"
          :key="i"
          :field="item.link"
          class="hover:text-orange hover:cursor-pointer transition-colors"
        />
      </nav>
      <span class="whitespace-nowrap flex justify-center">© EARTH AI – {{ new Date().getFullYear() }}</span>
    </div>
    </div>
  </footer>
</template>

<script setup>
import { components } from '~/slices'

// The footer is driven by a single `footer` page document in Prismic: each
// press quote is a `press_quotes` slice in its slice zone.
const route = useRoute()

// On the homepage, smooth-scroll to top instead of triggering a no-op navigation.
function scrollToTop(e) {
  if (route.path === '/') {
    e.preventDefault()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const prismic = usePrismic()
const { data: footer } = await useAsyncData('footer', () =>
  prismic.client.getSingle('footer').catch(() => null),
)

const press = computed(() => {
  const slices = footer.value?.data?.slices
  return slices?.length ? slices : fallbackPress
})

const mainTitle = computed(
  () => footer.value?.data?.footer_main_title || 'Follow our journey.',
)

// --- Entrance after the pinned section before us -----------------------------
// The footer follows a pinned VideoScroll section: after 1000vh of pinned
// scroll the user's touch momentum dumps into whatever comes next, so a footer
// that scrolls in normally flies past in a few frames.
//
// Reveal mode (preferred): the footer pins behind the page (sticky bottom,
// z-0, under app.vue's z-10 content) and is uncovered in place as the last
// section wipes away — nothing small moves fast because the footer never
// moves at all. This only works while the footer fits the viewport: pinned to
// the bottom, anything above one viewport-height can never scroll into view.
//
// Fallback (footer taller than the viewport, common on phones): the previous
// scrub-lerped drag entrance — content starts shifted down and is dragged up
// into place, heavier on coarse pointers where touch momentum is native (same
// lag as SupplyGap / RaceBars / MapTargets). Reduced motion skips the drag.
const footerRef = ref(null)
const innerRef  = ref(null)
const reveal    = ref(false)
let ctx = null
let removeResize = null

onMounted(async () => {
  const trigger = footerRef.value
  const target  = innerRef.value
  if (!trigger || !target) return

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const coarse  = window.matchMedia('(pointer: coarse)').matches

  const { gsap }              = await import('gsap')
  const { ScrollTrigger: ST } = await import('gsap/ScrollTrigger')
  gsap.registerPlugin(ST)

  const createDrag = () => {
    ctx = gsap.context(() => {
      gsap.from(target, {
        y: () => trigger.offsetHeight * 0.6,
        ease: 'none',
        scrollTrigger: {
          trigger,
          start: 'top bottom',
          end: 'bottom bottom',
          scrub: coarse ? 3 : 1.2,
          invalidateOnRefresh: true,
        },
      })
    }, trigger)
  }

  // Pick the mode now and again on resize (rotation can flip which one fits).
  // Toggling sticky doesn't change the document height, so other ScrollTriggers
  // keep their positions.
  const applyMode = () => {
    const fits = trigger.offsetHeight <= window.innerHeight
    if (fits === reveal.value && (fits || ctx || reduced)) return
    reveal.value = fits
    if (fits) {
      ctx?.revert()
      ctx = null
    } else if (!reduced) {
      createDrag()
    }
  }
  applyMode()
  window.addEventListener('resize', applyMode)
  removeResize = () => window.removeEventListener('resize', applyMode)
})

onUnmounted(() => {
  removeResize?.()
  ctx?.revert()
})
</script>
