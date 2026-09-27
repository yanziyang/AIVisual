/* ---------------- Koi: mesh, colour varieties, behaviour ---------------- */
// Local fish space: head toward +z, length 1 (scaled per fish), s = 0 at the nose .. 1 at the tail tip.
const KOI_TYPES = ['Kohaku','Taishō Sanke','Shōwa','Yamabuki Ogon','Chagoi','Tanchō','Asagi','Platinum Ogon'];
function buildKoiMesh(){
  const M = new Mesh();
  const part = (id, side=0) => mat(id, [1,1,1], { wind: side });
  const W = s => s < 0.24 ? 0.1*Math.pow(Math.sin(Math.min(s/0.24,1)*Math.PI/2), 0.62) : 0.1*(1 - 0.84*Math.pow(Math.min((s-0.24)/0.62,1), 1.7));
  const Hh = s => W(s)*1.16, Yc = s => 0.012*Math.sin(Math.PI*s), Z = s => 0.5 - s;
  const NR = 30, NS = 16, sEnd = 0.86, base = M.count;
  for (let i=0;i<=NR;i++){
    const s = sEnd*Math.pow(i/NR, 1.15);
    for (let j=0;j<=NS;j++){
      const th = j/NS*TAU, sn = Math.sin(th);
      M.vert([Math.cos(th)*W(s), Yc(s) + sn*Hh(s)*(sn < 0 ? 0.8 : 1), Z(s)], [0,0,1], part(0), [s, j/NS], 1);
    }
  }
  for (let i=0;i<NR;i++) for (let j=0;j<NS;j++){ const a = base + i*(NS+1) + j; M.quad(a, a+1, a+NS+2, a+NS+1); }
  M.smoothNormals(base);
  // check orientation once: nose-ring normals should point forward-ish; flip all body triangles if not
  { const k = (base + 4*(NS+1) + 4)*STRIDE, p = [M.v[k],M.v[k+1],M.v[k+2]], n = [M.v[k+3],M.v[k+4],M.v[k+5]];
    if (p[0]*n[0] + p[1]*n[1] < 0){ for (let t=0;t<M.ix.length;t+=3){ const x = M.ix[t+1]; M.ix[t+1] = M.ix[t+2]; M.ix[t+2] = x; } M.smoothNormals(base); } }
  const membrane = (id, side, nu, nv, fn) => {
    for (const sg of [1,-1]){
      const b = M.count;
      for (let j=0;j<=nv;j++) for (let i=0;i<=nu;i++){ const r = fn(i/nu, j/nv); M.vert(r.p, v3.mul(r.n, sg), part(id, side), r.uv, 1, [r.a, 0, 0]); }
      for (let j=0;j<nv;j++) for (let i=0;i<nu;i++){ const a = b + j*(nu+1)+i; M.quadAuto(a, a+1, a+nu+2, a+nu+1); }
    }
  };
  // caudal fin: forked, flowing
  membrane(2, 0, 8, 10, (a, bb) => { const b = bb*2-1, len = 0.25*(0.6 + 0.4*Math.pow(Math.abs(b), 0.8)), s = sEnd - 0.02 + a*len;
    return { p:[0, Yc(sEnd) + b*(0.016 + 0.13*a), Z(s)], n:[1,0,0], uv:[s, bb], a }; });
  // dorsal fin
  membrane(1, 0, 10, 2, (a, h) => { const s = 0.28 + a*0.34, top = 0.058*Math.sin(Math.PI*Math.pow(a,0.7));
    return { p:[0, Yc(s) + Hh(s)*0.96 + h*top, Z(s) - h*0.02], n:[1,0,0], uv:[s, 0.5], a: h }; });
  // pectoral fins (large and rounded on koi)
  for (const sd of [1,-1]){
    const s0 = 0.2, root = [sd*W(s0)*0.8, Yc(s0) - Hh(s0)*0.45, Z(s0)];
    membrane(3, sd, 6, 6, (a, bb) => { const phi = 0.5 + (bb*2-1)*0.55, L = 0.15*(0.8 + 0.2*Math.cos((bb*2-1)*1.4));
      const p = [root[0] + sd*Math.cos(phi)*a*L, root[1] - a*0.035, root[2] - Math.sin(phi)*a*L];
      return { p, n:[0,1,0], uv:[s0 + a*0.1, bb], a }; });
    // pelvic fins
    const s1 = 0.46, r1 = [sd*W(s1)*0.5, Yc(s1) - Hh(s1)*0.8, Z(s1)];
    membrane(3, sd, 3, 3, (a, bb) => { const phi = 0.9 + (bb*2-1)*0.3, L = 0.07;
      return { p:[r1[0] + sd*Math.cos(phi)*a*L*0.6, r1[1] - a*0.02, r1[2] - Math.sin(phi)*a*L], n:[0,1,0], uv:[s1, bb], a }; });
  }
  return M;
}

// Behaviour: wander between deep points, avoid the banks and each other, come to the surface for food, dart away from taps.
const koi = [], pellets = [], dropQueue = [];
function addDrop(x, z, radius, strength){ if (dropQueue.length < 64) dropQueue.push([x, z, radius, strength]); }
function pondDepth(x,z){ return -terrainH(x,z); }
function randomDeepPoint(r){
  for (let k=0;k<200;k++){ const x = -22 + 43*r(), z = -14 + 25*r(); if (pondDepth(x,z) > 0.5) return [x,z]; }
  return [0,0];
}
function initKoi(){
  const r = mulberry(99);
  const types = [0,0,1,2,3,4,5,6,0,1,2,7,3,0];
  for (let i=0;i<KOI_COUNT;i++){
    const [x,z] = randomDeepPoint(r);
    koi.push({ x, z, y:-0.3, heading: r()*TAU, speed: 0.2, target: randomDeepPoint(r), phase: r()*TAU, len: 0.42 + 0.35*r(),
      type: types[i % types.length], seed: r()*100, burst: 0, depthT: -0.25 - 0.25*r(), timer: 5 + 10*r(), pitch: 0, amp: 0.12, r: mulberry(1000+i) });
  }
}
function wrapAng(a){ while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
function updateKoi(dt, feeding){
  for (const k of koi){
    const r = k.r;
    let tx = k.target[0], tz = k.target[1], wantSpeed = 0.2 + 0.08*Math.sin(k.seed + performance.now()*0.0002), wantY = k.depthT;
    // food on the surface?
    let best = null, bd = 9;
    for (const p of pellets){ const d = Math.hypot(p.x-k.x, p.z-k.z); if (d < bd){ bd = d; best = p; } }
    if (best){ tx = best.x; tz = best.z; wantSpeed = 0.5; wantY = bd < 1.5 ? -0.05 : -0.18;
      if (bd < 0.1 + k.len*0.4){ best.eaten = true; addDrop(best.x, best.z, 0.07, 0.05); addDrop(k.x + Math.sin(k.heading)*k.len*0.4, k.z + Math.cos(k.heading)*k.len*0.4, 0.05, 0.03); } }
    else { k.timer -= dt; if (k.timer < 0 || Math.hypot(tx-k.x, tz-k.z) < 1.0){ k.target = randomDeepPoint(r); k.timer = 8 + 14*r(); k.depthT = -0.2 - 0.35*r(); } }
    let desired = Math.atan2(tx-k.x, tz-k.z);
    // bank avoidance: probe ahead left/right
    const probe = a => { const d = 0.5 + k.len; return pondDepth(k.x + Math.sin(a)*d, k.z + Math.cos(a)*d); };
    const ahead = probe(k.heading), left = probe(k.heading + 0.6), right = probe(k.heading - 0.6);
    if (ahead < 0.38){ desired = k.heading + (left > right ? 1.4 : -1.4); wantSpeed *= 0.7; }
    // separation
    for (const o of koi){ if (o === k) continue; const dx = k.x-o.x, dz = k.z-o.z, d = Math.hypot(dx,dz);
      if (d < 0.55 && d > 1e-3 && Math.abs(k.y-o.y) < 0.2){ const away = Math.atan2(dx,dz); desired += wrapAng(away - desired)*0.25*(1 - d/0.55); } }
    if (k.burst > 0){ k.burst -= dt; wantSpeed = 0.9; desired = k.fleeDir; }
    const turn = clamp(wrapAng(desired - k.heading), -1.6*dt, 1.6*dt);
    k.heading = wrapAng(k.heading + turn);
    k.speed = lerp(k.speed, wantSpeed, 1 - Math.exp(-dt*1.5));
    const nx = k.x + Math.sin(k.heading)*k.speed*dt, nz = k.z + Math.cos(k.heading)*k.speed*dt;
    if (pondDepth(nx, nz) > 0.22){ k.x = nx; k.z = nz; } else { k.heading = wrapAng(k.heading + 2.5*dt); }
    const floor = -pondDepth(k.x, k.z) + 0.1;
    const ny = clamp(lerp(k.y, wantY, 1 - Math.exp(-dt*0.8)), floor, -0.035);
    k.pitch = lerp(k.pitch, clamp((ny - k.y)/Math.max(dt,1e-3)/Math.max(k.speed,0.05), -0.5, 0.5), 1 - Math.exp(-dt*3));
    k.y = ny;
    k.amp = lerp(k.amp, 0.07 + 0.22*clamp(k.speed/0.9, 0, 1) + 0.25*Math.abs(turn)/Math.max(dt,1e-3)/1.6*0.3, 1 - Math.exp(-dt*3));
    k.phase += dt*(3.2 + k.speed*13);
    // a fish close under the surface leaves a faint wake
    if (k.y > -0.12 && r() < dt*6*k.speed) addDrop(k.x - Math.sin(k.heading)*k.len*0.4, k.z - Math.cos(k.heading)*k.len*0.4, 0.05, 0.012);
  }
  for (let i=pellets.length-1;i>=0;i--){ const p = pellets[i]; p.age += dt; if (p.eaten || p.age > 45) pellets.splice(i,1); }
}
function scareKoi(x, z){
  for (const k of koi){ const d = Math.hypot(k.x-x, k.z-z); if (d < 1.8){ k.burst = 0.9 + 0.5*Math.random(); k.fleeDir = Math.atan2(k.x-x, k.z-z); } }
}
function koiMatrix(k){
  // model matrix: translate, yaw (heading, 0 = +z), pitch, scale by length
  const s = k.len, ch = Math.cos(k.heading), sh = Math.sin(k.heading), cp = Math.cos(k.pitch), sp = Math.sin(-k.pitch);
  // columns: x axis, y axis, z axis
  const X = [ch, 0, -sh], Zf = [sh*cp, -sp, ch*cp], Y = v3.cross(Zf, X);
  return new Float32Array([X[0]*s,X[1]*s,X[2]*s,0, Y[0]*s,Y[1]*s,Y[2]*s,0, Zf[0]*s,Zf[1]*s,Zf[2]*s,0, k.x,k.y,k.z,1]);
}

/* ---------------- Particles: falling maple leaves, cherry petals, snow; koi food ---------------- */
const parts = [];
const PT = { LEAF:6, PETAL:7, SNOW:8, PELLET:9 };
function spawnParticles(dt, seasonW, camPos, windV){
  const r = Math.random;
  const emit = (n, fn) => { let k = n*dt; while (k > 0){ if (r() < k) fn(); k -= 1; } };
  const maples = TREES.filter(t => t.t === 'maple'), sakura = TREES.filter(t => t.t === 'sakura');
  const fromTree = (T, type) => { const g = terrainH(T.x, T.z), a = r()*TAU, d = Math.sqrt(r())*2.6*T.s;
    parts.push({ p:[T.x + Math.cos(a)*d, g + (2.2 + 1.8*r())*T.s, T.z + Math.sin(a)*d], v:[0,-0.3,0], axis: v3.norm([r()-0.5, r()-0.5, r()-0.5]), ang: r()*TAU, spin: 2 + 4*r(),
      size: type === PT.LEAF ? 0.075 + 0.03*r() : 0.03, type, state:0, life: 999, age:0, seed: r(), yaw: r()*TAU }); };
  if (parts.length < 900){
    emit(7*seasonW[2], () => fromTree(maples[Math.floor(r()*maples.length)], PT.LEAF));
    emit(12*seasonW[0], () => fromTree(sakura[Math.floor(r()*sakura.length)], PT.PETAL));
    emit(160*seasonW[3], () => { const a = r()*TAU, d = 2 + 26*Math.sqrt(r());
      parts.push({ p:[camPos[0] + Math.cos(a)*d, camPos[1] + 6 + 8*r(), camPos[2] + Math.sin(a)*d], v:[0,-0.7,0], axis:[0,1,0], ang:0, spin:0, size: 0.018 + 0.012*r(), type: PT.SNOW, state:0, life: 999, age:0, seed: r(), yaw:0 }); });
  }
}
function updateParticles(dt, windV, t){
  for (let i=parts.length-1;i>=0;i--){
    const q = parts[i]; q.age += dt;
    if (q.state === 0){
      const term = q.type === PT.SNOW ? -0.75 : q.type === PT.LEAF ? -0.85 : -0.55;
      q.v[1] = lerp(q.v[1], term, 1 - Math.exp(-dt*2));
      const fl = q.type === PT.SNOW ? 0.15 : 0.45;
      q.p[0] += (windV[0]*0.6 + Math.sin(t*1.7 + q.seed*40)*fl)*dt; q.p[2] += (windV[1]*0.6 + Math.cos(t*1.3 + q.seed*31)*fl)*dt; q.p[1] += q.v[1]*dt;
      q.ang += q.spin*dt;
      const g = terrainH(q.p[0], q.p[2]);
      if (g < -0.01 && q.p[1] <= 0.01){
        if (q.type === PT.SNOW){ parts.splice(i,1); continue; }
        q.state = 1; q.p[1] = 0.012; q.life = 35 + 25*Math.random(); q.age = 0; addDrop(q.p[0], q.p[2], 0.04, 0.012);
      } else if (q.p[1] <= g + 0.01){ q.state = 2; q.p[1] = g + 0.012; q.life = q.type === PT.SNOW ? 2.5 : 14; q.age = 0; }
    } else if (q.state === 1){
      const nx = q.p[0] + (windV[0]*0.05 + 0.02*Math.sin(t*0.3 + q.seed*9))*dt, nz = q.p[2] + (windV[1]*0.05 + 0.02*Math.cos(t*0.27 + q.seed*7))*dt;
      if (terrainH(nx, nz) < -0.03){ q.p[0] = nx; q.p[2] = nz; }
      if (q.age > q.life){ parts.splice(i,1); continue; }
    } else if (q.age > q.life){ parts.splice(i,1); continue; }
    if (Math.abs(q.p[0]) > 80 || Math.abs(q.p[2]) > 80) parts.splice(i,1);
  }
}
// dynamic cards in the foliage vertex format
function buildParticleVerts(out){
  let n = 0;
  const push = (c, t1, t2, species, float, fade, ln) => {
    for (const [u,v] of [[0,0],[1,0],[1,1],[0,1]]){
      const o = n*16;
      out[o] = c[0] + t1[0]*(u-0.5) + t2[0]*(v-0.5); out[o+1] = c[1] + t1[1]*(u-0.5) + t2[1]*(v-0.5); out[o+2] = c[2] + t1[2]*(u-0.5) + t2[2]*(v-0.5);
      out[o+3] = ln[0]; out[o+4] = ln[1]; out[o+5] = ln[2]; out[o+6] = fade; out[o+7] = 0.5; out[o+8] = 0; out[o+9] = 1;
      out[o+10] = u; out[o+11] = v; out[o+12] = species; out[o+13] = float ? -1 : 0; out[o+14] = 0.37; out[o+15] = 0; n++;
    }
  };
  for (const q of parts){
    if (n > out.length/16 - 8) break;
    const fade = q.state === 0 ? 1 : clamp((q.life - q.age)/3, 0, 1);
    let t1, t2, ln;
    if (q.state === 0 && q.type !== PT.SNOW){ const b = perp(q.axis); t1 = v3.mul(rotAxis(b, q.axis, q.ang), q.size); t2 = v3.mul(v3.cross(q.axis, v3.norm(t1)), q.size); ln = v3.norm(v3.cross(t1,t2)); if (ln[1] < 0) ln = v3.mul(ln,-1); }
    else if (q.type === PT.SNOW && q.state === 0){ t1 = [q.size,0,0]; t2 = [0,q.size,0]; ln = [0,1,0]; }
    else { t1 = [Math.cos(q.yaw)*q.size, 0, Math.sin(q.yaw)*q.size]; t2 = [-Math.sin(q.yaw)*q.size, 0, Math.cos(q.yaw)*q.size]; ln = [0,1,0]; }
    push(q.p, t1, t2, q.type, q.state === 1, fade, ln);
    if (q.type === PT.SNOW && q.state === 0) push(q.p, [0,0,q.size], [0,q.size,0], q.type, false, fade, ln);
  }
  for (const p of pellets){ if (n > out.length/16 - 4) break; const s = 0.022; push([p.x, 0.012, p.z], [s,0,0], [0,0,s], PT.PELLET, true, 1, [0,1,0]); }
  return n;
}
