import gsap from 'gsap'
import { rgb, world } from './world'
import { SHOT_TIMES } from './shots'
import { beats, yearKeys } from '../content/story'
import { createHudSync } from '../ui/hud'

/**
 * Master timeline. One unit = 1% of the scroll. Everything — camera, light,
 * the section, typography — lives on this single timeline so the experience
 * reads as one continuous shot.
 */
export function buildMasterTimeline(root: HTMLElement) {
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' }, onUpdate: createHudSync(root) })
  tl.set({}, {}, 100) // fix total length

  // ── camera ──────────────────────────────────────────────────────────────
  const n = SHOT_TIMES.length - 1
  for (let i = 0; i < n; i++) {
    const a = SHOT_TIMES[i], b = SHOT_TIMES[i + 1]
    // ease into the first move and the street-level hold, glide everywhere else
    const ease = i === 0 ? 'sine.in' : i === 5 ? 'sine.inOut' : i === n - 1 ? 'sine.out' : 'none'
    tl.fromTo(world, { cam: i / n }, { cam: (i + 1) / n, duration: b - a, ease, immediateRender: i === 0 }, a)
  }
  tl.to(world, { fov: 26, duration: 10, ease: 'sine.inOut' }, 8)
  tl.to(world, { fov: 44, duration: 6, ease: 'sine.inOut' }, 26) // wide at street level
  tl.to(world, { fov: 30, duration: 6, ease: 'sine.inOut' }, 40)
  tl.to(world, { fov: 52, duration: 4, ease: 'sine.inOut' }, 54) // wide in the section
  tl.to(world, { fov: 34, duration: 4, ease: 'sine.inOut' }, 88)
  tl.to(world, { fov: 28, duration: 5, ease: 'sine.inOut' }, 95)

  // ── opening veil (paper → world) ─────────────────────────────────────────
  tl.to(world, { veil: 0, duration: 6, ease: 'sine.inOut' }, 1.5)
  tl.to(world.fog, { near: 900, far: 4200, duration: 10, ease: 'sine.inOut' }, 2)
  tl.to(world.fog, { near: 500, far: 3200, duration: 10 }, 14)

  tl.to(world, { ink: 1, duration: 3, ease: 'sine.inOut' }, 19)

  // ── white model → golden city ────────────────────────────────────────────
  tl.to(world, { gold: 1, duration: 12, ease: 'sine.inOut' }, 17)
  tl.to(world, { strata: 0.45, duration: 8 }, 12)
  tl.to(world, { tilt: 0.55, duration: 5, ease: 'sine.inOut' }, 5)
  tl.to(world, { tilt: 0, duration: 6, ease: 'sine.inOut' }, 20)

  const sun = world.sun
  tl.to(sun, { elevation: 15, azimuth: 128, intensity: 4.6, duration: 14, ease: 'sine.inOut' }, 16)
  tl.to(sun.color, { ...rgb('#ffc584'), duration: 14, ease: 'sine.inOut' }, 16)
  tl.to(world.hemi, { intensity: 0.6, duration: 14 }, 16)
  tl.to(world.hemi.sky, { ...rgb('#cfd8de'), duration: 14 }, 16)
  tl.to(world.hemi.ground, { ...rgb('#a88a64'), duration: 14 }, 16)
  tl.to(world.sky.top, { ...rgb('#7f9cb6'), duration: 14, ease: 'sine.inOut' }, 14)
  tl.to(world.sky.horizon, { ...rgb('#f6d3a4'), duration: 14, ease: 'sine.inOut' }, 14)
  tl.to(world.sky, { glow: 0.6, duration: 14 }, 14)

  // ── the section ──────────────────────────────────────────────────────────
  tl.to(world, { cutGlow: 1, duration: 1.5, ease: 'sine.out' }, 45.5)
  tl.to(world, { cut: 1, duration: 3.5, ease: 'power2.inOut' }, 45.5)
  tl.to(world, { strata: 1, duration: 4 }, 47)
  tl.to(world, { open: 46, duration: 6.5, ease: 'power3.inOut' }, 48.5)
  tl.to(world, { cutGlow: 0, duration: 3 }, 50)

  // ── darkness: entering the ground ────────────────────────────────────────
  const dark = 55.2
  tl.to(sun, { intensity: 0, duration: 3, ease: 'sine.in' }, dark)
  tl.to(world.hemi, { intensity: 0.04, duration: 3 }, dark)
  tl.to(world.sky.top, { ...rgb('#070605'), duration: 3 }, dark)
  tl.to(world.sky.horizon, { ...rgb('#0b0907'), duration: 3 }, dark)
  tl.to(world.sky, { glow: 0, duration: 3 }, dark)
  tl.to(world.fog, { near: 40, far: 330, duration: 3 }, dark)
  tl.to(world, { capAmbient: 0.07, lamp: 1, duration: 3 }, dark)
  // exhibits light up as we reach them
  const ex = world.exhibits
  tl.to(ex, { 0: 1, duration: 2.5 }, 57.5).to(ex, { 0: 0.15, duration: 3 }, 65)
  tl.to(ex, { 1: 1, duration: 2.5 }, 64.5).to(ex, { 1: 0.15, duration: 3 }, 72)
  tl.to(ex, { 2: 1, duration: 2.5 }, 71.5).to(ex, { 2: 0.15, duration: 3 }, 80)
  tl.to(ex, { 3: 1, duration: 3 }, 79)
  tl.to(world, { rise: 1, duration: 8, ease: 'sine.inOut' }, 82)

  // ── sunset: back to the surface ──────────────────────────────────────────
  const up = 86.5
  tl.set(sun, { elevation: 7, azimuth: 146 }, up)
  tl.to(sun, { intensity: 4.2, duration: 4, ease: 'sine.out' }, up)
  tl.to(sun.color, { ...rgb('#ff9d55'), duration: 0.01 }, up)
  tl.to(world.hemi, { intensity: 0.55, duration: 4 }, up)
  tl.to(world.hemi.sky, { ...rgb('#7d86a8'), duration: 4 }, up)
  tl.to(world.hemi.ground, { ...rgb('#8a5a3a'), duration: 4 }, up)
  tl.to(world.sky.top, { ...rgb('#2d3554'), duration: 4.5 }, up)
  tl.to(world.sky.horizon, { ...rgb('#f0a565'), duration: 4.5 }, up)
  tl.to(world.sky, { glow: 1, duration: 5 }, up)
  tl.to(world.fog, { near: 600, far: 3800, duration: 4.5 }, up)
  tl.to(world, { capAmbient: 0.7, lamp: 0, duration: 4 }, up)
  tl.to(ex, { 3: 0, duration: 3 }, up + 1)
  tl.to(world, { open: 0, duration: 5.5, ease: 'power3.inOut' }, 89.5)
  tl.to(world, { tilt: 0.35, duration: 5, ease: 'sine.inOut' }, 95)
  tl.to(sun, { elevation: 4, duration: 5 }, 95)

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
