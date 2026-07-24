import { PERF_MODE } from './featureFlags'

/**
 * Staging-only video URL override map (Phase 3 — lighter mobile encodes).
 *
 * The site has ONE Prismic repo, shared by live and every staging deploy, so
 * re-pointing a slice's `video_url` in Prismic to test a smaller encode would
 * change the LIVE site instantly. This map lets us test alternate encodes
 * WITHOUT any Prismic write: host a test file anywhere the staging deploy can
 * reach it (e.g. the branch deploy's own `public/`), and map the original
 * Prismic URL → the replacement here.
 *
 * Only consulted when PERF_MODE is on, and empty by default, so it is a complete
 * no-op until populated for a specific test. Once an encode is signed off, the
 * real cutover is: upload it to Prismic, repoint the field there, remove the
 * entry here — no override left in production.
 */

const OVERRIDES = {
  // 'https://earth-ai-static.cdn.prismic.io/…/original.scrub.hevc.mp4':
  //   '/test-encodes/clip-name.mobile.hevc.mp4',
}

/** Swap a clip URL for its staging test encode, if one is mapped. */
export function overrideVideoUrl(url) {
  if (!PERF_MODE || !url) return url
  return OVERRIDES[url] || url
}
