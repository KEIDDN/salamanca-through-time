import { BoxGeometry, BufferGeometry, Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Collects transformed geometry pieces per material key and bakes them into
 * one merged geometry per key — a whole landmark costs a handful of draw calls.
 */
export class Parts<K extends string = string> {
  private pieces = new Map<K, BufferGeometry[]>()
  private stack: Matrix4[] = [new Matrix4()]

  get matrix() {
    return this.stack[this.stack.length - 1]
  }

  /** Run `fn` inside a local frame. */
  frame(m: Matrix4, fn: () => void) {
    this.stack.push(this.matrix.clone().multiply(m))
    fn()
    this.stack.pop()
  }

  add(key: K, g: BufferGeometry, m?: Matrix4) {
    const geo = g.index ? g.toNonIndexed() : g.clone()
    if (geo.getAttribute('uv')) geo.deleteAttribute('uv')
    if (geo.getAttribute('uv1')) geo.deleteAttribute('uv1')
    const world = m ? this.matrix.clone().multiply(m) : this.matrix
    geo.applyMatrix4(world)
    if (!this.pieces.has(key)) this.pieces.set(key, [])
    this.pieces.get(key)!.push(geo)
    return this
  }

  /** Axis-aligned box given by its min/max corners in the current frame. */
  box(key: K, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const g = new BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0))
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    this.add(key, g)
    g.dispose()
    return this
  }

  build(): Partial<Record<K, BufferGeometry>> {
    const out: Partial<Record<K, BufferGeometry>> = {}
    for (const [k, list] of this.pieces) {
      out[k] = mergeGeometries(list, false)
      out[k]!.computeBoundingSphere()
      list.forEach((g) => g.dispose())
    }
    return out
  }
}

export const T = (x = 0, y = 0, z = 0, ry = 0, s: number | [number, number, number] = 1, rx = 0, rz = 0) =>
  new Matrix4().compose(
    new Vector3(x, y, z),
    new Quaternion().setFromEuler(new Euler(rx, ry, rz)),
    Array.isArray(s) ? new Vector3(...s) : new Vector3(s, s, s),
  )
