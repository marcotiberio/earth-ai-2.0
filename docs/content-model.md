# Content model (Prismic)

[← Wiki home](README.md)

Repository: **`earth-ai-static`**
(`https://earth-ai-static.cdn.prismic.io/api/v2`). Content types live in
[customtypes/](../customtypes/); slice models in `slices/*/model.json`. Both are
managed through Slice Machine (`npm run slicemachine`).

## Custom types

### `home_page` (single)
The homepage. One document, not repeatable.

| Tab | Field | Type |
|-----|-------|------|
| Main | `slices` | Slice zone — choices: `hero_image, video_scroll, video_scroll_titles, drilled_stats, race_bars, supply_gap, map_targets, splasher` |
| SEO & Metadata | `meta_title`, `meta_description`, `meta_image` | Text / Text / Image |

### `page` (repeatable)
Any URL-addressable page (`/:uid`) — legal pages and richer marketing pages.

| Tab | Field | Type |
|-----|-------|------|
| Main | `uid` | UID (the URL slug) |
| Main | `slices` | Slice zone — choices: `hero_image, video_scroll, video_scroll_titles, race_bars, supply_gap, drilled_stats, map_targets, text_content, press_quotes, splasher` |
| SEO & Metadata | `meta_title`, `meta_description`, `meta_image` | Text / Text / Image |

### `footer` (single)
Drives the global footer. **Not a slice zone of page content** — its slice zone
holds only `press_quotes`.

| Field | Type | Used by |
|-------|------|---------|
| `footer_main_title` | Text | Footer headline (default "Follow our journey.") |
| `logo_footer` | Image | Footer logo |
| `social_media_links` | Group (`social`, `link`) | Social icon row (icon resolved as `/icons/{social}.svg`) |
| `legal_links` | Group (`link`) | Bottom-bar legal nav |
| `slices` | Slice zone (`press_quotes` only) | The footer's press quote grid |

## The slice contract

`SliceZone` renders each slice by looking its `slice_type` up in
[slices/index.js](../slices/index.js). Two conventions every slice follows:

- **`primary.is_hidden`** (Boolean) — an editor toggle to hide a section without
  deleting it. [`visibleSlices`](../utils/slices.js) filters these out before
  render. Absent/false ⇒ shown.
- **Scrub controls** — the scrolly slices expose `scroll_length` (Number, pinned
  travel in vh) and `scrub_start` (Select: `top`/`middle`) so editors tune the
  interaction per section without code changes.

### Video field pairing
Video slices carry `video_url` (desktop, a Prismic Link-to-media) and
`video_url_mobile` (lighter encode). Today **only the desktop URL is served**
(`MOBILE_VIDEO_ENABLED = false`). The asset loader and `ScrubScene` both contain
device-aware selection logic that activates when that flag is flipped on.

### Editor → site mapping cheat-sheet
- Add/reorder a section → edit the `slices` zone of `home_page` (or a `page`).
- Hide a section temporarily → toggle `is_hidden` on that slice.
- Change a background clip → re-upload to the slice's `video_url`
  (must be HEVC/hvc1/GOP=5 — see [media-pipeline.md](media-pipeline.md)).
- Edit social/legal links or footer copy → the `footer` document.
- SEO/share preview → the `meta_*` fields (falls back to hero image + "Earth AI").

See [slices.md](slices.md) for each slice's own fields.
</content>
