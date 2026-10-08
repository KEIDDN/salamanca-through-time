import { DataTexture, DataUtils, HalfFloatType, LinearFilter, RedFormat } from 'three'
import type { CityData } from './cityData'

/**
 * The ground Salamanca stands on: a plateau (y = 0, Plaza Mayor & cathedrals)
 * falling ~22 m to the Tormes, with the flat Arrabal on the far bank.
 * Shared by geometry, shaders (as a height texture), exhibits and camera.
 */
export const WATER_Y = -20.6
export const RIVER_HALF = 78
const PLATEAU_DROP = 22
const CITY_SLOPE = 330

export type Terrain = ReturnType<typeof makeTerrain>

let cached: { data: CityData; t: Terrain } | null = null
export function terrainFor(data: CityData): Terrain {
  if (cached?.data !== data) cached = { data, t: makeTerrain(data) }
  return cached.t
}

function makeTerrain(data: CityData) {
  const river = smoothPolyline(data.river, 6)
  // the Tormes crosses the whole model west–east: which bank a point is on is
  // simply whether it lies north of the river line at its x (the city is north)
  const byX = [...river].sort((a, b) => a[0] - b[0])
  const riverZ = (x: number) => {
    if (x <= byX[0][0]) return byX[0][1]
    for (let i = 0; i < byX.length - 1; i++) {
      const [ax, az] = byX[i], [bx, bz] = byX[i + 1]
      if (x <= bx) return az + ((bz - az) * (x - ax)) / (bx - ax || 1)
    }
    return byX[byX.length - 1][1]
  }
  const cityNorth = riverZ(0) > 0

  /** distance to the river centreline and which bank (1 = city side) */
  function riverInfo(x: number, z: number) {
    let best = Infinity
    const side = (z < riverZ(x)) === cityNorth ? 1 : 0
    for (let i = 0; i < river.length - 1; i++) {
      const [ax, az] = river[i], [bx, bz] = river[i + 1]
      const dx = bx - ax, dz = bz - az
      const l2 = dx * dx + dz * dz
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2))
      const px = ax + dx * t - x, pz = az + dz * t - z
      const d = px * px + pz * pz
      if (d < best) best = d
    }
    return { d: Math.sqrt(best), side }
  }

  function heightAt(x: number, z: number) {
    const { d, side } = riverInfo(x, z)
    if (d < RIVER_HALF) return -PLATEAU_DROP - 2.5 * (1 - d / RIVER_HALF) ** 0.5
    const e = d - RIVER_HALF
    if (side === 1) return -PLATEAU_DROP * (1 - smooth(e / CITY_SLOPE))
    return -PLATEAU_DROP + 4.5 * smooth(e / 90) + 5 * smooth((e - 260) / 500)
  }

  // height texture for the shaders (strata are measured from the local surface)
  const { x0, x1, z0, z1 } = data.slab
  const res = 4
  const W = Math.ceil((x1 - x0) / res) + 1
  const H = Math.ceil((z1 - z0) / res) + 1
  const arr = new Uint16Array(W * H)
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) arr[j * W + i] = DataUtils.toHalfFloat(heightAt(x0 + i * res, z0 + j * res))
  const heightTex = new DataTexture(arr, W, H, RedFormat, HalfFloatType)
  heightTex.minFilter = heightTex.magFilter = LinearFilter
  heightTex.needsUpdate = true

  return {
    heightAt,
    riverInfo,
    heightTex,
    /** (x0, z0, 1/width, 1/depth) — maps world xz to texture uv */
    heightRect: [x0 - res / 2, z0 - res / 2, 1 / (W * res), 1 / (H * res)] as const,
    river,
  }
}

function smooth(t: number) {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

/** Catmull-Rom resampling so the riverbanks curve instead of kinking. */
function smoothPolyline(pts: [number, number][], sub: number): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]
    for (let k = 0; k < sub; k++) {
      const t = k / sub, t2 = t * t, t3 = t2 * t
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}
