import { ShapeUtils, Vector2 } from 'three'

/**
 * Closed building solids with real roofs, built straight from a footprint.
 *
 * Old Salamanca is read from above by its roofs: clay-tile slopes that run
 * along the street and meet their neighbours at the party walls. Each ring
 * edge is inset by its own distance — the full roof depth on a street or
 * courtyard front, nothing on a wall shared with the next house — and the
 * inset ring is raised by the pitch, so a terrace of houses gets one
 * continuous ridge and every free end gets a hip. Modern blocks get a flat
 * roof behind a parapet instead.
 *
 * Every solid is closed (walls, roof, floor), because the section's stencil
 * caps count faces to know what is inside matter.
 */
export type XZ = [number, number]

export type Roof =
  | { type: 'pitched'; inset: (ax: number, az: number, bx: number, bz: number) => number; pitch: number }
  | { type: 'parapet'; height: number; width: number }
  | { type: 'flat' }

export type SolidOut = { pos: number[]; nor: number[] }

const signedArea = (r: XZ[]) => {
  let a = 0
  for (let i = 0; i < r.length; i++) {
    const p = r[i], q = r[(i + 1) % r.length]
    a += p[0] * q[1] - q[0] * p[1]
  }
  return a / 2
}

/** Drop repeated and closing points. */
export function cleanRing(r: XZ[]): XZ[] {
  const out: XZ[] = []
  for (const p of r) {
    const q = out[out.length - 1]
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.05) out.push(p)
  }
  while (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 0.05) out.pop()
  return out
}

/** Interior on the left: outer rings counter-clockwise, holes clockwise (in x–z). */
function orient(r: XZ[], outer: boolean) {
  return signedArea(r) > 0 === outer ? r : [...r].reverse()
}

/** Offset every edge of a ring to its left by its own distance. */
function offsetRing(r: XZ[], d: number[]): XZ[] {
  const n = r.length
  const out: XZ[] = []
  for (let i = 0; i < n; i++) {
    const h = (i + n - 1) % n
    const [ax, az] = r[h], [bx, bz] = r[i], [cx, cz] = r[(i + 1) % n]
    let t0x = bx - ax, t0z = bz - az
    let t1x = cx - bx, t1z = cz - bz
    const l0 = Math.hypot(t0x, t0z), l1 = Math.hypot(t1x, t1z)
    t0x /= l0; t0z /= l0; t1x /= l1; t1z /= l1
    // offset lines: point + left normal * d
    const p0x = bx - t0z * d[h], p0z = bz + t0x * d[h]
    const p1x = bx - t1z * d[i], p1z = bz + t1x * d[i]
    const cr = t0x * t1z - t0z * t1x
    if (Math.abs(cr) < 0.06) {
      out.push([(p0x + p1x) / 2, (p0z + p1z) / 2])
      continue
    }
    // p0 + t0·s = p1 + t1·u
    const s = ((p1x - p0x) * t1z - (p1z - p0z) * t1x) / cr
    out.push([p0x + t0x * s, p0z + t0z * s])
  }
  return out
}

function segmentsCross(a: XZ, b: XZ, c: XZ, d: XZ) {
  const o = (p: XZ, q: XZ, r: XZ) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d)
  return d1 * d2 < 0 && d3 * d4 < 0
}

/** The inset rings are usable if no edge flipped and nothing crosses. */
function valid(orig: XZ[][], inner: XZ[][]) {
  for (let k = 0; k < inner.length; k++) {
    const o = orig[k], r = inner[k]
    if (Math.sign(signedArea(r)) !== Math.sign(signedArea(o)) || Math.abs(signedArea(r)) < 0.5) return false
    for (let i = 0; i < r.length; i++) {
      const j = (i + 1) % r.length
      const dot = (r[j][0] - r[i][0]) * (o[j][0] - o[i][0]) + (r[j][1] - r[i][1]) * (o[j][1] - o[i][1])
      if (dot <= 0) return false
    }
  }
  const segs: [XZ, XZ][] = []
  for (const r of inner) r.forEach((p, i) => segs.push([p, r[(i + 1) % r.length]]))
  for (let i = 0; i < segs.length; i++)
    for (let j = i + 1; j < segs.length; j++) if (segmentsCross(segs[i][0], segs[i][1], segs[j][0], segs[j][1])) return false
  return true
}

function tri(out: SolidOut, a: number[], b: number[], c: number[], ref: number[]) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
  const l = Math.hypot(nx, ny, nz)
  if (l < 1e-9) return
  nx /= l; ny /= l; nz /= l
  let p = [a, b, c]
  if (nx * ref[0] + ny * ref[1] + nz * ref[2] < 0) {
    p = [a, c, b]
    nx = -nx; ny = -ny; nz = -nz
  }
  for (const v of p) {
    out.pos.push(v[0], v[1], v[2])
    out.nor.push(nx, ny, nz)
  }
}

function quad(out: SolidOut, a: number[], b: number[], c: number[], d: number[], ref: number[]) {
  tri(out, a, b, c, ref)
  tri(out, a, c, d, ref)
}

/** A strip between two rings of equal length, each at its own height. */
function band(out: SolidOut, lo: XZ[], ylo: number, hi: XZ[], yhi: number, up: number, side: 1 | -1) {
  for (let i = 0; i < lo.length; i++) {
    const j = (i + 1) % lo.length
    const tx = lo[j][0] - lo[i][0], tz = lo[j][1] - lo[i][1]
    const l = Math.hypot(tx, tz) || 1
    // right of the edge = outside of the solid; `side` -1 faces the other way
    const ref = [(tz / l) * side, up, (-tx / l) * side]
    quad(out, [lo[i][0], ylo, lo[i][1]], [lo[j][0], ylo, lo[j][1]], [hi[j][0], yhi, hi[j][1]], [hi[i][0], yhi, hi[i][1]], ref)
  }
}

function cap(out: SolidOut, rings: XZ[][], y: number, up: 1 | -1) {
  const contour = rings[0].map(([x, z]) => new Vector2(x, z))
  const holes = rings.slice(1).map((r) => r.map(([x, z]) => new Vector2(x, z)))
  const all = [...contour, ...holes.flat()]
  for (const [i, j, k] of ShapeUtils.triangulateShape(contour, holes))
    tri(out, [all[i].x, y, all[i].y], [all[j].x, y, all[j].y], [all[k].x, y, all[k].y], [0, up, 0])
}

/**
 * Emits one closed solid into `out` and returns the height of its highest
 * point. Rings must be cleaned; holes are courtyards.
 */
export function buildingSolid(out: SolidOut, outer: XZ[], holes: XZ[][], y0: number, y1: number, roof: Roof) {
  const rings = [orient(outer, true), ...holes.map((h) => orient(h, false))]
  let top = y1

  let wallTop = y1
  if (roof.type === 'parapet') wallTop = y1 + roof.height
  for (const r of rings) band(out, r, y0, r, wallTop, 0, 1)
  cap(out, rings, y0, -1)

  if (roof.type === 'flat') {
    cap(out, rings, y1, 1)
    return top
  }

  if (roof.type === 'parapet') {
    const inner = rings.map((r) => offsetRing(r, r.map(() => roof.width)))
    if (!valid(rings, inner)) {
      cap(out, rings, wallTop, 1)
      return wallTop
    }
    // the coping, then the inside face of the parapet down to the roof
    rings.forEach((r, k) => band(out, r, wallTop, inner[k], wallTop, 1, 1))
    inner.forEach((r) => band(out, r, y1, r, wallTop, 0, -1))
    cap(out, inner, y1, 1)
    return wallTop
  }

  const d0 = rings.map((r) => r.map((p, i) => {
    const q = r[(i + 1) % r.length]
    return roof.inset(p[0], p[1], q[0], q[1])
  }))
  let scale = 1
  let inner: XZ[][] | null = null
  for (let tries = 0; tries < 7; tries++, scale *= 0.72) {
    const cand = rings.map((r, k) => offsetRing(r, d0[k].map((d) => d * scale)))
    if (valid(rings, cand)) {
      inner = cand
      break
    }
  }
  const maxD = Math.max(...d0.flat()) * scale
  if (!inner || maxD < 0.6) {
    cap(out, rings, y1, 1)
    return top
  }
  top = y1 + maxD * roof.pitch
  rings.forEach((r, k) => band(out, r, y1, inner[k], top, 0.6, 1))
  cap(out, inner, top, 1)
  return top
}

/** A point inside a ring, kept away from its edges (for chimneys and roof housings). */
export function ringCentroid(r: XZ[]): XZ {
  let x = 0, z = 0
  for (const p of r) { x += p[0]; z += p[1] }
  return [x / r.length, z / r.length]
}

export function pointInRing(p: XZ, r: XZ[]) {
  let inside = false
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i], [xj, zj] = r[j]
    if (zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}
