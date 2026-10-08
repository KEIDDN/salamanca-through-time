import { BoxGeometry, CatmullRomCurve3, ConeGeometry, CylinderGeometry, LatheGeometry, Shape, SphereGeometry, TubeGeometry, Vector2, Vector3 } from 'three'
import { compass, orientedRect, type CityData } from '../lib/cityData'
import { extrudeFootprint } from '../city/geometry'
import { Parts, T } from '../lib/parts'
import { archBand, extrudeShape } from './shapes'
import { dressWalls } from './dress'

/**
 * The two cathedrals, side by side as in reality:
 *  - Catedral Nueva (1513–1733): a late Gothic church read in three tiers —
 *    side chapels, aisles, nave — with pinnacled buttresses, flying
 *    buttresses, open crestings, the stepped west portal, the crossing dome on
 *    its drum, and the 92 m bell tower at the west end, between both churches.
 *  - Catedral Vieja (XII c.): Romanesque, lower and plainer, crowned by the
 *    Torre del Gallo with its four turrets and scaled stone dome.
 * Footprints come from OpenStreetMap; the vertical massing is modelled here.
 * Domes and pinnacles are stone, like everything else in the city.
 */
export type CathedralKey = 'cathedral' | 'sandstonePlain' | 'roof' | 'dark'

/** A pointed (Gothic) arch outline: width w, height h, base on y = 0. */
function pointed(w: number, h: number, seg = 8) {
  const r = w * 0.85 // two arcs whose centres sit inside the opening
  const rise = Math.sqrt(r * r - (r - w / 2) ** 2)
  const spring = h - rise
  const a1 = Math.asin(rise / r)
  const pts: Vector2[] = [new Vector2(-w / 2, 0), new Vector2(w / 2, 0)]
  for (let k = 0; k <= seg; k++) {
    const a = (k / seg) * a1
    pts.push(new Vector2(w / 2 - r + r * Math.cos(a), spring + r * Math.sin(a)))
  }
  for (let k = seg - 1; k >= 0; k--) {
    const a = (k / seg) * a1
    pts.push(new Vector2(-w / 2 + r - r * Math.cos(a), spring + r * Math.sin(a)))
  }
  return pts
}

/** Round-headed outline: width w, height h, base on y = 0. */
function rounded(w: number, h: number, seg = 10) {
  const r = w / 2
  const pts: Vector2[] = [new Vector2(-r, 0), new Vector2(r, 0)]
  for (let k = 0; k <= seg; k++) {
    const a = (k / seg) * Math.PI
    pts.push(new Vector2(r * Math.cos(a), h - r + r * Math.sin(a)))
  }
  return pts
}

const panel = (outline: Vector2[], depth: number) => extrudeShape(new Shape(outline), depth)

/** A frame: the band between two outlines (archivolts, window hoods). */
const ring = (outer: Vector2[], inner: Vector2[], depth: number) => extrudeShape(archBand(outer, inner), depth)

/** A dome profile for LatheGeometry: radius r at the base, rising to h, slightly pointed. */
function domeProfile(r: number, h: number, seg = 14) {
  const pts: Vector2[] = []
  for (let k = 0; k <= seg; k++) {
    const t = (k / seg) * (Math.PI / 2)
    pts.push(new Vector2(Math.max(r * Math.cos(t) ** 0.9, 0.001), h * Math.sin(t) ** 1.15))
  }
  return pts
}

/** A rib following a dome profile, in the x–y plane (turn it about y). */
function domeRib(prof: Vector2[], radius: number, lift: number) {
  const pts = prof.slice(0, -1).map((p) => new Vector3(p.x + lift, p.y + lift * 0.4, 0))
  return new TubeGeometry(new CatmullRomCurve3(pts), 20, radius, 5, false)
}

/** Where the two towers stand: the New Cathedral's bell tower and the Old Cathedral's Torre del Gallo. */
export function cathedralTowers(data: CityData) {
  const { west, south } = compass(data)
  const r = orientedRect(data.cathedral.nuevo)
  const u = new Vector3(Math.cos(r.angle), 0, Math.sin(r.angle))
  if (u.dot(west) < 0) u.negate()
  const vside = new Vector3(-u.z, 0, u.x)
  if (vside.dot(south) < 0) vside.negate()
  const bell = new Vector3(r.cx, 0, r.cz).addScaledVector(u, r.len / 2 - 7).addScaledVector(vside, r.wid / 2 - 7)
  const ro = orientedRect(data.cathedral.viejo)
  const uo = new Vector3(Math.cos(ro.angle), 0, Math.sin(ro.angle))
  if (uo.dot(west) < 0) uo.negate()
  const gallo = new Vector3(ro.cx, 0, ro.cz).addScaledVector(uo, -ro.len * 0.2)
  return { bell, gallo }
}

export function buildCathedrals(data: CityData) {
  const P = new Parts<CathedralKey>()
  const { west, south } = compass(data)

  // ── Catedral Nueva ──────────────────────────────────────────────────────
  const nuevo = data.cathedral.nuevo
  const r = orientedRect(nuevo)
  const C = new Vector3(r.cx, 0, r.cz)
  const u = new Vector3(Math.cos(r.angle), 0, Math.sin(r.angle))
  if (u.dot(west) < 0) u.negate() // u points west
  const vside = new Vector3(-u.z, 0, u.x)
  if (vside.dot(south) < 0) vside.negate() // v points south
  const yaw = Math.atan2(-u.z, u.x) // local +x → u (west)
  const at = (along: number, across: number, y: number) =>
    C.clone().addScaledVector(u, along).addScaledVector(vside, across).setY(y)

  const CH = 17 // side chapels
  const AH = 29 // aisles
  const NH = 38 // nave
  const L = r.len * 0.9
  const halfA = r.wid * 0.36
  const halfN = r.wid * 0.17
  const tx = -L * 0.12 // the crossing, east of centre
  const bays: number[] = []
  for (let x = -L / 2 + 5; x <= L / 2 - 9; x += 8.6) if (Math.abs(x - tx) > halfN + 2) bays.push(x)

  P.add('cathedral', extrudeFootprint(nuevo, CH))
  dressWalls(P, nuevo, {
    height: CH, wall: 'cathedral', trim: 'sandstonePlain', dark: 'dark', bay: 8.6,
    pier: { w: 1.3, d: 1.5 }, window: { outline: pointed(2.2, 6.4), y: 6.5, hood: pointed(2.8, 6.9) }, crest: true,
  })
  P.frame(T(C.x, 0, C.z, yaw), () => {
    // the three tiers and the transept
    P.box('cathedral', -L / 2, CH - 0.5, -halfA, L / 2, AH, halfA)
    P.box('cathedral', -L / 2, AH - 0.5, -halfN, L / 2, NH, halfN)
    P.box('cathedral', tx - halfN, CH - 0.5, -halfA, tx + halfN, NH, halfA)

    // low roofs, mostly hidden behind the crestings
    const gable = (half: number, rise: number) => new Shape([new Vector2(-half, 0), new Vector2(half, 0), new Vector2(0, rise)])
    const nave = extrudeShape(gable(halfN + 0.2, 3.4), L)
    nave.rotateY(Math.PI / 2)
    nave.translate(0, NH, 0)
    const trans = extrudeShape(gable(halfN + 0.2, 3.4), halfA * 2)
    trans.translate(tx, NH, 0)
    for (const g of [nave, trans]) {
      P.add('cathedral', g)
      g.dispose()
    }
    for (const s of [-1, 1]) {
      const lean = extrudeShape(new Shape([new Vector2(halfN, 0), new Vector2(halfA, 0), new Vector2(halfN, 1.8)]), L)
      lean.rotateY((s * Math.PI) / 2)
      lean.translate(0, AH, 0)
      P.add('cathedral', lean)
      lean.dispose()
    }

    // open crestings along every edge
    const crest = (x0: number, x1: number, z: number, y: number) => {
      P.box('sandstonePlain', x0, y, z - 0.18, x1, y + 0.16, z + 0.18)
      P.box('sandstonePlain', x0, y + 0.72, z - 0.14, x1, y + 0.84, z + 0.14)
      for (let x = x0 + 0.35; x < x1 - 0.2; x += 0.7) P.box('sandstonePlain', x - 0.09, y + 0.16, z - 0.1, x + 0.09, y + 0.72, z + 0.1)
    }
    for (const s of [-1, 1]) {
      crest(-L / 2, tx - halfN, s * halfA, AH)
      crest(tx + halfN, L / 2, s * halfA, AH)
      crest(-L / 2, tx - halfN, s * halfN, NH)
      crest(tx + halfN, L / 2, s * halfN, NH)
    }

    const shaft = new CylinderGeometry(0.42, 0.48, 2.6, 6)
    const spire = new ConeGeometry(0.52, 4.4, 6)
    const pinnacle = (x: number, y: number, z: number, k = 1) => {
      P.add('sandstonePlain', shaft, T(x, y + 1.3 * k, z, 0, k))
      P.add('sandstonePlain', spire, T(x, y + (2.6 + 2.2) * k, z, 0, k))
    }
    const aisleWin = panel(pointed(2.8, 8.2), 0.1)
    const aisleHood = ring(pointed(3.5, 8.8), pointed(2.8, 8.2), 0.22)
    const clereWin = panel(pointed(2.3, 6), 0.1)
    const fly = new BoxGeometry(0.7, 0.75, 1)
    for (const x of bays) {
      for (const s of [-1, 1]) {
        // buttress on the aisle wall, its pinnacle over the cresting
        P.box('cathedral', x - 0.65, CH - 0.5, s > 0 ? halfA - 0.1 : -halfA - 1.9, x + 0.65, AH + 2.2, s > 0 ? halfA + 1.9 : -halfA + 0.1)
        pinnacle(x, AH + 2.2, s * (halfA + 0.9))
        // flying buttress up to the clerestory
        const z0 = s * (halfA + 0.3), y0 = AH + 1.4, z1 = s * halfN, y1 = NH - 3.2
        const len = Math.hypot(z1 - z0, y1 - y0)
        P.add('cathedral', fly, T(x, (y0 + y1) / 2, (z0 + z1) / 2, 0, [1, 1, len], Math.atan2(-(y1 - y0), z1 - z0)))
        pinnacle(x, NH + 0.8, s * halfN, 0.75)
      }
    }
    // windows between the buttresses: aisles and clerestory
    for (let i = 0; i < bays.length - 1; i++) {
      const x = (bays[i] + bays[i + 1]) / 2
      if (Math.abs(x - tx) < halfN + 2) continue
      for (const s of [-1, 1]) {
        const ry = s > 0 ? 0 : Math.PI
        P.add('dark', aisleWin, T(x, AH - 9.6, s * (halfA + 0.02), ry))
        P.add('sandstonePlain', aisleHood, T(x, AH - 9.9, s * (halfA + 0.1), ry))
        P.add('dark', clereWin, T(x, NH - 7.4, s * (halfN + 0.02), ry))
      }
    }
    // the transept ends: a great window each
    for (const s of [-1, 1]) {
      const ry = s > 0 ? 0 : Math.PI
      P.add('dark', panel(pointed(5.2, 12), 0.1), T(tx, CH + 4, s * (halfA + 0.02), ry))
      P.add('sandstonePlain', ring(pointed(6.4, 13), pointed(5.2, 12), 0.24), T(tx, CH + 3.6, s * (halfA + 0.12), ry))
      crest(tx - halfN, tx + halfN, s * halfA, NH)
    }

    // west front: buttressed frontispiece and the stepped portal (Puerta del Nacimiento)
    const fx = L / 2
    P.box('cathedral', fx - 2.6, CH - 0.5, -halfN - 1.4, fx, NH + 3.2, halfN + 1.4)
    const west = (g: ReturnType<typeof panel>, x: number, key: CathedralKey = 'sandstonePlain') => {
      P.add(key, g, T(x, 0, 0, Math.PI / 2))
      g.dispose()
    }
    west(ring(pointed(11, 21, 10), pointed(9.6, 19.6, 10), 0.5), fx + 0.85)
    west(ring(pointed(9.6, 19.6, 10), pointed(8.2, 18.2, 10), 0.5), fx + 0.55)
    west(ring(pointed(8.2, 18.2, 10), pointed(6.8, 16.8, 10), 0.5), fx + 0.25)
    west(panel(pointed(6.8, 16.8, 10), 0.1), fx + 0.05, 'dark')
    // twin doors under a lintel, the trumeau between them
    P.box('sandstonePlain', fx, 6.4, -3.4, fx + 0.22, 7.1, 3.4)
    P.box('sandstonePlain', fx, 0, -0.4, fx + 0.3, 6.4, 0.4)
    for (const s of [-1, 1]) {
      P.box('cathedral', fx - 1.2, 0, s * (halfN + 0.2) - 1.1, fx + 1.8, NH + 4, s * (halfN + 0.2) + 1.1)
      pinnacle(fx + 0.3, NH + 4, s * (halfN + 0.2), 1.2)
    }
    for (const g of [shaft, spire, fly, aisleWin, aisleHood, clereWin]) g.dispose()
  })

  // crossing dome on its drum (Joaquín de Churriguera, rebuilt after 1755)
  const dome = at(tx, 0, 0)
  {
    const y = NH
    P.add('cathedral', new CylinderGeometry(9.6, 9.6, 3, 8), T(dome.x, y + 1.5, dome.z, Math.PI / 8 + yaw))
    P.add('cathedral', new CylinderGeometry(8.2, 8.2, 9, 32), T(dome.x, y + 3 + 4.5, dome.z))
    P.add('sandstonePlain', new CylinderGeometry(8.75, 8.75, 0.7, 32), T(dome.x, y + 12.3, dome.z))
    const win = panel(rounded(1.5, 4.2), 0.1)
    const pil = new BoxGeometry(0.7, 9, 0.5)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + yaw
      P.add('dark', win, T(dome.x + Math.cos(a) * 8.22, y + 5, dome.z - Math.sin(a) * 8.22, a + Math.PI / 2))
      const b = a + Math.PI / 8 // pilaster between the windows
      P.add('sandstonePlain', pil, T(dome.x + Math.cos(b) * 8.25, y + 7.5, dome.z - Math.sin(b) * 8.25, b + Math.PI / 2))
    }
    win.dispose()
    pil.dispose()
    const prof = domeProfile(8.3, 9.5)
    P.add('sandstonePlain', new LatheGeometry(prof, 32), T(dome.x, y + 12.6, dome.z))
    const rib = domeRib(prof, 0.22, 0.12)
    for (let k = 0; k < 8; k++) P.add('sandstonePlain', rib, T(dome.x, y + 12.6, dome.z, (k / 8) * Math.PI * 2 + yaw + Math.PI / 8))
    rib.dispose()
    // lantern
    const ly = y + 12.6 + 9.4
    P.add('cathedral', new CylinderGeometry(1.9, 2.1, 4.6, 8), T(dome.x, ly + 2.3, dome.z, Math.PI / 8))
    P.add('sandstonePlain', new LatheGeometry(domeProfile(2.2, 2.2), 16), T(dome.x, ly + 4.6, dome.z))
    P.add('sandstonePlain', new SphereGeometry(0.42, 10, 8), T(dome.x, ly + 7.3, dome.z))
    P.add('dark', new CylinderGeometry(0.06, 0.06, 1.6, 4), T(dome.x, ly + 8.2, dome.z))
    // four turrets on the corners of the crossing
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4 + yaw
      const x2 = dome.x + Math.cos(a) * 11.2, z2 = dome.z - Math.sin(a) * 11.2
      P.add('cathedral', new CylinderGeometry(1.1, 1.2, 7, 8), T(x2, y + 3.5, z2))
      P.add('sandstonePlain', new ConeGeometry(1.25, 5, 8), T(x2, y + 9.5, z2))
    }
  }

  // bell tower: west end, on the side of the old cathedral — shaft, belfry,
  // balustraded terrace, octagonal drum, dome, lantern
  const tw = at(r.len / 2 - 7, r.wid / 2 - 7, 0)
  P.frame(T(tw.x, 0, tw.z, yaw), () => {
    P.box('cathedral', -6.5, 0, -6.5, 6.5, 48, 6.5)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box('cathedral', sx * 6.5 - 0.8, 0, sz * 6.5 - 0.8, sx * 6.5 + 0.8, 48, sz * 6.5 + 0.8)
    for (const y of [17, 32, 47.4]) P.box('sandstonePlain', -7.5, y, -7.5, 7.5, y + 0.6, 7.5)
    P.box('cathedral', -6.4, 48, -6.4, 6.4, 59.4, 6.4)
    const arch = panel(rounded(2.4, 7.4), 0.1)
    const hood = ring(rounded(3.1, 7.75), rounded(2.4, 7.4), 0.2)
    for (let k = 0; k < 4; k++) {
      P.frame(T(0, 0, 0, (k * Math.PI) / 2), () => {
        for (const x of [-2.7, 2.7]) {
          P.add('dark', arch, T(x, 50.2, 6.42))
          P.add('sandstonePlain', hood, T(x, 50.1, 6.5))
        }
        // balustrade of the terrace
        P.box('sandstonePlain', -7.1, 60.6, 6.7, 7.1, 60.75, 7.1)
        P.box('sandstonePlain', -7.1, 61.5, 6.72, 7.1, 61.65, 7.08)
        for (let x = -6.8; x <= 6.8; x += 0.62) P.box('sandstonePlain', x - 0.08, 60.75, 6.82, x + 0.08, 61.5, 6.98)
      })
    }
    arch.dispose()
    hood.dispose()
    P.box('sandstonePlain', -7.1, 59.4, -7.1, 7.1, 60.6, 7.1)
  })
  {
    P.add('cathedral', new CylinderGeometry(5.6, 6.2, 11, 8), T(tw.x, 66, tw.z, Math.PI / 8 + yaw))
    const win = panel(rounded(1.5, 4.6), 0.1)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + yaw
      const rr = 5.85 * Math.cos(Math.PI / 8) + 0.02
      P.add('dark', win, T(tw.x + Math.cos(a) * rr, 63.6, tw.z - Math.sin(a) * rr, a + Math.PI / 2))
    }
    win.dispose()
    P.add('sandstonePlain', new CylinderGeometry(6.0, 6.0, 0.6, 8), T(tw.x, 71.7, tw.z, Math.PI / 8 + yaw))
    const prof = domeProfile(5.5, 7)
    P.add('sandstonePlain', new LatheGeometry(prof, 24), T(tw.x, 72, tw.z))
    const rib = domeRib(prof, 0.16, 0.08)
    for (let k = 0; k < 8; k++) P.add('sandstonePlain', rib, T(tw.x, 72, tw.z, (k / 8) * Math.PI * 2 + yaw))
    rib.dispose()
    P.add('cathedral', new CylinderGeometry(1.4, 1.6, 6, 8), T(tw.x, 81.8, tw.z, Math.PI / 8))
    P.add('sandstonePlain', new LatheGeometry(domeProfile(1.7, 1.8), 12), T(tw.x, 84.8, tw.z))
    P.add('sandstonePlain', new ConeGeometry(0.5, 4.6, 8), T(tw.x, 88.6, tw.z))
    P.add('sandstonePlain', new SphereGeometry(0.42, 10, 8), T(tw.x, 91.1, tw.z))
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4 + yaw
      const x2 = tw.x + Math.cos(a) * 8.6, z2 = tw.z - Math.sin(a) * 8.6
      P.add('sandstonePlain', new CylinderGeometry(0.55, 0.6, 3, 6), T(x2, 62.1, z2))
      P.add('sandstonePlain', new ConeGeometry(0.62, 3.8, 6), T(x2, 65.5, z2))
    }
  }

  // ── Catedral Vieja ──────────────────────────────────────────────────────
  const viejo = data.cathedral.viejo
  P.add('cathedral', extrudeFootprint(viejo, 11.5))
  dressWalls(P, viejo, {
    height: 11.5, wall: 'cathedral', trim: 'sandstonePlain', dark: 'dark', bay: 6.2,
    pier: { w: 1.1, d: 0.7 }, window: { outline: rounded(1.1, 3.4), y: 5.2, hood: rounded(1.6, 3.65) }, cornice: true,
  })
  const ro = orientedRect(viejo)
  const uo = new Vector3(Math.cos(ro.angle), 0, Math.sin(ro.angle))
  if (uo.dot(west) < 0) uo.negate()
  const yawO = Math.atan2(-uo.z, uo.x)
  const oc = new Vector3(ro.cx, 0, ro.cz)
  // the Romanesque nave under a tiled gable, west of the crossing
  const nl = ro.len * 0.62, nw = ro.wid * 0.4
  P.frame(T(oc.x, 0, oc.z, yawO), () => {
    P.box('cathedral', -ro.len * 0.2, 11, -nw / 2, -ro.len * 0.2 + nl, 18, nw / 2)
    const g = extrudeShape(new Shape([new Vector2(-nw / 2 - 0.4, 0), new Vector2(nw / 2 + 0.4, 0), new Vector2(0, 3.6)]), nl)
    g.rotateY(Math.PI / 2)
    g.translate(-ro.len * 0.2 + nl / 2, 18, 0)
    P.add('roof', g)
    g.dispose()
    const win = panel(rounded(1.1, 3.2), 0.1)
    for (let x = -ro.len * 0.2 + 5; x < -ro.len * 0.2 + nl - 3; x += 5.5)
      for (const s of [-1, 1]) P.add('dark', win, T(x, 13.6, s * (nw / 2 + 0.02), s > 0 ? 0 : Math.PI))
    win.dispose()
  })
  // Torre del Gallo: over the crossing, towards the east end
  const g = oc.clone().addScaledVector(uo, -ro.len * 0.2)
  P.frame(T(g.x, 0, g.z, yawO), () => P.box('cathedral', -6.4, 11, -6.4, 6.4, 19, 6.4))
  P.add('cathedral', new CylinderGeometry(5.6, 5.8, 9, 16), T(g.x, 19 + 4.5, g.z))
  {
    const win = panel(rounded(0.9, 2.6), 0.08)
    for (let k = 0; k < 16; k++) {
      if (k % 4 === 2) continue // behind the turrets
      const a = (k / 16) * Math.PI * 2 + yawO
      P.add('dark', win, T(g.x + Math.cos(a) * 5.66, 20.4, g.z - Math.sin(a) * 5.66, a + Math.PI / 2))
      P.add('dark', win, T(g.x + Math.cos(a) * 5.62, 24.6, g.z - Math.sin(a) * 5.62, a + Math.PI / 2, [0.8, 0.8, 1]))
    }
    win.dispose()
  }
  P.add('sandstonePlain', new CylinderGeometry(6.0, 6.0, 0.5, 16), T(g.x, 28.2, g.z))
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4 + yawO
    const x2 = g.x + Math.cos(a) * 6.5, z2 = g.z - Math.sin(a) * 6.5
    P.add('cathedral', new CylinderGeometry(1.45, 1.55, 11, 10), T(x2, 22.5, z2))
    P.add('sandstonePlain', new ConeGeometry(1.7, 4.4, 10), T(x2, 30.2, z2))
  }
  // the scaled stone dome, ogival, and the post of its weathercock
  const gallo = domeProfile(5.9, 9.5).map((p, i, a) => new Vector2(p.x * (1 - 0.15 * (i / a.length)), p.y))
  P.add('sandstonePlain', new LatheGeometry(gallo, 16), T(g.x, 28.4, g.z))
  P.add('sandstonePlain', new SphereGeometry(0.5, 10, 8), T(g.x, 38.1, g.z))
  P.add('dark', new CylinderGeometry(0.05, 0.05, 2, 4), T(g.x, 39.3, g.z))

  return P.build()
}
