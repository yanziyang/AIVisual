# Lac des Fleurs

An original interactive landscape created in Blender 3.6 and displayed with Three.js.

Open `dist/index.html` directly in a modern browser. The model, materials, renderer and controls are embedded in this one file; no internet connection or local server is required. WebGL must be enabled.

The landscape includes a forest around a central lake, an abandoned island house, a wooden bridge, twenty French village houses, a chapel, a fountain square, flower boxes, rose vines, lavender beds, a jetty and boat, and connecting paths.

## Explore

- Drag with the left mouse button to orbit; scroll to zoom; right drag to pan.
- On touch screens, drag with one finger to orbit; pinch to zoom; drag with two fingers to pan.
- Select a landmark label or viewpoint button to move the camera.
- Choose daylight, golden hour or blue hour.
- Use the tour, automatic orbit, label and reset controls.
- Keyboard: `0` or `Home` for panorama; `1` island house; `2` village square; `3` forest trail; `4` chapel. `Escape` stops the tour.

## Editable source

`model/lac-des-fleurs.blend` is the editable Blender scene. `model/landscape.glb` is its exported model. The reproducible scene generator is `model/create_landscape.py`.

Regenerate the Blender scene and model:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 3.6\blender.exe' --background --python model/create_landscape.py
```

Rebuild the HTML after changing the scene or viewer:

```sh
npm install
npm run build
```

`page.html` contains the interface; `viewer.js` contains camera, lighting and scene behavior; `build.mjs` embeds the model and bundles the renderer. Browser-rendered scenery can vary with graphics hardware. The original assets are procedural and use no third-party art or textures. Three.js is distributed under its MIT license, retained in the bundle.
