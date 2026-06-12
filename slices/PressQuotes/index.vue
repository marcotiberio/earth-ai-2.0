<template>
  <article class="flex flex-col h-full flex-stretch">

    <component
      :is="linkHref ? 'a' : 'div'"
      :href="linkHref || undefined"
      :target="linkTarget || undefined"
      :rel="linkTarget === '_blank' ? 'noopener noreferrer' : undefined"
      class="flex flex-1 flex-col gap-4"
      :class="linkHref ? 'group' : ''"
    >
      <div class=" flex flex-col gap-xs">
        <figure class="overflow-hidden rounded flex flex-col gap-xs">
          <img
            v-if="imageUrl"
            :src="imageUrl"
            :alt="imageAlt"
            class="h-auto w-full aspect-[16/7] self-start object-cover rounded grayscale"
            :class="linkHref ? 'transition-all group-hover:scale-105 group-hover:transition-all ' : ''"
            
          />
        </figure>
        <p
          class="text-beige font-h3"
          :class="linkHref ? 'transition-colors group-hover:text-orange' : ''"
        >
          &ldquo;<span v-html="titleHtml" />&rdquo;
        </p>
      </div>
      <a
        v-if="linkHref"
        :href="linkHref"
        :target="linkTarget || undefined"
        :rel="linkTarget === '_blank' ? 'noopener noreferrer' : undefined"
        class="btn btn-primary mt-auto font-label"
        :alt="linkLabel"
      >{{ linkLabel }}</a>
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
const imageAlt   = computed(() => resolveImageAlt(props.slice.primary.image, 'Press coverage'))
const dateValue  = computed(() => props.slice.primary.date || '')
const linkHref   = computed(() => linkUrl(props.slice.primary.link))
const linkTarget = computed(() => props.slice.primary.link?.target || '')
const linkLabel  = computed(() => props.slice.primary.link_label || 'Read More')
</script>
