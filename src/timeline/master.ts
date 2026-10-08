import gsap from 'gsap'
import { GALLERY_HALF, rgb, world } from './world'
import { SHOT_TIMES } from './shots'
import { beats, yearKeys } from '../content/story'
import { createHudSync } from '../ui/hud'

/**
 * Master timeline. One unit = 1% of the scroll. Everything — camera, light,
 * the section, typography — lives on this single timeline so the experience
 * reads as one continuous shot.
 */
export function buildMasterTimeline(root: HTMLElement) {
  const hud = createHudSync(root)
  const tl = gsap.timeline({
    paused: true,
    defaults: { ease: 'none' },
    onUpdate: () => {
      hud()
      root.style.setProperty('--progress', tl.totalProgress().toFixed(4))
    },
  })
  tl.set({}, {}, 100) // fix total length

  // ── camera ──────────────────────────────────────────────────────────────
  const n = SHOT_TIMES.length - 1
  for (let i = 0; i < n; i++) {
    const a = SHOT_TIMES[i], b = SHOT_TIMES[i + 1]
    // glide everywhere; ease into the first move and the holds (the square
    // seen whole — arriving 3, leaving 4 —, street level, the section drawing
    // — arriving 8, held 9, leaving 10 — and the stone)
    const ease =
      i === 0 ? 'sine.in'
      : i === 6 || i === 9 || i === 18 ? 'sine.inOut'
      : i === 3 || i === 8 || i === n - 1 ? 'sine.out'
      : i === 4 || i === 10 || i === 19 ? 'sine.in'
      : 'none'
    tl.fromTo(world, { cam: i / n }, { cam: (i + 1) / n, duration: b - a, ease, immediateRender: i === 0 }, a)
  }
  tl.to(world, { fov: 26, duration: 10, ease: 'sine.inOut' }, 8)
  tl.to(world, { fov: 44, duration: 6, ease: 'sine.inOut' }, 26) // wide at street level
  tl.to(world, { fov: 30, duration: 6, ease: 'sine.inOut' }, 40)
  tl.to(world, { fov: 46, duration: 5, ease: 'sine.inOut' }, 48) // the section, face on
  tl.to(world, { fov: 52, duration: 4, ease: 'sine.inOut' }, 56) // wide in the gallery
  tl.to(world, { fov: 40, duration: 3, ease: 'sine.inOut' }, 80) // close on the stone
  tl.to(world, { fov: 56, duration: 4, ease: 'sine.inOut' }, 87) // low over the water
  tl.to(world, { fov: 30, duration: 4, ease: 'sine.inOut' }, 93)
  tl.to(world, { fov: 25, duration: 3.5, ease: 'sine.inOut' }, 96.5) // long lens: the skyline monumental

  // ── opening veil (paper → world) ─────────────────────────────────────────
  tl.to(world, { veil: 0, duration: 6, ease: 'sine.inOut' }, 1.5)
  tl.to(world.fog, { near: 900, far: 4200, duration: 10, ease: 'sine.inOut' }, 2)
  // golden-hour air: deep enough to give the aerials their scale and to
  // dissolve the far bank where the model of the city ends
  tl.to(world.fog, { near: 420, far: 2500, duration: 10 }, 14)

  // the type turns light only once the frame behind it has darkened into stone and shadow
  tl.to(world, { ink: 1, duration: 2.6, ease: 'sine.inOut' }, 20.4)

  // ── white model → golden city ────────────────────────────────────────────
  tl.to(world, { gold: 1, duration: 12, ease: 'sine.inOut' }, 17)
  tl.to(world, { strata: 0.45, duration: 8 }, 12)

  const sun = world.sun
  tl.to(sun, { elevation: 15, azimuth: 128, intensity: 4.6, duration: 14, ease: 'sine.inOut' }, 16)
  tl.to(sun.color, { ...rgb('#ffc584'), duration: 14, ease: 'sine.inOut' }, 16)
  // golden hour as a photographer sees it: warm key, cool open-sky fill, so
  // the streets in shadow stay blue and legible instead of going to mud
  tl.to(world.hemi, { intensity: 0.86, duration: 14 }, 16)
  tl.to(world.hemi.sky, { ...rgb('#a9bbd4'), duration: 14 }, 16)
  tl.to(world.hemi.ground, { ...rgb('#9a7650'), duration: 14 }, 16)
  tl.to(world.sky.top, { ...rgb('#7f9cb6'), duration: 14, ease: 'sine.inOut' }, 14)
  tl.to(world.sky.horizon, { ...rgb('#f6d3a4'), duration: 14, ease: 'sine.inOut' }, 14)
  tl.to(world.sky, { glow: 0.6, duration: 14 }, 14)

  // ── the section ──────────────────────────────────────────────────────────
  tl.to(world, { cutGlow: 1, duration: 1.5, ease: 'sine.out' }, 45)
  tl.to(world, { cut: 1, duration: 3.5, ease: 'power2.inOut' }, 45)
  tl.to(world, { strata: 1, duration: 4 }, 46.5)
  tl.to(world, { open: GALLERY_HALF, duration: 6.5, ease: 'power3.inOut' }, 47.5)
  tl.to(world, { cutGlow: 0, duration: 3 }, 49.5)
  // the drawing: each layer annotated, then the legend clears for the descent
  tl.to(world, { legend: 1, duration: 2.6 }, 51.6)
  tl.to(world, { legend: 0, duration: 1.2 }, 56.6)

  // ── darkness: entering the ground ────────────────────────────────────────
  const dark = 56.8
  tl.to(sun, { intensity: 0, duration: 3, ease: 'sine.in' }, dark)
  tl.to(world.hemi, { intensity: 0.05, duration: 3 }, dark)
  tl.to(world.sky.top, { ...rgb('#070605'), duration: 3 }, dark)
  tl.to(world.sky.horizon, { ...rgb('#0b0907'), duration: 3 }, dark)
  tl.to(world.sky, { glow: 0, duration: 3 }, dark)
  tl.to(world.fog, { near: 50, far: 380, duration: 3 }, dark)
  tl.to(world, { capAmbient: 0.09, lamp: 1, duration: 3 }, dark)
  // exhibits light up as we reach them
  const ex = world.exhibits
  tl.to(ex, { 0: 1, duration: 2.5 }, 58.5).to(ex, { 0: 0.12, duration: 3 }, 65)
  tl.to(ex, { 1: 1, duration: 2.5 }, 65).to(ex, { 1: 0.12, duration: 3 }, 72)
  tl.to(ex, { 2: 1, duration: 2.5 }, 72).to(ex, { 2: 0.12, duration: 3 }, 79.5)
  tl.to(ex, { 3: 1, duration: 3 }, 79)
  tl.to(world, { rise: 1, duration: 2.2, ease: 'sine.inOut' }, 82)

  // ── the stone breaks open, and its light carries us to the surface ───────
  tl.to(world, { shatter: 1, duration: 2.7 }, 84.3)
  // the lantern dims: from here the light is the stone's own
  tl.to(world, { lamp: 0.03, duration: 0.6, ease: 'sine.inOut' }, 84.3)
  tl.to(world, { flash: 1, duration: 0.85, ease: 'power2.in' }, 85.9)
  tl.to(world, { flash: 0, duration: 1.5, ease: 'sine.out' }, 87.0)

  // ── sunset: back to the surface, all of it set while the screen is light ─
  const up = 86.7
  const now = 0.2
  tl.set(sun, { elevation: 6, azimuth: 150 }, up)
  tl.to(sun, { intensity: 4.4, duration: now }, up)
  tl.to(sun.color, { ...rgb('#ffa05a'), duration: now }, up)
  tl.to(world.hemi, { intensity: 0.72, duration: now }, up)
  tl.to(world.hemi.sky, { ...rgb('#8088ab'), duration: now }, up)
  tl.to(world.hemi.ground, { ...rgb('#8a5a3a'), duration: now }, up)
  tl.to(world.sky.top, { ...rgb('#2a3352'), duration: now }, up)
  tl.to(world.sky.horizon, { ...rgb('#f3a862'), duration: now }, up)
  tl.to(world.sky, { glow: 1, duration: now }, up)
  // evening air: enough haze to set the cathedral back from the river and to
  // dissolve the far edge of the city into the sky in the closing shot
  tl.to(world.fog, { near: 550, far: 3200, duration: now }, up)
  tl.to(world.fog, { near: 600, far: 3000, duration: 4, ease: 'sine.inOut' }, 96)
  tl.to(world, { capAmbient: 0.75, lamp: 0, open: 0, duration: now }, up)
  tl.to(world, { reflect: 1, duration: now }, up)
  tl.to(world, { reflect: 0, duration: 2.5, ease: 'sine.in' }, 96.8) // rising away from the water
  tl.to(ex, { 3: 0, duration: now }, up)
  tl.to(world, { dusk: 1, duration: 7, ease: 'sine.in' }, 93)
  tl.to(sun, { elevation: 3, intensity: 3.6, duration: 6 }, 94)

  // ── year readout ─────────────────────────────────────────────────────────
  for (let i = 0; i < yearKeys.length - 1; i++) {
    const [a, ya] = yearKeys[i]
    const [b, yb] = yearKeys[i + 1]
    if (ya === yb) continue
    tl.fromTo(world, { year: ya }, { year: yb, duration: b - a, ease: 'sine.inOut', immediateRender: false }, a)
  }

  // ── typography ───────────────────────────────────────────────────────────
  const intro = root.querySelectorAll('[data-intro] .line > span')
  tl.to(intro, { yPercent: -110, duration: 2.4, stagger: 0.25, ease: 'power2.in' }, 0.6)
  tl.to(root.querySelector('[data-hint]'), { autoAlpha: 0, duration: 1 }, 0.4)
  tl.set(root.querySelector('[data-intro]'), { autoAlpha: 0 }, 3.8)

  gsap.set(root.querySelectorAll('[data-beat] .line > span'), { yPercent: 115 })
  for (const beat of beats) {
    const el = root.querySelector(`[data-beat="${beat.id}"]`)
    if (!el) continue
    const lines = el.querySelectorAll('.line > span')
    const dur = beat.out - beat.in
    tl.set(el, { autoAlpha: 1 }, beat.in)
    tl.fromTo(lines, { yPercent: 115 }, { yPercent: 0, duration: Math.min(2.2, dur * 0.3), stagger: 0.28, ease: 'power3.out', immediateRender: false }, beat.in)
    if (beat.out > 100) continue // the last words stay on screen
    tl.to(lines, { yPercent: -115, duration: Math.min(1.8, dur * 0.25), stagger: 0.12, ease: 'power2.in' }, beat.out - Math.min(1.8, dur * 0.25) - 0.3)
    tl.set(el, { autoAlpha: 0 }, beat.out)
  }

  return tl
}
