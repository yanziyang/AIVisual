// Shafts and bearings. Two concentric spools: the LP shaft (N1) runs inside the hollow HP shaft (N2).
import * as THREE from 'three';
import { D } from '../path.js';
import { rect, bladeGeometry } from '../geom.js';
import { TAU } from '../util.js';

// hollow shaft tube between x0 and x1 (belongs to the module's spool group)
export function shaftTube(mod, spool, x0, x1) {
  const s = spool === 'n1' ? D.n1 : D.n2;
  const poly = rect(x0, x1, s.ri, s.ro);
  mod.solid(poly, spool === 'n1' ? 'shaft1' : 'shaft2', { sp: spool, seg: 48, split: 60 });
  // spline collars every so often so the shaft doesn't read as a bare pipe
  const n = Math.max(1, Math.round((x1 - x0) / 0.38));
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * (n ? i / n : 0);
    const w = 0.012;
    if (x - w < x0 - 1e-6 && i === 0) continue;
    mod.solid(rect(x - w, x + w, s.ro, s.ro + 0.008), spool === 'n1' ? 'shaft1' : 'shaft2', { sp: spool, seg: 48, split: 60, cap: false });
  }
}

// Rolling-element bearing: static outer race + housing ring, spinning inner race and rollers.
//   kind 'ball' | 'roller'
export function bearing(mod, spool, x, rIn, rOut, w = 0.05, kind = 'roller', n = 16) {
  const t = 0.014;
  mod.solid(rect(x - w / 2, x + w / 2, rOut - t, rOut), 'bearing', { seg: 64, split: 60 });
  mod.solid(rect(x - w / 2, x + w / 2, rIn, rIn + t), 'bearing', { sp: spool, seg: 64, split: 60 });
  const rc = (rIn + t + rOut - t) / 2, rr = (rOut - t - rIn - t) / 2;
  let geo;
  if (kind === 'ball') geo = new THREE.SphereGeometry(rr, 14, 10);
  else { geo = new THREE.CylinderGeometry(rr * 0.92, rr * 0.92, w * 0.9, 14, 1); geo.rotateZ(Math.PI / 2); }
  const mesh = new THREE.InstancedMesh(geo, mod.m('bearing', { cut: false }), n);
  const m4 = new THREE.Matrix4(), tr = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const a = TAU * i / n;
    m4.makeRotationX(a).multiply(tr.makeTranslation(x, rc, 0));
    mesh.setMatrixAt(i, m4);
  }
  mesh.castShadow = true; mesh.receiveShadow = true;
  mod.add(mesh, spool);
  return mesh;
}
