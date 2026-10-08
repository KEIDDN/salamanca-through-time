import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, LineBasicMaterial, ShaderMaterial, type LineSegments } from 'three'
import type { CityData } from '../lib/cityData'
import { terrainFor } from '../lib/terrain'
import { BULBS, shared } from '../materials/section'
import { LEVELS } from './exhibitGeometry'
import { seeded } from '../lib/cityData'
import { world } from '../../timeline/world'

/**
 * What makes the gallery a dig and not an empty hall: the work lights strung
 * along both walls — coming on one after another as we go down, receding into
 * the dark — the cable they hang from, and the dust that hangs in the light.
 * Their light on walls and floor is computed in the materials (GLSL_BULBS);
 * here are only the bulbs themselves: three draw calls in all.
 */
export function Excavation({ data }: { data: CityData }) {
  const terrain = terrainFor(data)
  const floorAt = (z: number) => {
    const l = LEVELS.find((v) => z < v.z1) ?? LEVELS[LEVELS.length - 1]
    return terrain.heightAt(0, z) - l.depth
  }

  const { bulbs, cable } = useMemo(() => {
    const pos: number[] = []
    const t: number[] = []
    const line: number[] = []
    for (const sx of [-1, 1]) {
      let prev: [number, number, number] | null = null
      for (let i = 0; i < BULBS.count; i++) {
        const z = BULBS.z0 + i * BULBS.step
        if (z > BULBS.zEnd) break
        const p: [number, number, number] = [sx * BULBS.x, floorAt(z) + BULBS.lift, z]
        pos.push(...p)
        t.push((z - BULBS.z0) / (BULBS.zEnd - BULBS.z0))
        // the cable sags between bulbs (and steps down with the floor)
        if (prev) {
          const N = 6
          for (let k = 0; k < N; k++) {
            const a = k / N, b = (k + 1) / N
            const y = (u: number) => prev![1] + (p[1] - prev![1]) * u + 0.12 - 0.38 * (1 - (2 * u - 1) ** 2)
            line.push(sx * BULBS.x, y(a), prev[2] + (p[2] - prev[2]) * a, sx * BULBS.x, y(b), prev[2] + (p[2] - prev[2]) * b)
          }
        }
        prev = p
      }
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
    g.setAttribute('aT', new BufferAttribute(new Float32Array(t), 1))
    const c = new BufferGeometry()
    c.setAttribute('position', new BufferAttribute(new Float32Array(line), 3))
    return { bulbs: g, cable: c }
  }, [terrain]) // eslint-disable-line react-hooks/exhaustive-deps

  const bulbMat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
        uniforms: { uOn: shared.uBulbs, uScale: { value: 1 }, uTime: shared.uTime },
        vertexShader: /* glsl */ `
          uniform float uOn, uScale, uTime;
          attribute float aT;
          varying float vI;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            // each bulb comes on in turn — with a stutter as the current reaches it
            float on = smoothstep(aT - 0.02, aT + 0.005, uOn * 1.06);
            float flick = on < 0.999 ? 0.55 + 0.45 * step(0.5, fract(sin(uTime * 37.0 + aT * 91.0) * 43758.5)) : 1.0;
            vI = on * flick;
            gl_Position = projectionMatrix * mv;
            // a halo of ~0.9 m, never smaller than a few pixels so distant bulbs still read as points
            gl_PointSize = max(uScale * 0.9 / -mv.z, 3.0) * step(0.001, vI);
          }`,
        fragmentShader: /* glsl */ `
          varying float vI;
          void main() {
            float r = length(gl_PointCoord - 0.5) * 2.0;
            float core = exp(-r * r * 60.0) * 3.0;
            float halo = exp(-r * r * 5.0) * 0.35;
            gl_FragColor = vec4(vec3(1.0, 0.72, 0.42) * (core + halo) * vI, 1.0);
          }`,
      }),
    [],
  )
  const cableMat = useMemo(() => new LineBasicMaterial({ color: new Color('#120d09') }), [])

  // dust: a box of motes around the eye, wrapped on the GPU, seen only where the lantern lights it
  const DUST = 900
  const dust = useMemo(() => {
    const rand = seeded(57)
    const p = new Float32Array(DUST * 3)
    for (let i = 0; i < DUST * 3; i++) p[i] = rand()
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(p, 3))
    return g
  }, [])
  const dustMat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
        uniforms: { uLamp: shared.uLamp, uLampPos: shared.uLampPos, uTime: shared.uTime, uScale: { value: 1 } },
        vertexShader: /* glsl */ `
          uniform float uLamp, uTime, uScale;
          uniform vec3 uLampPos;
          varying float vI;
          const vec3 BOX = vec3(26.0, 12.0, 26.0);
          void main() {
            vec3 seed = position;
            // slow Brownian drift, wrapped into a box that travels with the eye
            vec3 drift = vec3(sin(uTime * 0.07 + seed.y * 40.0), -0.35 + 0.2 * sin(uTime * 0.05 + seed.x * 30.0), cos(uTime * 0.06 + seed.z * 50.0)) * uTime * 0.05;
            vec3 local = mod(seed * BOX + drift - cameraPosition, BOX) - BOX * 0.5;
            vec3 wp = cameraPosition + local;
            vec4 mv = viewMatrix * vec4(wp, 1.0);
            float d = length(wp - uLampPos);
            // lit by the lantern, fading out at the edges of the box so the wrap is never seen
            vI = uLamp * exp(-d * 0.16) * (1.0 - smoothstep(0.35, 0.5, max(abs(local.x) / BOX.x, max(abs(local.y) / BOX.y, abs(local.z) / BOX.z))));
            vI *= 0.6 + 0.4 * sin(uTime * 0.8 + seed.x * 60.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = clamp(uScale * 0.022 / -mv.z, 1.0, 4.0) * step(0.002, vI);
          }`,
        fragmentShader: /* glsl */ `
          varying float vI;
          void main() {
            float r = length(gl_PointCoord - 0.5) * 2.0;
            gl_FragColor = vec4(vec3(1.0, 0.86, 0.66) * (1.0 - smoothstep(0.3, 1.0, r)) * vI * 0.55, 1.0);
          }`,
      }),
    [],
  )

  const cableRef = useRef<LineSegments>(null)
  useFrame(({ size, camera, gl }) => {
    if (cableRef.current) cableRef.current.visible = world.lamp > 0.001
    // point sizes in world units: pixels per metre at distance 1
    const fov = 'fov' in camera ? ((camera as unknown as { fov: number }).fov * Math.PI) / 180 : 1
    const k = (size.height * gl.getPixelRatio()) / (2 * Math.tan(fov / 2))
    bulbMat.uniforms.uScale.value = k
    dustMat.uniforms.uScale.value = k
  })

  return (
    <group>
      <lineSegments ref={cableRef} geometry={cable} material={cableMat} visible={false} />
      <points geometry={bulbs} material={bulbMat} frustumCulled={false} renderOrder={5} />
      <points geometry={dust} material={dustMat} frustumCulled={false} renderOrder={6} />
    </group>
  )
}
