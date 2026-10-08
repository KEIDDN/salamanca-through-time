import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ACESFilmicToneMapping, Fog, PCFShadowMap, type Object3D, type PointLight, type SpotLight } from 'three'
import type { CityData } from './lib/cityData'
import { SLAB_DEPTH, plazaFrame } from './lib/cityData'
import { terrainFor } from './lib/terrain'
import { buildCityGeometry, buildRiverGeometry, buildTerrainGeometry, riverTrees } from './city/geometry'
import { bakeContactShadow } from './city/contactShadow'
import { CityHalf, type CityGeometries } from './city/CityHalf'
import { buildPlazaMayor } from './landmarks/plazaMayor'
import { buildCathedrals } from './landmarks/cathedral'
import { buildBridge } from './landmarks/bridge'
import { buildOldTown } from './landmarks/oldTown'
import { halves, shared } from './materials/section'
import { CameraRig } from './CameraRig'
import { Lighting } from './Lighting'
import { Sky } from './Sky'
import { Exhibits } from './strata/Exhibits'
import { CutLine } from './strata/CutLine'
import { StrataLabels } from './strata/StrataLabels'
import { world } from '../timeline/world'

const flags = new URLSearchParams(location.search)
const flag = (k: string) => import.meta.env.DEV && flags.get(k) === '0'
const DPR_MAX = Math.min(window.devicePixelRatio || 1, 1.75)
const DPR_MIN = 0.85

/**
 * The 3D film. No post-processing stack: occlusion is baked, anti-aliasing is
 * native MSAA, tone mapping happens in the materials, and vignette and grain
 * are CSS layers — the GPU spends its time on the city.
 */
export function Experience({ data }: { data: CityData }) {
  const geo = useMemo<CityGeometries>(() => {
    const terrain = terrainFor(data)
    const P = plazaFrame(data)
    return {
      terrain: buildTerrainGeometry(data, terrain),
      ...(() => {
        const b = buildCityGeometry(data, terrain)
        return { buildings: b.all, cutBuildings: b.cut }
      })(),
      river: buildRiverGeometry(data),
      plaza: buildPlazaMayor(P.halfE, P.halfN),
      cathedrals: buildCathedrals(data),
      bridge: buildBridge(data),
      landmarks: buildOldTown(data),
      trees: riverTrees(data, terrain),
    }
  }, [data])

  // textures shared by every section material
  useMemo(() => {
    const terrain = terrainFor(data)
    const { x0, x1, z0, z1 } = data.slab
    shared.uHeightTex.value = terrain.heightTex
    shared.uHeightRect.value.set(...terrain.heightRect)
    shared.uAoTex.value = bakeContactShadow(data)
    shared.uAoRect.value.set(x0, z0, 1 / (x1 - x0), 1 / (z1 - z0))
  }, [data])

  return (
    <Canvas
      className="stage"
      shadows={flag('shadow') ? false : { type: PCFShadowMap }}
      dpr={Math.min(DPR_MAX, 1.4)}
      gl={{ antialias: true, powerPreference: 'high-performance', stencil: true }}
      camera={{ fov: 30, near: 2, far: 9000, position: [0, 2700, 400] }}
      onCreated={({ gl, scene }) => {
        gl.localClippingEnabled = true
        gl.toneMapping = ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        scene.fog = new Fog('#ebe6dd', 2200, 3600)
      }}
    >
      <AdaptiveResolution />
      <Precompile />
      <FogDriver />
      <CameraRig data={data} />
      <Lighting />
      <Sky />
      {!flag('city') && <CityHalf data={data} geo={geo} half={halves.L} />}
      <CityHalf data={data} geo={geo} half={halves.R} />
      {!flag('ex') && <Exhibits data={data} />}
      <StrataLabels data={data} />
      <Abyss data={data} />
      <CutLine data={data} />
    </Canvas>
  )
}

/** The floor of the section, 60 m down: only ever seen through the opening. */
function Abyss({ data }: { data: CityData }) {
  const { x0, x1, z0, z1 } = data.slab
  return (
    <mesh rotation-x={-Math.PI / 2} position={[(x0 + x1) / 2, -SLAB_DEPTH + 0.4, (z0 + z1) / 2]}>
      <planeGeometry args={[x1 - x0 - 2, z1 - z0 - 2]} />
      <meshBasicMaterial color="#120d09" />
    </mesh>
  )
}

/**
 * Resolution follows the frame time: the film must stay fluid, so pixels are
 * the first thing it gives up. A frame that misses the display's refresh steps
 * the resolution down; a long run of frames that make it steps it back up,
 * but never straight back to a level that just failed. Steps are small and
 * rare, since each one reallocates the drawing buffer.
 */
function AdaptiveResolution() {
  const setDpr = useThree((s) => s.setDpr)
  const st = useRef({ dpr: Math.min(DPR_MAX, 1.4), sum: 0, n: 0, wait: 1.5, good: 0, ceiling: DPR_MAX, ceilingUntil: 0, clock: 0 })
  useFrame((_, delta) => {
    const s = st.current
    if (delta > 0.2) return // a hidden tab or a hitch is not a trend
    s.clock += delta
    s.wait -= delta
    s.sum += delta
    s.n++
    if (s.n < 24) return
    const avg = s.sum / s.n
    s.sum = 0
    s.n = 0
    if (s.wait > 0) return
    let next = s.dpr
    if (avg > 1 / 50) {
      next = Math.max(DPR_MIN, s.dpr - (avg > 1 / 35 ? 0.2 : 0.1))
      s.ceiling = s.dpr
      s.ceilingUntil = s.clock + 12
      s.good = 0
    } else if (avg < 1 / 57 && ++s.good >= 6) {
      const cap = s.clock < s.ceilingUntil ? s.ceiling - 0.1 : DPR_MAX
      if (s.dpr + 0.1 <= cap + 1e-6) next = s.dpr + 0.1
      s.good = 0
    }
    if (next !== s.dpr) {
      s.wait = next < s.dpr ? 0.6 : 2
      s.dpr = next
      setDpr(next)
    }
  })
  return null
}

/**
 * Compile every program up front so no shader is built mid-scroll — for both
 * light setups (the underground lantern and museum spot only exist below ground).
 */
function Precompile() {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    const lamps: Object3D[] = []
    scene.traverse((o) => (o as PointLight).isPointLight || (o as SpotLight).isSpotLight ? lamps.push(o) : undefined)
    // in parallel where the driver allows it, so the page never freezes on it
    const set = (on: boolean) => lamps.forEach((l) => (l.visible = on))
    let alive = true
    ;(async () => {
      set(true)
      await gl.compileAsync(scene, camera)
      if (!alive) return
      set(false)
      await gl.compileAsync(scene, camera)
    })()
    if (import.meta.env.DEV) Object.assign(window, { __three: { gl, scene, camera } })
    return () => {
      alive = false
    }
  }, [gl, scene, camera])
  return null
}

function FogDriver() {
  useFrame(({ scene }) => {
    const f = scene.fog as Fog | null
    if (!f) return
    f.near = world.fog.near
    f.far = world.fog.far
    shared.uFog.value.set(world.fog.near, world.fog.far, 0, 0)
  })
  return null
}
