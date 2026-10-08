import { CatmullRomCurve3, Vector3 } from 'three'
import { plazaFrame, type CityData } from '../scene/lib/cityData'
import { WATER_Y, terrainFor } from '../scene/lib/terrain'
import { LAYOUT } from '../scene/strata/exhibitGeometry'

/**
 * The camera is a single continuous shot: a Catmull-Rom path for the eye and
 * another for the point it looks at. Each key has a position on the master
 * timeline; the timeline tweens `world.cam` between keys.
 */
/** `cut`: this key starts a new take — the camera jumps to it instead of travelling. */
export type Shot = { at: number; pos: Vector3; tgt: Vector3; cut?: boolean }

const v = (x: number, y: number, z: number) => new Vector3(x, y, z)

export function buildShots(data: CityData): Shot[] {
  const P = plazaFrame(data)
  const C = P.center
  const terrain = terrainFor(data)
  /** a point `depth` metres below the street, on the section axis */
  const under = (z: number, depth: number, x = 0) => v(x, terrain.heightAt(0, z) - depth, z)

  // the arch of the Roman bridge the camera flies through (over mid-river)
  const [ax, az] = data.bridge.a
  const [bx, bz] = data.bridge.b
  const len = Math.hypot(bx - ax, bz - az)
  const d = v((bx - ax) / len, 0, (bz - az) / len)
  const arch = v((ax + bx) / 2, WATER_Y + 5.2, (az + bz) / 2).addScaledVector(d, -len / 2 + (len / 26) * 12.5)
  const downstream = v(-d.z, 0, d.x) // perpendicular to the bridge, towards the west
  if (downstream.x > 0) downstream.negate()

  const stone = under(LAYOUT.stone.z, LAYOUT.stone.depth)
  // the eye never drops below the paving while it is over the road
  const ROAD_EYE = LAYOUT.road.depth - 3.4

  return [
    // 0 — almost abstract: the city seen from very high, through haze
    { at: 0, pos: v(-60, 2700, 380), tgt: v(0, 0, 520) },
    // 1 — the model reveals itself, slowly turning
    { at: 9, pos: v(-760, 1500, -260), tgt: v(0, 0, 360) },
    // 2 — approach from the north-west
    { at: 17, pos: v(-520, 470, -430), tgt: v(C.x, 0, C.z + 60) },
    // 3 — Plaza Mayor in the frame
    { at: 22.5, pos: C.clone().add(v(-170, 130, -150)), tgt: C.clone().add(v(0, 4, 0)) },
    // 4 — architectural scale, above the arcades
    { at: 27.5, pos: P.at(26, 24, -26), tgt: P.at(0, 9, 34) },
    // 5 — street level, facing the Ayuntamiento
    // (aimed high, so the façade sits in the lower half and the title has the sky)
    { at: 32, pos: P.at(6, 2.1, -30), tgt: P.at(0, 21, 42) },
    // 6 — a slow walk forward (hold)
    { at: 39, pos: P.at(1, 2.1, -14), tgt: P.at(0, 22, 42) },
    // 7 — lift off; the whole city along the section axis
    { at: 44.5, pos: v(-470, 330, -330), tgt: v(0, -12, 430) },
    // 8 — the section, face on: Plaza Mayor cut open like a drawing
    { at: 52.5, pos: v(40, -14, -2), tgt: v(-46, -16, -2) },
    // … held while the legend draws itself, easing in a few metres
    { at: 55.4, pos: v(34, -14.6, 0), tgt: v(-46, -16.4, 0) },
    // 9 — turning into the gallery
    { at: 58.5, pos: under(70, 6.5, 8), tgt: under(220, 8) },
    // 10 — through the medieval gate
    { at: 63, pos: under(LAYOUT.gate.z + 10, 7.4), tgt: under(380, 12) },
    // 11 — along the Roman road. The road follows the slope down to the river,
    // so the eye is keyed often enough that it never dips below the paving
    { at: 68.5, pos: under(420, ROAD_EYE, -1.2), tgt: under(580, LAYOUT.road.depth - 1.2) },
    { at: 70.8, pos: under(540, ROAD_EYE, 1.6), tgt: under(LAYOUT.road.z1, LAYOUT.road.depth - 0.6, -1) },
    // 12 — past the last milestone, then over the edge towards the Iron Age
    { at: 73, pos: under(LAYOUT.road.z1 + 30, LAYOUT.road.depth - 2.2, 2), tgt: under(740, 27.5, 4) },
    // 13 — by the verraco
    // a three-quarter view from just above the floor, like a museum photograph
    { at: 77.5, pos: under(LAYOUT.castro.z - 4.2, LAYOUT.castro.depth - 1.8, 4.2), tgt: under(LAYOUT.castro.z + 0.6, LAYOUT.castro.depth - 2.1, 8.6) },
    // over the edge of the hill-fort's floor, down to the bedrock
    { at: 79.6, pos: under(828, 24.6, -2), tgt: stone.clone().add(v(0, 1.2, 0)) },
    // 14 — the stone itself: a slow turn around it
    { at: 81.5, pos: stone.clone().add(v(-4.5, 3.4, -9)), tgt: stone.clone().add(v(0, 2.1, 0)) },
    { at: 84, pos: stone.clone().add(v(3.5, 2.8, -8)), tgt: stone.clone().add(v(0, 2.2, 0)) },
    // 15 — into the heart of the stone as it breaks, the light filling the frame…
    { at: 86.6, pos: stone.clone().add(v(0, 2.3, 0.4)), tgt: stone.clone().add(v(0, 2.4, 9)) },
    // 16 — … and out of the light, on the Tormes, upstream of the bridge (a cut, hidden by the flash)
    { at: 86.95, cut: true, pos: arch.clone().addScaledVector(downstream, -125).setY(WATER_Y + 5), tgt: arch.clone().setY(WATER_Y + 6) },
    { at: 89, pos: arch.clone().addScaledVector(downstream, -70).setY(WATER_Y + 4.5), tgt: arch.clone().setY(WATER_Y + 6) },
    // 17 — the arch frames the sunset…
    { at: 91.5, pos: arch.clone().addScaledVector(downstream, -9).setY(WATER_Y + 4.6), tgt: arch.clone().addScaledVector(downstream, 80).setY(WATER_Y + 6) },
    // … and the camera passes through
    { at: 93, pos: arch.clone().addScaledVector(downstream, 22).setY(WATER_Y + 5.5), tgt: arch.clone().addScaledVector(downstream, 120).setY(WATER_Y + 9) },
    // 18 — the postcard: bridge and cathedral at sunset, from downstream
    { at: 96, pos: arch.clone().addScaledVector(downstream, 150).add(v(0, 9, 70)), tgt: v(55, 6, 640) },
    // 19 — the archive: everything at once
    { at: 100, pos: v(-460, 560, 1720), tgt: v(40, -5, 480) },
  ]
}

/**
 * The camera path, as one or more takes. Within a take the eye and target
 * follow Catmull-Rom curves; between takes (a key marked `cut`) the camera
 * jumps halfway through the segment. `t` runs 0 → 1 over all keys, one
 * segment per key interval, as the master timeline tweens it.
 */
export function buildCurves(shots: Shot[]) {
  const n = shots.length - 1
  const takes: { a: number; b: number; pos: CatmullRomCurve3; tgt: CatmullRomCurve3 }[] = []
  let a = 0
  for (let i = 1; i <= n + 1; i++) {
    if (i <= n && !shots[i].cut) continue
    const keys = shots.slice(a, i)
    const pts = (k: 'pos' | 'tgt') => (keys.length > 1 ? keys.map((s) => s[k]) : [keys[0][k], keys[0][k].clone()])
    takes.push({ a, b: i - 1, pos: new CatmullRomCurve3(pts('pos'), false, 'centripetal'), tgt: new CatmullRomCurve3(pts('tgt'), false, 'centripetal') })
    a = i
  }
  return {
    at(t: number, pos: Vector3, tgt: Vector3) {
      const x = Math.min(Math.max(t, 0), 1) * n
      let k = takes.findIndex((tk) => x <= tk.b)
      if (k < 0) k = takes.length - 1
      let tk = takes[k]
      let u: number
      if (x < tk.a) {
        // in the gap of a cut: hold the end of the previous take, then the start of this one
        if (x - (tk.a - 1) < 0.5) {
          tk = takes[k - 1]
          u = 1
        } else u = 0
      } else u = tk.b > tk.a ? (x - tk.a) / (tk.b - tk.a) : 0
      tk.pos.getPoint(u, pos)
      tk.tgt.getPoint(u, tgt)
    },
  }
}

/** Timeline positions of the keys — used by the master timeline without needing city data. */
export const SHOT_TIMES = [0, 9, 17, 22.5, 27.5, 32, 39, 44.5, 52.5, 55.4, 58.5, 63, 68.5, 70.8, 73, 77.5, 79.6, 81.5, 84, 86.6, 86.95, 89, 91.5, 93, 96, 100]
