const DEFAULT_QUALITY = 70

export function imgixUrl(url, { w, q = DEFAULT_QUALITY, dpr } = {}) {
  if (!url || typeof url !== 'string') return ''
  const [base, query = ''] = url.split('?')
  const params = new URLSearchParams(query)
  if (!params.has('auto')) params.set('auto', 'format,compress')
  params.set('q', String(q))
  if (w) params.set('w', String(w))
  if (dpr) params.set('dpr', String(dpr))
  const qs = params.toString().replace(/%2C/gi, ',')
  return `${base}?${qs}`
}

export function imgixSrcset(url, widths = [768, 1280, 1920], { q = DEFAULT_QUALITY } = {}) {
  if (!url || typeof url !== 'string') return ''
  return widths.map((w) => `${imgixUrl(url, { w, q })} ${w}w`).join(', ')
}
