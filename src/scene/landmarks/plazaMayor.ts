import { BoxGeometry, BufferAttribute, Color, ConeGeometry, CylinderGeometry, Path, PlaneGeometry, Shape, SphereGeometry, TorusGeometry, Vector2 } from 'three'
import { seeded } from '../lib/cityData'
import { Parts, T } from '../lib/parts'
import { arcadeWall, archHole, extrudeShape } from './shapes'

/**
 * Plaza Mayor (Alberto de Churriguera, 1729–1755), in the square's local frame:
 * +x = east, -z = north (Ayuntamiento), origin at the centre, y = 0 at paving.
 *
 * Four ranges of arcaded houses (three floors of balconied windows over a
 * ground-floor arcade with portrait medallions in the spandrels), the
 * Ayuntamiento's belfry to the north and the Pabellón Real to the east.
 */
export type PlazaKey = 'sandstone' | 'sandstonePlain' | 'dark' | 'roof' | 'paving' | 'iron' | 'figure'

const D = 16 // depth of each range
const A = 4.2 // depth of the arcade
const ARC_H = 5.4 // ground floor (arcade) height
const SPRING = 3.3
const FLOOR = 3.55
const CORNICE = ARC_H + FLOOR * 3
const PIER = 1.05

export function buildPlazaMayor(halfE: number, halfN: number) {
  const P = new Parts<PlazaKey>()

  // paving
  P.box('paving', -halfE, 0, -halfN, halfE, 0.18, halfN)

  const ranges = [
    { name: 'north', m: T(0, 0, -halfN, 0), len: halfE * 2 },
    { name: 'south', m: T(0, 0, halfN, Math.PI), len: halfE * 2 },
    { name: 'east', m: T(halfE, 0, 0, -Math.PI / 2), len: halfN * 2 },
    { name: 'west', m: T(-halfE, 0, 0, Math.PI / 2), len: halfN * 2 },
  ] as const

  for (const r of ranges) {
    P.frame(r.m, () => {
      const bays = buildRange(P, r.len)
      if (r.name === 'north') ayuntamiento(P, r.len / bays)
      if (r.name === 'east') pabellonReal(P, r.len / bays)
    })
  }

  // corner blocks
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x0 = sx * halfE, z0 = sz * halfN
    P.box('sandstone', x0, 0, z0, x0 + sx * D, CORNICE, z0 + sz * D)
    P.box('sandstonePlain', x0 - sx * 0.6, CORNICE, z0 - sz * 0.6, x0 + sx * D, CORNICE + 0.55, z0 + sz * D)
  }
  square(P, halfE, halfN)
  return P.build()
}

function buildRange(P: Parts<PlazaKey>, L: number) {
  // odd, so the Ayuntamiento and the Pabellón Real sit on a central bay
  const bays = 2 * Math.round((L / 3.85 - 1) / 2) + 1
  const B = L / bays
  const ow = (B - PIER) / 2
  const REVEAL = 0.5 // depth of the upper façade: the openings are real voids

  // ground-floor arcade
  P.add('sandstone', arcadeWall({ length: L, height: ARC_H, bays, pier: PIER, spring: SPRING, thickness: 0.95 }))
  // the body of the house behind, and the floors over the arcade
  P.box('sandstone', -L / 2, 0, -D, L / 2, CORNICE, -A)
  P.box('sandstone', -L / 2, ARC_H, -A, L / 2, CORNICE, -REVEAL)

  // the upper façade: one slab pierced by every balcony door
  const openings: { xc: number; y0: number; w: number; h: number; f: number }[] = []
  for (let i = 0; i < bays; i++) {
    const xc = -L / 2 + B * (i + 0.5)
    for (let f = 0; f < 3; f++)
      openings.push({ xc, f, y0: ARC_H + f * FLOOR + 0.55, w: f < 2 ? 1.22 : 1.1, h: f < 2 ? 2.35 : 1.75 })
  }
  const face = new Shape([new Vector2(-L / 2, ARC_H), new Vector2(L / 2, ARC_H), new Vector2(L / 2, CORNICE), new Vector2(-L / 2, CORNICE)])
  for (const o of openings) {
    const hole = new Path()
    hole.moveTo(o.xc - o.w / 2, o.y0)
    hole.lineTo(o.xc + o.w / 2, o.y0)
    hole.lineTo(o.xc + o.w / 2, o.y0 + o.h)
    hole.lineTo(o.xc - o.w / 2, o.y0 + o.h)
    face.holes.push(hole)
  }
  const fg = extrudeShape(face, REVEAL)
  fg.translate(0, 0, -REVEAL / 2)
  P.add('sandstone', fg)
  fg.dispose()

  const plain = new CylinderGeometry(0.42, 0.42, 0.14, 20)
  const rim = new TorusGeometry(0.47, 0.06, 6, 24)
  const railFront = new PlaneGeometry(1, 0.86)
  for (let i = 0; i < bays; i++) {
    const xc = -L / 2 + B * (i + 0.5)
    // shopfronts at the back of the arcade
    P.box('dark', xc - B / 2 + 0.75, 0.15, -A - 0.02, xc + B / 2 - 0.75, 3.05, -A + 0.05)
    // spandrel medallion (the Plaza's portrait medallions)
    if (i > 0) {
      const xp = -L / 2 + B * i
      P.add('sandstonePlain', plain, T(xp, SPRING + ow - 0.06, 0.05, 0, 1, Math.PI / 2))
      P.add('sandstonePlain', rim, T(xp, SPRING + ow - 0.06, 0.06))
    }
  }
  for (const { xc, y0, w, h, f } of openings) {
    // the glass and shutters, set back in the reveal
    P.box('dark', xc - w / 2, y0, -REVEAL + 0.04, xc + w / 2, y0 + h, -REVEAL + 0.1)
    // moulded surround: jambs, lintel, and a cornice over the main floor
    P.box('sandstonePlain', xc - w / 2 - 0.17, y0, 0, xc - w / 2, y0 + h, 0.09)
    P.box('sandstonePlain', xc + w / 2, y0, 0, xc + w / 2 + 0.17, y0 + h, 0.09)
    P.box('sandstonePlain', xc - w / 2 - 0.22, y0 + h, 0, xc + w / 2 + 0.22, y0 + h + 0.22, 0.16)
    if (f === 0) {
      P.box('sandstonePlain', xc - w / 2 - 0.34, y0 + h + 0.22, 0, xc + w / 2 + 0.34, y0 + h + 0.34, 0.3)
      P.box('sandstonePlain', xc - w / 2 - 0.24, y0 + h + 0.34, 0, xc + w / 2 + 0.24, y0 + h + 0.44, 0.22)
    }
    // balcony: a moulded slab on its bed, and a wrought-iron railing
    const bw = f < 2 ? 1.85 : 1.6
    const bd = f < 2 ? 0.62 : 0.4
    P.box('sandstonePlain', xc - bw / 2, y0 - 0.12, 0, xc + bw / 2, y0, bd)
    P.box('sandstonePlain', xc - bw / 2 + 0.08, y0 - 0.24, 0, xc + bw / 2 - 0.08, y0 - 0.12, bd - 0.1)
    const rz = bd - 0.04
    P.add('iron', railFront, T(xc, y0 + 0.43, rz, 0, [bw - 0.08, 1, 1]))
    for (const sx of [-1, 1]) P.add('iron', railFront, T(xc + sx * (bw / 2 - 0.04), y0 + 0.43, rz / 2, Math.PI / 2, [rz, 1, 1]))
    P.box('dark', xc - bw / 2 + 0.02, y0 + 0.86, rz - 0.03, xc + bw / 2 - 0.02, y0 + 0.92, rz + 0.03)
    for (const sx of [-1, 1]) P.box('dark', xc + sx * (bw / 2 - 0.04) - 0.03, y0 + 0.86, 0, xc + sx * (bw / 2 - 0.04) + 0.03, y0 + 0.92, rz)
  }
  plain.dispose()
  rim.dispose()
  railFront.dispose()

  // piers: a plinth at the foot and an impost where the arches spring
  for (let i = 0; i <= bays; i++) {
    const xp = -L / 2 + B * i
    const hw = i === 0 || i === bays ? 0 : PIER / 2
    P.box('sandstonePlain', xp - hw - 0.06, 0, -0.95, xp + hw + 0.06, 0.42, 0.06)
    P.box('sandstonePlain', xp - hw - 0.08, SPRING - 0.22, -0.95, xp + hw + 0.08, SPRING, 0.08)
  }
  // pilasters between bays
  for (let i = 0; i <= bays; i++) {
    const xp = -L / 2 + B * i
    P.box('sandstonePlain', xp - 0.26, ARC_H, 0, xp + 0.26, CORNICE - 0.5, 0.16)
  }
  // string courses
  for (let f = 0; f < 3; f++) {
    const y = ARC_H + f * FLOOR
    P.box('sandstonePlain', -L / 2, y - 0.12, 0, L / 2, y + 0.22, 0.24)
  }
  // frieze and a cornice in three steps, each casting its own line of shadow
  P.box('sandstonePlain', -L / 2, CORNICE - 0.5, 0, L / 2, CORNICE - 0.2, 0.2)
  P.box('sandstonePlain', -L / 2 - 0.2, CORNICE - 0.2, -0.6, L / 2 + 0.2, CORNICE + 0.1, 0.4)
  P.box('sandstonePlain', -L / 2 - 0.4, CORNICE + 0.1, -0.6, L / 2 + 0.4, CORNICE + 0.32, 0.62)
  P.box('sandstonePlain', -L / 2 - 0.6, CORNICE + 0.32, -0.6, L / 2 + 0.6, CORNICE + 0.55, 0.8)

  // pierced balustrade: plinth, balusters, coping; pinnacles over every other pier
  const BY = CORNICE + 0.55
  P.box('sandstonePlain', -L / 2, BY, 0.08, L / 2, BY + 0.16, 0.42)
  P.box('sandstonePlain', -L / 2, BY + 0.86, 0.04, L / 2, BY + 1.02, 0.46)
  const baluster = new CylinderGeometry(0.055, 0.075, 0.7, 6)
  for (let x = -L / 2 + 0.2; x < L / 2 - 0.1; x += 0.3) P.add('sandstonePlain', baluster, T(x, BY + 0.51, 0.25))
  baluster.dispose()
  const spire = new CylinderGeometry(0.06, 0.2, 1.3, 6)
  const ball = new SphereGeometry(0.17, 10, 8)
  for (let i = 0; i <= bays; i += 2) {
    const xp = -L / 2 + B * i
    P.box('sandstonePlain', xp - 0.22, BY, 0.03, xp + 0.22, BY + 1.06, 0.47)
    P.add('sandstonePlain', spire, T(xp, BY + 1.06 + 0.65, 0.25))
    P.add('sandstonePlain', ball, T(xp, BY + 1.86, 0.25))
  }
  spire.dispose()
  ball.dispose()

  // the outer façade, onto the streets behind: plain, with a door or window per bay and floor
  for (let i = 0; i < bays; i++) {
    const xc = -L / 2 + B * (i + 0.5)
    P.box('dark', xc - 0.6, 0, -D - 0.03, xc + 0.6, 2.7, -D + 0.02)
    for (let f = 0; f < 3; f++) {
      const y0 = ARC_H + f * FLOOR + 0.55
      P.box('dark', xc - 0.55, y0, -D - 0.03, xc + 0.55, y0 + (f < 2 ? 2.1 : 1.6), -D + 0.02)
      P.box('sandstonePlain', xc - 0.75, y0 - 0.12, -D - 0.25, xc + 0.75, y0, -D + 0.02)
    }
  }
  P.box('sandstonePlain', -L / 2, CORNICE - 0.2, -D - 0.45, L / 2, CORNICE + 0.3, -D + 0.02)

  // pitched tile roof behind the balustrade
  const roof = new Shape([new Vector2(0.9, 0), new Vector2(D - 0.6, 0), new Vector2(D / 2 + 0.3, 3.4)])
  const rg = extrudeShape(roof, L)
  rg.rotateY(Math.PI / 2)
  rg.translate(0, CORNICE + 0.55, 0)
  // after rotation: extrusion runs along x, shape-x maps to -z
  P.add('roof', rg)
  rg.dispose()
  return bays
}

/**
 * Life in the square, at the scale of the architecture: iron lamp standards
 * along the paving and people — a few walking, small groups, most of them
 * under the arcades — just enough to read the size of the place.
 */
function square(P: Parts<PlazaKey>, halfE: number, halfN: number) {
  const rand = seeded(1755)
  const body = new CylinderGeometry(0.15, 0.19, 1.42, 7)
  body.translate(0, 0.71, 0)
  const head = new SphereGeometry(0.115, 8, 6)
  head.translate(0, 1.58, 0)
  const tones = ['#2c2a2a', '#4a4440', '#6d6258', '#8c8478', '#2f3640', '#5a3a2e', '#b9ae9c'].map((h) => new Color(h))
  const person = (x: number, z: number, y = 0.18) => {
    const c = tones[Math.floor(rand() * tones.length)]
    const s = 0.94 + rand() * 0.12
    for (const g of [body, head]) {
      const p = g.clone()
      const n = p.getAttribute('position').count
      const col = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3)
      p.setAttribute('color', new BufferAttribute(col, 3))
      P.add('figure', p, T(x, y, z, rand() * 6.28, s))
      p.dispose()
    }
  }
  // the camera walks in from the south (local +z) towards the Ayuntamiento:
  // nobody stands in its way or close to the lens
  const clear = (x: number, z: number) => Math.abs(x - 3) > 8 || z < -12
  let placed = 0
  while (placed < 44) {
    const x = (rand() * 2 - 1) * (halfE - 3), z = (rand() * 2 - 1) * (halfN - 3)
    if (!clear(x, z)) continue
    const group = rand() < 0.35 ? 2 + Math.floor(rand() * 2) : 1
    for (let k = 0; k < group; k++) person(x + (rand() - 0.5) * 1.4, z + (rand() - 0.5) * 1.4)
    placed += group
  }
  // under the arcades
  for (let k = 0; k < 40; k++) {
    const side = Math.floor(rand() * 4)
    const t = (rand() * 2 - 1) * 0.92
    const d = 1.6 + rand() * 1.8
    const [x, z] = [[t * halfE, -halfN - d], [t * halfE, halfN + d], [halfE + d, t * halfN], [-halfE - d, t * halfN]][side]
    person(x, z, 0)
  }
  body.dispose()
  head.dispose()

  // lamp standards, three along each side of the paving
  const pole = new CylinderGeometry(0.06, 0.1, 3.9, 8)
  pole.translate(0, 1.95, 0)
  const lantern = new CylinderGeometry(0.2, 0.13, 0.5, 6)
  const hood = new ConeGeometry(0.26, 0.24, 6)
  const lamp = (x: number, z: number) => {
    P.add('dark', pole, T(x, 0.18, z))
    P.add('dark', lantern, T(x, 4.35, z))
    P.add('dark', hood, T(x, 4.72, z))
  }
  for (const t of [-0.55, 0, 0.55]) {
    lamp(t * halfE, -halfN + 3.2)
    lamp(t * halfE, halfN - 3.2)
    lamp(halfE - 3.2, t * halfN)
    lamp(-halfE + 3.2, t * halfN)
  }
  pole.dispose()
  lantern.dispose()
  hood.dispose()
}

/** The Ayuntamiento (north range): attic, clock and the belfry (espadaña). */
function ayuntamiento(P: Parts<PlazaKey>, B: number) {
  const w = B * 5
  P.box('sandstone', -w / 2, CORNICE + 0.5, -2.4, w / 2, CORNICE + 3.9, 0.2)
  P.box('sandstonePlain', -w / 2 - 0.3, CORNICE + 3.9, -2.6, w / 2 + 0.3, CORNICE + 4.3, 0.45)
  // clock
  const disc = new CylinderGeometry(1.05, 1.05, 0.12, 32)
  const face = new CylinderGeometry(0.86, 0.86, 0.12, 32)
  P.add('dark', disc, T(0, CORNICE + 2.2, 0.26, 0, 1, Math.PI / 2))
  P.add('sandstonePlain', face, T(0, CORNICE + 2.2, 0.34, 0, 1, Math.PI / 2))
  disc.dispose()
  face.dispose()
  // hands at ten to two, and the hour marks
  P.add('dark', new BoxGeometry(0.07, 0.62, 0.04), T(0, CORNICE + 2.2, 0.42, 0, 1, 0, -Math.PI / 6 * 1).multiply(T(0, 0.27)))
  P.add('dark', new BoxGeometry(0.09, 0.42, 0.04), T(0, CORNICE + 2.2, 0.43, 0, 1, 0, Math.PI / 3 * 1).multiply(T(0, 0.17)))
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2
    P.add('dark', new BoxGeometry(0.05, k % 3 ? 0.08 : 0.16, 0.03), T(Math.sin(a) * 0.74, CORNICE + 2.2 + Math.cos(a) * 0.74, 0.41, 0, 1, 0, -a))
  }
  // pilasters on the central bays
  for (let i = -2; i <= 3; i++) {
    const x = (i - 0.5) * B
    P.box('sandstonePlain', x - 0.35, ARC_H, 0, x + 0.35, CORNICE + 3.9, 0.32)
  }

  // espadaña
  const s = new Shape([
    new Vector2(-4.6, 0), new Vector2(4.6, 0), new Vector2(4.6, 5.8), new Vector2(3.2, 6.2),
    new Vector2(1.5, 7.3), new Vector2(0.7, 8.4), new Vector2(-0.7, 8.4), new Vector2(-1.5, 7.3),
    new Vector2(-3.2, 6.2), new Vector2(-4.6, 5.8),
  ])
  s.holes.push(archHole(-2.15, 1.1, 1.8, 3.4), archHole(2.15, 1.1, 1.8, 3.4), archHole(0, 5.0, 1.2, 6.2))
  const esp = extrudeShape(s, 1.1)
  P.add('sandstone', esp, T(0, CORNICE + 4.3, -1.1))
  esp.dispose()
  const bell = new CylinderGeometry(0.32, 0.62, 1.05, 16)
  for (const [x, y] of [[-2.15, 2.4], [2.15, 2.4], [0, 5.55]] as const)
    P.add('dark', bell, T(x, CORNICE + 4.3 + y, -1.1, 0, y > 5 ? 0.65 : 1))
  bell.dispose()
  const finial = new SphereGeometry(0.35, 12, 10)
  P.add('sandstonePlain', finial, T(0, CORNICE + 4.3 + 8.75, -1.1))
  finial.dispose()
}

/** The Pabellón Real (east range): raised attic with the royal medallion. */
function pabellonReal(P: Parts<PlazaKey>, B: number) {
  const w = B * 3
  P.box('sandstone', -w / 2, CORNICE + 0.5, -2.0, w / 2, CORNICE + 3.1, 0.2)
  P.box('sandstonePlain', -w / 2 - 0.3, CORNICE + 3.1, -2.2, w / 2 + 0.3, CORNICE + 3.45, 0.42)
  const med = new CylinderGeometry(0.95, 0.95, 0.2, 32)
  P.add('sandstonePlain', med, T(0, CORNICE + 1.8, 0.3, 0, 1, Math.PI / 2))
  med.dispose()
  const ball = new SphereGeometry(0.3, 12, 10)
  for (const x of [-w / 2, 0, w / 2]) P.add('sandstonePlain', ball, T(x, CORNICE + 3.8, -0.9))
  ball.dispose()
}

export const PLAZA_CORNICE = CORNICE
