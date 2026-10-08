import { BoxGeometry, BufferAttribute, BufferGeometry, CylinderGeometry, Shape, Vector2, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { seeded } from '../lib/cityData'
import type { Terrain } from '../lib/terrain'
import { Parts, T } from '../lib/parts'
import { archHole, extrudeShape } from '../landmarks/shapes'
import { verraco } from '../landmarks/bridge'

/**
 * What the section reveals, laid out along the axis Plaza Mayor → Tormes, each
 * piece at the depth of its era *below the local surface* — so the gallery
 * descends with the ground towards the river.
 */
export type ExhibitKey = 'medieval' | 'roman' | 'iron' | 'bedrock'

export type Exhibit = {
  key: ExhibitKey
  number: string
  title: string
  caption: string
  /** marker anchor, world space */
  anchor: Vector3
  light: { at: Vector3; aim: Vector3 }
}

/** Where each era's pieces stand (z along the axis) and how deep. */
export const LAYOUT = {
  gate: { z: 212 },
  road: { z0: 300, z1: 640, depth: 17.4 },
  castro: { z: 760, depth: 28.6 },
  stone: { z: 868, depth: 38 },
}

export function exhibitsFor(terrain: Terrain): Exhibit[] {
  const s = (z: number) => terrain.heightAt(0, z)
  const v = (x: number, y: number, z: number) => new Vector3(x, y, z)
  const g = LAYOUT.gate.z
  const rz = 470
  const cz = LAYOUT.castro.z
  const kz = LAYOUT.stone.z
  return [
    {
      key: 'medieval',
      number: '01',
      title: 'The town wall',
      caption: 'Salamanca was ringed twice: the Cerca Vieja (XII c.) and the larger Cerca Nueva, its gates closed every night.',
      anchor: v(-9, s(g) - 4, g + 2),
      light: { at: v(0, s(g) + 9, g - 44), aim: v(0, s(g) - 7, g) },
    },
    {
      key: 'roman',
      number: '02',
      title: 'Vía de la Plata',
      caption: 'Polygonal paving and miliarios — the milestones that counted Roman miles from Emerita Augusta to Asturica.',
      anchor: v(4.6, s(522) - LAYOUT.road.depth + 2.9, 522),
      light: { at: v(0, s(rz) + 2, rz - 15), aim: v(0, s(rz) - 17.5, rz + 50) },
    },
    {
      key: 'iron',
      number: '03',
      title: 'Verraco',
      caption: 'Granite boars carved by the Vettones to guard herds and the dead. One still stands at the Roman bridge.',
      anchor: v(9, s(cz) - LAYOUT.castro.depth + 5.2, cz),
      light: { at: v(-2, s(cz) - 12, cz - 20), aim: v(9, s(cz) - 27.5, cz) },
    },
    {
      key: 'bedrock',
      number: '04',
      title: 'Villamayor sandstone',
      caption: 'Quarried five kilometres away. Soft when cut, it hardens in the open air as its iron slowly turns it gold.',
      anchor: v(0, s(kz) - LAYOUT.stone.depth + 6.4, kz),
      light: { at: v(-10, s(kz) - 20, kz - 22), aim: v(0, s(kz) - LAYOUT.stone.depth + 2, kz) },
    },
  ]
}

export function buildExhibits(terrain: Terrain) {
  const P = new Parts<Exclude<ExhibitKey, 'bedrock'>>()
  const rand = seeded(220)
  const s = (z: number) => terrain.heightAt(0, z)

  // ── medieval: the town wall, a gate the camera flies through, two towers ──
  {
    const z = LAYOUT.gate.z
    const wall = new Shape([new Vector2(-74, -11), new Vector2(74, -11), new Vector2(74, -2.6), new Vector2(-74, -2.6)])
    wall.holes.push(archHole(0, -10.6, 6.6, -7.2, 16))
    const wg = extrudeShape(wall, 3.2)
    P.frame(T(0, s(z), 0), () => {
      P.add('medieval', wg, T(0, 0, z))
      for (let x = -73; x <= 73; x += 2.6) P.box('medieval', x - 0.65, -2.6, z - 1.6, x + 0.65, -1.2, z + 1.6)
      for (const tx of [-11, 11]) {
        P.add('medieval', new CylinderGeometry(4.4, 4.8, 10.6, 24), T(tx, -11 + 5.3, z))
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2
          P.box('medieval', tx + Math.cos(a) * 4.0 - 0.5, -0.4, z + Math.sin(a) * 4.0 - 0.5, tx + Math.cos(a) * 4.0 + 0.5, 0.8, z + Math.sin(a) * 4.0 + 0.5)
        }
      }
      // house foundations inside the walls
      for (const zc of [95, 135, 170, 260, 300]) for (const sx of [-1, 1]) {
        const x0 = sx * (14 + rand() * 18)
        const w = 8 + rand() * 7, d = 9 + rand() * 6
        const a = -10.8, b = -9.6 - rand() * 0.8
        P.box('medieval', x0 - w / 2, a, zc - d / 2, x0 + w / 2, b, zc - d / 2 + 0.7)
        P.box('medieval', x0 - w / 2, a, zc + d / 2 - 0.7, x0 + w / 2, b, zc + d / 2)
        P.box('medieval', x0 - w / 2, a, zc - d / 2, x0 - w / 2 + 0.7, b, zc + d / 2)
        P.box('medieval', x0 + w / 2 - 0.7, a, zc - d / 2, x0 + w / 2, b, zc + d / 2)
      }
    })
    wg.dispose()
  }

  // ── roman: Vía de la Plata — polygonal paving, kerbs, milestones ──────────
  {
    const { z0, z1, depth } = LAYOUT.road
    const flag = new BoxGeometry(1, 1, 1)
    for (let z = z0; z < z1; z += 0.95) {
      const y = s(z) - depth
      let x = -3
      while (x < 3) {
        const w = 0.55 + rand() * 0.55
        const ww = Math.min(w, 3 - x)
        const h = 0.3 + rand() * 0.08
        P.add('roman', flag, T(x + ww / 2, y - h / 2 + (rand() - 0.5) * 0.05, z + rand() * 0.1, (rand() - 0.5) * 0.25, [ww - 0.06, h, 0.86 + rand() * 0.06]))
        x += ww
      }
    }
    for (let z = z0; z < z1; z += 10) {
      const y = s(z + 5) - depth
      for (const sx of [-1, 1]) P.box('roman', sx * 3 - 0.32, y - 0.6, z, sx * 3 + 0.32, y + 0.14, z + 10.02)
      P.box('roman', -6, y - 1.5, z, 6, y - 0.4, z + 10.02)
    }
    const mile = new CylinderGeometry(0.4, 0.44, 2.7, 20)
    const band = new CylinderGeometry(0.46, 0.46, 0.14, 20)
    for (let i = 0, z = z0 + 30; z < z1; z += 64, i++) {
      const sx = i % 2 ? 1 : -1
      const y = s(z) - depth
      P.add('roman', mile, T(sx * 4.6, y + 1.35, z))
      P.add('roman', band, T(sx * 4.6, y + 2.2, z))
      P.box('roman', sx * 4.6 - 0.6, y - 0.3, z - 0.6, sx * 4.6 + 0.6, y, z + 0.6)
    }
    flag.dispose()
    mile.dispose()
    band.dispose()
  }

  // ── iron age: hut circles of a Vetton castro and its verraco ─────────────
  {
    const stone = new BoxGeometry(1, 1, 1)
    const huts = [[-16, 690, 3.6], [18, 712, 4.2], [-24, 742, 3.2], [24, 790, 3.8], [-15, 800, 4.4], [16, 822, 3.0]] as const
    for (const [hx, hz, r] of huts) {
      const y = s(hz) - LAYOUT.castro.depth
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
    const cz = LAYOUT.castro.z
    const y = s(cz) - LAYOUT.castro.depth
    P.box('iron', 9 - 4, y - 0.6, cz - 2.4, 9 + 4, y, cz + 2.4) // display plinth
    P.frame(T(9, y, cz, Math.PI + 0.5, 1.9), () => verraco(P, 'iron'))
  }

  return P.build()
}

/**
 * The hero piece: a squared block of Villamayor sandstone with a scallop shell
 * carved in relief — the motif of the Casa de las Conchas, and of the pilgrims
 * who crossed the city on the Vía de la Plata.
 */
export function heroBlockGeometry() {
  const parts: BufferGeometry[] = []
  const W = 3.6, H = 2.4, D = 2.2, c = 0.12
  const prof = new Shape([
    new Vector2(-W / 2 + c, -H / 2), new Vector2(W / 2 - c, -H / 2), new Vector2(W / 2, -H / 2 + c), new Vector2(W / 2, H / 2 - c),
    new Vector2(W / 2 - c, H / 2), new Vector2(-W / 2 + c, H / 2), new Vector2(-W / 2, H / 2 - c), new Vector2(-W / 2, -H / 2 + c),
  ])
  const block = extrudeShape(prof, D)
  block.deleteAttribute('uv')
  parts.push(block.toNonIndexed())

  // scallop shell on the front face (+z): a ribbed, domed fan
  const R = 1.0, ribs = 15, segR = 14, segA = 90
  const grid: Vector3[][] = []
  for (let i = 0; i <= segR; i++) {
    const row: Vector3[] = []
    const r = (i / segR) * R
    for (let j = 0; j <= segA; j++) {
      const a = Math.PI * 0.08 + (j / segA) * Math.PI * 0.84
      const rib = Math.pow(Math.abs(Math.cos((j / segA) * ribs * Math.PI)), 0.6)
      const dome = Math.sqrt(Math.max(0, 1 - (r / R) ** 2))
      const h = 0.22 * dome + 0.06 * rib * (r / R) * (1 - (r / R) * 0.3)
      row.push(new Vector3(Math.cos(a) * r, Math.sin(a) * r - 0.55, D / 2 + h))
    }
    grid.push(row)
  }
  const pos: number[] = []
  for (let i = 0; i < segR; i++)
    for (let j = 0; j < segA; j++) {
      const a = grid[i][j], b = grid[i + 1][j], cc = grid[i + 1][j + 1], d = grid[i][j + 1]
      pos.push(...a.toArray(), ...cc.toArray(), ...b.toArray(), ...a.toArray(), ...d.toArray(), ...cc.toArray())
    }
  const shell = new BufferGeometry()
  shell.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  shell.computeVertexNormals()
  if (shell.getAttribute('normal').getZ(Math.floor(pos.length / 6)) < 0) {
    // keep the relief facing out of the block
    for (let i = 0; i < pos.length; i += 9) for (let k = 0; k < 3; k++) [pos[i + 3 + k], pos[i + 6 + k]] = [pos[i + 6 + k], pos[i + 3 + k]]
    shell.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
    shell.computeVertexNormals()
  }
  parts.push(shell)
  const ear = new BoxGeometry(0.62, 0.26, 0.16)
  ear.translate(0, -0.62, D / 2 + 0.06)
  ear.deleteAttribute('uv')
  parts.push(ear.toNonIndexed())

  const g = mergeGeometries(parts, false)
  g.computeBoundingSphere()
  return g
}

/** A stack of squared blocks around the hero piece: the quarry. */
export function quarryBlocks(terrain: Terrain) {
  const rand = seeded(1729)
  const z = LAYOUT.stone.z
  const y0 = terrain.heightAt(0, z) - LAYOUT.stone.depth
  return Array.from({ length: 22 }, (_, i) => {
    const side = i % 2 ? 1 : -1
    return {
      x: side * (8 + rand() * 18),
      y: y0 + 0.8 + Math.floor(rand() * 3) * 1.65,
      z: z - 14 + rand() * 30,
      s: [3 + rand() * 1.5, 1.6, 1.5 + rand() * 0.6] as [number, number, number],
      ry: (rand() - 0.5) * 0.4,
    }
  })
}
