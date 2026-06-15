// Frontend feature flags.
//
// MOBILE_VIDEO_ENABLED — gates whether phones are served the lighter mobile clip
// (`video_url_mobile`) instead of the desktop `video_url`. This is part of the
// in-progress mobile-autoplay work being validated on this branch, so it's ON
// here. On `main` the same flag is `false`: the Prismic field stays available
// but every device gets the desktop video until we've decided on autoplay.
export const MOBILE_VIDEO_ENABLED = true
