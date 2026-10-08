import { Plane, Vector3, Vector4 } from 'three'
import { makeCapMaterial, makeSectionMaterial, makeStencilMaterials, type Half } from './section'

/**
 * The material palette of one half of the city. White model → golden city is
 * expressed per material as a (base, gold) pair; the timeline only moves uGold.
 */
export function makePalette(half: Half, order: number) {
  return {
    buildings: makeSectionMaterial({ half, base: '#f2efe9', gold: '#d6a96f', roof: '#9d634b', vertexColors: true }),
    ground: makeSectionMaterial({ half, kind: 'ground', base: '#ebe7df', gold: '#b39b78', roughness: 1 }),
    water: makeSectionMaterial({ half, kind: 'water', base: '#dfe2e0', gold: '#33464d', roughness: 0.35 }),
    /** Villamayor sandstone with coursing — landmarks */
    sandstone: makeSectionMaterial({ half, kind: 'stone', base: '#f4f1eb', gold: '#dcaa68', roof: '#9d634b', ashlar: 0.55 }),
    /** plain sandstone (mouldings, small parts) */
    sandstonePlain: makeSectionMaterial({ half, kind: 'stone', base: '#f4f1eb', gold: '#e2b475', roof: '#e2b475' }),
    /** cathedral stone: same quarry, with lead-grey roofs */
    cathedral: makeSectionMaterial({ half, kind: 'stone', base: '#f5f2ec', gold: '#ddae70', roof: '#9a8874', ashlar: 0.45 }),
    roof: makeSectionMaterial({ half, kind: 'stone', base: '#f0ece5', gold: '#9d634b', roof: '#9d634b', tiles: true }),
    /** the bridge: granite and sandstone, greyer and older */
    granite: makeSectionMaterial({ half, kind: 'stone', base: '#f1eee8', gold: '#bba182', roof: '#c1a888', ashlar: 0.6, baseY: -22 }),
    paving: makeSectionMaterial({ half, kind: 'plaza', base: '#ece8e1', gold: '#cdb898', roughness: 0.86 }),
    /** wrought iron: balconies and railings, cut out of a single panel */
    iron: makeSectionMaterial({ half, kind: 'iron', base: '#d4cfc6', gold: '#2b2420', roughness: 0.55, metalness: 0.35, doubleSided: true, alphaToCoverage: true }),
    /** people: white figurines in the model, dressed in the golden city */
    figure: makeSectionMaterial({ half, kind: 'figure', base: '#f3f0ea', gold: '#5a5048', roughness: 0.9, vertexColors: true }),
    /** window voids, ironwork: invisible in the white model, deep in the golden one */
    dark: makeSectionMaterial({ half, kind: 'stone', base: '#d9d4cb', gold: '#33261d', roof: '#33261d', roughness: 0.6 }),
    foliage: makeSectionMaterial({ half, kind: 'foliage', base: '#f0eee8', gold: '#5c6a3c', roof: '#76814a', roughness: 1 }),
    trunk: makeSectionMaterial({ half, kind: 'stone', base: '#e6e2da', gold: '#4a3a2c', roof: '#4a3a2c', roughness: 1 }),
    cap: makeCapMaterial(half),
    stencil: makeStencilMaterials(half, order),
  }
}

export type Palette = ReturnType<typeof makePalette>
export type PaletteKey = Exclude<keyof Palette, 'cap' | 'stencil'>

/** A pseudo-half that never clips: for the exhibits floating in the section. */
export const freeHalf: Half = {
  side: 1,
  plane: new Plane(new Vector3(1, 0, 0), 1e7),
  uPlane: { value: new Vector4(1, 0, 0, 1e7) },
  uOffset: { value: 0 },
}
