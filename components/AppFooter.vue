<template>
  <footer class="text-darkblue px-6 py-20 md:px-10">
    <!-- Press quotes -->
    <div class="flex items-center justify-between mb-10">
      <span class="text-label text-beige">Follow our journey.</span>
      <a href="#contact" class="text-label text-beige hover:text-grey transition-colors">
        Contact us
      </a>
    </div>

    <div class="grid gap-8 border-t border-beige pt-10 md:grid-cols-3">
      <SliceZone :slices="visibleSlices(press)" :components="components" />
    </div>

    <!-- Bottom bar -->
    <div class="mt-16 flex flex-col gap-4 border-t border-beige pt-8 text-label text-beige md:flex-row md:items-center md:justify-between">
      <span>© EARTH AI – {{ new Date().getFullYear() }}</span>
      <nav class="flex gap-8">
        <a v-for="link in legal" :key="link.label" :href="link.href" class="hover:text-grey transition-colors">
          {{ link.label }}
        </a>
      </nav>
    </div>
  </footer>
</template>

<script setup>
import { components } from '~/slices'

// The footer is driven by a single `footer` page document in Prismic: each
// press quote is a `press_quotes` slice in its slice zone.
const prismic = usePrismic()
const { data: footer } = await useAsyncData('footer', () =>
  prismic.client.getSingle('footer').catch(() => null),
)

// Fallback in the SliceZone's shape, so the footer keeps rendering before the
// `footer` document is published. Remove once content is live in Prismic.
const fallbackPress = [
  {
    slice_type: 'press_quotes',
    variation: 'default',
    primary: {
      title: 'Earth AI is vertically integrating the search for critical minerals.',
      date: '2025-08-07',
      link: '',
      image: {},
    },
  },
  {
    slice_type: 'press_quotes',
    variation: 'default',
    primary: {
      title: 'The Future 50 is here.',
      date: '2025-08-06',
      link: '',
      image: {},
    },
  },
  {
    slice_type: 'press_quotes',
    variation: 'default',
    primary: {
      title: "AI could be the US's secret weapon in the race to mine more minerals — if it can prove itself.",
      date: '2025-08-03',
      link: '',
      image: {},
    },
  },
]

const press = computed(() => {
  const slices = footer.value?.data?.slices
  return slices?.length ? slices : fallbackPress
})

// TODO: move these into the `footer` page document too.
const legal = [
  { label: 'Privacy Policy',   href: '#privacy' },
  { label: 'Terms of Service', href: '#terms' },
]
</script>
