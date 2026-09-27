// Joins the part files into the standalone page and embeds Clearwater's pebble texture.
// usage: node build.mjs [version] [note]   ->   ../Shishi-odoshi Rain Garden v<version>.html
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const version = process.argv[2] || '1.0';
const note = process.argv[3] || 'first release';
const parts = ['p0_head.html','p1_util.js','p2_gl.js','p3_mesh.js','p4_layout.js','p5_gen.js','p6_atlas.js','p7_water.js','p8_shaders.js',
  'p9a_physics.js','p9b_fx.js','p10_audio.js','p11_post.js','p12_render.js','p13_ui.js','p14_tail.html'];
let out = parts.map(p => fs.readFileSync(path.join(dir, p), 'utf8')).join('\n');
const cw = fs.readFileSync(path.join(dir, '..', 'clearwater', 'index.html'), 'utf8');
const m = /<script id="pebbles-texture" type="text\/plain">\s*([A-Za-z0-9+/=\s]+?)\s*<\/script>/.exec(cw);
if (!m) throw new Error('pebble texture not found in clearwater/index.html');
out = out.replace('@@PEBBLES@@', m[1].trim()).replaceAll('@@VERSION@@', `Version ${version} · 2026-09-27 · ${note}`);
const file = path.join(dir, '..', `Shishi-odoshi Rain Garden v${version}.html`);
fs.writeFileSync(file, out);
console.log('wrote', file, (out.length/1024).toFixed(0) + ' KB');
