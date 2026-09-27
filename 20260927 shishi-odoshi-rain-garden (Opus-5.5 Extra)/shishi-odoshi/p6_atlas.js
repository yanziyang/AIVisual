/* ---------------- Foliage atlas (painted at load with Canvas 2D) ---------------- */
// 2048² atlas. Channels are data, not colour: R = shade, G = per-leaf variation, B = unused, A = coverage.
// The foliage shader turns them into colours per species. Rects are [x, y, w, h] in atlas units; v = 0 is the top row.
const ATLAS_RECTS = [
  [0.0, 0.0, 0.25, 0.5],        // FERN_A: once-pinnate frond, base at the top edge
  [0.25, 0.0, 0.25, 0.5],       // FERN_B: finer, twice-divided frond
  [0.5, 0.0, 0.25, 0.25],       // MAPLE: spray of palmate leaves
  [0.75, 0.0, 0.25, 0.25],      // BAMBOO: fans of narrow leaves
  [0.5, 0.25, 0.125, 0.125],    // LEAF_RED: one maple leaf
  [0.625, 0.25, 0.125, 0.125],  // LEAF_PALE: one ovate leaf
];
function paintAtlas(){
  const SZ = 2048, cv = document.createElement('canvas'); cv.width = cv.height = SZ;
  const g = cv.getContext('2d'), r = mulberry(2026);
  const rgb = (l, v) => `rgb(${Math.round(clamp(l,0,1)*255)},${Math.round(clamp(v,0,1)*255)},0)`;
  const inRect = (k, fn) => { const [x,y,w,h] = ATLAS_RECTS[k]; g.save(); g.translate(x*SZ, y*SZ); g.beginPath(); g.rect(0,0,w*SZ,h*SZ); g.clip(); fn(w*SZ, h*SZ); g.restore(); };
  const ellipse = (x,y,rx,ry,rot) => { g.beginPath(); g.ellipse(x,y,Math.max(rx,0.3),Math.max(ry,0.3),rot,0,TAU); g.fill(); };

  // A fern frond: tapering rachis with alternate pinnae; each pinna is a row of rounded pinnules (lobes).
  function frond(W, H, fine){
    const cx = W/2, y0 = 6, y1 = H - 10, len = y1 - y0;
    const rach = t => [cx + 10*Math.sin(t*2.1)*t, y0 + t*len];
    const pairs = fine ? 30 : 26;
    for (let i=0;i<pairs*2;i++){
      const side = i%2 ? 1 : -1, t = 0.035 + 0.95*(Math.floor(i/2) + (side > 0 ? 0.45 : 0))/pairs;
      const shape = Math.pow(Math.sin(Math.PI*clamp((t + 0.04)/1.02, 0, 1)), 0.7)*(1 - 0.28*t)*(t < 0.12 ? 0.55 + 3.7*t : 1);
      const pl = (W*0.47)*shape, pw = (fine ? 15 : 17)*(0.45 + 0.75*shape);
      const [bx, by] = rach(t);
      const ux = side*Math.cos(0.5 + 0.35*t), uy = Math.sin(0.5 + 0.35*t);    // unit vector along the pinna
      const v = r(), nl = fine ? 14 : 10;
      for (let k=0;k<nl;k++){
        const u = (k + 0.5)/nl, px = bx + ux*pl*u, py = by + uy*pl*u + 3*Math.sin(u*3.1)*u;
        const w = pw*Math.pow(1 - u*0.92, 0.75);
        g.fillStyle = rgb(0.5 + 0.35*r() + 0.12*(1-u), v);
        if (fine){ for (const s of [-1,1]) ellipse(px - uy*w*0.45*s*side, py + ux*w*0.45*s*side, w*0.42, w*0.24, Math.atan2(uy,ux) + s*0.9); }
        else ellipse(px, py, w*0.62, w*0.95, Math.atan2(uy,ux) + 0.35*side);
      }
      g.strokeStyle = rgb(0.68, v); g.lineWidth = fine ? 1.3 : 1.8; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + ux*pl*0.95, by + uy*pl*0.95); g.stroke();
    }
    g.strokeStyle = rgb(0.78, 0.5); g.lineCap = 'round';
    for (let k=0;k<40;k++){ const t0 = k/40, t1 = (k+1)/40, [ax, ay] = rach(t0), [bx, by] = rach(t1); g.lineWidth = lerp(7, 1.5, t0); g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); }
  }
  function mapleLeaf(x, y, size, rot, l, v){
    const lobes = [[-1.95,0.42],[-1.2,0.78],[-0.55,0.95],[0,1.0],[0.55,0.95],[1.2,0.78],[1.95,0.42]];
    g.save(); g.translate(x,y); g.rotate(rot); g.fillStyle = rgb(l, v); g.beginPath();
    const P = (a, rr) => [Math.sin(a)*rr*size, -Math.cos(a)*rr*size];
    g.moveTo(...P(-2.4, 0.12));
    lobes.forEach(([a, L], i) => {
      const prev = i ? lobes[i-1][0] : -2.5;
      g.lineTo(...P((a+prev)/2, 0.26));
      for (let s=0;s<4;s++){ const t=s/4; g.lineTo(...P(a-0.28*(1-t)*L, (0.3+0.7*t)*L)); g.lineTo(...P(a-0.2*(1-t)*L-0.03, (0.35+0.7*t)*L*0.94)); }
      g.lineTo(...P(a, L));
      for (let s=3;s>=0;s--){ const t=s/4; g.lineTo(...P(a+0.2*(1-t)*L+0.03, (0.35+0.7*t)*L*0.94)); g.lineTo(...P(a+0.28*(1-t)*L, (0.3+0.7*t)*L)); }
    });
    g.lineTo(...P(2.4, 0.12)); g.closePath(); g.fill();
    g.strokeStyle = rgb(l*0.72, v); g.lineWidth = Math.max(0.6, size*0.025);
    for (const [a,L] of lobes){ g.beginPath(); g.moveTo(0,0); g.lineTo(...P(a, L*0.85)); g.stroke(); }
    g.strokeStyle = rgb(l*0.5, v); g.lineWidth = size*0.05; g.beginPath(); g.moveTo(0,0); g.lineTo(0, size*0.45); g.stroke();
    g.restore();
  }
  function bladeLeaf(x, y, len, wid, rot, l, v){
    g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = rgb(l, v); g.beginPath();
    g.moveTo(0, 0); g.bezierCurveTo(wid*0.9, -len*0.18, wid*0.7, -len*0.7, 0, -len); g.bezierCurveTo(-wid*0.7, -len*0.7, -wid*0.9, -len*0.18, 0, 0); g.fill();
    g.strokeStyle = rgb(l*0.78, v); g.lineWidth = 1; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -len*0.95); g.stroke(); g.restore();
  }

  inRect(0, (W, H) => frond(W, H, false));
  inRect(1, (W, H) => frond(W, H, true));
  inRect(2, (W, H) => {
    g.strokeStyle = rgb(0.3, 0.5); g.lineWidth = 3;
    for (let k=0;k<4;k++){ g.beginPath(); g.moveTo(r()*W, r()*H); g.lineTo(r()*W, r()*H); g.stroke(); }
    for (let k=0;k<12;k++){ const s = 58 + r()*40; mapleLeaf(s + r()*(W-2*s), s + r()*(H-2*s), s, r()*TAU, 0.55 + 0.45*r(), r()); }
  });
  inRect(3, (W, H) => {
    for (let f=0; f<6; f++){
      const x = 60 + r()*(W-120), y = 60 + r()*(H-120), a0 = r()*TAU, v = r();
      g.strokeStyle = rgb(0.35, v); g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a0)*40, y + Math.sin(a0)*40); g.stroke();
      for (let k=0;k<5;k++) bladeLeaf(x, y, 150 + 60*r(), 18 + 6*r(), a0 + Math.PI/2 + (k - 2)*0.38 + (r()-0.5)*0.2, 0.5 + 0.45*r(), v);
    }
  });
  inRect(4, (W, H) => mapleLeaf(W/2, H*0.48, W*0.44, 0.15, 0.85, 0.5));
  inRect(5, (W, H) => { bladeLeaf(W/2, H*0.94, H*0.86, W*0.52, 0, 0.85, 0.5);
    g.strokeStyle = rgb(0.6, 0.5); g.lineWidth = 1.2; for (let k=1;k<7;k++){ const y = H*0.94 - H*0.86*k/7.5; g.beginPath(); g.moveTo(W/2, y); g.lineTo(W/2 - W*0.18, y - H*0.08); g.moveTo(W/2, y); g.lineTo(W/2 + W*0.18, y - H*0.08); g.stroke(); } });

  // give transparent texels their rect's mean colour so mip levels don't darken the edges
  const img = g.getImageData(0, 0, SZ, SZ), d = img.data;
  for (const [rx, ry, rw, rh] of ATLAS_RECTS){
    const x0 = Math.round(rx*SZ), y0 = Math.round(ry*SZ), x1 = Math.round((rx+rw)*SZ), y1 = Math.round((ry+rh)*SZ);
    let sr=0, sg=0, n=0;
    for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++){ const o=(y*SZ+x)*4; if (d[o+3] > 128){ sr+=d[o]; sg+=d[o+1]; n++; } }
    if (!n) continue; sr/=n; sg/=n;
    for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++){ const o=(y*SZ+x)*4; if (d[o+3] < 8){ d[o]=sr; d[o+1]=sg; d[o+2]=0; } }
  }
  return { data: new Uint8Array(d.buffer), size: SZ };
}
