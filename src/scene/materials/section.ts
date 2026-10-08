import { Color, DoubleSide, FrontSide, MeshStandardMaterial, Plane, Vector3, Vector4 } from 'three'
import type { IUniform } from 'three'

/**
 * The "section" material family.
 *
 * Everything that belongs to the city is rendered twice — once per half — and
 * clipped against a vertical plane. Back faces exposed by the clip are painted
 * as a solid cap (poché above ground, archaeological strata below), computed by
 * intersecting the view ray with the cut plane so the pattern sits exactly on
 * the section face.
 *
 * Global look parameters (gold, strata, lamp...) are shared uniforms, so the
 * timeline can drive hundreds of materials with a handful of writes per frame.
 */

export type HalfSide = -1 | 1

export type Half = {
  side: HalfSide
  plane: Plane
  /** plane as (normal.xyz, constant) for the cap shader */
  uPlane: IUniform<Vector4>
}

function makeHalf(side: HalfSide): Half {
  // keeps x <= -open (left) or x >= open (right)
  const plane = new Plane(new Vector3(side === -1 ? -1 : 1, 0, 0), 0)
  return { side, plane, uPlane: { value: new Vector4(plane.normal.x, 0, 0, 0) } }
}

export const halves: Record<'L' | 'R', Half> = { L: makeHalf(-1), R: makeHalf(1) }

/**
 * Positions both cut planes. While the city is whole (`split` false) the left
 * half stops clipping and the right half is hidden, so the city renders once.
 */
export function setOpening(open: number, split: boolean) {
  for (const h of [halves.L, halves.R]) {
    // world-space plane at x = side*open, normal pointing into the kept side
    const c = !split && h.side === -1 ? 1e7 : -open
    h.plane.constant = c
    h.uPlane.value.set(h.plane.normal.x, 0, 0, c)
  }
}

export const shared = {
  uGold: { value: 0 },
  uStrata: { value: 0 },
  uCapAmbient: { value: 1 },
  uLamp: { value: 0 },
  uTime: { value: 0 },
  uSun: { value: new Vector3(0, 1, 0) },
  /** sky colour at the horizon, mirrored by the river */
  uHorizon: { value: new Color('#ebe6dd') },
}

export type SectionKind = 'building' | 'ground' | 'stone' | 'water' | 'dark'

export type SectionOptions = {
  half: Half
  kind?: SectionKind
  /** colour of the white-model state */
  base?: string
  /** colour of the golden state */
  gold?: string
  /** roof colour in the golden state (upward faces) */
  roof?: string
  /** carve ashlar coursing into the stone (landmarks, close-up work) */
  ashlar?: number
  roughness?: number
  metalness?: number
  vertexColors?: boolean
  caps?: boolean
  extraClip?: Plane[]
}

const GLSL_COMMON = /* glsl */ `
  uniform float uGold;
  uniform float uStrata;
  uniform float uCapAmbient;
  uniform float uLamp;
  uniform vec4 uPlane;
  uniform vec3 uBase;
  uniform vec3 uGoldCol;
  uniform vec3 uRoof;
  uniform float uAshlar;
  uniform vec3 uHorizon;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying float vRoof;

  float sHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float sNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(sHash(i), sHash(i + vec2(1, 0)), u.x), mix(sHash(i + vec2(0, 1)), sHash(i + vec2(1, 1)), u.x), u.y);
  }
  vec3 sLin(vec3 c) { return pow(c, vec3(2.2)); }

  // Archaeological section, as drawn on an excavation report.
  vec3 strataColor(vec3 p, float colourful) {
    float h = p.z + p.x * 0.35;
    float wob = (sNoise(vec2(h * 0.015, 3.1)) - 0.5) * 2.6 + (sNoise(vec2(h * 0.08, 7.3)) - 0.5) * 0.7;
    float y = p.y + wob;
    vec3 c;
    if (y > -2.5)       c = vec3(0.78, 0.74, 0.68);   // modern fill & paving
    else if (y > -11.0) c = vec3(0.50, 0.38, 0.27);   // medieval
    else if (y > -20.0) c = vec3(0.56, 0.33, 0.22);   // roman
    else if (y > -30.0) c = vec3(0.30, 0.25, 0.21);   // iron age
    else                c = vec3(0.80, 0.60, 0.33);   // Villamayor sandstone bedrock
    // grain & inclusions
    float g = sNoise(vec2(h * 0.9, p.y * 2.2));
    c *= 0.86 + 0.26 * g;
    float pebble = step(0.93, sHash(floor(vec2(h * 1.4, p.y * 2.0))));
    c *= 1.0 - 0.2 * pebble;
    // bedding planes in the sandstone
    if (y < -30.0) c *= 0.92 + 0.08 * sin(p.y * 2.7 + sNoise(vec2(h * 0.04, p.y * 0.3)) * 5.0);
    // hairlines between layers
    float d = min(min(abs(y + 2.5), abs(y + 11.0)), min(abs(y + 20.0), abs(y + 30.0)));
    c = mix(c, vec3(0.93, 0.88, 0.80), (1.0 - smoothstep(0.0, 0.14, d)) * 0.55);
    vec3 paper = vec3(0.86, 0.84, 0.80) * (0.96 + 0.04 * g);
    paper = mix(paper, paper * 0.8, (1.0 - smoothstep(0.0, 0.1, d)));
    return sLin(mix(paper, c, colourful));
  }

  float ashlarMask(vec3 p, vec3 n) {
    // stone courses ~0.55m, blocks ~1.1m, staggered
    vec2 uv = abs(n.x) > abs(n.z) ? p.zy : p.xy;
    if (abs(n.y) > 0.6) uv = p.xz;
    float course = floor(uv.y / 0.55);
    float off = mod(course, 2.0) * 0.55;
    vec2 f = vec2(fract((uv.x + off) / 1.1), fract(uv.y / 0.55));
    float m = min(min(f.x, 1.0 - f.x) * 1.1 / 0.03, min(f.y, 1.0 - f.y) * 0.55 / 0.03);
    float joint = 1.0 - clamp(m, 0.0, 1.0);
    float tone = sHash(vec2(floor((uv.x + off) / 1.1), course));
    return joint * 0.35 + (tone - 0.5) * 0.12;
  }
`

export function makeSectionMaterial(o: SectionOptions) {
  const kind = o.kind ?? 'building'
  const caps = o.caps ?? kind !== 'water'
  const mat = new MeshStandardMaterial({
    color: '#ffffff',
    roughness: o.roughness ?? 0.92,
    metalness: o.metalness ?? 0,
    side: caps ? DoubleSide : FrontSide,
    vertexColors: o.vertexColors ?? false,
    clippingPlanes: [o.half.plane, ...(o.extraClip ?? [])],
    clipShadows: true,
    shadowSide: FrontSide,
  })
  const local = {
    uBase: { value: new Color(o.base ?? '#f3f0ea') },
    uGoldCol: { value: new Color(o.gold ?? o.base ?? '#c99a5b') },
    uRoof: { value: new Color(o.roof ?? o.gold ?? '#a65a3c') },
    uAshlar: { value: o.ashlar ?? 0 },
  }
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, local, { uPlane: o.half.uPlane })
    shader.defines = { ...(shader.defines ?? {}), [`SECTION_${kind.toUpperCase()}`]: '', SECTION_CAPS: caps ? 1 : 0 }

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        varying float vRoof;
        #ifdef SECTION_BUILDING
          attribute float aRoof;
        #endif`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 sWp = vec4(transformed, 1.0);
        vec3 sWn = objectNormal;
        #ifdef USE_INSTANCING
          sWp = instanceMatrix * sWp;
          sWn = mat3(instanceMatrix) * sWn;
        #endif
        vWorldPos = (modelMatrix * sWp).xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * sWn);
        #ifdef SECTION_BUILDING
          vRoof = aRoof;
        #else
          vRoof = 0.0;
        #endif`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_COMMON}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec3 tint = vec3(1.0);
          #ifdef USE_COLOR
            tint = vColor.rgb;
          #endif
          vec3 wn = normalize(vWorldNormal);
          vec3 col = mix(uBase, uGoldCol, uGold);
          #if defined(SECTION_BUILDING) || defined(SECTION_STONE)
            float up = smoothstep(0.55, 0.8, wn.y);
            vec3 roof = mix(uRoof * (0.85 + 0.3 * sNoise(vWorldPos.xz * 0.07)), vec3(0.42, 0.39, 0.35), vRoof);
            col = mix(col, mix(uBase * 1.03, roof, uGold), up);
          #endif
          col *= tint;
          #ifdef SECTION_GROUND
            if (abs(wn.y) < 0.5) col = strataColor(vWorldPos, uStrata);
            else col *= 0.97 + 0.06 * sNoise(vWorldPos.xz * 0.05);
          #endif
          if (uAshlar > 0.0) col *= 1.0 - uAshlar * ashlarMask(vWorldPos, wn);
          diffuseColor.rgb = col;
        }`,
      )
      .replace(
        '#include <opaque_fragment>',
        `#ifdef SECTION_WATER
        {
          vec3 V = normalize(cameraPosition - vWorldPos);
          float fres = pow(1.0 - max(V.y, 0.0), 4.0);
          float ripple = 0.85 + 0.15 * sNoise(vWorldPos.xz * vec2(0.08, 0.5));
          outgoingLight = mix(outgoingLight, uHorizon * ripple, fres * mix(0.25, 0.85, uGold));
        }
        #endif
        #include <opaque_fragment>
        #if SECTION_CAPS == 1
        if (!gl_FrontFacing) {
          vec3 rd = vWorldPos - cameraPosition;
          float t = -(dot(uPlane.xyz, cameraPosition) + uPlane.w) / dot(uPlane.xyz, rd);
          vec3 p = cameraPosition + rd * clamp(t, 0.0, 1.0);
          vec3 cap;
          if (p.y > 0.05) {
            // poché of cut buildings
            cap = mix(vec3(0.55, 0.53, 0.50), vec3(0.20, 0.12, 0.07), uGold);
          } else {
            cap = strataColor(p, uStrata);
          }
          float dist = length(p - cameraPosition);
          float lamp = uLamp * (exp(-dist * 0.011) * 1.25 + 0.1);
          gl_FragColor = vec4(cap * (uCapAmbient + lamp), 1.0);
        }
        #endif`,
      )
  }
  mat.customProgramCacheKey = () => `section-${kind}-${caps ? 1 : 0}`
  return mat
}
