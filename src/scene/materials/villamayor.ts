import { Color, MeshStandardMaterial } from 'three'

/**
 * Villamayor sandstone, up close: warm arkosic grain, the wavy iron-oxide
 * bands the stone is known for, and the bite of the claw chisel — all
 * procedural, in object space so the pattern turns with the block.
 */
export function makeVillamayorMaterial() {
  const mat = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.94, metalness: 0 })
  const uniforms = {
    uSand: { value: new Color('#c4904f') },
    uOxide: { value: new Color('#8f4a26') },
    uPale: { value: new Color('#d9bb88') },
  }
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform vec3 uSand, uOxide, uPale;
        varying vec3 vObj;
        float vHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float vNoise(vec3 p) {
          vec3 i = floor(p), f = fract(p);
          vec3 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(vHash(i), vHash(i + vec3(1,0,0)), u.x), mix(vHash(i + vec3(0,1,0)), vHash(i + vec3(1,1,0)), u.x), u.y),
                     mix(mix(vHash(i + vec3(0,0,1)), vHash(i + vec3(1,0,1)), u.x), mix(vHash(i + vec3(0,1,1)), vHash(i + vec3(1,1,1)), u.x), u.y), u.z);
        }
        float vFbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vNoise(p); p *= 2.07; a *= 0.5; } return s; }
        float stoneHeight(vec3 p) {
          float grain = vFbm(p * 26.0) * 0.5;
          // claw-chisel strokes, slightly wandering
          float stroke = sin(p.x * 46.0 + p.y * 9.0 + vNoise(p * 3.0) * 4.0);
          float chisel = smoothstep(0.55, 1.0, stroke) * 0.6;
          return grain + chisel * (1.0 - smoothstep(0.9, 1.15, abs(p.z) * 0.9));
        }
        vec3 perturbStone(vec3 surfPos, vec3 surfNorm, float h) {
          vec3 dx = dFdx(surfPos), dy = dFdy(surfPos);
          vec3 r1 = cross(dy, surfNorm), r2 = cross(surfNorm, dx);
          float det = dot(dx, r1) * (gl_FrontFacing ? 1.0 : -1.0);
          vec2 dh = vec2(dFdx(h), dFdy(h)) * 0.012;
          vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
          return normalize(abs(det) * surfNorm - grad);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        {
          vec3 p = vObj;
          // Liesegang rings: thin, irregular, discontinuous
          float warp = vFbm(p * 0.7 + 1.3) * 3.4 + vFbm(p * 2.3) * 0.6;
          float bands = sin((p.x * 0.5 + p.y * 1.1 + p.z * 0.3 + warp) * 3.6);
          float broken = smoothstep(0.3, 0.7, vNoise(p * 1.6 + 7.0));
          float oxide = smoothstep(0.9, 0.995, bands) * broken * (0.5 + 0.5 * vNoise(p * 5.0));
          float pale = smoothstep(0.55, 0.85, vNoise(p * 2.2 + 3.0)) * 0.5;
          vec3 c = uSand * (0.86 + 0.28 * vFbm(p * 12.0));
          c = mix(c, uPale, pale);
          c = mix(c, uOxide, oxide * 0.55);
          c *= 0.92 + 0.08 * vNoise(p * 40.0); // the sparkle of the grain
          diffuseColor.rgb = c;
        }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        normal = perturbStone(-vViewPosition, normal, stoneHeight(vObj));`,
      )
  }
  mat.customProgramCacheKey = () => 'villamayor'
  return mat
}
