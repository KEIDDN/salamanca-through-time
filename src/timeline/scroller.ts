import type Lenis from 'lenis'

/** The page's smooth scroller, so UI outside the timeline can travel through the film. */
let lenis: Lenis | null = null

export function setScroller(l: Lenis | null) {
  lenis = l
}

/** Glide to a point of the film (0–100). */
export function travelTo(p: number) {
  if (!lenis) return
  const max = document.documentElement.scrollHeight - window.innerHeight
  const target = (p / 100) * max
  const distance = Math.abs(target - window.scrollY) / window.innerHeight
  lenis.scrollTo(target, { duration: Math.min(6, 1.6 + distance * 0.25), easing: (t) => 1 - Math.pow(1 - t, 3) })
}
