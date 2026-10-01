// Headless Chrome screenshot harness over CDP.
//   node tools/shot.mjs plans/p1.json
// plan: { "page": "out/test.html", "query": "?intro=0", "w": 1280, "h": 720, "out": "shots",
//         "steps": [ { "eval": "scene.advance(2)", "shot": "a" , "clip": [x,y,w,h,scale] } ] }
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const plan = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const outDir = path.resolve(plan.out || 'shots');
fs.mkdirSync(outDir, { recursive: true });
const log = [];
const L = (...a) => { const s = a.join(' '); log.push(s); console.log(s); };
const done = (code) => {
  fs.writeFileSync(path.join(outDir, 'log.txt'), log.join('\n'));
  fs.writeFileSync(path.join(outDir, 'done.txt'), String(code));
  try { execSync(`taskkill /F /T /PID ${chrome.pid}`, { stdio: 'ignore' }); } catch {}
  process.exit(0);
};

const port = 9300 + Math.floor(Math.random() * 400);
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'cbshot-'));
const exe = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const chrome = spawn(exe, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`,
  '--enable-gpu', '--use-angle=d3d11', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
  `--window-size=${plan.w || 1280},${plan.h || 720}`, 'about:blank'], { stdio: 'ignore' });
setTimeout(() => { L('TIMEOUT'); done(2); }, (plan.timeout || 240) * 1000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 60; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find((t) => t.type === 'page')) break; } catch {}
  await sleep(250);
}
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.consoleAPICalled') {
    const t = m.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
    if (m.params.type === 'error' || m.params.type === 'warning' || plan.verbose) L('[console.' + m.params.type + ']', t.slice(0, 400));
  }
  if (m.method === 'Runtime.exceptionThrown') L('[exception]', JSON.stringify(m.params.exceptionDetails).slice(0, 600));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) L('[eval error]', expr.slice(0, 80), JSON.stringify(r.result.exceptionDetails).slice(0, 300));
  return r.result?.result?.value;
};

await send('Page.enable');
await send('Runtime.enable');
if (plan.offline) {
  await send('Network.enable');
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  L('network: OFFLINE');
}
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Network.requestWillBeSent') L('[request]', m.params.request.url.slice(0, 120));
  if (m.method === 'Network.loadingFailed') L('[request failed]', m.params.errorText, m.params.requestId);
});
await send('Emulation.setDeviceMetricsOverride', { width: plan.w || 1280, height: plan.h || 720, deviceScaleFactor: plan.dpr || 1, mobile: !!plan.mobile });
const url = 'file:///' + path.resolve(plan.page).replace(/\\/g, '/') + (plan.query || '');
const t0 = Date.now();
await send('Page.navigate', { url });
for (let i = 0; i < 400; i++) {
  const ok = await evalJs('!!(window.scene && window.scene.st && window.scene.st.ready)');
  if (ok) break;
  await sleep(150);
}
L('ready after', ((Date.now() - t0) / 1000).toFixed(1), 's');
L('gl', await evalJs(`(()=>{const c=document.createElement('canvas').getContext('webgl2');const d=c&&c.getExtension('WEBGL_debug_renderer_info');return c? c.getParameter(d?d.UNMASKED_RENDERER_WEBGL:c.RENDERER):'none'})()`));
await sleep(plan.settle || 1500);
for (const st of plan.steps) {
  if (st.eval) {
    const v = await evalJs(st.eval);
    if (v !== undefined && st.print !== false) L('eval', st.eval.slice(0, 60), '=>', JSON.stringify(v).slice(0, 400));
  }
  if (st.wait) await sleep(st.wait);
  if (st.shot) {
    const p = { format: 'png' };
    if (st.clip) p.clip = { x: st.clip[0], y: st.clip[1], width: st.clip[2], height: st.clip[3], scale: st.clip[4] || 1 };
    const r = await send('Page.captureScreenshot', p);
    fs.writeFileSync(path.join(outDir, st.shot + '.png'), Buffer.from(r.result.data, 'base64'));
    L('shot', st.shot);
  }
}
done(0);
