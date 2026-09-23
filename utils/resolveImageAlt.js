const BRAND = 'Earth AI'

export const resolveImageAlt = (image, context) => {
  const editorAlt = typeof image === 'string' ? '' : image?.alt
  if (editorAlt && editorAlt.trim()) return editorAlt.trim()

  const ctx = (context || '').toString().trim()
  return ctx ? `${ctx} — ${BRAND}` : BRAND
}
