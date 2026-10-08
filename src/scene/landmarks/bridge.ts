import { BoxGeometry, CapsuleGeometry, ConeGeometry, CylinderGeometry, Shape, SphereGeometry, Vector2 } from 'three'
import type { CityData } from '../lib/cityData'
import { Parts, T } from '../lib/parts'
import { WATER_Y } from '../lib/terrain'
import { arcadeWall, extrudeShape } from './shapes'

/**
 * Puente Romano: 26 round arches over the Tormes (15 of them Roman, I c. AD),
 * voussoir rings, pointed cutwaters upstream and buttresses downstream, solid
 * abutments, a ramp down to the Arrabal, and the verraco at the city end.
 */
export type BridgeKey = 'granite' | 'sandstonePlain'

export const BRIDGE_DECK = WATER_Y + 10.8
const BOTTOM = WATER_Y - 6

export function buildBridge(data: CityData) {
  const P = new Parts<BridgeKey>()
  const [ax, az] = data.bridge.a
  const [bx, bz] = data.bridge.b
  const len = Math.hypot(bx - ax, bz - az)
  const yaw = Math.atan2(-(bz - az), bx - ax) // local +x runs from a (city) to b (Arrabal)
  const bays = 26
  const W = 5.8
  const pier = 4.2
  const B = len / bays
  const r = (B - pier) / 2
  const spring = WATER_Y + 3.2 - BOTTOM
  const H = BRIDGE_DECK - BOTTOM

  P.frame(T((ax + bx) / 2, BOTTOM, (az + bz) / 2, yaw), () => {
    const wall = arcadeWall({ length: len, height: H, bays, pier, spring, thickness: W, segments: 20 })
    wall.translate(0, 0, W / 2)
    P.add('granite', wall)
    wall.dispose()

    for (let i = 0; i < bays; i++) {
      const xc = -len / 2 + B * (i + 0.5)
      // voussoir ring, standing proud of both faces
      const ring = new Shape()
      const seg = 22
      ring.moveTo(xc - r - 0.85, spring)
      for (let k = 0; k <= seg; k++) {
        const a = Math.PI - (k / seg) * Math.PI
        ring.lineTo(xc + (r + 0.85) * Math.cos(a), spring + (r + 0.85) * Math.sin(a))
      }
      for (let k = seg; k >= 0; k--) {
        const a = Math.PI - (k / seg) * Math.PI
        ring.lineTo(xc + r * Math.cos(a), spring + r * Math.sin(a))
      }
      const rg = extrudeShape(ring, W + 0.36)
      P.add('sandstonePlain', rg)
      rg.dispose()
    }

    // cutwaters: pointed upstream (−z side), square buttresses downstream
    const prism = new CylinderGeometry(2.4, 2.4, 1, 3)
    const hood = new ConeGeometry(2.4, 2.4, 3)
    const capH = WATER_Y + 7.2 - BOTTOM
    for (let i = 1; i < bays; i++) {
      const x = -len / 2 + B * i
      const g = prism.clone()
      g.scale(1, capH, 1)
      P.add('granite', g, T(x, capH / 2, -(W / 2 + 0.9), Math.PI))
      P.add('granite', hood, T(x, capH + 1.2, -(W / 2 + 0.9), Math.PI))
      P.box('granite', x - 1.6, 0, W / 2, x + 1.6, capH - 1.5, W / 2 + 1.6)
      P.box('sandstonePlain', x - 1.8, capH - 1.5, W / 2, x + 1.8, capH - 1.0, W / 2 + 1.8)
      g.dispose()
    }
    prism.dispose()
    hood.dispose()

    // parapets and string course
    for (const s of [-1, 1]) {
      P.box('granite', -len / 2, H, s > 0 ? W / 2 - 0.5 : -W / 2, len / 2, H + 1.15, s > 0 ? W / 2 : -W / 2 + 0.5)
      P.box('sandstonePlain', -len / 2, H - 0.45, s > 0 ? W / 2 : -W / 2 - 0.25, len / 2, H - 0.1, s > 0 ? W / 2 + 0.25 : -W / 2)
    }

    // abutment towards the city and the ramp down to the Arrabal
    P.box('granite', -len / 2 - 52, 0, -W / 2 - 0.4, -len / 2 + 0.5, H, W / 2 + 0.4)
    const ramp = new Shape([new Vector2(0, 0), new Vector2(46, 0), new Vector2(0, H - (WATER_Y + 3.5 - BOTTOM))])
    const rampG = extrudeShape(ramp, W + 0.8)
    P.add('granite', rampG, T(len / 2 - 0.5, WATER_Y + 3.5 - BOTTOM, 0))
    P.box('granite', len / 2 - 0.5, 0, -W / 2 - 0.4, len / 2 + 46, WATER_Y + 3.5 - BOTTOM, W / 2 + 0.4)
    rampG.dispose()

    // the verraco at the city end
    P.frame(T(-len / 2 + 7, H, -0.4, 0, 0.9), () => verraco(P, 'sandstonePlain'))
  })
  return P.build()
}

/**
 * A Vetton verraco: a granite boar on a plinth (IV–I c. BC).
 * Local frame: snout towards +x, standing on y = 0, about 2.7 m long.
 */
export function verraco<K extends string>(P: Parts<K>, key: K) {
  P.box(key, -1.5, 0, -0.62, 1.5, 0.42, 0.62) // plinth
  P.box(key, -1.1, 0.42, -0.4, 1.05, 0.95, 0.4) // carved block between the legs
  // legs, carved in relief on the block
  for (const x of [-0.85, 0.75]) for (const z of [-0.36, 0.36]) P.box(key, x - 0.17, 0.42, z - 0.09, x + 0.17, 1.05, z + 0.09)
  const body = new CapsuleGeometry(0.64, 1.55, 8, 20)
  P.add(key, body, T(0, 1.38, 0, 0, [1, 1, 0.9], 0, Math.PI / 2))
  const neck = new SphereGeometry(0.55, 16, 12)
  P.add(key, neck, T(1.05, 1.42, 0, 0, [0.9, 0.95, 0.9]))
  const head = new CylinderGeometry(0.26, 0.5, 1.0, 14)
  P.add(key, head, T(1.55, 1.24, 0, 0, 1, 0, -Math.PI / 2 - 0.3))
  const snout = new CylinderGeometry(0.2, 0.23, 0.22, 12)
  P.add(key, snout, T(2.04, 1.07, 0, 0, 1, 0, -Math.PI / 2 - 0.3))
  const ear = new ConeGeometry(0.14, 0.34, 8)
  P.add(key, ear, T(1.3, 1.83, 0.22, 0, 1, -0.35))
  P.add(key, ear, T(1.3, 1.83, -0.22, 0, 1, 0.35))
  const ridge = new BoxGeometry(1.7, 0.12, 0.18)
  P.add(key, ridge, T(-0.05, 2.04, 0))
  const rump = new SphereGeometry(0.55, 16, 12)
  P.add(key, rump, T(-1.05, 1.32, 0, 0, [0.72, 1, 0.92]))
  const tail = new CylinderGeometry(0.05, 0.07, 0.5, 6)
  P.add(key, tail, T(-1.45, 1.15, 0, 0, 1, 0, 0.25))
  ;[body, neck, head, snout, ear, ridge, rump, tail].forEach((g) => g.dispose())
}
