import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { HalfFloatType, Matrix4, PerspectiveCamera, Plane, Vector2, Vector3, Vector4, WebGLRenderTarget } from 'three'
import { WATER_Y } from './lib/terrain'
import { shared } from './materials/section'
import { world } from '../timeline/world'

/** Layer of the water sheet: seen by the film's camera, never by its mirror. */
export const WATER_LAYER = 1

/** fraction of the frame's resolution; phones get less */
const RES = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches ? 0.35 : 0.5
const bias = new Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)

/** A render target like the reflection's, for compiling its shader variants up front. */
export const makeReflectionTarget = (w = 1, h = 1) => new WebGLRenderTarget(w, h, { type: HalfFloatType, depthBuffer: true })

/**
 * The Tormes as a mirror, only while the film is on the river: the scene is
 * rendered once more from the camera reflected in the water plane, at half
 * resolution, without the water itself and without redrawing the sun's
 * shadow map. An oblique near plane clips everything below the waterline
 * (no extra clipping planes, so no extra shader variants). The water shader
 * projects the image back with a ripple offset — in linear HDR, before tone
 * mapping, like the rest of the frame.
 */
export function WaterReflection() {
  const { gl, scene, camera } = useThree()
  const rt = useMemo(() => makeReflectionTarget(), [])
  const mirror = useMemo(() => new PerspectiveCamera(), [])
  const tmp = useMemo(
    () => ({ t: new Vector3(), d: new Vector3(), size: new Vector2(), plane: new Plane(), clip: new Vector4(), q: new Vector4(), n: new Vector3(0, 1, 0), p: new Vector3(0, WATER_Y, 0) }),
    [],
  )

  useEffect(() => {
    camera.layers.enable(WATER_LAYER)
    shared.uReflTex.value = rt.texture
    return () => rt.dispose()
  }, [camera, rt])

  useFrame(() => {
    shared.uReflect.value = world.reflect
    if (world.reflect < 0.001) return
    gl.getDrawingBufferSize(tmp.size)
    const w = Math.max(1, Math.round(tmp.size.x * RES)), h = Math.max(1, Math.round(tmp.size.y * RES))
    if (rt.width !== w || rt.height !== h) rt.setSize(w, h)

    // the camera, mirrored in the plane y = WATER_Y
    const cam = camera as PerspectiveCamera
    mirror.copy(cam, false)
    mirror.layers.set(0)
    mirror.position.copy(cam.position).setY(2 * WATER_Y - cam.position.y)
    cam.getWorldDirection(tmp.d)
    tmp.t.copy(cam.position).add(tmp.d)
    tmp.t.y = 2 * WATER_Y - tmp.t.y
    mirror.up.set(0, -1, 0)
    mirror.lookAt(tmp.t)
    mirror.updateMatrixWorld()
    mirror.projectionMatrix.copy(cam.projectionMatrix)
    shared.uReflMatrix.value.copy(bias).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse)

    // oblique near plane on the water (Lengyel), as in three's Reflector
    tmp.plane.setFromNormalAndCoplanarPoint(tmp.n, tmp.p).applyMatrix4(mirror.matrixWorldInverse)
    const c = tmp.clip.set(tmp.plane.normal.x, tmp.plane.normal.y, tmp.plane.normal.z, tmp.plane.constant)
    const e = mirror.projectionMatrix.elements
    tmp.q.set((Math.sign(c.x) + e[8]) / e[0], (Math.sign(c.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14])
    c.multiplyScalar(2 / c.dot(tmp.q))
    e[2] = c.x
    e[6] = c.y
    e[10] = c.z + 1 - 0.003
    e[14] = c.w
    mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert()

    const prevTarget = gl.getRenderTarget()
    const prevShadow = gl.shadowMap.autoUpdate
    gl.shadowMap.autoUpdate = false
    gl.setRenderTarget(rt)
    gl.clear()
    gl.render(scene, mirror)
    gl.setRenderTarget(prevTarget)
    gl.shadowMap.autoUpdate = prevShadow
  })
  return null
}
