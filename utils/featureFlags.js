// Frontend feature flags.
//
// MOBILE_VIDEO_ENABLED — gates whether phones are served the lighter mobile clip
// (`video_url_mobile`) instead of the desktop `video_url`.
//
// LIVE IN PRODUCTION since the 2026-08 bandwidth release. This was previously
// held at `false` pending a decision on mobile autoplay; that decision was taken
// and phones now get the mobile encode. All seven homepage scrub slices have a
// `video_url_mobile` uploaded — check that any NEW scrub slice does too, because
// a missing mobile encode silently falls back to the heavy desktop clip on
// phones rather than failing visibly.
//
// Roughly halves what a phone visitor downloads (measured: 4.5 MB vs 8.1 MB for
// the first screen). Set to `false` to serve every device the desktop clip, as
// main did before this release.
export const MOBILE_VIDEO_ENABLED = true

// PERF_MODE — master switch for the load-time AND CDN-bandwidth work.
//
// LIVE IN PRODUCTION since the 2026-08 bandwidth release; it is no longer a
// staging-only experiment. Kept as a flag so the old behaviour is one line away
// if something surfaces in the wild that local and headless testing missed.
//
// While `false`, everything it guards is INERT: the site behaves as it did
// before the release (the overlay waits for every homepage clip and every clip
// is downloaded up front). When `true` it does two things:
//
//   1. The launch overlay blocks only on the hero clip + images, so the site is
//      interactive without waiting on the full media set.
//   2. Every other scrub clip is fetched only once its section nears the
//      viewport, instead of all of them at load. This is the bandwidth fix: the
//      7 homepage clips are ~130 MB (desktop) / ~58 MB (mobile), and we were
//      paying that for every visitor including ones who bounced at the hero —
//      enough to burn the Prismic repository's 500 GB monthly CDN allowance in
//      about 3,900 desktop visits. A visitor who never scrolls now costs the
//      hero clip alone (~8 MB desktop / ~4 MB mobile).
//
// Note the trade-off this makes, in case it ever needs reversing: deep sections
// now buffer as they approach rather than being downloaded up front, so on a
// slow connection a very fast scroller can see a clip lag briefly behind the
// scroll before catching up. That is bounded — useScrubVideo clamps the scrub
// target to what is buffered, so it lags smoothly instead of freezing — and it
// is the direct cost of not making every visitor pay for footage they never see.
export const PERF_MODE = true
