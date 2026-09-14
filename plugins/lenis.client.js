import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

const DISABLE_LENIS = true

export default defineNuxtPlugin((nuxtApp) => {
  gsap.registerPlugin(ScrollTrigger)

  if (DISABLE_LENIS) {
    ScrollTrigger.config({ ignoreMobileResize: true })
    return
  }

  ScrollTrigger.config({ ignoreMobileResize: true })

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const lenis = new Lenis({
    lerp: reduceMotion ? 1 : 0.1,
    smoothWheel: !reduceMotion,
  })

  lenis.on('scroll', ScrollTrigger.update)

  const raf = (time) => lenis.raf(time * 1000)
  gsap.ticker.add(raf)
  gsap.ticker.lagSmoothing(0)

  ScrollTrigger.addEventListener('refresh', () => lenis.resize())

  nuxtApp.provide('lenis', lenis)

  nuxtApp.hook('app:unmounted', () => {
    gsap.ticker.remove(raf)
    lenis.destroy()
  })
})
