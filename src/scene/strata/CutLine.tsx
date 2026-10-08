import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, DoubleSide, ShaderMaterial, type Mesh, type MeshBasicMaterial } from 'three'
import type { CityData } from '../lib/cityData'
import { SLAB_DEPTH } from '../lib/cityData'
import { world } from '../../timeline/world'

const SHEET_H = 90

/**
 * The incision: a blade of light sweeps along the section axis, leaving a
 * glowing seam across the model and down both ends — then the city opens.
 */
export function CutLine({ data }: { data: CityData }) {
  const { z0, z1 } = data.slab
  const seam = useRef<Mesh>(null)
  const sheet = useRef<Mesh>(null)
  const ends = useRef<Mesh[]>([])
  const seamMat = useRef<MeshBasicMaterial>(null)

  const sheetMat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        toneMapped: false,
        uniforms: { uOpacity: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uOpacity;
          varying vec2 vUv;
          void main() {
            float v = pow(1.0 - vUv.y, 3.0);
            float lead = smoothstep(0.75, 1.0, vUv.x);   // brighter at the leading edge
            gl_FragColor = vec4(vec3(1.0, 0.86, 0.66) * (0.25 + 1.6 * lead) * v * uOpacity, 1.0);
          }`,
      }),
    [],
  )

  useFrame(() => {
    const t = world.cut
    const len = z1 - z0
    const a = Math.min(t / 0.8, 1)
    const b = Math.min(Math.max((t - 0.7) / 0.3, 0), 1)
    if (seam.current) {
      seam.current.scale.z = Math.max(a * len, 0.001)
      seam.current.position.z = z0 + (a * len) / 2
    }
    if (sheet.current) {
      const w = Math.min(a * len, 260)
      sheet.current.scale.set(Math.max(w, 0.001), SHEET_H, 1)
      sheet.current.position.z = z0 + a * len - w / 2
    }
    sheetMat.uniforms.uOpacity.value = a < 1 ? world.cutGlow * Math.sin(a * Math.PI) ** 0.5 : 0
    ends.current.forEach((m) => {
      m.scale.y = Math.max(b * SLAB_DEPTH, 0.001)
      m.position.y = -(b * SLAB_DEPTH) / 2
    })
    if (seamMat.current) seamMat.current.opacity = world.cutGlow
    ends.current.forEach((m) => ((m.material as MeshBasicMaterial).opacity = world.cutGlow))
  })

  return (
    <group>
      <mesh ref={seam} position={[0, 0.7, z0]} renderOrder={2}>
        <boxGeometry args={[0.9, 1.4, 1]} />
        <meshBasicMaterial ref={seamMat} color={[7, 5.6, 4]} toneMapped={false} transparent opacity={0} />
      </mesh>
      <mesh ref={sheet} position={[0, SHEET_H / 2, z0]} rotation-y={-Math.PI / 2} material={sheetMat} renderOrder={3}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      {[z0, z1].map((z, i) => (
        <mesh key={z} ref={(m) => { if (m) ends.current[i] = m }} position={[0, 0, z]}>
          <boxGeometry args={[0.9, 1, 0.9]} />
          <meshBasicMaterial color={[7, 5.6, 4]} toneMapped={false} transparent opacity={0} />
        </mesh>
      ))}
    </group>
  )
}
