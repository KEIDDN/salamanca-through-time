/**
 * Editorial copy for the opening chapter, "The Descent".
 *
 * `in` / `out` are positions on the master timeline (0–100 = full scroll).
 * Placement is deliberately sparse: the city is the interface, text is a caption.
 */
export type BeatPlacement = 'center' | 'left' | 'right' | 'low-left' | 'low-right'

export type Beat = {
  id: string
  in: number
  out: number
  placement: BeatPlacement
  eyebrow?: string
  title?: string[]
  body?: string[]
  /** larger title treatment for the key moments */
  display?: boolean
}

export const beats: Beat[] = [
  {
    id: 'layered',
    in: 6.5,
    out: 15,
    placement: 'center',
    eyebrow: '40.965° N · 5.664° W',
    title: ['Some cities are built.', 'This one was layered.'],
  },
  {
    id: 'plaza',
    in: 21,
    out: 28,
    placement: 'low-left',
    eyebrow: '1729 — 1755',
    title: ['Plaza Mayor'],
    body: ['Eighty-eight arches by Alberto de Churriguera.', 'The living room of the city.'],
  },
  {
    id: 'golden',
    in: 30.5,
    out: 39,
    placement: 'center',
    display: true,
    eyebrow: 'Villamayor sandstone',
    title: ['The Golden City'],
    body: [
      'Soft when quarried, it hardens in the open air.',
      'Its iron slowly oxidises — and the city turns to gold.',
    ],
  },
  {
    id: 'beneath',
    in: 43.5,
    out: 52,
    placement: 'right',
    title: ['Beneath every street,', 'another city.'],
    body: ['Salamanca is built on top of its own history.'],
  },
  {
    id: 'medieval',
    in: 57.5,
    out: 63.5,
    placement: 'low-left',
    eyebrow: 'XII — XV c.',
    title: ['Within the walls'],
    body: ['Resettled in 1102 by Raymond of Burgundy,', 'the city closed itself inside two rings of stone.'],
  },
  {
    id: 'university',
    in: 63.5,
    out: 67,
    placement: 'right',
    eyebrow: '1218',
    body: ['Alfonso IX of León founds a university here.', 'It has not stopped teaching since.'],
  },
  {
    id: 'roman',
    in: 67.5,
    out: 73.5,
    placement: 'low-left',
    eyebrow: 'I c. AD',
    title: ['Salmantica'],
    body: ['A station on the Vía de la Plata —', 'the Roman road from Emerita Augusta to Asturica.'],
  },
  {
    id: 'vettones',
    in: 74.5,
    out: 80,
    placement: 'right',
    eyebrow: '220 BC',
    title: ['Helmantica'],
    body: ['A Vetton hill-fort above the Tormes, besieged by Hannibal.', 'Its guardians were carved in granite: the verracos.'],
  },
  {
    id: 'bedrock',
    in: 81,
    out: 86.5,
    placement: 'center',
    eyebrow: 'Beneath it all',
    title: ['The stone itself.'],
    body: ['Forty million years of golden sand,', 'waiting to become a city.'],
  },
  {
    id: 'bridge',
    in: 92,
    out: 97.2,
    placement: 'low-left',
    eyebrow: 'I c. AD',
    title: ['Puente Romano'],
    body: ['Fifteen of its twenty-six arches are Roman.', 'Two thousand years, still carrying the city across the river.'],
  },
  {
    id: 'archive',
    in: 97.6,
    out: 101,
    placement: 'center',
    display: true,
    eyebrow: '2026',
    title: ['Salamanca'],
    body: ['More than a city. A living archive.'],
  },
]

/** Year readout keyframes (timeline position → year). Negative = BC. */
export const yearKeys: [number, number][] = [
  [0, 2026],
  [18, 2026],
  [24, 1755],
  [40, 1755],
  [46, 2026],
  [55, 2026],
  [60, 1102],
  [65, 1218],
  [68, 100],
  [75, -220],
  [80, -400],
  [83, -40_000_000],
  [86, -40_000_000],
  [92, 100],
  [96, 2026],
]

export function formatYear(y: number): string {
  if (y < -100_000) return 'c. 40 million years ago'
  const r = Math.round(y)
  if (r <= 0) return `${Math.max(1, -r).toLocaleString('en-GB')} BC`
  if (r < 1000) return `AD ${r}`
  return String(r)
}
