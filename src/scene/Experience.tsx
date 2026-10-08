import { useEffect, useMemo, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { ACESFilmicToneMapping, Fog } from 'three'
import type { CityData } from './lib/cityData'
import { plazaFrame } from './lib/cityData'
import { buildCityGeometry, buildRiverGeometry, buildSlabGeometry } from './city/geometry'
import { CityHalf, type CityGeometries } from './city/CityHalf'
import { buildPlazaMayor } from './landmarks/plazaMayor'
import { buildCathedrals } from './landmarks/cathedral'
import { buildBridge } from './landmarks/bridge'
import { halves } from './materials/section'
import { CameraRig } from './CameraRig'
import { Lighting } from './Lighting'
import { Sky } from './Sky'
import { Effects } from './Effects'
import { Exhibits } from './strata/Exhibits'
import { CutLine } from './strata/CutLine'
import { world } from '../timeline/world'

export function Experience({ data }: { data: CityData }) {
  const [dpr, setDpr] = useState(1.5)
  const geo = useMemo<CityGeometries>(() => {
    const P = plazaFrame(data)
    return {
      buildings: buildCityGeometry(data),
      slab: buildSlabGeometry(data),
      river: buildRiverGeometry(data),
      plaza: buildPlazaMayor(P.halfE, P.halfN),
      cathedrals: buildCathedrals(data),
      bridge: buildBridge(data),
    }
  }, [data])

  return (
    <Canvas
      className="stage"
      shadows="soft"
      dpr={dpr}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 30, near: 2, far: 9000, position: [0, 2700, 400] }}
      onCreated={({ gl, scene }) => {
        gl.localClippingEnabled = true
        gl.toneMapping = ACESFilmicToneMapping
        scene.fog = new Fog('#ebe6dd', 2200, 3600)
      }}
    >
      <PerformanceMonitor flipflops={3} onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} onFallback={() => setDpr(1)} />
      <Precompile />
      <FogDriver />
      <CameraRig data={data} />
      <Lighting />
      <Sky />
      <CityHalf data={data} geo={geo} half={halves.L} />
      <CityHalf data={data} geo={geo} half={halves.R} />
      <Exhibits />
      <Abyss data={data} />
      <CutLine data={data} />
      <Effects />
    </Canvas>
  )
}

/** The floor of the section, 60 m down: only ever seen through the opening. */
function Abyss({ data }: { data: CityData }) {
  const { x0, x1, z0, z1 } = data.slab
  return (
    <mesh rotation-x={-Math.PI / 2} position={[(x0 + x1) / 2, -59.6, (z0 + z1) / 2]} receiveShadow>
      <planeGeometry args={[x1 - x0 + 200, z1 - z0]} />
      <meshStandardMaterial color="#3a2a1c" roughness={1} />
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
  })
  return null
}
