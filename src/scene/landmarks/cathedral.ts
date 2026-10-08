import { ConeGeometry, CylinderGeometry, Shape, SphereGeometry, Vector2, Vector3 } from 'three'
import { compass, orientedRect, type CityData } from '../lib/cityData'
import { extrudeFootprint } from '../city/geometry'
import { Parts, T } from '../lib/parts'
import { extrudeShape } from './shapes'

/**
 * The two cathedrals, side by side as in reality:
 *  - Catedral Nueva (1513–1733): late Gothic nave and aisles, crossing dome,
 *    and the 92 m bell tower at the west end, between both churches.
 *  - Catedral Vieja (XII c.): Romanesque, crowned by the Torre del Gallo.
 * Footprints come from OpenStreetMap; the vertical massing is modelled here.
 */
export type CathedralKey = 'cathedral' | 'sandstonePlain' | 'roof' | 'dark'

export function buildCathedrals(data: CityData) {
  const P = new Parts<CathedralKey>()
  const { west, south } = compass(data)

  // ── Catedral Nueva ──────────────────────────────────────────────────────
  const nuevo = data.cathedral.nuevo
  P.add('cathedral', extrudeFootprint(nuevo, 24))
  const r = orientedRect(nuevo)
  const C = new Vector3(r.cx, 0, r.cz)
  const u = new Vector3(Math.cos(r.angle), 0, Math.sin(r.angle))
  if (u.dot(west) < 0) u.negate() // u points west
  const vside = new Vector3(-u.z, 0, u.x)
  if (vside.dot(south) < 0) vside.negate() // v points south
  const yaw = Math.atan2(-u.z, u.x) // local +x → u (west)
  const at = (along: number, across: number, y: number) =>
    C.clone().addScaledVector(u, along).addScaledVector(vside, across).setY(y)

  // clerestory nave with a pitched roof
  const naveW = r.wid * 0.34
  const naveL = r.len * 0.94
  P.frame(T(C.x, 0, C.z, yaw), () => {
    P.box('cathedral', -naveL / 2, 24, -naveW / 2, naveL / 2, 37, naveW / 2)
    const roof = new Shape([new Vector2(-naveW / 2 - 0.5, 0), new Vector2(naveW / 2 + 0.5, 0), new Vector2(0, 6.5)])
    const g = extrudeShape(roof, naveL)
    g.rotateY(Math.PI / 2) // ridge along local x
    g.translate(0, 37, 0)
    P.add('roof', g)
    g.dispose()
    // transept arms
    const tx = -naveL * 0.12
    P.box('cathedral', tx - naveW / 2, 24, -r.wid / 2, tx + naveW / 2, 37, r.wid / 2)
    // pinnacles along clerestory and aisles
    const pin = new ConeGeometry(0.45, 4.2, 6)
    const shaft = new CylinderGeometry(0.4, 0.4, 2.2, 6)
    for (let x = -naveL / 2 + 2; x <= naveL / 2 - 2; x += 5.2) {
      for (const s of [-1, 1]) {
        P.add('cathedral', shaft, T(x, 38.1, s * (naveW / 2 + 0.3)))
        P.add('cathedral', pin, T(x, 41.3, s * (naveW / 2 + 0.3)))
        P.add('cathedral', shaft, T(x, 25.1, s * (r.wid / 2 - 0.8)))
        P.add('cathedral', pin, T(x, 28.3, s * (r.wid / 2 - 0.8)))
        // flying buttress (a slanted slab)
        P.box('cathedral', x - 0.35, 27.5, s > 0 ? naveW / 2 : -r.wid / 2 + 0.8, x + 0.35, 30.5, s > 0 ? r.wid / 2 - 0.8 : -naveW / 2)
      }
    }
    pin.dispose()
    shaft.dispose()
  })

  // crossing dome (Joaquín de Churriguera, rebuilt after 1755)
  const dome = at(-naveL * 0.12, 0, 37)
  const drum = new CylinderGeometry(8.2, 8.2, 11, 24)
  P.add('cathedral', drum, T(dome.x, 37 + 5.5, dome.z))
  const cap = new SphereGeometry(8.4, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2)
  P.add('roof', cap, T(dome.x, 48, dome.z, 0, [1, 1.25, 1]))
  const lantern = new CylinderGeometry(1.7, 1.9, 5, 12)
  P.add('cathedral', lantern, T(dome.x, 60.5 + 2.5, dome.z))
  const lanternCap = new ConeGeometry(2.0, 3.2, 12)
  P.add('roof', lanternCap, T(dome.x, 66.6, dome.z))
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4 + yaw
    const tx = dome.x + Math.cos(a) * 10, tz = dome.z + Math.sin(a) * 10
    P.add('cathedral', new CylinderGeometry(1.1, 1.1, 8, 8), T(tx, 41, tz))
    P.add('cathedral', new ConeGeometry(1.2, 4, 8), T(tx, 47, tz))
  }

  // bell tower: west end, on the side of the old cathedral
  const tw = at(r.len / 2 - 7, r.wid / 2 - 7, 0)
  P.frame(T(tw.x, 0, tw.z, yaw), () => {
    P.box('cathedral', -6.5, 0, -6.5, 6.5, 60, 6.5)
    P.box('sandstonePlain', -7.1, 59.4, -7.1, 7.1, 60.6, 7.1)
    // openings of the belfry stage
    for (const [x, z, ry] of [[0, 6.55, 0], [0, -6.55, 0], [6.55, 0, Math.PI / 2], [-6.55, 0, Math.PI / 2]] as const) {
      P.frame(T(x, 0, z, ry), () => {
        P.box('dark', -1.6, 50, -0.1, -0.4, 57.5, 0.1)
        P.box('dark', 0.4, 50, -0.1, 1.6, 57.5, 0.1)
      })
    }
  })
  P.add('cathedral', new CylinderGeometry(5.6, 6.2, 11, 8), T(tw.x, 66, tw.z, Math.PI / 8 + yaw))
  P.add('roof', new SphereGeometry(5.6, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), T(tw.x, 71.5, tw.z, 0, [1, 1.35, 1]))
  P.add('cathedral', new CylinderGeometry(1.4, 1.6, 6, 8), T(tw.x, 81, tw.z))
  P.add('roof', new ConeGeometry(1.5, 7, 8), T(tw.x, 87.5, tw.z))
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4 + yaw
    const tx = tw.x + Math.cos(a) * 8.4, tz = tw.z + Math.sin(a) * 8.4
    P.add('cathedral', new CylinderGeometry(0.6, 0.6, 4, 6), T(tx, 62.6, tz))
    P.add('cathedral', new ConeGeometry(0.7, 3.6, 6), T(tx, 66.4, tz))
  }

  // ── Catedral Vieja ──────────────────────────────────────────────────────
  const viejo = data.cathedral.viejo
  P.add('cathedral', extrudeFootprint(viejo, 16))
  const ro = orientedRect(viejo)
  const uo = new Vector3(Math.cos(ro.angle), 0, Math.sin(ro.angle))
  if (uo.dot(west) < 0) uo.negate()
  // Torre del Gallo: over the crossing, towards the east end
  const g = new Vector3(ro.cx, 0, ro.cz).addScaledVector(uo, -ro.len * 0.2)
  P.add('cathedral', new CylinderGeometry(5.6, 6, 9, 16), T(g.x, 16 + 4.5, g.z))
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4 + yaw
    const tx = g.x + Math.cos(a) * 6.4, tz = g.z + Math.sin(a) * 6.4
    P.add('cathedral', new CylinderGeometry(1.5, 1.5, 9, 10), T(tx, 20.5, tz))
    P.add('roof', new ConeGeometry(1.7, 4.2, 10), T(tx, 27.1, tz))
  }
  P.add('roof', new ConeGeometry(6.4, 11, 16), T(g.x, 25 + 5.5, g.z))
  P.add('sandstonePlain', new SphereGeometry(0.6, 10, 8), T(g.x, 36.5, g.z))

  return P.build()
}
