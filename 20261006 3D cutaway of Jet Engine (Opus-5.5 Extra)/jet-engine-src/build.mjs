// Bundle the page: esbuild (three.js tree-shaken) + template -> one standalone HTML file.
//   node build.mjs                 -> build/index.html (development)
//   node build.mjs --release       -> ../Jet Engine Cutaway v<JET_VERSION>.html
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const release = process.argv.includes('--release');
const version = process.env.JET_VERSION || '1.0';
const outFile = release ? path.resolve('..', `Jet Engine Cutaway v${version}.html`) : path.resolve('build', 'index.html');
fs.mkdirSync(path.dirname(outFile), { recursive: true });

const res = await esbuild.build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: release,
  format: 'iife',
  target: ['es2020'],
  write: false,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"', __JET_VERSION__: JSON.stringify(version) },
  logLevel: 'warning',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = fs.readFileSync('template.html', 'utf8');
const html = tpl.split('__APP_JS__').join(js).split('__JET_VERSION__').join(version);
fs.writeFileSync(outFile, html);
console.log(`wrote ${outFile}: ${(html.length / 1024).toFixed(0)} KB (js ${(js.length / 1024).toFixed(0)} KB)`);
