import type { BufferGeometry } from 'three'
import { cone, ellipsoid, meshField, noise3, roundBox, smin, ssub } from '../lib/sdf'

/**
 * A Vetton verraco (IV–I c. BC), carved rather than assembled: a massive,
 * stylised boar on its plinth, the legs released only in relief from the
 * slab of stone left between them, a dorsal crest, the head lowered towards
 * a flat snout, eyes and mouth incised, the whole surface softened by two
 * thousand years of weather.
 *
 * Local frame: snout towards +x, standing on y = 0, about 3 m long.
 */
let cached: BufferGeometry | null = null

export function verracoGeometry() {
  cached ??= meshField(verracoField, [-1.62, -0.02, -0.72], [2.05, 2.08, 0.72], 0.038)
  return cached
}

function verracoField(x: number, y: number, z: number) {
  const az = Math.abs(z)

  // the plinth, its arrises worn round
  const plinth = roundBox(x, y, z, [0.02, 0.21, 0], [1.52, 0.21, 0.62], 0.07)

  // the body: a long barrel, heavier at the shoulder, falling to the rump
  let d = ellipsoid(x, y, z, [-0.08, 1.24, 0], [1.02, 0.5, 0.44])
  d = smin(d, ellipsoid(x, y, z, [0.52, 1.33, 0], [0.56, 0.54, 0.47]), 0.3)
  d = smin(d, ellipsoid(x, y, z, [-0.78, 1.2, 0], [0.5, 0.5, 0.43]), 0.3)
  // a flatter belly line, as the carvers left it
  d = Math.max(d, -(y - 0.86))

  // the slab between the legs: the boar never quite leaves the block
  const slab = roundBox(x, y, z, [-0.04, 0.66, 0], [0.98, 0.27, 0.19], 0.06)
  d = smin(d, slab, 0.12)

  // legs in relief, rounded, set slightly out from the slab
  for (const lx of [0.74, -0.84]) {
    const leg = cone(x, y, az, [lx, 1.0, 0.27], [lx + 0.03, 0.42, 0.25], 0.17, 0.12)
    d = smin(d, leg, 0.12)
    // the hoof, a hint of a cleft
    d = smin(d, roundBox(x, y, az, [lx + 0.06, 0.47, 0.25], [0.13, 0.06, 0.1], 0.04), 0.06)
  }

  // head and neck, lowered, tapering to the snout
  const head = cone(x, y, z, [0.86, 1.4, 0], [1.66, 1.02, 0], 0.4, 0.21)
  d = smin(d, head, 0.22)
  const jaw = ellipsoid(x, y, z, [1.3, 1.02, 0], [0.34, 0.2, 0.27])
  d = smin(d, jaw, 0.12)
  // a flat snout disc
  const snout = cone(x, y, z, [1.64, 1.02, 0], [1.84, 0.97, 0], 0.2, 0.19)
  d = smin(d, snout, 0.06)
  d = Math.max(d, x - 1.86 + (y - 1.0) * 0.12)

  // ears, laid back
  const ear = ellipsoid(x, y, az, [1.06, 1.68, 0.2], [0.13, 0.18, 0.07])
  d = smin(d, ear, 0.07)

  // the dorsal crest
  const crest = cone(x, y, z, [-0.75, 1.68, 0], [0.82, 1.86, 0], 0.07, 0.09)
  d = smin(d, crest, 0.16)

  // tail curled against the rump
  d = smin(d, cone(x, y, az, [-1.25, 1.36, 0.02], [-1.3, 1.02, 0.08], 0.06, 0.045), 0.05)

  // incisions: eyes, the line of the mouth, a tusk
  d = ssub(d, ellipsoid(x, y, az, [1.36, 1.3, 0.24], [0.06, 0.035, 0.05]), 0.02)
  d = ssub(d, cone(x, y, az, [1.82, 0.93, 0.15], [1.36, 0.94, 0.25], 0.018, 0.012), 0.015)
  d = smin(d, cone(x, y, az, [1.63, 0.96, 0.2], [1.6, 1.08, 0.22], 0.03, 0.01), 0.02)

  d = smin(d, plinth, 0.05)

  // weather: granite loses its crystals first at the edges and the top
  const w = noise3(x * 7.5, y * 7.5, z * 7.5) * 0.011 + noise3(x * 2.2 + 9, y * 2.2, z * 2.2) * 0.018
  return d + w
}
