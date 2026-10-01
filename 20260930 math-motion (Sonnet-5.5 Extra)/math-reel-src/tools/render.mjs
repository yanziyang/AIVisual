// Offline render harness: serves dist/reel.html, receives raw frames from the page, pipes to ffmpeg / writes PNG stills.
//   node tools/render.mjs stills 0.5,1.2,3 [--samples=4] [--tag=name]
//   node tools/render.mjs video [--from=0] [--to=1200] [--samples=0(auto)] [--out=out/video.mp4] [--crf=15]
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FFMPEG = 'C:\\MyProjects\\AIVisual\\20260926 tadpoles-find-their-mother (GPT-6 Sol Medium)\\animation_deps\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe';
const W = 1920, H = 1080, FPS = 60;

const args = process.argv.slice(2);
const mode = args[0];
const opt = {};
for (const a of args.slice(1)) { const m = a.match(/^--(\w+)=(.*)$/); if (m) opt[m[1]] = m[2]; }
const positional = args.slice(1).filter(a => !a.startsWith('--'));
const PORT = 8150 + Math.floor(Math.random() * 200);

// ---------- minimal PNG encoder ----------
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = b => { let c = -1; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function png(rgba, w, h, flipY = true) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { const sy = flipY ? h - 1 - y : y; raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, sy * w * 4, (sy + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 3 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- job config ----------
let job;
if (mode === 'stills') {
  const times = (positional[0] || '1').split(',').map(Number);
  job = { mode: 'stills', times, samples: Number(opt.samples ?? 4), tag: opt.tag || 'still' };
} else if (mode === 'video') {
  job = { mode: 'video', from: Number(opt.from ?? 0), to: Number(opt.to ?? FPS * 20), samples: Number(opt.samples ?? 0), shutter: Number(opt.shutter ?? 0.5) };
} else { console.log('usage: stills|video'); process.exit(1); }

const outDir = path.join(root, 'out'); fs.mkdirSync(outDir, { recursive: true });
const prevDir = path.join(root, 'previews'); fs.mkdirSync(prevDir, { recursive: true });
let ff = null, ffDone = null, framesIn = 0, tStart = Date.now();
const videoOut = path.resolve(root, opt.out || 'out/video-only.mp4');
if (mode === 'video') {
  const crf = opt.crf || '15';
  ff = spawn(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'warning', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', 'pipe:0',
    '-vf', 'vflip,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', opt.preset || 'slow', '-crf', crf, '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', '-an', videoOut], { stdio: ['pipe', 'inherit', 'inherit'] });
  ffDone = new Promise(r => ff.on('close', r));
}

let chrome;
const srv = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'GET') {
    if (u.pathname === '/cfg') { console.log('page requested cfg'); res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(job)); return; }
    res.setHeader('content-type', 'text/html'); res.end(fs.readFileSync(path.join(root, 'dist', 'reel.html'))); return;
  }
  const chunks = []; for await (const c of req) chunks.push(c); const body = Buffer.concat(chunks);
  if (u.pathname === '/frame') {
    framesIn++;
    if (!ff.stdin.write(body)) await new Promise(r => ff.stdin.once('drain', r));
    if (framesIn % 30 === 0) { const el = (Date.now() - tStart) / 1000; console.log(`frame ${u.searchParams.get('i')}  ${framesIn} done  ${(framesIn / el).toFixed(2)} fps  eta ${((job.to - job.from - framesIn) / (framesIn / el) / 60).toFixed(1)} min`); }
    res.end('ok');
  } else if (u.pathname === '/still') {
    const name = u.searchParams.get('name');
    fs.writeFileSync(path.join(prevDir, `${job.tag}_${name}.png`), png(body, W, H, true));
    console.log('still', name, 'ms', u.searchParams.get('ms')); res.end('ok');
  } else if (u.pathname === '/log') { console.log('[page]', body.toString()); res.end('ok'); }
  else if (u.pathname === '/done') {
    res.end('ok');
    if (ff) { ff.stdin.end(); await ffDone; console.log('video written', videoOut, ((Date.now() - tStart) / 60000).toFixed(1), 'min'); }
    setTimeout(() => { chrome.kill(); process.exit(0); }, 300);
  }
});
srv.listen(PORT);

const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-'));
chrome = spawn(CHROME, ['--headless=new', '--no-first-run', `--user-data-dir=${prof}`, `--window-size=${W},${H}`, '--hide-scrollbars',
  '--enable-gpu', '--use-angle=d3d11', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--force-device-scale-factor=1',
  '--enable-logging=stderr', '--v=0', `http://localhost:${PORT}/?render=1`], { stdio: ['ignore', 'ignore', 'pipe'] });
chrome.stderr.on('data', d => { for (const l of d.toString().split(/\r?\n/)) if (/CONSOLE|Uncaught|GPU process|context lost/i.test(l)) console.log('[chrome]', l.slice(0, 400)); });
const limit = (opt.timeout ? Number(opt.timeout) : 3 * 3600) * 1000;
setTimeout(() => { console.log('TIMEOUT'); chrome.kill(); process.exit(2); }, limit);
