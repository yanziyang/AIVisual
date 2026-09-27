// Joins the part files into the standalone page and embeds Clearwater's pebble texture.
// usage: node build.mjs [version]   ->   ../Tsukiyama Garden v<version>.html
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const version = process.argv[2] || '1.0';
const note = process.argv[3] || 'first release';
const parts = ['p0_head.html','p1a_util.js','p1b_gl.js','p2_layout.js','p3_mesh.js','p4_gen.js','p5_atlas.js','p6_koi.js','p7_water.js','p8_shaders.js','p10_post.js','p9_render.js','p11_ui.js','p12_tail.html'];
let out = parts.map(p => { const s = fs.readFileSync(path.join(dir, p), 'utf8'); return p.endsWith('.js') ? s.replace(/^/gm, '') : s; }).join('\n');
const cw = fs.readFileSync(path.join(dir, '..', 'clearwater', 'index.html'), 'utf8');
const m = /<script id="pebbles-texture" type="text\/plain">\s*([A-Za-z0-9+/=\s]+?)\s*<\/script>/.exec(cw);
if (!m) throw new Error('pebble texture not found in clearwater/index.html');
out = out.replace('@@PEBBLES@@', m[1].trim()).replaceAll('@@VERSION@@', `Version ${version} · 2026-09-27 · ${note}`);
const file = path.join(dir, '..', `Tsukiyama Garden v${version}.html`);
fs.writeFileSync(file, out);
console.log('wrote', file, (out.length/1024).toFixed(0) + ' KB');
