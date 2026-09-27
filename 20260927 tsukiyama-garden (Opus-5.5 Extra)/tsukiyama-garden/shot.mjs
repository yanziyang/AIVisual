// Test harness: opens the built page in headless Chrome (GPU on), waits, reports errors, saves screenshots.
// usage: node shot.mjs "<query string>" out.png [waitSeconds] [width] [height] ["js to eval before shot"]
import { spawn } from 'child_process'; import fs from 'fs'; import path from 'path'; import os from 'os'; import { fileURLToPath } from 'url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const [,, qs = '', out = 'shot.png', wait = '8', w = '1600', h = '900', pre = ''] = process.argv;
const file = fs.readdirSync(path.join(dir, '..')).filter(f => /^Tsukiyama Garden v[\d.]+\.html$/.test(f)).sort().pop();
const url = 'file:///' + path.join(dir, '..', file).replace(/\\/g, '/').replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29') + (qs ? '?' + qs : '');
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'tsk-'));
const port = 9300 + Math.floor(Math.random()*500);
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11',
  '--enable-unsafe-swiftshader', `--window-size=${w},${h}`, '--hide-scrollbars', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(), logs = [];
async function connect(){
  for (let i=0;i<50;i++){ try { const r = await fetch(`http://127.0.0.1:${port}/json`); const j = await r.json(); const p = j.find(t => t.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch {} await sleep(200); }
  throw new Error('no devtools');
}
const send = (method, params={}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id:i, method, params })); });
try {
  ws = new WebSocket(await connect());
  await new Promise(r => ws.onopen = r);
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)){ pending.get(m.id)(m.result ?? m.error); pending.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled') logs.push('console.' + m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === 'Log.entryAdded') logs.push('log.' + m.params.entry.level + ': ' + m.params.entry.text); };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width:+w, height:+h, deviceScaleFactor:1, mobile:false });
  const t0 = Date.now();
  await send('Page.navigate', { url });
  await sleep(+wait*1000);
  // pre: JSON list of [js, file, waitSeconds] steps; each step runs js, waits, then saves a screenshot
  if (pre){ for (const [js, f, ws] of JSON.parse(pre)){
    const r = await send('Runtime.evaluate', { expression: js, awaitPromise: true }); if (r?.exceptionDetails) logs.push('STEP ERROR ' + JSON.stringify(r.exceptionDetails));
    await sleep((ws ?? 3)*1000); const sh = await send('Page.captureScreenshot', { format:'png' }); fs.writeFileSync(path.join(dir, f), Buffer.from(sh.data, 'base64')); console.log('saved', f); } }
  const info = await send('Runtime.evaluate', { expression: `JSON.stringify({ err: document.getElementById('err').textContent, loading: !!document.getElementById('loading'), dbg: document.getElementById('dbg').textContent, gl: (()=>{ const c=document.createElement('canvas').getContext('webgl2'); const e=c&&c.getExtension('WEBGL_debug_renderer_info'); return e? c.getParameter(e.UNMASKED_RENDERER_WEBGL):'?'; })() })`, returnByValue: true });
  console.log('page state:', info?.result?.value);
  const shot = await send('Page.captureScreenshot', { format:'png' });
  fs.writeFileSync(path.join(dir, out), Buffer.from(shot.data, 'base64'));
  console.log('saved', out, 'after', ((Date.now()-t0)/1000).toFixed(1), 's');
  for (const l of logs.slice(0, 40)) console.log(l.slice(0, 1500));
} catch (e) { console.error('harness error', e); }
finally { try { ws?.close(); } catch {} proc.kill(); await sleep(500); try { fs.rmSync(prof, { recursive:true, force:true }); } catch {} process.exit(0); }
