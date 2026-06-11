<template>
  <main>
    <SliceZone v-if="page" :slices="visibleSlices(page.data.slices)" :components="components" />
  </main>
</template>

<script setup>
import { components } from '~/slices'

// Fetch a repeatable `page` document by its URL slug (UID). Any page built in
// Prismic (Terms of Service, Privacy Policy, or richer marketing pages) renders
// here from its slice zone — every slice in the library is available. Unknown
// slugs 404.
const prismic = usePrismic()
const route = useRoute()
const uid = computed(() => route.params.uid)

const { data: page } = await useAsyncData(
  () => `page:${uid.value}`,
  () => prismic.client.getByUID('page', uid.value).catch(() => null),
)

if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}

// Build absolute URLs (Open Graph requires them) from the configured site URL.
const { public: { siteUrl } } = useRuntimeConfig()
const canonical = computed(() => new URL(route.path, siteUrl).href)

const title       = computed(() => page.value?.data.meta_title || page.value?.data.slices?.[0]?.primary?.title || 'Earth AI')
const description = computed(() => page.value?.data.meta_description || '')

// Social share image: the Prismic `meta_image` field if set, else the hero.
const ogImage = computed(() => {
  const field = page.value?.data.meta_image
  const src = field?.url || '/images/EAI_Landscape-Hero.jpg'
  return new URL(src, siteUrl).href
})
const ogImageAlt = computed(
  () => page.value?.data.meta_image?.alt || 'Earth AI',
)
const ogImageWidth  = computed(() => page.value?.data.meta_image?.dimensions?.width  || 1920)
const ogImageHeight = computed(() => page.value?.data.meta_image?.dimensions?.height || 1080)

useSeoMeta({
  title,
  description,

  // Open Graph
  ogTitle:       title,
  ogDescription: description,
  ogUrl:         canonical,
  ogImage:       ogImage,
  ogImageWidth:  ogImageWidth,
  ogImageHeight: ogImageHeight,
  ogImageAlt:    ogImageAlt,

  // Twitter
  twitterTitle:       title,
  twitterDescription: description,
  twitterImage:       ogImage,
  twitterImageAlt:    ogImageAlt,
})

useHead({
  link: [{ rel: 'canonical', href: canonical }],
})
</script>
