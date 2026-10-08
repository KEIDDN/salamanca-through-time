import { BufferAttribute, BufferGeometry, ExtrudeGeometry, Path, PlaneGeometry, Shape, Vector2 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SLAB_DEPTH, orientedRect, seeded, type CityData } from '../lib/cityData'
import { buildingSolid, cleanRing, pointInRing, ringCentroid, type Roof, type SolidOut, type XZ } from './massing'
import { RIVER_HALF, WATER_Y, type Terrain } from '../lib/terrain'

/** Extrude an XZ footprint (world metres) into a closed prism standing on y = y0. */
export function extrudeFootprint(pts: [number, number][], height: number, y0 = 0, holes: [number, number][][] = []) {
  const shape = new Shape(pts.map(([x, z]) => new Vector2(x, -z)))
  for (const h of holes) shape.holes.push(new Path(h.map(([x, z]) => new Vector2(x, -z))))
  const g = new ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1 })
  g.rotateX(-Math.PI / 2)
  if (y0) g.translate(0, y0, 0)
  g.deleteAttribute('uv')
  return g
}

export function pairs(flat: number[]) {
  const out: [number, number][] = []
  for (let i = 0; i < flat.length; i += 2) out.push([flat[i], flat[i + 1]])
  return out
}

/**
 * Every OSM building, seated on the terrain and merged into one geometry,
 * each a closed solid with its roof (see ./massing).
 * Per-vertex: `color` (stone tint) and `aInfo` = (ground y, eave y, flat roof?)
 * which the shader uses for façade windows, base occlusion and roof material.
 */
export function buildCityGeometry(data: CityData, terrain: Terrain) {
  const rand = seeded(1218)
  const shared = sharedEdges(data)
  const pos: number[] = []
  const nor: number[] = []
  const col: number[] = []
  const info: number[] = []
  // buildings straddling the section plane (x = 0): the only ones the cap needs
  const cutPos: number[] = []
  const out: SolidOut = { pos, nor }

  data.buildings.forEach((b, bi) => {
    const outer = cleanRing(pairs(b.p))
    if (outer.length < 3) return
    const holes = (b.holes ?? []).map((h) => cleanRing(pairs(h))).filter((h) => h.length >= 3)
    let lo = Infinity
    for (const [x, z] of outer) lo = Math.min(lo, terrain.heightAt(x, z))
    const [cx, cz] = ringCentroid(outer)
    const ground = terrain.heightAt(cx, cz)
    const eave = ground + b.h
    const base = lo - 0.3 // sunk a little so slopes never show a gap
    // tall blocks (the 20th-century city) get flat roofs behind a parapet instead of clay tile
    const flat = b.h > 19 || (b.k === 0 && rand() < 0.06) ? 1 : 0
    const width = orientedRect(outer).wid
    const depth = Math.min(width * 0.47, 7.5)
    const start = pos.length

    const roof: Roof = flat
      ? { type: 'parapet', height: 0.9, width: 0.35 }
      : {
          type: 'pitched',
          pitch: 0.47 + rand() * 0.08, // 25–28°
          // full slope on a street or courtyard front, none against a party wall
          inset: (ax, az, bx, bz) => (shared(bi, ax, az, bx, bz) ? 0 : depth),
        }
    const ridge = buildingSolid(out, outer, holes, base, eave, roof)

    if (!flat && ridge > eave + 0.8 && rand() < 0.55) {
      // a chimney or two, standing on the slope
      const n = 1 + (rand() < 0.3 ? 1 : 0)
      for (let k = 0; k < n; k++) {
        const p = outer[Math.floor(rand() * outer.length)]
        const t = 0.55 + rand() * 0.3
        const x = p[0] + (cx - p[0]) * t, z = p[1] + (cz - p[1]) * t
        if (!pointInRing([x, z], outer) || holes.some((h) => pointInRing([x, z], h))) continue
        const s = 0.35 + rand() * 0.15
        buildingSolid(out, square(x, z, s, rand() * Math.PI), [], eave - 0.2, ridge + 0.7 + rand() * 0.6, { type: 'flat' })
      }
    } else if (flat && b.h > 12 && rand() < 0.6) {
      // a stair or lift housing on the flat roof
      const s = 1.4 + rand()
      if (pointInRing([cx, cz], outer) && !holes.some((h) => pointInRing([cx, cz], h)))
        buildingSolid(out, square(cx, cz, s, orientedRect(outer).angle), [], eave - 0.2, eave + 2.4, { type: 'flat' })
    }

    const n = (pos.length - start) / 3
    const v = 0.88 + rand() * 0.14
    const warm = b.k === 1 ? 1.04 : 1 + (rand() - 0.5) * 0.08
    for (let i = 0; i < n; i++) {
      col.push(v * warm, v, v / warm)
      info.push(ground, eave, flat)
    }
    let minX = Infinity, maxX = -Infinity
    for (const [x] of outer) { minX = Math.min(minX, x); maxX = Math.max(maxX, x) }
    if (minX < 0.5 && maxX > -0.5) for (let i = start; i < pos.length; i++) cutPos.push(pos[i])
  })

  const merged = new BufferGeometry()
  merged.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  merged.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3))
  merged.setAttribute('color', new BufferAttribute(new Float32Array(col), 3))
  merged.setAttribute('aInfo', new BufferAttribute(new Float32Array(info), 3))
  merged.computeBoundingSphere()
  const straddling = new BufferGeometry()
  straddling.setAttribute('position', new BufferAttribute(new Float32Array(cutPos), 3))
  return { all: merged, cut: straddling }
}

function square(x: number, z: number, s: number, a: number): XZ[] {
  const c = Math.cos(a) * s, d = Math.sin(a) * s
  return [[x - c + d, z - d - c], [x + c + d, z + d - c], [x + c - d, z + d + c], [x - c - d, z - d + c]]
}

/**
 * Party walls: an edge is shared when another building has a parallel edge
 * running through its midpoint. Looked up in a coarse grid of all edges.
 */
function sharedEdges(data: CityData) {
  const cell = 6
  const grid = new Map<string, { b: number; ax: number; az: number; bx: number; bz: number }[]>()
  const key = (x: number, z: number) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`
  data.buildings.forEach((bd, b) => {
    const rings = [bd.p, ...(bd.holes ?? [])]
    for (const r of rings)
      for (let i = 0; i < r.length; i += 2) {
        const j = (i + 2) % r.length
        const e = { b, ax: r[i], az: r[i + 1], bx: r[j], bz: r[j + 1] }
        const cells = new Set<string>()
        const len = Math.hypot(e.bx - e.ax, e.bz - e.az)
        for (let s = 0; s <= len; s += cell / 2) {
          const t = len ? s / len : 0
          cells.add(key(e.ax + (e.bx - e.ax) * t, e.az + (e.bz - e.az) * t))
        }
        cells.add(key(e.bx, e.bz))
        for (const c of cells) {
          if (!grid.has(c)) grid.set(c, [])
          grid.get(c)!.push(e)
        }
      }
  })
  return (b: number, ax: number, az: number, bx: number, bz: number) => {
    const len = Math.hypot(bx - ax, bz - az)
    if (len < 0.5) return true
    const tx = (bx - ax) / len, tz = (bz - az) / len
    // sample a few points along the edge: shared if most of it lies on a neighbour
    let hits = 0
    for (const t of [0.25, 0.5, 0.75]) {
      const mx = ax + (bx - ax) * t, mz = az + (bz - az) * t
      const list = grid.get(key(mx, mz))
      if (!list) continue
      for (const e of list) {
        if (e.b === b) continue
        const ex = e.bx - e.ax, ez = e.bz - e.az
        const el = Math.hypot(ex, ez)
        if (el < 0.3 || Math.abs((ex * tx + ez * tz) / el) < 0.94) continue
        const u = Math.max(0, Math.min(1, ((mx - e.ax) * ex + (mz - e.az) * ez) / (el * el)))
        if (Math.hypot(e.ax + ex * u - mx, e.az + ez * u - mz) < 0.8) {
          hits++
          break
        }
      }
    }
    return hits >= 2
  }
}

/**
 * The block of ground: a heightfield top (plateau, slopes, river channel)
 * closed by four walls and a floor, so the section can cut it cleanly.
 */
export function buildTerrainGeometry(data: CityData, terrain: Terrain, res = 10) {
  const { x0, x1, z0, z1 } = data.slab
  const nx = Math.ceil((x1 - x0) / res)
  const nz = Math.ceil((z1 - z0) / res)
  const X = (i: number) => x0 + ((x1 - x0) * i) / nx
  const Z = (j: number) => z0 + ((z1 - z0) * j) / nz
  const pos: number[] = []
  const idx: number[] = []
  const B = -SLAB_DEPTH

  // top
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) pos.push(X(i), terrain.heightAt(X(i), Z(j)), Z(j))
  const row = nx + 1
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * row + i, b = a + 1, c = a + row, d = c + 1
      idx.push(a, c, b, b, c, d)
    }
  const top = new BufferGeometry()
  top.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  top.setIndex(idx)
  top.computeVertexNormals()
  if (top.getAttribute('normal').getY(0) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]]
    top.setIndex(idx)
    top.computeVertexNormals()
  }

  // walls: one strip per side, following the top edge down to the floor
  const walls: BufferGeometry[] = []
  const wall = (edge: [number, number][], outward: [number, number]) => {
    const p: number[] = []
    const id: number[] = []
    edge.forEach(([x, z], k) => {
      p.push(x, terrain.heightAt(x, z), z, x, B, z)
      if (k) {
        const a = (k - 1) * 2, b = a + 1, c = k * 2, d = c + 1
        id.push(a, b, c, c, b, d)
      }
    })
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3))
    g.setIndex(id)
    g.computeVertexNormals()
    const n = g.getAttribute('normal')
    if (n.getX(0) * outward[0] + n.getZ(0) * outward[1] < 0) {
      for (let i = 0; i < id.length; i += 3) [id[i + 1], id[i + 2]] = [id[i + 2], id[i + 1]]
      g.setIndex(id)
      g.computeVertexNormals()
    }
    walls.push(g)
  }
  const range = (n: number, f: (k: number) => [number, number]) => Array.from({ length: n + 1 }, (_, k) => f(k))
  wall(range(nx, (i) => [X(i), z0]), [0, -1])
  wall(range(nx, (i) => [X(i), z1]), [0, 1])
  wall(range(nz, (j) => [x0, Z(j)]), [-1, 0])
  wall(range(nz, (j) => [x1, Z(j)]), [1, 0])

  const floor = new BufferGeometry()
  floor.setAttribute('position', new BufferAttribute(new Float32Array([x0, B, z0, x1, B, z0, x0, B, z1, x1, B, z1]), 3))
  floor.setIndex([0, 2, 1, 1, 2, 3])
  floor.computeVertexNormals()
  if (floor.getAttribute('normal').getY(0) > 0) {
    floor.setIndex([0, 1, 2, 1, 3, 2])
    floor.computeVertexNormals()
  }

  const merged = mergeGeometries([top, ...walls, floor].map((g) => g.toNonIndexed()), false)
  merged.computeBoundingSphere()
  return merged
}

/**
 * The Tormes: a single sheet of water at river level across the whole block.
 * The terrain rises above it everywhere but in the channel, so the banks draw
 * the shoreline exactly where the ground meets the water.
 */
export function buildRiverGeometry(data: CityData) {
  const { x0, x1, z0, z1 } = data.slab
  const g = new PlaneGeometry(x1 - x0 - 0.2, z1 - z0 - 0.2, 1, 1)
  g.rotateX(-Math.PI / 2)
  g.translate((x0 + x1) / 2, WATER_Y, (z0 + z1) / 2)
  g.deleteAttribute('uv')
  return g
}

/** Poplars and plane trees along both banks of the Tormes. */
export function riverTrees(data: CityData, terrain: Terrain) {
  const rand = seeded(1102)
  const { x0, x1, z0, z1 } = data.slab
  // coarse occupancy grid of building footprints, to keep trees in the open
  const cell = 8
  const occupied = new Set<string>()
  for (const b of data.buildings) {
    let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity
    for (let i = 0; i < b.p.length; i += 2) {
      bx0 = Math.min(bx0, b.p[i]); bx1 = Math.max(bx1, b.p[i])
      bz0 = Math.min(bz0, b.p[i + 1]); bz1 = Math.max(bz1, b.p[i + 1])
    }
    for (let x = Math.floor(bx0 / cell); x <= Math.floor(bx1 / cell); x++)
      for (let z = Math.floor(bz0 / cell); z <= Math.floor(bz1 / cell); z++) occupied.add(`${x},${z}`)
  }
  const trees: { x: number; y: number; z: number; r: number; h: number }[] = []
  const line = terrain.river
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i], [bx, bz] = line[i + 1]
    const len = Math.hypot(bx - ax, bz - az)
    const nx = -(bz - az) / len, nz = (bx - ax) / len
    for (let s = 0; s < len; s += 7) {
      for (const side of [-1, 1]) {
        if (rand() < 0.25) continue
        const off = RIVER_HALF + 6 + rand() * 46
        const x = ax + ((bx - ax) * s) / len + side * nx * off + (rand() - 0.5) * 4
        const z = az + ((bz - az) * s) / len + side * nz * off + (rand() - 0.5) * 4
        if (x < x0 + 6 || x > x1 - 6 || z < z0 + 6 || z > z1 - 6) continue
        if (occupied.has(`${Math.floor(x / cell)},${Math.floor(z / cell)}`)) continue
        const y = terrain.heightAt(x, z)
        if (y < WATER_Y + 0.4) continue
        trees.push({ x, y, z, r: 2.6 + rand() * 2.4, h: 7 + rand() * 9 })
      }
    }
  }
  return trees
}
