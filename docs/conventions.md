# Conventions — design tokens, styling, flags

[← Wiki home](README.md)

## Tailwind setup ([tailwind.config.js](../tailwind.config.js))

Tailwind 3.4 via `@nuxtjs/tailwindcss`. Content scanned: `components`, `layouts`,
`pages`, `slices`, `app.vue`. No UI kit, no plugins — just custom tokens.

### Color palette
| Token | Hex | Use |
|-------|-----|-----|
| `darkblue` | `#0D111B` | Page background |
| `beige` | `#FAF3E4` | Primary text / light surfaces |
| `grey` | `#8A93A6` | Muted captions on navy |
| `orange` | `#E97B39` | Supply bars, highlights, hover accents |
| `black` | `#050F23` | Back-compat alias (older slices) |
| `white` | `#FAF3E4` | Back-compat alias → beige |

### Breakpoints
Named (from the legacy `_variables.scss`) and standard aliases coexist:
`mobile`/`sm` 640px · `tablet`/`md` 780px · `desktop`/`lg`/`desktopWide` 1180px ·
`xl` 1680px. The runtime "is mobile" check in JS uses `max-width: 767px`.

### Spacing scale
`xs` 1rem · `sm` 2.5rem · `md` 6rem · `lg` 8rem · `xl` 12rem. (Note: the inline
comments in the config quote px values that don't match the rem — trust the rem.)

### Fonts
`sans` → **Beausite Classic** · `serif` → **TWK Ghost** · `serifItalic` →
**TWK Ghost Italic**. Licensed `.woff2` served from `public/fonts`, declared with
`@font-face` (`font-display: swap`) in `assets/css/main.css`. Default border
radius is `7px`.

## Global CSS ([assets/css/main.css](../assets/css/main.css))

Tailwind entry + the font faces + a `@layer components` set of reusable classes —
use these instead of re-deriving type styles inline:

- **Type scale**: `.font-h1`, `.font-h2`, `.font-h3`, `.font-body`,
  `.font-label`/`.font-caption` (responsive sizes baked in).
- **`.boxed`**: shared slice padding (vertical rhythm + responsive gutters).
- **`.wysiwyg`**: rich-text styling; `<em>` renders in the serif italic accent.
- **`.btn`** + `.btn-primary` / `.btn-outline`: the button system.
- Scrollbar hidden (`::-webkit-scrollbar { width: 0 }`); base `html` is
  darkblue/beige/sans with antialiasing.

The `[data-lenis-prevent]` rules support independently-scrolling regions (e.g. the
footer's inner scroll) when Lenis is active.

## Feature flags & toggles

| Flag / toggle | Location | State | Effect |
|---------------|----------|-------|--------|
| `MOBILE_VIDEO_ENABLED` | [utils/featureFlags.js](../utils/featureFlags.js) | `false` | When true, phones get `video_url_mobile`; currently every device gets desktop `video_url` |
| `DISABLED_SLICE_TYPES` | [utils/slices.js](../utils/slices.js) | `['splasher']` | Force-hides the "coming soon" gate site-wide |
| `DISABLE_LENIS` | [plugins/lenis.client.js](../plugins/lenis.client.js) | `true` | Bypasses Lenis; native scroll only |
| `is_hidden` | per-slice (Prismic) | editor | Hides one slice instance |

## Accessibility & images

- **Reduced motion** is honored throughout: `useScrollProgress` collapses pinned
  scenes to their finished state; Lenis (when on) drops to no smoothing.
- **Image alt text**: use [resolveImageAlt](../utils/resolveImageAlt.js) for
  content images so none ship with an empty `alt`. Precedence: editor alt →
  context + "Earth AI" → "Earth AI". Pass explicit `alt=""` for purely decorative
  images instead.

## Code style

- Vue 3 SFCs, `<script setup>`, plain JavaScript (no TS in app code).
- Auto-imports: Nuxt/Vue (`ref`, `computed`, `useAsyncData`, `useRoute`…),
  composables (`composables/`), and helpers (`utils/`) are auto-imported — no
  explicit import needed for those.
- Comments in this codebase are dense and explain *why* (especially the
  scroll/scrub workarounds). Preserve that altitude when editing.
</content>
