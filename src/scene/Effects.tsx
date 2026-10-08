import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, N8AO, Noise, SMAA, TiltShift2, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { world } from '../timeline/world'
import { camTarget } from './lib/camTarget'

type N8AOHandle = { configuration: { aoRadius: number; distanceFalloff: number; intensity: number } }
type TiltHandle = { blur: number }

/**
 * Post stack: ambient occlusion (the architectural-model look), a whisper of
 * bloom for the low sun, tilt-shift for the miniature aerials, film grain.
 */
export function Effects() {
  const ao = useRef<N8AOHandle>(null)
  const tilt = useRef<TiltHandle>(null)

  useFrame(({ camera }) => {
    const d = camera.position.distanceTo(camTarget)
    if (ao.current) {
      const c = ao.current.configuration
      c.aoRadius = Math.min(Math.max(d * 0.03, 1.2), 42)
      c.distanceFalloff = c.aoRadius * 0.2
      c.intensity = 2.4 + world.gold * 0.8
    }
    if (tilt.current) tilt.current.blur = world.tilt * 0.22
  })

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO ref={ao as never} halfRes aoRadius={6} intensity={2.6} distanceFalloff={1} quality="medium" />
      <Bloom mipmapBlur intensity={0.5} luminanceThreshold={1.05} luminanceSmoothing={0.2} />
      <TiltShift2 ref={tilt as never} blur={0} taper={0.6} start={[0.5, 0.25]} end={[0.5, 0.75]} samples={6} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.28} darkness={0.55} blendFunction={BlendFunction.NORMAL} />
      <Noise opacity={0.035} premultiply blendFunction={BlendFunction.SOFT_LIGHT} />
      <SMAA />
    </EffectComposer>
  )
}
