import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { DirectionalLight, HemisphereLight, PointLight } from 'three'
import { world } from '../timeline/world'
import { camTarget } from './lib/camTarget'
import { setOpening, shared } from './materials/section'

/**
 * Sun, sky fill and a soft lantern that travels with the camera underground.
 * The sun's shadow frustum is refitted around whatever the camera looks at,
 * so shadows stay crisp from 2.7 km up down to street level.
 */
export function Lighting() {
  const sun = useRef<DirectionalLight>(null)
  const hemi = useRef<HemisphereLight>(null)
  const lamp = useRef<PointLight>(null)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    if (sun.current) scene.add(sun.current.target)
  }, [scene])

  useFrame(({ camera, clock }) => {
    const s = sun.current, h = hemi.current, l = lamp.current
    if (!s || !h || !l) return

    // section uniforms
    setOpening(world.open, world.open > 0.01 || world.cutGlow > 0.001)
    shared.uGold.value = world.gold
    shared.uStrata.value = world.strata
    shared.uCapAmbient.value = world.capAmbient
    shared.uLamp.value = world.lamp
    shared.uTime.value = clock.elapsedTime
    shared.uHorizon.value.setRGB(world.sky.horizon.r, world.sky.horizon.g, world.sky.horizon.b)

    const el = (world.sun.elevation * Math.PI) / 180
    const az = (world.sun.azimuth * Math.PI) / 180
    const dir = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)]
    const dist = camera.position.distanceTo(camTarget)
    const span = Math.min(Math.max(dist * 0.85, 70), 1500)
    s.target.position.copy(camTarget).setY(0)
    s.position.set(camTarget.x + dir[0] * 2500, dir[1] * 2500, camTarget.z + dir[2] * 2500)
    s.target.updateMatrixWorld()
    const sc = s.shadow.camera
    if (Math.abs(sc.right - span) > 1) {
      sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span
      sc.updateProjectionMatrix()
    }
    s.shadow.normalBias = 0.02 + span * 0.0006
    s.intensity = world.sun.intensity
    s.color.setRGB(world.sun.color.r, world.sun.color.g, world.sun.color.b)

    h.intensity = world.hemi.intensity
    h.color.setRGB(world.hemi.sky.r, world.hemi.sky.g, world.hemi.sky.b)
    h.groundColor.setRGB(world.hemi.ground.r, world.hemi.ground.g, world.hemi.ground.b)

    l.position.copy(camera.position)
    l.intensity = world.lamp * 260
  })

  return (
    <>
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-camera-near={10}
        shadow-camera-far={6000}
      />
      <hemisphereLight ref={hemi} />
      <pointLight ref={lamp} color="#ffd9a8" distance={180} decay={1.6} intensity={0} />
    </>
  )
}
