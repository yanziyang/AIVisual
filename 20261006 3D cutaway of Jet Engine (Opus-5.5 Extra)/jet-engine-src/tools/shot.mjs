// Headless-Chrome harness: node tools/shot.mjs plan.json
//   plan = { page, query, w, h, boot, steps: [{ js, wait, out }] }
// Each step evaluates js in the page, waits `wait` seconds, optionally saves a PNG. Console errors are printed.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const planFile = process.argv[2];
const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
const w = plan.w ?? 1600, h = plan.h ?? 900;
const page = path.resolve(root, plan.page ?? 'build/index.html');
const url = 'file:///' + page.replace(/\\/g, '/').replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29') + (plan.query ? '?' + plan.query : '');
const outDir = path.resolve(root, plan.outDir ?? 'shots');
fs.mkdirSync(outDir, { recursive: true });
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'jet-'));
const port = 9400 + Math.floor(Math.random() * 500);
const args = ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--enable-gpu', '--ignore-gpu-blocklist', `--use-angle=${plan.angle ?? 'd3d11'}`,
  '--enable-unsafe-swiftshader', `--window-size=${w},${h}`, '--hide-scrollbars', '--allow-file-access-from-files', 'about:blank'];
const proc = spawn(chrome, args, { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(), logs = [];
async function connect() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json`); const j = await r.json(); const p = j.find((t) => t.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch {}
    await sleep(200);
  }
  throw new Error('no devtools');
}
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
try {
  ws = new WebSocket(await connect());
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m.error); pending.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled') logs.push('console.' + m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === 'Log.entryAdded') logs.push('log.' + m.params.entry.level + ': ' + m.params.entry.text);
  };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: plan.dpr ?? 1, mobile: !!plan.mobile });
  const t0 = Date.now();
  await send('Page.navigate', { url });
  await sleep((plan.boot ?? 4) * 1000);
  for (const st of plan.steps ?? []) {
    if (st.js) {
      const r = await send('Runtime.evaluate', { expression: st.js, awaitPromise: true, returnByValue: true });
      if (r?.exceptionDetails) logs.push('STEP ERROR ' + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      else if (r?.result?.value !== undefined && typeof r.result.value !== 'object') console.log('value:', String(r.result.value).slice(0, 1500));
      else if (r?.result?.value) console.log('value:', JSON.stringify(r.result.value).slice(0, 1500));
    }
    await sleep((st.wait ?? 0.5) * 1000);
    if (st.out) {
      const sh = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(outDir, st.out), Buffer.from(sh.data, 'base64'));
      console.log('saved', st.out, ((Date.now() - t0) / 1000).toFixed(1) + 's');
    }
  }
  for (const l of logs.slice(0, 60)) console.log(l.slice(0, 1200));
} catch (e) { console.error('harness error', e); }
finally { try { ws?.close(); } catch {} proc.kill(); await sleep(400); try { fs.rmSync(prof, { recursive: true, force: true }); } catch {} process.exit(0); }
