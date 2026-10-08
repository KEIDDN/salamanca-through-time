import { CylinderGeometry, Shape, SphereGeometry, Vector2 } from 'three'
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
export type PlazaKey = 'sandstone' | 'sandstonePlain' | 'dark' | 'roof' | 'paving'

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
  return P.build()
}

function buildRange(P: Parts<PlazaKey>, L: number) {
  // odd, so the Ayuntamiento and the Pabellón Real sit on a central bay
  const bays = 2 * Math.round((L / 3.85 - 1) / 2) + 1
  const B = L / bays
  const ow = (B - PIER) / 2

  // ground-floor arcade
  P.add('sandstone', arcadeWall({ length: L, height: ARC_H, bays, pier: PIER, spring: SPRING, thickness: 0.95 }))
  // upper façade (over the arcade) and the body of the house behind
  P.box('sandstone', -L / 2, ARC_H, -A, L / 2, CORNICE, 0)
  P.box('sandstone', -L / 2, 0, -D, L / 2, CORNICE, -A)

  const plain = new CylinderGeometry(0.42, 0.42, 0.14, 20)
  for (let i = 0; i < bays; i++) {
    const xc = -L / 2 + B * (i + 0.5)
    // shopfronts at the back of the arcade
    P.box('dark', xc - B / 2 + 0.75, 0.15, -A - 0.02, xc + B / 2 - 0.75, 3.05, -A + 0.05)

    for (let f = 0; f < 3; f++) {
      const h = f < 2 ? 2.35 : 1.75
      const y0 = ARC_H + f * FLOOR + 0.55
      const w = f < 2 ? 1.22 : 1.1
      // window void
      P.box('dark', xc - w / 2, y0, -0.06, xc + w / 2, y0 + h, 0.03)
      // moulded surround & lintel
      P.box('sandstonePlain', xc - w / 2 - 0.16, y0 + h, 0, xc + w / 2 + 0.16, y0 + h + 0.22, 0.2)
      if (f === 0) P.box('sandstonePlain', xc - w / 2 - 0.3, y0 + h + 0.22, 0, xc + w / 2 + 0.3, y0 + h + 0.42, 0.28)
      // balcony slab + iron railing
      const bw = f < 2 ? 1.85 : 1.6
      P.box('sandstonePlain', xc - bw / 2, y0 - 0.12, 0, xc + bw / 2, y0, f < 2 ? 0.62 : 0.4)
      const rz = f < 2 ? 0.6 : 0.38
      P.box('dark', xc - bw / 2 + 0.03, y0, rz - 0.03, xc + bw / 2 - 0.03, y0 + 0.92, rz)
      P.box('dark', xc - bw / 2 + 0.03, y0, 0, xc - bw / 2 + 0.06, y0 + 0.92, rz)
      P.box('dark', xc + bw / 2 - 0.06, y0, 0, xc + bw / 2 - 0.03, y0 + 0.92, rz)
    }
    // spandrel medallion (the Plaza's portrait medallions)
    if (i > 0) {
      const xp = -L / 2 + B * i
      P.add('sandstonePlain', plain, T(xp, SPRING + ow + 0.15, 0.05, 0, 1, Math.PI / 2))
    }
  }
  plain.dispose()

  // pilasters between bays
  for (let i = 0; i <= bays; i++) {
    const xp = -L / 2 + B * i
    P.box('sandstonePlain', xp - 0.26, ARC_H, 0, xp + 0.26, CORNICE, 0.16)
  }
  // string courses
  for (let f = 0; f < 3; f++) {
    const y = ARC_H + f * FLOOR
    P.box('sandstonePlain', -L / 2, y - 0.12, 0, L / 2, y + 0.22, 0.24)
  }
  // cornice, balustrade, pinnacles
  P.box('sandstonePlain', -L / 2 - 0.6, CORNICE, -0.6, L / 2 + 0.6, CORNICE + 0.55, 0.78)
  P.box('sandstonePlain', -L / 2, CORNICE + 0.55, 0.05, L / 2, CORNICE + 1.55, 0.4)
  const spire = new CylinderGeometry(0.06, 0.2, 1.3, 6)
  const ball = new SphereGeometry(0.17, 10, 8)
  for (let i = 0; i <= bays; i += 2) {
    const xp = -L / 2 + B * i
    P.add('sandstonePlain', spire, T(xp, CORNICE + 1.55 + 0.65, 0.22))
    P.add('sandstonePlain', ball, T(xp, CORNICE + 2.35, 0.22))
  }
  spire.dispose()
  ball.dispose()

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
