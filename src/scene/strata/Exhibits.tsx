import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, Matrix4, Object3D, Quaternion, Vector3, type InstancedMesh, type SpotLight } from 'three'
import { makeSectionMaterial } from '../materials/section'
import { freeHalf } from '../materials/palette'
import { world } from '../../timeline/world'
import { EXHIBIT_SPOTS, bedrockBlocks, buildExhibits, type ExhibitKey } from './exhibitGeometry'

/** The museum in the section: pieces at the depth of their era, each under its own light. */
export function Exhibits() {
  const geo = useMemo(() => buildExhibits(), [])
  const mats = useMemo<Record<ExhibitKey, ReturnType<typeof makeSectionMaterial>>>(
    () => ({
      medieval: makeSectionMaterial({ half: freeHalf, kind: 'stone', base: '#cdb48e', gold: '#cdb48e', roof: '#bfa47c', ashlar: 0.6, caps: false }),
      roman: makeSectionMaterial({ half: freeHalf, kind: 'stone', base: '#a69a8a', gold: '#a69a8a', roof: '#9c8f7f', caps: false }),
      iron: makeSectionMaterial({ half: freeHalf, kind: 'stone', base: '#b9ae9e', gold: '#b9ae9e', roof: '#c2b7a7', ashlar: 0.15, caps: false }),
      bedrock: makeSectionMaterial({ half: freeHalf, kind: 'stone', base: '#d9a964', gold: '#d9a964', roof: '#e0b170', ashlar: 0.25, caps: false }),
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
    let sum = 0
    let max = 0
    tmp.p.set(0, 0, 0)
    tmp.a.set(0, 0, 0)
    EXHIBIT_SPOTS.forEach((e, i) => {
      const w = world.exhibits[i]
      sum += w
      max = Math.max(max, w)
      tmp.p.x += e.at[0] * w; tmp.p.y += e.at[1] * w; tmp.p.z += e.at[2] * w
      tmp.a.x += e.aim[0] * w; tmp.a.y += e.aim[1] * w; tmp.a.z += e.aim[2] * w
    })
    if (sum > 1e-4) {
      s.position.copy(tmp.p.divideScalar(sum))
      target.position.copy(tmp.a.divideScalar(sum))
      target.updateMatrixWorld()
    }
    const bedrock = world.exhibits[3] / Math.max(sum, 1e-4)
    s.intensity = max * (1500 + 1100 * bedrock)
    s.color.setRGB(1, 0.9 - 0.08 * bedrock, 0.77 - 0.2 * bedrock)
  })

  return (
    <group>
      {(Object.keys(geo) as ExhibitKey[]).map((k) => (
        <mesh key={k} geometry={geo[k]} material={mats[k]} castShadow receiveShadow />
      ))}
      <BedrockBlocks material={mats.bedrock} />
      <primitive object={target} />
      <spotLight ref={spot} target={target} angle={0.95} penumbra={1} distance={140} decay={1.7} intensity={0} />
    </group>
  )
}

function BedrockBlocks({ material }: { material: ReturnType<typeof makeSectionMaterial> }) {
  const ref = useRef<InstancedMesh>(null)
  const blocks = useMemo(() => bedrockBlocks(), [])
  const geom = useMemo(() => new BoxGeometry(1, 1, 1), [])
  const tmp = useMemo(() => ({ m: new Matrix4(), q: new Quaternion(), p: new Vector3(), s: new Vector3(), up: new Vector3(0, 1, 0) }), [])

  useEffect(() => () => geom.dispose(), [geom])

  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const t = clock.elapsedTime
    blocks.forEach((b, i) => {
      const r = Math.min(Math.max((world.rise - b.delay) / (1 - b.delay), 0), 1)
      const e = r * r * (3 - 2 * r)
      tmp.p.set(b.x, b.y + e * b.lift + Math.sin(t * 0.5 + i) * 0.15 * e, b.z)
      tmp.q.setFromAxisAngle(tmp.up, b.ry + e * 0.4 * (i % 2 ? 1 : -1))
      tmp.s.set(...b.s)
      tmp.m.compose(tmp.p, tmp.q, tmp.s)
      mesh.setMatrixAt(i, tmp.m)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[geom, material, blocks.length]} castShadow receiveShadow frustumCulled={false} />
}
