# Build & deployment

[← Wiki home](README.md)

## Scripts (`package.json`)

| Command | Does |
|---------|------|
| `npm run dev` | `nuxt dev` on :3000 (`TMPDIR=/tmp` to avoid macOS temp issues) |
| `npm run build` | `nuxt build` — SSR server + client bundle |
| `npm run preview` | Serve the production build locally |
| `npm run generate` | Static prerender (not the deploy path) |
| `npm run slicemachine` | Slice Machine UI for modeling slices |
| `postinstall` | `nuxt prepare` (regenerates `.nuxt` types) |

## Netlify ([netlify.toml](../netlify.toml))

```toml
[build]
  command = "npm run build"
  publish = "dist"
[build.environment]
  NODE_VERSION = "20"
```

Nitro detects Netlify CI (`NETLIFY=true`) and auto-selects its `netlify` preset:
static assets to `dist/`, the SSR handler deployed as a Netlify function. No
preset is hard-coded in `nuxt.config.js` — it's environment-driven.

## Environment variables

| Var | Purpose | Default |
|-----|---------|---------|
| `PRISMIC_ENDPOINT` | Prismic API endpoint | falls back to `slicemachine.config.json` `apiEndpoint` |
| `PRISMIC_ACCESS_TOKEN` | Only if the Prismic repo is private | — |
| `NUXT_PUBLIC_SITE_URL` | Base for absolute OG/canonical URLs | `https://earthaistatic.netlify.app/` |
| `NODE_ENV` | `production` disables the Prismic preview toolbar | — |

Set `NUXT_PUBLIC_SITE_URL` to the real production domain in Netlify so OG/Twitter
share images and canonical links resolve correctly.

## Prismic / Slice Machine config

- [slicemachine.config.json](../slicemachine.config.json) — repo
  `earth-ai-static`, adapter `@slicemachine/adapter-nuxt`, slice library
  `./slices`, simulator at `http://localhost:3000/slice-simulator`.
- [prismic.config.json](../prismic.config.json) — route resolver: `page` → `/:uid`.
- The **preview toolbar** is loaded only when `NODE_ENV !== 'production'`
  ([nuxt.config.js](../nuxt.config.js)) — it sets third-party cookies and trips
  Lighthouse "Best Practices", so it's dropped from production while in-context
  Preview still works in local dev.

## SEO / head

- Global defaults in `nuxt.config.js` `app.head` (charset, viewport, static OG
  site/type/locale, Twitter card type, favicon, `lang="en"`).
- Per-route `useSeoMeta` in each page builds title/description and absolute
  OG/Twitter image + URL from `NUXT_PUBLIC_SITE_URL`, plus a canonical link.
  Falls back to the hero image (`1920×1080`) and "Earth AI" when meta fields are
  blank.

## CI / tests

There is **no test suite** and no CI config in-repo beyond Netlify's build. Verify
changes via `npm run preview` (SSR) and the Slice Simulator for slice rendering.
</content>
