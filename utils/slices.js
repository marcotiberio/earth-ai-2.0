// Drop any slice whose `is_hidden` Boolean toggle is on in Prismic, so editors
// can hide a section without deleting it. Boolean fields live on `primary`, and
// Prismic sends an absent/false value when the toggle is off — so the default
// is always "show". Use this to filter a slice array before a <SliceZone>.
export const visibleSlices = (slices) =>
  (slices || []).filter((slice) => !slice?.primary?.is_hidden)
