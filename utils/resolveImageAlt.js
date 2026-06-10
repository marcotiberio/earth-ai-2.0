// Resolve alt text for a Prismic image so no *content* image ships with an empty
// `alt`, which search engines and screen readers read as "decorative". Editors
// can always override by filling the alt field in Prismic; this only supplies a
// sensible fallback when they leave it blank.
//
// `image`    — a Prismic image object ({ url, alt, ... }) or a plain url string.
// `context`  — optional descriptive text drawn from nearby content (a quote
//              source, a scene/section title) to make the fallback specific.
//
// Precedence: editor-provided alt → context + brand → brand alone. Purely
// decorative elements should NOT use this — pass an explicit alt="" instead.
const BRAND = 'Earth AI'

export const resolveImageAlt = (image, context) => {
  const editorAlt = typeof image === 'string' ? '' : image?.alt
  if (editorAlt && editorAlt.trim()) return editorAlt.trim()

  const ctx = (context || '').toString().trim()
  return ctx ? `${ctx} — ${BRAND}` : BRAND
}
