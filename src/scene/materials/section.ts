import {
  AlwaysStencilFunc,
  BackSide,
  Color,
  DecrementWrapStencilOp,
  DoubleSide,
  FrontSide,
  IncrementWrapStencilOp,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NotEqualStencilFunc,
  Plane,
  ShaderMaterial,
  Texture,
  Vector3,
  Vector4,
  ZeroStencilOp,
} from 'three'
import type { IUniform } from 'three'

/**
 * The "section" material family.
 *
 * Everything that belongs to the city is rendered twice — once per half — and
 * clipped against a vertical plane. Front faces use a lit standard material;
 * the cut itself is closed with stencil caps (see below), painted as poché
 * above ground and as archaeological strata below — measured from the local
 * surface.
 *
 * Global look parameters are shared uniforms, so the timeline drives the whole
 * city with a handful of writes per frame.
 */

export type HalfSide = -1 | 1

export type Half = {
  side: HalfSide
  plane: Plane
  /** plane as (normal.xyz, constant) for the cap shader */
  uPlane: IUniform<Vector4>
  /** how far this half has slid sideways: patterns are computed in the city's own frame */
  uOffset: IUniform<number>
}

function makeHalf(side: HalfSide): Half {
  const plane = new Plane(new Vector3(side === -1 ? -1 : 1, 0, 0), 0)
  return { side, plane, uPlane: { value: new Vector4(plane.normal.x, 0, 0, 0) }, uOffset: { value: 0 } }
}

export const halves: Record<'L' | 'R', Half> = { L: makeHalf(-1), R: makeHalf(1) }

/**
 * Positions both cut planes. While the city is whole (`split` false) the left
 * half stops clipping and the right half is hidden, so the city renders once.
 */
export function setOpening(open: number, split: boolean) {
  for (const h of [halves.L, halves.R]) {
    const c = !split && h.side === -1 ? 1e7 : -open
    h.plane.constant = c
    h.uPlane.value.set(h.plane.normal.x, 0, 0, c)
    h.uOffset.value = split ? h.side * open : 0
  }
}

export const shared = {
  uGold: { value: 0 },
  uStrata: { value: 0 },
  uCapAmbient: { value: 1 },
  uLamp: { value: 0 },
  uDusk: { value: 0 },
  uTime: { value: 0 },
  uSunDir: { value: new Vector3(0, 1, 0) },
  uSunCol: { value: new Color(1, 1, 1) },
  uHorizon: { value: new Color('#ebe6dd') },
  uFog: { value: new Vector4(2000, 4000, 0, 0) },
  uViewProj: { value: new Matrix4() },
  uHeightTex: { value: null as Texture | null },
  uHeightRect: { value: new Vector4() },
  uAoTex: { value: null as Texture | null },
  uAoRect: { value: new Vector4() },
}

export type SectionKind = 'building' | 'ground' | 'stone' | 'water' | 'foliage' | 'soil'

export type SectionOptions = {
  half: Half
  kind?: SectionKind
  base?: string
  gold?: string
  roof?: string
  ashlar?: number
  /** ground level of this object, for base occlusion (landmarks) */
  baseY?: number
  roughness?: number
  metalness?: number
  vertexColors?: boolean
  extraClip?: Plane[]
  doubleSided?: boolean
}

/* ── shared GLSL ───────────────────────────────────────────────────────── */

const GLSL_COMMON = /* glsl */ `
  uniform float uGold;
  uniform float uStrata;
  uniform float uDusk;
  uniform vec3 uHorizon;
  uniform sampler2D uHeightTex;
  uniform vec4 uHeightRect;
  uniform sampler2D uAoTex;
  uniform vec4 uAoRect;
  uniform float uOffset;

  // sin-free hash (Hoskins): stable at large world coordinates, cheaper on every GPU
  float sHash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float sNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(sHash(i), sHash(i + vec2(1, 0)), u.x), mix(sHash(i + vec2(0, 1)), sHash(i + vec2(1, 1)), u.x), u.y);
  }
  float sFbm(vec2 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 4; i++) { s += a * sNoise(p); p *= 2.03; a *= 0.5; }
    return s;
  }
  vec3 sLin(vec3 c) { return pow(c, vec3(2.2)); }

  float surfaceAt(vec2 xz) {
    return texture2D(uHeightTex, (xz - uHeightRect.xy) * uHeightRect.zw).r;
  }

  // Archaeological section, as drawn in an excavation report.
  vec3 strataColor(vec3 p, float colourful) {
    float depth = surfaceAt(p.xz) - p.y;
    float h = p.z + p.x * 0.35;
    float wob = (sNoise(vec2(h * 0.015, 3.1)) - 0.5) * 2.4 + (sNoise(vec2(h * 0.09, 7.3)) - 0.5) * 0.7;
    float d = depth - wob;
    vec3 c;
    if (d < 2.5)       c = vec3(0.70, 0.64, 0.56);   // modern fill & paving
    else if (d < 11.0) c = vec3(0.52, 0.39, 0.27);   // medieval
    else if (d < 20.0) c = vec3(0.60, 0.35, 0.23);   // roman
    else if (d < 30.0) c = vec3(0.33, 0.27, 0.22);   // iron age
    else               c = vec3(0.84, 0.63, 0.34);   // Villamayor sandstone
    // soil, not wood: near-isotropic clods and grit, only faint bedding
    float g = sNoise(vec2(h * 0.5, p.y * 0.8)) * 0.5 + sNoise(vec2(h * 2.6, p.y * 3.2)) * 0.3 + sNoise(vec2(h * 9.0, p.y * 9.5)) * 0.2;
    c *= 0.88 + 0.22 * g;
    c *= 0.975 + 0.025 * sin(p.y * 7.0 + sNoise(vec2(h * 0.05, p.y)) * 3.0); // laminations
    float pebble = step(0.965, sHash(floor(vec2(h * 1.4, p.y * 2.0))));
    c *= 1.0 - 0.1 * pebble;
    if (d > 30.0) c *= 0.95 + 0.05 * sin(p.y * 1.9 + sNoise(vec2(h * 0.01, p.y * 0.2)) * 2.0);
    float line = min(min(abs(d - 2.5), abs(d - 11.0)), min(abs(d - 20.0), abs(d - 30.0)));
    c = mix(c, vec3(0.95, 0.9, 0.82), (1.0 - smoothstep(0.0, 0.14, line)) * 0.6);
    vec3 paper = vec3(0.86, 0.84, 0.80) * (0.96 + 0.04 * g);
    paper = mix(paper, paper * 0.78, 1.0 - smoothstep(0.0, 0.12, line));
    return sLin(mix(paper, c, colourful));
  }

  vec3 pocheColor() { return mix(vec3(0.55, 0.53, 0.50), vec3(0.34, 0.23, 0.15), uGold); }
`

/* ── front faces ───────────────────────────────────────────────────────── */

const FRONT_PARS = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uGoldCol;
  uniform vec3 uRoof;
  uniform float uAshlar;
  uniform float uBaseY;
  uniform float uLamp;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec3 vInfo;
  float sWinLit = 0.0;

  float ashlarMask(vec3 p, vec3 n) {
    vec2 uv = abs(n.x) > abs(n.z) ? p.zy : p.xy;
    if (abs(n.y) > 0.6) uv = p.xz;
    float course = floor(uv.y / 0.55);
    float off = mod(course, 2.0) * 0.55;
    vec2 f = vec2(fract((uv.x + off) / 1.1), fract(uv.y / 0.55));
    vec2 aa = fwidth(uv) / vec2(1.1, 0.55) * 1.5;
    float jx = smoothstep(0.0, 0.03 + aa.x, f.x) * smoothstep(0.0, 0.03 + aa.x, 1.0 - f.x);
    float jy = smoothstep(0.0, 0.05 + aa.y, f.y) * smoothstep(0.0, 0.05 + aa.y, 1.0 - f.y);
    float fade = 1.0 - smoothstep(0.15, 0.5, max(aa.x, aa.y));
    float tone = sHash(vec2(floor((uv.x + off) / 1.1), course));
    return ((1.0 - jx * jy) * 0.38 + (tone - 0.5) * 0.14) * fade;
  }
`

const FRONT_COLOR = /* glsl */ `
  {
    vec3 tint = vec3(1.0);
    #ifdef USE_COLOR
      tint = vColor.rgb;
    #endif
    vec3 wn = normalize(vWorldNormal);
    vec3 p = vWorldPos - vec3(uOffset, 0.0, 0.0);
    vec3 col = mix(uBase, uGoldCol, uGold);
    // sandstone grain, stronger in the golden city
    vec2 gp = p.xz * 0.9 + p.y * 0.7;
    float grain = sNoise(gp) * 0.67 + sNoise(gp * 2.03) * 0.33;
    col *= 1.0 + (grain - 0.5) * 0.12 * uGold;

    #ifdef SECTION_BUILDING
      float ground = vInfo.x;
      float roofY = vInfo.y;
      float up = smoothstep(0.55, 0.8, wn.y);
      float hgt = p.y - ground;
      if (up < 0.5) {
        // façades: windows on every floor, doors and shops at street level
        vec2 t = normalize(vec2(-wn.z, wn.x) + 1e-5);
        float u = dot(p.xz, t) / 3.1;
        float v = hgt / 3.3;
        vec2 aa = fwidth(vec2(u, v)) * 1.3;
        float fx = fract(u), fy = fract(v), fl = floor(v);
        float wx = smoothstep(0.3 - aa.x, 0.3 + aa.x, fx) * (1.0 - smoothstep(0.7 - aa.x, 0.7 + aa.x, fx));
        float wy = smoothstep(0.3 - aa.y, 0.3 + aa.y, fy) * (1.0 - smoothstep(0.86 - aa.y, 0.86 + aa.y, fy));
        float upper = step(1.0, fl) * step(p.y, roofY - 1.4);
        float shop = (1.0 - step(1.0, fl)) * step(0.5, sHash(vec2(floor(u), floor(roofY))))
          * smoothstep(0.22 - aa.x, 0.22 + aa.x, fx) * (1.0 - smoothstep(0.78 - aa.x, 0.78 + aa.x, fx))
          * (1.0 - smoothstep(0.78 - aa.y, 0.78 + aa.y, fy)) * step(0.0, hgt);
        float fade = 1.0 - smoothstep(0.2, 0.55, max(aa.x, aa.y));
        float win = max(wx * wy * upper, shop) * fade;
        col = mix(col, vec3(0.045, 0.035, 0.03), win * uGold * 0.9);
        float lit = step(0.62, sHash(vec2(floor(u) + roofY * 3.7, fl)));
        sWinLit = win * lit * uGold;
        // base occlusion and a shadowed cornice line under the roof
        col *= mix(0.58, 1.0, smoothstep(0.0, 6.0, hgt));
        float corn = smoothstep(roofY - 1.1, roofY - 0.9, p.y) - smoothstep(roofY - 0.55, roofY - 0.35, p.y);
        col *= 1.0 - corn * 0.22 * uGold;
      } else {
        // roofs: clay tile courses, or flat modern roofs
        float tiles = 0.88 + 0.12 * smoothstep(0.2, 0.8, abs(sin(p.x * 3.2 + sNoise(p.xz * 0.2) * 2.0)));
        vec3 clay = uRoof * (0.82 + 0.36 * sNoise(p.xz * 0.06 + roofY)) * tiles;
        vec3 flatRoof = vec3(0.44, 0.41, 0.37) * (0.9 + 0.2 * sNoise(p.xz * 0.3));
        vec3 roof = mix(clay, flatRoof, vInfo.z);
        col = mix(uBase * 1.03, roof, uGold);
      }
    #endif

    #if defined(SECTION_STONE) || defined(SECTION_FOLIAGE)
      float up = smoothstep(0.55, 0.8, wn.y);
      col = mix(col, mix(uBase * 1.03, uRoof, uGold), up);
      if (uAshlar > 0.0) col *= 1.0 - uAshlar * ashlarMask(p, wn) * (0.4 + 0.6 * uGold);
      col *= mix(0.62, 1.0, smoothstep(0.0, 5.0, p.y - uBaseY));
    #endif

    #ifdef SECTION_FOLIAGE
      col *= 0.8 + 0.4 * sNoise(p.xz * 0.5 + p.y);
    #endif

    #ifdef SECTION_GROUND
      if (abs(wn.y) < 0.02) {
        // the vertical walls of the block: the archaeological section
        col = strataColor(p, uStrata);
      } else {
        float ao = texture2D(uAoTex, (p.xz - uAoRect.xy) * uAoRect.zw).r;
        col *= 0.97 + 0.06 * sNoise(p.xz * 0.05);
        // riverbanks and the Arrabal: meadows and huertas
        float low = smoothstep(-9.0, -16.0, p.y);
        col = mix(col, sLin(vec3(0.43, 0.46, 0.30)) * (0.8 + 0.4 * sNoise(p.xz * 0.08)), low * uGold * 0.75);
        float slope = 1.0 - smoothstep(0.82, 0.97, wn.y);
        col = mix(col, sLin(vec3(0.55, 0.45, 0.32)), slope * uGold * 0.6);
        col *= 1.0 - ao * 0.55;
      }
    #endif

    #ifdef SECTION_SOIL
      // the excavated floors of the gallery: trodden earth on top, the
      // same strata as the cut faces on every riser
      if (abs(wn.y) < 0.5) {
        col = strataColor(p, 1.0);
      } else {
        float clod = sFbm(p.xz * 0.35) * 0.6 + sNoise(p.xz * 3.1) * 0.25 + sNoise(p.xz * 11.0) * 0.15;
        col = uBase * (0.72 + 0.5 * clod);
        col = mix(col, strataColor(p + vec3(0.0, -0.5, 0.0), 1.0) * 0.7, 0.35);
      }
    #endif

    col *= tint;
    diffuseColor.rgb = col;
  }
`

export function makeSectionMaterial(o: SectionOptions) {
  const kind = o.kind ?? 'building'
  const mat = new MeshStandardMaterial({
    color: '#ffffff',
    roughness: o.roughness ?? 0.92,
    metalness: o.metalness ?? 0,
    side: o.doubleSided ? DoubleSide : FrontSide,
    vertexColors: o.vertexColors ?? false,
    clippingPlanes: [o.half.plane, ...(o.extraClip ?? [])],
    clipShadows: true,
  })
  const local = {
    uBase: { value: new Color(o.base ?? '#f3f0ea') },
    uGoldCol: { value: new Color(o.gold ?? o.base ?? '#c99a5b') },
    uRoof: { value: new Color(o.roof ?? o.gold ?? '#a65a3c') },
    uAshlar: { value: o.ashlar ?? 0 },
    uBaseY: { value: o.baseY ?? 0 },
  }
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, local, { uOffset: o.half.uOffset })
    shader.defines = { ...(shader.defines ?? {}), [`SECTION_${kind.toUpperCase()}`]: '' }

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        varying vec3 vInfo;
        #ifdef SECTION_BUILDING
          attribute vec3 aInfo;
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
          vInfo = aInfo;
        #else
          vInfo = vec3(0.0);
        #endif`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_COMMON}\n${FRONT_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRONT_COLOR}`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.58, 0.26) * sWinLit * uDusk * 2.2;
        #ifdef SECTION_SOIL
          // the same lantern falloff as the cut faces, so floor and walls read as one excavation
          totalEmissiveRadiance += diffuseColor.rgb * uLamp * (exp(-length(vWorldPos - cameraPosition) * 0.011) * 0.75 + 0.08);
        #endif`,
      )
      .replace(
        '#include <opaque_fragment>',
        `#ifdef SECTION_WATER
        {
          vec3 V = normalize(cameraPosition - vWorldPos);
          float fres = pow(1.0 - max(V.y, 0.0), 3.0);
          float ripple = 0.86 + 0.14 * sNoise((vWorldPos.xz - vec2(uOffset, 0.0)) * vec2(0.06, 0.45) + vec2(0.0, uGold * 2.0));
          outgoingLight = mix(outgoingLight, uHorizon * ripple, clamp(fres * mix(0.3, 0.95, uGold), 0.0, 1.0));
        }
        #endif
        #include <opaque_fragment>`,
      )
  }
  mat.customProgramCacheKey = () => `section-${kind}`
  return mat
}

/* ── caps (stencil) ───────────────────────────────────────────────────── */

/**
 * Closing the cut, the robust way. For each half, every solid is drawn twice
 * into the stencil buffer only — back faces increment, front faces decrement —
 * so a pixel keeps a non-zero count exactly where the cut plane lies inside
 * matter. A single quad on the plane is then painted where the count is
 * non-zero (and resets it): poché above ground, strata below.
 */
export function makeStencilMaterials(half: Half, order: number) {
  const base = {
    colorWrite: false,
    depthWrite: false,
    depthTest: false,
    clippingPlanes: [half.plane],
    stencilWrite: true,
    stencilFunc: AlwaysStencilFunc,
  }
  const back = new MeshBasicMaterial({
    ...base,
    side: BackSide,
    stencilFail: IncrementWrapStencilOp,
    stencilZFail: IncrementWrapStencilOp,
    stencilZPass: IncrementWrapStencilOp,
  })
  const front = new MeshBasicMaterial({
    ...base,
    side: FrontSide,
    stencilFail: DecrementWrapStencilOp,
    stencilZFail: DecrementWrapStencilOp,
    stencilZPass: DecrementWrapStencilOp,
  })
  return { back, front, order }
}

export function makeCapMaterial(half: Half) {
  return new ShaderMaterial({
    side: DoubleSide,
    stencilWrite: true,
    stencilRef: 0,
    stencilFunc: NotEqualStencilFunc,
    stencilFail: ZeroStencilOp,
    stencilZFail: ZeroStencilOp,
    stencilZPass: ZeroStencilOp,
    uniforms: { ...shared, uPlane: half.uPlane, uOffset: half.uOffset },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      ${GLSL_COMMON}
      uniform vec4 uPlane;
      uniform float uCapAmbient;
      uniform float uLamp;
      uniform vec3 uSunDir;
      uniform vec3 uSunCol;
      uniform vec4 uFog;
      varying vec3 vWorldPos;
      void main() {
        vec3 q = vWorldPos - vec3(uOffset, 0.0, 0.0);
        vec3 cap = q.y > surfaceAt(q.xz) + 0.15 ? pocheColor() : strataColor(q, uStrata);
        float sun = max(dot(-uPlane.xyz, uSunDir), 0.0); // the face looks away from the kept side
        float dist = length(vWorldPos - cameraPosition);
        float lamp = uLamp * (exp(-dist * 0.011) * 1.25 + 0.1);
        vec3 light = vec3(uCapAmbient * 0.55) + uSunCol * sun * 0.45 * uCapAmbient + vec3(lamp);
        vec3 c = cap * light;
        c = mix(c, uHorizon, smoothstep(uFog.x, uFog.y, dist));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
}
