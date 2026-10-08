import { Color } from 'three'

/**
 * The single animatable state of the experience.
 *
 * The scroll-driven GSAP timeline writes into this object; the Three.js scene
 * and the HUD read from it every frame. Nothing else owns time.
 */
export type RGB = { r: number; g: number; b: number }

export const rgb = (hex: string): RGB => {
  const c = new Color(hex)
  return { r: c.r, g: c.g, b: c.b }
}

/** Half-width of the gallery once the city is fully open (the widest `open`). */
export const GALLERY_HALF = 46

export const world = {
  /** 0 → 1 along the camera path */
  cam: 0,
  fov: 30,

  /** white architectural model → Villamayor sandstone & terracotta */
  gold: 0,
  /** how much the block sides reveal their archaeological strata */
  strata: 0.15,

  sun: { intensity: 2.6, elevation: 62, azimuth: 70, color: rgb('#fffaf2') },
  hemi: { intensity: 1.15, sky: rgb('#f6f3ee'), ground: rgb('#d9d2c6') },
  sky: { top: rgb('#f1eee8'), horizon: rgb('#ebe6dd'), glow: 0 },
  fog: { near: 2200, far: 3600 },

  /** the section: line drawing (0→1), glow, and half-separation in metres */
  cut: 0,
  cutGlow: 0,
  open: 0,

  /** light inside the section */
  capAmbient: 1,
  lamp: 0,
  exhibits: [0, 0, 0, 0] as [number, number, number, number],
  /** the hero stone turning as we leave it */
  rise: 0,
  /** the hero stone breaking open (0 whole → 1 scattered) */
  shatter: 0,
  /** the light that pours out of it, filling the screen */
  flash: 0,
  /** the section legend (architectural drawing moment) */
  legend: 0,
  /** windows lighting up after sunset */
  dusk: 0,

  exposure: 1.05,

  /** HUD */
  year: 2026,
  veil: 1,
  /** 0 = dark ink on paper, 1 = light type over the film */
  ink: 0,
}

export type World = typeof world
