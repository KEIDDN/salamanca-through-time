import { BufferAttribute, BufferGeometry } from 'three'

/**
 * Sculpting with signed distance fields: a shape is a function that is
 * negative inside and positive outside, built from smooth unions of simple
 * primitives — the way a carver roughs out a block — then meshed once with
 * naive surface nets, normals taken from the field's gradient so the surface
 * reads as continuous carved stone rather than stacked primitives.
 */
export type Field = (x: number, y: number, z: number) => number
type V3 = [number, number, number]

const len3 = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z)

/** Polynomial smooth minimum: blends two shapes over a fillet of size k. */
export function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

/** Smooth subtraction of b from a. */
export function ssub(a: number, b: number, k: number) {
  return -smin(-a, b, k)
}

export function ellipsoid(x: number, y: number, z: number, c: V3, r: V3) {
  const px = x - c[0], py = y - c[1], pz = z - c[2]
  const k0 = len3(px / r[0], py / r[1], pz / r[2])
  const k1 = len3(px / (r[0] * r[0]), py / (r[1] * r[1]), pz / (r[2] * r[2]))
  return k1 === 0 ? -Math.min(...r) : (k0 * (k0 - 1)) / k1
}

/** A capsule whose radius runs from ra at a to rb at b. */
export function cone(x: number, y: number, z: number, a: V3, b: V3, ra: number, rb: number) {
  const pax = x - a[0], pay = y - a[1], paz = z - a[2]
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2]
  const h = Math.min(Math.max((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0), 1)
  return len3(pax - bax * h, pay - bay * h, paz - baz * h) - (ra + (rb - ra) * h)
}

export function roundBox(x: number, y: number, z: number, c: V3, half: V3, r: number) {
  const qx = Math.abs(x - c[0]) - half[0] + r
  const qy = Math.abs(y - c[1]) - half[1] + r
  const qz = Math.abs(z - c[2]) - half[2] + r
  return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r
}

/** Smooth 3D value noise in [-1, 1], for weathering a surface. */
export function noise3(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  const fx = x - ix, fy = y - iy, fz = z - iz
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz)
  const h = (a: number, b: number, c: number) => {
    let n = (a * 374761393 + b * 668265263 + c * 1274126177) | 0
    n = Math.imul(n ^ (n >>> 13), 1274126177)
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295
  }
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  const v = l(
    l(l(h(ix, iy, iz), h(ix + 1, iy, iz), ux), l(h(ix, iy + 1, iz), h(ix + 1, iy + 1, iz), ux), uy),
    l(l(h(ix, iy, iz + 1), h(ix + 1, iy, iz + 1), ux), l(h(ix, iy + 1, iz + 1), h(ix + 1, iy + 1, iz + 1), ux), uy),
    uz,
  )
  return v * 2 - 1
}

/** Mesh the zero level of `f` inside [min, max] with cells of size `cell`. */
export function meshField(f: Field, min: V3, max: V3, cell: number): BufferGeometry {
  const nx = Math.ceil((max[0] - min[0]) / cell) + 1
  const ny = Math.ceil((max[1] - min[1]) / cell) + 1
  const nz = Math.ceil((max[2] - min[2]) / cell) + 1
  const at = (i: number, j: number, k: number) => i + nx * (j + ny * k)
  const val = new Float32Array(nx * ny * nz)
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) val[at(i, j, k)] = f(min[0] + i * cell, min[1] + j * cell, min[2] + k * cell)

  // one vertex per cell that the surface crosses: the mean of its edge crossings
  const vid = new Int32Array(nx * ny * nz).fill(-1)
  const pos: number[] = []
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]]
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]
  const cv = new Float32Array(8)
  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        let inside = 0
        for (let c = 0; c < 8; c++) {
          cv[c] = val[at(i + corner[c][0], j + corner[c][1], k + corner[c][2])]
          if (cv[c] < 0) inside++
        }
        if (inside === 0 || inside === 8) continue
        let sx = 0, sy = 0, sz = 0, n = 0
        for (const [a, b] of edges) {
          if (cv[a] < 0 === cv[b] < 0) continue
          const t = cv[a] / (cv[a] - cv[b])
          sx += corner[a][0] + (corner[b][0] - corner[a][0]) * t
          sy += corner[a][1] + (corner[b][1] - corner[a][1]) * t
          sz += corner[a][2] + (corner[b][2] - corner[a][2]) * t
          n++
        }
        vid[at(i, j, k)] = pos.length / 3
        pos.push(min[0] + (i + sx / n) * cell, min[1] + (j + sy / n) * cell, min[2] + (k + sz / n) * cell)
      }

  // one quad per grid edge the surface crosses, joining the four cells around it
  const idx: number[] = []
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return
    if (flip) idx.push(a, c, b, a, d, c)
    else idx.push(a, b, c, a, c, d)
  }
  for (let k = 1; k < nz - 1; k++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const v0 = val[at(i, j, k)] < 0
        if (v0 !== val[at(i + 1, j, k)] < 0)
          quad(vid[at(i, j - 1, k - 1)], vid[at(i, j, k - 1)], vid[at(i, j, k)], vid[at(i, j - 1, k)], !v0)
        if (v0 !== val[at(i, j + 1, k)] < 0)
          quad(vid[at(i - 1, j, k - 1)], vid[at(i - 1, j, k)], vid[at(i, j, k)], vid[at(i, j, k - 1)], !v0)
        if (v0 !== val[at(i, j, k + 1)] < 0)
          quad(vid[at(i - 1, j - 1, k)], vid[at(i, j - 1, k)], vid[at(i, j, k)], vid[at(i - 1, j, k)], !v0)
      }

  // normals from the field itself
  const nrm = new Float32Array(pos.length)
  const e = cell * 0.5
  for (let v = 0; v < pos.length; v += 3) {
    const [x, y, z] = [pos[v], pos[v + 1], pos[v + 2]]
    const gx = f(x + e, y, z) - f(x - e, y, z)
    const gy = f(x, y + e, z) - f(x, y - e, z)
    const gz = f(x, y, z + e) - f(x, y, z - e)
    const l = len3(gx, gy, gz) || 1
    nrm[v] = gx / l
    nrm[v + 1] = gy / l
    nrm[v + 2] = gz / l
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setAttribute('normal', new BufferAttribute(nrm, 3))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}
