import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { AdditiveBlending, Matrix4, Object3D, Quaternion, ShaderMaterial, Vector3, type Group, type InstancedMesh, type Material, type Mesh, type PointLight, type SpotLight } from 'three'
import type { CityData } from '../lib/cityData'
import { terrainFor } from '../lib/terrain'
import { makeSectionMaterial } from '../materials/section'
import { crack, makeVillamayorMaterial } from '../materials/villamayor'
import { makeGraniteMaterial } from '../materials/granite'
import { freeHalf } from '../materials/palette'
import { world } from '../../timeline/world'
import { LAYOUT, LEVELS, bevelBox, buildExhibits, exhibitsFor, heroStone, quarryBlocks, type Exhibit } from './exhibitGeometry'
import { seeded } from '../lib/cityData'

/** The museum in the section: pieces at the depth of their era, under one travelling light. */
export function Exhibits({ data }: { data: CityData }) {
  const terrain = terrainFor(data)
  const geo = useMemo(() => buildExhibits(terrain), [terrain])
  const list = useMemo(() => exhibitsFor(terrain), [terrain])
  const mats = useMemo(
    () => ({
      // each piece settles into the shadow of its own floor
      medieval: makeSectionMaterial({ half: freeHalf, kind: 'stone', base: '#b89e78', gold: '#b89e78', roof: '#a88f6a', ashlar: 0.6, baseY: terrain.heightAt(0, LAYOUT.gate.z) - LEVELS[0].depth }),
      roman: makeSectionMaterial({ half: freeHalf, kind: 'stone', base: '#6e655a', gold: '#6e655a', roof: '#6a6156', baseY: -1e3 }),
      iron: makeSectionMaterial({ half: freeHalf, kind: 'stone', base: '#9c9284', gold: '#9c9284', roof: '#a39a8c', ashlar: 0.12, baseY: terrain.heightAt(0, LAYOUT.castro.z) - LAYOUT.castro.depth }),
      soil: makeSectionMaterial({ half: freeHalf, kind: 'soil', base: '#6b5643', gold: '#6b5643', roughness: 1 }),
      verraco: makeGraniteMaterial(),
      villamayor: makeVillamayorMaterial(),
    }),
    [terrain],
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
    s.visible = world.lamp > 0.001 // on and off with the lantern: two precompiled light setups
    s.color.setRGB(1, 0.9 - 0.08 * bedrock, 0.78 - 0.18 * bedrock)
  })

  return (
    <group>
      {(Object.keys(geo) as (keyof typeof geo)[]).map((k) => (
        // no sun reaches the gallery: casting into the sun's shadow map would
        // only cost every frame above ground
        <mesh key={k} geometry={geo[k]} material={mats[k]} receiveShadow />
      ))}
      <HeroStone data={data} material={mats.villamayor} />
      <primitive object={target} />
      <spotLight ref={spot} target={target} angle={0.62} penumbra={1} distance={160} decay={1.6} intensity={0} castShadow={false} visible={false} />
      {list.map((e, i) => (
        <Marker key={e.key} exhibit={e} index={i} />
      ))}
    </group>
  )
}

const Y = new Vector3(0, 1, 0)
/** the block's turn: shell to the visitor, then away by `rise` */
const FACING = Math.PI - 0.25
const TURNED = FACING + 0.9

/**
 * The Villamayor block on its plinth, turning slowly, among the quarry's
 * ashlars — and then the film breaks it open: cracks light up from inside,
 * the shards drift apart in slow motion and the light behind them fills the
 * screen, carrying us up to the river.
 */
function HeroStone({ data, material }: { data: CityData; material: Material }) {
  const terrain = terrainFor(data)
  const hero = useRef<Group>(null)
  const quarry = useRef<InstancedMesh>(null)
  const glow = useRef<Mesh>(null)
  const core = useRef<PointLight>(null)
  const pieces = useRef<(Group | null)[]>([])
  const stone = useMemo(() => heroStone(), [])
  const broken = useMemo(() => makeVillamayorMaterial({ broken: true }), [])
  const geo = useMemo(() => ({ box: bevelBox(1, 1, 1, 0.05), plinth: bevelBox(5.2, 1, 3.8, 0.06) }), [])
  const blocks = useMemo(() => quarryBlocks(terrain), [terrain])
  const floor = terrain.heightAt(0, LAYOUT.stone.z) - LAYOUT.stone.depth
  // how each shard leaves: outward from the heart of the block, a little upward, tumbling
  const flight = useMemo(() => {
    const rand = seeded(40)
    return stone.shards.map((sh) => {
      const dir = sh.centroid.clone().add(new Vector3((rand() - 0.5) * 0.5, 0.25 + rand() * 0.35, (rand() - 0.5) * 0.5)).normalize()
      // keep the camera's corridor (world z, straight through the heart) clear:
      // in the world frame the pieces fly out sideways and up, not at the lens
      dir.applyAxisAngle(Y, TURNED)
      dir.z *= 0.25
      if (Math.hypot(dir.x, dir.y) < 0.5) dir.y += 0.6
      dir.normalize().applyAxisAngle(Y, -TURNED)
      return {
        dir,
        dist: 4.5 + rand() * 6,
        axis: new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
        spin: 0.6 + rand() * 1.8,
        delay: rand() * 0.12,
      }
    })
  }, [stone])

  useLayoutEffect(() => {
    const m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0)
    blocks.forEach((b, i) => {
      q.setFromAxisAngle(up, b.ry)
      quarry.current?.setMatrixAt(i, m.compose(new Vector3(b.x, b.y, b.z), q, new Vector3(...b.s)))
    })
    if (quarry.current) quarry.current.instanceMatrix.needsUpdate = true
  }, [blocks])

  useFrame(({ clock, camera }) => {
    const sh = world.shatter
    // the carved shell faces the visitor, then turns away as we leave
    if (hero.current) hero.current.rotation.y = FACING + Math.sin(clock.elapsedTime * 0.15) * 0.18 * (1 - sh) + world.rise * 0.9
    const crackT = Math.min(sh / 0.22, 1)
    const burst = Math.max(0, (sh - 0.22) / 0.78)
    // the cracks blaze, then the open faces cool to a warm glow as they part
    crack.value = crackT * crackT * 2.4 * Math.exp(-burst * 9) + 0.12 * Math.min(burst * 4, 1)
    pieces.current.forEach((g, i) => {
      if (!g) return
      const f = flight[i]
      const t = Math.min(Math.max((burst - f.delay) / (1 - f.delay), 0), 1)
      const e = 1 - Math.pow(1 - t, 2.4) // a burst that slows to a drift
      const c = stone.shards[i].centroid
      g.position.copy(c).addScaledVector(f.dir, 0.035 * crackT + e * f.dist)
      g.quaternion.setFromAxisAngle(f.axis, e * f.spin)
    })
    // the light inside
    if (core.current) {
      core.current.intensity = crackT * 0.8 + burst * 4
      // lights only switch on and off together with the lantern (two precompiled setups)
      core.current.visible = world.lamp > 0.001
    }
    if (glow.current) {
      // drawn over everything, so it must not outlive the moment
      glow.current.visible = sh > 0.001 && world.lamp > 0.001
      glow.current.quaternion.copy(camera.quaternion)
      const k = 1.6 + burst * burst * 26
      glow.current.scale.set(k, k, k)
      ;(glow.current.material as ShaderMaterial).uniforms.uI.value = crackT * 0.5 + burst * 1.6
    }
  })

  const glowMat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: AdditiveBlending,
        toneMapped: false,
        uniforms: { uI: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uI;
          varying vec2 vUv;
          void main() {
            float r = length(vUv - 0.5) * 2.0;
            float g = exp(-r * r * 5.0) + exp(-r * 14.0) * 0.8;
            gl_FragColor = vec4(vec3(1.0, 0.78, 0.5) * g * uI, 1.0);
          }`,
      }),
    [],
  )

  return (
    <group>
      <mesh geometry={geo.plinth} position={[0, floor + 0.5, LAYOUT.stone.z]} castShadow receiveShadow material={material} />
      <group ref={hero} position={[0, floor + 2.25, LAYOUT.stone.z]}>
        {stone.shards.map((sh, i) => (
          <group key={i} ref={(g) => { pieces.current[i] = g }} position={sh.centroid}>
            <mesh geometry={sh.geometry} material={broken} position={sh.centroid.clone().negate()} />
            {i === stone.shellIndex && <mesh geometry={stone.shell} material={broken} position={sh.centroid.clone().negate()} />}
          </group>
        ))}
      </group>
      <pointLight ref={core} position={[0, floor + 2.25, LAYOUT.stone.z]} color="#ffb870" distance={40} decay={1.2} intensity={0} visible={false} />
      <mesh ref={glow} position={[0, floor + 2.25, LAYOUT.stone.z]} material={glowMat} renderOrder={30} visible={false} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <instancedMesh ref={quarry} args={[geo.box, material, blocks.length]} receiveShadow frustumCulled={false} />
    </group>
  )
}

/** A numbered museum marker: its label opens while the piece is lit, or on hover (or tap). */
function Marker({ exhibit, index }: { exhibit: Exhibit; index: number }) {
  const el = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  useFrame(() => {
    const v = Math.max(0, Math.min(1, (world.exhibits[index] - 0.35) / 0.4))
    if (el.current) {
      el.current.style.opacity = v.toFixed(3)
      el.current.style.pointerEvents = v > 0.5 ? 'auto' : 'none'
      // while its piece is in the light, the label opens by itself
      el.current.classList.toggle('marker--lit', world.exhibits[index] > 0.9)
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
