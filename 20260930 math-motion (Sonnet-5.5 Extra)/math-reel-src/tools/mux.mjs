// mux video + score -> final MP4;  node tools/mux.mjs "<out path>"
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FFMPEG = 'C:/MyProjects/AIVisual/20260926 tadpoles-find-their-mother (GPT-6 Sol Medium)/animation_deps/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';
const out = process.argv[2];
const r = spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'warning', '-i', path.join(root, 'out/video-only.mp4'), '-i', path.join(root, 'out/score.wav'),
  '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', '-t', '20', out], { stdio: 'inherit' });
process.exit(r.status);
