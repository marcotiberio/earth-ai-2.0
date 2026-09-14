import { computed, onMounted, ref } from 'vue'
import { MOBILE_VIDEO_ENABLED } from '../utils/featureFlags'

export function useMobileImage(getBase, getMobile) {
  const mounted = ref(false)
  onMounted(() => { mounted.value = true })

  const isMobile = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 767px)').matches

  return computed(() => {
    const base = getBase() || {}
    const mobile = getMobile()
    return (MOBILE_VIDEO_ENABLED && mounted.value && isMobile && mobile?.url) ? mobile : base
  })
}
