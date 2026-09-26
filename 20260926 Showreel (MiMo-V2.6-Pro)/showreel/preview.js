'use strict';
const fs = require('fs');
const path = require('path');
const { renderFrame } = require('./render');

const frames = (process.argv[2] || '0,60,113,180,250,320,400,480,560,640,700,780,840,880,899')
  .split(',').map(Number);

const outDir = path.resolve(__dirname, 'preview');
fs.mkdirSync(outDir, { recursive: true });

const { createCanvas } = require('@napi-rs/canvas');
const W = 1920, H = 1080;
const cv = createCanvas(W, H);
const cx = cv.getContext('2d');

for (const f of frames) {
  const data = renderFrame(f);
  const img = cx.createImageData(W, H);
  img.data.set(data);
  cx.putImageData(img, 0, 0);
  const p = path.join(outDir, `f${String(f).padStart(4, '0')}.png`);
  fs.writeFileSync(p, cv.toBuffer('image/png'));
  console.log('wrote', p);
}
