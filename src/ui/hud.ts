import { formatYear } from '../content/story'
import { world } from '../timeline/world'

/**
 * Mirrors the timeline state into the DOM (year readout, opening veil, the
 * light out of the stone, ink colour). Called from the master timeline's onUpdate, so it only runs while
 * the film is actually moving.
 */
export function createHudSync(root: HTMLElement) {
  const year = root.querySelector<HTMLElement>('[data-year]')
  const veil = root.querySelector<HTMLElement>('[data-veil]')
  const flash = root.querySelector<HTMLElement>('[data-flash]')
  const doc = document.documentElement
  let lastYear = ''
  let lastVeil = -1
  let lastInk = -1
  let lastFlash = -1
  return () => {
    const y = formatYear(world.year)
    if (y !== lastYear && year) {
      year.textContent = y
      lastYear = y
    }
    if (veil && Math.abs(world.veil - lastVeil) > 0.001) {
      veil.style.opacity = world.veil.toFixed(3)
      veil.style.visibility = world.veil < 0.002 ? 'hidden' : 'visible'
      lastVeil = world.veil
    }
    if (flash && Math.abs(world.flash - lastFlash) > 0.001) {
      flash.style.opacity = world.flash.toFixed(3)
      flash.style.visibility = world.flash < 0.002 ? 'hidden' : 'visible'
      lastFlash = world.flash
    }
    if (Math.abs(world.ink - lastInk) > 0.002) {
      doc.style.setProperty('--ink-mix', world.ink.toFixed(3))
      lastInk = world.ink
    }
  }
}
