import { Plane, Vector3, Vector4 } from 'three'
import { makeSectionMaterial, type Half } from './section'

/**
 * The material palette of one half of the city. White model → golden city is
 * expressed per material as a (base, gold) pair; the timeline only moves uGold.
 */
export function makePalette(half: Half, slabClip: Plane[]) {
  return {
    buildings: makeSectionMaterial({ half, base: '#f2efe9', gold: '#d2a46a', roof: '#a4654a', vertexColors: true }),
    ground: makeSectionMaterial({ half, kind: 'ground', base: '#ebe7df', gold: '#a48c6c', roughness: 1 }),
    water: makeSectionMaterial({ half, kind: 'water', base: '#dfe2e0', gold: '#3c4f57', roughness: 0.42, extraClip: slabClip }),
    /** Villamayor sandstone with coursing — landmarks */
    sandstone: makeSectionMaterial({ half, kind: 'stone', base: '#f4f1eb', gold: '#d6a565', roof: '#a85b3d', ashlar: 0.55 }),
    /** plain sandstone (small parts where coursing would read as noise) */
    sandstonePlain: makeSectionMaterial({ half, kind: 'stone', base: '#f4f1eb', gold: '#dcac6c', roof: '#dcac6c' }),
    /** cathedral stone: same quarry, slightly paler and with lead-grey roofs */
    cathedral: makeSectionMaterial({ half, kind: 'stone', base: '#f5f2ec', gold: '#dbac6f', roof: '#7d6a58', ashlar: 0.45 }),
    roof: makeSectionMaterial({ half, kind: 'stone', base: '#f0ece5', gold: '#a65a3c', roof: '#a65a3c' }),
    granite: makeSectionMaterial({ half, kind: 'stone', base: '#f1eee8', gold: '#b59c7a', roof: '#b59c7a', ashlar: 0.5 }),
    paving: makeSectionMaterial({ half, kind: 'stone', base: '#efebe4', gold: '#d3bb98', roof: '#d3bb98', ashlar: 0.3 }),
    /** window voids, ironwork: invisible in the white model, deep in the golden one */
    dark: makeSectionMaterial({ half, kind: 'stone', base: '#d9d4cb', gold: '#34271e', roof: '#34271e', roughness: 0.6 }),
  }
}

export type Palette = ReturnType<typeof makePalette>

/** A pseudo-half that never clips: for the exhibits floating in the section. */
export const freeHalf: Half = {
  side: 1,
  plane: new Plane(new Vector3(1, 0, 0), 1e7),
  uPlane: { value: new Vector4(1, 0, 0, 1e7) },
}
