import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, type DirectionalLight, type HemisphereLight, type PointLight } from 'three'
import { world } from '../timeline/world'
import { camTarget } from './lib/camTarget'
import { setOpening, shared } from './materials/section'

/**
 * Sun, sky fill and a soft lantern that travels with the camera underground.
 * The sun's shadow frustum is refitted around whatever the camera looks at,
 * so shadows stay crisp from 2.7 km up down to street level.
 */
const MAP = 2048
const SPAN_STEP = 1.08
const tmp = { d: new Vector3(), r: new Vector3(), u: new Vector3(), c: new Vector3(), up: new Vector3(0, 1, 0) }

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
    shared.uBulbs.value = world.bulbs
    shared.uAlpen.value = world.alpen
    shared.uTime.value = clock.elapsedTime
    shared.uHorizon.value.setRGB(world.sky.horizon.r, world.sky.horizon.g, world.sky.horizon.b)
    shared.uSkyTop.value.setRGB(world.sky.top.r, world.sky.top.g, world.sky.top.b)
    shared.uDusk.value = world.dusk
    shared.uSunset.value = Math.min(Math.max((world.sky.glow - 0.6) / 0.4, 0), 1)

    const el = (world.sun.elevation * Math.PI) / 180
    const az = (world.sun.azimuth * Math.PI) / 180
    const dir = tmp.d.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az))
    shared.uSunDir.value.copy(dir)
    shared.uSunCol.value.setRGB(world.sun.color.r, world.sun.color.g, world.sun.color.b).multiplyScalar(world.sun.intensity / 3)
    camera.updateMatrixWorld()
    shared.uViewProj.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)

    // shadow frustum around what the camera looks at. Its size moves in
    // discrete 8% steps and its centre snaps to whole texels in light space,
    // so between steps the shadow map is rasterised identically from frame to
    // frame and edges hold still instead of swimming as the camera travels.
    const dist = camera.position.distanceTo(camTarget)
    const want = Math.min(Math.max(dist * 0.85, 60), 1500)
    const span = 60 * SPAN_STEP ** Math.ceil(Math.log(want / 60) / Math.log(SPAN_STEP))
    const texel = (2 * span) / MAP
    tmp.r.crossVectors(tmp.up, dir).normalize()
    tmp.u.crossVectors(dir, tmp.r).normalize()
    const c = tmp.c.copy(camTarget).setY(Math.max(camTarget.y, -60))
    const a = Math.round(c.dot(tmp.r) / texel) * texel - c.dot(tmp.r)
    const b = Math.round(c.dot(tmp.u) / texel) * texel - c.dot(tmp.u)
    c.addScaledVector(tmp.r, a).addScaledVector(tmp.u, b)
    s.target.position.copy(c)
    s.position.copy(c).addScaledVector(dir, 2500)
    s.target.updateMatrixWorld()
    const sc = s.shadow.camera
    if (sc.right !== span) {
      sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span
      sc.updateProjectionMatrix()
    }
    s.shadow.normalBias = texel * 1.1
    // underground there is no sun: stop re-rendering its shadow map (but
    // always render it once — an unallocated map fails every shadowed draw)
    s.shadow.autoUpdate = world.sun.intensity > 0.01 || !s.shadow.map
    s.intensity = world.sun.intensity
    s.color.setRGB(world.sun.color.r, world.sun.color.g, world.sun.color.b)

    h.intensity = world.hemi.intensity
    h.color.setRGB(world.hemi.sky.r, world.hemi.sky.g, world.hemi.sky.b)
    h.groundColor.setRGB(world.hemi.ground.r, world.hemi.ground.g, world.hemi.ground.b)

    // the lantern is carried, not mounted on the lens: a little above and to
    // the left of the eye, so its light rakes and models instead of flattening
    l.position.set(-1.6, 2.2, 0.6).applyMatrix4(camera.matrixWorld)
    shared.uLampPos.value.copy(l.position)
    l.intensity = world.lamp * 105
    // above ground the lantern is not just dark but absent: every lit pixel skips it
    l.visible = world.lamp > 0.001
  })

  return (
    <>
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize={[MAP, MAP]}
        shadow-bias={-0.0001}
        shadow-radius={2.2}
        shadow-camera-near={10}
        shadow-camera-far={6000}
      />
      <hemisphereLight ref={hemi} />
      <pointLight ref={lamp} color="#ffd9a8" distance={180} decay={1.6} intensity={0} visible={false} />
    </>
  )
}
