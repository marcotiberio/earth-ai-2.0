import { computed, onMounted, ref } from 'vue'
import { MOBILE_VIDEO_ENABLED } from '../utils/featureFlags'

/**
 * Pick a device-appropriate poster / fallback image. On phones — and only when
 * MOBILE_VIDEO_ENABLED, matching the device-aware video selection — a section can
 * show a different crop via its mobile image field; otherwise the main image is
 * used. Falls back to the main image whenever no mobile crop is set.
 *
 * SSR and the first client paint always resolve to the main image (mounted is
 * still false), so the server markup and hydration agree; the mobile crop is
 * swapped in after mount. Pass getters so the result tracks prop changes.
 *
 *   const poster = useMobileImage(() => props.image, () => props.imageMobile)
 */
export function useMobileImage(getBase, getMobile) {
  const mounted = ref(false)
  onMounted(() => { mounted.value = true })

  // Read once on the client; absent on the server (falls back to the base image).
  const isMobile = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 767px)').matches

  return computed(() => {
    const base = getBase() || {}
    const mobile = getMobile()
    return (MOBILE_VIDEO_ENABLED && mounted.value && isMobile && mobile?.url) ? mobile : base
  })
}
