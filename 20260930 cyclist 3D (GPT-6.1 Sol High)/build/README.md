# Cadence — Cycling in Motion

A self-contained HTML page with an original Blender cyclist and bicycle.
`../cyclist.html` embeds Three.js, CSS, the animated GLB, and downloadable Blender
source. It runs offline with no separate files, CDN, server, or build step.

## Preview

Open `cyclist.html` in the workspace root directly in a WebGL-capable browser,
or upload this one file to a static web host. From the workspace root,
`node build/server.mjs` provides an optional HTTP preview at http://127.0.0.1:5173.

All build materials and scripts are inside `build/`. Paths below are relative
to that folder: the readable template is `source/index.html`, and the editable
JavaScript and CSS are `dist/app.js` and `dist/styles.css`.

From the workspace root, run `node build/build-standalone.mjs` to regenerate
`cyclist.html`. The script also works from inside `build/`. The bundler is
esbuild 0.25.5, installed in `.sites-runtime/build-tools`; it is only needed when
rebuilding. To prepare a copy for Sites hosting, add `--stage-hosting`; this
writes the deployment copy to `build/dist/index.html`.

## Model

`model/cyclist.blend` contains the editable model and baked animation.
`model/build_cyclist.py` generates all geometry in Blender with no external assets.
From the workspace root, run Blender in background mode with
`--python build/model/build_cyclist.py` to rebuild the model.
The exported `dist/assets/cyclist.glb` has a two-second riding cycle at 30 fps.
Copy the updated `.blend` file into `dist/assets` to update its download link.

Both legs use a two-segment analytical IK solution with feet aligned to opposing
pedals. The wheels turn three times per pedal revolution. The page scales the
Blender animation's 30 rpm cycle to the selected cadence; the displayed riding
speed uses a 0.363 m wheel radius and a 3:1 gear ratio.

Drag to orbit, scroll/pinch to zoom, or select a preset camera. Pause with the
button or spacebar. Reduced-motion preferences start playback paused.

## Verification

Browser checks cover animation playback and pause, cadence and speed, camera
presets and reset, auto orbit, model downloads, mobile overflow, and reduced
motion. Desktop and mobile screenshots were inspected. Optional WebMCP tools
are feature-detected; native WebMCP validation was unavailable in the test browser.

The offline check is `node build/.sites-runtime/verify-standalone.mjs` from the
workspace root. It opens `cyclist.html` directly and verifies the embedded model
downloads without network access. The HTTP check is `node build/verify.mjs`;
start the optional preview server first.
