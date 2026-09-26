const { spawnSync } = require('child_process');
const path = require('path');

const FFMPEG = 'C:\\MyProjects\\TempProject (OpenCode)\\showreel\\node_modules\\ffmpeg-static\\ffmpeg.exe';
const MP4 = 'C:\\MyProjects\\TempProject (OpenCode)\\showreel.mp4';
const W = 1920, H = 1080;

function framePixels(n) {
  const r = spawnSync(FFMPEG, [
    '-hide_banner', '-loglevel', 'error',
    '-i', MP4,
    '-vf', `select=eq(n\\,${n})`,
    '-vsync', '0', '-frames:v', '1',
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-',
  ], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(String(r.stderr));
  return r.stdout;
}

function report(n) {
  const buf = framePixels(n);
  const px = (x, y) => {
    const i = (y * W + x) * 3;
    return [buf[i], buf[i + 1], buf[i + 2]];
  };
  let lum = 0, cnt = 0, dark = 0, light = 0;
  for (let i = 0; i < buf.length; i += 3 * 37) {
    const l = (buf[i] + buf[i + 1] + buf[i + 2]) / 3;
    lum += l; cnt++;
    if (l < 40) dark++;
    if (l > 170) light++;
  }
  const fmt = (p) => p.map((v) => String(v).padStart(3)).join(',');
  console.log(
    `F${String(n).padStart(4)} t=${(n / 60).toFixed(2).padStart(5)}s` +
    `  center=${fmt(px(960, 540))}  tl=${fmt(px(80, 80))}  br=${fmt(px(1840, 1000))}` +
    `  avgLum=${(lum / cnt).toFixed(1).padStart(5)}  dark%=${(100 * dark / cnt).toFixed(1).padStart(4)}` +
    `  light%=${(100 * light / cnt).toFixed(1).padStart(4)}`
  );
}

const frames = process.argv[2].split(',').map(Number);
for (const n of frames) report(n);
