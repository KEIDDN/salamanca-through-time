import { ExtrudeGeometry, Path, Shape, Vector2 } from 'three'

/**
 * A wall pierced by a row of round arches that reach the ground: drawn as a
 * single comb-shaped outline (no holes), so it triangulates cleanly.
 */
export function arcadeWall(opts: {
  length: number
  height: number
  bays: number
  pier: number
  spring: number
  thickness: number
  segments?: number
}) {
  const { length: L, height: H, bays, pier, spring, thickness } = opts
  const seg = opts.segments ?? 10
  const B = L / bays
  const ow = (B - pier) / 2
  const pts: Vector2[] = [new Vector2(-L / 2, 0)]
  for (let i = 0; i < bays; i++) {
    const xc = -L / 2 + B * (i + 0.5)
    pts.push(new Vector2(xc - ow, 0), new Vector2(xc - ow, spring))
    for (let k = 1; k < seg; k++) {
      const a = Math.PI - (k / seg) * Math.PI
      pts.push(new Vector2(xc + ow * Math.cos(a), spring + ow * Math.sin(a)))
    }
    pts.push(new Vector2(xc + ow, spring), new Vector2(xc + ow, 0))
  }
  pts.push(new Vector2(L / 2, 0), new Vector2(L / 2, H), new Vector2(-L / 2, H))
  const g = new ExtrudeGeometry(new Shape(pts), { depth: thickness, bevelEnabled: false })
  g.translate(0, 0, -thickness)
  return g
}

/** Round-headed opening path, centred on x, sill at y0. */
export function archHole(x: number, y0: number, width: number, spring: number, seg = 10) {
  const r = width / 2
  const p = new Path()
  p.moveTo(x - r, y0)
  p.lineTo(x + r, y0)
  p.lineTo(x + r, spring)
  for (let k = 1; k <= seg; k++) {
    const a = (k / seg) * Math.PI
    p.lineTo(x + r * Math.cos(a), spring + r * Math.sin(a))
  }
  p.lineTo(x - r, y0)
  return p
}

export function extrudeShape(shape: Shape, depth: number) {
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 12 })
  g.translate(0, 0, -depth / 2)
  return g
}

/**
 * The band between two arch outlines that share their base line (an
 * archivolt, a hood mould): a single ∩-shaped polygon, so it triangulates
 * cleanly. Outlines start with their two base corners, left then right.
 */
export function archBand(outer: Vector2[], inner: Vector2[]) {
  return new Shape([...outer.slice(1), outer[0], inner[0], ...inner.slice(1).reverse()])
}
