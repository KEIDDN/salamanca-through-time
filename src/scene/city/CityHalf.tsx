import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CylinderGeometry, IcosahedronGeometry, Matrix4, Quaternion, Vector3, type BufferGeometry, type Group, type InstancedMesh } from 'three'
import type { CityData } from '../lib/cityData'
import { SLAB_DEPTH, plazaFrame } from '../lib/cityData'
import type { Mesh } from 'three'
import { makePalette, type Palette, type PaletteKey } from '../materials/palette'
import type { Half } from '../materials/section'
import { world } from '../../timeline/world'
import { noise3 } from '../lib/sdf'
import { WATER_LAYER } from '../WaterReflection'

type PartSet = Partial<Record<PaletteKey, BufferGeometry>>

export type CityGeometries = {
  buildings: BufferGeometry
  /** only the buildings crossing the section plane — all the stencil cap needs */
  cutBuildings: BufferGeometry
  terrain: BufferGeometry
  river: BufferGeometry
  plaza: PartSet
  cathedrals: PartSet
  bridge: PartSet
  landmarks: PartSet
  trees: { x: number; y: number; z: number; r: number; h: number }[]
}

/** Parts whose geometry is too thin or open to be capped meaningfully. */
const UNCAPPED = new Set<PaletteKey>(['dark', 'water', 'foliage', 'trunk', 'iron', 'figure'])
/** Too fine to cast a shadow worth its cost. */
const NO_SHADOW = new Set<PaletteKey>(['dark', 'iron'])

const NO_CAPS = import.meta.env.DEV && new URLSearchParams(location.search).get('caps') === '0'

/** Whether a part reaches across x = 0 (parts that don't, cancel out in the stencil). */
function crossesCut(g: BufferGeometry, always: boolean) {
  if (always) return true
  g.computeBoundingBox()
  return g.boundingBox!.min.x < 0.5 && g.boundingBox!.max.x > -0.5
}

export const isSplit = () => world.open > 0.01 || world.cutGlow > 0.001

/**
 * One half of the city: the same geometry rendered with materials clipped to
 * one side of the section plane, translated sideways as the city opens. The
 * cut is closed by cap meshes that only exist while the city is split.
 */
export function CityHalf({ data, geo, half }: { data: CityData; geo: CityGeometries; half: Half }) {
  const group = useRef<Group>(null)
  const caps = useRef<Group[]>([])
  const capQuad = useRef<Mesh>(null)
  const order = half.side === -1 ? 10 : 20
  const palette = useMemo(() => makePalette(half, order), [half, order])
  const P = useMemo(() => plazaFrame(data), [data])

  useFrame(() => {
    const split = isSplit()
    if (group.current) {
      group.current.position.x = half.side * world.open
      group.current.visible = half.side === -1 || split
    }
    caps.current.forEach((c) => c && (c.visible = split && !NO_CAPS))
    if (capQuad.current) {
      capQuad.current.visible = split && !NO_CAPS
      capQuad.current.position.x = half.side * world.open
    }
  })

  const capRef = (i: number) => (g: Group | null) => {
    if (g) caps.current[i] = g
  }

  const stencilPair = (key: string, g: BufferGeometry) => (
    <group key={key}>
      <mesh geometry={g} material={palette.stencil.back} renderOrder={order} frustumCulled={false} />
      <mesh geometry={g} material={palette.stencil.front} renderOrder={order} frustumCulled={false} />
    </group>
  )

  const parts = (set: PartSet, capIndex: number) => {
    const keys = Object.keys(set) as PaletteKey[]
    return (
      <>
        {keys.map((k) => (
          <mesh key={k} geometry={set[k]} material={palette[k]} castShadow={!NO_SHADOW.has(k)} receiveShadow />
        ))}
        <group ref={capRef(capIndex)} visible={false}>
          {keys.filter((k) => !UNCAPPED.has(k) && crossesCut(set[k]!, capIndex === 1)).map((k) => stencilPair(k, set[k]!))}
        </group>
      </>
    )
  }

  const { z0, z1 } = data.slab
  return (
    <>
    {/* the cap: one quad on the cut plane, painted where the stencil says "inside" */}
    <mesh
      ref={capQuad}
      material={palette.cap}
      renderOrder={order + 1}
      visible={false}
      frustumCulled={false}
      position={[0, (140 - SLAB_DEPTH) / 2 - 1, (z0 + z1) / 2]}
      rotation-y={Math.PI / 2}
    >
      <planeGeometry args={[z1 - z0 + 4, 140 + SLAB_DEPTH]} />
    </mesh>
    <group ref={group}>
      <mesh geometry={geo.terrain} material={palette.ground} receiveShadow />
      <mesh geometry={geo.river} material={palette.water} receiveShadow ref={(m) => m?.layers.set(WATER_LAYER)} />
      <mesh geometry={geo.buildings} material={palette.buildings} castShadow receiveShadow />
      <group ref={capRef(0)} visible={false}>
        {stencilPair('terrain', geo.terrain)}
        {stencilPair('buildings', geo.cutBuildings)}
      </group>
      <group position={[P.center.x, 0, P.center.z]} rotation-y={P.rotationY}>
        {parts(geo.plaza, 1)}
      </group>
      {parts(geo.cathedrals, 2)}
      {parts(geo.bridge, 3)}
      {parts(geo.landmarks, 4)}
      <Trees trees={geo.trees} palette={palette} />
    </group>
    </>
  )
}

/**
 * A tree crown that is not a ball: a sphere pushed out of shape by noise into
 * lobes, narrowing to the top like the poplars along the Tormes. Flat-shaded,
 * so the light breaks over it in facets of foliage. One shape for every tree:
 * each instance turns and scales it differently.
 */
function crownGeometry() {
  const g = new IcosahedronGeometry(1, 2)
  const p = g.getAttribute('position')
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const k = 1 + noise3(x * 1.6, y * 1.6, z * 1.6) * 0.32 + noise3(x * 4.1 + 3, y * 4.1, z * 4.1) * 0.1
    const taper = 1 - Math.max(0, y) * 0.28
    p.setXYZ(i, x * k * taper, y * k, z * k * taper)
  }
  g.computeVertexNormals()
  return g
}

function Trees({ trees, palette }: { trees: CityGeometries['trees']; palette: Palette }) {
  const crown = useRef<InstancedMesh>(null)
  const trunk = useRef<InstancedMesh>(null)
  const geos = useMemo(() => ({ crown: crownGeometry(), trunk: new CylinderGeometry(0.18, 0.28, 1, 6) }), [])
  useLayoutEffect(() => {
    const m = new Matrix4(), q = new Quaternion(), p = new Vector3(), s = new Vector3(), up = new Vector3(0, 1, 0)
    trees.forEach((t, i) => {
      p.set(t.x, t.y + t.h * 0.6, t.z)
      s.set(t.r * 0.85, t.h * 0.47, t.r * 0.85)
      q.setFromAxisAngle(up, (t.x * 13.7 + t.z * 7.1) % 6.28)
      crown.current?.setMatrixAt(i, m.compose(p, q, s))
      p.set(t.x, t.y + t.h * 0.2, t.z)
      s.set(1, t.h * 0.42, 1)
      q.identity()
      trunk.current?.setMatrixAt(i, m.compose(p, q, s))
    })
    if (crown.current) crown.current.instanceMatrix.needsUpdate = true
    if (trunk.current) trunk.current.instanceMatrix.needsUpdate = true
  }, [trees])
  return (
    <>
      <instancedMesh ref={crown} args={[geos.crown, palette.foliage, trees.length]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={trunk} args={[geos.trunk, palette.trunk, trees.length]} frustumCulled={false} />
    </>
  )
}
