<template>
  <footer class="text-darkblue boxed !pb-sm">
    <!-- Top Bar -->
    <div class="flex flex-col items-start justify-between gap-sm mb-md w-full">
      <div class="flex flex-row items-start justify-between gap-sm w-full">
        <div class="flex flex-col items-start justify-between gap-sm w-full md:w-1/2">
          <span class="font-h2 font-serif text-beige">{{ mainTitle }}</span>
          <!-- ToDo: Add contact link -->
          <a
            href="mailto:info@earthai.com"
            class="btn btn-primary mt-auto font-label text-darkblue hover:underline"
          >Contact us</a>
        </div>
        <PrismicImage
          v-if="footer?.data?.logo_footer?.url"
          :field="footer.data.logo_footer"
          class="h-md w-auto"
          alt="Earth AI logo"
        />
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
    <div class="mt-sm flex flex-col justify-start md:flex-row md:items-center md:justify-end gap-sm border-t border-beige pt-sm font-label text-beige">
      <nav v-if="footer?.data?.legal_links?.length" class="w-full flex justify-center md:justify-end gap-sm">
        <PrismicLink
          v-for="(item, i) in footer.data.legal_links"
          :key="i"
          :field="item.link"
          class="hover:text-orange hover:cursor-pointer transition-colors"
        />
      </nav>
      <span class="whitespace-nowrap flex justify-center">© EARTH AI – {{ new Date().getFullYear() }}</span>
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

const mainTitle = computed(
  () => footer.value?.data?.footer_main_title || 'Follow our journey.',
)
</script>
