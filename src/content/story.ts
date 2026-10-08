/**
 * Editorial copy for the opening chapter, "The Descent".
 *
 * `in` / `out` are positions on the master timeline (0–100 = full scroll).
 * Placement is deliberately sparse: the city is the interface, text is a caption.
 */
export type BeatPlacement = 'center' | 'top' | 'left' | 'right' | 'low-left' | 'low-right'

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
    body: ['Eighty-eight arches by Alberto de Churriguera.', 'Every evening, the whole city still comes here to meet.'],
  },
  {
    id: 'golden',
    in: 30.5,
    out: 39,
    placement: 'top',
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
    in: 44,
    out: 51.5,
    placement: 'right',
    title: ['Beneath every street,', 'another city.'],
    body: ['Salamanca stands on everything it has ever been.'],
  },
  {
    id: 'medieval',
    in: 59,
    out: 64.5,
    placement: 'low-left',
    eyebrow: 'XII — XV c.',
    title: ['Within the walls'],
    body: ['Resettled in 1102 by Raymond of Burgundy,', 'the city closed itself inside two rings of stone.'],
  },
  {
    id: 'university',
    in: 64.5,
    out: 67.8,
    // above the vanishing point: the gallery walls carry their own labels
    placement: 'top',
    eyebrow: '1218',
    body: [
      'Alfonso IX of León founds a university. It has never closed.',
      'Back from four years in an Inquisition cell, Fray Luis de León',
      'began his lecture: “As we were saying yesterday…”',
    ],
  },
  {
    id: 'roman',
    in: 68.2,
    out: 73.5,
    placement: 'low-left',
    eyebrow: 'I c. AD',
    title: ['Salmantica'],
    body: ['A stop on the Vía de la Plata, the road from Mérida to Astorga.', 'Soldiers, traders and letters walked these stones.'],
  },
  {
    id: 'vettones',
    in: 74.5,
    out: 79.5,
    placement: 'right',
    eyebrow: '220 BC',
    title: ['Helmantica'],
    body: ['A Vetton hill-fort above the Tormes, besieged by Hannibal.', 'Its guardians were carved in granite: the verracos.'],
  },
  {
    id: 'bedrock',
    in: 80.5,
    out: 84.9,
    placement: 'low-left',
    eyebrow: 'Beneath it all',
    title: ['The stone itself.'],
    body: ['Forty million years of golden sand,', 'waiting to become a city.'],
  },
  {
    id: 'bridge',
    in: 89.4,
    out: 93.3,
    placement: 'low-left',
    eyebrow: 'I c. AD',
    title: ['Puente Romano'],
    body: ['Fifteen of its twenty-six arches are Roman.', 'For two thousand years it has carried the city across the Tormes.'],
  },
  {
    // the postcard: the cathedral over the river, the moment the whole film was layering towards
    id: 'cathedral',
    in: 95.6,
    out: 99.3,
    placement: 'top',
    eyebrow: 'XII c. · 1513 — 1733',
    title: ['Two Cathedrals'],
    body: [
      'When Salamanca outgrew its Romanesque cathedral, it did not tear it down.',
      'It built the new one against its walls, and kept both.',
      'Even its faith was built in layers.',
    ],
  },
  {
    id: 'archive',
    in: 99.5,
    out: 101,
    // in the sky, above the skyline it names
    placement: 'top',
    display: true,
    eyebrow: '2026',
    title: ['Salamanca'],
    body: ['Two thousand years in the same golden stone —', 'and still being written.'],
  },
]

/** Stops on the progress line — hover to read, click to travel. */
export const chapters: { at: number; label: string }[] = [
  { at: 0, label: 'Salamanca' },
  { at: 22, label: 'Plaza Mayor' },
  { at: 31, label: 'The Golden City' },
  { at: 45, label: 'The section' },
  { at: 59.5, label: 'Medieval' },
  { at: 68.5, label: 'Roman' },
  { at: 75, label: 'Iron Age' },
  { at: 81.5, label: 'The stone' },
  { at: 89.5, label: 'The Tormes' },
  { at: 97.4, label: 'The Cathedrals' },
  { at: 100, label: '2026' },
]

/** Year readout keyframes (timeline position → year). Negative = BC. */
export const yearKeys: [number, number][] = [
  [0, 2026],
  [18, 2026],
  [24, 1755],
  [40, 1755],
  [46, 2026],
  [56, 2026],
  // each date holds while its caption is read, then the years run on
  [60.2, 1102],
  [63.6, 1102],
  [65.2, 1218],
  [67.6, 1218],
  [69.4, 100],
  [73.4, 100],
  [75.6, -220],
  [78.8, -220],
  [79.8, -400],
  [81, -40_000_000],
  [86.7, -40_000_000],
  [86.75, 100], // through the light, straight to Roman Salmantica
  [92.6, 100],
  // through the arch the years run on to the cathedral's last stone
  [95.4, 1733],
  [99.1, 1733],
  [99.9, 2026],
]

export function formatYear(y: number): string {
  if (y < -100_000) return 'c. 40 million years ago'
  const r = Math.round(y)
  if (r <= 0) return `${Math.max(1, -r).toLocaleString('en-GB')} BC`
  if (r < 1000) return `AD ${r}`
  return String(r)
}
