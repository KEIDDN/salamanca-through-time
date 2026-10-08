import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Vector3 } from 'three'
import type { CityData } from '../lib/cityData'
import { cathedralTowers } from './cathedral'
import { world } from '../../timeline/world'

/**
 * The two cathedrals named where they stand, as on an architect's drawing: a
 * hairline rises from each tower to its name — so the story the words tell
 * (the new one built against the old) can be seen, not just read.
 */
export function CathedralLabels({ data }: { data: CityData }) {
  const { bell, gallo } = useMemo(() => cathedralTowers(data), [data])
  const items = useMemo(
    () => [
      { key: 'nueva', at: bell.clone().setY(93), rise: 26, name: 'New Cathedral', era: '1513 — 1733', delay: 0 },
      { key: 'vieja', at: gallo.clone().setY(39.5), rise: 64, name: 'Old Cathedral', era: 'XII c.', delay: 0.25 },
    ],
    [bell, gallo],
  )
  return (
    <>
      {items.map(({ key, ...it }) => (
        <Label key={key} {...it} />
      ))}
    </>
  )
}

function Label({ at, rise, name, era, delay }: { at: Vector3; rise: number; name: string; era: string; delay: number }) {
  const el = useRef<HTMLDivElement>(null)
  useFrame(() => {
    const t = Math.min(Math.max((world.cathLabels - delay) / (1 - delay), 0), 1)
    if (!el.current) return
    el.current.style.setProperty('--draw', t.toFixed(3))
    el.current.style.visibility = world.cathLabels > 0.001 ? 'visible' : 'hidden'
  })
  return (
    <Html position={at} zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
      <div ref={el} className="cathlabel" style={{ ['--rise' as string]: `${rise}px`, visibility: 'hidden' }}>
        <span className="cathlabel__text">
          <span className="cathlabel__name">{name}</span>
          <span className="cathlabel__era">{era}</span>
        </span>
        <span className="cathlabel__rule" />
      </div>
    </Html>
  )
}
