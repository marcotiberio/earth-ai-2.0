<template>
  <ScrubScene
    :video-url="videoUrl"
    :image="slice.primary.image || {}"
    :scroll-length="slice.primary.scroll_length || 200"
    :scrub-start="slice.primary.scrub_start || ''"
    align="bottom"
    overlay-class="bg-darkblue/40"
    eager
  >

    <template #pinned>
      <div
        ref="bandRef"
        class="pointer-events-none absolute inset-x-xs md:inset-x-sm top-[22%] bottom-[14%] flex flex-col justify-between"
      >
        <!-- Each dashed guide line carries a strip of telemetry-style random
             numbers that streams left→right in sync with the hero scrub. -->
        <div
          v-for="(track, li) in numberTracks"
          :key="`line-${li}`"
          class="relative h-12 w-full overflow-hidden"
        >
          <svg
            class="absolute bottom-0 left-0"
            width="1640" height="2" viewBox="0 0 1640 2" fill="none" xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M1 1H1639" stroke="#FAF3E4" stroke-width="2" stroke-linecap="round" stroke-dasharray="0.1 15"/>
          </svg>
          <div
            data-line
            class="absolute bottom-1 left-0 w-full flex items-end justify-between gap-8 whitespace-nowrap font-mono text-[10px] leading-none tracking-widest tabular-nums text-beige/50"
          >
            <span v-for="(n, ni) in track" :key="ni" data-num class="inline-block w-12 origin-top-left -rotate-90 whitespace-nowrap opacity-0">{{ fmt(n) }}</span>
          </div>
        </div>
      </div>
      <span
        v-for="(m, i) in slice.primary.markers || []"
        :key="`marker-${i}`"
        class="absolute flex items-start gap-1 text-[11px] tracking-widest text-beige/70"
        :style="{ left: m.x, top: m.y }"
      >
        <span class="leading-none">+</span>
        <span class="inline-block origin-top-left -rotate-90 whitespace-nowrap leading-none">{{ m.value }}</span>
      </span>
    </template>

    <!-- Content that scrolls over the pinned hero video -->
    <div class="w-full flex flex-col gap-8 md:flex-row md:items-end md:justify-start">
      <h1
        class="ea-display font-serif text-beige font-h1 w-full md:w-1/2"
        v-html="titleHtml"
      />
      <p
        v-if="subtitleHtml"
        class="text-beige font-body max-w-sm md:mb-3 w-full md:w-1/2"
        v-html="subtitleHtml"
      />
    </div>
  </ScrubScene>
</template>

<script setup>
import { asHTML } from '@prismicio/client'

const props = defineProps({
  slice:   { type: Object, required: true },
  context: { type: Object },
  index:   { type: Number },
  slices:  { type: Array },
})

// Strip block wrappers so rich text renders as inline markup inside our own
// styled <h1>/<p>, keeping bold/italic (and links) from the Prismic field.
const inlineSerializer = {
  heading1:  ({ children }) => children,
  heading2:  ({ children }) => children,
  paragraph: ({ children }) => children,
}

// Tolerate both a plain static string shape and real Prismic rich text
// (the simulator and the live API).
const toHtml = (field) => {
  if (!field) return ''
  return typeof field === 'string'
    ? field
    : asHTML(field, { serializer: inlineSerializer }) || ''
}

// Link-to-Media fields come back as an object ({ url, ... }); static content
// passes a plain string.
const mediaUrl = (field) =>
  typeof field === 'string' ? field : field?.url || ''

const titleHtml    = computed(() => toHtml(props.slice.primary.title))
const subtitleHtml = computed(() => toHtml(props.slice.primary.subtitle))
const videoUrl     = computed(() => mediaUrl(props.slice.primary.video_url))

// ── Telemetry number strips ─────────────────────────────────────────────────
// Seeded PRNG (no Math.random / Date) so the generated numbers are identical on
// server and client — otherwise SSR hydration would mismatch on first paint.
const mulberry32 = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const LINE_COUNT      = 4
const TOKENS_PER_LINE = 18
// Numeric targets; `+NN.NNN` (via fmt) mirrors the existing rotated coordinate
// markers, so the readouts read as the same family of values.
const numberTracks = Array.from({ length: LINE_COUNT }, (_, li) => {
  const rand = mulberry32(0x1f3d57 + li * 9776)
  return Array.from({ length: TOKENS_PER_LINE }, () => 10 + rand() * 80)
})
const fmt = (v) => `+${v.toFixed(3)}`

// As the hero scrub-scrolls, the numbers appear left→right and count up to their
// value — like an instrument readout filling in. We attach our own ScrollTrigger
// to the same pinned <section> the video uses and mirror its scrub window
// (scrub_start 'top' → 'top top' … 'bottom top'), so the reveal tracks the scrub
// and reverses cleanly when scrubbing back up.
const bandRef = ref(null)
let marqueeST = null

// Tunables (all in scrub-progress units, 0…1):
const REVEAL_SPAN = 0.9  // the sweep visits every position by this progress
const LINE_LAG    = 0.05 // each successive line's sweep starts a touch later
const FADE        = 0.18 // fraction of a slot spent fading the active number in/out

onMounted(async () => {
  const band    = bandRef.value
  const section = band?.closest('section')
  if (!section) return
  const lines = [...band.querySelectorAll('[data-line]')].map((line) => [
    ...line.querySelectorAll('[data-num]'),
  ])
  if (!lines.length) return

  const { gsap }          = await import('gsap')
  const { ScrollTrigger } = await import('gsap/ScrollTrigger')
  gsap.registerPlugin(ScrollTrigger)

  marqueeST = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1,
    onUpdate: (self) => {
      const p = self.progress
      lines.forEach((spans, li) => {
        const n     = spans.length
        const slot  = REVEAL_SPAN / n          // scrub each position is "active"
        const rel   = p - li * LINE_LAG        // this line's local progress
        const idxF  = rel / slot               // fractional position of the sweep
        // The single lit position. Clamp so before the sweep nothing shows and
        // after it the last number stays put rather than the line going dark.
        const active = rel < 0 ? -1 : Math.min(n - 1, Math.floor(idxF))
        const local  = Math.min(1, Math.max(0, idxF - active)) // 0→1 within slot
        const eased  = 1 - (1 - local) * (1 - local)           // ease-out count

        spans.forEach((el, i) => {
          if (i !== active) {
            // Exactly one number per line is ever visible — the rest stay dark.
            if (el.style.opacity !== '0') el.style.opacity = '0'
            return
          }
          // Count this position up to its value as the sweep crosses it…
          el.textContent = fmt(numberTracks[li][i] * eased)
          // …fading it in, then out as the next position takes over. The final
          // position holds (no fade-out) so the line doesn't end up empty.
          let op = 1
          if (local < FADE) op = local / FADE
          else if (local > 1 - FADE && i < n - 1) op = (1 - local) / FADE
          el.style.opacity = String(op)
        })
      })
    },
  })
})

onUnmounted(() => marqueeST?.kill())
</script>
