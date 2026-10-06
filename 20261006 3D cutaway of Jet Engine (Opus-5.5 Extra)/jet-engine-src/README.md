# Jet Engine Cutaway - source

Single-file three.js page: a generic high-bypass turbofan, cut open, with airflow, flame, thrust lever and a guided tour.

    npm install
    node build.mjs                          # dev build -> build/index.html
    JET_VERSION=1.0 node build.mjs --release   # minified -> ../Jet Engine Cutaway v1.0.html

Layout
- `src/path.js`      all engine dimensions (flow-path radii, stations). Everything else reads this.
- `src/geom.js`      surfaces of revolution, cut-face polygons, aerofoil blade lofting.
- `src/materials.js` PBR materials + the shared shader patch (wedge cut, focus dimming, blur dither, hatching, liner holes).
- `src/module.js`    `Mod`: one removable engine module (static group + N1/N2 spinning groups), rotor blur rings.
- `src/parts/*.js`   nacelle, fan, booster, HP compressor, combustor, turbines, exhaust + cowl, shafts/bearings, stand.
- `src/flame.js`     ray-marched flame volume.   `src/flow.js` streamline particles + gas tables (T, P, v).
- `src/engine.js`    assembly, operating point (N1/N2/EGT/thrust), spool lag, heat glow, wedge/explode.
- `src/ui.js`, `src/chart.js`, `src/content.js`  interface, gas-path chart, copy.
- `tools/shot.mjs`   headless-Chrome screenshot harness (`node tools/shot.mjs plans/x.json`).

Test hooks: `window.jet` (cam, step, render, engine, ui). URL flags: `autoplay=0`, `paused=1`, `fixedpr=1`, `pr=0.6`, `debug=1`.

Renderer status pill: `template.html` carries the `ai-visual-webgl-render-mode` script copied unchanged from
`AIVisual/20261002 car-factory-2 (Sonnet-5.5 Extra).html` (added in v1.1 via `tools/patch_status.py`). It wraps
`getContext`, reads `WEBGL_debug_renderer_info` and shows GPU active / CPU only / renderer unknown / WebGL unavailable.
`tools/shot.mjs` plans accept `"angle": "swiftshader"` to force software rendering and see the CPU state.
