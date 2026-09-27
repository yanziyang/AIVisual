/* ---------------- Garden layout ---------------- */
// Metres, y up. The pond surface is y = 0 (Clearwater's water plane); the moss lies about 12 cm above it.
// The viewer stands toward +z; the back fence is at z = -3. Positions follow the reference frames of the source video.
const YARD = { x0:-5.0, x1:5.0, z0:-3.0, z1:6.6 };       // inside faces of the four bamboo fences
const FENCE_H = 2.35;
const GROUND = 0.12;

// pond outline: closed Catmull-Rom curve through these points (a sunken, rock-lined pond in front of the shishi-odoshi)
const POND_PTS = [[0.12,-0.46],[0.78,-0.56],[1.32,-0.24],[1.64,0.42],[1.98,1.18],[2.14,1.98],[1.96,2.78],[1.32,3.24],[0.56,3.14],[0.06,2.56],[-0.06,1.76],[0.0,0.96],[-0.12,0.24]];
function catmullClosed(P, per){
  const out = [];
  for (let i=0;i<P.length;i++){
    const p0 = P[(i-1+P.length)%P.length], p1 = P[i], p2 = P[(i+1)%P.length], p3 = P[(i+2)%P.length];
    for (let s=0;s<per;s++){ const t = s/per, t2 = t*t, t3 = t2*t;
      out.push([0,1].map(k => 0.5*((2*p1[k]) + (-p0[k]+p2[k])*t + (2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2 + (-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3))); }
  }
  return out;
}
const POND_POLY = catmullClosed(POND_PTS, 14);
function polySD(P, x, z){
  let d = 1e9, inside = false;
  for (let i=0, j=P.length-1; i<P.length; j=i++){
    const [ax,az] = P[j], [bx,bz] = P[i];
    const ex = bx-ax, ez = bz-az, wx = x-ax, wz = z-az;
    const t = clamp((wx*ex + wz*ez)/(ex*ex + ez*ez), 0, 1);
    d = Math.min(d, Math.hypot(wx - ex*t, wz - ez*t));
    if (((az > z) !== (bz > z)) && (x < (bx-ax)*(z-az)/(bz-az) + ax)) inside = !inside;
  }
  return inside ? -d : d;
}
// the signed distance is cached on a 1 cm grid around the pond (it is queried ~10^5 times while meshing)
const SDG = { x0:-1.2, z0:-1.6, n:420, c:0.01 };
const sdGrid = (() => { const g = new Float32Array(SDG.n*SDG.n);
  for (let j=0;j<SDG.n;j++) for (let i=0;i<SDG.n;i++) g[j*SDG.n+i] = polySD(POND_POLY, SDG.x0 + i*SDG.c, SDG.z0 + j*SDG.c);
  return g; })();
function pondSD(x, z){
  const fx = (x - SDG.x0)/SDG.c, fz = (z - SDG.z0)/SDG.c;
  if (fx < 0 || fz < 0 || fx >= SDG.n-1 || fz >= SDG.n-1) return polySD(POND_POLY, x, z);
  const i = fx|0, j = fz|0, u = fx-i, v = fz-j, n = SDG.n, g = sdGrid;
  return (g[j*n+i]*(1-u) + g[j*n+i+1]*u)*(1-v) + (g[(j+1)*n+i]*(1-u) + g[(j+1)*n+i+1]*u)*v;
}
const segDist = (x, z, a, b) => { const ex=b[0]-a[0], ez=b[1]-a[1], t = clamp(((x-a[0])*ex + (z-a[1])*ez)/(ex*ex+ez*ez), 0, 1); return Math.hypot(x-a[0]-ex*t, z-a[1]-ez*t); };

// ground: moss over gentle mounds, rising a little toward the back fence and the big boulders; the pond is a steep-sided dish
function terrainH(x, z){
  let h = GROUND + 0.05*(fbm2(x*0.55, z*0.55, 3, 11) - 0.5) + 0.012*(vnoise2(x*3.1, z*3.1, 5) - 0.5);
  h += 0.07*smooth(0.6, -2.6, z) + 0.12*Math.exp(-((x+3.6)**2 + (z+1.9)**2)/1.6) + 0.05*Math.exp(-((x-3.4)**2 + (z+1.6)**2)/2.0);
  const sd = pondSD(x, z);
  if (sd < 0.3){
    const bottom = -0.36 - 0.1*smooth(-0.15, -0.9, sd) + 0.04*(vnoise2(x*2.3, z*2.3, 7) - 0.5);
    h = lerp(h, bottom, smooth(0.08, -0.16, sd));
  }
  return h;
}

/* ---- the shishi-odoshi (鹿威し) ---- */
// A bamboo tube pivots on an axle between two posts. Water from the kakei spout fills the open end; when the water's
// moment beats the tube's own, it tips, pours into the pond, swings back and its closed end strikes the stone: "kon".
const SHISHI = (() => {
  const pivot = [0.0, 0.67, -0.36];
  const dir = v3.norm([0.97, 0, 0.26]);              // tube axis in plan, toward the mouth
  const side = [-dir[2], 0, dir[0]];                 // axle direction
  const S = { pivot, dir, side, back:-0.38, node:0.06, mouth:0.8, lipCut:0.065, R:0.06, r:0.05,
    rest: 20*Math.PI/180, stop: -32*Math.PI/180 };
  // world position of a point at axial distance s (and lateral offset along the axle) for tube angle th
  S.at = (s, th, up=0) => [pivot[0] + dir[0]*s*Math.cos(th) - dir[0]*up*Math.sin(th), pivot[1] + s*Math.sin(th) + up*Math.cos(th), pivot[2] + dir[2]*s*Math.cos(th) - dir[2]*up*Math.sin(th)];
  S.mouthRest = S.at(S.mouth, S.rest);
  S.backRest = S.at(S.back, S.rest, -S.R);          // lowest point of the closed end at rest: where it meets the stone
  S.posts = [1, -1].map(k => [pivot[0] + side[0]*k*0.094, pivot[2] + side[2]*k*0.094]);
  // kakei: the tall feed pipe; its spout ends just above and a little behind the mouth
  S.kakei = [1.2, -0.66];
  S.tipVolume = 0.8;                                // litres at which the tube tips (from the physics at the rest angle)
  S.kakeiTop = 1.64;
  S.spoutEnd = v3.add(S.mouthRest, [0.06, 0.28, -0.04]);
  S.spoutStart = [S.kakei[0] - 0.02, 1.33, S.kakei[1] + 0.03];
  return S;
})();

/* ---- rocks ---- */
// kind: boulder (pale granite, lichen), moss (moss-capped), dark (bare, wet), step (flat stepping stone)
const ROCKS = [
  { x:-3.95, z:-1.95, sx:1.02, sy:0.8, sz:0.86, seed:11, kind:'boulder', sub:4, sink:0.3 },
  { x:-2.72, z:-2.38, sx:0.72, sy:0.62, sz:0.62, seed:12, kind:'boulder', sub:4, sink:0.3 },
  { x:-4.72, z:-0.52, sx:0.55, sy:0.48, sz:0.62, seed:13, kind:'boulder', sub:3, sink:0.35 },
  { x:-1.86, z:-2.3, sx:0.5, sy:0.26, sz:0.46, seed:14, kind:'moss', flatTop:0.62, sub:3, sink:0.25 },   // lantern plinth
  { x:-0.86, z:-0.98, sx:0.44, sy:0.33, sz:0.38, seed:15, kind:'moss', sub:3, sink:0.3 },
  { x:-1.5, z:-1.58, sx:0.36, sy:0.25, sz:0.32, seed:16, kind:'moss', sub:3, sink:0.35 },
  // the striking stone under the tube's closed end
  { x:SHISHI.backRest[0] - 0.02, z:SHISHI.backRest[2] - 0.01, sx:0.22, sy:0.28, sz:0.21, seed:17, kind:'dark', sub:3, strike:true },
  // pond rim, left chain (front to back)
  { x:-0.34, z:0.5, sx:0.34, sy:0.3, sz:0.3, seed:21, kind:'moss', sub:3, sink:0.35 },
  { x:-0.42, z:1.24, sx:0.4, sy:0.32, sz:0.34, seed:22, kind:'moss', sub:3, sink:0.35 },
  { x:-0.4, z:1.96, sx:0.36, sy:0.3, sz:0.33, seed:23, kind:'moss', sub:3, sink:0.35 },
  { x:-0.22, z:2.66, sx:0.4, sy:0.3, sz:0.35, seed:24, kind:'moss', sub:3, sink:0.35 },
  { x:0.3, z:3.3, sx:0.42, sy:0.28, sz:0.33, seed:25, kind:'moss', sub:3, sink:0.35 },
  // pond rim, right side
  { x:1.78, z:0.18, sx:0.5, sy:0.36, sz:0.4, seed:31, kind:'moss', sub:3, sink:0.3 },
  { x:2.28, z:0.92, sx:0.44, sy:0.32, sz:0.38, seed:32, kind:'moss', sub:3, sink:0.33 },
  { x:2.5, z:1.72, sx:0.36, sy:0.28, sz:0.33, seed:33, kind:'moss', sub:3, sink:0.35 },
  { x:2.36, z:2.52, sx:0.4, sy:0.26, sz:0.34, seed:34, kind:'moss', sub:3, sink:0.35 },
  { x:1.66, z:3.3, sx:0.34, sy:0.22, sz:0.3, seed:35, kind:'moss', sub:3, sink:0.4 },
  { x:1.46, z:-0.3, sx:0.28, sy:0.2, sz:0.26, seed:36, kind:'moss', sub:3, sink:0.4 },
  { x:0.34, z:-0.62, sx:0.22, sy:0.14, sz:0.2, seed:37, kind:'moss', sub:2, sink:0.45 },
  // a stone standing in the water near the front
  { x:1.18, z:2.3, y:-0.42, sx:0.26, sy:0.36, sz:0.24, seed:41, kind:'dark', sub:3, sink:0.05 },
  // odd rocks in the moss
  { x:2.95, z:-2.35, sx:0.4, sy:0.3, sz:0.34, seed:51, kind:'moss', sub:3, sink:0.4 },
  { x:4.2, z:-0.2, sx:0.34, sy:0.24, sz:0.3, seed:52, kind:'moss', sub:3, sink:0.4 },
  { x:-2.35, z:3.1, sx:0.3, sy:0.2, sz:0.26, seed:53, kind:'moss', sub:2, sink:0.4 },
  { x:3.6, z:3.6, sx:0.36, sy:0.25, sz:0.3, seed:54, kind:'moss', sub:3, sink:0.4 },
];
// tobi-ishi: flat stepping stones meandering from the front of the yard to the lantern
const STEPS = [[-2.6,4.9,0.3,0.24],[-3.05,4.15,0.34,0.26],[-2.55,3.35,0.3,0.25],[-3.15,2.55,0.36,0.27],[-2.75,1.7,0.33,0.25],
  [-3.35,0.95,0.36,0.26],[-4.35,0.6,0.38,0.27],[-3.8,-0.35,0.33,0.24],[-2.7,-0.9,0.28,0.21],[-2.9,0.35,0.3,0.22]];
STEPS.forEach(([x,z,sx,sz], i) => ROCKS.push({ x, z, sx, sy:0.1, sz, seed:60+i, kind:'step', sub:3, flatTop:0.68, sink:0.45, rot:0.5*i }));

/* ---- the stone lantern (tōrō) ---- */
const LANTERN = { x:-1.86, z:-2.3, rot:0.3, s:1.0 };

/* ---- plants ---- */
const FERNS = [[0.42,-0.98,0.62,1],[1.62,-0.92,0.52,2],[3.3,-0.62,0.8,3],[-3.55,-0.72,0.5,4],[-2.2,-1.55,0.42,5],[4.3,-2.3,0.6,6],
  [2.35,-2.45,0.55,7],[-0.25,-1.9,0.45,8],[2.95,1.2,0.42,9],[-4.4,1.9,0.5,10],[4.35,1.6,0.5,11],[0.95,-2.4,0.5,12]];
const TOKUSA = [[0.2,-1.28,0.26,0.95,1],[2.92,-1.18,0.3,1.25,2],[-1.18,-2.62,0.2,0.85,3],[4.25,-2.62,0.28,1.1,4],[-4.5,-2.6,0.24,1.0,5]];
const MAPLE = { x:4.0, z:5.2, h:3.6, R:2.2 };
function occupied(x, z, pad=0){
  if (pondSD(x, z) < 0.15 + pad) return true;
  for (const R of ROCKS){ const r = Math.max(R.sx, R.sz)*0.9 + pad; if ((x-R.x)**2 + (z-R.z)**2 < r*r) return true; }
  if (Math.hypot(x - LANTERN.x, z - LANTERN.z) < 0.45 + pad) return true;
  if (Math.hypot(x - SHISHI.kakei[0], z - SHISHI.kakei[1]) < 0.1 + pad) return true;
  return false;
}
