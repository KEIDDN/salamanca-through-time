import { BufferAttribute, BufferGeometry, Vector3 } from 'three'

/**
 * Voronoi fracture of a convex solid. The solid is given as a set of planes
 * (n · p ≤ d); each shard is the solid clipped by the bisector planes towards
 * every other seed, so the pieces tile it exactly. Faces that come from the
 * fracture are flagged (`aCut` = 1) so the material can show fresh stone —
 * and light — inside the cracks.
 */
export type Plane = { n: Vector3; d: number }
type Face = { pts: Vector3[]; cut: boolean }

export type Shard = { geometry: BufferGeometry; centroid: Vector3; seed: Vector3 }

const EPS = 1e-7

function clip(faces: Face[], pl: Plane, cut: boolean): Face[] {
  const out: Face[] = []
  const onPlane: Vector3[] = []
  for (const f of faces) {
    const res: Vector3[] = []
    for (let i = 0; i < f.pts.length; i++) {
      const a = f.pts[i], b = f.pts[(i + 1) % f.pts.length]
      const da = pl.n.dot(a) - pl.d, db = pl.n.dot(b) - pl.d
      if (da <= EPS) res.push(a)
      if ((da < -EPS && db > EPS) || (da > EPS && db < -EPS)) {
        const p = a.clone().lerp(b, da / (da - db))
        res.push(p)
        onPlane.push(p)
      } else if (Math.abs(da) <= EPS) onPlane.push(a)
    }
    if (res.length >= 3) out.push({ pts: res, cut: f.cut })
  }
  // close the hole with a cap lying on the plane
  const cap = ordered(dedupe(onPlane), pl.n)
  if (cap.length >= 3) out.push({ pts: cap, cut })
  return out
}

function dedupe(pts: Vector3[]) {
  const out: Vector3[] = []
  for (const p of pts) if (!out.some((q) => q.distanceToSquared(p) < 1e-10)) out.push(p)
  return out
}

/** Sort points counter-clockwise around `n` (so the face looks along +n). */
function ordered(pts: Vector3[], n: Vector3) {
  if (pts.length < 3) return pts
  const c = pts.reduce((a, p) => a.add(p), new Vector3()).divideScalar(pts.length)
  const u = new Vector3().subVectors(pts[0], c).normalize()
  const v = new Vector3().crossVectors(n, u)
  return pts
    .map((p) => ({ p, a: Math.atan2(new Vector3().subVectors(p, c).dot(v), new Vector3().subVectors(p, c).dot(u)) }))
    .sort((a, b) => a.a - b.a)
    .map((e) => e.p)
}

/** A box polytope, faces wound outward. */
function box(half: Vector3): Face[] {
  const faces: Face[] = []
  for (let axis = 0; axis < 3; axis++)
    for (const s of [-1, 1]) {
      const n = new Vector3().setComponent(axis, s)
      const a = (axis + 1) % 3, b = (axis + 2) % 3
      const pts: Vector3[] = []
      for (const [sa, sb] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const p = new Vector3()
        p.setComponent(axis, s * half.getComponent(axis))
        p.setComponent(a, sa * half.getComponent(a))
        p.setComponent(b, sb * half.getComponent(b))
        pts.push(p)
      }
      faces.push({ pts: ordered(pts, n), cut: false })
    }
  return faces
}

function toGeometry(faces: Face[]) {
  const pos: number[] = []
  const cut: number[] = []
  for (const f of faces)
    for (let i = 1; i < f.pts.length - 1; i++)
      for (const p of [f.pts[0], f.pts[i], f.pts[i + 1]]) {
        pos.push(p.x, p.y, p.z)
        cut.push(f.cut ? 1 : 0)
      }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setAttribute('aCut', new BufferAttribute(new Float32Array(cut), 1))
  g.computeVertexNormals()
  return g
}

/**
 * Fracture the solid `box(half) ∩ planes` around `seeds`. Returns one shard
 * per seed whose cell is not empty.
 */
export function fracture(half: Vector3, planes: Plane[], seeds: Vector3[]): Shard[] {
  let solid = box(half)
  for (const pl of planes) solid = clip(solid, pl, false)
  const shards: Shard[] = []
  seeds.forEach((s, i) => {
    let cell = solid
    for (let j = 0; j < seeds.length && cell.length; j++) {
      if (j === i) continue
      const n = new Vector3().subVectors(seeds[j], s).normalize()
      cell = clip(cell, { n, d: n.dot(new Vector3().addVectors(s, seeds[j]).multiplyScalar(0.5)) }, true)
    }
    if (cell.length < 4) return
    const all = cell.flatMap((f) => f.pts)
    const centroid = all.reduce((a, p) => a.add(p), new Vector3()).divideScalar(all.length)
    shards.push({ geometry: toGeometry(cell), centroid, seed: s })
  })
  return shards
}
