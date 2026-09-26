const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { renderFrame, FPS } = require('./render');

(async () => {
  const list = process.argv[2].split(',').map(Number);
  const cols = Number(process.argv[3] || 3);
  const TW = 640, TH = 360;
  const rows = Math.ceil(list.length / cols);
  const sheet = createCanvas(cols * TW, rows * TH);
  const sc = sheet.getContext('2d');

  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    const data = renderFrame(f);
    const tmp = createCanvas(1920, 1080);
    const tc = tmp.getContext('2d');
    const img = tc.createImageData(1920, 1080);
    img.data.set(data);
    tc.putImageData(img, 0, 0);

    const x = (i % cols) * TW, y = Math.floor(i / cols) * TH;
    sc.drawImage(tmp, x, y, TW, TH);
    sc.fillStyle = 'rgba(0,0,0,0.72)';
    sc.fillRect(x, y, TW, 30);
    sc.fillStyle = '#00E5FF';
    sc.font = 'bold 19px Consolas';
    sc.textBaseline = 'middle';
    sc.fillText(`F${String(f).padStart(4, '0')}  t=${(f / FPS).toFixed(2)}s`, x + 12, y + 16);
    sc.strokeStyle = 'rgba(255,255,255,0.22)';
    sc.lineWidth = 2;
    sc.strokeRect(x, y, TW, TH);
    console.log('tile', f);
  }
  const out = process.argv[4] || 'sheet.png';
  fs.writeFileSync(out, sheet.toBuffer('image/png'));
  console.log('wrote', out);
})();
