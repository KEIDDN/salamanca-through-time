import type Lenis from 'lenis'
import { scrollFor } from './rhythm'

/** The page's smooth scroller, so UI outside the timeline can travel through the film. */
let lenis: Lenis | null = null

export function setScroller(l: Lenis | null) {
  lenis = l
}

const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight

/** Glide to a point of the film (0–100). */
export function travelTo(p: number, opts: { duration?: number } = {}) {
  if (!lenis) return
  const target = scrollFor(p) * maxScroll()
  const distance = Math.abs(target - window.scrollY) / window.innerHeight
  lenis.scrollTo(target, {
    duration: opts.duration ?? Math.min(6, 1.6 + distance * 0.18),
    easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  })
}

/** Jump to a point of the film without gliding. */
export function jumpTo(p: number) {
  lenis?.scrollTo(scrollFor(p) * maxScroll(), { immediate: true, force: true })
}
