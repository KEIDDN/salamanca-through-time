import { Color, MeshStandardMaterial } from 'three'
import { GLSL_BULBS, shared } from './section'

/**
 * Villamayor sandstone, up close: warm arkosic grain, the wavy iron-oxide
 * bands the stone is known for, and the bite of the claw chisel — all
 * procedural, in object space so the pattern turns with the block.
 */
/** How brightly the cracks of the broken block glow (0 = whole stone). */
export const crack = { value: 0 }

/**
 * `broken`: the material of the fractured hero block, whose geometry flags
 * fracture faces with `aCut` — fresh, paler stone, lit from inside.
 */
export function makeVillamayorMaterial({ broken = false } = {}) {
  const mat = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.94, metalness: 0 })
  const uniforms = {
    uSand: { value: new Color('#c39a5f') },
    uOxide: { value: new Color('#8f4a26') },
    uPale: { value: new Color('#dcc497') },
    uCrack: crack,
    uBulbs: shared.uBulbs,
    uLevelZ: shared.uLevelZ,
    uLevelD: shared.uLevelD,
    uHeightTex: shared.uHeightTex,
    uHeightRect: shared.uHeightRect,
  }
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    if (broken) shader.defines = { ...(shader.defines ?? {}), BROKEN: '' }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;\nvarying vec3 vWorld;\n#ifdef BROKEN\nattribute float aCut;\nvarying float vCut;\n#endif')
      // quarry blocks are instances of one box: each takes its pattern from
      // where it lies in the bed, so no two blocks are the same stone
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;\n#ifdef USE_INSTANCING\nvObj = (instanceMatrix * vec4(position, 1.0)).xyz;\n#endif\n#ifdef BROKEN\nvCut = aCut;\n#endif')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorld = (modelMatrix * vec4(vObj, 1.0)).xyz;\n#ifndef USE_INSTANCING\nvWorld = (modelMatrix * vec4(position, 1.0)).xyz;\n#endif')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform vec3 uSand, uOxide, uPale;
        uniform float uCrack;
        uniform sampler2D uHeightTex;
        uniform vec4 uHeightRect;
        float surfaceAt(vec2 xz) { return texture2D(uHeightTex, (xz - uHeightRect.xy) * uHeightRect.zw).r; }
        ${GLSL_BULBS}
        varying vec3 vObj;
        varying vec3 vWorld;
        #ifdef BROKEN
          varying float vCut;
        #endif
        float vHash(vec3 p3) {
          p3 = fract(p3 * 0.1031);
          p3 += dot(p3, p3.zyx + 31.32);
          return fract((p3.x + p3.y) * p3.z);
        }
        float vNoise(vec3 p) {
          vec3 i = floor(p), f = fract(p);
          vec3 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(vHash(i), vHash(i + vec3(1,0,0)), u.x), mix(vHash(i + vec3(0,1,0)), vHash(i + vec3(1,1,0)), u.x), u.y),
                     mix(mix(vHash(i + vec3(0,0,1)), vHash(i + vec3(1,0,1)), u.x), mix(vHash(i + vec3(0,1,1)), vHash(i + vec3(1,1,1)), u.x), u.y), u.z);
        }
        float vFbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vNoise(p); p *= 2.07; a *= 0.5; } return s; }
        float stoneHeight(vec3 p) {
          float grain = vFbm(p * 26.0) * 0.5;
          // the bite of the claw chisel: short, scattered pocks rather than stripes
          float chisel = smoothstep(0.62, 0.95, vNoise(p * vec3(16.0, 7.0, 16.0) + vNoise(p * 2.0) * 2.0)) * 0.35;
          #ifdef BROKEN
            chisel *= 1.0 - vCut; // fresh fractures were never dressed
          #endif
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
          float pale = smoothstep(0.42, 0.78, vFbm(p * 1.7 + 3.0)) * 0.26; // soft, not blotched
          vec3 c = uSand * (0.86 + 0.28 * vFbm(p * 12.0));
          c = mix(c, uPale, pale);
          c = mix(c, uOxide, oxide * 0.55);
          c *= 0.92 + 0.08 * vNoise(p * 40.0); // the sparkle of the grain
          #ifdef BROKEN
            // inside, the stone has never seen the air: paler, not yet gold
            c = mix(c, mix(uSand, uPale, 0.35) * (0.9 + 0.14 * vNoise(p * 9.0)), vCut * 0.75);
          #endif
          diffuseColor.rgb = c;
        }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        normal = perturbStone(-vViewPosition, normal, stoneHeight(vObj));`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (uBulbs > 0.0) totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.74, 0.46) * bulbLight(vWorld) * 0.8;
        #ifdef BROKEN
          // the stone itself glowing (tinted by its own colour), not a white light
          totalEmissiveRadiance += diffuseColor.rgb * vec3(1.5, 0.95, 0.5) * uCrack * vCut * (0.6 + 0.4 * vNoise(vObj * 6.0));
        #endif`,
      )
  }
  mat.customProgramCacheKey = () => (broken ? 'villamayor-broken' : 'villamayor')
  return mat
}
