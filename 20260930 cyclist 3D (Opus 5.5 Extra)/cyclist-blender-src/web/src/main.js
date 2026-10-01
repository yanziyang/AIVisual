// Cadence — Blender edition. Entry point: renderer, scenes, ride logic, UI, test hooks.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Cyclist, KITS, CIRC } from './model.js';
import { RideWorld, laneFrame, terrainHeight, TIMES, LANE } from './world.js';
import { Studio } from './studio.js';
import { Director } from './camera.js';
import { clamp, damp, lerp } from './noise.js';

const Q = new URLSearchParams(location.search);
const opt = {
  mode: Q.get('mode') || 'ride',
  cam: Q.get('cam') || 'auto',
  time: Q.get('time') || 'golden',
  posture: Q.get('posture') || 'Auto',
  kit: Q.get('kit') || 'signal',
  view: Q.get('view') || 'shaded',
  q: Q.get('q') || (Math.min(window.innerWidth, window.innerHeight) < 600 ? 'low' : 'med'),
  x: parseFloat(Q.get('x') || '0'),
  t: parseFloat(Q.get('t') || '0'),
  paused: Q.get('paused') === '1',
  intro: Q.get('intro') !== '0',
  auto: Q.get('auto') !== '0',
};

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opt.q === 'high' ? 2 : opt.q === 'low' ? 1 : 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 6000);
const director = new Director(camera);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enabled = false;

const state = {
  mode: opt.mode,
  xAbs: opt.x,            // distance parameter along the road
  dist: 0,                // metres ridden
  speed: 9.0,             // m/s
  cadenceTarget: 90,
  cadence: 90,
  posture: opt.posture,   // Auto | Seated | Standing | Coast
  autoPosture: 'Seated',
  autoTimer: 0,
  lean: 0,
  pitch: 0,
  paused: opt.paused,
  time: opt.time,
  kit: opt.kit,
  view: opt.view,
  clock: 0,
  ready: false,
};

let world, studio, cyclist;
const frame = {};

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ------------------------------------------------------------------ world adapter (floating origin)
const worldApi = {
  frameAt(xAbs) {
    const f = laneFrame(xAbs, LANE, {});
    f.pos.x -= world.origin;
    return f;
  },
  height(p) {
    return terrainHeight(p.x + world.origin, p.z);
  },
};

// ------------------------------------------------------------------ boot
async function boot() {
  const msg = $('veilMsg'), bar = $('veilBar');
  try {
    bar.style.width = '15%';
    const b64 = $('glb').textContent.trim();
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    bar.style.width = '45%';
    msg.textContent = 'Decoding meshes, skeleton and baked loops…';
    await new Promise((r) => setTimeout(r, 30));
    cyclist = await Cyclist.load(buf.buffer);
    bar.style.width = '75%';
    msg.textContent = 'Building the valley…';
    await new Promise((r) => setTimeout(r, 30));
    world = new RideWorld(renderer, opt.q);
    studio = new Studio(renderer);
    cyclist.setKit(state.kit);
    setMode(state.mode, true);
    world.prime(state.xAbs);
    buildUI();
    if (opt.t > 0) advance(opt.t);
    state.ready = true;
    bar.style.width = '100%';
    renderer.compile(scene, camera);
    render();
    setTimeout(() => $('veil').classList.add('gone'), opt.intro ? 250 : 0);
    if (!opt.intro) $('veil').style.transition = 'none';
    last = performance.now();
    requestAnimationFrame(loop);
  } catch (e) {
    console.error(e);
    $('veil').classList.add('err');
    msg.textContent = 'This page needs WebGL 2. ' + (e && e.message ? e.message : e);
  }
}

// ------------------------------------------------------------------ modes
function setMode(m, initial = false) {
  state.mode = m;
  document.body.classList.toggle('studio', m === 'studio');
  scene.clear();
  if (m === 'studio') {
    scene.add(studio.group);
    studio.apply(scene, renderer);
    studio.table.add(cyclist.root);
    cyclist.root.position.set(0, 0.134, 0);
    cyclist.root.rotation.set(0, 0, 0);
    cyclist.root.updateMatrixWorld(true);
    cyclist.setEnvIntensity(0.9);
    controls.enabled = true;
    controls.target.set(0.05, 0.85, 0);
    if (initial || !state.studioCamSet) {
      // frame the whole bike: back off on portrait screens where the horizontal FOV is narrow
      camera.fov = 35;
      camera.updateProjectionMatrix();
      const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
      const dist = Math.max(3.95, 1.15 / Math.tan(hfov / 2));
      const dir = new THREE.Vector3(2.85, 0.7, 2.6).normalize();
      camera.position.copy(controls.target).addScaledVector(dir, dist);
      state.studioCamSet = true;
    }
    controls.minDistance = 1.2;
    controls.maxDistance = 12;
    controls.maxPolarAngle = Math.PI * 0.495;
    cyclist.setView(state.view, scene);
  } else {
    scene.add(world.group);
    scene.add(cyclist.root);
    world.setTime(state.time, scene);
    cyclist.setEnvIntensity(world.envIntensity);
    cyclist.setView('shaded');
    controls.enabled = director.mode === 'free';
    controls.minDistance = 1.0;
    controls.maxDistance = 40;
    controls.maxPolarAngle = Math.PI * 0.49;
    director.setMode(initial ? opt.cam : director.mode);
    controls.enabled = director.mode === 'free';
    placeRider(0);
    if (controls.enabled) {
      controls.target.copy(cyclist.root.position).add(new THREE.Vector3(0, 0.9, 0));
      camera.position.copy(controls.target).add(new THREE.Vector3(-3.5, 1.2, 2.5));
    }
    director.cut = true;
  }
  syncUI();
}

// ------------------------------------------------------------------ ride simulation
function choosePosture(dt, slope) {
  if (state.posture !== 'Auto') return state.posture;
  state.autoTimer += dt;
  state.stretchClock = (state.stretchClock || 0) + dt;
  let want = 'Seated';
  if (slope > 0.034) want = 'Standing';
  else if (slope < -0.03) want = 'Coast';
  // riders stand up now and then on the flat to stretch, and freewheel for a moment
  const cyc = state.stretchClock % 52;
  if (want === 'Seated' && cyc > 30 && cyc < 36.5) want = 'Standing';
  if (want === 'Seated' && cyc > 44 && cyc < 47.5) want = 'Coast';
  // stand in bursts on long climbs; avoid flicker with a minimum hold time
  if (want === 'Standing' && state.autoPosture === 'Standing' && state.autoTimer > 9) { want = 'Seated'; }
  if (want !== state.autoPosture && state.autoTimer > 2.5) {
    if (!(want === 'Standing' && state.autoPosture === 'Seated' && state.autoTimer < 6 && state.lastWasStand)) {
      state.lastWasStand = state.autoPosture === 'Standing';
      state.autoPosture = want;
      state.autoTimer = 0;
    }
  }
  return state.autoPosture;
}

function placeRider(dt) {
  laneFrame(state.xAbs, LANE, frame);
  frame.pos.x -= world.origin;
  frame.pos.y -= 0.01;
  const yaw = Math.atan2(-frame.fwd.z, frame.fwd.x);
  const pitch = Math.atan(frame.slope);
  const leanTarget = Math.atan(state.speed * state.speed * frame.curv / 9.81);
  state.lean = dt ? damp(state.lean, clamp(leanTarget, -0.6, 0.6), 3, dt) : leanTarget;
  cyclist.root.position.copy(frame.pos);
  cyclist.root.rotation.set(state.lean, yaw, pitch, 'YZX');
  frame.up = new THREE.Vector3(0, 1, 0);
}

function stepRide(dt) {
  laneFrame(state.xAbs, LANE, frame);
  const slope = frame.slope;
  const posture = choosePosture(dt, slope);
  cyclist.setPosture(posture);
  // speed: pedalling holds a gradient-dependent pace, coasting follows gravity and drag
  let vT;
  if (posture === 'Coast') {
    const a = -9.81 * slope - 0.0045 * state.speed * state.speed - 0.05;
    state.speed = clamp(state.speed + a * dt, 3, 19);
  } else {
    const effort = state.cadenceTarget / 90;
    vT = clamp((9.4 - slope * 110) * (0.55 + 0.45 * effort) * (posture === 'Standing' ? 1.06 : 1), 3.6, 15.5);
    state.speed = damp(state.speed, vT, 0.7, dt);
  }
  const cad = cyclist.shift(state.speed, state.cadenceTarget);
  state.cadence = posture === 'Coast' ? 0 : cad;
  const ds = state.speed * dt;
  state.dist += ds;
  state.xAbs += ds / frame.ds;
  cyclist.update(dt, state.speed, Math.max(cad, 1));
  const shifted = world.update(state.xAbs, dt, camera);
  if (shifted) {
    director.shift(shifted);
    camera.position.x -= shifted;
    controls.target.x -= shifted;
  }
  placeRider(dt);
}

function stepStudio(dt) {
  const posture = state.posture === 'Auto' ? 'Seated' : state.posture;
  cyclist.setPosture(posture);
  if (posture === 'Coast') state.speed = damp(state.speed, 0, 0.35, dt);
  else state.speed = state.cadenceTarget / 60 * (52 / 17) * CIRC;
  state.cadence = posture === 'Coast' ? 0 : state.cadenceTarget;
  cyclist.gear = [52, 17];
  cyclist.update(dt, state.speed, state.cadenceTarget);
  studio.update(dt, state.speed, !state.studioHold);
}

function advance(sec, step = 1 / 60) {
  let t = sec;
  while (t > 1e-6) {
    const dt = Math.min(step, t);
    tick(dt);
    t -= dt;
  }
}

const tmpPrev = new THREE.Vector3();
function tick(dt) {
  state.clock += dt;
  if (state.mode === 'ride') {
    tmpPrev.copy(cyclist.root.position);
    stepRide(dt);
    if (director.mode === 'free') {
      // carry the orbit with the rider
      const d = cyclist.root.position.clone().sub(tmpPrev);
      camera.position.add(d);
      controls.target.add(d);
    } else {
      const rf = { pos: cyclist.root.position.clone(), fwd: frame.fwd, right: frame.right };
      director.update(dt, rf, worldApi, state.xAbs);
    }
    world.placeSun(cyclist.root.position);
  } else {
    stepStudio(dt);
  }
}

function render() {
  if (state.mode === 'ride' && director.mode !== 'free') world.sky.position.copy(camera.position);
  if (controls.enabled) controls.update();
  if (state.mode === 'ride') {
    world.sky.position.copy(camera.position);
    world.ridges.position.set(camera.position.x, 0, camera.position.z);
  }
  renderer.render(scene, camera);
}

// ------------------------------------------------------------------ loop
let last = 0, hudT = 0, idleT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  // rAF timestamps can trail performance.now() after a long boot: never step backwards
  if (now < last) last = now;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!state.paused) tick(dt);
  else if (state.mode === 'studio') studio.update(0, 0, false);
  render();
  hudT += dt;
  if (hudT > 0.12) { hudT = 0; updateHUD(); }
  idleT += dt;
  if (idleT > 6 && !drawerOpen()) $('dock').classList.add('idle');
}

// ------------------------------------------------------------------ UI
function seg(id, value) {
  for (const b of $(id).querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === value));
}

function syncUI() {
  seg('segMode', state.mode);
  seg('segPosture', state.posture);
  seg('segView', state.view);
  const camSel = $('selCam');
  if (camSel) camSel.value = director.mode;
  $('selTime').value = state.time;
  for (const b of $('kits').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === state.kit));
  $('cad').value = state.cadenceTarget;
  $('cadOut').textContent = state.cadenceTarget + ' rpm';
}

function updateHUD() {
  if (!state.ready) return;
  $('hSpeed').textContent = (state.speed * 3.6).toFixed(1);
  $('hCad').textContent = Math.round(state.cadence) + ' rpm';
  $('hGear').textContent = cyclist.gear[0] + ' × ' + cyclist.gear[1];
  $('hGrade').textContent = (frame.slope * 100 || 0).toFixed(1) + ' %';
  $('hDist').textContent = (state.dist / 1000).toFixed(2) + ' km';
  const p = cyclist.posture;
  $('hPost').textContent = (state.posture === 'Auto' ? 'Auto · ' : '') + (p === 'Coast' ? 'Coasting' : p === 'Standing' ? 'Out of the saddle' : 'Seated');
}

function toast(t) {
  const el = $('toast');
  el.textContent = t;
  el.classList.add('on');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => el.classList.remove('on'), 1600);
}

const drawerOpen = () => $('drawer').classList.contains('open');
function setDrawer(on) {
  $('drawer').classList.toggle('open', on);
  $('drawer').setAttribute('aria-hidden', String(!on));
  $('scrim').classList.toggle('on', on);
  if (on) $('dClose').focus();
}

function fmtBytes(n) { return n > 1048576 ? (n / 1048576).toFixed(2) + ' MB' : (n / 1024).toFixed(0) + ' KB'; }

function buildUI() {
  const kits = $('kits');
  for (const [k, v] of Object.entries(KITS)) {
    const b = document.createElement('button');
    b.dataset.v = k;
    b.title = 'Kit: ' + v.label + ' (K)';
    b.setAttribute('aria-label', 'Kit ' + v.label);
    b.innerHTML = `<i style="background:${v.swatch[0]}"></i><i style="background:${v.swatch[1]}"></i>`;
    b.onclick = () => setKit(k);
    kits.appendChild(b);
  }
  for (const b of $('segMode').querySelectorAll('button')) b.onclick = () => setMode(b.dataset.v);
  for (const b of $('segPosture').querySelectorAll('button')) b.onclick = () => setPosture(b.dataset.v);
  for (const b of $('segView').querySelectorAll('button')) b.onclick = () => setView(b.dataset.v);
  $('cad').oninput = (e) => setCadence(+e.target.value);
  $('selCam').onchange = (e) => setCam(e.target.value);
  $('selTime').onchange = (e) => setTime(e.target.value);
  $('bPause').onclick = togglePause;
  $('bShot').onclick = snapshot;
  $('bFull').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
  $('bInfo').onclick = () => setDrawer(!drawerOpen());
  $('chip').onclick = () => setDrawer(true);
  const card = $('card');
  const setCard = (open) => { card.classList.toggle('collapsed', !open); $('cardToggle').setAttribute('aria-expanded', String(open)); };
  setCard(window.innerWidth >= 1100 && window.innerHeight >= 640);
  $('cardToggle').onclick = () => setCard(card.classList.contains('collapsed'));
  $('dClose').onclick = () => setDrawer(false);
  $('scrim').onclick = () => setDrawer(false);
  const s = cyclist.stats;
  const rows = [
    ['Authoring', 'Blender 3.6.23'],
    ['Format', 'glTF 2.0 + meshopt'],
    ['Embedded GLB', fmtBytes(s.bytes)],
    ['Triangles', Math.round(s.tris).toLocaleString('en')],
    ['Meshes / draw parts', s.meshes],
    ['Bones (deform)', s.bones],
    ['Materials', s.materials],
    ['Animation clips', 'Seated · Standing · Coast'],
    ['Chain links', cyclist.chainLinks],
  ];
  $('statList').innerHTML = rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
  $('statTable').innerHTML = rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');
  const wake = () => { idleT = 0; $('dock').classList.remove('idle'); };
  window.addEventListener('pointermove', wake);
  window.addEventListener('pointerdown', wake);
  window.addEventListener('keydown', (e) => { wake(); onKey(e); });
  syncUI();
}

function setKit(k) { state.kit = k; cyclist.setKit(k); syncUI(); toast('Kit: ' + KITS[k].label); }
function setPosture(p) { state.posture = p; if (p === 'Auto') state.autoTimer = 10; syncUI(); }
function setCadence(v) { state.cadenceTarget = clamp(Math.round(v), 55, 115); syncUI(); }
function setView(v) { state.view = v; if (state.mode === 'studio') cyclist.setView(v, scene); syncUI(); }
function setTime(t) { state.time = t; if (state.mode === 'ride') { world.setTime(t, scene); cyclist.setEnvIntensity(world.envIntensity); } syncUI(); }
function setCam(c) {
  if (state.mode !== 'ride') return;
  director.setMode(c);
  controls.enabled = c === 'free';
  if (c === 'free') {
    controls.target.copy(cyclist.root.position).add(new THREE.Vector3(0, 0.9, 0));
  }
  syncUI();
}
function togglePause() {
  state.paused = !state.paused;
  document.body.classList.toggle('paused', state.paused);
}
function snapshot() {
  render();
  const a = document.createElement('a');
  a.download = `cadence-blender-${state.mode}-${Date.now()}.png`;
  a.href = renderer.domElement.toDataURL('image/png');
  a.click();
  toast('Saved PNG');
}
const CAMS = ['auto', 'chase', 'side', 'front', 'low', 'drone', 'orbit', 'drive', 'roadside', 'free'];
const TIMEKEYS = Object.keys(TIMES);
const VIEWS = ['shaded', 'clay', 'wire', 'bones'];
function onKey(e) {
  if (e.target && (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') && e.key !== 'Escape') {
    if (e.target.tagName === 'INPUT' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return;
  }
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); togglePause(); }
  else if (k === 'escape') setDrawer(false);
  else if (k >= '1' && k <= '4') setPosture(['Auto', 'Seated', 'Standing', 'Coast'][+k - 1]);
  else if (k === 'arrowup') { e.preventDefault(); setCadence(state.cadenceTarget + 2); }
  else if (k === 'arrowdown') { e.preventDefault(); setCadence(state.cadenceTarget - 2); }
  else if (k === 'c') { setCam(CAMS[(CAMS.indexOf(director.mode) + 1) % CAMS.length]); toast('Camera: ' + $('selCam').selectedOptions[0].text.replace('Camera: ', '')); }
  else if (k === 't') { setTime(TIMEKEYS[(TIMEKEYS.indexOf(state.time) + 1) % TIMEKEYS.length]); toast(TIMES[state.time].label); }
  else if (k === 'k') { const ks = Object.keys(KITS); setKit(ks[(ks.indexOf(state.kit) + 1) % ks.length]); }
  else if (k === 'm') setMode(state.mode === 'ride' ? 'studio' : 'ride');
  else if (k === 'v') setView(VIEWS[(VIEWS.indexOf(state.view) + 1) % VIEWS.length]);
  else if (k === 's') snapshot();
  else if (k === 'f') $('bFull').click();
  else if (k === 'i') setDrawer(!drawerOpen());
}

// ------------------------------------------------------------------ test hooks
window.scene = {
  get st() { return state; },
  get cyclist() { return cyclist; },
  get director() { return director; },
  three: THREE,
  advance(sec) { advance(sec); render(); updateHUD(); },
  render,
  setMode, setPosture, setCadence, setKit, setView, setTime, setCam,
  hold(on = true) { state.studioHold = on; },
  view(pos, tgt, fov) {
    if (!pos) { director.setMode('auto'); return; }
    director.setMode('free');
    controls.enabled = true;
    camera.position.set(...pos);
    controls.target.set(...tgt);
    if (fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    controls.update();
  },
  riderPos() { return cyclist.root.position.toArray(); },
};

boot();
