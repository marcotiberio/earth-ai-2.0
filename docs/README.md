# Earth AI — Website Wiki

Marketing site for **Earth AI**. A single, media-heavy scrollytelling page (plus
ancillary legal pages) built on **Nuxt 3** with content authored in **Prismic**
and deployed as SSR to **Netlify**. The signature interaction is scroll-scrubbed
video: background clips whose playhead is driven by scroll position.

This is the top-level wiki. Start here, then drill into the focused pages:

| Page | What's in it |
|------|--------------|
| [architecture.md](architecture.md) | App shell, rendering pipeline, routing, scroll & animation system |
| [content-model.md](content-model.md) | Prismic custom types, the slice contract, how editing maps to the site |
| [slices.md](slices.md) | Catalog of every slice (component) and what it renders |
| [media-pipeline.md](media-pipeline.md) | Scroll-scrub video: encoding, preloading, the play-chase scrubber |
| [deployment.md](deployment.md) | Build, environment variables, Netlify, Slice Machine |
| [conventions.md](conventions.md) | Design tokens, typography, Tailwind setup, feature flags |

---

## Stack at a glance

| Layer | Choice | Version | Notes |
|-------|--------|---------|-------|
| Framework | [Nuxt](https://nuxt.com) | `^3.16` | SSR (Nitro), Vue 3 `<script setup>` |
| CMS | [Prismic](https://prismic.io) | `@nuxtjs/prismic ^5.3`, `@prismicio/client ^7.21` | Slice-based, repo `earth-ai-static` |
| Styling | [Tailwind CSS](https://tailwindcss.com) | `^3.4` via `@nuxtjs/tailwindcss ^6.12` | Custom design tokens, no UI kit |
| Animation | [GSAP](https://gsap.com) + ScrollTrigger | `^3.12` | Drives all pinned/scrub scenes |
| Smooth scroll | [Lenis](https://github.com/darkroomengineering/lenis) | `^1.3` | **Currently disabled** (see below) |
| Slice tooling | Slice Machine | `slice-machine-ui ^2.10` | `@slicemachine/adapter-nuxt` |
| Hosting | Netlify | — | Nitro `netlify` preset, Node 20 |
| Node | — | 20 (Netlify CI) | `"type": "module"` |

There is **no** TypeScript in app code (JS + Vue SFCs), **no** test suite, and
**no** state-management library — module-scoped reactive stores cover the few
shared-state needs (e.g. the asset loader).

---

## How it fits together (one paragraph)

Prismic holds the content as a tree of **slices**. Nuxt fetches the `home_page`
single type (`pages/index.vue`) or a repeatable `page` by UID (`pages/[uid].vue`),
filters hidden/disabled slices via [`visibleSlices`](../utils/slices.js), and
renders them through [`SliceZone`](../components/SliceZone.vue), which maps each
`slice_type` string to a Vue component in [`slices/index.js`](../slices/index.js).
The app shell ([`app.vue`](../app.vue)) wraps every page with a launch loader, a
fixed nav, and a sticky-reveal footer. The visual payload is scroll-scrubbed
video, orchestrated by GSAP ScrollTrigger and a custom per-platform video
scrubber.

---

## Repository map

```
app.vue                 App shell: AppLoader + AppNav + <NuxtPage/> + AppFooter
nuxt.config.js          Nuxt/Prismic/runtime config, global <head>
tailwind.config.js      Design tokens (colors, type scale, breakpoints, spacing)
netlify.toml            Build command + Node version for Netlify

pages/                  Routes
  index.vue             '/'  → Prismic `home_page` single type
  [uid].vue             '/:uid' → Prismic repeatable `page` (legal, etc.)
  slice-simulator.vue   Slice Machine preview harness

components/             App-shell + shared building blocks (NOT slices)
  AppLoader.vue         Launch overlay; holds page until media is buffered
  AppNav.vue            Fixed top nav + logo; "push-away" at footer reveal
  AppFooter.vue         Sticky-reveal footer; renders press_quotes from `footer` doc
  SliceZone.vue         Generic slice renderer
  ScrubScene.vue        Reusable pinned scroll-scrub video scene
  DottedLine.vue        Tiled radial-gradient divider

slices/                 One folder per Prismic slice (the content components)
  index.js              slice_type → component map

composables/            Reusable reactive logic (see architecture.md)
utils/                  Pure helpers + scrub-video primitives + feature flags
plugins/lenis.client.js Smooth scroll wiring (currently bypassed)
customtypes/            Prismic content-type definitions (home_page, page, footer)

assets/css/main.css     Tailwind entry + @font-face + component classes (.font-h1…)
public/                 Static images, fonts, icons, favicon
media-src/              Video MASTERS (git-ignored; uploaded to Prismic, not served)
scripts/optimize-videos.sh   ffmpeg re-encode for smooth scrubbing
```

---

## Local development

```bash
npm install                 # postinstall runs `nuxt prepare`
npm run dev                 # nuxt dev on http://localhost:3000 (TMPDIR=/tmp)
npm run slicemachine        # Slice Machine UI for modeling slices
npm run build && npm run preview   # production build + local SSR preview
```

Copy `.env.example` → `.env`. The only required value is the Prismic endpoint
(an access token is needed only if the repo is private). The Prismic repository
name is hard-wired in `slicemachine.config.json` (`earth-ai-static`).

---

## Things worth knowing before you touch the code

- **Lenis smooth scroll is currently OFF.** `DISABLE_LENIS = true` in
  [plugins/lenis.client.js](../plugins/lenis.client.js); the site uses native
  scroll. ScrollTrigger still drives all pins. `$lenis` is left undefined and
  consumers are null-safe.
- **The Splasher "coming soon" gate is disabled site-wide** in
  [utils/slices.js](../utils/slices.js) (`DISABLED_SLICE_TYPES = ['splasher']`),
  regardless of its Prismic state. Remove it from that list to bring the gate back.
- **Mobile video encodes exist but are not served.** `MOBILE_VIDEO_ENABLED = false`
  in [utils/featureFlags.js](../utils/featureFlags.js); every device gets the
  desktop `video_url`. The `video_url_mobile` field stays modeled for the
  in-progress autoplay work.
- **Videos must be HEVC, hvc1-tagged, GOP=5.** Non-HEVC browsers fall back to the
  poster image. See [media-pipeline.md](media-pipeline.md) — don't ship all-intra.
- **Three slices are code-only** (no Prismic model): `wysiwyg`, `cta`,
  `feature_media`. They're registered in `slices/index.js` but not offered as
  choices in any custom type. See [slices.md](slices.md).
</content>
