import { useEffect, useMemo, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { ACESFilmicToneMapping, Fog, PCFShadowMap } from 'three'
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
const DPR_HIGH = Math.min(window.devicePixelRatio || 1, 1.75)

/**
 * The 3D film. No post-processing stack: occlusion is baked, anti-aliasing is
 * native MSAA, tone mapping happens in the materials, and vignette and grain
 * are CSS layers — the GPU spends its time on the city.
 */
export function Experience({ data }: { data: CityData }) {
  const [dpr, setDpr] = useState(DPR_HIGH)
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
      dpr={dpr}
      gl={{ antialias: true, powerPreference: 'high-performance', stencil: true }}
      camera={{ fov: 30, near: 2, far: 9000, position: [0, 2700, 400] }}
      onCreated={({ gl, scene }) => {
        gl.localClippingEnabled = true
        gl.toneMapping = ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        scene.fog = new Fog('#ebe6dd', 2200, 3600)
      }}
    >
      <PerformanceMonitor
        // only step down when the film is genuinely struggling, not for one heavy beat
        bounds={() => [40, 57]}
        flipflops={4}
        onDecline={() => setDpr((d) => Math.max(1, d - 0.25))}
        onIncline={() => setDpr((d) => Math.min(DPR_HIGH, d + 0.25))}
        onFallback={() => setDpr(1)}
      />
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

/** Compile every program up front so no shader is built mid-scroll. */
function Precompile() {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    gl.compile(scene, camera)
    if (import.meta.env.DEV) Object.assign(window, { __three: { gl, scene, camera } })
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
