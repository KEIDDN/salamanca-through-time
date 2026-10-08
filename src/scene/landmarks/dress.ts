import { Shape, Vector2, Vector3 } from 'three'
import type { Parts } from '../lib/parts'
import { T } from '../lib/parts'
import { archBand, extrudeShape } from './shapes'

/**
 * Dresses the outer walls of a footprint-extruded monument so it stops
 * reading as a prism: on every edge long enough to matter, a rhythm of
 * buttresses (or pilasters), a window per bay set in its hood, a cornice
 * and, optionally, an open cresting along the top.
 */
export type DressOptions<K extends string> = {
  height: number
  wall: K
  trim: K
  dark: K
  /** distance between buttresses */
  bay: number
  /** buttress (or pilaster) width and projection */
  pier?: { w: number; d: number }
  /** window outline (base on y = 0) and sill height */
  window?: { outline: Vector2[]; y: number; hood?: Vector2[] }
  cornice?: boolean
  crest?: boolean
  minEdge?: number
}

export function dressWalls<K extends string>(P: Parts<K>, ring: [number, number][], o: DressOptions<K>) {
  let area = 0
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length]
    area += p[0] * q[1] - q[0] * p[1]
  }
  const win = o.window && extrudeShape(new Shape(o.window.outline), 0.1)
  const hood = o.window?.hood && extrudeShape(archBand(o.window.hood, o.window.outline), 0.2)
  const H = o.height
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length]
    const ex = b[0] - a[0], ez = b[1] - a[1]
    const len = Math.hypot(ex, ez)
    if (len < (o.minEdge ?? 6)) return
    // outward normal (interior on the left of a counter-clockwise ring)
    const n = area > 0 ? new Vector3(ez, 0, -ex).normalize() : new Vector3(-ez, 0, ex).normalize()
    const mid = new Vector3((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2)
    P.frame(T(mid.x, 0, mid.z, Math.atan2(n.x, n.z)), () => {
      const bays = Math.max(1, Math.round(len / o.bay))
      const B = len / bays
      for (let k = 0; k <= bays; k++) {
        const x = -len / 2 + B * k
        if (o.pier && k > 0 && k < bays) P.box(o.wall, x - o.pier.w / 2, 0, -0.1, x + o.pier.w / 2, H + (o.crest ? 0.9 : 0.1), o.pier.d)
        if (k < bays && win && B > 2.2) {
          const xc = x + B / 2
          P.add(o.dark, win, T(xc, o.window!.y, 0.02))
          if (hood) P.add(o.trim, hood, T(xc, o.window!.y, 0.1))
        }
      }
      if (o.cornice) {
        P.box(o.trim, -len / 2, H - 0.55, -0.1, len / 2, H - 0.25, 0.2)
        P.box(o.trim, -len / 2, H - 0.25, -0.1, len / 2, H, 0.42)
      }
      if (o.crest) {
        P.box(o.trim, -len / 2, H, -0.32, len / 2, H + 0.14, 0.02)
        P.box(o.trim, -len / 2, H + 0.7, -0.3, len / 2, H + 0.82, 0)
        for (let x = -len / 2 + 0.35; x < len / 2 - 0.2; x += 0.7) P.box(o.trim, x - 0.09, H + 0.14, -0.24, x + 0.09, H + 0.7, -0.06)
      }
    })
  })
  win?.dispose()
  hood?.dispose()
}
