import { ConeGeometry, CylinderGeometry, Shape, SphereGeometry, Vector2, Vector3 } from 'three'
import { orientedRect, type CityData } from '../lib/cityData'
import { extrudeFootprint } from '../city/geometry'
import { Parts, T } from '../lib/parts'
import { archHole, extrudeShape } from './shapes'

/**
 * The old town along the Rúa: La Clerecía (twin baroque towers and dome),
 * the Casa de las Conchas (its façade of carved shells) and the Escuelas
 * Mayores of the University. Footprints from OpenStreetMap.
 */
export type OldTownKey = 'sandstone' | 'sandstonePlain' | 'roof' | 'dark' | 'cathedral'

export function buildOldTown(data: CityData) {
  const P = new Parts<OldTownKey>()
  const L = data.landmarks
  const centroid = (r: [number, number][]) =>
    new Vector3(r.reduce((s, p) => s + p[0], 0) / r.length, 0, r.reduce((s, p) => s + p[1], 0) / r.length)
  const conchasC = centroid(L.conchas)

  // ── La Clerecía (1617–1755) ─────────────────────────────────────────────
  {
    const r = orientedRect(L.clerecia)
    const C = new Vector3(r.cx, 0, r.cz)
    const u = new Vector3(Math.cos(r.angle), 0, Math.sin(r.angle))
    // u points at the façade, which faces the Casa de las Conchas
    if (u.dot(conchasC.clone().sub(C)) < 0) u.negate()
    const yaw = Math.atan2(-u.z, u.x)
    P.add('sandstone', extrudeFootprint(L.clerecia, 17))
    P.frame(T(C.x, 0, C.z, yaw), () => {
      const len = r.len, wid = r.wid
      // nave with a pitched roof
      P.box('sandstone', -len / 2 + 4, 17, -wid * 0.24, len / 2 - 9, 27, wid * 0.24)
      const roof = new Shape([new Vector2(-wid * 0.24 - 0.4, 0), new Vector2(wid * 0.24 + 0.4, 0), new Vector2(0, 5.5)])
      const rg = extrudeShape(roof, len - 13)
      rg.rotateY(Math.PI / 2)
      rg.translate(-4.5, 27, 0)
      P.add('roof', rg)
      rg.dispose()
      // crossing dome
      const dx = -len * 0.12
      P.add('sandstone', new CylinderGeometry(7.4, 7.4, 8, 24), T(dx, 31, 0))
      P.box('sandstonePlain', dx - 7.8, 34.6, -7.8, dx + 7.8, 35.2, 7.8)
      P.add('cathedral', new SphereGeometry(7.6, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), T(dx, 35, 0, 0, [1, 1.2, 1]))
      P.add('sandstone', new CylinderGeometry(1.4, 1.6, 4, 10), T(dx, 46.6, 0))
      P.add('cathedral', new ConeGeometry(1.6, 3, 10), T(dx, 50, 0))
      // façade frontispiece between the towers
      const fx = len / 2 - 3
      P.box('sandstone', fx - 4, 0, -7.5, fx + 1.2, 31, 7.5)
      const ped = new Shape([new Vector2(-7.5, 0), new Vector2(7.5, 0), new Vector2(5.5, 2.6), new Vector2(0, 5.2), new Vector2(-5.5, 2.6)])
      const pg = extrudeShape(ped, 2.2)
      pg.rotateY(Math.PI / 2)
      pg.translate(fx, 31, 0)
      P.add('sandstone', pg)
      pg.dispose()
      for (let k = -2; k <= 2; k++) P.box('sandstonePlain', fx + 1.2, 2, k * 3 - 0.35, fx + 1.75, 30, k * 3 + 0.35) // giant order
      for (const y of [10, 20.5, 30]) P.box('sandstonePlain', fx + 1.1, y, -7.6, fx + 2.1, y + 0.8, 7.6)
      P.box('dark', fx + 1.25, 0.3, -1.8, fx + 1.3, 7.5, 1.8) // portal
      // the twin towers
      for (const s of [-1, 1]) {
        const tz = s * 11.2
        P.box('sandstone', fx - 7, 0, tz - 3.9, fx + 0.8, 36, tz + 3.9)
        P.box('sandstonePlain', fx - 7.4, 36, tz - 4.3, fx + 1.2, 37, tz + 4.3)
        P.box('sandstone', fx - 6.4, 37, tz - 3.3, fx + 0.2, 46, tz + 3.3)
        for (const [ox, oz] of [[0.25, 0], [-6.65, 0], [-3.1, 3.35], [-3.1, -3.35]] as const) {
          P.frame(T(fx + ox, 0, tz + oz, Math.abs(oz) > 0 ? 0 : Math.PI / 2), () => P.box('dark', -1.1, 38.5, -0.1, 1.1, 44, 0.1))
        }
        P.box('sandstonePlain', fx - 6.8, 46, tz - 3.7, fx + 0.6, 46.8, tz + 3.7)
        P.add('sandstone', new CylinderGeometry(2.3, 2.6, 4.5, 8), T(fx - 3.1, 49, tz, Math.PI / 8))
        P.add('cathedral', new SphereGeometry(2.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), T(fx - 3.1, 51.2, tz, 0, [1, 1.3, 1]))
        P.add('cathedral', new ConeGeometry(0.6, 3.4, 8), T(fx - 3.1, 56, tz))
        for (const [ox, oz] of [[0.4, 3.5], [0.4, -3.5], [-6.6, 3.5], [-6.6, -3.5]] as const)
          P.add('sandstonePlain', new SphereGeometry(0.45, 10, 8), T(fx + ox, 47.3, tz + oz))
      }
    })
  }

  // ── Casa de las Conchas (1493–1517) ─────────────────────────────────────
  {
    const ring = L.conchas
    P.add('sandstone', extrudeFootprint(ring, 15.5))
    const clereciaC = centroid(L.clerecia)
    const shell = new SphereGeometry(0.17, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2)
    shell.rotateX(Math.PI / 2) // dome facing +z
    // shells on the two street façades: the one facing the Clerecía and its neighbour
    const area = ring.reduce((s, p, i) => {
      const q = ring[(i + 1) % ring.length]
      return s + p[0] * q[1] - q[0] * p[1]
    }, 0)
    const ccw = area > 0
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % ring.length]
      const ex = b[0] - a[0], ez = b[1] - a[1]
      const len = Math.hypot(ex, ez)
      if (len < 12) return
      // outward normal
      const n = ccw ? new Vector3(ez, 0, -ex).normalize() : new Vector3(-ez, 0, ex).normalize()
      const mid = new Vector3((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2)
      const toward = clereciaC.clone().sub(mid).normalize()
      if (n.dot(toward) < -0.2) return
      const yaw = Math.atan2(n.x, n.z) // local +z → outward
      P.frame(T(mid.x, 0, mid.z, yaw), () => {
        for (let y = 3.6; y < 14.5; y += 1.05)
          for (let x = -len / 2 + 1; x < len / 2 - 0.8; x += 1.2) {
            const off = (Math.round(y / 1.05) % 2) * 0.6
            if (y < 9.5 && Math.abs((x + off) % 9) < 1.6) continue // windows
            P.add('sandstonePlain', shell, T(x + off, y, 0.02))
          }
        // Gothic windows with their iron grilles, the portal and its arms
        for (let k = -1; k <= 1; k += 2) {
          P.box('dark', k * len * 0.22 - 1.1, 4.2, -0.05, k * len * 0.22 + 1.1, 7.6, 0.08)
          P.box('sandstonePlain', k * len * 0.22 - 1.5, 7.6, 0, k * len * 0.22 + 1.5, 8.4, 0.35)
        }
        P.box('dark', -1.3, 0, -0.05, 1.3, 3.6, 0.08)
        P.box('sandstonePlain', -2, 3.6, 0, 2, 5.6, 0.3)
        P.box('sandstonePlain', -len / 2, 14.6, -0.3, len / 2, 15.5, 0.45)
      })
    })
    shell.dispose()
  }

  // ── Escuelas Mayores (XV–XVI c.) ────────────────────────────────────────
  {
    const ring = L.escuelas
    P.add('sandstone', extrudeFootprint(ring, 15))
    const r = orientedRect(ring)
    // the plateresque façade looks onto the Patio de Escuelas
    const to = new Vector3(L.patio[0] - r.cx, 0, L.patio[1] - r.cz)
    const axes = [0, 1, 2, 3].map((k) => r.angle + (k * Math.PI) / 2)
    const a = axes.reduce((best, x) => (Math.cos(x) * to.x + Math.sin(x) * to.z > Math.cos(best) * to.x + Math.sin(best) * to.z ? x : best))
    const depth = Math.abs(Math.cos(a - r.angle)) > 0.5 ? r.len : r.wid
    const yaw = Math.atan2(Math.cos(a), Math.sin(a)) // local +z → towards the patio
    P.frame(T(r.cx, 0, r.cz, yaw), () => {
      const s = new Shape([new Vector2(-6.5, 0), new Vector2(6.5, 0), new Vector2(6.5, 19), new Vector2(0, 21.5), new Vector2(-6.5, 19)])
      s.holes.push(archHole(-2.6, 0.6, 2.8, 3.4), archHole(2.6, 0.6, 2.8, 3.4))
      const g = extrudeShape(s, 1.4)
      P.add('cathedral', g, T(0, 0, depth / 2 + 0.4))
      g.dispose()
      for (const y of [6.5, 11.5, 16]) P.box('sandstonePlain', -6.8, y, depth / 2 + 0.9, 6.8, y + 0.45, depth / 2 + 1.4)
    })
  }

  return P.build()
}
