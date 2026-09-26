const fs = require('fs');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

(async () => {
  const src = process.argv[2];
  const out = process.argv[3];
  const cols = Number(process.argv[4] || 4);
  const step = Number(process.argv[5] || 56);
  const rows = Number(process.argv[6] || 4);
  const im = await loadImage(fs.readFileSync(src));
  const TW = Math.floor(im.width / cols);
  const TH = Math.floor(im.height / rows);
  const cv = createCanvas(im.width, im.height + rows * 26);
  const cx = cv.getContext('2d');
  cx.drawImage(im, 0, 0);
  const count = cols * rows;
  for (let i = 0; i < count; i++) {
    const x = (i % cols) * TW;
    const y = Math.floor(i / cols) * TH;
    cx.fillStyle = 'rgba(0,0,0,0.82)';
    cx.fillRect(x, y, TW, 26);
    cx.fillStyle = '#00E5FF';
    cx.font = 'bold 16px Consolas';
    cx.textBaseline = 'middle';
    cx.fillText(`F${String(i * step).padStart(4, '0')} t=${((i * step) / 60).toFixed(2)}s`, x + 10, y + 13);
  }
  fs.writeFileSync(out, cv.toBuffer('image/png'));
  console.log('labeled', out, 'tiles', count);
})();
