import { BoxGeometry, CylinderGeometry, Shape, Vector2 } from 'three'
import { seeded } from '../lib/cityData'
import { Parts, T } from '../lib/parts'
import { archHole, extrudeShape } from '../landmarks/shapes'
import { verraco } from '../landmarks/bridge'

/**
 * What the section reveals, laid out along the axis Plaza Mayor → Tormes and
 * at the depth of its layer. Each group is lit like a museum piece.
 */
export type ExhibitKey = 'medieval' | 'roman' | 'iron' | 'bedrock'

export const EXHIBIT_SPOTS = [
  { key: 'medieval', at: [0, 9, 168], aim: [0, -7, 212] },
  { key: 'roman', at: [0, 2, 455], aim: [0, -17.5, 520] },
  { key: 'iron', at: [-2, -17, 748], aim: [8, -27.5, 768] },
  { key: 'bedrock', at: [0, -14, 850], aim: [0, -44, 885] },
] as const

export function buildExhibits() {
  const P = new Parts<ExhibitKey>()
  const rand = seeded(220)

  // ── medieval: the town wall, a gate the camera flies through, two towers ──
  {
    const z = 212
    const s = new Shape([new Vector2(-74, -11), new Vector2(74, -11), new Vector2(74, -2.6), new Vector2(-74, -2.6)])
    s.holes.push(archHole(0, -10.6, 6.6, -7.2, 16))
    const wall = extrudeShape(s, 3.2)
    P.add('medieval', wall, T(0, 0, z))
    wall.dispose()
    for (let x = -73; x <= 73; x += 2.6) P.box('medieval', x - 0.65, -2.6, z - 1.6, x + 0.65, -1.2, z + 1.6)
    for (const tx of [-11, 11]) {
      P.add('medieval', new CylinderGeometry(4.4, 4.8, 10.6, 20), T(tx, -11 + 5.3, z))
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2
        P.box('medieval', tx + Math.cos(a) * 4.0 - 0.5, -0.4, z + Math.sin(a) * 4.0 - 0.5, tx + Math.cos(a) * 4.0 + 0.5, 0.8, z + Math.sin(a) * 4.0 + 0.5)
      }
    }
    // house foundations either side of the street, inside the walls
    for (const zc of [95, 135, 170, 260, 300]) for (const sx of [-1, 1]) {
      const x0 = sx * (14 + rand() * 18)
      const w = 8 + rand() * 7, d = 9 + rand() * 6
      const y0 = -10.8, y1 = -9.6 - rand() * 0.8
      P.box('medieval', x0 - w / 2, y0, zc - d / 2, x0 + w / 2, y1, zc - d / 2 + 0.7)
      P.box('medieval', x0 - w / 2, y0, zc + d / 2 - 0.7, x0 + w / 2, y1, zc + d / 2)
      P.box('medieval', x0 - w / 2, y0, zc - d / 2, x0 - w / 2 + 0.7, y1, zc + d / 2)
      P.box('medieval', x0 + w / 2 - 0.7, y0, zc - d / 2, x0 + w / 2, y1, zc + d / 2)
    }
  }

  // ── roman: Vía de la Plata — polygonal paving, kerbs, milestones ──────────
  {
    const y = -17.4
    const flag = new BoxGeometry(1, 1, 1)
    for (let z = 300; z < 650; z += 0.95) {
      let x = -3
      while (x < 3) {
        const w = 0.55 + rand() * 0.55
        const ww = Math.min(w, 3 - x)
        const h = 0.28 + rand() * 0.08
        P.add('roman', flag, T(x + ww / 2, y - h / 2 + (rand() - 0.5) * 0.05, z + rand() * 0.1, (rand() - 0.5) * 0.25, [ww - 0.06, h, 0.86 + rand() * 0.06]))
        x += ww
      }
    }
    flag.dispose()
    for (const s of [-1, 1]) P.box('roman', s * 3 - 0.3, y - 0.6, 300, s * 3 + 0.3, y + 0.12, 650)
    P.box('roman', -6, y - 1.4, 300, 6, y - 0.4, 650) // road bed
    const mile = new CylinderGeometry(0.38, 0.42, 2.6, 16)
    for (let i = 0, z = 330; z < 650; z += 64, i++) {
      const sx = i % 2 ? 1 : -1
      P.add('roman', mile, T(sx * 4.6, y + 1.3, z))
      P.box('roman', sx * 4.6 - 0.55, y - 0.3, z - 0.55, sx * 4.6 + 0.55, y, z + 0.55)
    }
    mile.dispose()
  }

  // ── iron age: hut circles of a Vetton castro and its verraco ─────────────
  {
    const y = -28.6
    const stone = new BoxGeometry(1, 1, 1)
    const huts = [[-16, 690, 3.6], [18, 712, 4.2], [-24, 742, 3.2], [24, 770, 3.8], [-15, 800, 4.4], [14, 820, 3.0]] as const
    for (const [hx, hz, r] of huts) {
      const n = Math.round(r * 9)
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2
        if (k / n > 0.04 && k / n < 0.12) continue // doorway
        const sz = 0.45 + rand() * 0.35
        P.add('iron', stone, T(hx + Math.cos(a) * r, y + sz * 0.4, hz + Math.sin(a) * r, -a + (rand() - 0.5) * 0.3, [0.9 + rand() * 0.5, sz, 0.55 + rand() * 0.2]))
      }
      P.add('iron', new CylinderGeometry(r - 0.4, r - 0.4, 0.12, 24), T(hx, y + 0.06, hz))
    }
    stone.dispose()
    P.frame(T(9, y, 768, Math.PI + 0.5, 2.1), () => verraco(P, 'iron'))
  }

  return P.build()
}

/** Ashlar blocks of Villamayor stone, drifting up from the bedrock. */
export function bedrockBlocks() {
  const rand = seeded(1729)
  return Array.from({ length: 34 }, (_, i) => {
    const y = -52 + rand() * 14
    return {
    x: (rand() < 0.5 ? -1 : 1) * (6 + rand() * 20),
    y,
    z: 858 + rand() * 50,
    s: [3.2 + rand() * 2, 1.6 + rand() * 0.6, 1.6 + rand() * 0.8] as [number, number, number],
    ry: (rand() - 0.5) * 0.6,
    // never breach the surface: they stop inside the modern layer
    lift: (-7 - y) * (0.55 + rand() * 0.45),
    delay: (i / 34) * 0.4,
  }
  })
}
