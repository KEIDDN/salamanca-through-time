# Salamanca — A City Through Time

An interactive, scroll-driven film about Salamanca, Spain, rendered in real time with **Three.js**.

The city is the interface. A white architectural model of Salamanca's real street plan turns into the golden city at street level in Plaza Mayor. Then a blade of light cuts the city in two, from Plaza Mayor down to the Roman bridge. The camera descends into the section and travels back through time: medieval walls, the Vía de la Plata, a Vetton hill-fort, the sandstone bedrock. It then rises over the Tormes at sunset.

> **Chapter I — The Descent** is the prototype of the opening minute. The University, Culture and Today chapters come next.

## Stack

- **Three.js** (r186): every mesh, light, shader and camera move is real-time 3D
- React 19 + TypeScript + Vite
- React Three Fiber · Drei · @react-three/postprocessing (N8AO, bloom, tilt-shift)
- GSAP + ScrollTrigger: one master timeline drives camera, light, the section and the typography
- Lenis smooth scrolling
- Inter + Cormorant Garamond

## How it works

| Layer | Where |
| --- | --- |
| Terrain: the plateau of the old town falls ~22 m to the Tormes; the far bank is the flat Arrabal. Strata are measured from the local surface | `src/scene/lib/terrain.ts` |
| Real geometry: 2,800 building footprints, courtyards included, plus the Tormes, Plaza Mayor, both cathedrals and the Roman bridge from OpenStreetMap, projected to metres and rotated so the section runs along +z | `scripts/build-city.mjs` → `public/data/salamanca.json` |
| Roofs: every OSM building is a closed solid with a real roof. Each footprint edge is inset by its own distance — the full slope on a street or courtyard front, none on a party wall shared with the next house — so terraces get one continuous ridge and free ends get hips; chimneys on the slopes, parapets and stair housings on modern flat roofs | `src/scene/city/massing.ts`, `src/scene/city/geometry.ts` |
| Hand-modelled landmarks: Plaza Mayor (88 arches, real window reveals, moulded surrounds, wrought-iron balconies, pierced balustrade, stepped cornice, granite paving, lamp standards and people for scale), the New Cathedral in three tiers with buttresses, flying buttresses, crestings, stepped portal, ribbed crossing dome and the staged bell tower, the Old Cathedral and Torre del Gallo, La Clerecía, the Casa de las Conchas, the Escuelas Mayores, and the 26-arch bridge with a verraco | `src/scene/landmarks/` |
| Ironwork: balconies are single panels whose bars are cut by the shader and resolved with alpha-to-coverage — crisp up close, a fine veil far away, no extra geometry | `src/scene/materials/section.ts` |
| The Tormes: rippled water with Fresnel between a dark body and the sky; on the river act a half-resolution planar reflection (oblique near plane, no shadow redraw, compiled up front) mirrors the bridge and the cathedral | `src/scene/WaterReflection.tsx` |
| The section: the city is rendered as two halves clipped against a moving plane, closed with **stencil capping**. Back faces increment and front faces decrement the stencil, and one quad on the plane paints poché or strata wherever the plane lies inside matter. It stays exact even with overlapping OSM solids. Only geometry that crosses the plane is stencilled | `src/scene/materials/section.ts`, `src/scene/city/CityHalf.tsx` |
| Façades: procedural windows, shopfronts and cornices from per-building data, lit at dusk; clay-tile and flat roofs; sandstone grain | `src/scene/materials/section.ts` |
| Villamayor sandstone: object-space grain, Liesegang oxide bands and chisel bump, carved scallop shell | `src/scene/materials/villamayor.ts`, `src/scene/strata/exhibitGeometry.ts` |
| The verraco, sculpted rather than assembled: a signed distance field of smooth-blended primitives, meshed once with surface nets, in weathered granite | `src/scene/lib/sdf.ts`, `src/scene/landmarks/verraco.ts`, `src/scene/materials/granite.ts` |
| The stone breaks: the hero block is pre-fractured (Voronoi cells clipped from its planes), its cracks light from inside, the shards drift apart and the light fills the screen — a hidden cut to the Tormes at sunset | `src/scene/lib/fracture.ts`, `src/scene/strata/Exhibits.tsx`, `src/timeline/shots.ts` |
| Museum: wall lettering per layer (troika SDF text), section legend, hover markers | `src/scene/strata/` |
| White model → golden city: every material is a (base, gold) pair on shared uniforms, so the timeline changes the whole city with a single value. The change spreads as a soft, uneven front from the Plaza Mayor through the streets, and the haze turns warm towards the sun and cool away from it | `src/scene/materials/palette.ts`, `src/scene/materials/section.ts` |
| Exhibits in the section (wall and gate, Roman road, castro and verraco, rising sandstone blocks) under one travelling museum light | `src/scene/strata/` |
| Camera: Catmull-Rom paths for eye and target | `src/timeline/shots.ts` |
| Master timeline (0–100 = the whole film) | `src/timeline/master.ts` |
| Rhythm: scroll slows the film at each rest (a caption, the section legend), a scroll that stops near one settles onto it, and ↓ / ↑ / space step from rest to rest | `src/timeline/rhythm.ts`, `src/timeline/useScrollTimeline.ts` |
| The gallery floor: one excavated level per era, wall to wall, so every piece stands on the soil of its time | `src/scene/strata/exhibitGeometry.ts` |
| Copy and the year readout | `src/content/story.ts` |
| HUD and typography | `src/ui/`, `src/styles/global.css` |

## Run

```bash
npm install
npm run dev
```

In dev, `__seek(45)` in the console jumps to any point of the film (0–100), `__cam = { pos: [x, y, z], tgt: [x, y, z] }` frames any point of the city, and `?post=0`, `?shadow=0`, `?caps=0`, `?city=0`, `?ex=0` switch parts of the scene off for profiling.

## Performance

Resolution adapts to the frame time in small, rare steps. The underground lights only exist underground, both light setups are compiled up front (asynchronously), and terrain heights come from a precomputed river-distance grid. There is no post-processing stack. Occlusion is baked: a blurred footprint map for the ground and a base gradient on the walls. Anti-aliasing is native MSAA, tone mapping happens in the materials, and vignette and grain are CSS layers. The sun's shadow frustum follows the camera and is snapped to texels. The city renders once while it is whole, and the device pixel ratio adapts. On an Apple M1 in Chrome it holds 60 fps at retina resolution for nearly the whole film.

### Rebuilding the city data

```bash
npm run data:fetch   # downloads OSM extracts via Overpass into scripts/.cache
npm run data:build   # writes public/data/salamanca.json
```

## Credits

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, ODbL.
