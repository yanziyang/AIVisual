// Compressor / turbine blade rows and disc profiles.
import { bladeGeometry, rect } from '../geom.js';
import { lerp } from '../util.js';

// Build one blade row.
//   x: row centre, chord, n: blade count, rh/rt: root/tip radius
//   gamma: [root, tip] stagger (rad), camber, thick: [root, tip] thickness ratio
//   rotor: true -> spins with the spool, uncut; false -> stator vane, cut with the casing
export function bladeRow(mod, o) {
  const dir = o.rotor ? 1 : -1;
  const [g0, g1] = o.gamma;
  const [t0, t1] = o.thick;
  const sec = (s) => {
    const gamma = lerp(g0, g1, s);
    const chord = o.chord * lerp(1.0, o.taper ?? 1.0, s);
    const axial = chord * Math.cos(gamma);
    return { xle: o.x - axial / 2, chord, gamma, camber: o.camber, thick: lerp(t0, t1, s), tle: 0.5 * chord * Math.sin(gamma) };
  };
  const geo = bladeGeometry({ rh: o.rh, rt: o.rt, ns: o.ns ?? 3, nc: o.nc ?? 8, dir, sec });
  return mod.row(geo, o.mat, o.n, { sp: o.rotor ? o.sp : null, rotor: o.rotor, cut: o.rotor ? false : undefined, phase: o.phase ?? 0, ringR: [o.rh, o.rt], shadow: o.shadow ?? o.chord >= 0.058 });
}

// Compressor/turbine disc cross-section (clockwise polygon): wide rim, thin web, fat bore.
export function discPoly(xc, rRim, rBore, { rimW = 0.05, boreW = 0.06, webW = 0.012, rimH = 0.03 } = {}) {
  const rw = rimW / 2, bw = boreW / 2, ww = webW / 2;
  const rWebTop = rRim - rimH, rWebBot = rBore + Math.min(0.06, (rWebTop - rBore) * 0.35);
  return [
    [xc - rw, rRim], [xc + rw, rRim], [xc + rw, rRim - rimH * 0.5], [xc + ww, rWebTop],
    [xc + ww, rWebBot], [xc + bw, rBore + (rWebBot - rBore) * 0.45], [xc + bw, rBore],
    [xc - bw, rBore], [xc - bw, rBore + (rWebBot - rBore) * 0.45], [xc - ww, rWebBot],
    [xc - ww, rWebTop], [xc - rw, rRim - rimH * 0.5],
  ];
}

// small ring (shroud / seal / flange) polygon
export const ringPoly = (xc, w, r0, r1) => rect(xc - w / 2, xc + w / 2, r0, r1);
