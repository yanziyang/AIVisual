// contact sheet:  node tools/sheet.mjs out.png cols width file1.png file2.png ...
import { spawnSync } from 'node:child_process';
const FFMPEG = 'C:\\MyProjects\\AIVisual\\20260926 tadpoles-find-their-mother (GPT-6 Sol Medium)\\animation_deps\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe';
const [out, colsS, wS, ...files] = process.argv.slice(2);
const cols = Number(colsS), w = Number(wS), h = Math.round(w * 9 / 16), rows = Math.ceil(files.length / cols);
const args = ['-y', '-hide_banner', '-loglevel', 'error'];
files.forEach(f => args.push('-i', f));
let fc = files.map((_, i) => `[${i}:v]scale=${w}:${h}[s${i}]`).join(';');
const layout = files.map((_, i) => `${(i % cols) * w}_${Math.floor(i / cols) * h}`).join('|');
fc += ';' + files.map((_, i) => `[s${i}]`).join('') + `xstack=inputs=${files.length}:layout=${layout}:fill=black[o]`;
args.push('-filter_complex', fc, '-map', '[o]', '-frames:v', '1', out);
const r = spawnSync(FFMPEG, args, { stdio: 'inherit' });
process.exit(r.status);
