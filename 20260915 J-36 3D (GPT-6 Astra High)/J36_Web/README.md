# J-36 standalone Three.js viewer

## Open

Double-click **J36_Explorer.html** or drag it into a current desktop browser. This one file contains the aircraft, Three.js and all viewer code. It works offline and needs no web server, CDN, build command or companion file. On a phone, open it in a browser that runs local HTML rather than the operating system's document preview.

## Controls

- Drag to orbit; scroll or pinch to zoom; right-drag or two-finger drag to pan.
- Five preset angles: perspective, top, rear, underside and front.
- Coated or wireframe display.
- Show/hide landing gear and ground grid. Hiding the gear is a visibility change, not a retraction animation.
- Adjust lighting, auto rotate and reset.
- Save the current canvas as PNG or download the embedded GLB.
- Shortcuts while the canvas is focused: 1–5 for presets, R for reset, Space for rotation.

The ground hides automatically when the camera is below it, allowing an unobstructed underside view.

## Files

- `J36_Explorer.html`: the self-contained deliverable; this is the only file needed to view or share it.
- `j36.glb`: a separate copy of the aircraft for other 3D applications.
- `src/viewer.js`, `src/viewer.template.html`: editable viewer sources.
- `assemble_html.py`: embeds the bundled JavaScript and GLB into the HTML.
- `export_model.py`: Blender 3.6.23 exporter; preserves the master `.blend` file.
- `qa/test-report.json`: browser verification results.

## Model fidelity

The GLB is exported from the existing Blender model, including its 434 mesh objects and materials. Curves and text are converted to meshes so panel seams and markings remain visible. Blender's procedural paint bump is not baked into the GLB. Real-time lighting differs from the original studio renders. Both versions are reference-based exterior reconstructions with nominal dimensions and inferred unseen details.

## Build

The checked-in local dependencies are pinned to Three.js **0.186.0**. From the parent workspace folder:

```powershell
& '.\J36_Web\vendor\esbuild\package\esbuild.exe' '.\J36_Web\src\viewer.js' --bundle --minify --format=iife --target=es2020 '--alias:three=./J36_Web/vendor/three/package/build/three.module.js' '--outfile=.\J36_Web\viewer.bundle.js' --legal-comments=inline
& 'C:\Program Files\Blender Foundation\Blender 3.6\3.6\python\bin\python.exe' '.\J36_Web\assemble_html.py'
```

Three.js is used under its MIT license, included in the HTML and `THREE-LICENSE.txt`. See the [official Three.js documentation](https://threejs.org/docs/) for the renderer, GLTFLoader and OrbitControls APIs.
