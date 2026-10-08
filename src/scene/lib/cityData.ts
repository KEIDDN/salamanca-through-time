import { Vector3 } from 'three'

/** Shape of public/data/salamanca.json (see scripts/build-city.mjs). */
export type CityData = {
  attribution: string
  origin: { lat: number; lon: number }
  rotationDeg: number
  slab: { x0: number; x1: number; z0: number; z1: number }
  plaza: { ring: [number, number][]; rect: { cx: number; cz: number; angle: number; w: number; d: number } }
  cathedral: { nuevo: [number, number][]; viejo: [number, number][] }
  bridge: { a: [number, number]; b: [number, number] }
  river: [number, number][]
  buildings: { p: number[]; h: number; k: number; holes?: number[][] }[]
}

/** Slab depth: the archaeological block the city sits on. */
export const SLAB_DEPTH = 60

/** Depths (metres below street) of each archaeological layer's floor. */
export const LAYERS = {
  modern: -2.5,
  medieval: -11,
  roman: -20,
  iron: -30,
} as const

let cache: Promise<CityData> | null = null
export function loadCity(): Promise<CityData> {
  cache ??= fetch('/data/salamanca.json').then((r) => {
    if (!r.ok) throw new Error(`city data: ${r.status}`)
    return r.json()
  })
  return cache
}

/** Compass directions expressed in the rotated world frame (unit vectors on XZ). */
export function compass(data: CityData) {
  const a = (data.rotationDeg * Math.PI) / 180
  const north = new Vector3(Math.sin(a), 0, -Math.cos(a))
  const east = new Vector3(Math.cos(a), 0, Math.sin(a))
  return { north, east, south: north.clone().negate(), west: east.clone().negate() }
}

/**
 * Plaza Mayor's local frame: `n` points at the Ayuntamiento (north range),
 * `e` is perpendicular, both lying on one of the square's axes.
 */
export function plazaFrame(data: CityData) {
  const { cx, cz, angle, w, d } = data.plaza.rect
  const ux = new Vector3(Math.cos(angle), 0, Math.sin(angle))
  const uz = new Vector3(-Math.sin(angle), 0, Math.cos(angle))
  const { north } = compass(data)
  const axes = [
    { v: ux, half: w / 2, span: d },
    { v: ux.clone().negate(), half: w / 2, span: d },
    { v: uz, half: d / 2, span: w },
    { v: uz.clone().negate(), half: d / 2, span: w },
  ]
  const n = axes.reduce((best, a) => (a.v.dot(north) > best.v.dot(north) ? a : best))
  const nv = n.v.clone()
  const ev = new Vector3(-nv.z, 0, nv.x)
  const center = new Vector3(cx, 0, cz)
  /** local (east, up, north) → world */
  const at = (e: number, y: number, nn: number) =>
    center.clone().addScaledVector(ev, e).add(new Vector3(0, y, 0)).addScaledVector(nv, nn)
  return { center, n: nv, e: ev, halfN: n.half, halfE: n.span / 2, rotationY: Math.atan2(-nv.x, -nv.z), at }
}

/** Minimum-area oriented rectangle of a footprint. */
export function orientedRect(pts: [number, number][]) {
  let best = { area: Infinity, cx: 0, cz: 0, angle: 0, len: 0, wid: 0 }
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0])
    const c = Math.cos(-angle)
    const s = Math.sin(-angle)
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
    for (const [x, z] of pts) {
      const lx = x * c - z * s
      const lz = x * s + z * c
      x0 = Math.min(x0, lx); x1 = Math.max(x1, lx)
      z0 = Math.min(z0, lz); z1 = Math.max(z1, lz)
    }
    const area = (x1 - x0) * (z1 - z0)
    if (area < best.area) {
      const lcx = (x0 + x1) / 2
      const lcz = (z0 + z1) / 2
      const ci = Math.cos(angle), si = Math.sin(angle)
      const lenX = x1 - x0, lenZ = z1 - z0
      // normalise so `angle` always follows the long side
      const long = lenX >= lenZ
      best = {
        area,
        cx: lcx * ci - lcz * si,
        cz: lcx * si + lcz * ci,
        angle: long ? angle : angle + Math.PI / 2,
        len: Math.max(lenX, lenZ),
        wid: Math.min(lenX, lenZ),
      }
    }
  }
  return best
}

export function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
