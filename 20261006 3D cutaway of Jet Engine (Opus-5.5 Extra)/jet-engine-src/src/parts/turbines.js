// High-pressure turbine (two stages on N2) and low-pressure turbine (five stages on N1) with the
// inter-turbine duct. Hot-section parts carry a heat glow driven by throttle.
import { Mod } from '../module.js';
import { D, coreHub, coreCase } from '../path.js';
import { sampleX, rect } from '../geom.js';
import { lerp } from '../util.js';
import { bladeRow, discPoly, ringPoly } from './blades.js';
import { shaftTube, bearing } from './shafts.js';

export function buildHPT() {
  const m = new Mod('hpt', 'High-pressure turbine', { exOff: 1.1, color: '#ff6a3d' });
  const x0 = D.hpt.x0, x1 = D.hpt.x1;

  m.sheet([{ path: sampleX(coreCase, x1, x0 + 0.02, 24), mat: 'hotcase' }], 0.022, 'castDark');
  m.sheet([{ path: sampleX(coreHub, x0, x1, 18), mat: 'hotcase' }], 0.020, 'castDark');
  for (const x of [3.90, 4.04, 4.27]) m.solid(rect(x - 0.010, x + 0.010, coreCase(x) + 0.022, coreCase(x) + 0.046), 'cast', { seg: 96 });

  const rows = [
    { x: 3.895, c: 0.060, n: 36, rotor: false, g: [0.50, 0.58], camber: -0.12, thick: [0.18, 0.12] },
    { x: 3.975, c: 0.052, n: 62, rotor: true, g: [0.30, 0.52], camber: -0.16, thick: [0.20, 0.08] },
    { x: 4.080, c: 0.058, n: 44, rotor: false, g: [0.50, 0.58], camber: -0.12, thick: [0.18, 0.12] },
    { x: 4.185, c: 0.056, n: 70, rotor: true, g: [0.30, 0.54], camber: -0.16, thick: [0.20, 0.08] },
  ];
  rows.forEach((r, i) => {
    const hub = coreHub(r.x), cs = coreCase(r.x);
    bladeRow(m, {
      x: r.x, chord: r.c, n: r.n, rh: r.rotor ? hub - 0.004 : hub - 0.002, rt: r.rotor ? cs - 0.003 : cs + 0.003,
      gamma: r.g, camber: r.camber, thick: r.thick, ns: 5, nc: 10, mat: r.rotor ? 'hotblade' : 'hotblade',
      rotor: r.rotor, sp: 'n2', phase: i * 0.27,
    });
    if (r.rotor) m.solid(discPoly(r.x, hub - 0.012, D.n2.ro, { rimW: 0.075, boreW: 0.11, webW: 0.022, rimH: 0.05 }), 'disc2', { sp: 'n2', seg: 96, split: 25 });
  });
  shaftTube(m, 'n2', x0, 4.24);
  shaftTube(m, 'n1', x0, x1);
  return m;
}

export function buildLPT() {
  const m = new Mod('lpt', 'Low-pressure turbine', { exOff: 1.55, color: '#ff5a5a' });
  const x0 = D.idt.x0, x1 = 5.30;

  // ---- casing (cooling-air ribs outside) and hub walls
  m.sheet([{ path: sampleX(coreCase, x1, x0, 50), mat: 'hotcase' }], 0.022, 'castDark');
  for (let x = 4.56; x <= 5.28; x += 0.075) m.solid(rect(x - 0.005, x + 0.005, coreCase(x) + 0.022, coreCase(x) + 0.046), 'castDark', { seg: 96 });
  m.sheet([{ path: sampleX(coreHub, x0, D.idt.x1, 8), mat: 'cast' }], 0.016, 'castDark');

  // ---- inter-turbine duct struts
  bladeRow(m, { x: 4.40, chord: 0.12, n: 12, rh: coreHub(4.40) - 0.003, rt: coreCase(4.40) + 0.003, gamma: [0, 0], camber: 0, thick: [0.14, 0.14], ns: 5, nc: 10, mat: 'cast', rotor: false });

  // ---- five stages
  for (let i = 0; i < 5; i++) {
    const xn = 4.545 + 0.15 * i, xr = xn + 0.078;
    const nN = [56, 62, 68, 74, 80][i], nR = [70, 78, 86, 94, 100][i];
    const cN = 0.060 + 0.004 * i, cR = 0.070 + 0.005 * i;
    bladeRow(m, { x: xn, chord: cN, n: nN, rh: coreHub(xn) - 0.002, rt: coreCase(xn) + 0.003, gamma: [0.46, 0.56], camber: -0.10, thick: [0.14, 0.10], ns: 4, nc: 8, mat: 'nickel', rotor: false, phase: i * 0.11 });
    const hub = coreHub(xr), cs = coreCase(xr);
    bladeRow(m, { x: xr, chord: cR, n: nR, rh: hub - 0.004, rt: cs - 0.005, gamma: [0.34, 0.52], camber: -0.11, thick: [0.14, 0.07], ns: 5, nc: 8, mat: 'hotblade', rotor: true, sp: 'n1', phase: i * 0.19 });
    // tip shroud ring and disc
    m.solid(ringPoly(xr, cR * 0.9, cs - 0.007, cs + 0.006), 'steel', { sp: 'n1', seg: 120, split: 40 });
    m.solid(discPoly(xr, hub - 0.012, 0.22, { rimW: 0.062, boreW: 0.05, webW: 0.012, rimH: 0.035 }), 'disc1', { sp: 'n1', seg: 96, split: 25 });
  }
  // rotor drum joining the discs and the cone to the LP shaft
  m.sheet([{ path: [[4.60, 0.22], [5.27, 0.22]], mat: 'disc1' }], 0.014, 'castDark', { sp: 'n1', seg: 96 });
  m.sheet([{ path: [[4.50, 0.080], [4.56, 0.130], [4.62, 0.222]], mat: 'disc1' }], 0.014, 'castDark', { sp: 'n1', seg: 80 });
  shaftTube(m, 'n1', x0, 4.52);

  // ---- bearing #5 (LP shaft, roller) carried from the duct hub
  bearing(m, 'n1', 4.37, D.n1.ro, 0.136, 0.05, 'roller', 14);
  m.sheet([{ path: [[4.44, coreHub(4.44) - 0.01], [4.40, 0.210], [4.36, 0.140]], mat: 'cast' }], 0.010, 'castDark', { seg: 64 });
  return m;
}
