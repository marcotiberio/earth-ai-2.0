<template>
  <footer class="sticky bottom-0 z-0 h-dvh w-full bg-darkblue text-darkblue">
    <div
      class="h-full overflow-y-auto"
      data-lenis-prevent
      :style="{ opacity: footerOpacity }"
    >
    <div class="min-h-full flex flex-col justify-between boxed !pb-sm !pt-[62px]">
    <div class="flex flex-col items-start justify-between gap-sm mb-sm w-full">
      <div class="flex flex-row items-start justify-between gap-sm w-full">
        <div class="flex flex-col items-start justify-between gap-sm w-full md:w-1/2">
          <span class="font-h2 font-serif text-beige">{{ mainTitle }}</span>
          <a
            href="mailto:contact@earth-ai.com"
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
          <PrismicLink :field="item.link" :aria-label="item.social" class="block text-beige hover:text-yellow hover:cursor-pointer transition-colors">
            <span
              aria-hidden="true"
              class="block h-6 w-6 bg-current"
              :style="{
                mask: `url(/icons/${item.social.toLowerCase()}.svg) center / contain no-repeat`,
                WebkitMask: `url(/icons/${item.social.toLowerCase()}.svg) center / contain no-repeat`,
              }"
            />
          </PrismicLink>
        </li>
      </ul>
    </div>

    <div class="grid gap-8 border-t border-beige pt-10 md:grid-cols-3">
      <SliceZone :slices="visibleSlices(press)" :components="components" />
    </div>

    <div class="mt-sm flex flex-col justify-start sm:flex-row sm:items-center sm:justify-end gap-sm border-t border-beige pt-sm font-label text-beige">
      <nav v-if="footer?.data?.legal_links?.length" class="w-full flex justify-center sm:justify-end gap-sm">
        <PrismicLink
          v-for="(item, i) in footer.data.legal_links"
          :key="i"
          :field="item.link"
          class="font-mono uppercase hover:text-yellow hover:cursor-pointer transition-colors"
        />
      </nav>
      <span class="font-mono uppercase whitespace-nowrap flex justify-center">© EARTH AI – {{ new Date().getFullYear() }}</span>
    </div>
    </div>
    </div>
  </footer>
</template>

<script setup>
import { components } from '~/slices'

const route = useRoute()

const { footerOpacity } = useFooterReveal()

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
  return slices?.length ? slices : []
})

const mainTitle = computed(
  () => footer.value?.data?.footer_main_title || 'Follow our journey.',
)
</script>
