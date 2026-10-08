import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Plane, Vector3, type BufferGeometry, type Group } from 'three'
import type { CityData } from '../lib/cityData'
import { plazaFrame } from '../lib/cityData'
import { makePalette, type Palette } from '../materials/palette'
import type { Half } from '../materials/section'
import { world } from '../../timeline/world'

export type CityGeometries = {
  buildings: BufferGeometry
  slab: BufferGeometry
  river: BufferGeometry
  plaza: Partial<Record<keyof Palette, BufferGeometry>>
  cathedrals: Partial<Record<keyof Palette, BufferGeometry>>
  bridge: Partial<Record<keyof Palette, BufferGeometry>>
}

/**
 * One half of the city: the same geometry rendered with materials clipped to
 * one side of the section plane, translated sideways as the city opens.
 */
export function CityHalf({ data, geo, half }: { data: CityData; geo: CityGeometries; half: Half }) {
  const group = useRef<Group>(null)
  const palette = useMemo(() => {
    const { x0, x1, z0, z1 } = data.slab
    const clip = [
      new Plane(new Vector3(1, 0, 0), -x0),
      new Plane(new Vector3(-1, 0, 0), x1),
      new Plane(new Vector3(0, 0, 1), -z0),
      new Plane(new Vector3(0, 0, -1), z1),
    ]
    return makePalette(half, clip)
  }, [data, half])
  const P = useMemo(() => plazaFrame(data), [data])

  useFrame(() => {
    const split = world.open > 0.01 || world.cutGlow > 0.001
    if (group.current) {
      group.current.position.x = half.side * world.open
      // the right half only exists once the city is cut
      group.current.visible = half.side === -1 || split
    }
    // the river's slab clip planes must follow the half as it moves
    const off = half.side * world.open
    const clip = palette.water.clippingPlanes!
    clip[1].constant = -(data.slab.x0 + off)
    clip[2].constant = data.slab.x1 + off
  })

  const parts = (set: Partial<Record<keyof Palette, BufferGeometry>>) =>
    (Object.keys(set) as (keyof Palette)[]).map((k) => (
      <mesh key={k} geometry={set[k]} material={palette[k]} castShadow receiveShadow />
    ))

  return (
    <group ref={group}>
      <mesh geometry={geo.slab} material={palette.ground} receiveShadow castShadow />
      <mesh geometry={geo.river} material={palette.water} receiveShadow />
      <mesh geometry={geo.buildings} material={palette.buildings} castShadow receiveShadow />
      <group position={[P.center.x, 0, P.center.z]} rotation-y={P.rotationY}>
        {parts(geo.plaza)}
      </group>
      {parts(geo.cathedrals)}
      {parts(geo.bridge)}
    </group>
  )
}
