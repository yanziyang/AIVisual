/* ---------------- Foliage atlas (painted at load with Canvas 2D) ---------------- */
// 4x4 cells of 256 px. Channels are data, not colour: R = shade, G = per-leaf variation, B = flower/petal flag, A = coverage.
// The shaders turn these into season-dependent colours, so one texture covers spring, summer, autumn and winter.
const CELL = { PINE:0, MAPLE:1, SAKURA:2, BROAD:3, CEDAR:4, TWIG:5, LEAF1:6, PETAL:7, DOT:8, AZALEA:9 };
function paintAtlas(){
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S*4;
  const g = cv.getContext('2d'), r = mulberry(2024);
  const rgb = (l, v, f=0) => `rgb(${Math.round(clamp(l,0,1)*255)},${Math.round(clamp(v,0,1)*255)},${Math.round(f*255)})`;
  const cell = (k, fn) => { g.save(); g.translate((k%4)*S, Math.floor(k/4)*S); g.beginPath(); g.rect(0,0,S,S); g.clip(); fn(); g.restore(); };
  const ellipse = (x,y,rx,ry,rot) => { g.beginPath(); g.ellipse(x,y,rx,ry,rot,0,TAU); g.fill(); };
  function mapleLeaf(x, y, size, rot, l, v){
    // seven palmate lobes with serrated edges, petiole at the base
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
  function petal(x, y, len, wid, rot, l, v, f=1){
    g.save(); g.translate(x,y); g.rotate(rot); g.fillStyle = rgb(l, v, f); g.beginPath();
    g.moveTo(0,0); g.bezierCurveTo(wid, -len*0.25, wid*1.05, -len*0.85, wid*0.28, -len); g.lineTo(0, -len*0.88); g.lineTo(-wid*0.28, -len);
    g.bezierCurveTo(-wid*1.05, -len*0.85, -wid, -len*0.25, 0, 0); g.fill(); g.restore();
  }
  function blossom(x, y, R, l, v){
    const a0 = r()*TAU; for (let p=0;p<5;p++) petal(x, y, R, R*0.62, a0 + p/5*TAU, l*(0.9+0.1*r()), v, 1);
    g.fillStyle = rgb(l*0.55, v, 1); ellipse(x, y, R*0.22, R*0.22, 0);
  }
  function smallLeaf(x, y, len, rot, l, v){ g.fillStyle = rgb(l, v); ellipse(x, y, len*0.5, len*0.21, rot);
    g.strokeStyle = rgb(l*0.7, v); g.lineWidth = 0.8; g.beginPath(); g.moveTo(x-Math.cos(rot)*len*0.45, y-Math.sin(rot)*len*0.45); g.lineTo(x+Math.cos(rot)*len*0.45, y+Math.sin(rot)*len*0.45); g.stroke(); }

  cell(CELL.PINE, () => {
    for (let t=0;t<9;t++){
      const cx = 40 + r()*176, cy = 40 + r()*176, v = r();
      g.strokeStyle = rgb(0.3, v); g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + (r()-0.5)*30, cy + 20 + r()*20); g.stroke();
      for (let n=0;n<70;n++){
        const a = r()*TAU, L = 26 + r()*34, l = 0.45 + 0.55*r();
        g.strokeStyle = rgb(l, v); g.lineWidth = 1.1 + r()*0.8; g.beginPath();
        g.moveTo(cx + Math.cos(a)*4, cy + Math.sin(a)*4); g.quadraticCurveTo(cx + Math.cos(a+0.15)*L*0.6, cy + Math.sin(a+0.15)*L*0.6, cx + Math.cos(a)*L, cy + Math.sin(a)*L); g.stroke();
      }
    }
  });
  cell(CELL.MAPLE, () => { for (let k=0;k<10;k++){ const s = 34 + r()*22; mapleLeaf(s + r()*(S-2*s), s + r()*(S-2*s), s, r()*TAU, 0.55 + 0.45*r(), r()); } });
  cell(CELL.SAKURA, () => {
    g.strokeStyle = rgb(0.2, 0.5); g.lineWidth = 2.5;
    for (let k=0;k<5;k++){ g.beginPath(); g.moveTo(r()*S, r()*S); g.lineTo(r()*S, r()*S); g.stroke(); }
    for (let k=0;k<6;k++) smallLeaf(20 + r()*216, 20 + r()*216, 26 + r()*10, r()*TAU, 0.5 + 0.4*r(), r());
    for (let k=0;k<16;k++) blossom(22 + r()*212, 22 + r()*212, 15 + r()*7, 0.75 + 0.25*r(), r());
  });
  cell(CELL.BROAD, () => { for (let k=0;k<46;k++) smallLeaf(16 + r()*224, 16 + r()*224, 30 + r()*16, r()*TAU, 0.4 + 0.6*r(), r()); });
  cell(CELL.CEDAR, () => {
    for (let k=0;k<7;k++){
      let x = r()*S, y = S - r()*40, a = -Math.PI/2 + (r()-0.5)*0.9; const v = r();
      for (let s=0;s<22;s++){
        const nx = x + Math.cos(a)*9, ny = y + Math.sin(a)*9;
        g.strokeStyle = rgb(0.35, v); g.lineWidth = 2.2; g.beginPath(); g.moveTo(x,y); g.lineTo(nx,ny); g.stroke();
        for (const sd of [-1,1]){ const b = a + sd*(0.9 + r()*0.3), L = 10 + r()*8; g.strokeStyle = rgb(0.5 + 0.5*r(), v); g.lineWidth = 2.6;
          g.beginPath(); g.moveTo(nx,ny); g.lineTo(nx + Math.cos(b)*L, ny + Math.sin(b)*L); g.stroke(); }
        x = nx; y = ny; a += (r()-0.5)*0.2;
      }
    }
  });
  cell(CELL.TWIG, () => {
    const br = (x, y, a, L, w, d) => { const nx = x + Math.cos(a)*L, ny = y + Math.sin(a)*L;
      g.strokeStyle = rgb(0.3 + 0.1*r(), 0.5); g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x,y); g.lineTo(nx,ny); g.stroke();
      if (d > 0) for (let k=0;k<2 + (r()<0.4?1:0);k++) br(nx, ny, a + (r()-0.5)*1.3, L*(0.62+0.2*r()), Math.max(0.8, w*0.62), d-1); };
    for (let k=0;k<3;k++) br(60 + r()*136, 250, -Math.PI/2 + (r()-0.5)*0.8, 60, 4.5, 5);
  });
  cell(CELL.LEAF1, () => mapleLeaf(128, 120, 118, 0.2, 0.85, 0.5));
  cell(CELL.PETAL, () => petal(128, 225, 200, 110, 0, 0.92, 0.5, 1));
  cell(CELL.DOT, () => { const gr = g.createRadialGradient(128,128,0,128,128,120); gr.addColorStop(0, 'rgba(255,128,255,1)'); gr.addColorStop(0.55, 'rgba(255,128,255,0.9)'); gr.addColorStop(1, 'rgba(255,128,255,0)'); g.fillStyle = gr; g.fillRect(0,0,S,S); });
  cell(CELL.AZALEA, () => {
    for (let k=0;k<44;k++) smallLeaf(14 + r()*228, 14 + r()*228, 22 + r()*10, r()*TAU, 0.4 + 0.6*r(), r());
    for (let k=0;k<14;k++){ const x = 24 + r()*208, y = 24 + r()*208, R = 15 + r()*6, a0 = r()*TAU, v = r();
      for (let p=0;p<5;p++){ g.save(); g.translate(x,y); g.rotate(a0 + p/5*TAU); g.fillStyle = rgb(0.8 + 0.2*r(), v, 1); g.beginPath(); g.ellipse(0, -R*0.55, R*0.42, R*0.55, 0, 0, TAU); g.fill(); g.restore(); }
      g.fillStyle = rgb(0.45, v, 1); ellipse(x, y, R*0.2, R*0.2, 0); }
  });
  // un-premultiply safely: give transparent texels their cell's mean colour so mip levels don't darken the edges
  const img = g.getImageData(0, 0, S*4, S*4), d = img.data;
  for (let cy=0; cy<4; cy++) for (let cx=0; cx<4; cx++){
    let sr=0, sg=0, sb=0, n=0;
    for (let y=cy*S; y<(cy+1)*S; y++) for (let x=cx*S; x<(cx+1)*S; x++){ const o=(y*S*4+x)*4; if (d[o+3] > 128){ sr+=d[o]; sg+=d[o+1]; sb+=d[o+2]; n++; } }
    if (!n) continue; sr/=n; sg/=n; sb/=n;
    for (let y=cy*S; y<(cy+1)*S; y++) for (let x=cx*S; x<(cx+1)*S; x++){ const o=(y*S*4+x)*4; if (d[o+3] < 8){ d[o]=sr; d[o+1]=sg; d[o+2]=sb; } }
  }
  return { data: new Uint8Array(d.buffer), size: S*4 };
}
