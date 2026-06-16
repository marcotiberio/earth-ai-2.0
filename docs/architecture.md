# Architecture

[← Wiki home](README.md)

## Rendering pipeline

```
Prismic repo (earth-ai-static)
        │  getSingle / getByUID
        ▼
pages/*.vue  ──visibleSlices()──►  SliceZone  ──slice_type lookup──►  slices/*/index.vue
        │                                                                      │
        └── useSeoMeta / useHead (OG, Twitter, canonical)            GSAP ScrollTrigger
                                                                       + useScrubVideo / useScrollProgress
```

- **SSR via Nitro.** `compatibilityDate: '2025-01-01'`. On Netlify, Nitro
  auto-selects its `netlify` preset (server handler as a function, static assets
  to `dist/`).
- **Data fetching** uses `useAsyncData` so it runs on the server and hydrates.
  Every Prismic call is wrapped in `.catch(() => null)` so a CMS hiccup degrades
  to an empty render instead of a 500. `pages/[uid].vue` throws a real 404 for
  unknown slugs.

## Routing

| Route | File | Source |
|-------|------|--------|
| `/` | [pages/index.vue](../pages/index.vue) | Prismic `home_page` **single** type |
| `/:uid` | [pages/[uid].vue](../pages/[uid].vue) | Prismic `page` **repeatable** type (Privacy, ToS, …) |
| `/slice-simulator` | [pages/slice-simulator.vue](../pages/slice-simulator.vue) | Slice Machine preview only |

The Prismic route resolver is declared in
[prismic.config.json](../prismic.config.json): `page` → `/:uid`.

## App shell (`app.vue`)

```
<AppLoader/>                       launch overlay (z-100)
<div id="page-content" z-10 bg>    paints OVER the footer
  <AppNav/>                        fixed (z-50)
  <NuxtPage/>
</div>
<AppFooter/>                       sticky, pinned BEHIND content (z-0)
```

Two deliberate, slightly unusual mechanics here:

1. **Footer is a sticky reveal.** The footer is a viewport-high panel pinned with
   `sticky bottom-0 z-0`, sitting *behind* the opaque `#page-content` (`z-10`).
   As the last section scrolls away, the footer is uncovered in place rather than
   scrolling up after the long pinned scenes. `bottom-0` (not `top-0`) is required
   — a top pin never sticks for the document's last element. See the long comment
   in [AppFooter.vue](../components/AppFooter.vue).
2. **Nav "push-away".** The footer shares the nav's beige palette, so the fixed
   nav would overlap the footer's logo. [AppNav.vue](../components/AppNav.vue)
   listens to scroll and translates the header up by exactly how far the
   page-content seam has crossed into the nav band, keeping the nav's bottom edge
   flush with the reveal seam.

## Scroll & animation system

Everything visual is GSAP **ScrollTrigger**. There are two distinct scroll
drivers, both built on it:

### 1. `useScrubVideo` — video playhead from scroll
[composables/useScrubVideo.js](../composables/useScrubVideo.js) +
[utils/scrubVideo.js](../utils/scrubVideo.js). Maps a clip's `currentTime` across
a pinned section's travel. The hard part is cross-browser frame painting — see
[media-pipeline.md](media-pipeline.md) for the play-chase vs. seek strategy.

### 2. `useScrollProgress` — generic 0→1 scrub for charts
[composables/useScrollProgress.js](../composables/useScrollProgress.js). Shared
by the data-viz slices (SupplyGap, RaceBars, DrilledStats, MapTargets). It pins a
section and exposes a linear `progress` ref (0→1) that each slice maps to its own
reveal (bars growing, curves drawing, count-ups, marker fades). It also bakes in:
- **Reduced motion** → `tall=false`, `progress=1` (collapses to the finished state).
- **Coarse pointer** detection (`tall`/`coarse` refs) for touch-specific lengths.
- A `waitForLayout` option (await `nextTick` before measuring).

### Composables summary

| Composable | Role |
|------------|------|
| [useScrubVideo](../composables/useScrubVideo.js) | Scroll-drives a `<video>` playhead (play-chase / seek per platform) |
| [useScrollProgress](../composables/useScrollProgress.js) | Generic pinned 0→1 progress for chart slices |
| [useAssetLoader](../composables/useAssetLoader.js) | Module-scoped store: collects + fully downloads homepage media for the loader |

### `ScrubScene.vue` — the reusable scrub scene
[components/ScrubScene.vue](../components/ScrubScene.vue) is the shared
presentation layer the video slices build on: a tall section with a sticky,
full-viewport (or inset "frame" mode) video, content slots that scroll over it,
poster-first lazy `src` attachment, a mobile pin-length cap with a "tail" dwell,
and Slice-Simulator collapse (renders a single composed frame inside the Page
Builder preview instead of a cropped tall section).

## Lenis (smooth scroll) — currently bypassed

[plugins/lenis.client.js](../plugins/lenis.client.js) wires Lenis to GSAP's
ticker so smooth scroll and ScrollTrigger share one RAF loop. **It is disabled**
(`DISABLE_LENIS = true`): the site runs on native scroll with
`ScrollTrigger.config({ ignoreMobileResize: true })` (so the mobile URL-bar
resize doesn't jolt the pins). To re-enable, flip the flag — consumers already
fall back gracefully when `$lenis` is undefined.
</content>
