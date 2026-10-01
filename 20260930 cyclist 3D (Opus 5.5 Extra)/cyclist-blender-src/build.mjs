// Bundle the page: esbuild (three.js tree-shaken) + the optimized GLB as base64 -> one HTML file.
//   node build.mjs [out.html]
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] || path.resolve('..', 'Cyclist Blender v1.0.html');
const res = await esbuild.build({
  entryPoints: ['web/src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  write: false,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
});
let js = res.outputFiles[0].text.replace(/<\/script/gi, '<\/script');
const glb = fs.readFileSync('out/cyclist.opt.glb');
const tpl = fs.readFileSync('web/template.html', 'utf8');
const html = tpl.split('__GLB_BASE64__').join(glb.toString('base64')).split('__APP_JS__').join(js);
fs.writeFileSync(out, html);
console.log(`wrote ${out}: ${(html.length / 1024 / 1024).toFixed(2)} MB (js ${(js.length / 1024).toFixed(0)} KB, glb ${(glb.length / 1024).toFixed(0)} KB)`);
