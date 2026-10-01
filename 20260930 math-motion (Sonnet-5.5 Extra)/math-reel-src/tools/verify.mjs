// verify a finished MP4: stream info, decoded frame count, decode errors, plus 12 sample frames -> previews/final_*.png and a sheet
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FFMPEG = 'C:/MyProjects/AIVisual/20260926 tadpoles-find-their-mother (GPT-6 Sol Medium)/animation_deps/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';
const f = process.argv[2];
let r = spawnSync(FFMPEG, ['-hide_banner', '-i', f, '-f', 'null', '-'], { encoding: 'utf8' });
const err = r.stderr;
console.log(err.split(/\r?\n/).filter(l => /Duration|Stream|frame=|error|Error|warning/i.test(l)).slice(-8).join('\n'));
console.log('size MB', (fs.statSync(f).size / 1048576).toFixed(1));
const times = [0.3, 1.2, 3.0, 4.4, 6.2, 8.8, 11.2, 12.8, 13.9, 15.4, 17.6, 19.4];
const files = [];
times.forEach((t, i) => { const o = path.join(root, 'previews', `final_${String(i).padStart(2, '0')}.png`); spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', String(t), '-i', f, '-frames:v', '1', o]); files.push(o); });
spawnSync('node', [path.join(root, 'tools/sheet.mjs'), path.join(root, 'previews/final_sheet.png'), '3', '640', ...files], { stdio: 'inherit' });
