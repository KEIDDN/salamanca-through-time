/**
 * Builds public/data/salamanca.json from cached OpenStreetMap extracts.
 *
 * World frame (1 unit = 1 metre):
 *   - origin at the centroid of Plaza Mayor
 *   - +z runs along the "section axis": Plaza Mayor → Roman Bridge (south bank)
 *   - +y is up
 * The scene cuts the city along the plane x = 0.
 *
 * Usage: node scripts/build-city.mjs  (reads scripts/.cache/osm-*.json)
 * Data © OpenStreetMap contributors, ODbL.
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, 'scripts/.cache', f), 'utf8')).elements
const elements = [...read('osm-buildings.json'), ...read('osm-misc.json')]
const relations = read('osm-relations.json').filter((r) => r.type === 'relation' && r.members)
const byId = new Map(elements.map((e) => [e.id, e]))

const PLAZA_ID = 78180390
const CATHEDRAL_NEW_ID = 297723030
const CATHEDRAL_OLD_ID = 59010501
const BRIDGE_IDS = [818422553, 24976920, 58527634, 514010816, 58527629, 58527631, 813075578]

// --- projection -----------------------------------------------------------
const plaza = byId.get(PLAZA_ID)
const lat0 = avg(plaza.geometry.map((g) => g.lat))
const lon0 = avg(plaza.geometry.map((g) => g.lon))
const kx = Math.cos((lat0 * Math.PI) / 180) * 111320
const ky = 110574
// east → +x, north → -z (before rotation)
const proj0 = (g) => [(g.lon - lon0) * kx, -(g.lat - lat0) * ky]

// Bridge: farthest point from the plaza is the south abutment.
const bridgePts = BRIDGE_IDS.flatMap((id) => byId.get(id)?.geometry ?? []).map(proj0)
const southEnd = bridgePts.reduce((a, b) => (len(b) > len(a) ? b : a))
const northEnd = bridgePts.reduce((a, b) => (len(b) < len(a) ? b : a))
// rotate so southEnd lands on +z
const ang = Math.atan2(southEnd[0], southEnd[1])
const cs = Math.cos(ang), sn = Math.sin(ang)
const rot = ([x, z]) => [x * cs - z * sn, x * sn + z * cs]
const proj = (g) => rot(proj0(g))

const bridgeA = rot(northEnd), bridgeB = rot(southEnd)
console.log('axis length to bridge south end', len(bridgeB).toFixed(1), 'rotation deg', ((ang * 180) / Math.PI).toFixed(1))

// --- slab bounds (rotated frame) --------------------------------------------
const SLAB = { x0: -760, x1: 760, z0: -560, z1: 1560 }
const inSlab = ([x, z], m = 0) => x > SLAB.x0 + m && x < SLAB.x1 - m && z > SLAB.z0 + m && z < SLAB.z1 - m

// --- landmarks ---------------------------------------------------------------
const ring = (id) => simplifyRing(byId.get(id).geometry.map(proj))
const plazaRing = ring(PLAZA_ID)
const cathedralNew = ring(CATHEDRAL_NEW_ID)
const cathedralOld = ring(CATHEDRAL_OLD_ID)

// Plaza Mayor as an oriented rectangle (it is very nearly square in reality)
const plazaRect = orientedRect(plazaRing)
console.log('plaza rect', plazaRect)

// --- buildings ----------------------------------------------------------------
const SKIP = new Set([CATHEDRAL_NEW_ID, CATHEDRAL_OLD_ID])
const buildings = []
let skipped = 0
for (const e of elements) {
  if (!e.tags?.building || e.type !== 'way' || SKIP.has(e.id)) continue
  if (!e.geometry || e.geometry.length < 4) continue
  const pts = simplifyRing(e.geometry.map(proj))
  if (pts.length < 3) continue
  const c = centroid(pts)
  if (!inSlab(c, 8) || !pts.every((p) => inSlab(p, 2))) { skipped++; continue }
  if (Math.abs(area(pts)) < 12) continue
  // Plaza Mayor ranges are modelled by hand
  if (inPlazaBand(c)) { skipped++; continue }
  if (inPoly(c, cathedralNew) || inPoly(c, cathedralOld)) continue
  buildings.push({ p: pts.flat().map(r1), h: r1(heightOf(e.tags)), k: tagKind(e.tags) })
}
// multipolygon buildings (courtyards!) — most of the historic centre is mapped this way
let relKept = 0
for (const r of relations) {
  const outers = joinLines(r.members.filter((m) => m.role === 'outer' && m.geometry).map((m) => m.geometry.map(proj)))
  const inners = joinLines(r.members.filter((m) => m.role === 'inner' && m.geometry).map((m) => m.geometry.map(proj)))
    .map(simplifyRing)
    .filter((h) => h.length >= 3)
  for (const o of outers) {
    const pts = simplifyRing(o)
    if (pts.length < 3) continue
    const c = centroid(pts)
    if (!inSlab(c, 8) || !pts.every((p) => inSlab(p, 2))) continue
    if (Math.abs(area(pts)) < 12) continue
    if (inPlazaBand(c) || inPoly(c, cathedralNew) || inPoly(c, cathedralOld)) continue
    const holes = inners.filter((h) => inPoly(h[0], pts))
    buildings.push({ p: pts.flat().map(r1), h: r1(heightOf(r.tags)), k: tagKind(r.tags), ...(holes.length ? { holes: holes.map((h) => h.flat().map(r1)) } : {}) })
    relKept++
  }
}
console.log('buildings kept', buildings.length, '(relations', relKept + ')', 'skipped', skipped)

// --- river ----------------------------------------------------------------------
const riverWays = elements.filter((e) => e.tags?.waterway === 'river' && /Tormes/.test(e.tags.name ?? ''))
const river = joinLines(riverWays.map((w) => w.geometry.map(proj)))
  .map((l) => l.filter((p) => p[0] > SLAB.x0 - 400 && p[0] < SLAB.x1 + 400 && p[1] > SLAB.z0 - 400 && p[1] < SLAB.z1 + 400))
  .filter((l) => l.length > 1)
  .sort((a, b) => b.length - a.length)[0]
console.log('river points', river.length)

const out = {
  attribution: 'Data © OpenStreetMap contributors (ODbL)',
  origin: { lat: lat0, lon: lon0 },
  rotationDeg: (ang * 180) / Math.PI,
  slab: SLAB,
  plaza: { ring: plazaRing.map((p) => p.map(r1)), rect: plazaRect },
  cathedral: { nuevo: cathedralNew.map((p) => p.map(r1)), viejo: cathedralOld.map((p) => p.map(r1)) },
  bridge: { a: bridgeA.map(r1), b: bridgeB.map(r1) },
  river: river.map((p) => p.map(r1)),
  buildings,
}
fs.writeFileSync(path.join(root, 'public/data/salamanca.json'), JSON.stringify(out))
console.log('wrote', (fs.statSync(path.join(root, 'public/data/salamanca.json')).size / 1024).toFixed(0), 'KB')

// --- helpers --------------------------------------------------------------------
function heightOf(t) {
  const lv = parseFloat(t['building:levels'])
  let h
  if (t.height) h = parseFloat(t.height)
  else if (Number.isFinite(lv)) h = lv * 3.3 + 1.2
  else h = 9
  if (/church|chapel|cathedral/.test(t.building) || /^(Iglesia|Convento|Capilla|Parroquia)/.test(t.name ?? '')) h = Math.max(h, 22)
  if (t.building === 'roof' || t.building === 'garage') h = Math.min(h, 4)
  return Math.min(h, 40)
}
function inPoly([x, z], p) {
  let c = false
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i], [xj, zj] = p[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c
  }
  return c
}
function inPlazaBand([x, z]) {
  const { cx, cz, angle, w, d } = plazaRect
  const c = Math.cos(-angle), s = Math.sin(-angle)
  const lx = (x - cx) * c - (z - cz) * s
  const lz = (x - cx) * s + (z - cz) * c
  const depth = 20
  return Math.abs(lx) < w / 2 + depth && Math.abs(lz) < d / 2 + depth
}
function tagKind(t) {
  if (/church|cathedral|chapel/.test(t.building) || t.historic) return 1
  return 0
}
function orientedRect(pts) {
  // brute force minimum-area rectangle over edge directions
  let best
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0])
    const c = Math.cos(-angle), s = Math.sin(-angle)
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
    for (const [x, z] of pts) {
      const lx = x * c - z * s, lz = x * s + z * c
      x0 = Math.min(x0, lx); x1 = Math.max(x1, lx); z0 = Math.min(z0, lz); z1 = Math.max(z1, lz)
    }
    const ar = (x1 - x0) * (z1 - z0)
    if (!best || ar < best.ar) {
      const lcx = (x0 + x1) / 2, lcz = (z0 + z1) / 2
      const ci = Math.cos(angle), si = Math.sin(angle)
      best = { ar, cx: r1(lcx * ci - lcz * si), cz: r1(lcx * si + lcz * ci), angle: +angle.toFixed(4), w: r1(x1 - x0), d: r1(z1 - z0) }
    }
  }
  delete best.ar
  return best
}
function joinLines(lines) {
  const out = lines.map((l) => l.slice())
  let merged = true
  while (merged) {
    merged = false
    outer: for (let i = 0; i < out.length; i++) for (let j = 0; j < out.length; j++) {
      if (i === j) continue
      const a = out[i], b = out[j]
      const eq = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.5
      if (eq(a[a.length - 1], b[0])) { out[i] = a.concat(b.slice(1)); out.splice(j, 1); merged = true; break outer }
      if (eq(a[a.length - 1], b[b.length - 1])) { out[i] = a.concat(b.slice(0, -1).reverse()); out.splice(j, 1); merged = true; break outer }
    }
  }
  return out
}
function simplifyRing(pts) {
  let p = pts.slice()
  if (p.length > 1 && Math.hypot(p[0][0] - p.at(-1)[0], p[0][1] - p.at(-1)[1]) < 0.01) p.pop()
  // drop near-duplicate and collinear points
  const res = []
  for (let i = 0; i < p.length; i++) {
    const a = res.length ? res.at(-1) : p.at(-1), b = p[i], c = p[(i + 1) % p.length]
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.4) continue
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
    if (Math.abs(cross) < 0.15) continue
    res.push(b)
  }
  return res
}
function area(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1] } return s / 2 }
function centroid(p) { return [avg(p.map((q) => q[0])), avg(p.map((q) => q[1]))] }
function avg(a) { return a.reduce((s, v) => s + v, 0) / a.length }
function len(p) { return Math.hypot(p[0], p[1]) }
function r1(v) { return Math.round(v * 10) / 10 }
