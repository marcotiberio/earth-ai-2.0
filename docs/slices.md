# Slice catalog

[← Wiki home](README.md)

Every slice lives in `slices/<Name>/` with `index.vue` (render) and usually
`model.json` (Prismic model), `mocks.json` (Slice Simulator data) and a
screenshot. Registered for rendering in [slices/index.js](../slices/index.js).

All content slices share `primary.is_hidden`. Scrolly slices also share
`scroll_length` (Number, vh) and `scrub_start` (Select `top`/`middle`).

## Modeled slices (offered in Prismic)

| slice_type | Component | Purpose | Notable fields |
|------------|-----------|---------|----------------|
| `hero_image` | [HeroImage](../slices/HeroImage/index.vue) | Opening hero; scroll-scrub video or static image | `video_url`(+mobile), `image`, `title`, `subtitle`, `scroll_length`, `scrub_start` |
| `video_scroll` | [VideoScroll](../slices/VideoScroll/index.vue) | Pinned scrub-video section with overlaid title/subtitle | `frame`, `gradient_top/bottom`, `video_url`(+mobile), `image`, per-axis title/subtitle aligns |
| `video_scroll_titles` | [VideoScrollTitles](../slices/VideoScrollTitles/index.vue) | Scrub video with a sequence of titles revealed across the pin | `items` (group of titles), `gradient_top/bottom`, aligns |
| `race_bars` | [RaceBars](../slices/RaceBars/index.vue) | Animated "race" bar chart scrubbed on scroll | `heading`, `items` (group) |
| `supply_gap` | [SupplyGap](../slices/SupplyGap/index.vue) | Supply-vs-demand line/area chart | `heading`, `body`, `y_ticks`, `x_labels`, `demand`, `supply` (groups) |
| `drilled_stats` | [DrilledStats](../slices/DrilledStats/index.vue) | Scrub video with count-up stats in-frame | `title`, `video_url`(+mobile), `image`, `stats` (group) |
| `map_targets` | [MapTargets](../slices/MapTargets/index.vue) | Australia map with target markers + stats | `title`, `body`, `stats` (group); SVGs `australia.svg`, `markers.svg` |
| `horizontal_scroll` | [HorizontalScroll](../slices/HorizontalScroll/index.vue) | Pinned row of cards (two per row on desktop, one below it) that scroll moves sideways 1:1 (50vh hold at both ends); releases once the last card is in view. Each card's clip is scrubbed by the scroll while the card is fully in view, one clip at a time (the next starts once the previous has finished, so the first desktop pair play in turn; a clip on the first / last card stretches the lead-in / dwell to 70vh). Below desktop the track also stops at every card with a clip and holds it pinned for 70vh (`CLIP_HOLD_VH`) while the clip scrubs through, then slides on; fetched once the section is near, the next screenful of cards pre-buffered; the image is the poster and fallback | `section_label`, `title`, `cards` (group: `title`, `subtitle`, `image`, `video_url` + `video_url_mobile` (optional)), `scroll_length` (optional — defaults to the measured horizontal travel, 1:1) |
| `slider_images` | [SliderImages](../slices/SliderImages/index.vue) | Pinned one-slide-at-a-time slider with numbered bar navigation; scroll steps through the slides (70vh each, 50vh hold at both ends) and releases after the last, clicking a bar scrolls to that slide. Slides with a clip play it muted (active slide only, fetched once the section is near, next slide pre-buffered); the active bar fills with the clip, and when it ends the slider scrolls on to the next slide (only while pinned in view; the last clip loops); the image is the poster and fallback | `section_label`, `title` (optional), `slides` (group: `image`, `video_url` + `video_url_mobile` (optional), `title`, `description` (rich text: paragraphs, bullets, bold / italic / links)) |
| `text_content` | [TextContent](../slices/TextContent/index.vue) | Plain rich-text block (used on `page` docs) | `title`, `subtitle`, `content` |
| `press_quotes` | [PressQuotes](../slices/PressQuotes/index.vue) | A single press quote card (footer renders a grid of these) | `image`, `title`, `link`, `link_label` |
| `splasher` | [Splasher](../slices/Splasher/index.vue) | Full-screen "coming soon" gate — **disabled site-wide** | `label` |

## Code-only slices (registered, but NOT modeled in Prismic)

These exist in `slices/index.js` and render if present in a document, but are not
offered as choices in any custom type and have no `model.json`. Treat them as
latent/legacy until modeled.

| slice_type | Component |
|------------|-----------|
| `wysiwyg` | [Wysiwyg](../slices/Wysiwyg/index.vue) |
| `cta` | [Cta](../slices/Cta/index.vue) |
| `feature_media` | [FeatureMedia](../slices/FeatureMedia/index.vue) |

## Building blocks (not slices)

Reusable components under [components/](../components/): `SliceZone`, `ScrubScene`
(the shared pinned scrub scene the video slices wrap), `AppNav`, `AppFooter`,
`AppLoader`, `DottedLine`. See [architecture.md](architecture.md).

## Disabled / gated behavior

- **`splasher`** is force-hidden by `DISABLED_SLICE_TYPES` in
  [utils/slices.js](../utils/slices.js) so the live site is visible. Remove it
  from that array to re-enable the gate.
- Any slice can be hidden per-instance with the `is_hidden` toggle.
</content>
