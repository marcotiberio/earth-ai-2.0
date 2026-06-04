<template>
  <article class="flex flex-col gap-4">
    <img
      v-if="imageUrl"
      :src="imageUrl"
      :alt="imageAlt"
      class="h-auto w-full aspect-video self-start object-cover"
    />

    <component
      :is="linkHref ? 'a' : 'div'"
      :href="linkHref || undefined"
      :target="linkTarget || undefined"
      :rel="linkTarget === '_blank' ? 'noopener noreferrer' : undefined"
      class="flex flex-1 flex-col gap-4"
      :class="linkHref ? 'group' : ''"
    >
      <div class="mt-auto flex flex-col items-start justify-start text-xs text-darkblue">
        <time v-if="dateValue" :datetime="dateValue">{{ dateValue }}</time>
        <p
          class="font-serif text-darkblue text-lg md:text-xl leading-snug"
          :class="linkHref ? 'transition-colors group-hover:text-grey' : ''"
        >
          &ldquo;<span v-html="titleHtml" />&rdquo;
        </p>
      </div>
      <a
        v-if="linkHref"
        :href="linkHref"
        :target="linkTarget || undefined"
        :rel="linkTarget === '_blank' ? 'noopener noreferrer' : undefined"
        class="mt-auto text-sm text-darkblue hover:underline"
      >Read more</a>
    </component>
  </article>
</template>

<script setup>
import { asHTML } from '@prismicio/client'

const props = defineProps({
  slice:   { type: Object, required: true },
  context: { type: Object },
  index:   { type: Number },
  slices:  { type: Array },
})

// Strip the block wrapper so rich text renders inline inside our styled <p>,
// keeping bold/italic from the Prismic field.
const inlineSerializer = {
  paragraph: ({ children }) => children,
}

// Tolerate both the static string shape (the footer fallback) and real Prismic
// rich text (the simulator and the live API).
const toHtml = (field) => {
  if (!field) return ''
  return typeof field === 'string'
    ? field
    : asHTML(field, { serializer: inlineSerializer }) || ''
}

// Image fields come back as an object ({ url, alt, ... }); static content may
// pass a plain string url.
const mediaUrl = (field) =>
  typeof field === 'string' ? field : field?.url || ''

// Link fields come back as an object ({ url, target, ... }); static content may
// pass a plain string url.
const linkUrl = (field) =>
  typeof field === 'string' ? field : field?.url || ''

const titleHtml  = computed(() => toHtml(props.slice.primary.title))
const imageUrl   = computed(() => mediaUrl(props.slice.primary.image))
const imageAlt   = computed(() => props.slice.primary.image?.alt || '')
const dateValue  = computed(() => props.slice.primary.date || '')
const linkHref   = computed(() => linkUrl(props.slice.primary.link))
const linkTarget = computed(() => props.slice.primary.link?.target || '')
</script>
