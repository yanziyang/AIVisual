/* ---------------- Camera: orbit, look-around viewpoints, stroll ---------------- */
const camF = (yaw, pitch) => [Math.sin(yaw)*Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw)*Math.cos(pitch)];
const cam = { mode:'orbit', yaw:0.12, pitch:-0.33, dist:36, target:[-1.5, 0.6, -3.5], pos:[0,5,30], anim:null, follow:null, auto:false };
function yawPitchTo(from, to){ const d = v3.norm(v3.sub(to, from)); return [Math.atan2(d[0], -d[2]), Math.asin(clamp(d[1], -1, 1))]; }
function bridgeTop(){ const { a, b, rise } = BRIDGE; const m = [(a[0]+b[0])/2, (a[1]+b[1])/2]; return [m[0], lerp(terrainH(...a), terrainH(...b), 0.5) + 0.12 + rise, m[1]]; }
const VIEWS = {
  overview:  { label:'Overview',        mode:'orbit', target:[-1.5, 0.6, -3.5], yaw:0.12, pitch:-0.33, dist:36 },
  lantern:   { label:'Lantern shore',   mode:'look',  pos:[0.2, 1.7, 13.4], look:[-3.2, 1.1, -15] },
  pavilion:  { label:'From the pavilion', mode:'look', pos:[PAV.x+0.9, PAV.floor+1.2, PAV.z+1.2], look:[10, 0.4, 6] },
  bridge:    { label:'On the bridge',   mode:'look',  pos:() => v3.add(bridgeTop(), [0, 1.55, 0]), look:[-6, 0.5, -8] },
  waterline: { label:'Waterline',       mode:'look',  pos:[6.2, 0.42, 5.0], look:[-2.4, 1.2, -15.6] },
  waterfall: { label:'Waterfall',       mode:'look',  pos:[-12.6, 1.6, -4.8], look:[-16.8, 0.9, -10.2] },
  koi:       { label:'Follow a koi',    mode:'follow' },
};
function clampCam(){
  const g = Math.max(terrainH(cam.pos[0], cam.pos[2]), 0);
  const minY = g + (cam.mode === 'walk' ? 1.55 : 0.3);
  if (cam.pos[1] < minY) cam.pos[1] = minY;
  cam.pitch = clamp(cam.pitch, -1.45, 0.6);
}
function orbitPos(){ cam.pos = v3.madd(cam.target, camF(cam.yaw, cam.pitch), -cam.dist); }
function goView(name, instant=false){
  const V = VIEWS[name]; if (!V) return;
  let to;
  if (V.mode === 'follow'){
    const k = koi[Math.floor(Math.random()*koi.length)]; cam.follow = k;
    const tgt = [k.x, 0, k.z], yaw = k.heading + Math.PI*0.75, pitch = -0.9, dist = 3.4;
    to = { pos: v3.madd(tgt, camF(yaw, pitch), -dist), yaw, pitch, mode:'follow', target: tgt, dist };
  } else if (V.mode === 'orbit'){
    to = { pos: v3.madd(V.target, camF(V.yaw, V.pitch), -V.dist), yaw: V.yaw, pitch: V.pitch, mode:'orbit', target: V.target.slice(), dist: V.dist };
    cam.follow = null;
  } else {
    const pos = typeof V.pos === 'function' ? V.pos() : V.pos.slice(); const [yaw, pitch] = yawPitchTo(pos, V.look);
    to = { pos, yaw, pitch, mode:'look' }; cam.follow = null;
  }
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === name));
  setModeButtons(to.mode === 'walk' ? 'walk' : 'orbit');
  if (instant){ Object.assign(cam, to); cam.pos = to.pos.slice(); cam.anim = null; return; }
  cam.anim = { t:0, dur:1.9, from:{ pos: cam.pos.slice(), yaw: cam.yaw, pitch: cam.pitch }, to };
}
function updateCamera(dt, t){
  if (cam.anim){
    const A = cam.anim; A.t += dt/A.dur; const e = A.t >= 1 ? 1 : 0.5 - 0.5*Math.cos(Math.PI*A.t);
    // arc gently upward between distant viewpoints so the move reads as a flight, not a slide through things
    const lift = Math.sin(Math.PI*e)*Math.min(6, v3.len(v3.sub(A.to.pos, A.from.pos))*0.18);
    cam.pos = v3.add(v3.lerp(A.from.pos, A.to.pos, e), [0, lift, 0]);
    cam.yaw = A.from.yaw + wrapAng(A.to.yaw - A.from.yaw)*e; cam.pitch = lerp(A.from.pitch, A.to.pitch, e);
    if (A.t >= 1){ cam.mode = A.to.mode; if (A.to.target){ cam.target = A.to.target; cam.dist = A.to.dist; } cam.anim = null; }
    return;
  }
  if (!drag){ cam.yaw += cam.vy; cam.pitch += cam.vp; cam.vy *= 0.88; cam.vp *= 0.88; }
  if (cam.auto && !drag) cam.yaw += dt*0.035;
  if (cam.mode === 'follow' && cam.follow){
    const k = cam.follow; cam.target = v3.lerp(cam.target, [k.x, k.y*0.5, k.z], 1 - Math.exp(-dt*2.5)); orbitPos();
  } else if (cam.mode === 'orbit') orbitPos();
  else if (cam.mode === 'walk'){
    const f = camF(cam.yaw, 0), r = [Math.cos(cam.yaw), 0, Math.sin(cam.yaw)];
    let mv = [0,0,0]; const sp = (keys.has('shift') ? 3.2 : 1.4)*dt;
    if (keys.has('w') || keys.has('arrowup')) mv = v3.madd(mv, f, sp);
    if (keys.has('s') || keys.has('arrowdown')) mv = v3.madd(mv, f, -sp);
    if (keys.has('a') || keys.has('arrowleft')) mv = v3.madd(mv, r, -sp);
    if (keys.has('d') || keys.has('arrowright')) mv = v3.madd(mv, r, sp);
    if (holdMove) mv = v3.madd(mv, f, 1.4*dt);
    const nx = cam.pos[0] + mv[0], nz = cam.pos[2] + mv[2], g = walkGround(nx, nz);
    if (g !== null){ cam.pos[0] = nx; cam.pos[2] = nz; }
    const gy = walkGround(cam.pos[0], cam.pos[2]) ?? cam.pos[1] - 1.6;
    cam.pos[1] = lerp(cam.pos[1], gy + 1.6 + 0.02*Math.sin(t*6)*v3.len(mv)/Math.max(dt,1e-3)/1.4, 1 - Math.exp(-dt*10));
  }
  if (cam.mode !== 'look' && cam.mode !== 'walk') clampCam(); else cam.pitch = clamp(cam.pitch, -1.45, 0.9);
}
// where a stroller can stand: lawn, the bridge deck, the pavilion floor and the stepping stones; not the pond
function walkGround(x, z){
  const { a, b, w, rise } = BRIDGE, L = Math.hypot(b[0]-a[0], b[1]-a[1]);
  const s = ((x-a[0])*(b[0]-a[0]) + (z-a[1])*(b[1]-a[1]))/(L*L), off = Math.abs(((x-a[0])*(b[1]-a[1]) - (z-a[1])*(b[0]-a[0]))/L);
  if (s > -0.02 && s < 1.02 && off < w/2 - 0.15) return lerp(terrainH(...a)+0.12, terrainH(...b)+0.12, clamp(s,0,1)) + rise*Math.pow(Math.sin(Math.PI*clamp(s,0,1)), 0.85);
  if (Math.abs(x-PAV.x) < PAV.hx+0.2 && Math.abs(z-PAV.z) < PAV.hz+0.1) return PAV.floor;
  const St = STEPPING;
  for (let k=0;k<St.n;k++){ const t = k/(St.n-1); if (Math.hypot(x - lerp(St.a[0], St.b[0], t), z - lerp(St.a[1], St.b[1], t)) < 0.62) return 0.12; }
  const g = terrainH(x, z);
  return g > 0.04 ? g : null;
}
function camBasis(){
  const f = camF(cam.yaw, cam.pitch), r = [Math.cos(cam.yaw), 0, Math.sin(cam.yaw)], u = v3.cross(r, f);
  return { f, r, u, pos: cam.pos };
}

/* ---------------- Input ---------------- */
let drag = null, holdMove = false; const keys = new Set(), pointers = new Map();
cam.vy = 0; cam.vp = 0;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (cam.anim){ cam.anim = null; }
  drag = { x:e.clientX, y:e.clientY, x0:e.clientX, y0:e.clientY, t:performance.now(), pan: e.button === 2 || e.shiftKey, pinch: pointers.size === 2 ? pinchDist() : 0 };
  if (cam.mode === 'follow'){ cam.mode = 'orbit'; cam.follow = null; }
  if (cam.mode === 'walk' && e.pointerType === 'touch') holdTimer = setTimeout(() => holdMove = true, 380);
  hideHint();
});
let holdTimer = 0;
function pinchDist(){ const p = [...pointers.values()]; return Math.hypot(p[0][0]-p[1][0], p[0][1]-p[1][1]); }
canvas.addEventListener('pointermove', e => {
  if (!drag || !pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (pointers.size === 2){
    const d = pinchDist(); if (drag.pinch){ const k = drag.pinch/d; if (cam.mode === 'orbit') cam.dist = clamp(cam.dist*k, 2.5, 95); else cam.pos = v3.madd(cam.pos, camF(cam.yaw, cam.pitch), (d - drag.pinch)*0.02); } drag.pinch = d; return;
  }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
  if (Math.hypot(e.clientX-drag.x0, e.clientY-drag.y0) > 10){ clearTimeout(holdTimer); }
  const k = 1.25/Math.min(innerWidth, innerHeight);
  if (drag.pan && cam.mode === 'orbit'){
    const r = [Math.cos(cam.yaw), 0, Math.sin(cam.yaw)], fh = [Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)], s = cam.dist*k*0.8;
    cam.target = v3.add(cam.target, v3.add(v3.mul(r, -dx*s), v3.mul(fh, dy*s)));
    cam.target[0] = clamp(cam.target[0], -40, 40); cam.target[2] = clamp(cam.target[2], -40, 40); cam.target[1] = Math.max(terrainH(cam.target[0], cam.target[2]), 0) + 0.4;
    return;
  }
  if (cam.mode === 'orbit'){ cam.yaw -= dx*k*1.3; cam.pitch -= dy*k; cam.vy = -dx*k*1.3; cam.vp = -dy*k; }
  else { cam.yaw -= dx*k; cam.pitch += dy*k; cam.vy = -dx*k; cam.vp = dy*k; }
});
function endPointer(e){
  pointers.delete(e.pointerId); clearTimeout(holdTimer); holdMove = false;
  if (drag && pointers.size === 0){
    if (Math.hypot(e.clientX-drag.x0, e.clientY-drag.y0) < 8 && performance.now()-drag.t < 350) tapAt(e.clientX, e.clientY);
    drag = null;
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', e => {
  e.preventDefault(); if (cam.anim) cam.anim = null;
  if (cam.mode === 'follow'){ cam.dist = clamp(cam.dist*Math.exp(e.deltaY*0.0012), 1.2, 20); return; }
  if (cam.mode === 'orbit') cam.dist = clamp(cam.dist*Math.exp(e.deltaY*0.0012), 2.5, 95);
  else { const f = camF(cam.yaw, cam.mode === 'walk' ? 0 : cam.pitch); const np = v3.madd(cam.pos, f, -e.deltaY*0.006);
    if (cam.mode === 'walk'){ if (walkGround(np[0], np[2]) !== null) cam.pos = np; } else { cam.pos = np; clampCam(); } }
}, { passive:false });
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase(); keys.add(k); if (e.shiftKey) keys.add('shift');
  const vk = Object.keys(VIEWS)[parseInt(k)-1]; if (vk) goView(vk);
  if (k === 'f') setFeed(!feedMode);
  if (k === 'r') setRain(S.rainT < 0.5);
  if (k === 'escape') closeAbout();
  if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
});
addEventListener('keyup', e => { keys.delete(e.key.toLowerCase()); if (!e.shiftKey) keys.delete('shift'); });

// screen tap -> march the view ray over the terrain -> ripple, koi food or a startled koi
function screenRay(sx, sy){
  const B = camBasis(), nx = (sx/innerWidth)*2 - 1, ny = 1 - (sy/innerHeight)*2, tf = Math.tan(FOV/2), asp = innerWidth/innerHeight;
  return v3.norm([0,1,2].map(i => B.f[i] + nx*asp*tf*B.r[i] + ny*tf*B.u[i]));
}
function pickWater(sx, sy){
  const d = screenRay(sx, sy), o = cam.pos;
  for (let t=0.3; t<120; t += 0.05 + t*0.012){
    const p = v3.madd(o, d, t), g = terrainH(p[0], p[2]);
    if (p[1] <= Math.max(g, 0)){
      if (g > -0.02) return null;
      const tw = d[1] < 0 ? -o[1]/d[1] : t; const w = v3.madd(o, d, tw); return [w[0], w[2]];
    }
  }
  return null;
}
let feedMode = false;
function tapAt(sx, sy){
  const w = pickWater(sx, sy); if (!w) return;
  addDrop(w[0], w[1], 0.14, 0.09);
  if (feedMode){ for (let i=0;i<4;i++) pellets.push({ x: w[0] + (Math.random()-0.5)*0.35, z: w[1] + (Math.random()-0.5)*0.35, age: 0 }); }
  else scareKoi(w[0], w[1]);
}

/* ---------------- Panel ---------------- */
const $ = id => document.getElementById(id);
const $hint = $('hint'); let hintT = setTimeout(hideHint, 9000);
function hideHint(){ clearTimeout(hintT); $hint.classList.add('off'); }
const fmtHour = h => { const hh = Math.floor(h), mm = Math.round((h - hh)*60); return `${String(hh).padStart(2,'0')}:${String(mm === 60 ? 0 : mm).padStart(2,'0')}`; };
function setHour(h){ S.hour = h; $('time').value = h; $('timeLbl').textContent = fmtHour(h); }
const SEASONS = ['spring','summer','autumn','winter'];
function setSeason(name){ const i = SEASONS.indexOf(name); if (i < 0) return; S.seasonT = [0,0,0,0]; S.seasonT[i] = 1;
  document.querySelectorAll('[data-season]').forEach(b => b.classList.toggle('on', b.dataset.season === name)); }
function setRain(on){ S.rainT = on ? 1 : 0; $('rain').classList.toggle('on', on); }
function setFeed(on){ feedMode = on; $('feed').classList.toggle('on', on); $('feedHint').hidden = !on; }
function setModeButtons(m){ $('modeOrbit').classList.toggle('on', m !== 'walk'); $('modeWalk').classList.toggle('on', m === 'walk'); }
$('time').addEventListener('input', e => setHour(parseFloat(e.target.value)));
$('wind').addEventListener('input', e => { S.wind = parseFloat(e.target.value); });
$('clarity').addEventListener('input', e => { S.clarity = parseFloat(e.target.value); });
document.querySelectorAll('[data-season]').forEach(b => b.addEventListener('click', () => setSeason(b.dataset.season)));
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => goView(b.dataset.view)));
$('rain').addEventListener('click', () => setRain(S.rainT < 0.5));
$('feed').addEventListener('click', () => setFeed(!feedMode));
$('auto').addEventListener('click', () => { cam.auto = !cam.auto; $('auto').classList.toggle('on', cam.auto); });
$('modeOrbit').addEventListener('click', () => goView('overview'));
$('modeWalk').addEventListener('click', () => {
  cam.anim = null; cam.follow = null;
  let p = cam.pos.slice(); if (walkGround(p[0], p[2]) === null || cam.mode === 'orbit') p = [2.0, 0, 16];
  cam.pos = [p[0], (walkGround(p[0], p[2]) ?? 0.3) + 1.6, p[2]]; cam.mode = 'walk'; cam.pitch = -0.08; cam.yaw = -0.1;
  setModeButtons('walk'); document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('on'));
  $hint.textContent = 'W A S D or arrow keys to stroll · drag to look · on touch, press and hold to walk'; $hint.classList.remove('off'); clearTimeout(hintT); hintT = setTimeout(hideHint, 7000);
});
$('panelToggle').addEventListener('click', () => document.body.classList.toggle('panel-closed'));
$('aboutBtn').addEventListener('click', openAbout);
$('aboutClose').addEventListener('click', closeAbout);
function openAbout(){ $('about').hidden = false; fillStats(); }
function closeAbout(){ $('about').hidden = true; }
document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.tabpane').forEach(p => p.hidden = p.id !== 'tab-' + b.dataset.tab);
}));
function fillStats(){
  const el = $('stats'); if (!el) return;
  const rows = [
    ['Static triangles', STATS.staticTris.toLocaleString()], ['  of which terrain', STATS.terrainTris.toLocaleString()],
    ['Leaf cards', STATS.cards.toLocaleString()], ['Koi', `${koi.length} × ${STATS.koiTris.toLocaleString()} triangles`],
    ['Shore rocks placed', STATS.bankRocks], ['Background trees', STATS.backgroundTrees], ['Azalea mounds', STATS.azaleas],
    ['Generation time', STATS.buildMs + ' ms'], ['Render size', `${W} × ${H} (quality ${quality.toFixed(2)})`], ['Shadow map', `${SHS} × ${SHS}`],
    ['Ripple grid', `${RIP.nx} × ${RIP.nz} over ${RIP.sx} × ${RIP.sz} m`], ['GPU float targets', extF32 ? 'RGBA32F' : 'RGBA16F'],
  ];
  el.innerHTML = rows.map(([a,b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join('');
}

/* ---- minimap: live plan of the garden; click to fly there ---- */
const mm = $('minimap'), mctx = mm.getContext('2d');
const MM = { x0:-31, z0:-25, x1:29, z1:19 };
const mmBase = (() => {
  const w = mm.width, h = mm.height, img = mctx.createImageData(w, h);
  for (let j=0;j<h;j++) for (let i=0;i<w;i++){
    const x = MM.x0 + (MM.x1-MM.x0)*(i+0.5)/w, z = MM.z0 + (MM.z1-MM.z0)*(j+0.5)/h, g = terrainH(x, z), o = (j*w+i)*4;
    let c;
    if (g < 0){ const d = Math.min(1, -g/1.1); c = [60 + 40*(1-d), 92 + 50*(1-d), 98 + 40*(1-d)]; }
    else { const k = Math.min(1, g/7); c = [58 + 60*k, 78 + 40*k, 44 + 40*k]; const p = pathW(x, z); c = c.map((v,n) => v*(1-p) + [190,182,164][n]*p); }
    img.data[o] = c[0]; img.data[o+1] = c[1]; img.data[o+2] = c[2]; img.data[o+3] = 255;
  }
  return img;
})();
const toMM = (x, z) => [(x - MM.x0)/(MM.x1 - MM.x0)*mm.width, (z - MM.z0)/(MM.z1 - MM.z0)*mm.height];
function drawMinimap(){
  mctx.putImageData(mmBase, 0, 0);
  const sc = mm.width/(MM.x1 - MM.x0);
  mctx.fillStyle = 'rgba(40,24,14,.9)'; const [px, pz] = toMM(PAV.x - PAV.hx, PAV.z - PAV.hz); mctx.fillRect(px, pz, PAV.hx*2*sc, PAV.hz*2*sc);
  mctx.strokeStyle = '#c8321e'; mctx.lineWidth = 2.5*sc/4; mctx.beginPath(); mctx.moveTo(...toMM(...BRIDGE.a)); mctx.lineTo(...toMM(...BRIDGE.b)); mctx.stroke();
  mctx.fillStyle = '#f2efe6'; for (const L of LANTERNS){ const [x,z] = toMM(L.x, L.z); mctx.fillRect(x-1.5, z-1.5, 3, 3); }
  for (const T of TREES){ const [x,z] = toMM(T.x, T.z); mctx.fillStyle = T.t === 'pine' ? '#1d3b22' : T.t === 'maple' ? (S.season[2] > 0.5 ? '#b8321a' : '#4d7a2a') : '#e6a8bf'; mctx.beginPath(); mctx.arc(x, z, 2.2*T.s*sc/4*1.4, 0, TAU); mctx.fill(); }
  for (const k of koi){ const [x,z] = toMM(k.x, k.z); mctx.fillStyle = k.type === 3 ? '#f0b030' : k.type === 4 ? '#8a5a30' : k.type === 2 ? '#222' : '#f4f0ea'; mctx.beginPath(); mctx.arc(x, z, 1.4, 0, TAU); mctx.fill(); }
  const [cx, cz] = toMM(cam.pos[0], cam.pos[2]), f = camF(cam.yaw, 0);
  mctx.fillStyle = 'rgba(255,255,255,.95)'; mctx.strokeStyle = 'rgba(0,0,0,.5)'; mctx.lineWidth = 1;
  mctx.beginPath(); mctx.moveTo(cx + f[0]*9, cz + f[2]*9); mctx.lineTo(cx - f[2]*4 - f[0]*3, cz + f[0]*4 - f[2]*3); mctx.lineTo(cx + f[2]*4 - f[0]*3, cz - f[0]*4 - f[2]*3); mctx.closePath(); mctx.fill(); mctx.stroke();
}
mm.addEventListener('click', e => {
  const r = mm.getBoundingClientRect(), x = MM.x0 + (e.clientX - r.left)/r.width*(MM.x1 - MM.x0), z = MM.z0 + (e.clientY - r.top)/r.height*(MM.z1 - MM.z0);
  const tgt = [x, Math.max(terrainH(x, z), 0) + 0.4, z], yaw = cam.mode === 'orbit' ? cam.yaw : 0.1, pitch = -0.42, dist = 14;
  cam.follow = null; document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('on')); setModeButtons('orbit');
  cam.anim = { t:0, dur:1.6, from:{ pos: cam.pos.slice(), yaw: cam.yaw, pitch: cam.pitch }, to:{ pos: v3.madd(tgt, camF(yaw, pitch), -dist), yaw, pitch, mode:'orbit', target: tgt, dist } };
});

/* ---------------- Loop ---------------- */
if (innerWidth < 720) document.body.classList.add('panel-closed');
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fail('The GPU context was lost (the graphics driver reset or ran out of memory). Reload the page to restart the garden.'); });
// URL options for screenshots and testing: ?hour=17.5&season=autumn&view=pavilion&rain=1&feed=1&debug
setHour(Q.has('hour') ? parseFloat(Q.get('hour')) : S.hour);
setSeason(Q.get('season') || 'autumn'); S.season = S.seasonT.slice();
if (Q.has('rain')){ setRain(true); S.rain = 1; }
if (Q.has('feed')) setFeed(true);
if (Q.has('wind')) { S.wind = parseFloat(Q.get('wind')); $('wind').value = S.wind; }
goView(Q.get('view') || 'overview', true); orbitPos();
alloc();
const $dbg = $('dbg'); if (DEBUG) $dbg.hidden = false;
let last = performance.now(), tSim = 0, ripAcc = 0, frames = 0, ftAvg = 16, started = false;
function frame(now){
  const dt = Math.min(0.05, (now - last)/1000); last = now;
  tSim += dt;
  const t = FIXED_T !== null ? FIXED_T : tSim;
  if (!pebReady){ requestAnimationFrame(frame); return; }
  if (!started){ started = true; if (DEBUG) console.log('first frame at', Math.round(performance.now()), 'ms'); $('loading').classList.add('off'); setTimeout(() => $('loading').remove(), 900); }
  const kS = 1 - Math.exp(-dt*1.4);
  S.season = S.season.map((v,i) => lerp(v, S.seasonT[i], kS)); S.snow = smooth(0.3, 0.9, S.season[3]);
  S.rain = lerp(S.rain, S.rainT, 1 - Math.exp(-dt*0.7)); S.time = t;
  atmosphere();
  updateCamera(dt, t);
  // life in the pond
  updateKoi(dt);
  spawnParticles(dt, S.season, cam.pos, [S.windV[0], S.windV[2]]);
  updateParticles(dt, [S.windV[0], S.windV[2]], t);
  nPartVerts = Math.min(buildParticleVerts(partData), PART_MAX*4);
  if (nPartVerts){ gl.bindBuffer(gl.ARRAY_BUFFER, vPart.vb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, partData, 0, nPartVerts*STRIDE); }
  // rain on the pond, the waterfall's plunge
  if (S.rain > 0.05){ let n = S.rain*140*dt; while (n > 0){ if (Math.random() < n){ const x = RIP.x0 + Math.random()*RIP.sx, z = RIP.z0 + Math.random()*RIP.sz; addDrop(x, z, 0.035 + 0.03*Math.random(), 0.02 + 0.02*Math.random()); } n -= 1; } }
  if (Math.random() < dt*30) addDrop(FALL.base[0] + (Math.random()-0.5)*0.8, FALL.base[2] + (Math.random()-0.2)*0.6, 0.08, 0.02);
  // Clearwater: spectrum -> FFT -> ripples -> caustics
  runFFT(t*0.9, 0.1 + 0.7*S.wind + 0.25*S.rain);
  ripAcc += dt; let steps = 0;
  while (ripAcc >= 1/60 && steps < 3){ stepRipples(); ripAcc -= 1/60; steps++; }
  if (ripAcc > 0.1) ripAcc = 0;
  rippleNormals();
  const sunC = S.sun[1] > 0.12 ? S.sun : v3.norm([S.sun[0], 0.12, S.sun[2]]);
  renderCaustics(sunC);
  renderFrame(camBasis(), t);
  if (frames % 6 === 0) drawMinimap();
  // adaptive resolution (Clearwater)
  if (FIXED_T === null){
    ftAvg = ftAvg*0.95 + (dt*1000)*0.05; frames++;
    if (frames > 90 && !Q.has('q')){
      if (ftAvg > 24 && quality > 0.4){ quality = Math.max(0.4, quality*0.87); alloc(); frames = 1; }
      else if (ftAvg < 15 && quality < 1.0){ quality = Math.min(1.0, quality*1.06); alloc(); frames = 1; }
    }
    if (DEBUG && frames % 15 === 0) $dbg.textContent = `${(1000/ftAvg).toFixed(0)} fps · ${W}×${H} · q ${quality.toFixed(2)} · particles ${parts.length}`;
  } else frames++;
  requestAnimationFrame(frame);
}
if (Q.has('q')){ quality = parseFloat(Q.get('q')); alloc(); }
requestAnimationFrame(frame);
// handle for the console and automated screenshots
window.garden = { goView, setHour, setSeason, setRain, setFeed, cam, S, koi, pellets, addDrop, STATS };
