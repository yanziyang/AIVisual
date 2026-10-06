// Annular combustor: diffuser, outer/inner cases, perforated flame tube (liner), 20 fuel nozzles.
import * as THREE from 'three';
import { Mod } from '../module.js';
import { D, coreHub, coreCase } from '../path.js';
import { sampleX, rect, arcPts, sheetPoly, dedupe } from '../geom.js';
import { smoothstep, TAU } from '../util.js';
import { shaftTube, bearing } from './shafts.js';

export const COMB = {
  xDome: 3.28, xExit: 3.86,
  rIn: (x) => 0.378 - 0.015 * smoothstep(3.5, 3.86, x),
  rOut: (x) => 0.545 - 0.045 * smoothstep(3.5, 3.86, x),
  nozzles: 20,
};

export function buildComb() {
  const m = new Mod('comb', 'Combustor', { exOff: 0.65, color: '#ff8a3d' });
  const x0 = D.diff.x0, x1 = 3.88;

  // ---- outer case: diffuser flare, then the combustor case (inner face to the air)
  m.sheet([{ path: sampleX(coreCase, x1, x0, 60), mat: 'cast' }], 0.024, 'castDark');
  for (const x of [3.12, 3.24, 3.56, 3.86]) m.solid(rect(x - 0.010, x + 0.010, coreCase(x) + 0.024, coreCase(x) + 0.050), 'cast', { seg: 96 });
  // ---- inner case (hub wall)
  m.sheet([{ path: sampleX(coreHub, x0, x1, 24), mat: 'cast' }], 0.022, 'castDark');

  // ---- liner (flame tube): double-sided sheet with dilution holes
  {
    const pts = [];
    for (let x = COMB.xExit; x >= 3.30; x -= 0.04) pts.push([x, COMB.rIn(x)]);
    pts.push([3.30, COMB.rIn(3.30)]);
    pts.push(...arcPts(3.30, COMB.rIn(3.30) + 0.02, 0.02, -Math.PI / 2, -Math.PI, 5).slice(1));
    pts.push([COMB.xDome, 0.40], [COMB.xDome, 0.525]);
    pts.push(...arcPts(3.30, COMB.rOut(3.30) - 0.02, 0.02, Math.PI, Math.PI / 2, 5).slice(1));
    for (let x = 3.34; x <= COMB.xExit + 1e-6; x += 0.04) pts.push([x, COMB.rOut(x)]);
    const holes = { HOLES: '', HOLE_X0: '3.38', HOLE_DX: '0.085', HOLE_ROWS: '5.0', HOLE_N: '40.0', HOLE_R: '0.0078' };
    const mat = m.m('tbc', { defs: holes, key: 'liner' });
    m.surf(pts, mat, { seg: 120, split: 50 });
    m.cap(sheetPolyOf(pts, 0.006));
    // swirl-cup openings in the dome are drawn as small rings
    m.heatMat = mat;
  }

  // ---- fuel nozzles: stem + swirler cup, 20 around the annulus
  {
    const n = COMB.nozzles;
    const a = new THREE.Vector3(3.19, 0.655, 0), b = new THREE.Vector3(3.285, 0.468, 0);
    const dir = b.clone().sub(a), len = dir.length(); dir.normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const stemGeo = new THREE.CylinderGeometry(0.011, 0.014, len, 12, 1);
    const cupGeo = new THREE.CylinderGeometry(0.034, 0.030, 0.052, 20, 1, true); cupGeo.rotateZ(Math.PI / 2); cupGeo.translate(3.31, 0.462, 0);
    const ringGeo = new THREE.TorusGeometry(0.034, 0.006, 8, 20); ringGeo.rotateY(Math.PI / 2); ringGeo.translate(3.285, 0.462, 0);
    const stems = new THREE.InstancedMesh(stemGeo, m.m('steel', { cut: true }), n);
    const cups = new THREE.InstancedMesh(cupGeo, m.m('tbc', { key: 'cup' }), n);
    const rings = new THREE.InstancedMesh(ringGeo, m.m('copper'), n);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const m4 = new THREE.Matrix4(), mm = new THREE.Matrix4(), rx = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      rx.makeRotationX(TAU * i / n + 0.08);
      mm.compose(mid, q, new THREE.Vector3(1, 1, 1));
      m4.multiplyMatrices(rx, mm); stems.setMatrixAt(i, m4);
      cups.setMatrixAt(i, rx); rings.setMatrixAt(i, rx);
    }
    for (const im of [stems, cups, rings]) { im.castShadow = true; im.receiveShadow = true; m.add(im); }
    // fuel manifold ring
    const man = new THREE.TorusGeometry(0.665, 0.013, 10, 140); man.rotateY(Math.PI / 2); man.translate(3.19, 0, 0);
    const mf = new THREE.Mesh(man, m.m('copper')); mf.castShadow = true; m.add(mf);
  }

  // ---- HP shaft through the middle + bearing #4
  shaftTube(m, 'n2', 3.12, D.hpt.x0);
  shaftTube(m, 'n1', D.diff.x0, D.hpt.x0);
  bearing(m, 'n2', 3.17, D.n2.ro, 0.226, 0.05, 'roller', 16);
  m.sheet([{ path: [[3.26, coreHub(3.26) - 0.01], [3.22, 0.262], [3.18, 0.230]], mat: 'cast' }], 0.010, 'castDark', { seg: 64 });
  return m;
}

function sheetPolyOf(path, t) { return sheetPoly(dedupe(path, 1e-7), t); }
