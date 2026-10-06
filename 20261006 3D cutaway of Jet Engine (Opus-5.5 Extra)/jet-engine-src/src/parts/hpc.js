// High-pressure compressor: nine rotor stages on the HP spool (N2), rows of stator vanes between.
// The rotor is a hollow drum of stacked discs; the LP shaft passes through the middle.
import { Mod } from '../module.js';
import { D, coreHub, coreCase } from '../path.js';
import { sampleX, rect } from '../geom.js';
import { lerp } from '../util.js';
import { bladeRow, discPoly } from './blades.js';
import { shaftTube, bearing } from './shafts.js';

export function buildHPC() {
  const m = new Mod('hpc', 'High-pressure compressor', { exOff: 0.2, color: '#ffb35c' });
  const x0 = D.hpc.x0, x1 = D.hpc.x1;

  // ---- casing with split-line flanges and a bleed manifold
  m.sheet([{ path: sampleX(coreCase, x1, x0, 40), mat: 'cast' }], 0.024, 'castDark');
  for (const x of [x0 + 0.01, 2.58, x1 - 0.01]) m.solid(rect(x - 0.012, x + 0.012, coreCase(x) + 0.024, coreCase(x) + 0.050), 'cast', { seg: 96 });
  m.solid(rect(2.86, 2.96, coreCase(2.9) + 0.024, coreCase(2.9) + 0.060), 'castDark', { seg: 96 }); // bleed manifold

  // ---- rotor: drum surface + front/rear cones to the HP shaft (all N2)
  m.sheet([{ path: sampleX(coreHub, x0 + 0.02, x1 - 0.06, 20), mat: 'steel' }], 0.014, 'castDark', { sp: 'n2' });
  m.sheet([{ path: [[x0 + 0.02, 0.338], [2.07, 0.215], [2.02, 0.168]], mat: 'disc2' }], 0.014, 'castDark', { sp: 'n2', seg: 80 });
  m.sheet([{ path: [[x1 - 0.06, 0.352], [3.06, 0.26], [3.12, 0.168]], mat: 'disc2' }], 0.014, 'castDark', { sp: 'n2', seg: 80 });

  // ---- nine stages
  for (let i = 0; i < 9; i++) {
    const f = i / 8;
    const xr = 2.21 + 0.10 * i, xs = xr + 0.05;
    const cR = lerp(0.050, 0.031, f), cS = lerp(0.048, 0.030, f);
    const nR = Math.round(lerp(60, 88, f)), nS = Math.round(lerp(64, 94, f));
    const hubR = coreHub(xr), csR = coreCase(xr), hubS = coreHub(xs), csS = coreCase(xs);
    bladeRow(m, { x: xr, chord: cR, n: nR, rh: hubR - 0.004, rt: csR - 0.003, gamma: [0.78, 1.0], camber: 0.06, thick: [0.08, 0.04], ns: 3, nc: 6, mat: i < 5 ? 'steel' : 'nickel', rotor: true, sp: 'n2', phase: i * 0.21 });
    bladeRow(m, { x: xs, chord: cS, n: nS, rh: hubS + 0.004, rt: csS + 0.004, gamma: [0.50, 0.60], camber: 0.05, thick: [0.08, 0.05], ns: 3, nc: 6, mat: i < 5 ? 'steel' : 'nickel', rotor: false, phase: i * 0.13 });
    m.solid(discPoly(xr, hubR - 0.014, 0.25, { rimW: 0.058, boreW: 0.04, webW: 0.010, rimH: 0.026 }), 'disc2', { sp: 'n2', seg: 96, split: 25 });
  }
  // inlet guide vanes (variable stator) and exit guide vanes
  bladeRow(m, { x: 2.172, chord: 0.046, n: 56, rh: coreHub(2.172) + 0.004, rt: coreCase(2.172) + 0.004, gamma: [0.30, 0.42], camber: 0.04, thick: [0.09, 0.06], ns: 3, nc: 8, mat: 'steel', rotor: false });
  bladeRow(m, { x: 3.08, chord: 0.040, n: 100, rh: coreHub(3.08) + 0.004, rt: coreCase(3.08) + 0.004, gamma: [0.40, 0.40], camber: 0.03, thick: [0.07, 0.05], ns: 3, nc: 8, mat: 'nickel', rotor: false });

  // ---- HP shaft stub at the front and bearing #3 (ball thrust bearing)
  shaftTube(m, 'n2', 2.00, 2.06);
  shaftTube(m, 'n1', x0, x1);
  bearing(m, 'n2', 2.03, D.n2.ro, 0.226, 0.05, 'ball', 18);
  return m;
}
