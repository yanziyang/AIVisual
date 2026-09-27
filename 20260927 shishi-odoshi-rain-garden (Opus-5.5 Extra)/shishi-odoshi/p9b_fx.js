/* ---------------- Water streams, droplets and leaves ---------------- */
// The kakei stream is traced as a ballistic jet each frame. Where it ends decides what happens: inside the mouth it
// fills the chamber; on the tube's outside it splashes; in the pond it raises rings.
function tubeLocal(p, th){
  const S = SHISHI, c = Math.cos(th), sn = Math.sin(th), d = v3.sub(p, S.pivot);
  const ax = [S.dir[0]*c, sn, S.dir[2]*c], up = [-S.dir[0]*sn, c, -S.dir[2]*sn];
  const s = v3.dot(d, ax), yl = v3.dot(d, up), zl = v3.dot(d, S.side);
  return { s, yl, zl, rho: Math.hypot(yl, zl), cut: S.mouth - S.lipCut*(Math.hypot(yl, zl) > 1e-6 ? yl/Math.hypot(yl, zl) : 1) };
}
function traceJet(p0, v0, th, testTube, maxPts=64){
  let p = p0.slice(), v = v0.slice(); const pts = [p.slice()], dt = 0.004; let hit = 'none';
  for (let i=0;i<400;i++){
    v[1] -= 9.81*dt; p = v3.madd(p, v, dt);
    if (testTube){
      const L = tubeLocal(p, th);
      if (L.s > SHISHI.node && L.s < L.cut + 0.004 && L.rho < SHISHI.r*0.97){ hit = 'mouth'; pts.push(p.slice()); break; }
      if (L.s > SHISHI.back && L.s < L.cut && L.rho < SHISHI.R + 0.004){ hit = 'tube'; pts.push(p.slice()); break; }
    }
    const g = terrainH(p[0], p[2]);
    if (p[1] <= Math.max(g, 0)){ hit = g < 0 ? 'water' : 'ground'; p[1] = Math.max(g, 0); pts.push(p.slice()); break; }
    if (i % 3 === 0 && pts.length < maxPts) pts.push(p.slice());
  }
  return { pts, hit, end: p, vel: v };
}
const FX = { jet: null, pourJet: null, fill: 0 };
function updateStreams(dt){
  const S = SHISHI, dir = v3.norm(v3.sub(S.spoutEnd, S.spoutStart));
  FX.jet = SH.flow > 0.001 ? traceJet(S.spoutEnd, v3.mul(dir, 0.12 + 0.8*SH.flow), SH.th, true) : null;
  SH.inflow = FX.jet && FX.jet.hit === 'mouth' ? SH.flow : 0;
  // pour over the lowest point of the lip
  FX.pourJet = null;
  if (SH.pour > 0.03){
    const th = SH.th, c = Math.cos(th), sn = Math.sin(th);
    const lip = S.at(S.mouth + S.lipCut, th, -S.r*0.8);
    const ax = [S.dir[0]*c, sn, S.dir[2]*c], up = [-S.dir[0]*sn, c, -S.dir[2]*sn];
    const v = v3.add(v3.mul(ax, 0.25 + 1.1*Math.sqrt(SH.pour)), v3.mul(up, SH.om*(S.mouth + S.lipCut)*0.7));
    FX.pourJet = traceJet(lip, v, th, false);
  }
}

/* ---- droplets: short-lived ballistic particles ---- */
const DROPS = [];
function spawnDrop(p, v, life=1.2, size=0.004){ if (DROPS.length < 420) DROPS.push({ p: p.slice(), v: v.slice(), life, age: 0, size }); }
function splashAt(p, strength, n, up=1.2){
  for (let i=0;i<n;i++){ const a = Math.random()*TAU, sp = (0.25 + Math.random()*0.8)*strength;
    spawnDrop([p[0], p[1] + 0.005, p[2]], [Math.cos(a)*sp*0.8, (0.4 + Math.random())*up*strength, Math.sin(a)*sp*0.8], 1.0, 0.0025 + Math.random()*0.003); }
}
function updateDrops(dt){
  for (let i=DROPS.length-1;i>=0;i--){
    const d = DROPS[i]; d.age += dt; d.v[1] -= 9.81*dt; d.p = v3.madd(d.p, d.v, dt);
    const g = terrainH(d.p[0], d.p[2]);
    if (d.p[1] < Math.max(g, 0) || d.age > d.life){
      if (g < 0 && d.p[1] < 0.01) addDrop(d.p[0], d.p[2], 0.008, 0.0012 + d.size*0.3);
      DROPS.splice(i, 1);
    }
  }
}

/* ---- leaves: floating on the pond, and falling from the maple ---- */
const LEAVES = [];      // floating
const FALLING = [];
const rndPond = r => { for (let k=0;k<400;k++){ const x = -0.1 + 2.3*r(), z = -0.5 + 3.8*r(); if (pondSD(x, z) < -0.14) return [x, z]; } return [1, 1.2]; };
function initLeaves(){
  const r = mulberry(8080);
  for (let i=0;i<12;i++){ const [x, z] = rndPond(r); LEAVES.push({ x, z, rot: r()*TAU, spin: 0, vx: 0, vz: 0, sp: r() < 0.65 ? SPECIES.LEAF_RED : SPECIES.LEAF_PALE, size: 0.06 + 0.035*r(), r1: r(), r2: r(), age: 99 }); }
}
function pushLeaves(x, z, k){
  for (const L of LEAVES){ const dx = L.x - x, dz = L.z - z, d = Math.hypot(dx, dz); if (d < 0.5 && d > 1e-4){ const f = k*(1 - d/0.5)/d; L.vx += dx*f; L.vz += dz*f; L.spin += (Math.random() - 0.5)*k*6; } }
}
function dropLeaves(n, overPond=true){
  for (let i=0;i<n;i++){
    const x = overPond ? 0.1 + Math.random()*1.9 : MAPLE.x - 1.5 + Math.random()*2.6;
    const z = overPond ? -0.2 + Math.random()*3.3 : MAPLE.z - 1.5 + Math.random()*2.4;
    FALLING.push({ p: [x, 2.6 + Math.random()*1.4, z], ph: Math.random()*TAU, rot: Math.random()*TAU, sp: Math.random() < 0.75 ? SPECIES.LEAF_RED : SPECIES.LEAF_PALE, size: 0.06 + 0.035*Math.random(), r1: Math.random(), r2: Math.random(), tilt: 0 });
  }
}
function updateLeaves(dt, t, wind){
  // occasional leaves from the maple, more in a breeze
  if (Math.random() < dt*(0.04 + 0.25*wind)) dropLeaves(1, Math.random() < 0.55);
  for (let i=FALLING.length-1;i>=0;i--){
    const F = FALLING[i]; F.ph += dt*(2.2 + F.r1);
    F.p[0] += (Math.sin(F.ph)*0.35 + S.windV[0]*0.25)*dt; F.p[2] += (Math.cos(F.ph*0.7)*0.25 + S.windV[2]*0.25)*dt;
    F.p[1] -= (0.55 + 0.25*Math.sin(F.ph*2.0))*dt; F.rot += dt*1.5; F.tilt = Math.sin(F.ph)*0.9;
    const g = terrainH(F.p[0], F.p[2]);
    if (F.p[1] <= Math.max(g, 0) + 0.003){
      if (g < 0 && pondSD(F.p[0], F.p[2]) < -0.06){
        LEAVES.push({ x: F.p[0], z: F.p[2], rot: F.rot, spin: 0.5, vx: 0, vz: 0, sp: F.sp, size: F.size, r1: F.r1, r2: F.r2, age: 0 });
        addDrop(F.p[0], F.p[2], 0.02, 0.0015);
        if (LEAVES.length > 24) LEAVES.shift();
      }
      FALLING.splice(i, 1);
    }
  }
  for (const L of LEAVES){
    L.age += dt;
    // a slow circulation plus the breeze; the pour and taps push the leaves (pushLeaves)
    const cx = 1.0, cz = 1.4;
    L.vx += (-(L.z - cz)*0.004 + S.windV[0]*0.004 + (Math.random() - 0.5)*0.004)*dt*10;
    L.vz += ((L.x - cx)*0.004 + S.windV[2]*0.004 + (Math.random() - 0.5)*0.004)*dt*10;
    L.vx *= Math.exp(-dt*0.9); L.vz *= Math.exp(-dt*0.9); L.spin *= Math.exp(-dt*1.5);
    const nx = L.x + L.vx*dt, nz = L.z + L.vz*dt;
    if (pondSD(nx, nz) < -0.07){ L.x = nx; L.z = nz; } else { L.vx *= -0.4; L.vz *= -0.4; const e = 0.02, gx = pondSD(L.x+e, L.z) - pondSD(L.x-e, L.z), gz = pondSD(L.x, L.z+e) - pondSD(L.x, L.z-e); L.x -= gx*0.3; L.z -= gz*0.3; }
    L.rot += L.spin*dt;
  }
}

/* ---- dynamic vertex buffers: streams and droplets (transparent pass), leaves (foliage pass) ---- */
const DYN_MAX = 4096;
function dynBuffer(){
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, DYN_MAX*4*STRIDE*4, gl.DYNAMIC_DRAW);
  for (const [loc, n, off] of [[0,3,0],[1,3,3],[2,4,6],[3,2,10],[4,4,12]]){ gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, STRIDE*4, off*4); }
  const idx = new Uint32Array(DYN_MAX*6); for (let k=0;k<DYN_MAX;k++) idx.set([4*k,4*k+1,4*k+2,4*k,4*k+2,4*k+3], 6*k);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, vb, data: new Float32Array(DYN_MAX*4*STRIDE), quads: 0 };
}
function dynPut(B, p, n, col, uv, attr){
  const o = B.n*STRIDE, d = B.data;
  d[o]=p[0]; d[o+1]=p[1]; d[o+2]=p[2]; d[o+3]=n[0]; d[o+4]=n[1]; d[o+5]=n[2];
  d[o+6]=col[0]; d[o+7]=col[1]; d[o+8]=col[2]; d[o+9]=col[3]; d[o+10]=uv[0]; d[o+11]=uv[1];
  d[o+12]=attr[0]; d[o+13]=attr[1]; d[o+14]=attr[2]; d[o+15]=attr[3]; B.n++;
}
function dynUpload(B){ B.quads = B.n/4; if (B.n){ gl.bindBuffer(gl.ARRAY_BUFFER, B.vb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, B.data, 0, B.n*STRIDE); } }
// a ribbon through pts, always facing the camera; at least ~1.3 px wide so thin jets stay visible (their cover drops instead)
function ribbon(B, pts, widthAt, camPos, pxAt, seed, speed){
  let arc = 0;
  for (let i=0;i<pts.length-1 && B.n < DYN_MAX*4-8;i++){
    const a = pts[i], b = pts[i+1], seg = v3.len(v3.sub(b, a)); if (seg < 1e-5) continue;
    const T = v3.mul(v3.sub(b, a), 1/seg);
    const side = (p) => v3.norm(v3.cross(T, v3.sub(camPos, p)));
    const q = [[a, arc], [b, arc + seg]].map(([p, s], k) => {
      const t = (i + k)/(pts.length - 1), w = widthAt(t), px = pxAt(p)*1.3, ww = Math.max(w, px), cover = Math.min(1, w/px*1.6 + 0.1);
      return { p, s, sd: side(p), ww, cover };
    });
    for (const [k, u] of [[0,0],[0,1],[1,1],[1,0]]){ const Q = q[k];
      dynPut(B, v3.madd(Q.p, Q.sd, (u - 0.5)*Q.ww), Q.sd, [Q.cover, 0, 0, 1], [u, Q.s], [0, 0, seed, speed]); }
    arc += seg;
  }
}
function buildFxVerts(B, camPos, pxAt){
  B.n = 0;
  if (FX.jet){ const r0 = 0.0035 + 0.02*Math.sqrt(SH.flow); ribbon(B, FX.jet.pts, t => r0*2*(1 - 0.35*t), camPos, pxAt, 0.1, 0.9); }
  if (FX.pourJet){ const w = 0.012 + 0.05*Math.sqrt(SH.pour); ribbon(B, FX.pourJet.pts, t => w*(1 - 0.3*t), camPos, pxAt, 0.6, 1.4); }
  B.nStream = B.n;
  for (const d of DROPS){
    if (B.n >= DYN_MAX*4-4) break;
    const tail = v3.madd(d.p, d.v, -0.018), T = v3.sub(d.p, tail), sd = v3.norm(v3.cross(T.some(Math.abs) ? T : [0,1,0], v3.sub(camPos, d.p)));
    const px = pxAt(d.p), w = Math.max(d.size, px*1.1), cover = Math.min(1, d.size/px + 0.25)*(1 - d.age/d.life);
    for (const [e, u] of [[0,0],[0,1],[1,1],[1,0]]) dynPut(B, v3.madd(e ? tail : d.p, sd, (u - 0.5)*w), sd, [cover, 0, 0, 1], [u, e], [0, 0, 0, 0]);
  }
  dynUpload(B);
}
function buildLeafVerts(B){
  B.n = 0;
  const quad = (c, t1, t2, hs, L, lift) => {
    for (const [u, v] of [[0,0],[1,0],[1,1],[0,1]]){
      const p = v3.add(c, v3.add(v3.mul(t1, (u - 0.5)*2*hs), v3.mul(t2, (v - 0.5)*2*hs)));
      dynPut(B, p, [0,1,0], [L.r1, L.r2, 0, 0.9], [u, v], [L.sp, lift, L.r1, 0]);
    }
  };
  for (const L of LEAVES){ const c = Math.cos(L.rot), s = Math.sin(L.rot); quad([L.x, 0.003, L.z], [c, 0, s], [-s, 0, c], L.size/2, L, -1); }
  for (const F of FALLING){ const c = Math.cos(F.rot), s = Math.sin(F.rot), ct = Math.cos(F.tilt), st = Math.sin(F.tilt);
    quad(F.p, [c*ct, st, s*ct], [-s, 0, c], F.size/2, F, 0); }
  dynUpload(B);
}
