<template>
  <footer class="bg-beige px-6 py-20 md:px-10">
    <!-- Press quotes -->
    <div class="flex items-center justify-between mb-10">
      <span class="text-sm text-darkblue">Follow our journey.</span>
      <a href="#contact" class="text-sm text-darkblue hover:text-grey transition-colors">
        Contact us
      </a>
    </div>

    <div class="grid gap-8 border-t border-darkblue pt-10 md:grid-cols-3">
      <SliceZone :slices="press" :components="components" />
    </div>

    <!-- Bottom bar -->
    <div class="mt-16 flex flex-col gap-4 border-t border-darkblue pt-8 text-sm text-darkblue md:flex-row md:items-center md:justify-between">
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

// Press quotes are global footer content, so they live on the `settings` single
// type's slice zone (not a page). Each quote is one `press_quotes` slice.
const prismic = usePrismic()
const { data: settings } = await useAsyncData('settings', () =>
  prismic.client.getSingle('settings').catch(() => null),
)

// Fallback in the same shape the SliceZone expects, so the footer keeps
// rendering before the `settings` document is published. Remove once content
// is live in Prismic.
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
  const slices = settings.value?.data?.press_quotes
  return slices?.length ? slices : fallbackPress
})

// TODO: move these into the `settings` single type too.
const legal = [
  { label: 'Privacy Policy',   href: '#privacy' },
  { label: 'Terms of Service', href: '#terms' },
]
</script>
