// Frontend feature flags.
//
// MOBILE_VIDEO_ENABLED — gates whether phones are served the lighter mobile clip
// (`video_url_mobile`) instead of the desktop `video_url`. This is part of the
// in-progress mobile-autoplay work being validated on the `autoplayMobileTest`
// branch. On `main` we keep the Prismic field available (so editors can upload
// test encodes and the autoplay branch keeps working) but never SELECT it —
// every device gets the desktop video. Set to `true` (as the autoplay branch
// does) to serve the mobile encode again once we've decided on autoplay.
export const MOBILE_VIDEO_ENABLED = false

// PERF_MODE — master switch for the load-time work (staging/perf branch). While
// `false`, the hero-only launch gating it guards is INERT: the site behaves
// exactly as it does on main (the overlay waits for every homepage clip). When
// `true`, the launch overlay blocks only on the hero clip + images and lets the
// rest download in the background. Flip to `true` only on the staging Netlify
// branch deploy — never merge it enabled to the production branch.
export const PERF_MODE = true
