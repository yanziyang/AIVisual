// Tunes the shishi-odoshi cycle without a browser: loads the layout and physics parts and simulates 40 s.
// usage: node simcheck.mjs [flow L/s]
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const src = ['p1_util.js', 'p4_layout.js', 'p9a_physics.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const flow = parseFloat(process.argv[2] || '0.06');
const run = new Function('flow', src + `
  const dt = 1/240, log = []; let minTh = 9, lastPrint = -1, tipStart = null;
  for (let i=0;i<40*240;i++){
    const inflow = SH.th > SHISHI.rest - 0.1 ? flow : 0;
    const was = SH.impacts.length;
    stepShishi(dt, inflow);
    minTh = Math.min(minTh, SH.th);
    if (SH.impacts.length > was) log.push({ t: SH.t.toFixed(2), v: SH.impacts[SH.impacts.length-1].toFixed(2), minDeg: (minTh*180/Math.PI).toFixed(1) });
    if (SH.impacts.length > was) minTh = 9;
    if (tipStart === null && SH.th < SHISHI.rest - 0.01) tipStart = SH.t;
  }
  return { log, cycle: SH.cycle, restDeg: SHISHI.rest*180/Math.PI, capRest: vCap(SHISHI.rest), mouthRest: SHISHI.mouthRest, spoutEnd: SHISHI.spoutEnd, backRest: SHISHI.backRest, firstTip: tipStart };
`);
const r = run(flow);
console.log('flow', flow, 'L/s  rest', r.restDeg.toFixed(1), 'deg  cap at rest', r.capRest.toFixed(2), 'L  first tip at', r.firstTip?.toFixed(2), 's  cycle', r.cycle.toFixed(2), 's');
console.log('mouth', r.mouthRest.map(v=>v.toFixed(3)).join(','), ' spout end', r.spoutEnd.map(v=>v.toFixed(3)).join(','), ' back', r.backRest.map(v=>v.toFixed(3)).join(','));
for (const l of r.log.slice(0, 16)) console.log('  impact t', l.t, 's  v', l.v, 'm/s  lowest angle before it', l.minDeg, 'deg');
