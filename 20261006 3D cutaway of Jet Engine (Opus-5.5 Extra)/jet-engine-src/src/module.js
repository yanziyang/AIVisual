// A Module is one removable chunk of the engine (fan, booster, HP compressor ...). It owns
//   group  - static parts (casings, vanes, cut faces)
//   n1/n2  - child groups that spin with the LP / HP spool
// and knows how to fade (ghost) and explode itself.
import * as THREE from 'three';
import { lathe, capGeometry, bladeGeometry, offsetRight, reversePath, sheetPoly, dedupe, rect } from './geom.js';
import { makeMat, depthCut, depthNoCut } from './materials.js';
import { TAU } from './util.js';

export const registry = { caps: [], modules: [], rotors: [], heat: [] };

export class Mod {
  constructor(id, name, { exOff = 0, color = '#9aa7b4' } = {}) {
    this.id = id; this.name = name; this.exOff = exOff; this.color = color;
    this.group = new THREE.Group(); this.group.name = id;
    this.n1 = new THREE.Group(); this.n2 = new THREE.Group();
    this.group.add(this.n1, this.n2);
    this.ghost = { value: 1 };
    this.ghostT = 1;
    this._mats = new Map();
    this.meshes = [];
    registry.modules.push(this);
  }

  m(name, extra) {
    const key = name + (extra ? JSON.stringify(extra) : '');
    let m = this._mats.get(key);
    if (!m) { m = makeMat(name, this.ghost, extra); this._mats.set(key, m); }
    return m;
  }

  _spool(sp) { return sp === 'n1' ? this.n1 : sp === 'n2' ? this.n2 : this.group; }

  // Visible surface of revolution (open path, visible face on the left of travel)
  surf(path, matName, o = {}) {
    const g = lathe(path, { seg: o.seg ?? 96, split: o.split, a0: o.a0, a1: o.a1 });
    const mat = typeof matName === 'string' ? this.m(matName, o.matExtra) : matName;
    const mesh = new THREE.Mesh(g, mat);
    this._finish(mesh, o);
    return mesh;
  }

  // Closed polygon solid: lathe + (optionally) the two wedge cut faces
  solid(poly, matName, o = {}) {
    const g = lathe(poly.concat([poly[0]]), { seg: o.seg ?? 96, split: o.split ?? 30 });
    const mat = typeof matName === 'string' ? this.m(matName, o.matExtra) : matName;
    const mesh = new THREE.Mesh(g, mat);
    this._finish(mesh, o);
    if (o.cap !== false) this.cap(poly, o.sp ?? null);
    return mesh;
  }

  // Wedge-edge cut faces for a polygon (static; they stay put while the lathe spins)
  cap(poly, sp = null) {
    const geo = capGeometry(poly);
    const capMat = this.m('cap', { cut: false });
    const a = new THREE.Mesh(geo, capMat), b = new THREE.Mesh(geo, capMat);
    for (const c of [a, b]) { c.userData.cast = false; c.castShadow = false; c.receiveShadow = true; c.frustumCulled = false; this.group.add(c); this.meshes.push(c); }
    registry.caps.push({ a, b });
    return [a, b];
  }

  // Thin hollow sheet: visible face = path, material to its right by t. segs: [{ path, mat }]
  sheet(segs, t, backMat, o = {}) {
    for (const s of segs) {
      this.surf(s.path, s.mat, { seg: o.seg ?? 96, split: o.split ?? 50, sp: o.sp });
      if (backMat) this.surf(reversePath(offsetRight(s.path, t)), backMat, { seg: o.seg ?? 96, split: o.split ?? 50, sp: o.sp });
    }
    let whole = [];
    for (const s of segs) whole = whole.concat(whole.length ? s.path.slice(1) : s.path);
    const poly = sheetPoly(dedupe(whole, 1e-7), t);
    if (o.cap !== false) this.cap(poly);
    return poly;
  }

  _finish(mesh, o) {
    mesh.castShadow = o.shadow !== false; mesh.userData.cast = mesh.castShadow; mesh.receiveShadow = true; mesh.frustumCulled = false;
    mesh.customDepthMaterial = (o.noCutShadow ? depthNoCut : depthCut);
    this._spool(o.sp ?? null).add(mesh);
    this.meshes.push(mesh);
  }

  // Row of identical blades around the axis, as one InstancedMesh
  row(geo, matName, count, o = {}) {
    const blur = o.rotor ? { value: 0 } : null;
    const rowKey = 'row' + registry.rotors.length;
    const mat = typeof matName === 'string'
      ? this.m(matName, o.rotor ? { cut: false, blur, key: rowKey, defs: { BLUR: '' } } : o.cut === false ? { cut: false, ...o.matExtra } : o.matExtra)
      : matName;
    const im = new THREE.InstancedMesh(geo, mat, count);
    const m4 = new THREE.Matrix4();
    const ph = o.phase ?? 0;
    for (let i = 0; i < count; i++) { m4.makeRotationX(ph + TAU * i / count); im.setMatrixAt(i, m4); }
    im.instanceMatrix.needsUpdate = true;
    im.userData.count = count;
    this._finish(im, { sp: o.sp, shadow: o.shadow, noCutShadow: o.cut === false });
    if (o.cut === false) im.customDepthMaterial = depthNoCut;
    if (o.rotor) {
      const ring = this._ring(geo, o.ringR, typeof matName === 'string' ? matName : 'ring', o.sp, rowKey);
      registry.rotors.push({ mod: this, mesh: im, count, sp: o.sp, blur, ring });
    }
    return im;
  }

  // Translucent swept-volume of a rotor row: stands in for the blades when they spin too fast to see.
  _ring(geo, ringR, bladeMat, sp, key) {
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const [rh, rt] = ringR;
    const poly = rect(bb.min.x - 0.004, bb.max.x + 0.004, rh, rt);
    const rm = this.m('ring', { cut: false, key: 'ring' + key });
    rm.transparent = true; rm.opacity = 0; rm.depthWrite = false; rm.side = THREE.DoubleSide;
    rm.name = bladeMat; // so hot rows pick up the same incandescence as their blades
    const mesh = new THREE.Mesh(lathe(poly.concat([poly[0]]), { seg: 80, split: 30 }), rm);
    mesh.renderOrder = 3; mesh.castShadow = false; mesh.userData.cast = false; mesh.frustumCulled = false; mesh.visible = false;
    this.group.add(mesh); this.meshes.push(mesh);
    return mesh;
  }

  add(obj, sp = null) { this._spool(sp).add(obj); obj.traverse((c) => { if (c.isMesh) { c.userData.cast = c.castShadow; this.meshes.push(c); c.frustumCulled = false; } }); return obj; }

  // fade for focus mode (0 = invisible, 1 = opaque)
  setGhost(v) {
    this.ghostT = v;
    for (const mesh of this.meshes) mesh.castShadow = !!mesh.userData.cast && v > 0.5;
  }
}

// blade helper that builds geometry + instanced row in one go
export function bladeRow(mod, o) {
  const geo = bladeGeometry(o);
  return mod.row(geo, o.mat, o.count, { sp: o.sp, rotor: o.rotor, cut: o.cut, phase: o.phase });
}
