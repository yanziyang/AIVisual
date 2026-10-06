// Booster (low-pressure compressor) and the intermediate case behind it.
// Three rotor stages on the LP spool (N1), static vanes in between.
import { Mod } from '../module.js';
import { D, coreHub, coreCase } from '../path.js';
import { sampleX, rect } from '../geom.js';
import { bladeRow, discPoly } from './blades.js';
import { shaftTube } from './shafts.js';

export function buildLPC() {
  const m = new Mod('lpc', 'Booster (LP compressor)', { exOff: -0.25, color: '#6fc3ff' });
  const x0 = D.lpc.x0, x1 = D.inter.x1;

  // ---- static casing (core inlet through the intermediate duct): inner face toward the air
  m.sheet([{ path: sampleX(coreCase, x1, x0, 40), mat: 'cast' }], 0.022, 'castDark');
  for (const x of [1.40, 1.62, 1.86, 2.10]) m.solid(rect(x - 0.008, x + 0.008, coreCase(x) + 0.022, coreCase(x) + 0.040), 'cast', { seg: 96 });

  // ---- rotor drum: hub flow path, spinning with N1 (blades ride on it)
  m.sheet([{ path: sampleX(coreHub, x0, D.lpc.x1, 18), mat: 'tiDark' }], 0.012, 'castDark', { sp: 'n1' });

  const R = [{ x: 1.42, n: 38, c: 0.078 }, { x: 1.58, n: 44, c: 0.072 }, { x: 1.74, n: 50, c: 0.066 }];
  const S = [{ x: 1.352, n: 40, c: 0.046 }, { x: 1.50, n: 46, c: 0.056 }, { x: 1.66, n: 52, c: 0.056 }, { x: 1.81, n: 58, c: 0.052 }];
  R.forEach((r, i) => {
    const hub = coreHub(r.x), cs = coreCase(r.x);
    bladeRow(m, { x: r.x, chord: r.c, n: r.n, rh: hub - 0.004, rt: cs - 0.004, gamma: [0.62, 0.98], camber: 0.065, thick: [0.075, 0.035], taper: 0.85, ns: 4, nc: 9, mat: 'ti', rotor: true, sp: 'n1', phase: i * 0.31 });
    m.solid(discPoly(r.x, hub - 0.012, 0.31, { rimW: 0.06, boreW: 0.05, webW: 0.012, rimH: 0.03 }), 'disc1', { sp: 'n1', seg: 96, split: 25 });
  });
  S.forEach((s, i) => {
    const hub = coreHub(s.x), cs = coreCase(s.x);
    bladeRow(m, { x: s.x, chord: s.c, n: s.n, rh: hub + 0.004, rt: cs + 0.004, gamma: [0.34, 0.46], camber: 0.055, thick: [0.075, 0.05], ns: 4, nc: 9, mat: 'tiDark', rotor: false, phase: i * 0.17 });
  });

  shaftTube(m, 'n1', x0, x1);

  // ---- intermediate case: static hub wall + radial struts across the S-duct
  m.sheet([{ path: sampleX(coreHub, D.inter.x0, x1, 14), mat: 'cast' }], 0.014, 'castDark');
  const xs = 1.99;
  const strut = (rh, rt) => ({
    x: xs, chord: 0.11, n: 14, rh, rt, gamma: [0.0, 0.0], camber: 0, thick: [0.13, 0.13], ns: 5, nc: 10, mat: 'cast', rotor: false,
  });
  bladeRow(m, strut(coreHub(xs) - 0.003, coreCase(xs) + 0.003));

  // ---- bearing support cones (static): carry bearings #1/#2 (N1, in the fan hub) and #3 (N2)
  m.sheet([{ path: [[1.10, 0.140], [1.30, 0.172], [1.60, 0.212], [1.92, 0.268], [1.98, 0.300]], mat: 'cast' }], 0.010, 'castDark', { seg: 64 });
  m.sheet([{ path: [[1.98, 0.300], [2.00, 0.262], [2.03, 0.232]], mat: 'cast' }], 0.010, 'castDark', { seg: 64 });
  m.solid(rect(1.965, 1.985, 0.296, coreHub(1.975) - 0.014), 'cast', { seg: 96 });
  return m;
}
