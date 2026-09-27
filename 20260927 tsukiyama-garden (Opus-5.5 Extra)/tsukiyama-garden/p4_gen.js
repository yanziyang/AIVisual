/* ---------------- Procedural garden geometry ---------------- */
// Everything is generated at load from the layout above: no models or image files are downloaded.
const SEASON = { SPRING:1, SUMMER:2, AUTUMN:4, WINTER:8 };
const LAMPS = [];   // light sources that glow at dusk: [x, y, z, strength]
const smin = (a,b,k) => { const h = clamp(0.5+0.5*(b-a)/k, 0, 1); return lerp(b,a,h) - k*h*(1-h); };
const fract = x => x - Math.floor(x);
const waterDir = (x,z) => { const e=0.3; return v3.norm([-(waterSD(x+e,z)-waterSD(x-e,z)), 0, -(waterSD(x,z+e)-waterSD(x,z-e))]); }; // points toward the water

/* ---- terrain: fine inner grid plus a coarse outer ring of wooded slopes ---- */
function buildTerrain(M){
  const put = (x,y,z, n, col, ao, dd, moss) => { M.v.push(x,y,z, n[0],n[1],n[2], col[0],col[1],col[2], ao, dd, 0, MAT.TERRAIN, 0, moss, 0); return M.count-1; };
  const n = 257, x0 = -32, c = 0.25, H = new Float32Array(n*n);
  for (let j=0;j<n;j++) for (let i=0;i<n;i++) H[j*n+i] = terrainH(x0+i*c, x0+j*c);
  const hAt = (i,j) => (i>=0 && j>=0 && i<n && j<n) ? H[j*n+i] : terrainH(x0+i*c, x0+j*c);
  const base = M.count;
  for (let j=0;j<n;j++) for (let i=0;i<n;i++){
    const x = x0+i*c, z = x0+j*c, h = H[j*n+i];
    const nr = v3.norm([hAt(i-1,j)-hAt(i+1,j), 2*c, hAt(i,j-1)-hAt(i,j+1)]);
    let avg = 0; for (const [a,b] of [[8,0],[-8,0],[0,8],[0,-8],[6,6],[-6,6],[6,-6],[-6,-6]]) avg += hAt(i+a,j+b); avg /= 8;
    const ao = clamp(1 - Math.max(0, avg-h)*0.45, 0.55, 1);
    const dd = waterSD(x,z);
    const moss = clamp(0.25 + 0.9*smooth(5, -7, z + 5*(fbm2(x*0.1, z*0.1, 3, 61)-0.5)) + 0.5*smooth(1.0, 3.5, h), 0, 1);
    put(x, h, z, nr, [pathW(x,z), smooth(0.2, 0.7, gaussW(x,z,BEACH)), smooth(0.2, 0.7, gaussW(x,z,MARSH))], ao, dd, moss);
  }
  for (let j=0;j<n-1;j++) for (let i=0;i<n-1;i++){ const a = base+j*n+i; M.quad(a, a+n, a+n+1, a+1); }
  // outer ring (1.6 m cells), tucked 6 cm under the inner grid where they overlap so there are no cracks
  const m2 = 96, c2 = 1.6, o2 = -76.8, b2 = M.count;
  for (let j=0;j<=m2;j++) for (let i=0;i<=m2;i++){
    const x = o2+i*c2, z = o2+j*c2, inside = Math.abs(x) < 32.1 && Math.abs(z) < 32.1;
    const h = terrainH(x,z) - (inside ? 0.06 : 0);
    const e = 0.8, nr = v3.norm([terrainH(x-e,z)-terrainH(x+e,z), 2*e, terrainH(x,z-e)-terrainH(x,z+e)]);
    put(x, h, z, nr, [0,0,0], 0.9, 60, 0.85);
  }
  for (let j=0;j<m2;j++) for (let i=0;i<m2;i++){
    const x = o2+(i+0.5)*c2, z = o2+(j+0.5)*c2;
    if (Math.abs(x) < 30.4 && Math.abs(z) < 30.4) continue;
    const a = b2+j*(m2+1)+i; M.quad(a, a+m2+1, a+m2+2, a+1);
  }
}

/* ---- rocks: faceted icosphere cut by random planes, then noise ---- */
const ROCK_COLS = [[0.17,0.165,0.155],[0.085,0.088,0.092],[0.14,0.115,0.09],[0.105,0.115,0.125],[0.19,0.18,0.165],[0.12,0.105,0.09]];
function makeRock(M, S){
  const ico = ICO[S.sub ?? 2], r = mulberry(S.seed*7919+13), base = M.count;
  const planes = [], np = 6 + Math.floor(r()*5);
  for (let k=0;k<np;k++){ const a = r()*TAU, y = r()*1.3-0.45; planes.push({ n: v3.norm([Math.cos(a), y, Math.sin(a)]), d: 0.52 + 0.36*r() }); }
  const strat = v3.norm([r()-0.5, 2.5 + r(), r()-0.5]), sf = 9 + 8*r();
  if (S.flatTop) planes.push({ n:[0,1,0], d: S.flatTop });
  const off = [r()*100, r()*100, r()*100];
  const col = S.col || ROCK_COLS[Math.floor(r()*ROCK_COLS.length)];
  const tint = 0.85 + 0.3*r();
  const m = mat(MAT.ROCK, col, { seed: r() + (S.wet ? 2 : 0) });   // seed > 1.5 flags a wet (waterline) rock
  const rot = S.rot ?? r()*TAU, tilt = S.tilt ?? 0, ca = Math.cos(rot), sa = Math.sin(rot), ct = Math.cos(tilt), st = Math.sin(tilt);
  const y0 = S.y ?? terrainH(S.x, S.z), sink = S.sink ?? 0.35;
  const cy = y0 + S.sy - 2*S.sy*sink;
  const rr = [];
  for (const d of ico.P){
    let q = 1;
    for (const p of planes){ const c = v3.dot(d, p.n); if (c > 0.05) q = smin(q, p.d/c, 0.045); }
    const rid = 1 - Math.abs(2*fbm3(d[0]*2.2+off[1], d[1]*2.2+off[2], d[2]*2.2+off[0], 3) - 1);
    q *= 1 + 0.2*(fbm3(d[0]*1.5+off[0], d[1]*1.5+off[1], d[2]*1.5+off[2], 3)-0.5) + 0.07*(rid-0.5) + 0.05*(vnoise3(d[0]*6+off[0], d[1]*6, d[2]*6+off[2])-0.5)
      + 0.012*Math.sin(v3.dot(d, strat)*sf + off[0]);
    rr.push(q);
  }
  ico.P.forEach((d,i) => {
    let lx = d[0]*rr[i]*S.sx, ly = d[1]*rr[i]*S.sy, lz = d[2]*rr[i]*S.sz;
    const ty = ly*ct - lz*st, tz = ly*st + lz*ct; ly = ty; lz = tz;       // tilt about x
    const wx = lx*ca + lz*sa, wz = -lx*sa + lz*ca;                          // yaw
    const ao = clamp(0.5 + 0.5*smooth(-0.85, 0.35, d[1]), 0.35, 1) * clamp(0.75 + (rr[i]-0.75)*0.9, 0.6, 1);
    const v = 0.8 + 0.4*fbm3(d[0]*2.2+off[1], d[1]*2.2, d[2]*2.2+off[2], 2);
    M.vert([S.x+wx, cy+ly, S.z+wz], [0,1,0], m, [d[0]*S.sx+d[2]*S.sz, d[1]*S.sy], ao, [col[0]*tint*v, col[1]*tint*v, col[2]*tint*v]);
  });
  for (const [a,b,c] of ico.F) M.tri(base+a, base+b, base+c);
  M.smoothNormals(base);
  return { top: cy + S.sy*(S.flatTop ?? 1) };
}

// rocks set along the shore (gogan ishigumi), skipping the beach, marsh and built edges
function bankRocks(M){
  const r = mulberry(4242), rocks = [];
  const skip = (x,z) => gentleW(x,z) > 0.2 ||
    (Math.abs(x-PAV.x) < PAV.hx+0.6 && Math.abs(z-PAV.z) < PAV.hz+1.2) ||
    segDist(x, z, BRIDGE.a, BRIDGE.b) < 1.7 ||
    Math.hypot(x-FALL.base[0], z-FALL.base[2]) < 2.4 ||
    Math.hypot(x-STEPPING.a[0], z-STEPPING.a[1]) < 1.3 || Math.hypot(x-STEPPING.b[0], z-STEPPING.b[1]) < 1.1 ||
    Math.hypot(x-LANTERNS[0].x, z-LANTERNS[0].z) < 1.0;
  for (const poly of [POND_POLY, ISLE_MAIN.poly, ISLE_TURTLE.poly]){
    let acc = 0, next = 0.3;
    for (let i=0;i<poly.length;i++){
      const a = poly[i], b = poly[(i+1)%poly.length], L = Math.hypot(b[0]-a[0], b[1]-a[1]);
      for (let t=0; t<L; t+=0.1){
        acc += 0.1; if (acc < next) continue;
        acc = 0; next = 0.55 + r()*1.1;
        let x = a[0]+(b[0]-a[0])*t/L, z = a[1]+(b[1]-a[1])*t/L;
        if (skip(x,z)) continue;
        // slide along the water direction to the real waterline (h = 0.02)
        const w = waterDir(x,z); let lo = -1.6, hi = 1.6;
        for (let k=0;k<14;k++){ const m = (lo+hi)/2; if (terrainH(x+w[0]*m, z+w[2]*m) > 0.02) lo = m; else hi = m; }
        const o = lo + (r()-0.45)*0.35; x += w[0]*o; z += w[2]*o;
        const big = r() < 0.18, s = big ? 0.55+0.35*r() : 0.26+0.28*r();
        rocks.push({ x, z, y: -0.25 - 0.15*r(), sx: s*(0.9+0.5*r()), sy: s*(0.55+0.35*r()), sz: s*(0.8+0.4*r()), seed: 1000+rocks.length, sink: 0.12, sub: big ? 3 : 2, wet: 1 });
      }
    }
  }
  for (const S of rocks) makeRock(M, S);
  return rocks.length;
}

function featureRocks(M){
  const R = (x,z,sx,sy,sz,seed,o={}) => makeRock(M, Object.assign({ x, z, sx, sy, sz, seed, sub:3 }, o));
  const [lx,ly,lz] = FALL.lip, [bx,,bz] = FALL.base;
  // taki ishi-gumi: waterfall arrangement
  R(lx+0.05, lz-0.15, 0.55, 0.22, 0.5, 501, { y: ly-0.34, sink:0.1, flatTop:0.55, sub:3, tilt:-0.08, rot:0.2, wet:1 });   // mizuochi-ishi (lip stone)
  R(lx-1.05, lz+0.35, 0.62, 1.25, 0.7, 502, { y: 0.35, sink:0.28, sub:4, rot:0.4 });                           // waki-ishi, left
  R(lx+1.0,  lz+0.45, 0.66, 1.05, 0.62, 503, { y: 0.3, sink:0.28, sub:4, rot:1.9 });                           // waki-ishi, right
  R(lx-0.9,  lz-0.9, 0.75, 0.8, 0.7, 504, { sub:3, sink:0.35 });
  R(lx+1.1,  lz-0.8, 0.7, 0.7, 0.6, 505, { sub:3, sink:0.35 });
  R(lx-0.25, lz+0.62, 0.45, 0.62, 0.3, 506, { y:-0.1, sink:0.2, sub:3, wet:1 });                               // cliff face stones under the lip
  R(bx+0.55, bz-0.15, 0.36, 0.42, 0.22, 507, { y:-0.55, sink:0.08, tilt:-0.35, rot:0.5, wet:1 });              // rigyoseki: the carp stone
  R(bx-0.9,  bz+0.1, 0.5, 0.36, 0.45, 508, { y:-0.4, sink:0.1, wet:1 });
  R(bx+1.35, bz+0.35, 0.45, 0.3, 0.4, 509, { y:-0.4, sink:0.1, wet:1 });
  R(lx-0.3,  lz-1.9, 0.5, 0.4, 0.45, 510, { sink:0.45 });  R(lx+0.4, lz-2.4, 0.45, 0.35, 0.4, 511, { sink:0.45 });
  // sanzon-seki: a buddhist triad of standing stones on the main hill
  R(-7.2, -21.2, 0.7, 1.5, 0.6, 520, { sub:4, sink:0.25 }); R(-8.6, -20.6, 0.55, 0.9, 0.5, 521, { sink:0.3 }); R(-5.8, -20.4, 0.55, 0.75, 0.5, 522, { sink:0.3 });
  // tsuru-jima: crane rocks standing in the water
  R(16.6, -4.8, 0.55, 1.1, 0.45, 530, { y:-0.8, sink:0.25, sub:4, tilt:0.18, wet:1 });
  R(17.4, -4.1, 0.6, 0.55, 0.5, 531, { y:-0.8, sink:0.3, wet:1 }); R(15.8, -4.0, 0.45, 0.45, 0.4, 532, { y:-0.8, sink:0.35, wet:1 });
  // kame-jima: turtle island head and flippers
  R(-11.2, -3.2, 0.45, 0.35, 0.3, 540, { y:-0.3, sink:0.2, tilt:0.3, rot:-0.3, wet:1 });
  R(-13.8, -2.3, 0.5, 0.3, 0.45, 541, { sink:0.4 }); R(-14.3, -4.8, 0.45, 0.3, 0.4, 542, { sink:0.4 }); R(-12.2, -4.6, 0.4, 0.25, 0.35, 543, { sink:0.4 });
  // rocks around the hills and path
  const r = mulberry(606);
  for (let k=0;k<46;k++){
    const x = -30 + 60*r(), z = -30 + 50*r();
    const wsd = waterSD(x,z);
    if (wsd < 2.2 || pathW(x,z) > 0.05 || (Math.abs(x-PAV.x) < PAV.hx+1.5 && Math.abs(z-PAV.z) < PAV.hz+1.5)) continue;
    const s = 0.3 + 0.55*r()*r();
    R(x, z, s*(1+0.6*r()), s*(0.55+0.5*r()), s*(0.9+0.4*r()), 600+k, { sub: s > 0.5 ? 3 : 2, sink: 0.4 });
  }
  // stepping stones (sawatari)
  const St = STEPPING, perpv = v3.norm([-(St.b[1]-St.a[1]), 0, St.b[0]-St.a[0]]);
  for (let k=0;k<St.n;k++){
    const t = k/(St.n-1), zig = (k%2 ? 1 : -1)*0.28*(0.6+0.4*Math.sin(k*2.1));
    const x = lerp(St.a[0], St.b[0], t) + perpv[0]*zig, z = lerp(St.a[1], St.b[1], t) + perpv[2]*zig;
    const bed = terrainH(x,z), top = 0.1 + 0.05*Math.sin(k*1.7), sy = (top - bed + 0.12)/1.72;
    makeRock(M, { x, z, y: bed-0.12, sx: 0.46+0.08*Math.sin(k*3.1), sy, sz: 0.4+0.06*Math.cos(k*2.3), seed: 700+k, sink: 0, flatTop: 0.72, sub:3, col: ROCK_COLS[k%2 ? 0 : 4], wet:1 });
  }
}

/* ---- pavilion: tsuri-dono style, half over the water, hip-and-gable (irimoya) roof ---- */
function railing(M, m, pts, h=0.74, postW=0.085){
  // pts: 3D points along the base line; posts roughly every 0.9 m
  const L = []; let tot = 0; for (let i=1;i<pts.length;i++){ tot += v3.len(v3.sub(pts[i],pts[i-1])); }
  const at = s => { let a = s*tot; for (let i=1;i<pts.length;i++){ const l = v3.len(v3.sub(pts[i],pts[i-1])); if (a <= l || i===pts.length-1) return v3.lerp(pts[i-1], pts[i], clamp(a/l,0,1)); a -= l; } };
  const np = Math.max(1, Math.round(tot/0.9));
  for (let k=0;k<=np;k++){ const p = at(k/np); boxAxis(M, m, [p[0], p[1]+h/2, p[2]], [postW, h, postW], Math.atan2(pts[1][0]-pts[0][0], pts[1][2]-pts[0][2])); }
  const seg = Math.max(np*3, 6);
  for (const [dy, w, hh] of [[h-0.035, 0.1, 0.07], [h*0.55, 0.055, 0.06], [0.1, 0.06, 0.07]])
    for (let k=0;k<seg;k++){ const a = at(k/seg), b = at((k+1)/seg); beam(M, m, [a[0],a[1]+dy,a[2]], [b[0],b[1]+dy,b[2]], w, hh); }
}
function buildPavilion(M){
  const { x:cx, z:cz, floor:fy } = PAV;
  const mWood = mat(MAT.WOOD, [0.075,0.052,0.038]), mWoodL = mat(MAT.WOOD, [0.13,0.095,0.065], { seed:0.5 });
  const mFloor = mat(MAT.FLOOR, [0.16,0.118,0.08]), mTatami = mat(MAT.TATAMI, [0.30,0.27,0.15]);
  const mShoji = mat(MAT.SHOJI, [0.72,0.70,0.62]), mPlaster = mat(MAT.PLASTER, [0.56,0.54,0.49]);
  const mRoof = mat(MAT.ROOF, [0.05,0.053,0.058]), mSoffit = mat(MAT.SOFFIT, [0.19,0.14,0.095]), mStone = mat(MAT.STONE, [0.2,0.19,0.17], { seed:0.3 });
  const P = (x,y,z) => [cx+x, y, cz+z];
  const xs = [-3.0,-1.0,1.0,3.0], zs = [-2.2,0,2.2], top = fy + 2.55;
  for (const x of xs) for (const z of zs){
    const g = terrainH(cx+x, cz+z);
    const foot = g < 0.06 ? g - 0.04 : g - 0.06;
    lathe(M, mStone, P(x, foot, z), [[0.24,0],[0.25,0.1],[0.2,0.2],[0.14,0.24]], 9, false, x+z);
    boxAxis(M, mWood, P(x, (foot+0.22+top)/2, z), [0.19, top-foot-0.22, 0.19]);
  }
  // floor frame, deck and tatami
  for (const z of zs) beam(M, mWood, P(-3.25, fy-0.15, z), P(3.25, fy-0.15, z), 0.15, 0.2);
  for (const x of xs) beam(M, mWood, P(x, fy-0.3, -2.35), P(x, fy-0.3, 2.35), 0.14, 0.14);
  boxAxis(M, mFloor, P(0, fy-0.03, 0.05), [6.6, 0.07, 4.8]);
  boxAxis(M, mTatami, P(0, fy+0.025, -1.1), [5.8, 0.05, 2.0]);
  // nuki tie beams, nageshi and keta around the frame
  for (const y of [fy+2.08, top-0.1]){
    for (const z of zs) beam(M, mWood, P(-3.12, y, z), P(3.12, y, z), 0.13, y > fy+2.3 ? 0.22 : 0.15);
    for (const x of [xs[0], xs[3]]) beam(M, mWood, P(x, y, -2.32), P(x, y, 2.32), 0.13, y > fy+2.3 ? 0.22 : 0.15);
  }
  // rear (north) wall and west wall: plank dado, shoji, plaster transom
  const wall = (x0,z0,x1,z1) => {
    const dx = x1-x0, dz = z1-z0, L = Math.hypot(dx,dz), rot = Math.atan2(dz, dx);
    const c = (y,h,m,t) => boxAxis(M, m, P((x0+x1)/2, y, (z0+z1)/2), [L, h, t], -rot);
    c(fy+0.3, 0.55, mWoodL, 0.05); c(fy+1.315, 1.47, mShoji, 0.035); c(fy+2.33, 0.36, mPlaster, 0.06);
  };
  for (let i=0;i<3;i++) wall(xs[i]+0.1, -2.2, xs[i+1]-0.1, -2.2);
  wall(-3.0, -2.1, -3.0, -0.1);
  // railing along the water sides
  railing(M, mWoodL, [P(-3.25, fy, 2.38), P(3.25, fy, 2.38)]);
  railing(M, mWoodL, [P(3.28, fy, -0.1), P(3.28, fy, 2.38)]);
  railing(M, mWoodL, [P(-3.28, fy, 0.1), P(-3.28, fy, 2.38)]);
  // entry steps on the east side
  for (let k=0;k<2;k++){ const x = 3.75 + k*0.45, g = terrainH(cx+x, cz-1.2);
    makeRock(M, { x: cx+x, z: cz-1.2, y: g-0.1, sx:0.34, sy: Math.max(0.12, (fy-0.18*(k+1) - g + 0.1)/1.6), sz:0.55, seed: 800+k, sink:0, flatTop:0.78, sub:3, col:[0.2,0.19,0.17], rot:0 }); }
  // interior lamp (andon) and a low table
  boxAxis(M, mWood, P(-1.8, fy+0.18, -1.3), [0.9, 0.05, 0.6]);
  lathe(M, mat(MAT.SHOJI, [0.8,0.75,0.62], { seed:2 }), P(1.9, fy+0.05, -1.6), [[0.13,0],[0.13,0.55]], 4, true, 0.785);
  LAMPS.push([cx+1.9, fy+0.45, cz-1.6, 2.5], [cx-1.0, fy+1.6, cz-1.8, 2.0]);
  buildIrimoya(M, cx, cz, { ex:4.35, ez:3.55, gx:2.55, yE: top-0.12, H:2.45, th:0.17 }, mRoof, mSoffit, mWood, mPlaster);
}
function buildIrimoya(M, cx, cz, R, mRoof, mSoffit, mWood, mGable){
  const { ex, ez, gx, yE, H, th } = R, hipW = ex-gx;
  const prof = u => 0.55*u + 0.45*u*u;
  const hR = (x,z) => { const dx = ex-Math.abs(x), dz = ez-Math.abs(z); const d = Math.abs(x) > gx ? Math.min(dz, dx) : dz;
    return yE + H*prof(clamp(d/ez, 0, 1)) + 0.32*Math.exp(-(Math.max(dx,0)+Math.max(dz,0))/0.85); };
  const dzOf = v => { const j = v*14; return j <= 6 ? (j/6)*hipW : hipW + ((j-6)/8)*(ez-hipW); };
  for (const [sgn, under] of [[1,0],[-1,0],[1,1],[-1,1]]){
    const off = under ? -th : 0, m = under ? mSoffit : mRoof;
    // long slopes
    surface(M, m, 26, 14, (u,v) => { const dz = dzOf(v), xh = dz <= hipW ? ex-dz : gx, x = (2*u-1)*xh, z = sgn*(ez-dz);
      return { p:[cx+x, hR(x,z)+off, cz+z], uv:[x, dz*1.22] }; }, (sgn < 0) !== !!under);
    // hip ends
    surface(M, m, 16, 6, (u,w) => { const dx = w*hipW, zh = ez-dx, z = (2*u-1)*zh, x = sgn*(ex-dx);
      return { p:[cx+x, hR(x,z)+off, cz+z], uv:[z, dx*1.22] }; }, (sgn > 0) !== !!under);
  }
  // fascia around the eaves
  const edge = [];
  for (let i=0;i<=24;i++){ const x = -ex + 2*ex*i/24; edge.push([x, ez, [0,0,1]]); }
  for (let i=0;i<=16;i++){ const z = ez - 2*ez*i/16; edge.push([ex, z, [1,0,0]]); }
  for (let i=0;i<=24;i++){ const x = ex - 2*ex*i/24; edge.push([x, -ez, [0,0,-1]]); }
  for (let i=0;i<=16;i++){ const z = -ez + 2*ez*i/16; edge.push([-ex, z, [-1,0,0]]); }
  for (let i=0;i<edge.length-1;i++){
    const [x0,z0,n0] = edge[i], [x1,z1,n1] = edge[i+1]; if (x0===x1 && z0===z1) continue;
    const a = M.vert([cx+x0, hR(x0,z0), cz+z0], n0, mWood, [i*0.3,0]), b = M.vert([cx+x1, hR(x1,z1), cz+z1], n1, mWood, [(i+1)*0.3,0]);
    const c = M.vert([cx+x1, hR(x1,z1)-th, cz+z1], n1, mWood, [(i+1)*0.3,1]), d = M.vert([cx+x0, hR(x0,z0)-th, cz+z0], n0, mWood, [i*0.3,1]);
    M.quadAuto(a,b,c,d);
  }
  // gable faces set back under the roof, with the hip-top ledge in front
  const xg = gx - 0.3, zg = ez - hipW, yG = yE + H*prof(hipW/ez);
  for (const sgn of [1,-1]){
    const nrm = [sgn,0,0], k0 = [];
    for (let i=0;i<=16;i++){ const z = -zg + 2*zg*i/16, yt = hR(gx*0.999, z) - th - 0.02;
      k0.push([M.vert([cx+sgn*xg, yG, cz+z], nrm, mGable, [z, 0]), M.vert([cx+sgn*xg, yt, cz+z], nrm, mGable, [z, yt-yG])]); }
    for (let i=0;i<16;i++) M.quadAuto(k0[i][0], k0[i+1][0], k0[i+1][1], k0[i][1]);
    // ledge
    const up = [0,1,0], a = M.vert([cx+sgn*xg, yG, cz-zg], up, mRoof, [0,0]), b = M.vert([cx+sgn*gx, yG, cz-zg], up, mRoof, [0.3,0]);
    const c = M.vert([cx+sgn*gx, yG, cz+zg], up, mRoof, [0.3,2*zg]), d = M.vert([cx+sgn*xg, yG, cz+zg], up, mRoof, [0,2*zg]);
    M.quadAuto(a,b,c,d);
    // battens on the gable
    for (let i=-2;i<=2;i++){ const z = i*zg/3, yt = hR(gx*0.999, z) - th - 0.02; if (yt - yG < 0.15) continue;
      beam(M, mWood, [cx+sgn*(xg+0.03), yG, cz+z], [cx+sgn*(xg+0.03), yt, cz+z], 0.06, 0.08, [1,0,0]); }
    beam(M, mWood, [cx+sgn*(xg+0.03), yG+0.05, cz-zg], [cx+sgn*(xg+0.03), yG+0.05, cz+zg], 0.08, 0.1);
    // barge boards (hafu) under the gable edge of the roof
    const hb = [];
    for (let i=0;i<=18;i++){ const z = -zg + 2*zg*i/18, yt = hR(gx*0.999, z) - th*0.4;
      hb.push([M.vert([cx+sgn*(gx+0.01), yt, cz+z], nrm, mWood, [z,0]), M.vert([cx+sgn*(gx+0.01), yt-0.3, cz+z], nrm, mWood, [z,0.3])]); }
    for (let i=0;i<18;i++) M.quadAuto(hb[i][0], hb[i+1][0], hb[i+1][1], hb[i][1]);
    // ridge tiles along the gable edge and down the hips
    const gp = [], gr = [];
    for (let i=0;i<=16;i++){ const z = -zg + 2*zg*i/16; gp.push([cx+sgn*(gx-0.08), hR(gx-0.08, z)+0.06, cz+z]); gr.push(0.075); }
    tube(M, mRoof, gp, gr, 6);
    for (const zs of [1,-1]){
      const hp = [], hr = [];
      for (let i=0;i<=10;i++){ const t = hipW*(1-i/10), x = sgn*(ex-t), z = zs*(ez-t); hp.push([cx+x, hR(x,z)+0.07, cz+z]); hr.push(0.085); }
      tube(M, mRoof, hp, hr, 6);
    }
  }
  // main ridge and onigawara end tiles
  const yr = hR(0,0);
  obox(M, mRoof, [cx, yr+0.13, cz], [1,0,0], [0,1,0], [0,0,1], gx+0.05, 0.17, 0.17);
  obox(M, mRoof, [cx, yr+0.33, cz], [1,0,0], [0,1,0], [0,0,1], gx-0.1, 0.05, 0.1);
  for (const sgn of [1,-1]) obox(M, mRoof, [cx+sgn*(gx+0.1), yr+0.3, cz], [1,0,0], [0,1,0], [0,0,1], 0.09, 0.34, 0.26);
}

/* ---- taiko-bashi: arched bridge with vermilion railings ---- */
function buildBridge(M){
  const { a, b, w, rise } = BRIDGE;
  const mDeck = mat(MAT.FLOOR, [0.15,0.12,0.09], { seed:0.2 }), mRed = mat(MAT.LACQUER, [0.52,0.055,0.02]), mBronze = mat(MAT.BRONZE, [0.16,0.2,0.12]);
  const ya = terrainH(a[0],a[1]) + 0.12, yb = terrainH(b[0],b[1]) + 0.12;
  const d = v3.norm([b[0]-a[0], 0, b[1]-a[1]]), sd = [-d[2], 0, d[0]], L = Math.hypot(b[0]-a[0], b[1]-a[1]);
  const deckY = s => lerp(ya, yb, s) + rise*Math.pow(Math.sin(Math.PI*s), 0.85);
  const at = (s, o, dy=0) => [a[0] + d[0]*L*s + sd[0]*o, deckY(s)+dy, a[1] + d[2]*L*s + sd[2]*o];
  // deck top, underside and side girders
  surface(M, mDeck, 6, 40, (u,v) => ({ p: at(v, (u-0.5)*w), uv: [(u-0.5)*w, v*L] }), false);
  surface(M, mat(MAT.WOOD, [0.09,0.06,0.045]), 6, 40, (u,v) => ({ p: at(v, (u-0.5)*w, -0.12), uv: [u,v] }), true);
  for (const sgn of [1,-1]){
    surface(M, mRed, 1, 40, (u,v) => ({ p: at(v, sgn*w/2, -0.32*u), uv:[u, v*L] }), sgn < 0);
    surface(M, mRed, 1, 40, (u,v) => ({ p: at(v, sgn*(w/2-0.1), -0.32*u), uv:[u, v*L] }), sgn > 0);
    surface(M, mRed, 1, 40, (u,v) => ({ p: at(v, sgn*(w/2 - 0.1*u), -0.32), uv:[u, v*L] }), sgn < 0);
    // railing: posts, kasagi top rail, hira-geta mid rail
    const np = 9;
    for (let k=0;k<=np;k++){ const s = k/np, p = at(s, sgn*(w/2-0.05));
      boxAxis(M, mRed, [p[0], p[1]+0.43, p[2]], [0.11, 0.86, 0.11], Math.atan2(d[0], d[2]));
      if (k===0 || k===np) lathe(M, mBronze, [p[0], p[1]+0.86, p[2]], [[0.075,0],[0.085,0.05],[0.07,0.08],[0.11,0.16],[0.08,0.24],[0.02,0.3],[0,0.33]], 12); }
    for (const [dy, ww, hh] of [[0.8, 0.13, 0.08], [0.48, 0.07, 0.07], [0.14, 0.07, 0.07]]){
      const pts = []; for (let k=0;k<=30;k++) pts.push(at(k/30, sgn*(w/2-0.05), dy));
      for (let k=0;k<30;k++) beam(M, mRed, pts[k], pts[k+1], ww, hh);
    }
  }
  // piers standing in the pond, with tie beams
  for (const s of [0.28, 0.5, 0.72]){
    const pl = at(s, -w/2+0.12, -0.3), pr = at(s, w/2-0.12, -0.3);
    for (const p of [pl, pr]){ const g = terrainH(p[0], p[2]); boxAxis(M, mRed, [p[0], (p[1]+g)/2, p[2]], [0.16, p[1]-g, 0.16], Math.atan2(d[0], d[2])); }
    beam(M, mRed, pl, pr, 0.14, 0.18); beam(M, mRed, [pl[0], 0.3, pl[2]], [pr[0], 0.3, pr[2]], 0.12, 0.14);
  }
  // abutment slabs
  for (const s of [-0.03, 1.03]){ const p = at(s, 0), g = terrainH(p[0], p[2]);
    makeRock(M, { x:p[0], z:p[2], y:g-0.1, sx:1.25, sy:0.12, sz:0.7, rot: Math.atan2(d[0], d[2]) + Math.PI/2, seed: 900 + (s>0.5?1:0), sink:0, flatTop:0.85, sub:3, col:[0.2,0.19,0.18] }); }
}

/* ---- stone lanterns (tōrō) ---- */
function firebox(M, c, r, h, rot){
  // hexagonal fire chamber: window material with per-face uv so the shader can cut the openings
  const m = mat(MAT.WINDOW, [0.22,0.21,0.19]);
  for (let s=0;s<6;s++){
    const a0 = rot + s/6*TAU, a1 = rot + (s+1)/6*TAU, am = (a0+a1)/2, n = [Math.cos(am),0,Math.sin(am)];
    const p = (a,y) => [c[0]+Math.cos(a)*r, c[1]+y, c[2]+Math.sin(a)*r];
    const q = [M.vert(p(a0,0), n, m, [s,0]), M.vert(p(a1,0), n, m, [s+1,0]), M.vert(p(a1,h), n, m, [s+1,1]), M.vert(p(a0,h), n, m, [s,1])];
    M.quadAuto(q[0],q[1],q[2],q[3]);
  }
  // glowing core (seen through the openings)
  lathe(M, mat(MAT.WINDOW, [0.2,0.2,0.2], { seed:2 }), [c[0], c[1]+h*0.15, c[2]], [[r*0.55,0],[r*0.55,h*0.7]], 6, true, rot);
}
function buildLantern(M, Ln){
  const { x, z, rot, s } = Ln, g = terrainH(x,z);
  const st = mat(MAT.STONE, [0.21,0.2,0.185], { seed: fract(x*0.37) });
  const L = (y, prof, sides=6, flat=true, m=st) => lathe(M, m, [x, y, z], prof.map(([r,h])=>[r*s,h*s]), sides, flat, rot);
  const hoju = y => L(y, [[0.08,0],[0.1,0.035],[0.075,0.07],[0.06,0.085],[0.095,0.13],[0.075,0.19],[0.03,0.235],[0,0.255]], 12, false);
  if (Ln.type === 'kasuga'){
    let y = g - 0.06;
    L(y, [[0.36,0],[0.36,0.13],[0.3,0.17],[0.22,0.22]]); y += 0.22*s;
    L(y, [[0.105,0],[0.1,0.36],[0.125,0.38],[0.125,0.45],[0.1,0.47],[0.095,0.85]], 14, false); y += 0.85*s;
    L(y, [[0.13,0],[0.3,0.12],[0.3,0.18]]); y += 0.18*s;
    firebox(M, [x,y,z], 0.2*s, 0.3*s, rot); LAMPS.push([x, y+0.15*s, z, 1.2*s]); y += 0.3*s;
    L(y, [[0.24,0],[0.45,0.04],[0.45,0.08],[0.3,0.17],[0.12,0.27],[0.1,0.29]]);
    for (let k=0;k<6;k++){ const a = rot + k/6*TAU; boxAxis(M, st, [x+Math.cos(a)*0.44*s, y+0.1*s, z+Math.sin(a)*0.44*s], [0.07*s, 0.08*s, 0.07*s], -a); }
    y += 0.29*s; hoju(y);
  } else {
    // yukimi-dōrō: legs, round platform, fire box, broad umbrella cap. 'kotoji' has two legs of unequal length, one standing in the water.
    const wd = waterDir(x,z), sd = [-wd[2],0,wd[0]];
    const top = Math.max(g, 0.05) + (Ln.type==='kotoji' ? 0.78 : 0.52)*s;
    const feet = Ln.type === 'kotoji'
      ? [[x+wd[0]*0.6*s, z+wd[2]*0.6*s], [x-wd[0]*0.42*s+sd[0]*0.12, z-wd[2]*0.42*s+sd[2]*0.12]]
      : [0,1,2].map(k => { const a = rot + k/3*TAU; return [x+Math.cos(a)*0.4*s, z+Math.sin(a)*0.4*s]; });
    feet.forEach(([fx,fz], k) => {
      let gy = terrainH(fx,fz);
      if (Ln.type === 'kotoji' && k === 1){ const rk = makeRock(M, { x:fx, z:fz, sx:0.34, sy:0.2, sz:0.3, seed:950, sink:0.3, flatTop:0.7, sub:3 }); gy = rk.top; }
      const ang = Math.atan2(fz-z, fx-x), tp = [x+Math.cos(ang)*0.14*s, top, z+Math.sin(ang)*0.14*s];
      const bot = [fx, gy-0.05, fz], mid = v3.add(v3.lerp(bot, tp, 0.5), [Math.cos(ang)*0.1*s, 0, Math.sin(ang)*0.1*s]);
      const pts = [], rr = []; for (let i=0;i<=8;i++){ const t=i/8; pts.push(v3.add(v3.mul(bot,(1-t)*(1-t)), v3.add(v3.mul(mid,2*t*(1-t)), v3.mul(tp,t*t)))); rr.push((0.075-0.02*t)*s); }
      tube(M, st, pts, rr, 7);
    });
    let y = top;
    L(y, [[0.3,0],[0.32,0.05],[0.3,0.09]], 16, false); y += 0.09*s;
    firebox(M, [x,y,z], 0.2*s, 0.24*s, rot); LAMPS.push([x, y+0.12*s, z, 1.2*s]); y += 0.24*s;
    L(y, [[0.22,0],[0.8,0.03],[0.82,0.07],[0.62,0.13],[0.32,0.24],[0.14,0.3],[0.12,0.33]], 20, false); y += 0.33*s;
    hoju(y);
  }
}

/* ---- trees: bark tubes into the static mesh, leaf cards into the foliage mesh ---- */
// foliage vertex: pos, lighting normal, col = (rand1, rand2, flower, ao), uv (card), attr = (species, wind, seed, 0)
const SPECIES = { PINE:0, MAPLE:1, SAKURA:2, BROAD:3, AZALEA:4, CEDAR:5 };
function card(F, c, size, orient, lightN, species, wind, seed, ao, r1, r2, aspect=1){
  const t1 = rotAxis(perp(orient), orient, seed*TAU), t2 = v3.cross(orient, t1);
  const hs = size/2, hv = size*aspect/2;
  const base = F.count;
  for (const [u,v] of [[0,0],[1,0],[1,1],[0,1]]){
    const p = v3.add(c, v3.add(v3.mul(t1,(u-0.5)*2*hs), v3.mul(t2,(v-0.5)*2*hv)));
    F.v.push(p[0],p[1],p[2], lightN[0],lightN[1],lightN[2], r1, r2, 0, ao, u, v, species, wind, seed, 0);
  }
  F.ix.push(base, base+1, base+2, base, base+2, base+3);
}
function coreBlob(M, c, rx, ry, rz, col, wind, seed){
  const ico = ICO[2], base = M.count, m = mat(MAT.PLAIN, col, { wind, seed, x:0 });
  for (const d of ico.P){ const k = 0.85 + 0.3*vnoise3(d[0]*2+seed*10, d[1]*2, d[2]*2);
    M.vert([c[0]+d[0]*rx*k, c[1]+d[1]*ry*k, c[2]+d[2]*rz*k], d, m, [0,0], 0.35 + 0.4*(d[1]*0.5+0.5)); }
  for (const [a,b,cc] of ico.F) M.tri(base+a, base+b, base+cc);
  M.smoothNormals(base);
}
function pinePad(M, F, c, R, th, r, species=SPECIES.PINE){
  coreBlob(M, [c[0], c[1]-th*0.02, c[2]], R*0.58, th*0.34, R*0.58, [0.016,0.03,0.012], 0.35, r());
  const n = Math.round(40*(R/0.8)**2) + 10;
  for (let i=0;i<n;i++){
    let d; do { d = [r()*2-1, r()*2-1, r()*2-1]; } while (v3.dot(d,d) > 1);
    const k = Math.pow(v3.len(d), 0.5), dn = v3.norm(d);
    const lp = [dn[0]*R*k, (dn[1]*0.5+0.12)*th*k, dn[2]*R*k];
    const pos = v3.add(c, lp);
    const ln = v3.norm(v3.add(v3.norm([lp[0]/(R*R), lp[1]/(th*th*0.25), lp[2]/(R*R)]), [0,0.6,0]));
    const orient = v3.norm([ (r()-0.5)*0.9, 1, (r()-0.5)*0.9 ]);
    const ao = clamp(0.42 + 0.45*(dn[1]*0.5+0.5)*k + 0.2*k, 0.3, 1);
    card(F, pos, (0.36+0.18*r())*Math.max(0.8, R/0.9), orient, ln, species, 0.7, r(), ao, r(), r());
  }
}
function pineTree(M, F, T){
  const r = mulberry(T.seed*101+7), s = T.s, g = terrainH(T.x, T.z);
  const lv = waterDir(T.x, T.z), la = T.lean[1];   // pines lean out over the water
  const mB = mat(MAT.BARK, [0.1,0.068,0.052], { wind:0.02, seed:0.1 });
  const pts = [], rad = [], nseg = 10, Ht = 4.4*s; let p = [T.x, g-0.25, T.z];
  for (let i=0;i<=nseg;i++){
    const t = i/nseg; pts.push(p); rad.push(lerp(0.2, 0.06, Math.pow(t,0.8))*s*(i===0 ? 1.3 : 1));
    const bend = la*(1.5 - 1.3*t);
    const d = v3.norm([lv[0]*bend + 0.16*Math.sin(i*1.3+T.seed), 1, lv[2]*bend + 0.16*Math.cos(i*1.7+T.seed)]);
    p = v3.madd(p, d, Ht/nseg);
  }
  tube(M, mB, pts, rad, 10, { ao: t => 0.65 + 0.35*t, uvv: 1.2 });
  const trunkAt = t => { const f = t*nseg, i = Math.min(nseg-1, Math.floor(f)); return v3.lerp(pts[i], pts[i+1], f-i); };
  const nb = 6 + Math.floor(r()*3);
  for (let k=0;k<nb;k++){
    const t = 0.36 + 0.56*k/(nb-1) + (r()-0.5)*0.05, st = trunkAt(t);
    const az = k*2.39996 + r()*0.7, hd = v3.norm([Math.cos(az) + lv[0]*0.7, 0, Math.sin(az) + lv[2]*0.7]);
    const len = (0.9 + 1.4*(1-t))*s*(0.8+0.4*r());
    const bp = [], br = [];
    for (let i=0;i<=4;i++){ const q = i/4; bp.push(v3.add(v3.madd(st, hd, len*q), [0, len*(0.22*q*q - 0.12*Math.sin(Math.PI*q)), 0])); br.push(lerp(0.06*(1.1-t), 0.022, q)*s); }
    tube(M, mat(MAT.BARK, [0.1,0.068,0.052], { wind:0.25, seed:0.1 }), bp, br, 6);
    const R = (0.55 + 0.55*(1-t))*s*(0.85+0.3*r());
    pinePad(M, F, v3.add(bp[4], [0, 0.12*s, 0]), R, 0.34*s, r);
    if (len > 1.3*s) pinePad(M, F, v3.add(bp[2], [0, 0.18*s, 0]), R*0.6, 0.26*s, r);
  }
  pinePad(M, F, v3.add(pts[nseg], [0, 0.1*s, 0]), 0.75*s, 0.4*s, r);
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
function broadTree(M, F, T, kind){
  // maple (irohamomiji) and cherry (sakura): recursive branching into a spreading dome
  const r = mulberry(T.seed*131+3), s = T.s, g = terrainH(T.x, T.z);
  const sak = kind === 'sakura', species = sak ? SPECIES.SAKURA : SPECIES.MAPLE;
  const barkCol = sak ? [0.06,0.045,0.042] : [0.12,0.11,0.095];
  const crownH = (sak ? 3.4 : 3.1)*s, crownR = (sak ? 3.6 : 2.9)*s;
  const center = [T.x, g + crownH, T.z], radii = [crownR, crownR*0.62, crownR];
  const leafR = (sak ? 0.62 : 0.5)*s;
  function grow(p0, d, len, rad, lvl){
    const pts = [p0], rads = [rad]; let p = p0, dd = d;
    for (let i=1;i<=4;i++){
      dd = v3.norm(v3.add(dd, [(r()-0.5)*0.35, lvl < 2 ? 0.1 : (sak ? -0.12 : -0.04), (r()-0.5)*0.35]));
      p = v3.madd(p, dd, len/4); pts.push(p); rads.push(rad*(1 - 0.5*i/4));
    }
    tube(M, mat(MAT.BARK, barkCol, { wind: [0.02,0.18,0.45,0.85][lvl], seed: sak ? 0.8 : 0.5 }), pts, rads, [9,6,5,4][lvl], { uvv: 1.5 });
    if (lvl < 3){
      const nc = lvl === 0 ? 3 : 2 + (r() < 0.6 ? 1 : 0);
      for (let c=0;c<nc;c++){
        const at = lvl === 0 ? 0.75 + 0.25*c/(nc-1) : 0.45 + 0.55*(c+0.5)/nc;
        const sp = v3.lerp(pts[Math.floor(at*3.999)], pts[Math.floor(at*3.999)+1], fract(at*3.999));
        const out = v3.norm([sp[0]-T.x + (r()-0.5)*0.6, 0, sp[2]-T.z + (r()-0.5)*0.6]);
        let nd = rotAxis(dd, perp(dd), (0.45 + 0.35*r())*(r()<0.5?-1:1));
        nd = v3.norm(v3.add(v3.mul(nd, 0.6), v3.mul(out, lvl === 0 ? 0.55 : 0.8)));
        if (lvl >= 1) nd[1] = sak ? nd[1]*0.4 : nd[1]*0.6 + 0.08;
        grow(sp, v3.norm(nd), len*(lvl===0 ? 0.78 : 0.7), rads[3]*0.95, lvl+1);
      }
      if (lvl === 2) leafCluster(F, pts[4], leafR*0.9, species, 5, r, center, radii);
    } else {
      leafCluster(F, pts[4], leafR, species, sak ? 11 : 9, r, center, radii);
      leafCluster(F, pts[2], leafR*0.8, species, 5, r, center, radii);
    }
  }
  const ntr = sak ? 1 : 2 + (r() < 0.5 ? 1 : 0);
  for (let k=0;k<ntr;k++){
    const a = k/ntr*TAU + r(), off = ntr > 1 ? 0.12*s : 0;
    const d = v3.norm([Math.cos(a)*(ntr > 1 ? 0.35 : 0.1), 1, Math.sin(a)*(ntr > 1 ? 0.35 : 0.1)]);
    grow([T.x+Math.cos(a)*off, g-0.15, T.z+Math.sin(a)*off], d, (sak ? 2.0 : 1.55)*s, (sak ? 0.2 : 0.1)*s, 0);
  }
}
function cedarTree(M, F, x, z, s, r){
  const g = terrainH(x,z), Ht = (9 + 4*r())*s;
  tube(M, mat(MAT.BARK, [0.1,0.06,0.042], { wind:0.05, seed:0.3 }), [[x,g-0.3,z],[x,g+Ht*0.5,z],[x,g+Ht,z]], [0.3*s,0.18*s,0.04*s], 8);
  const y0 = g + 2.2*s, R0 = 2.1*s;
  lathe(M, mat(MAT.PLAIN, [0.01,0.022,0.012], { wind:0.2, seed:r() }), [x,y0,z], [[R0*0.72,0],[R0*0.55,(Ht-2.2*s)*0.35],[R0*0.3,(Ht-2.2*s)*0.7],[0.05,Ht-2.2*s]], 10);
  // irregular tiers of drooping sprays; some tiers thin out, the crown tapers to a narrow spire
  const tiers = 15;
  for (let k=0;k<tiers;k++){
    const t = k/(tiers-1), y = y0 + (Ht-2.2*s)*t*0.97, R = R0*Math.pow(1-t*0.95, 0.85)*(0.72 + 0.5*r()) + 0.15;
    const m = Math.max(2, Math.round((9*(R/R0)+2)*(0.6 + 0.6*r())));
    for (let j=0;j<m;j++){
      const a = j/m*TAU + k*0.7 + r()*0.8, out = [Math.cos(a), 0, Math.sin(a)], rr = R*(0.55 + 0.45*r());
      const pos = [x+out[0]*rr, y - rr*0.18 + (r()-0.5)*0.35, z+out[2]*rr];
      const ln = v3.norm([out[0], 0.5, out[2]]);
      card(F, pos, 1.2*s*(0.75+0.5*r())*Math.max(0.5, R/R0), v3.norm([out[0]*(0.6 + 0.6*r()), 1, out[2]*(0.6 + 0.6*r())]), ln, SPECIES.CEDAR, 0.35, r(), 0.45 + 0.5*(1-t*0.3)*(0.6+0.4*r())*(rr/R), r(), r());
    }
  }
}
function broadleafEvergreen(M, F, x, z, s, r){
  // kashi / shii: a short trunk forking into limbs, crowned by an irregular dome of foliage clumps
  const g = terrainH(x,z), top = g + (2.2 + 0.8*r())*s;
  const mB = mat(MAT.BARK, [0.085,0.075,0.065], { wind:0.05, seed:0.6 });
  tube(M, mB, [[x,g-0.3,z],[x+0.1*s,g+1.2*s,z],[x+0.15*s,top,z+0.1*s]], [0.26*s,0.2*s,0.14*s], 8);
  const tint = 0.8 + 0.4*r(), H = (3.6 + 1.6*r())*s, Rw = (2.6 + 1.0*r())*s;
  const nclump = 7 + Math.floor(r()*4);
  for (let k=0;k<nclump;k++){
    const a = r()*TAU, el = k === 0 ? 1.4 : r()*1.1;   // spread over a dome
    const c = [x + Math.cos(a)*Math.cos(el)*Rw*0.62, top + 0.4*s + Math.sin(el)*H*0.6 + (k === 0 ? H*0.25 : 0), z + Math.sin(a)*Math.cos(el)*Rw*0.62];
    const R = (1.1 + 0.7*r())*s;
    tube(M, mB, [[x+0.15*s,top-0.3,z+0.1*s], v3.lerp([x,top,z], c, 0.75)], [0.09*s, 0.04*s], 5);
    coreBlob(M, c, R*0.62, R*0.5, R*0.62, [0.014*tint,0.026*tint,0.011*tint], 0.15, r());
    const n = Math.round(34*(R/(1.4*s))**2) + 14;
    for (let i=0;i<n;i++){
      let d; do { d = [r()*2-1, r()*2-1, r()*2-1]; } while (v3.dot(d,d) > 1 || v3.dot(d,d) < 0.2);
      const dn = v3.norm(d), pos = v3.add(c, [dn[0]*R*0.82, dn[1]*R*0.66, dn[2]*R*0.82]);
      const outw = v3.norm(v3.sub(pos, [x, top, z]));
      const ln = v3.norm(v3.add(v3.add(dn, outw), [0,0.3,0]));
      card(F, pos, (0.8 + 0.5*r())*s, v3.norm([(r()-0.5)*1.6, 1, (r()-0.5)*1.6]), ln, SPECIES.BROAD, 0.3, r(), clamp(0.3 + 0.5*(dn[1]*0.5+0.5) + 0.2*(outw[1]), 0.25, 1), r()*tint, r());
    }
  }
}
function azalea(M, F, x, z, rx, ry, rz, seed){
  const r = mulberry(seed), g = terrainH(x,z), ico = ICO[3], base = M.count;
  const m = mat(MAT.SHRUB, [0.02,0.045,0.015], { wind:0.06, seed:r() });
  const pts = [];
  for (const d of ico.P){
    const k = 1 + 0.12*(vnoise3(d[0]*2.5+seed, d[1]*2.5, d[2]*2.5)-0.5);
    const p = [x + d[0]*rx*k, g - 0.12 + (Math.max(d[1], -0.2)+0.2)*ry*k/1.2, z + d[2]*rz*k];
    pts.push(p); M.vert(p, d, m, [d[0], d[2]], clamp(0.35 + 0.65*(d[1]*0.5+0.5), 0.3, 1));
  }
  for (const [a,b,c] of ico.F) M.tri(base+a, base+b, base+c);
  M.smoothNormals(base);
  const n = Math.round(26*rx*rz/0.5) + 10;
  for (let i=0;i<n;i++){
    const j = Math.floor(r()*ico.P.length), d = ico.P[j]; if (d[1] < -0.05) { i--; continue; }
    const nrm = [M.v[(base+j)*STRIDE+3], M.v[(base+j)*STRIDE+4], M.v[(base+j)*STRIDE+5]];
    const pos = v3.madd(pts[j], nrm, 0.03);
    card(F, pos, 0.3 + 0.12*r(), v3.norm(v3.add(nrm, [(r()-0.5)*0.8, 0.3, (r()-0.5)*0.8])), nrm, SPECIES.AZALEA, 0.25, r(), clamp(0.4 + 0.6*(d[1]*0.5+0.5), 0.3, 1), r(), r());
  }
}
function shrubsAndBackground(M, F){
  const r = mulberry(31337), placed = [];
  const ok = (x,z,minD) => placed.every(p => Math.hypot(p[0]-x, p[1]-z) > minD + p[2]);
  for (const T of TREES) placed.push([T.x, T.z, 2.0]);
  for (const L of LANTERNS) placed.push([L.x, L.z, 0.9]);
  placed.push([PAV.x, PAV.z, 5.5], [FALL.lip[0], FALL.lip[2], 1.8]);
  // background: cedars and evergreen oaks on the hills and the outer slopes
  let nb = 0;
  for (let k=0;k<2400 && nb<190;k++){
    const x = -74 + 148*r(), z = -74 + 148*r(), p = pondSD(x,z);
    if (p < 8 || Math.abs(p-4.6) < 2.2) continue;
    const h = terrainH(x,z), want = smooth(0.8, 4, h) + smooth(24, 34, Math.max(Math.abs(x), Math.abs(z))) + (z < -18 ? 0.6 : 0);
    if (r() > want*0.9) continue;
    const s = 0.8 + 0.5*r();
    if (!ok(x, z, 2.6*s)) continue;
    placed.push([x, z, 1.5*s]); nb++;
    if (r() < 0.5) cedarTree(M, F, x, z, s, r); else broadleafEvergreen(M, F, x, z, s, r);
  }
  // clipped azalea mounds (o-karikomi), mostly near the water
  let na = 0;
  for (let k=0;k<1400 && na<64;k++){
    const x = -26 + 50*r(), z = -22 + 38*r(), w = waterSD(x,z);
    if (w < 0.9 || w > 7 || pathW(x,z) > 0.02 || gentleW(x,z) > 0.1 || segDist(x,z,BRIDGE.a,BRIDGE.b) < 2.2) continue;
    if (Math.abs(x-PAV.x) < PAV.hx+1.2 && Math.abs(z-PAV.z) < PAV.hz+1.2) continue;
    const rx = 0.55 + 0.6*r(), rz = rx*(0.7+0.4*r()), ry = 0.45 + 0.35*r();
    if (!ok(x, z, rx+0.2)) continue;
    placed.push([x, z, rx]); na++;
    azalea(M, F, x, z, rx, ry, rz, 4000+k);
    if (r() < 0.45){ const a = r()*TAU, x2 = x + Math.cos(a)*(rx+0.35), z2 = z + Math.sin(a)*(rz+0.35); if (waterSD(x2,z2) > 0.6) azalea(M, F, x2, z2, rx*0.6, ry*0.7, rz*0.6, 5000+k); }
  }
  return { nb, na };
}

/* ---- water plants ---- */
function irises(M){
  const r = mulberry(777), mLeaf = mat(MAT.BLADE, [0.035,0.075,0.02], { wind:0.6 }), mFl = mat(MAT.FLOWER, [0.16,0.05,0.42], { x: SEASON.SUMMER|SEASON.SPRING });
  let n = 0;
  for (let k=0;k<400 && n<16;k++){
    const x = MARSH.x + (r()-0.5)*6, z = MARSH.z + (r()-0.5)*7, h = terrainH(x,z);
    if (h < -0.32 || h > 0.12) continue; n++;
    for (let b=0;b<16;b++){
      const a = r()*TAU, bx = x + Math.cos(a)*0.12*r(), bz = z + Math.sin(a)*0.12*r(), H = 0.55 + 0.4*r(), lean = 0.15 + 0.25*r();
      const dir = [Math.cos(a), 0, Math.sin(a)], side = [-dir[2], 0, dir[0]], w = 0.022;
      const pts = []; for (let i=0;i<=3;i++){ const t = i/3; pts.push([bx + dir[0]*lean*t*t*H, h - 0.05 + t*(H - h*0), bz + dir[2]*lean*t*t*H]); }
      for (let i=0;i<3;i++){ const wa = w*(1-i/3), wb = w*(1-(i+1)/3)+0.002;
        doubleQuad(M, mLeaf, v3.madd(pts[i],side,-wa), v3.madd(pts[i],side,wa), v3.madd(pts[i+1],side,wb), v3.madd(pts[i+1],side,-wb)); }
    }
    for (let f=0; f<3; f++){
      const fx = x + (r()-0.5)*0.3, fz = z + (r()-0.5)*0.3, fh = 0.75 + 0.2*r();
      tube(M, mLeaf, [[fx, h-0.05, fz], [fx, fh, fz]], [0.008, 0.006], 4);
      for (let p=0;p<3;p++){ const a = p/3*TAU + r(), d = [Math.cos(a), 0, Math.sin(a)], sd = [-d[2],0,d[0]];
        const c0 = [fx, fh, fz], tip = [fx + d[0]*0.09, fh - 0.04, fz + d[2]*0.09];
        doubleQuad(M, mFl, v3.madd(c0, sd, -0.012), v3.madd(c0, sd, 0.012), v3.madd(tip, sd, 0.03), v3.madd(tip, sd, -0.03));
        doubleQuad(M, mFl, v3.madd(c0, sd, -0.01), v3.madd(c0, sd, 0.01), v3.add(v3.madd(c0, sd, 0.015), [d[0]*0.02, 0.07, d[2]*0.02]), v3.add(v3.madd(c0, sd, -0.015), [d[0]*0.02, 0.07, d[2]*0.02])); }
    }
  }
}
function lilies(M){
  const r = mulberry(888);
  for (const C of LILY_CLUSTERS){
    for (let k=0;k<C.n;k++){
      const a = r()*TAU, d = C.r*Math.sqrt(r()), x = C.x + Math.cos(a)*d, z = C.z + Math.sin(a)*d;
      if (terrainH(x,z) > -0.15) continue;
      const R = 0.1 + 0.12*r(), rot = r()*TAU, notch = 0.3;
      const m = mat(MAT.LILY, [0.035 + 0.02*r(), 0.085 + 0.03*r(), 0.02], { wind:-1, x: SEASON.SPRING|SEASON.SUMMER|SEASON.AUTUMN });
      const c = M.vert([x, 0.012, z], [0,1,0], m, [0,0]);
      const ring = []; for (let i=0;i<=16;i++){ const aa = rot + notch/2 + (TAU-notch)*i/16; ring.push(M.vert([x+Math.cos(aa)*R, 0.012, z+Math.sin(aa)*R], [0,1,0], m, [Math.cos(aa-rot), Math.sin(aa-rot)])); }
      for (let i=0;i<16;i++) M.triAuto(c, ring[i], ring[i+1]);
      if (r() < 0.22){
        const mf = mat(MAT.FLOWER, r() < 0.5 ? [0.8,0.78,0.72] : [0.75,0.35,0.45], { wind:-1, x: SEASON.SUMMER });
        const fx = x + Math.cos(rot+Math.PI)*R*0.3, fz = z + Math.sin(rot+Math.PI)*R*0.3;
        for (let p=0;p<10;p++){ const aa = p/10*TAU, dd = [Math.cos(aa),0,Math.sin(aa)], sd = [-dd[2],0,dd[0]], up = p%2 ? 0.05 : 0.03;
          const b0 = [fx, 0.02, fz], tip = [fx+dd[0]*0.075, 0.02+up, fz+dd[2]*0.075];
          doubleQuad(M, mf, v3.madd(b0,sd,-0.008), v3.madd(b0,sd,0.008), v3.madd(tip,sd,0.012), v3.madd(tip,sd,-0.012)); }
        lathe(M, mat(MAT.FLOWER, [0.85,0.6,0.1], { wind:-1, x: SEASON.SUMMER }), [fx, 0.02, fz], [[0.018,0],[0.018,0.025],[0,0.03]], 6);
      }
    }
  }
}

/* ---- waterfall sheet (drawn in the transparent pass) ---- */
function buildWaterfall(W){
  const [lx,ly,lz] = FALL.lip, [bx,,bz] = FALL.base, w = FALL.w;
  const d = v3.norm([bx-lx, 0, bz-lz]), sd = [-d[2], 0, d[0]];
  const m = mat(0, [1,1,1]);
  // stream behind the lip, then a ballistic arc down to the pool
  const path = [];
  for (let i=0;i<=5;i++){ const t = i/5; path.push([lx - d[0]*(1-t)*1.6, ly + 0.03 + (1-t)*0.18, lz - d[2]*(1-t)*1.6, 0]); }
  const drop = ly + 0.05, v0 = 1.1, T = Math.sqrt(2*drop/9.81);
  for (let i=1;i<=16;i++){ const t = T*i/16, h = drop - 0.5*9.81*t*t, fwd = v0*t; path.push([lx + d[0]*fwd, h, lz + d[2]*fwd, i/16]); }
  let len = 0;
  const rows = path.map((p,i) => { if (i>0) len += Math.hypot(p[0]-path[i-1][0], p[1]-path[i-1][1], p[2]-path[i-1][2]);
    const ww = w*(p[3] > 0 ? 1 + 0.35*p[3] : 0.9);
    return [-1,-0.5,0,0.5,1].map(s => W.vert([p[0]+sd[0]*s*ww/2, p[1], p[2]+sd[2]*s*ww/2], [-d[0]*0.3, 0.2, -d[2]*0.3], m, [s*0.5+0.5, len], 1, [p[3], 0, 0])); });
  for (let i=0;i<rows.length-1;i++) for (let j=0;j<4;j++){ W.quad(rows[i][j], rows[i][j+1], rows[i+1][j+1], rows[i+1][j]); W.quad(rows[i][j], rows[i+1][j], rows[i+1][j+1], rows[i][j+1]); }
  // foam disc at the base
  const c = W.vert([bx+d[0]*0.25, 0.015, bz+d[2]*0.25], [0,1,0], mat(1,[1,1,1]), [0.5,0.5], 1, [2,0,0]);
  const ring = []; for (let i=0;i<=20;i++){ const a = i/20*TAU; ring.push(W.vert([bx+d[0]*0.25+Math.cos(a)*1.1, 0.015, bz+d[2]*0.25+Math.sin(a)*0.9], [0,1,0], mat(1,[1,1,1]), [0.5+Math.cos(a)*0.5, 0.5+Math.sin(a)*0.5], 1, [2,1,0])); }
  for (let i=0;i<20;i++){ W.tri(c, ring[i+1], ring[i]); W.tri(c, ring[i], ring[i+1]); }
}
