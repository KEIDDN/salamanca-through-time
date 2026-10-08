import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, type PerspectiveCamera } from 'three'
import type { CityData } from './lib/cityData'
import { buildCurves, buildShots } from '../timeline/shots'
import { world } from '../timeline/world'
import { camTarget } from './lib/camTarget'

export function CameraRig({ data }: { data: CityData }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const curves = useMemo(() => buildCurves(buildShots(data)), [data])
  const pos = useMemo(() => new Vector3(), [])

  useFrame(({ clock }) => {
    const t = Math.min(Math.max(world.cam, 0), 1)
    curves.pos.getPoint(t, pos)
    curves.tgt.getPoint(t, camTarget)
    // a breath of handheld drift, scaled to the shot
    const dist = pos.distanceTo(camTarget)
    const e = clock.elapsedTime
    const k = Math.min(dist, 400) * 0.0016
    pos.x += Math.sin(e * 0.31) * k
    pos.y += Math.sin(e * 0.23 + 1.3) * k * 0.6
    camera.position.copy(pos)
    camera.lookAt(camTarget)
    if (Math.abs(camera.fov - world.fov) > 1e-3) {
      camera.fov = world.fov
      camera.updateProjectionMatrix()
    }
    // keep depth precision where it matters
    const near = pos.y > 300 ? 4 : 0.3
    if (camera.near !== near) {
      camera.near = near
      camera.updateProjectionMatrix()
    }
  })
  return null
}
