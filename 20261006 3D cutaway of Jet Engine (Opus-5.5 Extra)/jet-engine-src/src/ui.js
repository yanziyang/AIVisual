// Interface: guided tour, thrust lever + gauges, cutaway/explode controls, call-out labels,
// gas-path chart and the prompt / notes drawer.
import * as THREE from 'three';
import { STEPS, LABELS, BANDS, ABOUT, PROMPT } from './content.js';
import { BYPASS_RATIO } from './flow.js';
import { createChart } from './chart.js';
import { EngineAudio } from './audio.js';
import { N1_RPM, N2_RPM } from './engine.js';
import { nacOuter } from './path.js';
import { clamp, lerp, deg } from './util.js';

const $ = (id) => document.getElementById(id);
const fmt = (n, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const STEP_SECS = 13;
const LAB_COLOR = { inlet: '#7cc4ff', fan: '#7cc4ff', spinner: '#7cc4ff', nacAft: '#5cc8ff', lpc: '#9be0ff', hpc: '#ffb35c', comb: '#ff8a3d', hpt: '#ff6a3d', lpt: '#ff5a5a', exhaust: '#ffc27a' };

export function createUI({ stage, orbit, engine, canvas, params }) {
  const state = { cur: 0, playing: false, tStep: 0, W: innerWidth, H: innerHeight, free: { x: 0, y: 60, w: 1000, h: 500 }, labelsOn: true, swayOn: true, idle: 0, hover: null, explodeT: 0, tab: 'cardStory' };

  // ------------------------------------------------------------------ rail
  const rail = $('rail');
  STEPS.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'chip'; b.style.setProperty('--h', s.hue); b.dataset.step = i;
    b.innerHTML = `<span class="n">${i === 0 ? '·' : i}</span><span>${s.short}</span><i></i>`;
    b.addEventListener('click', () => { stopPlay(); goStep(i); });
    rail.appendChild(b);
  });
  const chips = [...rail.children];

  // ------------------------------------------------------------------ labels
  const labelsEl = $('labels'), leaders = $('leaders');
  const NS = 'http://www.w3.org/2000/svg';
  const labs = LABELS.map((L) => {
    const el = document.createElement('div');
    el.className = 'lab'; el.textContent = L.text; el.style.setProperty('--c', LAB_COLOR[L.mod] || '#9fb3c8');
    el.addEventListener('click', () => { stopPlay(); goStep(L.step); });
    labelsEl.appendChild(el);
    const line = document.createElementNS(NS, 'line'), dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('r', '3.2');
    leaders.append(line, dot);
    el.addEventListener('pointerenter', () => { el.classList.add('hot'); dot.setAttribute('r', '5'); });
    el.addEventListener('pointerleave', () => { el.classList.remove('hot'); dot.setAttribute('r', '3.2'); });
    return { L, el, line, dot, w: 80, x: 0, y: 0, on: false, p: new THREE.Vector3() };
  });

  // ------------------------------------------------------------------ chart
  const chart = createChart({
    host: $('chart'),
    getLoad: () => engine.state.load,
    onHover: (b) => { chart.highlight(b.mods); engine.setFocus(b.mods); state.hover = b; },
    onLeave: () => { state.hover = null; applyFocus(); },
    onPick: (b) => { const map = { fan: 1, lpc: 3, hpc: 3, comb: 4, hpt: 5, lpt: 5, noz: 6 }; stopPlay(); goStep(map[b.id]); },
  });

  // ------------------------------------------------------------------ camera framing
  function measure() {
    state.W = innerWidth; state.H = innerHeight;
    const top = $('top').getBoundingClientRect();
    const narrow = state.W <= 980;
    let dockTop;
    if (narrow) dockTop = $('dockwrap').getBoundingClientRect().top;
    else { dockTop = state.H; for (const c of document.querySelectorAll('#dock .card')) dockTop = Math.min(dockTop, c.getBoundingClientRect().top); }
    const y = top.bottom + 2, h = Math.max(140, dockTop - y - 8);
    state.free = { x: 0, y, w: state.W, h };
    stage.setFree(state.free, state.W, state.H);
    chart.fitWidth();
    $('hint').style.top = (top.bottom + 4) + 'px';
  }

  // camera distance that fits a view (half-width / half-height in metres) into the free area
  function fit(v, expl = engine.explode) {
    const f = state.free, W = state.W, H = state.H;
    const tanV = Math.tan(stage.camera.fov * Math.PI / 360), tanH = tanV * (W / H);
    const k = 1 + 0.42 * expl;
    const dw = (v.w * k) / (0.92 * tanH * (f.w / W));
    const hAvail = Math.max(120, f.h - (state.cur === 0 ? 84 : 40));
    const dh = (v.h * (1 + 0.1 * expl)) / (0.9 * tanV * (hAvail / H));
    return clamp(Math.max(dw, dh), 1.2, 46);
  }
  const shot = (v) => ({ yaw: v.yaw, pitch: v.pitch, dist: fit(v), tx: v.cx, ty: 0, tz: 0 });

  // ------------------------------------------------------------------ tour
  const stP = $('stP'), stText = $('stText');
  function applyFocus() {
    const s = STEPS[state.cur];
    engine.setFocus(s.focus);
    engine.flow.setRange(s.flow);
    chart.highlight(s.focus.length ? s.focus : null);
  }
  function setStepText(i, instant) {
    const s = STEPS[i];
    const render = () => {
      $('stN').textContent = i === 0 ? '·' : i; $('stTag').textContent = s.tag; $('stTitle').textContent = s.title;
      stP.innerHTML = s.text;
      $('stFacts').innerHTML = s.facts.map(([k, v]) => `<li>${k}<b>${v}</b></li>`).join('');
      cardStory.style.setProperty('--h', s.hue);
      stText.classList.remove('swap');
    };
    if (instant || reduceMotion) render();
    else { stText.classList.add('swap'); setTimeout(render, 170); }
  }
  const cardStory = $('cardStory');
  function goStep(i, opts = {}) {
    i = clamp(i, 0, STEPS.length - 1);
    state.cur = i; state.tStep = 0;
    chips.forEach((c, k) => { if (k === i) c.setAttribute('aria-current', 'step'); else c.removeAttribute('aria-current'); });
    setStepText(i, opts.instant);
    applyFocus();
    measure();
    chart.setStation(STEPS[i].station);
    const target = shot(STEPS[i].view);
    if (opts.instant) { orbit.setNow(target); } else orbit.flyTo(target, 1.9);
    if (state.playing) restartProgress();
    chips[i].scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  function restartProgress() {
    chips.forEach((c) => c.classList.remove('playing'));
    const c = chips[state.cur];
    c.style.setProperty('--dur', STEP_SECS + 's');
    void c.offsetWidth;
    c.classList.add('playing');
  }
  function setPlaying(on) {
    state.playing = on;
    $('icoPlay').style.display = on ? 'none' : ''; $('icoPause').style.display = on ? '' : 'none';
    $('play').setAttribute('aria-label', on ? 'Pause the guided tour' : 'Play the guided tour');
    if (on) restartProgress(); else chips.forEach((c) => c.classList.remove('playing'));
  }
  function startPlay() {
    if (state.cur >= STEPS.length - 1) goStep(0);
    setPlaying(true);
    if (state.cur === 0) goStep(1);
    else restartProgress();
  }
  function stopPlay() { if (state.playing) setPlaying(false); }
  $('play').addEventListener('click', () => (state.playing ? stopPlay() : startPlay()));
  $('prev').addEventListener('click', () => { stopPlay(); goStep(state.cur - 1); });
  $('next').addEventListener('click', () => { stopPlay(); goStep(state.cur + 1); });

  // ------------------------------------------------------------------ controls
  const thr = $('throttle');
  const leverName = (v) => (v < 10 ? 'Idle' : v < 40 ? 'Approach' : v < 70 ? 'Cruise' : v < 92 ? 'Climb' : 'Take-off');
  function onThrottle() { engine.throttle = thr.value / 100; $('leverName').textContent = leverName(+thr.value); }
  thr.addEventListener('input', onThrottle);
  thr.addEventListener('pointerdown', stopPlayMaybe);
  function stopPlayMaybe() { /* moving the lever does not interrupt the tour */ }

  const cutW = $('cutW'), cutR = $('cutR'), expl = $('expl');
  function applyCut() {
    const w = +cutW.value, c = +cutR.value;
    $('cutWo').textContent = w + '°'; $('cutRo').textContent = c + '°';
    const on = $('tCut').getAttribute('aria-pressed') === 'true' && w >= 3;
    engine.setCut(on, deg(c), deg(w) / 2);
  }
  cutW.addEventListener('input', applyCut); cutR.addEventListener('input', applyCut);
  let lastExpl = 0;
  expl.addEventListener('input', () => {
    $('explo').textContent = expl.value + '%'; state.explodeT = expl.value / 100;
    stopPlay();
  });
  $('slow').addEventListener('change', (e) => { engine.slow = 1 / +e.target.value; });
  const toggle = (id, fn) => { const b = $(id); b.addEventListener('click', () => { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); fn(on); }); return b; };
  toggle('tCut', () => applyCut());
  toggle('tFlow', (on) => { engine.flow.visible = on; });
  toggle('tLab', (on) => { state.labelsOn = on; });
  const audio = new EngineAudio();
  toggle('tSound', (on) => audio.set(on));
  function setToggle(id, on) { $(id).setAttribute('aria-pressed', on); }

  // tabs (phones / narrow windows)
  document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.tab; showTab(); }));
  function showTab() {
    document.querySelectorAll('#tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === state.tab));
    document.querySelectorAll('#dock .card').forEach((c) => c.classList.toggle('show', c.id === state.tab));
    measure(); if (!orbit.anim) orbit.flyTo(shot(STEPS[state.cur].view), 0.8);
  }

  // full screen
  $('btnFull').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {});
  });

  // about drawer
  const drawer = $('drawer'), scrim = $('scrim');
  function buildAbout() {
    const colour = `<div class="legend" style="margin-top:6px"><span style="--c:var(--n1)">LP spool (N1): fan, booster, LP turbine</span><span style="--c:var(--n2)">HP spool (N2): HP compressor, HP turbine</span><span style="--c:var(--cut)">Orange hatching: surfaces cut by the cutaway</span></div>`;
    $('abBody').innerHTML = `
      <h4>Prompt</h4><blockquote>${PROMPT}</blockquote>
      <h4>Source</h4><p>${ABOUT.source}</p>
      <h4>What you are looking at</h4><p>A twin-spool, high-bypass turbofan with a wedge cut out of its casings. Air flows left to right. Streaks are air: blue is cold, white and yellow warmer, orange hot gas. Bypass ratio in this model is about ${BYPASS_RATIO.toFixed(1)} : 1.</p>${colour}
      <h4>How it is made</h4><dl>${ABOUT.notes.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      <h4>Controls</h4><div class="keys">${ABOUT.controls.map(([k, v]) => `<span><kbd>${k}</kbd></span><span>${v}</span>`).join('')}</div>`;
  }
  buildAbout();
  const openAbout = (on) => { drawer.classList.toggle('open', on); scrim.classList.toggle('on', on); drawer.setAttribute('aria-hidden', !on); if (on) $('btnClose').focus(); else $('btnAbout').focus(); };
  $('btnAbout').addEventListener('click', () => openAbout(true));
  $('btnClose').addEventListener('click', () => openAbout(false));
  scrim.addEventListener('click', () => openAbout(false));

  // keyboard
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { openAbout(false); return; }
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
    if (typing && (e.key.startsWith('Arrow') || e.key === ' ')) return;
    if (t && t.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
    switch (e.key) {
      case ' ': e.preventDefault(); state.playing ? stopPlay() : startPlay(); break;
      case 'ArrowRight': stopPlay(); goStep(state.cur + 1); break;
      case 'ArrowLeft': stopPlay(); goStep(state.cur - 1); break;
      case 'ArrowUp': thr.value = Math.min(100, +thr.value + 5); onThrottle(); e.preventDefault(); break;
      case 'ArrowDown': thr.value = Math.max(0, +thr.value - 5); onThrottle(); e.preventDefault(); break;
      case 'c': case 'C': $('tCut').click(); break;
      case 'e': case 'E': expl.value = +expl.value > 50 ? 0 : 100; expl.dispatchEvent(new Event('input')); break;
      case 'f': case 'F': $('tFlow').click(); break;
      case 'l': case 'L': $('tLab').click(); break;
      default: return;
    }
  });

  // camera interaction cancels the tour and hides the hint
  orbit.onUser = () => { stopPlay(); state.idle = 0; $('hint').classList.add('gone'); };

  // ------------------------------------------------------------------ per-frame
  const tmp = new THREE.Vector3();
  const silhouette = [];
  for (const x of [0.15, 0.7, 1.4, 2.4, 3.4, 4.4, 5.2]) for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5, r = nacOuter(Math.max(0.12, x)); silhouette.push(new THREE.Vector3(x, r * Math.cos(a), r * Math.sin(a))); }
  let gaugeT = 0;
  function labelsLayout(dt) {
    const s = STEPS[state.cur];
    const W = state.W, f = state.free;
    const narrow = W < 700;
    // engine silhouette in screen space to place the two label rows just outside it
    let minY = 1e9, maxY = -1e9;
    for (const p of silhouette) {
      tmp.copy(p); tmp.x += engine.mods.fan.group.position.x * 0.4; tmp.project(stage.camera);
      const y = (1 - tmp.y) / 2 * state.H; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const yTop = clamp(minY - 34, f.y + 6, f.y + f.h - 60), yBot = clamp(maxY + 14, f.y + 60, f.y + f.h - 30);
    const cth = engine.cut.on ? engine.cut.center : 1.5;
    const rows = { top: [], bot: [] };
    for (const l of labs) {
      const L = l.L;
      let show = state.labelsOn && !(narrow && state.cur === 0);
      if (show) show = state.cur === 0 ? (L.id !== 'n1' && L.id !== 'n2') : (L.step === state.cur || (state.cur === 3 && L.step === 3));
      if (show && state.cur === 5 && (L.id === 'n1' || L.id === 'n2')) show = true;
      l.on = show;
      l.el.classList.toggle('on', show);
      const mod = engine.mods[L.mod];
      l.p.set(L.x + mod.group.position.x, L.r * Math.cos(cth), L.r * Math.sin(cth));
      tmp.copy(l.p).project(stage.camera);
      l.ax = (tmp.x + 1) / 2 * state.W; l.ay = (1 - tmp.y) / 2 * state.H;
      l.behind = tmp.z > 1;
      if (show) rows[L.row].push(l);
    }
    for (const key of ['top', 'bot']) {
      const arr = rows[key].sort((a, b) => a.ax - b.ax);
      let prev = 6;
      for (const l of arr) {
        l.w = l.el.offsetWidth || l.w;
        l.tx = clamp(l.ax - l.w / 2, prev, W - l.w - 6);
        prev = l.tx + l.w + 8;
      }
      // pull back from the right edge if we ran out of room
      let next = W - 6;
      for (let i = arr.length - 1; i >= 0; i--) { const l = arr[i]; if (l.tx + l.w > next) l.tx = Math.max(6, next - l.w); next = l.tx - 8; }
      for (const l of arr) l.ty = key === 'top' ? yTop : yBot;
    }
    const k = 1 - Math.exp(-dt * 12);
    for (const l of labs) {
      if (!l.on) { l.line.setAttribute('visibility', 'hidden'); l.dot.setAttribute('visibility', 'hidden'); continue; }
      if (!l.init) { l.x = l.tx; l.y = l.ty; l.init = true; }
      l.x += (l.tx - l.x) * k; l.y += (l.ty - l.y) * k;
      l.el.style.transform = `translate(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px)`;
      const top = l.L.row === 'top';
      const lx = clamp(l.ax, l.x + 8, l.x + l.w - 8), ly = top ? l.y + 26 : l.y;
      l.line.setAttribute('x1', lx); l.line.setAttribute('y1', ly); l.line.setAttribute('x2', l.ax); l.line.setAttribute('y2', l.ay);
      l.dot.setAttribute('cx', l.ax); l.dot.setAttribute('cy', l.ay);
      l.line.setAttribute('visibility', 'visible'); l.dot.setAttribute('visibility', 'visible');
    }
  }

  function updateGauges(dt) {
    gaugeT += dt;
    if (gaugeT < 0.08) return;
    gaugeT = 0;
    const s = engine.state;
    $('gN1').textContent = fmt(s.n1 * 100, 0); $('gN2').textContent = fmt(s.n2 * 100, 0);
    $('gEGT').textContent = fmt(Math.round(s.egt / 5) * 5); $('gTh').textContent = fmt(Math.round(s.thrust));
    $('bN1').style.width = (s.n1 * 100) + '%'; $('bN2').style.width = (s.n2 * 100) + '%';
    $('bEGT').style.width = clamp((s.egt - 300) / 700) * 100 + '%'; $('bTh').style.width = clamp(s.thrust / 300) * 100 + '%';
    $('miniRead').innerHTML = `Pressure ratio <b>${fmt(s.opr, 0)} : 1</b> · Bypass ratio <b>${BYPASS_RATIO.toFixed(1)} : 1</b><br>Fuel flow <b>${fmt(s.fuel, 2)} kg/s</b> · N1 <b>${fmt(s.n1 * N1_RPM)}</b> rpm · N2 <b>${fmt(s.n2 * N2_RPM)}</b> rpm`;
    chart.update(false);
  }

  function update(dt) {
    state.idle += dt;
    // tour clock
    if (state.playing) {
      state.tStep += dt;
      if (state.tStep > STEP_SECS) {
        if (state.cur >= STEPS.length - 1) { setPlaying(false); goStep(0); } else goStep(state.cur + 1);
      }
    }
    // explode eases toward its slider
    const prevE = engine.explode;
    engine.explode += (state.explodeT - engine.explode) * (1 - Math.exp(-dt * 5));
    if (Math.abs(engine.explode - state.explodeT) < 1e-3) engine.explode = state.explodeT;
    if (Math.abs(engine.explode - prevE) > 1e-5 && !orbit.anim && !orbit.userActive) {
      // keep the engine framed while it comes apart
      const ratio = fit(STEPS[state.cur].view) / fit(STEPS[state.cur].view, prevE);
      orbit.g.dist = clamp(orbit.g.dist * ratio, orbit.limits.minDist, orbit.limits.maxDist);
    }
    // gentle sway when idle in the overview
    const wantSway = state.swayOn && !reduceMotion && !state.playing && state.cur === 0 && state.idle > 5 ? 0.09 : 0;
    orbit.swayAmp += (wantSway - orbit.swayAmp) * (1 - Math.exp(-dt * 1.5));
    updateGauges(dt);
    labelsLayout(dt);
    audio.update(engine.state);
  }

  // ------------------------------------------------------------------ start
  function layout() {
    measure();
    if (!orbit.anim && !orbit.userActive && state.cur >= 0 && !state.userMoved) orbit.setNow(shot(STEPS[state.cur].view));
  }
  window.addEventListener('resize', () => { measure(); if (!orbit.userMoved && !orbit.anim) { orbit.flyTo(shot(STEPS[state.cur].view), 0.6); } });
  const origOnUser = orbit.onUser;
  orbit.onUser = () => { orbit.userMoved = true; origOnUser(); };

  const narrowInit = innerWidth <= 980;
  if (narrowInit) showTab();
  onThrottle(); applyCut();
  measure();
  goStep(0, { instant: true });
  chart.fitWidth(); chart.update(true);
  setTimeout(() => $('hint').classList.add('gone'), 12000);
  if (params.get('autoplay') !== '0' && !reduceMotion && params.get('paused') !== '1') setTimeout(() => { if (!orbit.userMoved) startPlay(); }, 3200);

  return { update, layout, measure, goStep, startPlay, stopPlay, state, chart, shot, fit, setToggle, openAbout, showTab };
}
