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
| Real geometry: 2,800 building footprints, courtyards included, plus the Tormes, Plaza Mayor, both cathedrals and the Roman bridge from OpenStreetMap, projected to metres and rotated so the section runs along +z | `scripts/build-city.mjs` → `public/data/salamanca.json` |
| Hand-modelled landmarks: Plaza Mayor (88 arches, medallions, balconies, Ayuntamiento belfry, Pabellón Real), the two cathedrals with tower, domes and Torre del Gallo, and the 26-arch bridge with a verraco | `src/scene/landmarks/` |
| The section: the city is rendered as two halves clipped against a moving plane. Back faces exposed by the clip are painted as a cap by intersecting the view ray with the plane: poché above ground, archaeological strata below | `src/scene/materials/section.ts` |
| White model → golden city: every material is a (base, gold) pair on shared uniforms, so the timeline changes the whole city with a single value | `src/scene/materials/palette.ts` |
| Exhibits in the section (wall and gate, Roman road, castro and verraco, rising sandstone blocks) under one travelling museum light | `src/scene/strata/` |
| Camera: Catmull-Rom paths for eye and target | `src/timeline/shots.ts` |
| Master timeline (0–100 = the whole scroll) | `src/timeline/master.ts` |
| Copy and the year readout | `src/content/story.ts` |
| HUD and typography | `src/ui/`, `src/styles/global.css` |

## Run

```bash
npm install
npm run dev
```

In dev, `__seek(45)` in the console jumps to any point of the film (0–100).

### Rebuilding the city data

```bash
npm run data:fetch   # downloads OSM extracts via Overpass into scripts/.cache
npm run data:build   # writes public/data/salamanca.json
```

## Credits

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, ODbL.
