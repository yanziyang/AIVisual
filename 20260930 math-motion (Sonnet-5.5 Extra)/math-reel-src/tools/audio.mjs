// Renders the score in node (same code as the page) -> out/score.wav (16-bit stereo 48 kHz) + prints levels
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'js/00-core.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'js/10-audio.js'), 'utf8');
const renderScore = new Function('window', src + '\n;return renderScore;')({});
const t0 = Date.now();
const { L, R } = renderScore(48000);
console.log('rendered in', Date.now() - t0, 'ms', 'samples', L.length);
const n = L.length, buf = Buffer.alloc(44 + n * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(48000, 24); buf.writeUInt32LE(48000 * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
let pk = 0, sum = 0;
for (let i = 0; i < n; i++) {
  const l = Math.max(-1, Math.min(1, L[i])), r = Math.max(-1, Math.min(1, R[i]));
  buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
  pk = Math.max(pk, Math.abs(l), Math.abs(r)); sum += l * l + r * r;
}
fs.mkdirSync(path.join(root, 'out'), { recursive: true });
fs.writeFileSync(path.join(root, 'out', 'score.wav'), buf);
console.log('peak dBFS', (20 * Math.log10(pk)).toFixed(2), 'rms dBFS', (10 * Math.log10(sum / (2 * n))).toFixed(2));
