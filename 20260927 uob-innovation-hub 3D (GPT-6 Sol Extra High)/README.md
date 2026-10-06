# UOB Innovation Hub — interactive architectural study

An editable Blender model and a completely self-contained HTML viewer of UOB Innovation Hub (formerly The Hive / Learning Hub South) at NTU, Singapore.

## Deliverables

- `project-files/uob-innovation-hub.blend` — Blender 3.6 source with named tower, circulation, atrium and landscape collections, materials, lighting and an overview camera.
- `project-files/uob-innovation-hub.glb` — exported model, using Y-up glTF coordinates.
- `uob-innovation-hub.html` — the standalone viewer in this sub-project root, with the GLB and Three.js embedded. Double-click to open; no server or internet is required for the model. Hosting uses `project-files/dist/index.html`.
- `project-files/build/` — all modeling, packaging, preview and verification scripts, viewer source/template, and npm dependency files.

Orbit by dragging, zoom with the scroll wheel, and pan with right-drag. On touch devices, use one finger to orbit and two fingers to pinch/pan. Select a tower, choose overview/atrium/plan views, use the vertical clipping slider, reveal the atrium, change lighting, or enable auto orbit. Focus the model and use arrows, +/- and H for keyboard navigation. Information and fullscreen controls are in the top right.

## Rebuild

```powershell
& 'C:\Program Files\Blender Foundation\Blender 3.6\blender.exe' --background --python project-files/build/build_model.py
npm --prefix project-files/build install
npm --prefix project-files/build run build
npm --prefix project-files/build run preview
```

The viewer packages the actual Blender-exported GLB; its building geometry is not generated in the browser. Three.js 0.169.0 and esbuild 0.24.0 are pinned. The HTML contains bundled MIT license notices.

The page includes the original user prompt and implementation details, including the build workflow, model statistics, verification results and source downloads. Use the “Prompt & implementation” link below the title area to read them.

## Scope and references

The model is an interpretive architectural visualization, not a measured or as-built survey. Twelve rounded, tapered towers, horizontal concrete ribs, glazing slots, planted roof terraces, circulation cores and a scalloped open atrium are based on published architectural photographs and the Level 4 plan. Dimensions, room counts, exact floor layouts, surrounding roads and landscaping are approximations. Numbered towers are study identifiers. No copyrighted photographs are included in the delivered viewer.

- [Heatherwick Studio — Learning Hub](https://heatherwick.com/project/learning-hub-the-hive/)
- [NTU Museum — Campus Art Trail](https://www.ntu.edu.sg/life-at-ntu/museum/campus-art-trail)
- [Heatherwick Studio Level 4 plan, published by Divisare](https://divisare.com/projects/284273-thomas-heatherwick-hufton-crow-learning-hub)

Blender uses Z-up; the exporter converts to Y-up for the viewer. Tower metadata is preserved as glTF extras. The browser clips in Y for height and Z for the atrium cutaway. The small compass indicates model orientation, not a surveyed north alignment.
