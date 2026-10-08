import { BufferAttribute, BufferGeometry, ExtrudeGeometry, Path, PlaneGeometry, Shape, Vector2 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SLAB_DEPTH, seeded, type CityData } from '../lib/cityData'
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
 * Every OSM building, seated on the terrain and merged into one geometry.
 * Per-vertex: `color` (stone tint) and `aInfo` = (ground y, roof y, flat roof?)
 * which the shader uses for façade windows, base occlusion and roof material.
 */
export function buildCityGeometry(data: CityData, terrain: Terrain) {
  const rand = seeded(1218)
  const parts: BufferGeometry[] = []
  // buildings straddling the section plane (x = 0): the only ones the cap needs
  const cut: BufferGeometry[] = []
  for (const b of data.buildings) {
    const pts = pairs(b.p)
    let lo = Infinity, cx = 0, cz = 0
    for (const [x, z] of pts) {
      lo = Math.min(lo, terrain.heightAt(x, z))
      cx += x / pts.length
      cz += z / pts.length
    }
    const ground = terrain.heightAt(cx, cz)
    const top = ground + b.h
    const base = lo - 0.3 // sunk a little so slopes never show a gap
    const g = extrudeFootprint(pts, top - base, base, (b.holes ?? []).map(pairs))
    const n = g.getAttribute('position').count
    const col = new Float32Array(n * 3)
    const v = 0.88 + rand() * 0.14
    const warm = b.k === 1 ? 1.04 : 1 + (rand() - 0.5) * 0.05
    for (let i = 0; i < n; i++) {
      col[i * 3] = v * warm
      col[i * 3 + 1] = v
      col[i * 3 + 2] = v / warm
    }
    g.setAttribute('color', new BufferAttribute(col, 3))
    // tall blocks (the 20th-century city) get flat roofs instead of clay tile
    const flat = b.h > 19 || (b.k === 0 && rand() < 0.08) ? 1 : 0
    const info = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      info[i * 3] = ground
      info[i * 3 + 1] = top
      info[i * 3 + 2] = flat
    }
    g.setAttribute('aInfo', new BufferAttribute(info, 3))
    parts.push(g)
    let minX = Infinity, maxX = -Infinity
    for (const [x] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x) }
    if (minX < 0.5 && maxX > -0.5) cut.push(g)
  }
  const merged = mergeGeometries(parts, false)
  const straddling = mergeGeometries(cut.map((g) => {
    const c = new BufferGeometry()
    c.setAttribute('position', g.getAttribute('position'))
    return c
  }), false)
  parts.forEach((p) => p.dispose())
  merged.computeBoundingSphere()
  return { all: merged, cut: straddling }
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
