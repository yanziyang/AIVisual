// Fits the garden camera to landmark positions measured on the reference frame (screen x as a fraction of width).
const L = [ // [x, z, height(y), refX]
  [-1.86,-2.3, 1.0, 0.35], [0.0,-0.36, 0.4, 0.44], [1.12,-0.66, 0.9, 0.625], [-3.95,-1.95, 0.5, 0.15], [-2.72,-2.38, 0.5, 0.28], [1.78, 0.18, 0.3, 0.69],
];
const refY = [ // [x,y,z, refY fraction of height]  y measured on the 800x454 frame
  [-1.86, 1.72, -2.3, 5/454], [0.02, 0.12, -0.36, 265/454], [1.12, 0.12, -0.66, 265/454], [0.8, 0.0, -0.5, 290/454] ];
let best = null;
for (let cx=-1.5; cx<=4.8; cx+=0.05) for (let cz=2.5; cz<=6.5; cz+=0.05) for (let yaw=-0.6; yaw<=0.4; yaw+=0.01){
  for (const hf of [0.42,0.46,0.5,0.54,0.58,0.62,0.66,0.7]){   // tan(hfov/2)
    let e = 0;
    for (const [x,z,,rx] of L){ const az = Math.atan2(x - cx, cz - z); const nd = Math.tan(az - yaw)/hf; e += (nd - (rx*2-1))**2; }
    if (!best || e < best.e) best = { e, cx, cz, yaw, hf };
  }
}
console.log('plan fit', best, 'hfov', (2*Math.atan(best.hf)*180/Math.PI).toFixed(1), 'vfov(16:9)', (2*Math.atan(best.hf/1.778)*180/Math.PI).toFixed(1));
// height and pitch from the vertical positions
let bh = null;
for (let cy=1.0; cy<=4.5; cy+=0.02) for (let pitch=-0.8; pitch<=-0.05; pitch+=0.005){
  const tv = best.hf/1.778; let e = 0;
  for (const [x,y,z,ry] of refY){
    const dx = x - best.cx, dz = z - best.cz, dy = y - cy;
    const fwd = [Math.sin(best.yaw)*Math.cos(pitch), Math.sin(pitch), -Math.cos(best.yaw)*Math.cos(pitch)];
    const up = [-Math.sin(best.yaw)*Math.sin(pitch), Math.cos(pitch), Math.cos(best.yaw)*Math.sin(pitch)];
    const zc = dx*fwd[0] + dy*fwd[1] + dz*fwd[2], yc = dx*up[0] + dy*up[1] + dz*up[2];
    const nd = yc/zc/tv; e += (nd - (1 - ry*2))**2;
  }
  if (!bh || e < bh.e) bh = { e, cy, pitch };
}
console.log('height fit', bh);
