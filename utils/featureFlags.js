// Frontend feature flags.
//
// MOBILE_VIDEO_ENABLED — gates whether phones are served the lighter mobile clip
// (`video_url_mobile`) instead of the desktop `video_url`. This is part of the
// in-progress mobile-autoplay work being validated on the `autoplayMobileTest`
// branch. On `main` we keep the Prismic field available (so editors can upload
// test encodes and the autoplay branch keeps working) but never SELECT it —
// every device gets the desktop video. Set to `true` (as the autoplay branch
// does) to serve the mobile encode again once we've decided on autoplay.
export const MOBILE_VIDEO_ENABLED = true

// PERF_MODE — master switch for the load-time AND CDN-bandwidth work
// (staging/perf branch). While `false`, everything it guards is INERT: the site
// behaves exactly as it does on main (the overlay waits for every homepage clip
// and every clip is downloaded up front). When `true` it does two things:
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
// Flip to `true` only on the staging Netlify branch deploy — never merge it
// enabled to the production branch.
export const PERF_MODE = true
