import { beats } from '../content/story'

/**
 * The film's rhythm. Scroll does not map linearly onto film time: around each
 * rest — a moment worth reading — the film needs much more scroll to advance,
 * so it slows to a near stop while the copy is on screen and moves briskly
 * between rests. Like a product page that holds each product in frame.
 *
 * The mapping is built from a scroll density over film time (1 = normal,
 * higher = slower); its integral, normalised, is the scroll position.
 */

/** Film positions (0–100) where the film rests. */
export const rests: number[] = (() => {
  const out = beats
    .filter((b) => b.out <= 100)
    // the copy is fully set a little after `in` and starts leaving before `out`
    .map((b) => b.in + (b.out - b.in) * 0.48)
  out.push(54.8) // the section drawn as an architectural section, legend on
  return out.sort((a, b) => a - b)
})()

const HOLD = 2.6 // extra scroll at a rest, relative to normal speed
const WIDTH = 1.25 // film units the slowdown spreads over

/** Moments that play in slow motion without being rests: the scroll never settles on them. */
const SLOW = [{ at: 85.4, hold: 1.8, width: 1.4 }] // the stone breaking open

/** The hero frames hold longer: arriving in the square, the golden city, the bridge at sunset. */
const HERO = new Set(['plaza', 'golden', 'bridge'])
const heroRests = beats.filter((b) => HERO.has(b.id)).map((b) => b.in + (b.out - b.in) * 0.48)
const holdAt = (at: number) => (heroRests.some((h) => Math.abs(h - at) < 1e-6) ? HOLD * 1.35 : HOLD)

const bumps = [...rests.map((at) => ({ at, hold: holdAt(at), width: WIDTH })), ...SLOW]

const N = 2000
const scrollAt = new Float64Array(N + 1) // film i/N*100 → scroll 0..1

{
  let acc = 0
  const density = (t: number) => {
    let d = 1
    for (const b of bumps) d += b.hold * Math.exp(-(((t - b.at) / b.width) ** 2))
    return d
  }
  scrollAt[0] = 0
  for (let i = 1; i <= N; i++) {
    const t = ((i - 0.5) / N) * 100
    acc += density(t)
    scrollAt[i] = acc
  }
  for (let i = 0; i <= N; i++) scrollAt[i] /= acc
}

/** How much longer the page is than a linear film (to keep the pace between rests). */
export const SCROLL_STRETCH = (100 + bumps.reduce((a, b) => a + b.hold * b.width * Math.sqrt(Math.PI), 0)) / 100

/** Film position (0–100) → scroll progress (0–1). */
export function scrollFor(film: number) {
  const x = (Math.min(Math.max(film, 0), 100) / 100) * N
  const i = Math.min(Math.floor(x), N - 1)
  return scrollAt[i] + (scrollAt[i + 1] - scrollAt[i]) * (x - i)
}

/** Scroll progress (0–1) → film position (0–100). */
export function filmFor(scroll: number) {
  const s = Math.min(Math.max(scroll, 0), 1)
  let lo = 0, hi = N
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (scrollAt[mid] <= s) lo = mid
    else hi = mid
  }
  const span = scrollAt[hi] - scrollAt[lo] || 1
  return ((lo + (s - scrollAt[lo]) / span) / N) * 100
}

/** The nearest rest within `reach` film units, if any. */
export function restNear(film: number, reach: number) {
  let best: number | null = null
  for (const r of rests) if (Math.abs(r - film) <= reach && (best === null || Math.abs(r - film) < Math.abs(best - film))) best = r
  return best
}

/** The next rest strictly after (dir 1) or before (dir -1) `film`; the ends of the film otherwise. */
export function restAfter(film: number, dir: 1 | -1) {
  const list = [0, ...rests, 100]
  if (dir === 1) return list.find((r) => r > film + 0.4) ?? 100
  return [...list].reverse().find((r) => r < film - 0.4) ?? 0
}
