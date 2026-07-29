// Frontend feature flags.
//
// MOBILE_VIDEO_ENABLED — gates whether phones are served the lighter mobile clip
// (`video_url_mobile`) instead of the desktop `video_url`. Phase 3 of the
// load-time work turns this ON: phones select the phone-sized scrub encode, and
// the code falls back to the desktop clip when a section has no mobile encode
// uploaded yet — so enabling it is safe even before every field is filled.
// Enabled here on `staging/perf` for cross-device QA. Like PERF_MODE, treat the
// merge to `main` as a deliberate decision, not an automatic carry-over.
export const MOBILE_VIDEO_ENABLED = true

// PERF_MODE — master switch for the load-time / low-bandwidth work (staging/perf
// branch). While `false`, every helper gated on it (useMediaMode, overrideVideoUrl,
// hero-only loader gating) is INERT: the site behaves exactly as it does on main.
// Flip to `true` only on the staging Netlify branch deploy — never merge it enabled
// to the production branch. QA can also force a media mode per-request with the
// `?media=static` / `?media=full` URL override (see composables/useMediaMode.js).
export const PERF_MODE = true
