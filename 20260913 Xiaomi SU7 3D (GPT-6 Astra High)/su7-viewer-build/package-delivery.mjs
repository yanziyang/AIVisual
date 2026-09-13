import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const target=process.argv[2];
const report=JSON.parse(await fs.readFile(path.join(here,'test-output/report.json'),'utf8'));
if(!report.passed)throw new Error('Viewer validation has not passed.');
const source=path.join(target,'viewer_source');
await fs.mkdir(source,{recursive:true});
for(const name of ['app.js','viewer.html','build.mjs','test-viewer.mjs','package.json','package-lock.json'])await fs.copyFile(path.join(here,name),path.join(source,name));
await fs.copyFile(path.join(here,'test-output/report.json'),path.join(target,'viewer_validation.json'));
await fs.copyFile(path.join(here,'test-output/desktop.png'),path.join(target,'renders/viewer_preview.png'));
await fs.copyFile(path.join(here,'test-output/mobile.png'),path.join(target,'renders/viewer_mobile_preview.png'));
await fs.writeFile(path.join(target,'VIEWER_README.md'),`# Xiaomi SU7 standalone Three.js viewer

Open Xiaomi_SU7_Viewer.html in Chrome or Edge. The approximately 34 MB HTML file includes the existing model, Three.js r180, lighting environment, and loading poster. It works offline without a web server or adjacent files. A browser with WebGL support is required.

Drag to orbit, scroll to zoom, and right-drag to pan. On touch screens, use one finger to orbit and two fingers to zoom/pan. R resets the view; Space toggles rotation when the model canvas is focused. The toolbar offers six camera presets, three paint previews, wireframe, and studio/daylight lighting. The upper controls save a PNG, download the embedded original GLB, enter fullscreen, and display information. Paint previews change only the viewer appearance; the downloaded GLB remains the original.

This viewer presents the existing photo-referenced model; it does not change the Blender geometry or establish a numerical likeness score.

## Validation

Tested in Chrome with network disabled, opening the HTML directly through file://. Camera presets, orbit, paint, wireframe, lighting, keyboard controls, PNG export, and responsive 390 x 844 layout passed. The GLB download matched the original by SHA-256. No HTTP requests or console errors were recorded. See viewer_validation.json and renders/viewer_preview.png.

## Editable source

Source and pinned dependencies are in viewer_source. To rebuild, open a terminal in that directory, run npm ci, then run:

    node build.mjs ".."

The build reads ../Xiaomi_SU7_Max.glb and ../renders/front_hero.png and writes ../Xiaomi_SU7_Viewer.html. Source changes require rebuilding; the final HTML remains independently portable. Three.js is MIT licensed; its license is embedded in the HTML.
`);
console.log(JSON.stringify({html:path.join(target,'Xiaomi_SU7_Viewer.html'),source,validation:report.passed},null,2));
