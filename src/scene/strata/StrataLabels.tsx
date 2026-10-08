import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Text } from '@react-three/drei'
import type { Group } from 'three'
import interUrl from '@fontsource/inter/files/inter-latin-500-normal.woff?url'
import type { CityData } from '../lib/cityData'
import { terrainFor } from '../lib/terrain'
import { world } from '../../timeline/world'

/** The layers of the section, by depth below the street. */
export const LAYERS = [
  { name: 'Today', era: '2026', mid: 1.2, legend: 'Paving & modern fill' },
  { name: 'Medieval', era: 'XII — XV c.', mid: 6.8, legend: 'Walls, houses, the first university' },
  { name: 'Roman', era: 'I — IV c. AD', mid: 15.5, legend: 'Salmantica on the Vía de la Plata' },
  { name: 'Iron Age', era: 'IV — I c. BC', mid: 25, legend: 'Helmantica, the Vetton hill-fort' },
  { name: 'Bedrock', era: 'c. 40 million years', mid: 42, legend: 'Villamayor sandstone' },
] as const

/**
 * Museum lettering on both walls of the section, one line per layer, repeated
 * along the gallery — so wherever the camera is, it knows *when* it is.
 */
export function StrataLabels({ data }: { data: CityData }) {
  const terrain = terrainFor(data)
  const left = useRef<Group>(null)
  const right = useRef<Group>(null)
  const items = useMemo(() => {
    const out: { key: string; y: number; z: number; text: string }[] = []
    for (let z = 90; z <= 900; z += 160)
      for (const l of LAYERS.slice(1)) {
        const y = terrain.heightAt(0, z) - l.mid
        if (y < -79) continue
        out.push({ key: `${l.name}-${z}`, y, z, text: `${l.name.toUpperCase()}   ·   ${l.era.toUpperCase()}` })
      }
    return out
  }, [terrain])

  useFrame(() => {
    const on = world.open > 8
    const o = world.open - 0.25
    if (left.current) {
      left.current.visible = on
      left.current.position.x = -o
    }
    if (right.current) {
      right.current.visible = on
      right.current.position.x = o
    }
  })

  const wall = (side: 1 | -1) =>
    items.map((it) => (
      <Text
        key={it.key}
        font={interUrl}
        fontSize={1.05}
        letterSpacing={0.28}
        color="#f3e8d6"
        fillOpacity={0.8}
        anchorX="center"
        anchorY="middle"
        position={[0, it.y, it.z]}
        rotation-y={side === -1 ? Math.PI / 2 : -Math.PI / 2}
      >
        {it.text}
      </Text>
    ))

  return (
    <>
      <group ref={left}>{wall(-1)}</group>
      <group ref={right}>{wall(1)}</group>
      <SectionLegend data={data} />
    </>
  )
}

/**
 * The architectural-section moment: leader lines from each layer of the cut
 * under Plaza Mayor to a small legend, like the drawing in an excavation report.
 */
function SectionLegend({ data }: { data: CityData }) {
  const terrain = terrainFor(data)
  const root = useRef<Group>(null)
  const els = useRef<(HTMLDivElement | null)[]>([])
  const z = 2
  const ground = terrain.heightAt(0, z)

  useFrame(() => {
    if (root.current) root.current.position.x = -world.open + 0.3
    const a = world.legend
    els.current.forEach((el, i) => {
      if (!el) return
      const t = Math.min(1, Math.max(0, a * (LAYERS.length + 1) - i))
      el.style.opacity = t.toFixed(3)
      el.style.setProperty('--draw', t.toFixed(3))
    })
  })

  return (
    <group ref={root}>
      {LAYERS.map((l, i) => (
        <Html key={l.name} position={[0, ground - l.mid + (i === 0 ? 4 : 0), z]} zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
          <div className="legend" ref={(e) => { els.current[i] = e }} style={{ opacity: 0 }}>
            <span className="legend__rule" />
            <span className="legend__text">
              <span className="legend__name">{l.name}</span>
              <span className="legend__era">{l.era}</span>
              <span className="legend__note">{l.legend}</span>
            </span>
          </div>
        </Html>
      ))}
    </group>
  )
}
