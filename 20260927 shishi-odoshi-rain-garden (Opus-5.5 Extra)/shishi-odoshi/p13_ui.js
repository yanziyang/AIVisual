/* ---------------- Camera: orbit with viewpoints, kept inside the fence ---------------- */
const camF = (yaw, pitch) => [Math.sin(yaw)*Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw)*Math.cos(pitch)];
const wrapAng = a => Math.atan2(Math.sin(a), Math.cos(a));
const cam = { yaw:-0.36, pitch:-0.47, dist:5.7, target:[0.52, 0.5, -0.12], pos:[0,2,5], dof:0, anim:null, auto:false, vy:0, vp:0 };
const VIEWS = {
  garden:  { label:'Garden',         target:[0.52, 0.5, -0.12],   yaw:-0.36, pitch:-0.47, dist:5.7, dof:0 },
  shishi:  { label:'Shishi-odoshi',  target:[0.26, 0.72, -0.34],  yaw:0.95,  pitch:0.06,  dist:1.65, dof:0.9 },
  spout:   { label:'Spout',          target:[SHISHI.mouthRest[0] + 0.05, SHISHI.mouthRest[1] + 0.13, SHISHI.mouthRest[2]], yaw:-0.62, pitch:-0.12, dist:1.25, dof:0.8 },
  pond:    { label:'Water’s edge',   target:[0.85, 0.12, 0.9],   yaw:-0.14, pitch:-0.2,  dist:2.7, dof:0.35 },
  lantern: { label:'Lantern',        target:[-1.86, 1.05, -2.3],  yaw:0.42,  pitch:-0.16, dist:3.1, dof:0.3 },
  above:   { label:'Overhead',       target:[0.1, 0.2, 0.7],      yaw:0.0,   pitch:-1.2,  dist:7.8, dof:0 },
};
// pull the camera in along its ray so it never leaves the fenced yard or sinks into the ground
function fitDist(target, F, dist){
  const lo = [YARD.x0 + 0.22, 0, YARD.z0 + 0.22], hi = [YARD.x1 - 0.22, 5.2, YARD.z1 - 0.22];
  let tmax = dist;
  for (let i=0;i<3;i++){ const d = -F[i]; if (Math.abs(d) < 1e-6) continue; const tb = ((d > 0 ? hi[i] : lo[i]) - target[i])/d; if (tb > 0) tmax = Math.min(tmax, tb); }
  let t = tmax;
  for (let k=0;k<24;k++){ const p = v3.madd(target, F, -t); if (p[1] > Math.max(terrainH(p[0], p[2]), 0) + 0.1) break; t *= 0.9; }
  return Math.max(0.25, t);
}
function orbitPos(){ const F = camF(cam.yaw, cam.pitch); cam.pos = v3.madd(cam.target, F, -fitDist(cam.target, F, cam.dist)); }
function goView(name, instant=false){
  const V = VIEWS[name]; if (!V) return;
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === name));
  const to = { target: V.target.slice(), yaw: V.yaw, pitch: V.pitch, dist: V.dist, dof: V.dof };
  if (instant){ Object.assign(cam, to); cam.anim = null; orbitPos(); return; }
  cam.anim = { t:0, dur:1.6, from:{ target: cam.target.slice(), yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist, dof: cam.dof }, to };
}
function updateCamera(dt){
  if (cam.anim){
    const A = cam.anim; A.t += dt/A.dur; const e = A.t >= 1 ? 1 : 0.5 - 0.5*Math.cos(Math.PI*A.t);
    cam.target = v3.lerp(A.from.target, A.to.target, e); cam.yaw = A.from.yaw + wrapAng(A.to.yaw - A.from.yaw)*e;
    cam.pitch = lerp(A.from.pitch, A.to.pitch, e); cam.dist = Math.exp(lerp(Math.log(A.from.dist), Math.log(A.to.dist), e)); cam.dof = lerp(A.from.dof, A.to.dof, e);
    if (A.t >= 1) cam.anim = null;
  } else if (!drag){ cam.yaw += cam.vy; cam.pitch += cam.vp; cam.vy *= 0.88; cam.vp *= 0.88; }
  if (cam.auto && !drag && !cam.anim) cam.yaw += dt*0.04;
  cam.pitch = clamp(cam.pitch, -1.45, 0.5);
  orbitPos();
}
function camBasis(){ const f = camF(cam.yaw, cam.pitch), r = [Math.cos(cam.yaw), 0, Math.sin(cam.yaw)], u = v3.cross(r, f); return { f, r, u, pos: cam.pos }; }

/* ---------------- Input ---------------- */
let drag = null; const pointers = new Map();
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]);
  cam.anim = null;
  drag = { x:e.clientX, y:e.clientY, x0:e.clientX, y0:e.clientY, t:performance.now(), pan: e.button === 2 || e.shiftKey, pinch: pointers.size === 2 ? pinchDist() : 0 };
  hideHint();
});
function pinchDist(){ const p = [...pointers.values()]; return Math.hypot(p[0][0]-p[1][0], p[0][1]-p[1][1]); }
canvas.addEventListener('pointermove', e => {
  if (!drag || !pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (pointers.size === 2){ const d = pinchDist(); if (drag.pinch) cam.dist = clamp(cam.dist*drag.pinch/d, 0.35, 11); drag.pinch = d; return; }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
  const k = 1.2/Math.min(innerWidth, innerHeight);
  if (drag.pan){
    const r = [Math.cos(cam.yaw), 0, Math.sin(cam.yaw)], fh = [Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)], s = cam.dist*k*0.8;
    cam.target = v3.add(cam.target, v3.add(v3.mul(r, -dx*s), v3.mul(fh, dy*s)));
    cam.target[0] = clamp(cam.target[0], YARD.x0 + 0.4, YARD.x1 - 0.4); cam.target[2] = clamp(cam.target[2], YARD.z0 + 0.4, YARD.z1 - 0.4);
    cam.target[1] = Math.max(terrainH(cam.target[0], cam.target[2]), 0) + 0.35;
    return;
  }
  cam.yaw -= dx*k*1.3; cam.pitch -= dy*k; cam.vy = -dx*k*1.3; cam.vp = -dy*k;
});
function endPointer(e){
  pointers.delete(e.pointerId);
  if (drag && pointers.size === 0){
    if (Math.hypot(e.clientX-drag.x0, e.clientY-drag.y0) < 8 && performance.now()-drag.t < 350) tapAt(e.clientX, e.clientY);
    drag = null;
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', e => { e.preventDefault(); cam.anim = null; cam.dist = clamp(cam.dist*Math.exp(e.deltaY*0.0012), 0.35, 11); }, { passive:false });
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  const vk = Object.keys(VIEWS)[parseInt(k)-1]; if (vk) goView(vk);
  if (k === 't') tipNow();
  if (k === 'l') dropLeaves(6);
  if (k === 'm') setSound(!AUD.on);
  if (k === 'escape') closeAbout();
});

// screen tap -> the tube (tip it), the lantern (light it), or the pond (ripples, leaves drift away)
function screenRay(sx, sy){
  const B = camBasis(), nx = (sx/innerWidth)*2 - 1, ny = 1 - (sy/innerHeight)*2, tf = Math.tan(FOV/2), asp = innerWidth/innerHeight;
  return v3.norm([0,1,2].map(i => B.f[i] + nx*asp*tf*B.r[i] + ny*tf*B.u[i]));
}
function rayPointDist(o, d, p){ const w = v3.sub(p, o), t = Math.max(0, v3.dot(w, d)); return [v3.len(v3.sub(w, v3.mul(d, t))), t]; }
function tapAt(sx, sy){
  const d = screenRay(sx, sy), o = cam.pos;
  // tube: nearest approach of the ray to points along the axis
  let best = 1e9, bt = 0;
  for (let s = SHISHI.back; s <= SHISHI.mouth; s += 0.02){ const [dd, t] = rayPointDist(o, d, SHISHI.at(s, SH.th)); if (dd < best){ best = dd; bt = t; } }
  // lantern: a vertical cylinder
  let lt = 1e9;
  for (let y = 0.3; y < 1.8; y += 0.05){ const [dd, t] = rayPointDist(o, d, [LANTERN.x, y, LANTERN.z]); if (dd < 0.22 && t < lt) lt = t; }
  // ground / water
  let hit = null, ht = 1e9;
  for (let t=0.05; t<30; t += 0.01 + t*0.01){ const p = v3.madd(o, d, t), g = terrainH(p[0], p[2]); if (p[1] <= Math.max(g, 0)){ hit = g < 0 ? v3.madd(o, d, d[1] < 0 ? -o[1]/d[1] : t) : p; hit.water = g < 0; ht = t; break; } }
  if (best < SHISHI.R*1.8 && bt < ht + 0.2 && bt < lt + 0.2){ tipNow(); return; }
  if (lt < 1e8 && lt < ht + 0.1){ cycleLantern(); return; }
  if (hit && hit.water){ addDrop(hit[0], hit[2], 0.03, 0.006); pushLeaves(hit[0], hit[2], 0.35); splashAt([hit[0], 0, hit[2]], 0.5, 6); }
}
function tipNow(){
  // add water all at once, or nudge the mouth down if it is already full enough to go
  if (SH.th > SHISHI.rest - 0.05){ SH.V = Math.max(SH.V, SHISHI.tipVolume*1.12); SH.om -= 0.4; SH.manual = true; }
}

/* ---------------- Panel ---------------- */
const $ = id => document.getElementById(id);
const $hint = $('hint'); let hintT = setTimeout(hideHint, 10000);
function hideHint(){ clearTimeout(hintT); $hint.classList.add('off'); }
const fmtHour = h => { const hh = Math.floor(h), mm = Math.round((h - hh)*60); return `${String(hh).padStart(2,'0')}:${String(mm === 60 ? 0 : mm).padStart(2,'0')}`; };
const rainWord = r => r < 0.05 ? 'clearing' : r < 0.3 ? 'drizzle' : r < 0.7 ? 'steady rain' : 'downpour';
function setHour(h){ S.hour = h; $('time').value = h; $('timeLbl').textContent = fmtHour(h); }
function setRain(r){ S.rainT = r; $('rain').value = r; $('rainLbl').textContent = rainWord(r); }
function setFlow(f){ SH.flow = f; $('flow').value = f; updateFlowLbl(); }
function updateFlowLbl(){ const fillT = SHISHI.tipVolume/Math.max(SH.flow, 1e-3); $('flowLbl').textContent = SH.flow < 0.005 ? 'off' : `${(SH.flow*60).toFixed(1)} L/min · ~${fillT < 60 ? fillT.toFixed(0) + ' s' : '1 min+'}`; }
function setWind(w){ S.wind = w; $('wind').value = w; }
function cycleLantern(){ const order = ['auto','on','off']; S.lanternMode = order[(order.indexOf(S.lanternMode) + 1)%3]; $('lanternBtn').textContent = 'Lantern: ' + S.lanternMode; $('lanternBtn').classList.toggle('on', S.lanternMode === 'on'); }
function setSound(on){
  const ok = audioSet(on);
  $('soundBtn').classList.toggle('on', ok && on); $('soundBtn').innerHTML = ok && on ? '<span class="ico">♪</span> Sound on' : '<span class="ico">♪</span> Turn on sound';
  if (!ok && on) $('soundBtn').textContent = 'No Web Audio';
}
$('time').addEventListener('input', e => setHour(parseFloat(e.target.value)));
$('rain').addEventListener('input', e => setRain(parseFloat(e.target.value)));
$('flow').addEventListener('input', e => setFlow(parseFloat(e.target.value)));
$('wind').addEventListener('input', e => setWind(parseFloat(e.target.value)));
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => goView(b.dataset.view)));
$('tipBtn').addEventListener('click', tipNow);
$('leafBtn').addEventListener('click', () => dropLeaves(6));
$('lanternBtn').addEventListener('click', cycleLantern);
$('autoBtn').addEventListener('click', () => { cam.auto = !cam.auto; $('autoBtn').classList.toggle('on', cam.auto); });
$('soundBtn').addEventListener('click', () => setSound(!AUD.on));
$('panelToggle').addEventListener('click', () => document.body.classList.toggle('panel-closed'));
$('aboutBtn').addEventListener('click', openAbout);
$('aboutClose').addEventListener('click', closeAbout);
function openAbout(){ $('about').hidden = false; fillStats(); }
function closeAbout(){ $('about').hidden = true; }
$('about').addEventListener('click', e => { if (e.target.id === 'about') closeAbout(); });
document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.tabpane').forEach(p => p.hidden = p.id !== 'tab-' + b.dataset.tab);
}));
function fillStats(){
  const el = $('stats'); if (!el) return;
  const rows = [
    ['Static triangles', STATS.staticTris.toLocaleString()], ['  of which terrain', STATS.terrainTris.toLocaleString()],
    ['Fence culms', STATS.culms], ['Fern and leaf triangles', STATS.fernTris.toLocaleString()], ['Grass tufts', `${STATS.tufts} (${STATS.thinTris.toLocaleString()} triangles)`],
    ['Tree leaf cards', STATS.treeCards.toLocaleString()], ['Bamboo grove culms', STATS.grove], ['Shishi-odoshi tube', STATS.tubeTris.toLocaleString() + ' triangles'],
    ['Generation time', STATS.buildMs + ' ms'], ['Shader compile', STATS.shaderMs + ' ms'], ['Render size', `${W} × ${H} (quality ${quality.toFixed(2)})`],
    ['Ripple grid', `${RIP.nx} × ${RIP.nz} over ${RIP.sx} × ${RIP.sz} m`], ['Height field', `${HF.n}² over ${HF.sx.toFixed(1)} × ${HF.sz.toFixed(1)} m`],
    ['Clacks so far', SH.clacks], ['Last cycle', SH.cycle ? SH.cycle.toFixed(1) + ' s' : '—'],
  ];
  el.innerHTML = rows.map(([a,b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join('');
}
const $fill = $('fillBar'), $clacks = $('clackCount'), $cyc = $('cycleLbl'), $gauge = $('gauge');
function updateGauge(){
  $fill.style.width = (clamp(SH.V/SHISHI.tipVolume, 0, 1)*100).toFixed(1) + '%';
  $clacks.textContent = SH.clacks;
  $cyc.textContent = SH.cycle ? SH.cycle.toFixed(1) + ' s cycle' : 'filling…';
  $gauge.classList.toggle('pour', SH.pour > 0.05);
}

/* ---------------- Loop ---------------- */
if (innerWidth < 720) document.body.classList.add('panel-closed');
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fail('The GPU context was lost (the graphics driver reset or ran out of memory). Reload the page to restart the garden.'); });
// URL options for screenshots and testing: ?hour=19.5&rain=0.9&view=shishi&flow=0.1&wind=0.5&debug
setHour(Q.has('hour') ? parseFloat(Q.get('hour')) : S.hour);
setRain(Q.has('rain') ? parseFloat(Q.get('rain')) : S.rainT); S.rain = S.rainT; S.wet = clamp(S.rain*2, 0, 1);
setFlow(Q.has('flow') ? parseFloat(Q.get('flow')) : SH.flow);
setWind(Q.has('wind') ? parseFloat(Q.get('wind')) : S.wind);
if (Q.has('lantern')){ S.lanternMode = Q.get('lantern'); $('lanternBtn').textContent = 'Lantern: ' + S.lanternMode; }
goView(Q.get('view') || 'garden', true);
if (Q.has('fill')) SH.V = parseFloat(Q.get('fill'));
alloc();
atmosphere(); LAMPS.slice(0, 4).forEach((l,i) => lampData.set(l, i*4));
heightFieldPass();
const $dbg = $('dbg'); if (DEBUG) $dbg.hidden = false;
let last = performance.now(), tSim = 0, ripAcc = 0, phyAcc = 0, frames = 0, ftAvg = 16, started = false;
function frame(now){
  const dt = Math.min(0.05, (now - last)/1000); last = now;
  tSim += dt;
  const t = FIXED_T !== null ? FIXED_T : tSim;
  if (!pebReady){ requestAnimationFrame(frame); return; }
  if (!started){ started = true; if (DEBUG) console.log('first frame at', Math.round(performance.now()), 'ms'); $('loading').classList.add('off'); setTimeout(() => $('loading').remove(), 900); }
  S.rain = lerp(S.rain, S.rainT, 1 - Math.exp(-dt*0.8)); S.time = t;
  S.wet = lerp(S.wet, clamp(S.rain*2.5, 0, 1), 1 - Math.exp(-dt*(S.rain*2.5 > S.wet ? 0.5 : 0.04)));
  atmosphere();
  updateCamera(dt);
  // the shishi-odoshi: fixed 240 Hz steps; the jet is re-traced every frame
  updateStreams(dt);
  phyAcc += dt; let n = 0;
  while (phyAcc >= 1/240 && n < 24){ const k = SH.impacts.length; stepShishi(1/240, SH.inflow); phyAcc -= 1/240; n++;
    if (SH.impacts.length > k){ const v = SH.impacts[SH.impacts.length - 1], B = camBasis(), rel = v3.sub(SHISHI.backRest, B.pos), dd = v3.len(rel);
      playClack(v, v3.dot(v3.mul(rel, 1/dd), B.r), dd);
      if (v > 0.5) for (let i=0;i<Math.round(v*5);i++) spawnDrop(SHISHI.at(SHISHI.back + 0.05 + Math.random()*0.3, SH.th, SHISHI.R), [(Math.random()-0.5)*0.6, 0.4 + Math.random()*0.8*v, (Math.random()-0.5)*0.6], 0.8, 0.0025); } }
  tubeM = tubeMatrix(SH.th);
  // where the water lands: rings in the pond, droplets off stone and bamboo
  if (FX.jet){ const e = FX.jet.end;
    if (FX.jet.hit === 'water'){ if (Math.random() < dt*40) addDrop(e[0], e[2], 0.012, 0.0018 + 0.01*SH.flow); if (Math.random() < dt*25) splashAt(e, 0.35, 1, 0.8); }
    else if (FX.jet.hit === 'tube' || FX.jet.hit === 'ground'){ if (Math.random() < dt*30) splashAt(e, 0.45, 1); }
    else if (FX.jet.hit === 'mouth' && SH.V > 0.3 && Math.random() < dt*6) splashAt(e, 0.2, 1, 0.5); }
  if (FX.pourJet){ const e = FX.pourJet.end, k = Math.sqrt(SH.pour);
    if (FX.pourJet.hit === 'water'){ addDrop(e[0] + (Math.random()-0.5)*0.03, e[2] + (Math.random()-0.5)*0.03, 0.02 + 0.03*k, 0.003 + 0.012*k); pushLeaves(e[0], e[2], dt*1.5*k); }
    if (Math.random() < dt*60*k) splashAt(e, 0.6 + 0.6*k, 2); }
  updateDrops(dt);
  updateLeaves(dt, t, S.wind);
  // rain on the pond: drops for the ripple simulation (the smallest rings are drawn procedurally by the water shader)
  if (S.rain > 0.02){ let m = S.rain*70*dt; while (m > 0){ if (Math.random() < m){ const x = RIP.x0 + Math.random()*RIP.sx, z = RIP.z0 + Math.random()*RIP.sz; if (pondSD(x, z) < 0) addDrop(x, z, 0.008 + 0.008*Math.random(), 0.0006 + 0.001*Math.random()); } m -= 1; } }
  // Clearwater: spectrum -> FFT -> ripples -> caustics
  runFFT(t*0.9, 0.006 + 0.1*S.wind*S.wind + 0.015*S.rain);
  ripAcc += dt; let steps = 0;
  while (ripAcc >= 1/120 && steps < 5){ stepRipples(); ripAcc -= 1/120; steps++; }
  if (ripAcc > 0.1) ripAcc = 0;
  rippleNormals();
  if (S.sunCol[0] > 0.05){ const sunC = S.sun[1] > 0.12 ? S.sun : v3.norm([S.sun[0], 0.12, S.sun[2]]); renderCaustics(sunC); }
  const B = camBasis(), pxK = 2*Math.tan(FOV/2)/H;
  buildFxVerts(dynFx, B.pos, p => v3.len(v3.sub(p, B.pos))*pxK);
  buildLeafVerts(dynLeaf);
  renderFrame(B, t);
  audioUpdate(dt, B);
  if (frames % 5 === 0) updateGauge();
  // adaptive resolution (Clearwater)
  if (FIXED_T === null){
    ftAvg = ftAvg*0.95 + (dt*1000)*0.05; frames++;
    if (frames > 90 && !Q.has('q')){
      if (ftAvg > 26 && quality > 0.4){ quality = Math.max(0.4, quality*0.88); alloc(); frames = 1; }
      else if (ftAvg < 15 && quality < 1.0){ quality = Math.min(1.0, quality*1.06); alloc(); frames = 1; }
    }
    if (DEBUG && frames % 15 === 0) $dbg.textContent = `${(1000/ftAvg).toFixed(0)} fps · ${W}×${H} · q ${quality.toFixed(2)} · V ${SH.V.toFixed(2)} L · θ ${(SH.th*180/Math.PI).toFixed(1)}° · clacks ${SH.clacks}`;
  } else frames++;
  requestAnimationFrame(frame);
}
if (Q.has('q')){ quality = parseFloat(Q.get('q')); alloc(); }
requestAnimationFrame(frame);
document.addEventListener('visibilitychange', () => { if (AUD.ctx && AUD.on){ if (document.hidden) AUD.ctx.suspend(); else AUD.ctx.resume(); } });
// handle for the console and automated screenshots
window.garden = { goView, setHour, setRain, setFlow, setWind, tipNow, dropLeaves, cycleLantern, setSound, tapAt, project, cam, S, SH, FX, LEAVES, STATS, VIEWS, dynFx, DROPS, AUD };
// world -> CSS pixel position (used by the automated tap tests)
function project(p){ if (!viewVP) return null; const m = viewVP, x = m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], y = m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], w = m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15]; return [(x/w*0.5+0.5)*innerWidth, (0.5-y/w*0.5)*innerHeight]; }
