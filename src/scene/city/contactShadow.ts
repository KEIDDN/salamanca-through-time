import { CanvasTexture, LinearFilter } from 'three'
import type { CityData } from '../lib/cityData'

/**
 * Baked ambient occlusion for the ground: every footprint drawn top-down and
 * blurred, so streets darken softly where they meet the buildings. Replaces a
 * screen-space AO pass at a fraction of the cost.
 */
export function bakeContactShadow(data: CityData, metresPerPixel = 1.25) {
  const { x0, x1, z0, z1 } = data.slab
  const W = Math.round((x1 - x0) / metresPerPixel)
  const H = Math.round((z1 - z0) / metresPerPixel)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#fff'
  const px = (x: number) => (x - x0) / metresPerPixel
  const pz = (z: number) => (z - z0) / metresPerPixel
  const ring = (flat: number[] | [number, number][]) => {
    const pts = Array.isArray(flat[0]) ? (flat as [number, number][]) : pairs(flat as number[])
    pts.forEach(([x, z], i) => (i ? ctx.lineTo(px(x), pz(z)) : ctx.moveTo(px(x), pz(z))))
    ctx.closePath()
  }
  for (const b of data.buildings) {
    ctx.beginPath()
    ring(b.p)
    b.holes?.forEach((h) => ring(h))
    ctx.fill('evenodd')
  }
  for (const r of [data.cathedral.nuevo, data.cathedral.viejo]) {
    ctx.beginPath()
    ring(r)
    ctx.fill()
  }
  // Plaza Mayor ranges: a square ring around the paving
  {
    const { cx, cz, angle, w, d } = data.plaza.rect
    ctx.save()
    ctx.translate(px(cx), pz(cz))
    ctx.rotate(angle)
    const s = 1 / metresPerPixel
    ctx.beginPath()
    ctx.rect((-w / 2 - 16) * s, (-d / 2 - 16) * s, (w + 32) * s, (d + 32) * s)
    ctx.rect((-w / 2) * s, (-d / 2) * s, w * s, d * s)
    ctx.fill('evenodd')
    ctx.restore()
  }

  // occlusion = blurred coverage, kept only outside the footprints
  const img = ctx.getImageData(0, 0, W, H)
  const cover = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) cover[i] = img.data[i * 4] / 255
  const blurred = boxBlur(boxBlur(cover, W, H, 3), W, H, 3)
  for (let i = 0; i < W * H; i++) {
    const v = Math.min(1, blurred[i] * 1.6) * (1 - cover[i] * 0.85)
    const c = Math.round(v * 255)
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = c
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)

  const tex = new CanvasTexture(canvas)
  tex.flipY = false
  tex.minFilter = LinearFilter
  tex.magFilter = LinearFilter
  tex.generateMipmaps = false
  return tex
}

function pairs(flat: number[]) {
  const out: [number, number][] = []
  for (let i = 0; i < flat.length; i += 2) out.push([flat[i], flat[i + 1]])
  return out
}

/** Separable box blur, radius r pixels. */
function boxBlur(src: Float32Array, W: number, H: number, r: number) {
  const tmp = new Float32Array(W * H)
  const out = new Float32Array(W * H)
  const n = 2 * r + 1
  for (let y = 0; y < H; y++) {
    let acc = 0
    const row = y * W
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(W - 1, Math.max(0, x))]
    for (let x = 0; x < W; x++) {
      tmp[row + x] = acc / n
      acc += src[row + Math.min(W - 1, x + r + 1)] - src[row + Math.max(0, x - r)]
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(H - 1, Math.max(0, y)) * W + x]
    for (let y = 0; y < H; y++) {
      out[y * W + x] = acc / n
      acc += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x]
    }
  }
  return out
}
