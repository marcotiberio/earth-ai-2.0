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

// PERF_MODE — master switch for the load-time / low-bandwidth work (staging/perf
// branch). While `false`, every helper gated on it (useMediaMode, overrideVideoUrl,
// hero-only loader gating) is INERT: the site behaves exactly as it does on main.
// Flip to `true` only on the staging Netlify branch deploy — never merge it enabled
// to the production branch. QA can also force a media mode per-request with the
// `?media=static` / `?media=full` URL override (see composables/useMediaMode.js).
export const PERF_MODE = true
