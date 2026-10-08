import { BoxGeometry, BufferAttribute, BufferGeometry, ExtrudeGeometry, Path, Shape, Vector2 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SLAB_DEPTH, seeded, type CityData } from '../lib/cityData'

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

/** Every OSM building of the slab, merged into a single geometry with a per-building tint. */
export function buildCityGeometry(data: CityData) {
  const rand = seeded(1218)
  const parts: BufferGeometry[] = []
  for (const b of data.buildings) {
    const g = extrudeFootprint(pairs(b.p), b.h, 0, (b.holes ?? []).map(pairs))
    const n = g.getAttribute('position').count
    const col = new Float32Array(n * 3)
    // subtle stone-to-stone variation; historic buildings slightly warmer
    const v = 0.86 + rand() * 0.16
    const warm = b.k === 1 ? 1.04 : 1 + (rand() - 0.5) * 0.04
    for (let i = 0; i < n; i++) {
      col[i * 3] = v * warm
      col[i * 3 + 1] = v
      col[i * 3 + 2] = v / warm
    }
    g.setAttribute('color', new BufferAttribute(col, 3))
    // tall blocks (the 20th-century city) get flat roofs instead of clay tile
    const flat = b.h > 19 || (b.k === 0 && rand() < 0.08) ? 1 : 0
    g.setAttribute('aRoof', new BufferAttribute(new Float32Array(n).fill(flat), 1))
    parts.push(g)
  }
  const merged = mergeGeometries(parts, false)
  parts.forEach((p) => p.dispose())
  merged.computeBoundingSphere()
  return merged
}

function pairs(flat: number[]) {
  const out: [number, number][] = []
  for (let i = 0; i < flat.length; i += 2) out.push([flat[i], flat[i + 1]])
  return out
}

export function buildSlabGeometry(data: CityData) {
  const { x0, x1, z0, z1 } = data.slab
  const g = new BoxGeometry(x1 - x0, SLAB_DEPTH, z1 - z0, 1, 1, 1)
  g.translate((x0 + x1) / 2, -SLAB_DEPTH / 2, (z0 + z1) / 2)
  return g
}

/** River ribbon along the Tormes centreline. */
export function buildRiverGeometry(data: CityData, width = 150, y = 0.35) {
  const pts = data.river
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    let dx = b[0] - a[0], dz = b[1] - a[1]
    const l = Math.hypot(dx, dz) || 1
    dx /= l; dz /= l
    const nx = -dz, nz = dx
    pos.push(p[0] + nx * width / 2, y, p[1] + nz * width / 2, p[0] - nx * width / 2, y, p[1] - nz * width / 2)
    if (i > 0) {
      const k = i * 2
      idx.push(k - 2, k - 1, k, k - 1, k + 1, k)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  // make sure the ribbon faces up regardless of polyline direction
  const ny = g.getAttribute('normal').getY(0)
  if (ny < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]]
    g.setIndex(idx)
    g.computeVertexNormals()
  }
  return g
}
