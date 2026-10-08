import { useLayoutEffect, type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { buildMasterTimeline } from './master'
import { world } from './world'

gsap.registerPlugin(ScrollTrigger)

/** Smooth scroll (Lenis) driving the master timeline (GSAP ScrollTrigger). */
export function useScrollTimeline(root: RefObject<HTMLElement | null>, track: RefObject<HTMLElement | null>, enabled: boolean) {
  useLayoutEffect(() => {
    if (!root.current || !track.current) return
    const lenis = new Lenis({ lerp: 0.075, wheelMultiplier: 0.9, smoothWheel: true })
    lenis.on('scroll', ScrollTrigger.update)
    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    const tl = buildMasterTimeline(root.current)
    const st = ScrollTrigger.create({
      trigger: track.current,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1.1,
      animation: tl,
      onUpdate: (self) => root.current?.style.setProperty('--progress', self.progress.toFixed(4)),
    })

    if (!enabled) lenis.stop()
    if (import.meta.env.DEV) {
      // dev-only: jump to a point of the film, e.g. __seek(45)
      Object.assign(window, {
        __world: world,
        __seek: (p: number) => {
          const max = document.documentElement.scrollHeight - window.innerHeight
          lenis.scrollTo((p / 100) * max, { immediate: true, force: true })
          tl.progress(p / 100)
        },
      })
    }

    return () => {
      st.kill()
      tl.kill()
      gsap.ticker.remove(raf)
      lenis.destroy()
    }
  }, [root, track, enabled])
}
