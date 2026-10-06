# Cadence — Blender edition (source)

Prompt: "cyclist riding a bicycle, using three.js with 3D model built with Blender, hosted in standalone web page." No source URL was given.

Deliverables:
- `Cyclist Blender v1.0.html`: a single self-contained page (about 2.6 MB, works offline).
- `../_build/Cyclist Blender v1.0.blend`: the Blender file with the full IK rig and the three baked loops on NLA tracks.

## Pipeline

```
blender -b --factory-startup --python-exit-code 1 -P blender/build.py -- all   # model + rig + bake -> out/cyclist_all.blend, out/cyclist.glb
node tools/optimize.mjs                                                       # dedup + resample + meshopt -> out/cyclist.opt.glb
node build.mjs                                                                 # esbuild + base64 GLB -> ../Cyclist Blender v1.0.html
```

Blender 3.6.23 LTS is used because Blender 4.1+ refuses this VM's GPU. Background mode (`-b`) works for building and for Workbench previews.

| File | What it does |
|---|---|
| `blender/geom.py` | Bike geometry (56 cm frame), rider fit, analytic leg IK used for the modelling pose |
| `blender/util.py` | Mesh toolkit: sweep, loft, lathe, toothed rings, and a metaball wrapper with field-calibrated tube chains |
| `blender/bike.py` | Frame and fork (metaballs), wheels, cassette, crankset, chain (belt-tangent path, 108 links), cockpit, saddle, bottles |
| `blender/rider.py` | Metaball body (636 bone-tagged elements); skin weights from field shares; kit seams from plane bisects and iso-line cuts; shoes, helmet, glasses |
| `blender/rig.py` | Armature, IK controls, pole-angle solve, keyed control loops, visual-keyed bake (Seated, Standing, Coast) |
| `blender/preview.py`, `anim_preview.py` | Workbench renders for checking shapes and poses |
| `web/src/*.js` | three.js page: `model.js` (materials, chain instancing, wheel blur, posture blending), `world.js` (road, terrain, sky), `camera.js` (director), `studio.js`, `main.js` |
| `tools/shot.mjs` | Headless Chrome + CDP screenshot harness (`tools/run.sh plans/pN.json`) |

## Things to know
- meshopt quantization moves each mesh's dequantization into its node transform. Geometry reused outside its node (the chain-link prototypes) must have `node.matrix` baked in first.
- Seated and Standing clips are 2 s long (2 crank revolutions at 60 rpm), and t = 0 means the right crank is at 12 o'clock. The page sets `action.time` itself to keep the two clips phase-locked. Coast waits for the cranks to be level before it fades in.
- The chain path is stored as extras on the `ChainPath` empty in Blender Z-up coordinates. The page converts it with (x, z, -y).
- Test hooks: `window.scene` (`advance`, `setMode`, `setCam`, `setPosture`, `setTime`, `setKit`, `setView`, `view`, `hold`, `st`). URL options: `?mode=studio&cam=side&time=midday&posture=Standing&kit=forest&paused=1&intro=0&q=low|med|high`.
