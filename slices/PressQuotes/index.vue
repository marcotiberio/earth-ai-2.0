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
            :src="imgixUrl(imageUrl, { w: 800 })"
            :srcset="imgixSrcset(imageUrl, [400, 800, 1200])"
            sizes="(max-width: 780px) 100vw, 50vw"
            :alt="imageAlt"
            class="h-auto w-full aspect-[16/6] md:aspect-video self-start object-cover rounded grayscale"
            :class="linkHref ? 'transition-all group-hover:scale-105 group-hover:transition-all ' : ''"
            
          />
        </figure>
        <p
          class="text-beige font-h3 font-sansLight"
          :class="linkHref ? 'transition-colors group-hover:text-orange' : ''"
        >
          &ldquo;{{ titleText }}&rdquo;
        </p>
      </div>
      <a
        v-if="linkHref"
        :href="linkHref"
        :target="linkTarget || undefined"
        :rel="linkTarget === '_blank' ? 'noopener noreferrer' : undefined"
        class="btn btn-primary mt-auto"
        :alt="linkLabel"
      >{{ linkLabel }}</a>
    </component>
  </article>
</template>

<script setup>
import { asText } from '@prismicio/client'

const props = defineProps({
  slice:   { type: Object, required: true },
  context: { type: Object },
  index:   { type: Number },
  slices:  { type: Array },
})

// Title is a plain Text field. Documents saved while it was still rich text
// keep the array shape until re-edited, so flatten those to plain text.
const toText = (field) => {
  if (!field) return ''
  return typeof field === 'string' ? field : asText(field) || ''
}

// Image fields come back as an object ({ url, alt, ... }); static content may
// pass a plain string url.
const mediaUrl = (field) =>
  typeof field === 'string' ? field : field?.url || ''

// Link fields come back as an object ({ url, target, ... }); static content may
// pass a plain string url.
const linkUrl = (field) =>
  typeof field === 'string' ? field : field?.url || ''

const titleText  = computed(() => toText(props.slice.primary.title))
const imageUrl   = computed(() => mediaUrl(props.slice.primary.image))
const imageAlt   = computed(() => resolveImageAlt(props.slice.primary.image, 'Press coverage'))
const dateValue  = computed(() => props.slice.primary.date || '')
const linkHref   = computed(() => linkUrl(props.slice.primary.link))
const linkTarget = computed(() => props.slice.primary.link?.target || '')
const linkLabel  = computed(() => props.slice.primary.link_label || 'Read More')
</script>
