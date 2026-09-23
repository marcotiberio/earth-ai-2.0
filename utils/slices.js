export const visibleSlices = (slices) =>
  (slices || []).filter((slice) => !slice?.primary?.is_hidden)
