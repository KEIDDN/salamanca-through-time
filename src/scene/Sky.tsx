import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, Color, ShaderMaterial, Vector3, type Mesh } from 'three'
import { world } from '../timeline/world'

/** Gradient dome with a soft sun glow. Also feeds the fog its colour. */
export function Sky() {
  const mesh = useRef<Mesh>(null)
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new Color() },
          uHorizon: { value: new Color() },
          uSunDir: { value: new Vector3(0, 1, 0) },
          uSunCol: { value: new Color() },
          uGlow: { value: 0 },
          uTint: { value: 0 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 p = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * p;
            gl_Position.z = gl_Position.w; // always at the far plane
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop, uHorizon, uSunCol, uSunDir;
          uniform float uGlow, uTint;
          varying vec3 vDir;
          void main() {
            float h = clamp(vDir.y, -1.0, 1.0);
            // the horizon warm under the sun, cooler opposite it (matches the city's haze)
            vec3 d = normalize(vDir);
            float toSun = pow(max(dot(d, normalize(uSunDir)), 0.0), 3.0);
            vec3 hz = mix(uHorizon, uHorizon * mix(vec3(0.9, 0.95, 1.07), vec3(1.06, 1.0, 0.91), toSun), uTint);
            vec3 c = mix(hz, uTop, smoothstep(-0.02, 0.55, h));
            c = mix(c, hz * 0.92, smoothstep(0.0, -0.4, h));
            float s = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
            c += uSunCol * uGlow * (pow(s, 7.0) * 0.35 + pow(s, 90.0) * 0.9);
            gl_FragColor = vec4(c, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )

  useFrame(({ camera, scene }) => {
    mesh.current?.position.copy(camera.position)
    const u = mat.uniforms
    u.uTop.value.setRGB(world.sky.top.r, world.sky.top.g, world.sky.top.b)
    u.uHorizon.value.setRGB(world.sky.horizon.r, world.sky.horizon.g, world.sky.horizon.b)
    u.uSunCol.value.setRGB(world.sun.color.r, world.sun.color.g, world.sun.color.b)
    u.uGlow.value = world.sky.glow
    u.uTint.value = world.gold
    const el = (world.sun.elevation * Math.PI) / 180
    const az = (world.sun.azimuth * Math.PI) / 180
    u.uSunDir.value.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az))
    if (scene.fog && 'color' in scene.fog) {
      ;(scene.fog.color as Color).setRGB(world.sky.horizon.r, world.sky.horizon.g, world.sky.horizon.b)
    }
  })

  return (
    <mesh ref={mesh} material={mat} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[4000, 48, 24]} />
    </mesh>
  )
}
