// Checks where the kakei jet lands for each flow setting (it must land in the tube's mouth at rest).
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const src = ['p1_util.js', 'p4_layout.js', 'p9a_physics.js', 'p9b_fx.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const run = new Function(src + `
  const out = [];
  for (const f of [0.005, 0.02, 0.05, 0.08, 0.12, 0.16, 0.2, 0.25]){ SH.flow = f; SH.th = SHISHI.rest; updateStreams(0.016);
    const L = tubeLocal(FX.jet.end, SH.th); out.push([f, FX.jet.hit, L.s.toFixed(3), L.rho.toFixed(3)]); }
  return out;`);
for (const r of run()) console.log('flow', r[0], 'L/s ->', r[1], ' s', r[2], ' rho', r[3]);
