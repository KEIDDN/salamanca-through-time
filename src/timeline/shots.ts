import { CatmullRomCurve3, Vector3 } from 'three'
import { plazaFrame, type CityData } from '../scene/lib/cityData'
import { WATER_Y, terrainFor } from '../scene/lib/terrain'
import { LAYOUT } from '../scene/strata/exhibitGeometry'

/**
 * The camera is a single continuous shot: a Catmull-Rom path for the eye and
 * another for the point it looks at. Each key has a position on the master
 * timeline; the timeline tweens `world.cam` between keys.
 */
export type Shot = { at: number; pos: Vector3; tgt: Vector3 }

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
    { at: 32, pos: P.at(6, 2.1, -30), tgt: P.at(0, 13.5, 42) },
    // 6 — a slow walk forward (hold)
    { at: 39, pos: P.at(1, 2.1, -14), tgt: P.at(0, 16, 42) },
    // 7 — lift off; the whole city along the section axis
    { at: 44.5, pos: v(-470, 330, -330), tgt: v(0, -12, 430) },
    // 8 — the section, face on: Plaza Mayor cut open like a drawing
    { at: 52.5, pos: v(40, -14, -2), tgt: v(-46, -16, -2) },
    // 9 — turning into the gallery
    { at: 58.5, pos: under(70, 6.5, 8), tgt: under(220, 8) },
    // 10 — through the medieval gate
    { at: 63, pos: under(LAYOUT.gate.z + 10, 7.4), tgt: under(380, 12) },
    // 11 — along the Roman road
    { at: 68.5, pos: under(420, 11.8), tgt: under(580, 16.5) },
    // 12 — sinking towards the Iron Age
    { at: 73, pos: under(615, 19), tgt: under(740, 27) },
    // 13 — by the verraco
    { at: 77.5, pos: under(736, 23.5, -4), tgt: under(LAYOUT.castro.z, 26.4, 8) },
    // 14 — the stone itself: a slow turn around it
    { at: 81.5, pos: stone.clone().add(v(-4.5, 3.4, -9)), tgt: stone.clone().add(v(0, 2.1, 0)) },
    { at: 84, pos: stone.clone().add(v(3.5, 2.8, -8)), tgt: stone.clone().add(v(0, 2.2, 0)) },
    // 15 — rising through every layer, towards the light
    { at: 86.5, pos: stone.clone().add(v(14, 22, 30)), tgt: v(24, WATER_Y - 2, 1030) },
    // 16 — surfacing in the Tormes, upstream of the bridge
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

export function buildCurves(shots: Shot[]) {
  const pos = new CatmullRomCurve3(shots.map((s) => s.pos), false, 'centripetal')
  const tgt = new CatmullRomCurve3(shots.map((s) => s.tgt), false, 'centripetal')
  return { pos, tgt }
}

/** Timeline positions of the keys — used by the master timeline without needing city data. */
export const SHOT_TIMES = [0, 9, 17, 22.5, 27.5, 32, 39, 44.5, 52.5, 58.5, 63, 68.5, 73, 77.5, 81.5, 84, 86.5, 89, 91.5, 93, 96, 100]
