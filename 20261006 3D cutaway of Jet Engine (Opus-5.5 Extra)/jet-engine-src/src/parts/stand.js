// Maintenance cradle the cutaway engine sits on, so it doesn't float. Hidden when the engine is exploded.
import * as THREE from 'three';
import { Mod } from '../module.js';
import { nacOuter } from '../path.js';
import { lathe, rect } from '../geom.js';

export const FLOOR_Y = -1.95;

export function buildStand() {
  const m = new Mod('stand', 'Display stand', { exOff: 0, color: '#6c7683' });
  const dark = m.m('blackSteel', { cut: false });
  const rubber = m.m('dark', { cut: false });
  const add = (geo, mat, x, y, z) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.cast = true;
    m.group.add(mesh); m.meshes.push(mesh);
    return mesh;
  };
  for (const x of [1.75, 4.15]) {
    const r = nacOuter(x);
    // saddle: a 150-degree arc under the nacelle, with a rubber pad
    const arcA = Math.PI - 0.62, arcB = Math.PI + 0.62;
    const saddle = lathe(rect(x - 0.07, x + 0.07, r + 0.012, r + 0.065).concat([[x - 0.07, r + 0.065]]), { seg: 40, split: 30, a0: arcA, a1: arcB });
    const m1 = new THREE.Mesh(saddle, dark); m1.castShadow = true; m1.receiveShadow = true; m1.userData.cast = true; m.group.add(m1); m.meshes.push(m1);
    const pad = lathe(rect(x - 0.055, x + 0.055, r + 0.001, r + 0.014).concat([[x - 0.055, r + 0.014]]), { seg: 40, split: 30, a0: arcA, a1: arcB });
    const m2 = new THREE.Mesh(pad, rubber); m2.receiveShadow = true; m.group.add(m2); m.meshes.push(m2);
    // pedestal and foot
    const top = -(r + 0.065) + 0.02;
    const h = top - (FLOOR_Y + 0.06);
    add(new THREE.BoxGeometry(0.14, h, 0.5), dark, x, FLOOR_Y + 0.06 + h / 2, 0);
    add(new THREE.BoxGeometry(0.62, 0.06, 1.5), dark, x, FLOOR_Y + 0.03, 0);
    // gussets
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.1, 0.5, 0.06), dark, x, FLOOR_Y + 0.3, s * 0.28);
  }
  return m;
}
