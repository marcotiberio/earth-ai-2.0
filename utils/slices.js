// Drop any slice whose `is_hidden` Boolean toggle is on in Prismic, so editors
// can hide a section without deleting it. Boolean fields live on `primary`, and
// Prismic sends an absent/false value when the toggle is off — so the default
// is always "show". Use this to filter a slice array before a <SliceZone>.
//
// Temporarily disabled while testing the autoplay branch: the `splasher` slice
// is hidden frontend-wide regardless of its Prismic state. Remove this type from
// the list to bring it back.
const DISABLED_SLICE_TYPES = ['splasher']

export const visibleSlices = (slices) =>
  (slices || []).filter(
    (slice) =>
      !slice?.primary?.is_hidden &&
      !DISABLED_SLICE_TYPES.includes(slice?.slice_type),
  )
