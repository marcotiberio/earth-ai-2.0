// Drop any slice whose `is_hidden` Boolean toggle is on in Prismic, so editors
// can hide a section without deleting it. Boolean fields live on `primary`, and
// Prismic sends an absent/false value when the toggle is off — so the default
// is always "show". Use this to filter a slice array before a <SliceZone>.
//
// The `splasher` slice (the full-screen "coming soon" gate) is disabled
// frontend-wide regardless of its Prismic state, so the live site is visible.
// Remove this type from the list to bring the gate back.
const DISABLED_SLICE_TYPES = ['splasher']

export const visibleSlices = (slices) =>
  (slices || []).filter(
    (slice) =>
      !slice?.primary?.is_hidden &&
      !DISABLED_SLICE_TYPES.includes(slice?.slice_type),
  )
