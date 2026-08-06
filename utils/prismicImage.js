// Prismic images are served through imgix (images.prismic.io), so we can size,
// compress and re-format them on the fly with URL params instead of shipping the
// full-resolution master. Prismic's default url already carries
// `?auto=format,compress` (modern format + compression); what it lacks is a
// width cap and an explicit quality, so a 1920×1080+ original is sent even into
// a element that renders it much smaller. These helpers add `w`/`q` (and build a
// responsive srcset) on top of whatever params the url already has.
//
// See https://docs.imgix.com/apis/rendering for the full param set.

const DEFAULT_QUALITY = 70

/**
 * Return `url` with imgix sizing params applied. Idempotent and safe: a blank or
 * non-string value comes back as '' , and existing params are preserved (only
 * w/q/dpr are set/overridden, and `auto=format,compress` is ensured).
 *
 *   imgixUrl(image.url, { w: 1600, q: 68 })
 */
export function imgixUrl(url, { w, q = DEFAULT_QUALITY, dpr } = {}) {
  if (!url || typeof url !== 'string') return ''
  const [base, query = ''] = url.split('?')
  const params = new URLSearchParams(query)
  if (!params.has('auto')) params.set('auto', 'format,compress')
  params.set('q', String(q))
  if (w) params.set('w', String(w))
  if (dpr) params.set('dpr', String(dpr))
  // URLSearchParams encodes the comma in `format,compress` as %2C; imgix accepts
  // it, but restore the literal comma to match Prismic's own url style.
  const qs = params.toString().replace(/%2C/gi, ',')
  return `${base}?${qs}`
}

/**
 * Build a responsive `srcset` string across `widths` (each entry sized via
 * imgixUrl). Pair with `sizes` on the <img>. Returns '' for a blank url.
 *
 *   :srcset="imgixSrcset(image.url, [768, 1280, 1920])" sizes="100vw"
 */
export function imgixSrcset(url, widths = [768, 1280, 1920], { q = DEFAULT_QUALITY } = {}) {
  if (!url || typeof url !== 'string') return ''
  return widths.map((w) => `${imgixUrl(url, { w, q })} ${w}w`).join(', ')
}
