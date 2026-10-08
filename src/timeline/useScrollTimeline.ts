import { useLayoutEffect, type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { buildMasterTimeline } from './master'
import { world } from './world'
import { jumpTo, setScroller, travelTo } from './scroller'
import { filmFor, restAfter, restNear } from './rhythm'

gsap.registerPlugin(ScrollTrigger)

/** How far (film units) a rest reaches out to catch a scroll that comes to a stop. */
const SETTLE_REACH = 2.4
/** Quiet time after the last scroll movement before the film settles. */
const SETTLE_DELAY = 160

const NEXT = new Set(['ArrowDown', 'PageDown', ' '])
const PREV = new Set(['ArrowUp', 'PageUp'])

/**
 * Smooth scroll (Lenis) driving the master timeline (GSAP ScrollTrigger),
 * through the film's rhythm: scroll slows the film down at each rest, and a
 * scroll that comes to a stop near one settles gently onto it. The keyboard
 * steps from rest to rest.
 */
export function useScrollTimeline(root: RefObject<HTMLElement | null>, track: RefObject<HTMLElement | null>, enabled: boolean) {
  useLayoutEffect(() => {
    if (!root.current || !track.current) return
    const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.85, smoothWheel: true })
    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    const tl = buildMasterTimeline(root.current)
    const st = ScrollTrigger.create({
      trigger: track.current,
      start: 'top top',
      end: 'bottom bottom',
      // Lenis already smooths the wheel; a short follow keeps the film responsive
      onUpdate: (self) => {
        gsap.to(tl, { totalProgress: filmFor(self.progress) / 100, duration: 0.4, ease: 'power3.out', overwrite: true })
      },
    })
    tl.totalProgress(filmFor(st.progress) / 100)

    const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight
    /** where the scroll is heading, in film units */
    const heading = () => filmFor(lenis.targetScroll / Math.max(maxScroll(), 1))

    let idle = 0
    const settle = () => {
      const film = filmFor(lenis.scroll / Math.max(maxScroll(), 1))
      const r = restNear(film, SETTLE_REACH)
      if (r === null || Math.abs(r - film) < 0.04) return
      travelTo(r, { duration: 0.9 + Math.abs(r - film) * 0.3 })
    }
    lenis.on('scroll', () => {
      ScrollTrigger.update()
      window.clearTimeout(idle)
      idle = window.setTimeout(settle, SETTLE_DELAY)
    })

    const onKey = (e: KeyboardEvent) => {
      if (!enabled || e.metaKey || e.ctrlKey || e.altKey) return
      const dir = NEXT.has(e.key) ? 1 : PREV.has(e.key) ? -1 : 0
      if (!dir) return
      e.preventDefault()
      travelTo(restAfter(heading(), dir))
    }
    window.addEventListener('keydown', onKey)

    if (!enabled) lenis.stop()
    setScroller(lenis)
    if (import.meta.env.DEV) {
      // dev-only: jump to a point of the film, e.g. __seek(45)
      Object.assign(window, {
        __world: world,
        __tl: tl,
        __seek: (p: number) => {
          jumpTo(p)
          gsap.killTweensOf(tl)
          tl.totalProgress(p / 100)
        },
        // seek and let the frame settle — for screenshots
        __shot: (p: number) => {
          ;(window as unknown as { __seek: (p: number) => void }).__seek(p)
          return new Promise((r) => setTimeout(r, 1400))
        },
      })
    }

    return () => {
      window.clearTimeout(idle)
      window.removeEventListener('keydown', onKey)
      setScroller(null)
      st.kill()
      gsap.killTweensOf(tl)
      tl.kill()
      gsap.ticker.remove(raf)
      lenis.destroy()
    }
  }, [root, track, enabled])
}
