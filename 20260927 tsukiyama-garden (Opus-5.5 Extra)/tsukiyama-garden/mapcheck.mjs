// Renders a top-down plan of the layout to PNG so the composition can be checked without a GPU.
import fs from 'fs'; import zlib from 'zlib'; 
const dir = new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const t0 = Date.now();
fs.writeFileSync(dir + '_layout.cjs', fs.readFileSync(dir + 'p1a_util.js', 'utf8') + '\n' + fs.readFileSync(dir + 'p2_layout.js', 'utf8') +
  '\nmodule.exports = { terrainH, pathW, LANTERNS, TREES, PAV, BRIDGE, FALL, STEPPING, LILY_CLUSTERS, waterSD, pondSD };');
const ctx = require(dir + '_layout.cjs');
console.log('layout init ms', Date.now() - t0);
const S = 720, R = 44, img = Buffer.alloc(S * S * 3);
const t1 = Date.now();
let hmin = 1e9, hmax = -1e9;
for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
  const x = -R + 2 * R * (i + 0.5) / S, z = -R + 2 * R * (j + 0.5) / S;
  const h = ctx.terrainH(x, z); hmin = Math.min(hmin, h); hmax = Math.max(hmax, h);
  let c;
  if (h < 0) { const d = Math.min(1, -h / 1.1); c = [40 + 60 * (1 - d), 90 + 80 * (1 - d), 140 + 60 * (1 - d)]; }
  else { const k = Math.min(1, h / 8); c = [70 + 120 * k, 120 + 60 * k, 50 + 90 * k]; const p = ctx.pathW(x, z); c = c.map((v, n) => v * (1 - p) + [215, 205, 185][n] * p); }
  // contour lines every 0.5 m
  const hn = ctx.terrainH(x + 2 * R / S, z);
  if (Math.floor(h / 0.5) !== Math.floor(hn / 0.5)) c = c.map(v => v * 0.75);
  const o = (j * S + i) * 3; img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2];
}
console.log('terrain samples ms', Date.now() - t1, 'h range', hmin.toFixed(2), hmax.toFixed(2));
const P = (x, z) => [Math.round((x + R) / (2 * R) * S), Math.round((z + R) / (2 * R) * S)];
function dot(x, z, r, col) { const [cx, cz] = P(x, z); for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r) { const X = cx + i, Z = cz + j; if (X < 0 || Z < 0 || X >= S || Z >= S) continue; const o = (Z * S + X) * 3; img[o] = col[0]; img[o + 1] = col[1]; img[o + 2] = col[2]; } }
function line(a, b, col, r = 1) { const n = 60; for (let k = 0; k <= n; k++) dot(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, r, col); }
for (const L of ctx.LANTERNS) dot(L.x, L.z, 4, [255, 255, 255]);
for (const T of ctx.TREES) dot(T.x, T.z, T.t === 'pine' ? 6 : 5, T.t === 'pine' ? [20, 60, 30] : T.t === 'maple' ? [200, 40, 20] : [240, 150, 190]);
const V = ctx.PAV; line([V.x - V.hx, V.z - V.hz], [V.x + V.hx, V.z - V.hz], [60, 30, 10], 2); line([V.x - V.hx, V.z + V.hz], [V.x + V.hx, V.z + V.hz], [60, 30, 10], 2);
line([V.x - V.hx, V.z - V.hz], [V.x - V.hx, V.z + V.hz], [60, 30, 10], 2); line([V.x + V.hx, V.z - V.hz], [V.x + V.hx, V.z + V.hz], [60, 30, 10], 2);
line(ctx.BRIDGE.a, ctx.BRIDGE.b, [220, 40, 20], 4);
dot(ctx.FALL.lip[0], ctx.FALL.lip[2], 4, [255, 255, 0]); dot(ctx.FALL.base[0], ctx.FALL.base[2], 4, [0, 255, 255]);
const St = ctx.STEPPING; for (let k = 0; k < St.n; k++) { const t = k / (St.n - 1); dot(St.a[0] + (St.b[0] - St.a[0]) * t, St.a[1] + (St.b[1] - St.a[1]) * t, 3, [120, 120, 120]); }
for (const L of ctx.LILY_CLUSTERS) dot(L.x, L.z, 3, [60, 200, 60]);
// grid ticks every 10 m
for (let g = -40; g <= 40; g += 10) { for (let k = -R; k < R; k += 0.5) { dot(g, k, 0, [0, 0, 0]); dot(k, g, 0, [0, 0, 0]); } }
function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
fs.writeFileSync(dir + 'map.png', png(S, S, img));
console.log('wrote map.png');
