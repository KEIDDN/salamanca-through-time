import { MeshStandardMaterial } from 'three'

/**
 * Weathered granite, as the Vettones carved it: a warm grey ground of
 * quartz, white feldspar crystals, black flecks of biotite, a crust of pale
 * lichen on the upward faces — procedural, in object space, with a fine
 * crystalline bump so the stone catches a raking light.
 */
export function makeGraniteMaterial() {
  const mat = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.86, metalness: 0 })
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;\nvarying vec3 vObjN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;\nvObjN = normal;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        varying vec3 vObj;
        varying vec3 vObjN;
        float gHash(vec3 p3) {
          p3 = fract(p3 * 0.1031);
          p3 += dot(p3, p3.zyx + 31.32);
          return fract((p3.x + p3.y) * p3.z);
        }
        float gNoise(vec3 p) {
          vec3 i = floor(p), f = fract(p);
          vec3 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(gHash(i), gHash(i + vec3(1,0,0)), u.x), mix(gHash(i + vec3(0,1,0)), gHash(i + vec3(1,1,0)), u.x), u.y),
                     mix(mix(gHash(i + vec3(0,0,1)), gHash(i + vec3(1,0,1)), u.x), mix(gHash(i + vec3(0,1,1)), gHash(i + vec3(1,1,1)), u.x), u.y), u.z);
        }
        float crystals(vec3 p) {
          return gNoise(p * 34.0) * 0.6 + gNoise(p * 13.0) * 0.4;
        }`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        {
          vec3 p = vObj;
          float aa = clamp(length(fwidth(p)) * 22.0, 0.0, 1.0); // fade the crystals out with distance
          float feld = smoothstep(0.62, 0.74, gNoise(p * 13.0 + 4.0));
          float bio = smoothstep(0.7, 0.8, gNoise(p * 41.0 + 11.0)) * (1.0 - aa);
          vec3 c = vec3(0.47, 0.44, 0.40) * (0.86 + 0.28 * gNoise(p * 2.1));
          c = mix(c, vec3(0.74, 0.70, 0.64), feld * (1.0 - aa * 0.6));
          c = mix(c, vec3(0.07, 0.065, 0.06), bio * 0.85);
          // weather and lichen, on what faces the sky
          float up = smoothstep(0.15, 0.85, normalize(vObjN).y);
          float lichen = smoothstep(0.55, 0.75, gNoise(p * 3.3 + 20.0)) * up;
          c = mix(c, vec3(0.62, 0.60, 0.48), lichen * 0.55);
          c *= 0.9 + 0.12 * up;
          diffuseColor.rgb = c;
        }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        {
          vec3 dx = dFdx(-vViewPosition), dy = dFdy(-vViewPosition);
          vec3 r1 = cross(dy, normal), r2 = cross(normal, dx);
          float det = dot(dx, r1);
          float h = crystals(vObj);
          vec2 dh = vec2(dFdx(h), dFdy(h)) * 0.006;
          normal = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2));
        }`,
      )
  }
  mat.customProgramCacheKey = () => 'granite'
  return mat
}
