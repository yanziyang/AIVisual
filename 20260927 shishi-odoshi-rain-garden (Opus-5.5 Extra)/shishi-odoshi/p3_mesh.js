/* ---------------- Mesh builder ---------------- */
// One interleaved vertex format for everything static: pos3 nrm3 col4(rgb albedo + ao) uv2 attr4(material, wind, seed, extra).
const STRIDE = 16;
const MAT = { TERRAIN:0, ROCK:1, BAMBOO:2, OLDBAMBOO:3, RAIL:4, ROPE:5, STONE:6, FIREBOX:7, INNER:8, STEM:9, BLADE:10,
  PLAIN:11, BARK:12, WOOD:13, LEAFFLAT:14 };
class Mesh {
  constructor(){ this.v = []; this.ix = []; }
  get count(){ return this.v.length/STRIDE; }
  vert(p, n, m, uv, ao=1, col){
    const c = col || m.col;
    this.v.push(p[0],p[1],p[2], n[0],n[1],n[2], c[0],c[1],c[2], ao, uv[0],uv[1], m.id, m.wind||0, m.seed||0, m.x||0);
    return this.count-1;
  }
  tri(a,b,c){ this.ix.push(a,b,c); }
  quad(a,b,c,d){ this.ix.push(a,b,c, a,c,d); }
  // wind the triangle so its geometric normal agrees with the vertex normals (keeps back-face culling honest)
  triAuto(a,b,c){
    const v = this.v, P = i => [v[i*STRIDE], v[i*STRIDE+1], v[i*STRIDE+2]], N = i => [v[i*STRIDE+3], v[i*STRIDE+4], v[i*STRIDE+5]];
    const g = v3.cross(v3.sub(P(b),P(a)), v3.sub(P(c),P(a)));
    const n = v3.add(v3.add(N(a),N(b)),N(c));
    if (v3.dot(g,n) < 0) this.ix.push(a,c,b); else this.ix.push(a,b,c);
  }
  quadAuto(a,b,c,d){ this.triAuto(a,b,c); this.triAuto(a,c,d); }
  // recompute smooth normals from faces for vertices [from, count)
  smoothNormals(from=0){
    const v = this.v, n = this.count, acc = new Float32Array((n-from)*3);
    for (let t=0;t<this.ix.length;t+=3){
      const a=this.ix[t], b=this.ix[t+1], c=this.ix[t+2];
      if (a<from || b<from || c<from) continue;
      const pa=[v[a*STRIDE],v[a*STRIDE+1],v[a*STRIDE+2]], pb=[v[b*STRIDE],v[b*STRIDE+1],v[b*STRIDE+2]], pc=[v[c*STRIDE],v[c*STRIDE+1],v[c*STRIDE+2]];
      const g = v3.cross(v3.sub(pb,pa), v3.sub(pc,pa));
      for (const i of [a,b,c]){ const k=(i-from)*3; acc[k]+=g[0]; acc[k+1]+=g[1]; acc[k+2]+=g[2]; }
    }
    for (let i=from;i<n;i++){ const k=(i-from)*3, l=Math.hypot(acc[k],acc[k+1],acc[k+2])||1;
      v[i*STRIDE+3]=acc[k]/l; v[i*STRIDE+4]=acc[k+1]/l; v[i*STRIDE+5]=acc[k+2]/l; }
  }
}
const mat = (id, col, extra={}) => Object.assign({ id, col, wind:0, seed:0, x:0 }, extra);

// oriented box: centre c, unit axes ax ay az, half sizes
function obox(M, m, c, ax, ay, az, hx, hy, hz, ao=[1,1]){
  const faces = [[ax,ay,az,hx,hy,hz],[v3.mul(ax,-1),ay,v3.mul(az,-1),hx,hy,hz],[az,ay,v3.mul(ax,-1),hz,hy,hx],[v3.mul(az,-1),ay,ax,hz,hy,hx],
                 [ax,v3.mul(az,-1),ay,hx,hz,hy],[ax,az,v3.mul(ay,-1),hx,hz,hy]];
  // each face: u axis, v axis, normal axis, half-u, half-v, half-n
  for (const [u,v,n,hu,hv,hn] of faces){
    const o = v3.madd(c, n, hn), k = [];
    // uv in metres; uv.x runs along the box's longest axis when it lies in this face (wood grain, planks)
    const swap = hv > hu && hv >= Math.max(hx,hy,hz)*0.999;
    for (const [su,sv] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
      const p = v3.madd(v3.madd(o,u,su*hu), v,sv*hv);
      const yk = (v3.dot(v3.sub(p,c),ay)/hy)*0.5+0.5;
      const uu = su*hu + v3.dot(c,u), vv = sv*hv + v3.dot(c,v);
      k.push(M.vert(p, n, m, swap ? [vv, uu] : [uu, vv], lerp(ao[0],ao[1],yk)));
    }
    M.quadAuto(k[0],k[1],k[2],k[3]);
  }
}
function boxAxis(M, m, c, size, rotY=0, ao){
  const ax=[Math.cos(rotY),0,-Math.sin(rotY)], az=[Math.sin(rotY),0,Math.cos(rotY)];
  obox(M, m, c, ax, [0,1,0], az, size[0]/2, size[1]/2, size[2]/2, ao);
}
// rectangular beam from p0 to p1
function beam(M, m, p0, p1, w, h, up=[0,1,0]){
  const d = v3.sub(p1,p0), L = v3.len(d), az = v3.mul(d,1/L);
  let ax = v3.cross(up, az); if (v3.len(ax) < 1e-4) ax = perp(az); ax = v3.norm(ax);
  const ay = v3.cross(az, ax);
  obox(M, m, v3.lerp(p0,p1,0.5), ax, ay, az, w/2, h/2, L/2);
}
// tube along a polyline with per-point radius, parallel-transport frames
function tube(M, m, pts, radii, sides=8, opt={}){
  const n = pts.length, rings = [];
  let T = v3.norm(v3.sub(pts[1],pts[0])), N = perp(T), len = 0;
  for (let i=0;i<n;i++){
    const Tn = i<n-1 ? v3.norm(v3.sub(pts[i+1],pts[i])) : T;
    const Ti = i>0 && i<n-1 ? v3.norm(v3.add(T,Tn)) : (i===0 ? Tn : T);
    // transport N
    N = v3.norm(v3.sub(N, v3.mul(Ti, v3.dot(N,Ti)))); const B = v3.cross(Ti, N);
    if (i>0) len += v3.len(v3.sub(pts[i],pts[i-1]));
    const ring = [];
    for (let s=0;s<=sides;s++){
      const a = s/sides*TAU, dir = v3.add(v3.mul(N,Math.cos(a)), v3.mul(B,Math.sin(a)));
      const p = v3.madd(pts[i], dir, radii[i]);
      const ao = opt.ao ? opt.ao(i/(n-1), p) : 1;
      ring.push(M.vert(p, dir, opt.mat ? opt.mat(i/(n-1)) : m, [s/sides*(opt.uvu||1), len*(opt.uvv||1)], ao));
    }
    rings.push(ring); T = Tn;
  }
  for (let i=0;i<n-1;i++) for (let s=0;s<sides;s++) M.quadAuto(rings[i][s], rings[i][s+1], rings[i+1][s+1], rings[i+1][s]);
  if (opt.cap1){ const c = M.vert(pts[n-1], T, m, [0.5,0.5]); for (let s=0;s<sides;s++){ const a=rings[n-1][s], b=rings[n-1][s+1];
      const pa=[M.v[a*STRIDE],M.v[a*STRIDE+1],M.v[a*STRIDE+2]], pb=[M.v[b*STRIDE],M.v[b*STRIDE+1],M.v[b*STRIDE+2]];
      const ia = M.vert(pa, T, m, [0,0]), ib = M.vert(pb, T, m, [1,0]); M.triAuto(ia, ib, c); } }
}
// surface of revolution: prof = [[r, y], ...] bottom to top; flat=true gives a faceted (e.g. hexagonal) solid
function lathe(M, m, c, prof, sides, flat=false, rot0=0, uvs=1){
  const P = (r,y,a) => [c[0]+Math.cos(a)*r, c[1]+y, c[2]+Math.sin(a)*r];
  for (let i=0;i<prof.length-1;i++){
    const [r0,y0]=prof[i], [r1,y1]=prof[i+1];
    const slope = [y1-y0, -(r1-r0)]; const sl = Math.hypot(slope[0],slope[1])||1;
    for (let s=0;s<sides;s++){
      const a0 = rot0 + s/sides*TAU, a1 = rot0 + (s+1)/sides*TAU;
      let n0, n1;
      if (flat){ const am = (a0+a1)/2; const nr = slope[0]/sl, ny = slope[1]/sl; const k = Math.cos(Math.PI/sides); n0 = n1 = v3.norm([Math.cos(am)*nr, ny*k, Math.sin(am)*nr]); }
      else { n0 = v3.norm([Math.cos(a0)*slope[0]/sl, slope[1]/sl, Math.sin(a0)*slope[0]/sl]); n1 = v3.norm([Math.cos(a1)*slope[0]/sl, slope[1]/sl, Math.sin(a1)*slope[0]/sl]); }
      const w = flat ? 1 : 0;
      const u0 = s/sides*uvs, u1 = (s+1)/sides*uvs;
      const k0 = M.vert(P(r0,y0,a0), n0, m, [u0 + w*0, y0]), k1 = M.vert(P(r0,y0,a1), n1, m, [u1, y0]);
      const k2 = M.vert(P(r1,y1,a1), n1, m, [u1, y1]), k3 = M.vert(P(r1,y1,a0), n0, m, [u0, y1]);
      M.quadAuto(k0,k1,k2,k3);
    }
  }
  const cap = (r, y, up) => { if (r <= 1e-4) return; const n = [0, up?1:-1, 0]; const cc = M.vert([c[0],c[1]+y,c[2]], n, m, [0,0]);
    for (let s=0;s<sides;s++){ const a0=rot0+s/sides*TAU, a1=rot0+(s+1)/sides*TAU;
      M.triAuto(cc, M.vert(P(r,y,a0), n, m, [Math.cos(a0)*r, Math.sin(a0)*r]), M.vert(P(r,y,a1), n, m, [Math.cos(a1)*r, Math.sin(a1)*r])); } };
  cap(prof[0][0], prof[0][1], false); cap(prof[prof.length-1][0], prof[prof.length-1][1], true);
}
// parametric surface; normal = dP/du x dP/dv (flip to reverse)
function surface(M, m, nu, nv, fn, flip=false, aoFn){
  const idx = [];
  const eps = 1e-3;
  for (let j=0;j<=nv;j++) for (let i=0;i<=nu;i++){
    const u=i/nu, v=j/nv, r = fn(u,v);
    const du = v3.sub(fn(Math.min(u+eps,1),v).p, fn(Math.max(u-eps,0),v).p), dv = v3.sub(fn(u,Math.min(v+eps,1)).p, fn(u,Math.max(v-eps,0)).p);
    let n = v3.norm(v3.cross(du, dv)); if (flip) n = v3.mul(n,-1);
    idx.push(M.vert(r.p, n, r.m || m, r.uv || [u,v], aoFn ? aoFn(u,v) : (r.ao ?? 1)));
  }
  for (let j=0;j<nv;j++) for (let i=0;i<nu;i++){ const a=j*(nu+1)+i; M.quadAuto(idx[a], idx[a+1], idx[a+nu+2], idx[a+nu+1]); }
}
function doubleQuad(M, m, p0, p1, p2, p3, uv=[[0,0],[1,0],[1,1],[0,1]]){
  const n = v3.norm(v3.cross(v3.sub(p1,p0), v3.sub(p3,p0))), nb = v3.mul(n,-1);
  const a = [p0,p1,p2,p3].map((p,i)=>M.vert(p, n, m, uv[i])); M.quad(a[0],a[1],a[2],a[3]);
  const b = [p0,p1,p2,p3].map((p,i)=>M.vert(p, nb, m, uv[i])); M.quad(b[0],b[3],b[2],b[1]);
}

/* ---- icosphere, shared by rocks, shrubs and koi food ---- */
function icosphere(sub){
  const t = (1+Math.sqrt(5))/2;
  let P = [[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]].map(v3.norm);
  let F = [[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
  for (let s=0;s<sub;s++){
    const cache = new Map(), NF = [];
    const mid = (a,b) => { const k = a<b ? a*65536+b : b*65536+a; if (cache.has(k)) return cache.get(k); P.push(v3.norm(v3.lerp(P[a],P[b],0.5))); cache.set(k, P.length-1); return P.length-1; };
    for (const [a,b,c] of F){ const ab=mid(a,b), bc=mid(b,c), ca=mid(c,a); NF.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]); }
    F = NF;
  }
  return { P, F };
}
const ICO = [0,1,2,3,4].map(icosphere);   // indexed by subdivision level
