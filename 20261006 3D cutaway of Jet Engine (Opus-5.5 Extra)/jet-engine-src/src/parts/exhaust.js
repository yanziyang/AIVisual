// Turbine rear frame struts and the hollow tail plug, plus the core cowl and core nozzle.
import { Mod } from '../module.js';
import { D, plugR, cowlOut, coreHub, nozzleIn } from '../path.js';
import { sampleX, rect, reversePath } from '../geom.js';
import { smoothstep, lerp } from '../util.js';
import { bladeRow } from './blades.js';

export function buildExhaust() {
  const m = new Mod('exhaust', 'Exhaust plug', { exOff: 2.0, color: '#ffc27a' });
  // hollow plug: thin shell to x = 6.3, solid tip beyond
  const outer = sampleX(plugR, D.trf.x0, 6.55, 60);
  const inner = [];
  for (let x = 6.30; x >= D.trf.x0 - 1e-6; x -= 0.05) inner.push([x, Math.max(0.01, plugR(x) - 0.016)]);
  const poly = outer.concat([[6.30, 0.0]]).concat(inner);
  m.solid(poly, 'plug', { seg: 96, split: 40 });
  // inside of the shell (visible when cut)
  m.surf(inner, 'castDark', { seg: 96 });
  // turbine rear frame struts across the exhaust annulus
  bladeRow(m, { x: 5.38, chord: 0.14, n: 11, rh: plugR(5.38) - 0.003, rt: nozzleIn(5.38) + 0.003, gamma: [0, 0], camber: 0, thick: [0.14, 0.14], ns: 6, nc: 10, mat: 'cast', rotor: false });
  // rear frame hub ring
  m.solid(rect(5.30, 5.46, plugR(5.30) - 0.03, plugR(5.30)), 'cast', { seg: 96 });
  return m;
}

// Core cowl: the inner wall of the bypass duct, from the splitter nose to the core nozzle lip.
export function buildCowl() {
  const m = new Mod('cowl', 'Core cowl & nozzle', { exOff: 1.0, color: '#c9d2dc' });
  const thk = (x) => (x <= 5.30 ? 0.012 + 0.008 * smoothstep(1.28, 1.9, x) + 0.030 * smoothstep(5.1, 5.3, x) : lerp(0.05, 0.022, (x - 5.3) / 0.42));
  const xe = 5.72, xs = 1.30;
  const outerAsc = sampleX(cowlOut, xs, xe, 90);
  const innerAsc = outerAsc.map(([x, r]) => [x, r - thk(x)]);
  // splitter nose: tiny half-ellipse from the inner to the outer skin at xs
  const rin = innerAsc[0][1], rout = outerAsc[0][1], rm = (rin + rout) / 2, ar = (rout - rin) / 2;
  const nose = [];
  for (let i = 0; i <= 12; i++) { const a = Math.PI * i / 12; nose.push([xs - 0.032 * Math.sin(a), rm - ar * Math.cos(a)]); }
  const innerDesc = innerAsc.slice().reverse();
  const [innerComp, innerNozzle] = (() => { const k = innerDesc.findIndex((p) => p[0] <= 5.30); return [innerDesc.slice(k), innerDesc.slice(0, k + 1)]; })();
  m.surf(innerNozzle, 'hotcase', { seg: 128, split: 50 });
  m.surf(innerComp, 'cowlIn', { seg: 128, split: 50 });
  m.surf(nose, 'cowl', { seg: 128, split: 70 });
  m.surf(outerAsc, 'cowl', { seg: 128, split: 50 });
  m.surf([[xe, rout_at(outerAsc)], [xe, innerAsc[innerAsc.length - 1][1]]], 'cowl', { seg: 128, split: 80 });
  m.cap(nose.concat(outerAsc.slice(1)).concat(innerDesc));
  return m;
}
const rout_at = (p) => p[p.length - 1][1];
