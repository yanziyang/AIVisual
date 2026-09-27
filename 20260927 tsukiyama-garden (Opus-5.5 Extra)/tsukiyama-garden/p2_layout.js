/* ---------------- Garden layout: pond, islands, hills, placements ---------------- */
// Metres throughout. y is up, the water surface is y = 0, north is −z and east is +x.
// The pond outline is a closed Catmull-Rom curve through hand-placed points; every height in the
// garden comes from terrainH(x,z), which is built from the signed distance to that outline.

function catmullClosed(P, n){
  const out = [], N = P.length;
  for (let i=0;i<N;i++){
    const p0=P[(i-1+N)%N], p1=P[i], p2=P[(i+1)%N], p3=P[(i+2)%N];
    for (let k=0;k<n;k++){
      const t=k/n, t2=t*t, t3=t2*t;
      const f = c => 0.5*((2*p1[c]) + (-p0[c]+p2[c])*t + (2*p0[c]-5*p1[c]+4*p2[c]-p3[c])*t2 + (-p0[c]+3*p1[c]-3*p2[c]+p3[c])*t3);
      out.push([f(0), f(1)]);
    }
  }
  return out;
}
function blobPts(cx, cz, rx, rz, rot, seed, n=14, wob=0.14){
  const r = mulberry(seed), pts = [];
  for (let i=0;i<n;i++){
    const a = i/n*TAU, k = 1 + wob*(r()*2-1), x = Math.cos(a)*rx*k, z = Math.sin(a)*rz*k;
    pts.push([cx + x*Math.cos(rot) - z*Math.sin(rot), cz + x*Math.sin(rot) + z*Math.cos(rot)]);
  }
  return pts;
}
// signed distance to a closed polyline: negative inside
function sdPoly(P, x, z){
  let best = 1e18, inside = false;
  for (let i=0, j=P.length-1; i<P.length; j=i++){
    const ax=P[j][0], az=P[j][1], bx=P[i][0], bz=P[i][1];
    const ex=bx-ax, ez=bz-az, wx=x-ax, wz=z-az;
    const t = clamp((wx*ex+wz*ez)/(ex*ex+ez*ez), 0, 1);
    const dx = wx-ex*t, dz = wz-ez*t, d2 = dx*dx+dz*dz;
    if (d2 < best) best = d2;
    if ((az>z) !== (bz>z) && x < ax + (z-az)*ex/ez) inside = !inside;
  }
  return inside ? -Math.sqrt(best) : Math.sqrt(best);
}
// distance field sampled on a grid: exact near the curve, interpolated from a coarse pass elsewhere
function sdGrid(poly, x0, z0, cell, n, outside){
  const cc = 2.0, cn = Math.ceil(n*cell/cc)+2, coarse = new Float32Array(cn*cn);
  for (let j=0;j<cn;j++) for (let i=0;i<cn;i++) coarse[j*cn+i] = sdPoly(poly, x0+i*cc, z0+j*cc);
  const g = new Float32Array(n*n);
  for (let j=0;j<n;j++) for (let i=0;i<n;i++){
    const x = x0+i*cell, z = z0+j*cell, fx = (x-x0)/cc, fz = (z-z0)/cc, ix = Math.floor(fx), iz = Math.floor(fz), tx = fx-ix, tz = fz-iz;
    const c = (a,b) => coarse[(iz+b)*cn + ix+a];
    const est = lerp(lerp(c(0,0),c(1,0),tx), lerp(c(0,1),c(1,1),tx), tz);
    g[j*n+i] = Math.abs(est) < 5 ? sdPoly(poly, x, z) : est;
  }
  return { g, x0, z0, cell, n, outside };
}
function sampleGrid(G, x, z){
  const fx = (x-G.x0)/G.cell, fz = (z-G.z0)/G.cell;
  if (fx < 0 || fz < 0 || fx >= G.n-1 || fz >= G.n-1) return G.outside;
  const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx-ix, tz = fz-iz, n = G.n, g = G.g, i = iz*n+ix;
  return lerp(lerp(g[i], g[i+1], tx), lerp(g[i+n], g[i+n+1], tx), tz);
}

const POND_PTS = [
  [-23.5, 1.5], [-22, -4.5], [-18.5, -8.5], [-14, -10.5], [-9.5, -11.5], [-6, -14.5], [-1.5, -15.2], [2.5, -12.5],
  [7, -11], [11.5, -12.5], [16, -11], [19.5, -7.5], [21.5, -2.5], [21, 2.5], [18, 6.5], [14, 9.5], [9.5, 10.5],
  [5.5, 9.5], [2.5, 7], [-1.5, 8.5], [-5.5, 11], [-10, 12], [-15, 11], [-19.5, 8.5], [-22.5, 5.5]
];
const POND_POLY = catmullClosed(POND_PTS, 16);
const ISLE_MAIN   = { c:[10.5, 1.0], poly: catmullClosed(blobPts(10.5, 1.0, 4.6, 3.1, 0.22, 5), 10) };   // nakajima, reached by the bridge
const ISLE_TURTLE = { c:[-13, -3.6], poly: catmullClosed(blobPts(-13, -3.6, 1.9, 1.35, -0.4, 9, 10, 0.12), 10) }; // kame-jima

const SDX0 = -46, SDN = 369, SDC = 0.25;
const SD_POND = sdGrid(POND_POLY, SDX0, SDX0, SDC, SDN, 60);
const SD_ISLE = sdGrid(ISLE_MAIN.poly, SDX0, SDX0, SDC, SDN, 60);
const SD_TURT = sdGrid(ISLE_TURTLE.poly, SDX0, SDX0, SDC, SDN, 60);
const pondSD = (x,z) => sampleGrid(SD_POND, x, z);
// > 0 on land, < 0 over water (islands count as land)
const waterSD = (x,z) => Math.max(pondSD(x,z), -sampleGrid(SD_ISLE, x, z), -sampleGrid(SD_TURT, x, z));

const gaussW = (x,z,c) => Math.exp(-0.5*((x-c.x)**2 + (z-c.z)**2)/(c.r*c.r));
const BEACH = { x:-15.8, z:9.6, r:3.6 };   // suhama: pebble beach sloping gently into the water
const MARSH = { x:20.8, z:-1.2, r:2.6 };   // shallow iris margin
const gentleW = (x,z) => smooth(0.18, 0.75, Math.max(gaussW(x,z,BEACH), gaussW(x,z,MARSH)));

const HILLS = [
  { x:-5,   z:-29,   h:7.5, sx:10,  sz:7   },  // main tsukiyama behind the pavilion
  { x:15,   z:-25,   h:5.5, sx:7,   sz:6   },
  { x:-23,  z:-21,   h:4.8, sx:6.5, sz:6   },
  { x:-17.6,z:-12.9, h:2.1, sx:2.4, sz:2.1 },  // waterfall hill
  { x:-36,  z:1,     h:3.6, sx:7,   sz:9   },
  { x:33,   z:-4,    h:3.0, sx:7,   sz:8   },
  { x:-27,  z:21,    h:1.8, sx:6,   sz:5   },
  { x:27,   z:20,    h:2.2, sx:6,   sz:5   },
  { x:6,    z:-20,   h:1.2, sx:3.5, sz:2.5 },
];
const PAV = { x:-2.4, z:-15.6, hx:3.2, hz:2.4, floor:0.85 };            // tsuri-dono style pavilion over the north shore
const BRIDGE = { a:[11.2, 3.5], b:[13.5, 10.9], w:1.8, rise:1.25 };     // taiko-bashi to the island
const FALL = { lip:[-16.95, 1.72, -10.45], base:[-16.55, 0, -8.85], w:0.8 }; // waterfall (taki)

function landExtra(x,z){
  let h = 0.10*(fbm2(x*0.05, z*0.05, 4, 11)-0.5) + 0.035*(vnoise2(x*0.6, z*0.6, 12)-0.5);
  for (const H of HILLS){
    const dx = (x-H.x)/H.sx, dz = (z-H.z)/H.sz;
    h += H.h*Math.exp(-0.5*(dx*dx+dz*dz))*(1 + 0.22*(fbm2(x*0.16+H.x, z*0.16, 3, 21)-0.5));
  }
  const r = Math.max(Math.abs(x), Math.abs(z)*1.05);
  h += 13*smooth(34, 74, r)*(0.7 + 0.6*fbm2(x*0.035, z*0.035, 3, 31));
  return h;
}
function shoreProfile(dd, g){
  const basin = -0.75*(1 - Math.exp(Math.min(dd,0)/3.2));
  const rock = dd >= 0 ? 0.12 + 0.18*smooth(0, 1.2, dd) : 0.12 - 0.42*smooth(0, 0.7, -dd) + basin;
  const gentle = dd >= 0 ? 0.03 + 0.27*smooth(0, 3.0, dd) : Math.max(0.03 + 0.11*dd, rock);
  return lerp(rock, gentle, g);
}
function segDist(x, z, a, b){
  const ex=b[0]-a[0], ez=b[1]-a[1], t = clamp(((x-a[0])*ex + (z-a[1])*ez)/(ex*ex+ez*ez), 0, 1);
  return Math.hypot(x-a[0]-ex*t, z-a[1]-ez*t);
}
function terrainH(x, z){
  const wsd = waterSD(x,z);
  const dd = wsd + 0.28*(vnoise2(x*0.45, z*0.45, 3)-0.5) + 0.10*(vnoise2(x*1.9, z*1.9, 5)-0.5);
  const g = gentleW(x,z);
  let h = shoreProfile(dd, g);
  if (dd > 0) h += landExtra(x,z)*smooth(0.4, 4.5, dd);
  else h += 0.10*(fbm2(x*0.25, z*0.25, 3, 41)-0.5)*smooth(0, 1.5, -dd);
  // island mounds
  const si = sampleGrid(SD_ISLE, x, z), st = sampleGrid(SD_TURT, x, z);
  if (si < 0) h += 0.95*smooth(0.4, 3.0, -si)*(0.85 + 0.3*vnoise2(x*0.7, z*0.7, 7));
  if (st < 0) h += 0.30*smooth(0.3, 1.1, -st);
  // waterfall: a steep bank right at the water's edge, with a cleft for the stream above the lip
  const dl = Math.hypot(x-FALL.lip[0], z-FALL.lip[2]-0.4);
  if (dd > -0.4) h += 1.75*smooth(-0.1, 1.1, dd)*Math.exp(-0.5*(dl/2.3)**2);
  const df = segDist(x, z, [FALL.lip[0], FALL.lip[2]], [FALL.lip[0]-0.5, FALL.lip[2]-3.0]);
  h -= 0.45*Math.exp(-0.5*(df/0.45)**2)*smooth(0.3, 1.2, dd);
  // level pad under the pavilion
  const px = Math.abs(x-PAV.x) - PAV.hx - 0.6, pz = Math.abs(z-PAV.z) - PAV.hz - 0.6;
  const inPad = smooth(0.8, 0.0, Math.max(px, pz));
  if (dd > 0) h = lerp(h, Math.min(h, 0.42), inPad);
  return h;
}

// Stroll path: a gravel ring about 4.6 m back from the water, with spurs to the bridge, pavilion and lantern point
const PATH_SPURS = [
  [[13.5, 10.9], [14.6, 13.6]],
  [[PAV.x+PAV.hx+0.4, PAV.z-1.2], [PAV.x+PAV.hx+2.6, PAV.z-3.4]],
  [[1.6, 9.9], [2.4, 12.6]],
];
function pathW(x, z){
  const p = pondSD(x,z);
  let w = 1 - smooth(0.42, 0.78, Math.abs(p - 4.6 - 0.35*(vnoise2(x*0.12, z*0.12, 51)-0.5)));
  for (const s of PATH_SPURS) w = Math.max(w, 1 - smooth(0.40, 0.72, segDist(x, z, s[0], s[1])));
  const px = Math.abs(x-PAV.x) - PAV.hx, pz = Math.abs(z-PAV.z) - PAV.hz;
  if (Math.max(px, pz) < 0.2) w = 0;
  return w;
}

/* ---- hand-placed features ---- */
const LANTERNS = [
  { type:'kotoji', x:-1.05, z:8.55, rot:0.55,  s:1.0  },  // two-legged yukimi, one leg in the water (after Kenroku-en)
  { type:'kasuga', x:2.3,   z:-15.1, rot:0.25, s:1.0  },
  { type:'yukimi', x:8.6,   z:2.3,  rot:-0.35, s:0.72 },
  { type:'kasuga', x:15.6,  z:12.2, rot:-0.6,  s:0.78 },
  { type:'kasuga', x:-19.6, z:-10.6, rot:0.9,  s:0.7  },
];
// type: pine | maple | sakura ; lean: direction (radians, 0 = north) and amount
const TREES = [
  { t:'pine',   x:3.6,   z:9.8,   s:1.0,  lean:[-2.4, 0.32], seed:1 },
  { t:'pine',   x:10.2,  z:0.4,   s:1.2,  lean:[0.5, 0.12],  seed:2 },
  { t:'pine',   x:-12.9, z:-3.7,  s:0.55, lean:[1.9, 0.30],  seed:3 },
  { t:'pine',   x:17.8,  z:-10.4, s:0.9,  lean:[3.9, 0.28],  seed:4 },
  { t:'pine',   x:-19.8, z:-9.2,  s:0.8,  lean:[2.6, 0.22],  seed:5 },
  { t:'pine',   x:-18.9, z:11.2,  s:0.95, lean:[0.4, 0.30],  seed:6 },
  { t:'pine',   x:7.5,   z:-21.5, s:1.35, lean:[3.2, 0.08],  seed:7 },
  { t:'maple',  x:-9.6,  z:-15.8, s:1.0,  seed:11 },
  { t:'maple',  x:5.4,   z:-15.2, s:0.9,  seed:12 },
  { t:'maple',  x:-14.6, z:-13.4, s:1.05, seed:13 },
  { t:'maple',  x:12.8,  z:-15.6, s:1.0,  seed:14 },
  { t:'maple',  x:20.8,  z:-10.8, s:0.9,  seed:15 },
  { t:'maple',  x:-23.2, z:-6.4,  s:1.0,  seed:16 },
  { t:'maple',  x:24.6,  z:3.4,   s:1.0,  seed:17 },
  { t:'maple',  x:7.8,   z:13.4,  s:0.85, seed:18 },
  { t:'maple',  x:-24.6, z:9.4,   s:0.9,  seed:19 },
  { t:'maple',  x:-4.2,  z:-21.6, s:1.2,  seed:20 },
  { t:'maple',  x:12.9,  z:-0.2,  s:0.7,  seed:21 },
  { t:'sakura', x:-11.8, z:16.2,  s:1.1,  seed:31 },
  { t:'sakura', x:20.4,  z:12.6,  s:1.0,  seed:32 },
  { t:'sakura', x:-29,   z:-11,   s:1.1,  seed:33 },
];
const LILY_CLUSTERS = [ { x:13.8, z:-8.6, r:2.3, n:30 }, { x:-9.6, z:-6.4, r:1.5, n:16 }, { x:-19.2, z:1.6, r:1.3, n:12 } ];
const STEPPING = { a:[-21.4, -3.0], b:[-15.2, -3.9], n:8 };   // sawatari: stepping stones out to the turtle island
const KOI_COUNT = 14;
