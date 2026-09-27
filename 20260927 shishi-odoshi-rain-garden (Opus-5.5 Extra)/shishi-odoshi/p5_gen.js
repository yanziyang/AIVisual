/* ---------------- Procedural geometry ---------------- */
// Everything is generated at load from the layout above: no models or image files are downloaded.
const LAMPS = [];   // light sources: [x, y, z, strength]
const smin = (a,b,k) => { const h = clamp(0.5+0.5*(b-a)/k, 0, 1); return lerp(b,a,h) - k*h*(1-h); };
const fract = x => x - Math.floor(x);

/* ---- terrain: 5 cm grid inside the fence, a coarse ring outside it for the bamboo grove ---- */
function buildTerrain(M){
  const put = (x,y,z, n, col, ao, sd) => { M.v.push(x,y,z, n[0],n[1],n[2], col[0],col[1],col[2], ao, sd, 0, MAT.TERRAIN, 0, 0, 0); return M.count-1; };
  const c = 0.05, x0 = YARD.x0 - 0.2, z0 = YARD.z0 - 0.2;
  const nx = Math.round((YARD.x1 - YARD.x0 + 0.4)/c) + 1, nz = Math.round((YARD.z1 - YARD.z0 + 0.4)/c) + 1;
  const H = new Float32Array(nx*nz);
  for (let j=0;j<nz;j++) for (let i=0;i<nx;i++) H[j*nx+i] = terrainH(x0+i*c, z0+j*c);
  const hAt = (i,j) => H[clamp(j,0,nz-1)*nx + clamp(i,0,nx-1)];
  const base = M.count;
  for (let j=0;j<nz;j++) for (let i=0;i<nx;i++){
    const x = x0+i*c, z = z0+j*c, h = H[j*nx+i];
    const nr = v3.norm([hAt(i-1,j)-hAt(i+1,j), 2*c, hAt(i,j-1)-hAt(i,j+1)]);
    let avg = 0; for (const [a,b] of [[5,0],[-5,0],[0,5],[0,-5],[4,4],[-4,4],[4,-4],[-4,-4]]) avg += hAt(i+a,j+b); avg /= 8;
    const ao = clamp(1 - Math.max(0, avg-h)*1.6, 0.45, 1);
    const sd = pondSD(x, z);
    // col: r = moss cover, g = bare soil at the fence foot and the pond lip, b = unused
    const fenceD = Math.min(x - YARD.x0, YARD.x1 - x, z - YARD.z0, YARD.z1 - z);
    const soil = smooth(0.22, 0.0, fenceD);
    const moss = clamp(1 - soil*0.85 - 0.35*smooth(0.55, 0.8, fbm2(x*0.9, z*0.9, 3, 91)), 0, 1);
    put(x, h, z, nr, [moss, soil, 0], ao, sd);
  }
  for (let j=0;j<nz-1;j++) for (let i=0;i<nx-1;i++){ const a = base+j*nx+i; M.quad(a, a+nx, a+nx+1, a+1); }
  // outer ring (0.5 m cells) under the bamboo grove, tucked slightly lower where it meets the fine grid
  const c2 = 0.5, o2 = -22, m2 = 88, b2 = M.count;
  for (let j=0;j<=m2;j++) for (let i=0;i<=m2;i++){
    const x = o2+i*c2, z = o2 + 1.8 + j*c2;
    const h = GROUND - 0.03 + 0.25*(fbm2(x*0.15, z*0.15, 3, 17) - 0.5) + 0.05*smooth(3, 12, Math.hypot(x, z-1.8));
    put(x, h, z, [0,1,0], [0.35, 0.7, 0], 0.8, 50);
  }
  for (let j=0;j<m2;j++) for (let i=0;i<m2;i++){
    const x = o2+(i+0.5)*c2, z = o2 + 1.8 + (j+0.5)*c2;
    if (x > YARD.x0-0.1 && x < YARD.x1+0.1 && z > YARD.z0-0.1 && z < YARD.z1+0.1) continue;
    const a = b2+j*(m2+1)+i; M.quad(a, a+m2+1, a+m2+2, a+1);
  }
}

/* ---- rocks: icosphere cut by random planes, then noise (from the Tsukiyama build) ---- */
const ROCK_COL = { boulder:[0.3,0.3,0.285], moss:[0.14,0.14,0.135], dark:[0.075,0.075,0.075], step:[0.095,0.095,0.092] };
const ROCK_KIND = { boulder:0, moss:1, dark:2, step:3 };
function makeRock(M, S){
  const ico = ICO[S.sub ?? 2], r = mulberry(S.seed*7919+13), base = M.count;
  const planes = [], np = 6 + Math.floor(r()*5);
  for (let k=0;k<np;k++){ const a = r()*TAU, y = r()*1.3-0.45; planes.push({ n: v3.norm([Math.cos(a), y, Math.sin(a)]), d: 0.55 + 0.36*r() }); }
  const round = S.kind === 'boulder' || S.kind === 'moss';     // river-worn: soften the cuts
  const strat = v3.norm([r()-0.5, 2.5 + r(), r()-0.5]), sf = 9 + 8*r();
  if (S.flatTop) planes.push({ n:[0,1,0], d: S.flatTop });
  const off = [r()*100, r()*100, r()*100];
  const col = S.col || ROCK_COL[S.kind] || ROCK_COL.moss;
  const tint = 0.88 + 0.24*r();
  const m = mat(MAT.ROCK, col, { seed: r(), x: ROCK_KIND[S.kind] ?? 1 });
  const rot = S.rot ?? r()*TAU, tilt = S.tilt ?? 0, ca = Math.cos(rot), sa = Math.sin(rot), ct = Math.cos(tilt), st = Math.sin(tilt);
  const y0 = S.y ?? terrainH(S.x, S.z), sink = S.sink ?? 0.35;
  const cy = y0 + S.sy - 2*S.sy*sink;
  const rr = [];
  for (const d of ico.P){
    let q = 1;
    for (const p of planes){ const c = v3.dot(d, p.n); if (c > 0.05) q = smin(q, p.d/c, round ? 0.16 : 0.045); }
    const rid = 1 - Math.abs(2*fbm3(d[0]*2.2+off[1], d[1]*2.2+off[2], d[2]*2.2+off[0], 3) - 1);
    q *= 1 + 0.2*(fbm3(d[0]*1.5+off[0], d[1]*1.5+off[1], d[2]*1.5+off[2], 3)-0.5) + (round ? 0.03 : 0.07)*(rid-0.5)
      + 0.04*(vnoise3(d[0]*6+off[0], d[1]*6, d[2]*6+off[2])-0.5) + (round ? 0 : 0.012*Math.sin(v3.dot(d, strat)*sf + off[0]));
    rr.push(q);
  }
  ico.P.forEach((d,i) => {
    let lx = d[0]*rr[i]*S.sx, ly = d[1]*rr[i]*S.sy, lz = d[2]*rr[i]*S.sz;
    const ty = ly*ct - lz*st, tz = ly*st + lz*ct; ly = ty; lz = tz;
    const wx = lx*ca + lz*sa, wz = -lx*sa + lz*ca;
    const ao = clamp(0.45 + 0.55*smooth(-0.8, 0.4, d[1]), 0.32, 1) * clamp(0.75 + (rr[i]-0.75)*0.9, 0.6, 1);
    const v = 0.82 + 0.36*fbm3(d[0]*2.2+off[1], d[1]*2.2, d[2]*2.2+off[2], 2);
    M.vert([S.x+wx, cy+ly, S.z+wz], [0,1,0], m, [d[0]*S.sx+d[2]*S.sz, d[1]*S.sy], ao, [col[0]*tint*v, col[1]*tint*v, col[2]*tint*v]);
  });
  for (const [a,b,c] of ico.F) M.tri(base+a, base+b, base+c);
  M.smoothNormals(base);
  return { base, end: M.count };
}
// highest vertex of a mesh range near (x, z)
function topNear(M, range, x, z, rad){
  let best = -1e9;
  for (let i=range.base;i<range.end;i++){ const o = i*STRIDE; if (Math.hypot(M.v[o]-x, M.v[o+2]-z) < rad) best = Math.max(best, M.v[o+1]); }
  return best;
}
function shiftY(M, range, dy){ for (let i=range.base;i<range.end;i++) M.v[i*STRIDE+1] += dy; }
function buildRocks(M){
  for (const R of ROCKS){
    const g = R.range = makeRock(M, R);
    if (R.strike){
      // the striking stone is raised or lowered so its crown meets the tube's closed end exactly at the rest angle
      const t = topNear(M, g, SHISHI.backRest[0], SHISHI.backRest[2], 0.035);
      shiftY(M, g, SHISHI.backRest[1] - t - 0.002);
    }
  }
}

/* ---- bamboo helpers ---- */
// straight culm from p0 to p1; uv.x runs around, uv.y is in internode units (nodes at integers, drawn by the shader)
function culm(M, m, p0, p1, r0, r1, sides, opt={}){
  const d = v3.sub(p1,p0), L = v3.len(d), T = v3.mul(d, 1/L), N = opt.N || perp(T), B = v3.cross(T, N);
  const segs = opt.segs || 1, sp = opt.internode || 0.3, ph = opt.phase ?? 0, rings = [];
  for (let i=0;i<=segs;i++){
    const t = i/segs, c = v3.madd(p0, d, t), rad = lerp(r0, r1, t), ring = [];
    for (let s=0;s<=sides;s++){ const a = s/sides*TAU, dir = v3.add(v3.mul(N, Math.cos(a)), v3.mul(B, Math.sin(a)));
      ring.push(M.vert(v3.madd(c, dir, rad), dir, m, [s/sides, ph + t*L/sp], opt.ao ? opt.ao(t) : 1)); }
    rings.push(ring);
  }
  for (let i=0;i<segs;i++) for (let s=0;s<sides;s++) M.quadAuto(rings[i][s], rings[i][s+1], rings[i+1][s+1], rings[i+1][s]);
  const cap = (c, n, rad) => { const mc = Object.assign({}, m, { x: 1 }); const k = M.vert(c, n, mc, [0.5, 0]);
    for (let s=0;s<sides;s++){ const a0 = s/sides*TAU, a1 = (s+1)/sides*TAU;
      const q0 = v3.add(v3.mul(N, Math.cos(a0)), v3.mul(B, Math.sin(a0))), q1 = v3.add(v3.mul(N, Math.cos(a1)), v3.mul(B, Math.sin(a1)));
      M.triAuto(k, M.vert(v3.madd(c, q0, rad), n, mc, [0.5 + 0.5*Math.cos(a0), 1]), M.vert(v3.madd(c, q1, rad), n, mc, [0.5 + 0.5*Math.cos(a1), 1])); } };
  if (opt.cap1) cap(p1, T, r1);
  if (opt.cap0) cap(p0, v3.mul(T,-1), r0);
  return { T, N, B, L };
}
// open end of a hollow culm: rim annulus plus a short dark inner wall
function openEnd(M, m, mIn, c, T, N, rOut, rIn, depth, sides){
  const B = v3.cross(T, N), mr = Object.assign({}, m, { x: 2 });
  for (let s=0;s<sides;s++){
    const a0 = s/sides*TAU, a1 = (s+1)/sides*TAU;
    const q0 = v3.add(v3.mul(N, Math.cos(a0)), v3.mul(B, Math.sin(a0))), q1 = v3.add(v3.mul(N, Math.cos(a1)), v3.mul(B, Math.sin(a1)));
    const k = [M.vert(v3.madd(c,q0,rOut), T, mr, [s/sides,0]), M.vert(v3.madd(c,q1,rOut), T, mr, [(s+1)/sides,0]), M.vert(v3.madd(c,q1,rIn), T, mr, [(s+1)/sides,1]), M.vert(v3.madd(c,q0,rIn), T, mr, [s/sides,1])];
    M.quadAuto(k[0],k[1],k[2],k[3]);
    const cb = v3.madd(c, T, -depth);
    const w = [M.vert(v3.madd(c,q0,rIn), v3.mul(q0,-1), mIn, [s/sides,0]), M.vert(v3.madd(c,q1,rIn), v3.mul(q1,-1), mIn, [(s+1)/sides,0]),
               M.vert(v3.madd(cb,q1,rIn), v3.mul(q1,-1), mIn, [(s+1)/sides,1], 0.2), M.vert(v3.madd(cb,q0,rIn), v3.mul(q0,-1), mIn, [s/sides,1], 0.2)];
    M.quadAuto(w[0],w[1],w[2],w[3]);
  }
}
// black shuro-palm rope wound around a culm: a few stacked rings
function ropeBand(M, c, T, R, turns, pitch=0.009){
  const m = mat(MAT.ROPE, [0.028,0.022,0.018]), N = perp(T), B = v3.cross(T, N);
  for (let k=0;k<turns;k++){
    const cc = v3.madd(c, T, (k - (turns-1)/2)*pitch), pts = [], rad = [];
    for (let s=0;s<=14;s++){ const a = s/14*TAU; pts.push(v3.madd(cc, v3.add(v3.mul(N, Math.cos(a)), v3.mul(B, Math.sin(a))), R + 0.0035)); rad.push(0.0048); }
    tube(M, m, pts, rad, 4);
  }
}

/* ---- the takegaki: bamboo fence of close-set round culms, pale rails and rope ties ---- */
function buildFence(M){
  const r = mulberry(77);
  const sides = [
    { a:[YARD.x0-0.35, YARD.z0], b:[YARD.x1+0.35, YARD.z0], n:[0,0,1] },
    { a:[YARD.x0, YARD.z1+0.35], b:[YARD.x0, YARD.z0-0.35], n:[1,0,0] },
    { a:[YARD.x1, YARD.z0-0.35], b:[YARD.x1, YARD.z1+0.35], n:[-1,0,0] },
    { a:[YARD.x1+0.35, YARD.z1], b:[YARD.x0-0.35, YARD.z1], n:[0,0,-1] },
  ];
  const mRail = mat(MAT.RAIL, [0.3,0.26,0.18]), mRope = mat(MAT.ROPE, [0.028,0.022,0.018]);
  let culms = 0;
  for (const S of sides){
    const L = Math.hypot(S.b[0]-S.a[0], S.b[1]-S.a[1]), dir = [(S.b[0]-S.a[0])/L, 0, (S.b[1]-S.a[1])/L], n = S.n;
    const P = (s, off, y) => [S.a[0] + dir[0]*s + n[0]*off, y, S.a[1] + dir[2]*s + n[2]*off];
    for (let s=0; s<L; ){
      const d = 0.046 + 0.018*r(), c = P(s + d/2, -d/2 - 0.004, 0);
      const g = terrainH(clamp(c[0], YARD.x0, YARD.x1), clamp(c[2], YARD.z0, YARD.z1));
      const v = r(), grey = r();
      const col = [lerp(0.085, 0.062, v)*lerp(1, 1.12, grey), lerp(0.07, 0.062, v)*lerp(1, 1.1, grey), lerp(0.045, 0.036, v)*lerp(1, 1.3, grey)];
      const top = FENCE_H + (r()-0.5)*0.035;
      culm(M, mat(MAT.OLDBAMBOO, col, { seed: r() }), [c[0], g-0.08, c[2]], [c[0], top, c[2]], d/2, d/2*0.94, 6,
        { cap1:true, internode: 0.27 + 0.1*r(), phase: r(), N: n, ao: t => lerp(0.6, 1.0, Math.min(1, t*4)) });
      s += d - 0.001; culms++;
    }
    // a second, offset row of culms behind the first, so no light shows between them
    { const bm = mat(MAT.OLDBAMBOO, [0.05,0.043,0.03], { seed: 0.5 });
      for (let s=0.03; s<L; s+=0.05){ const c = P(s, -0.075, 0), g = terrainH(clamp(c[0], YARD.x0, YARD.x1), clamp(c[2], YARD.z0, YARD.z1));
        culm(M, bm, [c[0], g-0.08, c[2]], [c[0], FENCE_H - 0.02, c[2]], 0.026, 0.025, 4, { N: n, internode: 0.3, phase: s*7.3 }); } }
    // posts every ~1.9 m
    const np = Math.round(L/1.9);
    for (let k=0;k<=np;k++){
      const s = 0.3 + k*(L-0.6)/np, c = P(s, 0.046, 0), g = terrainH(clamp(c[0], YARD.x0, YARD.x1), clamp(c[2], YARD.z0, YARD.z1));
      culm(M, mat(MAT.OLDBAMBOO, [0.085,0.075,0.05], { seed: r() }), [c[0], g-0.1, c[2]], [c[0], FENCE_H+0.08, c[2]], 0.043, 0.04, 12,
        { cap1:true, segs:3, internode:0.32, phase:r(), ao: t => lerp(0.55, 1.0, Math.min(1, t*3)) });
    }
    // rails (oshibuchi) in front of the posts, tied at intervals with black rope
    for (const y of [0.46, 1.12, 1.78, FENCE_H-0.06]){
      const rr = y > 2 ? 0.024 : 0.021, off = 0.046 + 0.043 + rr;
      culm(M, mRail, P(0, off, y), P(L, off, y), rr, rr, 8, { segs: 6, internode: 0.34, phase: r(), N:[0,1,0] });
      for (let s = 0.12 + r()*0.2; s < L-0.1; s += 0.34 + r()*0.12){
        const c = P(s, off + rr*0.7, y);
        for (const sg of [1,-1]){
          const u = v3.norm([dir[0]*0.7071, sg*0.7071, dir[2]*0.7071]);
          beam(M, mRope, v3.madd(c, u, -0.032), v3.madd(c, u, 0.032), 0.009, 0.009, n);
        }
      }
    }
  }
  return culms;
}

/* ---- stone lantern: a tall pedestal type, weathered granite with moss ---- */
function firebox(M, c, r, h, rot){
  const m = mat(MAT.FIREBOX, [0.22,0.21,0.2]);
  for (let s=0;s<6;s++){
    const a0 = rot + s/6*TAU, a1 = rot + (s+1)/6*TAU, am = (a0+a1)/2, n = [Math.cos(am),0,Math.sin(am)];
    const p = (a,y) => [c[0]+Math.cos(a)*r, c[1]+y, c[2]+Math.sin(a)*r];
    const q = [M.vert(p(a0,0), n, m, [s,0]), M.vert(p(a1,0), n, m, [s+1,0]), M.vert(p(a1,h), n, m, [s+1,1]), M.vert(p(a0,h), n, m, [s,1])];
    M.quadAuto(q[0],q[1],q[2],q[3]);
  }
  lathe(M, mat(MAT.FIREBOX, [0.2,0.2,0.2], { seed:2 }), [c[0], c[1]+h*0.12, c[2]], [[r*0.6,0],[r*0.6,h*0.74]], 6, true, rot);
}
function buildLantern(M){
  const { x, z, rot, s } = LANTERN;
  const plinth = ROCKS.find(R => R.x === x && R.z === z);
  const g = plinth && plinth.range ? topNear(M, plinth.range, x, z, 0.1) - 0.012 : terrainH(x,z);
  const st = mat(MAT.STONE, [0.13,0.128,0.122], { seed: 0.37 });
  const L = (y, prof, sides=6, flat=true) => lathe(M, st, [x, y, z], prof.map(([r,h])=>[r*s,h*s]), sides, flat, rot);
  let y = g - 0.03;
  L(y, [[0.23,0],[0.23,0.07],[0.19,0.1],[0.19,0.12],[0.13,0.16]]); y += 0.16*s;                        // kiso (base)
  L(y, [[0.078,0],[0.074,0.21],[0.088,0.23],[0.088,0.27],[0.074,0.29],[0.068,0.52]], 16, false); y += 0.52*s;   // sao (column)
  L(y, [[0.09,0],[0.21,0.06],[0.21,0.12],[0.17,0.14]]); y += 0.14*s;                                 // chūdai
  firebox(M, [x,y,z], 0.15*s, 0.23*s, rot); LAMPS.push([x, y+0.12*s, z, 0.22]); y += 0.23*s;            // hibukuro
  L(y, [[0.16,0],[0.37,0.035],[0.39,0.07],[0.24,0.15],[0.1,0.21],[0.075,0.23]]);                      // kasa (roof)
  for (let k=0;k<6;k++){ const a = rot + k/6*TAU;                                                      // warabite: curled corners
    boxAxis(M, st, [x+Math.cos(a)*0.37*s, y+0.075*s, z+Math.sin(a)*0.37*s], [0.04*s, 0.045*s, 0.04*s], -a); }
  y += 0.23*s;
  L(y, [[0.05,0],[0.065,0.03],[0.05,0.055],[0.068,0.095],[0.05,0.14],[0.02,0.17],[0,0.18]], 12, false); // hōju
  LANTERN.top = y + 0.18*s;
}

/* ---- shishi-odoshi: the static parts (posts, axle, kakei and spout) ---- */
function buildShishiStatic(M){
  const S = SHISHI, r = mulberry(33);
  const mB = (sd, col=[0.2,0.24,0.1]) => mat(MAT.BAMBOO, col, { seed: sd });
  const mIn = mat(MAT.INNER, [0.28,0.24,0.14]);
  // two posts either side of the tube, joined by the axle pin
  S.posts.forEach(([px, pz], k) => {
    const g = terrainH(px, pz), top = S.pivot[1] + (k ? 0.1 : 0.14);
    culm(M, mB(0.2 + 0.3*k, [0.19,0.23,0.095]), [px, g-0.08, pz], [px, top, pz], 0.031, 0.029, 14, { cap1:true, segs:4, internode:0.24, phase:0.35 + 0.3*k, ao: t => lerp(0.55, 1, Math.min(1, t*2.5)) });
    ropeBand(M, [px, g+0.08, pz], [0,1,0], 0.031, 3);
  });
  const ax = S.side, pv = S.pivot;
  culm(M, mat(MAT.WOOD, [0.12,0.09,0.06]), v3.madd(pv, ax, -0.135), v3.madd(pv, ax, 0.135), 0.0085, 0.0085, 8, { cap0:true, cap1:true });
  // kakei: tall culm; the spout is a thinner culm let into its side just below the top node
  const [kx, kz] = S.kakei, g = terrainH(kx, kz);
  culm(M, mB(0.62, [0.21,0.25,0.1]), [kx, g-0.1, kz], [kx, S.kakeiTop, kz], 0.052, 0.048, 16, { cap1:true, segs:6, internode:0.31, phase:0.55, ao: t => lerp(0.55, 1, Math.min(1, t*3)) });
  ropeBand(M, [kx, S.spoutStart[1] + 0.055, kz], [0,1,0], 0.051, 4);
  ropeBand(M, [kx, g + 0.1, kz], [0,1,0], 0.052, 3);
  const T = v3.norm(v3.sub(S.spoutEnd, S.spoutStart));
  const ret = culm(M, mB(0.81, [0.25,0.28,0.12]), S.spoutStart, S.spoutEnd, 0.021, 0.02, 12, { segs:2, internode:0.28, phase:0.2 });
  openEnd(M, mB(0.81, [0.25,0.28,0.12]), mIn, S.spoutEnd, T, ret.N, 0.02, 0.015, 0.08, 12);
}

/* ---- shishi-odoshi: the moving tube, built in its own frame (pivot at the origin, axis +x, axle +z) ---- */
function buildTube(){
  const M = new Mesh(), S = SHISHI, sides = 24;
  const mOut = mat(MAT.BAMBOO, [0.2,0.26,0.1], { seed: 0.44 }), mIn = mat(MAT.INNER, [0.3,0.27,0.15]);
  // node coordinate: the closed end and the chamber's node sit on nodes; the chamber is one long internode
  const nodeU = s => s < S.node ? lerp(-0.08, 1.0, (s - S.back)/(S.node - S.back)) : 1.0 + 0.95*(s - S.node)/(S.mouth - S.node);
  const ring = a => [0, Math.cos(a), Math.sin(a)];          // radial direction; a = 0 is the top of the tube
  const cut = a => S.mouth - S.lipCut*Math.cos(a);          // the mouth is cut on a slant like a scoop: the lower lip reaches further
  const NS = 14, outer = [];
  for (let i=0;i<=NS;i++){
    const row = [];
    for (let k=0;k<=sides;k++){
      const a = k/sides*TAU, n = ring(a), s = lerp(S.back, cut(a), i/NS);
      row.push(M.vert([s, n[1]*S.R, n[2]*S.R], n, mOut, [k/sides, nodeU(s)], 1));
    }
    outer.push(row);
  }
  for (let i=0;i<NS;i++) for (let k=0;k<sides;k++) M.quadAuto(outer[i][k], outer[i][k+1], outer[i+1][k+1], outer[i+1][k]);
  // inner wall of the chamber, from its node to the mouth
  const inner = [];
  for (let i=0;i<=8;i++){
    const row = [];
    for (let k=0;k<=sides;k++){ const a = k/sides*TAU, n = ring(a), s = lerp(S.node, cut(a) - 0.002, i/8);
      row.push(M.vert([s, n[1]*S.r, n[2]*S.r], [0, -n[1], -n[2]], mIn, [k/sides, (s - S.node)/0.3], lerp(0.25, 0.8, i/8))); }
    inner.push(row);
  }
  for (let i=0;i<8;i++) for (let k=0;k<sides;k++) M.quadAuto(inner[i][k], inner[i][k+1], inner[i+1][k+1], inner[i+1][k]);
  // rim along the slanted cut
  const mRim = Object.assign({}, mOut, { x: 2 });
  for (let k=0;k<sides;k++){
    const q = [k, k+1].map(kk => { const a = kk/sides*TAU, n = ring(a), s = cut(a); return [[s, n[1]*S.R, n[2]*S.R], [s - 0.002, n[1]*S.r, n[2]*S.r]]; });
    const nr = v3.norm([1, S.lipCut/S.R, 0]);
    const a = M.vert(q[0][0], nr, mRim, [k/sides,0]), b = M.vert(q[1][0], nr, mRim, [(k+1)/sides,0]), c = M.vert(q[1][1], nr, mRim, [(k+1)/sides,1]), d = M.vert(q[0][1], nr, mRim, [k/sides,1]);
    M.quadAuto(a,b,c,d);
  }
  // chamber bottom (the node diaphragm) and the closed end
  const disc = (s, rad, n, m, ao) => { const c = M.vert([s,0,0], n, m, [0.5,0], ao);
    for (let k=0;k<sides;k++){ const a0 = k/sides*TAU, a1 = (k+1)/sides*TAU;
      M.triAuto(c, M.vert([s, Math.cos(a0)*rad, Math.sin(a0)*rad], n, m, [0.5+0.5*Math.cos(a0), 1], ao), M.vert([s, Math.cos(a1)*rad, Math.sin(a1)*rad], n, m, [0.5+0.5*Math.cos(a1), 1], ao)); } };
  disc(S.node, S.r, [1,0,0], mIn, 0.2);
  disc(S.back, S.R*0.999, [-1,0,0], Object.assign({}, mOut, { x: 1 }), 0.9);
  return M;
}
function tubeMatrix(th){
  // local (axis, up, axle) -> world: rotate by th about the axle, then place at the pivot
  const S = SHISHI, c = Math.cos(th), s = Math.sin(th);
  const X = [S.dir[0]*c, s, S.dir[2]*c], Y = [-S.dir[0]*s, c, -S.dir[2]*s], Z = S.side;
  return new Float32Array([X[0],X[1],X[2],0, Y[0],Y[1],Y[2],0, Z[0],Z[1],Z[2],0, S.pivot[0],S.pivot[1],S.pivot[2],1]);
}

/* ---- plants ---- */
// foliage vertex: pos, lighting normal, col = (rand1, rand2, flag, ao), uv (0..1 inside the atlas rect), attr = (species, wind, seed, 0)
const SPECIES = { FERN_A:0, FERN_B:1, MAPLE:2, BAMBOO:3, LEAF_RED:4, LEAF_PALE:5 };
function fvert(F, p, n, r1, r2, flag, ao, u, v, sp, wind, seed){ F.v.push(p[0],p[1],p[2], n[0],n[1],n[2], r1, r2, flag, ao, u, v, sp, wind, seed, 0); return F.count-1; }
function card(F, c, size, orient, lightN, species, wind, seed, ao, r1, r2, aspect=1){
  const t1 = rotAxis(perp(orient), orient, seed*TAU), t2 = v3.cross(orient, t1), hs = size/2, hv = size*aspect/2, base = F.count;
  for (const [u,v] of [[0,0],[1,0],[1,1],[0,1]]) fvert(F, v3.add(c, v3.add(v3.mul(t1,(u-0.5)*2*hs), v3.mul(t2,(v-0.5)*2*hv))), lightN, r1, r2, 0, ao, u, v, species, wind, seed);
  F.ix.push(base, base+1, base+2, base, base+2, base+3);
}
// fern: a rosette of arching fronds; each frond is a ribbon folded along its rachis, textured with a painted frond
function fern(F, x, z, size, seed){
  const r = mulberry(seed*97+5), g = terrainH(x, z) - 0.01;
  const n = 10 + Math.floor(r()*6);
  for (let i=0;i<n;i++){
    const az = i/n*TAU + r()*0.45, len = size*(0.62 + 0.5*r()), el0 = 0.95 + 0.45*r(), curl = 1.1 + 0.8*r();
    const sp = r() < 0.55 ? SPECIES.FERN_A : SPECIES.FERN_B, sd = r(), r1 = r(), r2 = r(), NS = 12, w = len*0.36;
    const hd = [Math.cos(az), 0, Math.sin(az)], side0 = [-hd[2], 0, hd[0]], roll = (r()-0.5)*0.5;
    let p = [x + hd[0]*0.02, g, z + hd[2]*0.02]; const rows = [];
    for (let k=0;k<=NS;k++){
      const t = k/NS, el = el0 - curl*Math.pow(t, 1.3);
      const d = v3.norm([hd[0]*Math.cos(el), Math.sin(el), hd[2]*Math.cos(el)]);
      const sideV = v3.norm(rotAxis(side0, d, roll*(0.3 + t)));
      const up = v3.norm(v3.cross(sideV, d));
      const hw = w*0.5*(k === 0 ? 0.15 : 1);
      const fold = hw*0.22;
      const nl = v3.norm(v3.add(up, [0, 0.8, 0]));
      const ao = clamp(0.45 + 0.6*t, 0.35, 1), wind = 0.15 + 0.85*t*t;
      rows.push([fvert(F, v3.madd(v3.madd(p, sideV, -hw), up, -fold), v3.norm(v3.add(nl, v3.mul(sideV, -0.35))), r1, r2, 0, ao, 0, t, sp, wind, sd),
                 fvert(F, p, nl, r1, r2, 0, ao, 0.5, t, sp, wind, sd),
                 fvert(F, v3.madd(v3.madd(p, sideV, hw), up, -fold), v3.norm(v3.add(nl, v3.mul(sideV, 0.35))), r1, r2, 0, ao, 1, t, sp, wind, sd)]);
      p = v3.madd(p, d, len/NS);
    }
    for (let k=0;k<NS;k++){ const a = rows[k], b = rows[k+1];
      F.ix.push(a[0], a[1], b[1], a[0], b[1], b[0], a[1], a[2], b[2], a[1], b[2], b[1]); }
  }
}
// tokusa (scouring rush): dense clumps of upright, jointed dark-green stems
function tokusa(M, x, z, R, H, seed){
  const r = mulberry(seed*131+9), n = Math.round(70*R/0.3);
  for (let i=0;i<n;i++){
    const a = r()*TAU, d = Math.sqrt(r())*R, bx = x + Math.cos(a)*d, bz = z + Math.sin(a)*d, g = terrainH(bx, bz);
    const h = H*(0.55 + 0.55*r()), lean = (0.02 + 0.07*r())*(d/R + 0.3), la = a + (r()-0.5)*0.8, rad = 0.0042 + 0.0022*r();
    const col = [0.035 + 0.02*r(), 0.07 + 0.03*r(), 0.035 + 0.01*r()];
    const m = mat(MAT.STEM, col, { seed: r(), wind: 0.25 });
    const pts = [], rr = [];
    for (let k=0;k<=4;k++){ const t = k/4; pts.push([bx + Math.cos(la)*lean*h*t*t, g - 0.02 + h*t, bz + Math.sin(la)*lean*h*t*t]); rr.push(rad*(1 - 0.35*t*t)); }
    tube(M, m, pts, rr, 5, { uvv: 1, ao: t => lerp(0.35, 1, Math.min(1, t*1.6)) });
  }
}
// small tufts of grass scattered through the moss
function grassTuft(M, x, z, s, seed){
  const r = mulberry(seed*57+1), n = 9 + Math.floor(r()*9), g = terrainH(x, z) - 0.005;
  for (let i=0;i<n;i++){
    const a = r()*TAU, lean = 0.2 + 0.7*r(), len = s*(0.55 + 0.6*r()), w = 0.004 + 0.004*r();
    const col = [0.03 + 0.03*r(), 0.06 + 0.04*r(), 0.02 + 0.012*r()];
    const m = mat(MAT.BLADE, col, { seed: r(), wind: 0.6 });
    const hd = [Math.cos(a), 0, Math.sin(a)], sideV = [-hd[2], 0, hd[0]];
    const base = [x + hd[0]*0.01*r(), g, z + hd[2]*0.01*r()], rows = [];
    for (let k=0;k<=3;k++){
      const t = k/3, el = Math.PI/2 - lean*t*1.2;
      const p = v3.add(base, [hd[0]*len*Math.sin(lean)*t*t*0.9, len*t*Math.cos(lean*t*0.8), hd[2]*len*Math.sin(lean)*t*t*0.9]);
      const nrm = v3.norm([hd[0]*Math.sin(el)*0.5 + 0.0, 0.6 + Math.cos(el), hd[2]*Math.sin(el)*0.5]);
      const ww = w*(1 - t*0.92), ao = lerp(0.35, 1, t);
      rows.push([M.vert(v3.madd(p, sideV, -ww), nrm, m, [0, t], ao), M.vert(v3.madd(p, sideV, ww), nrm, m, [1, t], ao)]);
    }
    for (let k=0;k<3;k++) M.quad(rows[k][0], rows[k][1], rows[k+1][1], rows[k+1][0]);
  }
}
function leafCluster(F, c, R, species, n, r, center, radii, wind=1){
  for (let i=0;i<n;i++){
    let d; do { d = [r()*2-1, r()*2-1, r()*2-1]; } while (v3.dot(d,d) > 1);
    const pos = v3.add(c, [d[0]*R, d[1]*R*0.55, d[2]*R]);
    const rel = v3.sub(pos, center), q = [rel[0]/radii[0], rel[1]/radii[1], rel[2]/radii[2]];
    const ql = Math.min(1.3, v3.len(q));
    const ln = v3.norm(v3.add(v3.norm([q[0]/radii[0], q[1]/radii[1], q[2]/radii[2]]), [0,0.45,0]));
    const orient = v3.norm([(r()-0.5)*1.3, 1, (r()-0.5)*1.3]);
    const ao = clamp(0.3 + 0.6*ql*ql + 0.15*q[1], 0.25, 1);
    card(F, pos, R*(0.62+0.3*r()), orient, ln, species, wind, r(), ao, r(), r());
  }
}
// irohamomiji in the front corner (behind the default view): its leaves are the ones that fall into the pond
function mapleTree(M, F){
  const T = MAPLE, r = mulberry(4455), g = terrainH(T.x, T.z);
  const center = [T.x - 0.6, g + T.h, T.z - 0.6], radii = [T.R, T.R*0.6, T.R];
  function grow(p0, d, len, rad, lvl){
    const pts = [p0], rads = [rad]; let p = p0, dd = d;
    for (let i=1;i<=4;i++){ dd = v3.norm(v3.add(dd, [(r()-0.5)*0.35, lvl < 2 ? 0.1 : -0.04, (r()-0.5)*0.35])); p = v3.madd(p, dd, len/4); pts.push(p); rads.push(rad*(1 - 0.5*i/4)); }
    tube(M, mat(MAT.BARK, [0.12,0.11,0.095], { wind: [0.02,0.18,0.45,0.85][lvl], seed: 0.5 }), pts, rads, [9,6,5,4][lvl], { uvv: 1.5 });
    if (lvl < 3){
      const nc = lvl === 0 ? 3 : 2 + (r() < 0.6 ? 1 : 0);
      for (let c=0;c<nc;c++){
        const at = lvl === 0 ? 0.75 + 0.25*c/(nc-1) : 0.45 + 0.55*(c+0.5)/nc;
        const sp = v3.lerp(pts[Math.floor(at*3.999)], pts[Math.floor(at*3.999)+1], fract(at*3.999));
        // lean the crown back over the yard (toward the pond)
        const out = v3.norm([sp[0]-T.x - 0.5 + (r()-0.5)*0.6, 0, sp[2]-T.z - 0.5 + (r()-0.5)*0.6]);
        let nd = rotAxis(dd, perp(dd), (0.45 + 0.35*r())*(r()<0.5?-1:1));
        nd = v3.norm(v3.add(v3.mul(nd, 0.6), v3.mul(out, lvl === 0 ? 0.55 : 0.8)));
        if (lvl >= 1) nd[1] = nd[1]*0.6 + 0.08;
        grow(sp, v3.norm(nd), len*(lvl===0 ? 0.78 : 0.7), rads[3]*0.95, lvl+1);
      }
      if (lvl === 2) leafCluster(F, pts[4], 0.42, SPECIES.MAPLE, 5, r, center, radii);
    } else {
      leafCluster(F, pts[4], 0.48, SPECIES.MAPLE, 9, r, center, radii);
      leafCluster(F, pts[2], 0.38, SPECIES.MAPLE, 5, r, center, radii);
    }
  }
  for (let k=0;k<2;k++){ const a = k*Math.PI + 2.2 + r(); grow([T.x + Math.cos(a)*0.1, g - 0.12, T.z + Math.sin(a)*0.1], v3.norm([Math.cos(a)*0.3 - 0.2, 1, Math.sin(a)*0.3 - 0.2]), 1.45, 0.085, 0); }
}
// madake grove behind the fence: tall culms with leafy tops, mostly seen when looking up
function bambooGrove(M, F){
  const r = mulberry(909); let n = 0;
  for (let k=0;k<420 && n<150;k++){
    const x = -16 + 32*r(), z = -14 + 30*r();
    const dx = Math.max(YARD.x0 - x, x - YARD.x1, 0), dz = Math.max(YARD.z0 - z, z - YARD.z1, 0), dist = Math.hypot(dx, dz);
    if (dist < 0.5 || dist > 9) continue;
    if (z > YARD.z1 && r() < 0.6) continue;
    n++;
    const g = GROUND - 0.05, h = 7.5 + 5*r(), rad = 0.045 + 0.035*r(), lean = [(r()-0.5)*0.12, 1, (r()-0.5)*0.12];
    const top = v3.add([x, g, z], v3.mul(v3.norm(lean), h));
    const col = [0.2 + 0.06*r(), 0.26 + 0.05*r(), 0.1 + 0.03*r()];
    culm(M, mat(MAT.BAMBOO, col, { seed: r(), wind: 0.0 }), [x, g-0.2, z], top, rad, rad*0.45, 8, { segs:4, internode:0.34, phase:r() });
    const center = v3.lerp([x, g, z], top, 0.8);
    for (let j=0;j<7;j++){
      const t = 0.55 + 0.45*r(), c = v3.add(v3.lerp([x, g, z], top, t), [(r()-0.5)*1.2, 0, (r()-0.5)*1.2]);
      leafCluster(F, c, 0.7 + 0.5*r(), SPECIES.BAMBOO, 4, r, center, [1.6, 2.6, 1.6], 1.2);
    }
  }
  return n;
}
// fallen leaves lying on the moss and stones
function groundLeaves(F){
  const r = mulberry(5151); let n = 0;
  for (let k=0;k<140 && n<46;k++){
    const x = -4.6 + 9.2*r(), z = -2.7 + 8.8*r();
    if (pondSD(x, z) < 0.05) continue;
    const near = Math.hypot(x - MAPLE.x, z - MAPLE.z) < 3.2 || Math.hypot(x - 1, z - 1.2) < 2.6;
    if (!near && r() < 0.75) continue;
    const g = terrainH(x, z) + 0.004, sp = r() < 0.7 ? SPECIES.LEAF_RED : SPECIES.LEAF_PALE;
    card(F, [x, g, z], 0.05 + 0.03*r(), v3.norm([(r()-0.5)*0.3, 1, (r()-0.5)*0.3]), [0,1,0], sp, 0, r(), 0.85, r(), r());
    n++;
  }
}
