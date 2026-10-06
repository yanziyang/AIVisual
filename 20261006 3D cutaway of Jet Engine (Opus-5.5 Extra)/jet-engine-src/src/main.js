import * as THREE from 'three';
import { createStage } from './stage.js';
import { Orbit } from './orbit.js';
import { Engine } from './engine.js';
import { createUI } from './ui.js';

const params = new URLSearchParams(location.search);

function showFail(msg) {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;z-index:50;display:grid;place-items:center;background:#090d12;color:#e9eef4;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px';
  d.innerHTML = '<div style="max-width:30em"><h2 style="margin:0 0 8px;font-size:20px">The 3D view could not start</h2><p style="margin:0;color:#aebccb">' + msg + '</p></div>';
  document.body.appendChild(d);
  const b = document.getElementById('boot'); if (b) b.remove();
}

function boot() {
  const canvas = document.getElementById('gl');
  let stage;
  try { stage = createStage(canvas); } catch (e) {
    showFail('This page draws the engine with WebGL 2, and your browser or graphics driver did not provide it. Try a current version of Chrome, Edge, Firefox or Safari with hardware acceleration enabled.');
    throw e;
  }
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); showFail('The graphics context was lost, usually because the GPU was reset. Reload the page to continue.'); });
  const orbit = new Orbit(stage.camera, canvas);
  const engine = new Engine(stage);

  // ---- resolution: start at the device ratio (max 2) and step down if frames run long
  const maxPR = Math.min(window.devicePixelRatio || 1, 2) * (parseFloat(params.get('pr')) || 1);
  let pixelRatio = maxPR;
  let ui = null;
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    stage.resize(w, h, pixelRatio);
    engine.setView(w * pixelRatio, h * pixelRatio, pixelRatio);
    ui && ui.measure();
  }
  window.addEventListener('resize', resize);
  resize();
  ui = createUI({ stage, orbit, engine, canvas, params });

  const paused = params.get('paused') === '1';
  let last = performance.now(), time = 0, frames = 0;
  const ft = { acc: 0, n: 0, cool: 0 };
  function adapt(dtMs) {
    ft.acc += dtMs; ft.n++;
    if (ft.n < 60) return;
    const avg = ft.acc / ft.n; ft.acc = 0; ft.n = 0;
    if (ft.cool > 0) { ft.cool--; return; }
    if (avg > 27 && pixelRatio > 0.6) { pixelRatio = Math.max(0.6, pixelRatio * 0.84); resize(); ft.cool = 2; }
    else if (avg > 40 && stage.bloomOn) { stage.bloomOn = false; ft.cool = 2; }
    else if (avg < 13.5 && pixelRatio < maxPR) { pixelRatio = Math.min(maxPR, pixelRatio * 1.1); resize(); ft.cool = 4; }
  }
  function frame(now) {
    const rawDt = (now - last) / 1000;
    const dt = Math.min(0.05, rawDt); last = now;
    time += dt;
    frames++;
    if (frames === 4) engine.warm = false; // shaders for every ring variant are compiled by now
    if (frames === 6) { const b = document.getElementById('boot'); if (b) { b.classList.add('done'); setTimeout(() => b.remove(), 700); } }
    if (!paused) engine.update(dt, time, stage.camera);
    ui.update(dt);
    orbit.update(dt);
    stage.render();
    if (frames > 12 && !paused && !params.has('fixedpr') && document.visibilityState === 'visible') adapt(rawDt * 1000);
    requestAnimationFrame(frame);
  }
  engine.update(0.016, 0, stage.camera);
  requestAnimationFrame(frame);

  // test / debug hooks
  window.jet = {
    stage, orbit, engine, ui, THREE,
    cam(v) { orbit.setNow(v); },
    step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) { time += dt; engine.update(dt, time, stage.camera); } },
    render() { orbit.update(0.0001); stage.render(); },
    pr() { return pixelRatio; },
  };
}

// let the loading card paint before the (synchronous) geometry build starts
requestAnimationFrame(() => setTimeout(boot, 30));
