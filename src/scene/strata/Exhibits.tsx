import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { BoxGeometry, Matrix4, Object3D, Quaternion, Vector3, type InstancedMesh, type Mesh, type SpotLight } from 'three'
import type { CityData } from '../lib/cityData'
import { terrainFor } from '../lib/terrain'
import { makeSectionMaterial } from '../materials/section'
import { makeVillamayorMaterial } from '../materials/villamayor'
import { freeHalf } from '../materials/palette'
import { world } from '../../timeline/world'
import { LAYOUT, buildExhibits, exhibitsFor, heroBlockGeometry, quarryBlocks, type Exhibit } from './exhibitGeometry'

/** The museum in the section: pieces at the depth of their era, under one travelling light. */
export function Exhibits({ data }: { data: CityData }) {
  const terrain = terrainFor(data)
  const geo = useMemo(() => buildExhibits(terrain), [terrain])
  const list = useMemo(() => exhibitsFor(terrain), [terrain])
  const mats = useMemo(
    () => ({
      medieval: makeSectionMaterial({ half: freeHalf, kind: 'stone', base: '#b89e78', gold: '#b89e78', roof: '#a88f6a', ashlar: 0.6, baseY: -1e3 }),
      roman: makeSectionMaterial({ half: freeHalf, kind: 'stone', base: '#6e655a', gold: '#6e655a', roof: '#6a6156', baseY: -1e3 }),
      iron: makeSectionMaterial({ half: freeHalf, kind: 'stone', base: '#9c9284', gold: '#9c9284', roof: '#a39a8c', ashlar: 0.12, baseY: -1e3 }),
      villamayor: makeVillamayorMaterial(),
    }),
    [],
  )
  const spot = useRef<SpotLight>(null)
  const target = useMemo(() => new Object3D(), [])
  const tmp = useMemo(() => ({ p: new Vector3(), a: new Vector3() }), [])

  // a single museum light that travels from piece to piece
  useFrame(() => {
    const s = spot.current
    if (!s) return
    let sum = 0, max = 0
    tmp.p.set(0, 0, 0)
    tmp.a.set(0, 0, 0)
    list.forEach((e, i) => {
      const w = world.exhibits[i]
      sum += w
      max = Math.max(max, w)
      tmp.p.addScaledVector(e.light.at, w)
      tmp.a.addScaledVector(e.light.aim, w)
    })
    if (sum > 1e-4) {
      s.position.copy(tmp.p.divideScalar(sum))
      target.position.copy(tmp.a.divideScalar(sum))
      target.updateMatrixWorld()
    }
    const bedrock = world.exhibits[3] / Math.max(sum, 1e-4)
    s.intensity = max * (750 + 150 * bedrock)
    s.color.setRGB(1, 0.9 - 0.08 * bedrock, 0.78 - 0.18 * bedrock)
  })

  return (
    <group>
      {(Object.keys(geo) as (keyof typeof geo)[]).map((k) => (
        <mesh key={k} geometry={geo[k]} material={mats[k]} castShadow receiveShadow />
      ))}
      <HeroStone data={data} material={mats.villamayor} />
      <primitive object={target} />
      <spotLight ref={spot} target={target} angle={0.9} penumbra={1} distance={160} decay={1.6} intensity={0} castShadow={false} />
      {list.map((e, i) => (
        <Marker key={e.key} exhibit={e} index={i} />
      ))}
    </group>
  )
}

/** The Villamayor block on its plinth, turning slowly, among the quarry's ashlars. */
function HeroStone({ data, material }: { data: CityData; material: ReturnType<typeof makeVillamayorMaterial> }) {
  const terrain = terrainFor(data)
  const hero = useRef<Mesh>(null)
  const quarry = useRef<InstancedMesh>(null)
  const geo = useMemo(() => ({ hero: heroBlockGeometry(), box: new BoxGeometry(1, 1, 1) }), [])
  const blocks = useMemo(() => quarryBlocks(terrain), [terrain])
  const floor = terrain.heightAt(0, LAYOUT.stone.z) - LAYOUT.stone.depth

  useLayoutEffect(() => {
    const m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0)
    blocks.forEach((b, i) => {
      q.setFromAxisAngle(up, b.ry)
      quarry.current?.setMatrixAt(i, m.compose(new Vector3(b.x, b.y, b.z), q, new Vector3(...b.s)))
    })
    if (quarry.current) quarry.current.instanceMatrix.needsUpdate = true
  }, [blocks])

  useFrame(({ clock }) => {
    // the carved shell faces the visitor, then turns away as we leave
    if (hero.current) hero.current.rotation.y = Math.PI - 0.25 + Math.sin(clock.elapsedTime * 0.15) * 0.18 + world.rise * 0.9
  })

  return (
    <group>
      <mesh position={[0, floor + 0.5, LAYOUT.stone.z]} castShadow receiveShadow material={material}>
        <boxGeometry args={[5.2, 1, 3.8]} />
      </mesh>
      <mesh ref={hero} geometry={geo.hero} material={material} position={[0, floor + 2.25, LAYOUT.stone.z]} castShadow receiveShadow />
      <instancedMesh ref={quarry} args={[geo.box, material, blocks.length]} castShadow receiveShadow frustumCulled={false} />
    </group>
  )
}

/** A numbered museum marker; hover (or tap) for the label. */
function Marker({ exhibit, index }: { exhibit: Exhibit; index: number }) {
  const el = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  useFrame(() => {
    const v = Math.max(0, Math.min(1, (world.exhibits[index] - 0.35) / 0.4))
    if (el.current) {
      el.current.style.opacity = v.toFixed(3)
      el.current.style.pointerEvents = v > 0.5 ? 'auto' : 'none'
    }
  })
  return (
    <Html position={exhibit.anchor} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
      <div
        ref={el}
        className={`marker${open ? ' marker--open' : ''}`}
        onPointerEnter={() => setOpen(true)}
        onPointerLeave={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        style={{ opacity: 0 }}
      >
        <span className="marker__dot">{exhibit.number}</span>
        <span className="marker__label">
          <span className="marker__title">{exhibit.title}</span>
          <span className="marker__caption">{exhibit.caption}</span>
        </span>
      </div>
    </Html>
  )
}
