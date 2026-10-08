import { BoxGeometry, CapsuleGeometry, ConeGeometry, CylinderGeometry, SphereGeometry } from 'three'
import type { CityData } from '../lib/cityData'
import { Parts, T } from '../lib/parts'
import { arcadeWall } from './shapes'

/**
 * Puente Romano: 26 round arches over the Tormes (15 of them Roman, I c. AD),
 * cutwaters on the piers, parapets, and the Iron Age verraco at its city end.
 */
export type BridgeKey = 'granite' | 'sandstonePlain'

export const BRIDGE_DECK = 10.4

export function buildBridge(data: CityData) {
  const P = new Parts<BridgeKey>()
  const [ax, az] = data.bridge.a
  const [bx, bz] = data.bridge.b
  const len = Math.hypot(bx - ax, bz - az)
  const yaw = Math.atan2(-(bz - az), bx - ax) // local +x runs from a to b
  const bays = 26
  const W = 5.6
  const pier = 3.6
  const B = len / bays

  P.frame(T((ax + bx) / 2, 0, (az + bz) / 2, yaw), () => {
    // the arcade itself, extruded across the deck width
    const wall = arcadeWall({ length: len, height: BRIDGE_DECK, bays, pier, spring: 3.4, thickness: W, segments: 14 })
    wall.translate(0, 0, W / 2)
    P.add('granite', wall)
    wall.dispose()
    // parapets
    for (const s of [-1, 1]) P.box('granite', -len / 2, BRIDGE_DECK, s * (W / 2) - 0.45 * (s > 0 ? 1 : 0), len / 2, BRIDGE_DECK + 1.1, s * (W / 2) + 0.45 * (s < 0 ? 1 : 0))
    // cutwaters on both faces of every pier
    const prism = new CylinderGeometry(2.1, 2.1, 6.2, 3)
    const hood = new ConeGeometry(2.1, 2.2, 3)
    for (let i = 1; i < bays; i++) {
      const x = -len / 2 + B * i
      for (const s of [-1, 1]) {
        const ry = s > 0 ? -Math.PI / 2 : Math.PI / 2
        P.add('granite', prism, T(x, 3.1, s * (W / 2 + 0.6), ry))
        P.add('granite', hood, T(x, 7.3, s * (W / 2 + 0.6), ry))
      }
    }
    prism.dispose()
    hood.dispose()
    // the verraco at the city end
    P.frame(T(-len / 2 + 6, BRIDGE_DECK, -0.6, Math.PI / 2, 0.85), () => verraco(P, 'sandstonePlain'))
  })
  return P.build()
}

/**
 * A Vetton verraco: a granite boar on a plinth (IV–I c. BC).
 * Local frame: snout towards +x, standing on y = 0, about 2.4 m long.
 */
export function verraco<K extends string>(P: Parts<K>, key: K) {
  P.box(key, -1.45, 0, -0.6, 1.45, 0.45, 0.6) // plinth
  P.box(key, -1.05, 0.45, -0.38, 1.0, 0.95, 0.38) // carved block between the legs
  const body = new CapsuleGeometry(0.62, 1.5, 6, 16)
  P.add(key, body, T(0, 1.35, 0, 0, [1, 1, 0.92], 0, Math.PI / 2))
  const head = new CylinderGeometry(0.28, 0.5, 0.95, 12)
  P.add(key, head, T(1.45, 1.25, 0, 0, 1, 0, -Math.PI / 2 - 0.25))
  const snout = new CylinderGeometry(0.2, 0.22, 0.25, 10)
  P.add(key, snout, T(1.95, 1.08, 0, 0, 1, 0, -Math.PI / 2 - 0.25))
  const ear = new ConeGeometry(0.13, 0.3, 6)
  P.add(key, ear, T(1.25, 1.75, 0.2, 0, 1, -0.3))
  P.add(key, ear, T(1.25, 1.75, -0.2, 0, 1, 0.3))
  const ridge = new BoxGeometry(1.6, 0.1, 0.16)
  P.add(key, ridge, T(-0.05, 2.0, 0))
  const rump = new SphereGeometry(0.5, 12, 10)
  P.add(key, rump, T(-1.0, 1.3, 0, 0, [0.7, 1, 0.95]))
  ;[body, head, snout, ear, ridge, rump].forEach((g) => g.dispose())
}
