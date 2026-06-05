<template>
  <main>
    <SliceZone v-if="page" :slices="visibleSlices(page.data.slices)" :components="components" />
  </main>
</template>

<script setup>
import { components } from '~/slices'

// Fetch the published `home_page` single type from Prismic. Only slices that
// have been modeled, pushed, and added to the document will render here — the
// remaining sections live in content/home.js until they're migrated too.
const prismic = usePrismic()
const { data: page } = await useAsyncData('home_page', () =>
  prismic.client.getSingle('home_page').catch(() => null),
)

useSeoMeta({
  title:       () => page.value?.data.meta_title,
  description: () => page.value?.data.meta_description,
})
</script>
