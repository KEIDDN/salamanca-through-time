import { useLayoutEffect, type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { buildMasterTimeline } from './master'
import { world } from './world'
import { setScroller } from './scroller'

gsap.registerPlugin(ScrollTrigger)

/** Smooth scroll (Lenis) driving the master timeline (GSAP ScrollTrigger). */
export function useScrollTimeline(root: RefObject<HTMLElement | null>, track: RefObject<HTMLElement | null>, enabled: boolean) {
  useLayoutEffect(() => {
    if (!root.current || !track.current) return
    const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.85, smoothWheel: true })
    lenis.on('scroll', ScrollTrigger.update)
    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    const tl = buildMasterTimeline(root.current)
    const st = ScrollTrigger.create({
      trigger: track.current,
      start: 'top top',
      end: 'bottom bottom',
      // Lenis already smooths the wheel; a short scrub keeps the film responsive
      scrub: 0.35,
      animation: tl,
      onUpdate: (self) => root.current?.style.setProperty('--progress', self.progress.toFixed(4)),
    })

    if (!enabled) lenis.stop()
    setScroller(lenis)
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
      setScroller(null)
      st.kill()
      tl.kill()
      gsap.ticker.remove(raf)
      lenis.destroy()
    }
  }, [root, track, enabled])
}
