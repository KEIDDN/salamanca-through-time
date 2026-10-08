import { CatmullRomCurve3, Vector3 } from 'three'
import { plazaFrame, type CityData } from '../scene/lib/cityData'

/**
 * The camera is a single continuous shot: a Catmull-Rom path for the eye and
 * another for the point it looks at. Each key has a position on the master
 * timeline; the timeline tweens `world.cam` between keys.
 */
export type Shot = { at: number; pos: Vector3; tgt: Vector3; ease?: string }

const v = (x: number, y: number, z: number) => new Vector3(x, y, z)

export function buildShots(data: CityData): Shot[] {
  const P = plazaFrame(data)
  const C = P.center
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
    { at: 45, pos: v(-470, 330, -330), tgt: v(0, -12, 430) },
    // 8 — over the opening at the plaza end
    { at: 52.5, pos: v(-26, 58, -150), tgt: v(8, -18, 90) },
    // 9 — into the section
    { at: 57, pos: v(0, -6.5, 45), tgt: v(0, -8, 200) },
    // 10 — through the medieval gate
    { at: 63, pos: v(0, -7.4, 222), tgt: v(0, -12, 380) },
    // 11 — along the Roman road
    { at: 69, pos: v(0, -14.2, 420), tgt: v(0, -17, 580) },
    // 12 — sinking towards the Iron Age
    { at: 74, pos: v(0, -16.5, 610), tgt: v(0, -26, 760) },
    // 13 — over the verraco
    { at: 78.5, pos: v(-2, -21.5, 742), tgt: v(7, -27, 790) },
    // 14 — the bedrock
    { at: 83, pos: v(0, -41, 828), tgt: v(0, -38, 905) },
    // 15 — rising through every layer at once
    { at: 87, pos: v(0, -8, 895), tgt: v(-4, 16, 1060) },
    // 16 — surfacing over the Tormes
    { at: 90.5, pos: v(14, 34, 1010), tgt: v(30, 22, 760) },
    // 17 — the postcard: the cathedral over the Roman bridge at sunset
    { at: 95, pos: v(96, 5, 1004), tgt: v(40, 28, 610) },
    // 18 — the archive: everything at once
    { at: 100, pos: v(-330, 640, 1960), tgt: v(40, 0, 470) },
  ]
}

export function buildCurves(shots: Shot[]) {
  const pos = new CatmullRomCurve3(shots.map((s) => s.pos), false, 'centripetal')
  const tgt = new CatmullRomCurve3(shots.map((s) => s.tgt), false, 'centripetal')
  return { pos, tgt }
}

/** Timeline positions of the keys — used by the master timeline without needing city data. */
export const SHOT_TIMES = [0, 9, 17, 22.5, 27.5, 32, 39, 45, 52.5, 57, 63, 69, 74, 78.5, 83, 87, 90.5, 95, 100]
