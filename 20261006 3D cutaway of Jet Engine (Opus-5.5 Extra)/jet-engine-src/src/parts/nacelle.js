// Nacelle: the aerodynamic outer shell. Built as thin hollow sheets so the cutaway shows the
// real wall section (outer skin, inner acoustic barrel, lip, stiffening rings).
import { Mod } from '../module.js';
import { D, nacInner, nacOuter } from '../path.js';
import { rect, cutAtX } from '../geom.js';
import { lerp } from '../util.js';

const T_SKIN = 0.018;

const sampleX = (f, xa, xb, n) => {
  const out = [];
  for (let i = 0; i <= n; i++) { const x = lerp(xa, xb, i / n); out.push([x, f(x)]); }
  return out;
};

// Lip: half ellipse from the inner-barrel start (0.12, 1.168) round the front to the outer skin.
export function lipPath(n = 20) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = Math.PI * i / n;
    out.push([0.12 - 0.12 * Math.sin(a), 1.22 - 0.052 * Math.cos(a)]);
  }
  return out;
}

function sheet(mod, segs, t, backMat, seg = 128) { return mod.sheet(segs, t, backMat, { seg }); }

// ring-shaped bulkhead between the inner barrel and outer skin at axial station x
function bulkhead(mod, x, w = 0.012) {
  const r0 = nacInner(x) + T_SKIN, r1 = nacOuter(x) - T_SKIN;
  mod.solid(rect(x - w / 2, x + w / 2, r0, r1), 'cast', { seg: 128 });
}

export function buildNacelle() {
  // ---- inlet: lip + forward barrel + forward outer skin
  const inlet = new Mod('inlet', 'Air intake', { exOff: -1.25, color: '#7cc4ff' });
  {
    const inner = sampleX(nacInner, 0.70, 0.12, 24);          // travelling -x on the inside
    const [innerAc, innerFront] = cutAtX(inner, 0.30);
    const outer = sampleX(nacOuter, 0.12, 0.70, 24);
    sheet(inlet, [
      { path: innerAc, mat: 'linerAc' },
      { path: innerFront, mat: 'paintIn' },
      { path: lipPath(24), mat: 'paint' },
      { path: outer, mat: 'paint' },
    ], T_SKIN, 'paintIn');
    bulkhead(inlet, 0.20); bulkhead(inlet, 0.52); bulkhead(inlet, 0.69, 0.02);
  }

  // ---- aft nacelle: bypass-duct outer wall and thrust-reverser section
  const aft = new Mod('nacAft', 'Aft nacelle', { exOff: 1.35, color: '#c9d2dc' });
  {
    const inner = sampleX(nacInner, D.xNacTE, 1.40, 44);
    const [innerRest, innerAc] = cutAtX(inner, 2.10);
    const outer = sampleX(nacOuter, 1.40, D.xNacTE, 44);
    sheet(aft, [{ path: innerRest, mat: 'paintIn' }, { path: innerAc, mat: 'linerAc' }], T_SKIN, 'paintIn');
    sheet(aft, [{ path: outer, mat: 'paint' }], T_SKIN, 'paintIn');
    for (const x of [1.43, 2.40, 3.40, 4.40, 5.00]) bulkhead(aft, x, 0.012);
  }
  return { inlet, aft };
}

// Fan-case part of the nacelle: belongs to the fan module so it explodes together with it.
export function addFanCase(fanMod) {
  const inner = sampleX(nacInner, 1.40, 0.70, 28);
  const [a, rest] = cutAtX(inner, 1.14);
  const [rub, b] = cutAtX(rest, 0.74);
  const outer = sampleX(nacOuter, 0.70, 1.40, 28);
  // the sheet's cap must be one closed polygon per skin: inner barrel and outer skin are separate sheets
  const innerSegs = [{ path: a, mat: 'linerAc' }, { path: rub, mat: 'castDark' }, { path: b, mat: 'linerAc' }];
  sheet(fanMod, innerSegs, T_SKIN, 'paintIn');
  sheet(fanMod, [{ path: outer, mat: 'paint' }], T_SKIN, 'paintIn');
  // containment ring (wound-composite fan case) behind the inner barrel
  const x0 = 0.76, x1 = 1.12;
  const ring = [[x0, nacInner(x0) + T_SKIN + 0.052], [x1, nacInner(x1) + T_SKIN + 0.052], [x1, nacInner(x1) + T_SKIN], [x0, nacInner(x0) + T_SKIN]];
  fanMod.solid(ring, 'blackSteel', { seg: 128 });
  for (const x of [0.71, 1.39]) {
    const ra = nacInner(x) + T_SKIN, rb = nacOuter(x) - T_SKIN;
    fanMod.solid(rect(x - 0.008, x + 0.008, ra, rb), 'cast', { seg: 128 });
  }
}
