# Stillwater build

The generated [fish-pond.html](../fish-pond.html) is saved in the project root. The pond, reference image, textures, interface, and Clearwater MIT license are all embedded. No server, installation, or internet connection is needed. The browser must support WebGL2 and floating-point render targets.

Select **Ripple** or **Feed koi**, then tap the water. Drag to orbit and scroll or pinch to zoom. Click the current light at the top right to open the preset picker; its label, highlighted choice, and scene lighting stay in sync with Settings. Settings also change breeze and koi population. **About this pond** contains the user's original prompt, reference image, implementation details, source structure, and license.

With the canvas focused, Enter acts at the center; arrow keys orbit; + / − zoom; Space pauses; R resets the view; F selects feeding. Reduced-motion preferences start the pond paused. The optional `?paused` URL parameter also starts it paused.

## Editable source

- `pond-shell.html`: interface and About content.
- `pond-scene.glsl`: scenery and underwater koi shader.
- `pond-behavior.js`: fish movement, feeding, controls, camera, and frame loop.
- `render-pond.cjs`: real WebGL rendering and control checks using Playwright and installed Chrome; saves the current desktop, mobile, and golden-hour screenshots.
- `clearwater-source/`: the upstream engine, MIT license, and the supplied visual reference.
- `build_pond.py`: embeds all source and assets into `fish-pond.html`.

From the project root, rebuild with `python build/build_pond.py` and check with `node build/verify-pond.cjs`. From this build folder, use `python build_pond.py` and `node verify-pond.cjs`. The generated HTML is always written to the project root. The verification screenshots are retained here alongside the source files.

## Verification

Browser rendering and shaders were checked at desktop and mobile widths. The information dialog, settings, pause, ripple interaction, and feeding were exercised. Browser diagnostics recorded one feeding and all eight pellets eaten. Focused simulation checks additionally verified shoreline containment, keyboard handling, food cleanup, dialog handlers, embedded assets, and JavaScript syntax.

Lighting regression checks exercise the preset buttons and actual frame loop. Afternoon uses a distinct sun direction. Changing presets while paused refreshes underwater caustics and shader uniforms without advancing waves, ripples, time, or fish; unchanged paused scenes retain the rendering cache.

Header-picker regression checks cover opening and closing, focus, Escape, outside clicks, and synchronization with Settings. They select Morning and Afternoon through the header picker and verify the shader inputs and caustics. These simulation checks use local DOM and graphics mocks.

The revised scene was also compiled and rendered in headless Chrome with actual WebGL2 at 1280 × 900 and 390 × 844. Browser checks exercised lighting changes while paused, About, mobile Settings, resume, ripples, and feeding. No shader or JavaScript errors were reported. Visual captures are `pond-improved-desktop.png`, `pond-improved-mobile.png`, and `pond-improved-golden.png`. The browser check can be repeated with `node build/render-pond.cjs` from the project root on this workstation.

## Visual revision

The shoreline now uses 18 varied boulders with displaced, rounded fracture surfaces and 90 smaller stones scattered in groups around a wider gravel bank. Stones have mineral variation, moss, wet edges, and contact shadows. The grass is shaded with individual procedural blades. A deeper green water column, dappled shade, and moving branch and foliage reflections replace the uniformly bright water. Koi use tapered, bending bodies, forked tails, and translucent fins, with less film grain and chromatic aberration.

## Standalone startup

A solid loading screen follows the UOB viewer's centered spinner, title, and status pattern. It appears before the embedded assets are parsed; the pond and controls appear after the first completed WebGL frame. Unsupported graphics or disabled JavaScript show an explanation on a solid background. Interactive rendering starts at a moderate resolution and adapts down promptly on slower renderers. Fixed-time captures keep full resolution. Run `node build/verify-startup.cjs` to check the file URL with normal graphics, blocked WebGL, and disabled JavaScript. The check saves `pond-loading.png`, `pond-no-webgl.png`, and `pond-no-javascript.png` here.

## Engine attribution

[Clearwater](https://github.com/Aureliengmz/clearwater) by Aurélien / Lumaris, MIT license, copyright 2026 Lumaris. The complete license is retained in the source directory and embedded in the delivered HTML. The original upstream source was downloaded on 27 September 2026.
