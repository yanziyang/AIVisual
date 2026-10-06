import re
def sub(path, a, b, count=1):
    s = open(path, encoding='utf8').read()
    if a not in s:
        raise SystemExit('missing in %s: %s' % (path, a[:60]))
    s = s.replace(a, b, count)
    open(path, 'w', encoding='utf8').write(s)

# ---- materials: blur uniform + discard
M = 'src/materials.js'
sub(M, "uniform float uTime;\nvarying vec3 vCutP;", "uniform float uTime;\nuniform float uBlur;\nvarying vec3 vCutP;")
sub(M, "#ifdef HOLES\n  {", "#ifdef BLUR\n  if (uBlur > 0.002 && bayer4_(gl_FragCoord.xy) < uBlur * 0.84) discard;\n#endif\n#ifdef HOLES\n  {")
sub(M, "export function patchMaterial(mat, { cut = true, ghost = null, defs = {}, key = '' } = {}) {\n  const gu = ghost || ONE;",
       "export function patchMaterial(mat, { cut = true, ghost = null, defs = {}, key = '', blur = null } = {}) {\n  const gu = ghost || ONE;\n  const bu = blur || ZERO;")
sub(M, "    sh.uniforms.uGhost = gu;\n    sh.uniforms.uHeat = U.heat;", "    sh.uniforms.uGhost = gu;\n    sh.uniforms.uBlur = bu;\n    sh.uniforms.uHeat = U.heat;")
sub(M, "const ONE = { value: 1 };", "const ONE = { value: 1 };\nconst ZERO = { value: 0 };")
sub(M, "    sh.uniforms.uGhost = ONE;\n    sh.uniforms.uHeat = U.heat;", "    sh.uniforms.uGhost = ONE;\n    sh.uniforms.uBlur = ZERO;\n    sh.uniforms.uHeat = U.heat;")
sub(M, "patchMaterial(m, { cut, ghost: ghostU, defs: { ...(d.defs || {}), ...(extra.defs || {}) }, key: name + (extra.key || '') });",
       "patchMaterial(m, { cut, ghost: ghostU, defs: { ...(d.defs || {}), ...(extra.defs || {}) }, key: name + (extra.key || ''), blur: extra.blur });")
sub(M, "  blackSteel:", "  ring: P({ color: 0xaeb8c4, metalness: 0.35, roughness: 0.45 }),\n  blackSteel:")

# ---- module: rotor rows get a per-row blur uniform and a swept-volume ring
D = 'src/module.js'
sub(D, "    const mat = typeof matName === 'string' ? this.m(matName, o.cut === false ? { cut: false, ...o.matExtra } : o.matExtra) : matName;\n    const im = new THREE.InstancedMesh(geo, mat, count);",
       """    const blur = o.rotor ? { value: 0 } : null;
    const rowKey = 'row' + registry.rotors.length;
    const mat = typeof matName === 'string'
      ? this.m(matName, o.rotor ? { cut: false, blur, key: rowKey, defs: { BLUR: '' } } : o.cut === false ? { cut: false, ...o.matExtra } : o.matExtra)
      : matName;
    const im = new THREE.InstancedMesh(geo, mat, count);""")
sub(D, "    if (o.rotor) registry.rotors.push({ mod: this, mesh: im, count, sp: o.sp });",
       """    if (o.rotor) {
      const ring = this._ring(geo, o.ringR, typeof matName === 'string' ? matName : 'ring', o.sp, rowKey);
      registry.rotors.push({ mod: this, mesh: im, count, sp: o.sp, blur, ring });
    }""")
sub(D, "  add(obj, sp = null) {", """  // Translucent swept-volume of a rotor row: stands in for the blades when they spin too fast to see.
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

  add(obj, sp = null) {""")
sub(D, "import { lathe, capGeometry, bladeGeometry, offsetRight, reversePath, sheetPoly, dedupe } from './geom.js';", "import { lathe, capGeometry, bladeGeometry, offsetRight, reversePath, sheetPoly, dedupe, rect } from './geom.js';")

# ---- blades helper passes the ring radii and a sensible shadow flag
B = 'src/parts/blades.js'
sub(B, "return mod.row(geo, o.mat, o.n, { sp: o.rotor ? o.sp : null, rotor: o.rotor, cut: o.rotor ? false : undefined, phase: o.phase ?? 0 });",
       "return mod.row(geo, o.mat, o.n, { sp: o.rotor ? o.sp : null, rotor: o.rotor, cut: o.rotor ? false : undefined, phase: o.phase ?? 0, ringR: [o.rh, o.rt], shadow: o.shadow ?? o.chord >= 0.058 });")
sub('src/parts/fan.js', "fan.row(bg, 'ti', FAN_BLADES, { sp: 'n1', rotor: true, cut: false });", "fan.row(bg, 'ti', FAN_BLADES, { sp: 'n1', rotor: true, cut: false, ringR: [0.40, D.fanTip] });")

# ---- cheaper blades
sub('src/parts/hpc.js', "ns: 3, nc: 8, mat: i < 5 ? 'steel' : 'nickel', rotor: true", "ns: 3, nc: 6, mat: i < 5 ? 'steel' : 'nickel', rotor: true")
sub('src/parts/hpc.js', "ns: 3, nc: 8, mat: i < 5 ? 'steel' : 'nickel', rotor: false", "ns: 3, nc: 6, mat: i < 5 ? 'steel' : 'nickel', rotor: false")
T = 'src/parts/turbines.js'
sub(T, "gamma: [0.46, 0.56], camber: -0.10, thick: [0.14, 0.10], ns: 5, nc: 10,", "gamma: [0.46, 0.56], camber: -0.10, thick: [0.14, 0.10], ns: 4, nc: 8,")
sub(T, "gamma: [0.34, 0.52], camber: -0.11, thick: [0.14, 0.07], ns: 6, nc: 10,", "gamma: [0.34, 0.52], camber: -0.11, thick: [0.14, 0.07], ns: 5, nc: 8,")

# ---- engine: blur factors per rotor row
E = 'src/engine.js'
sub(E, "    for (const m of registry.modules) {\n      m.n1.rotation.x = this.ang.n1;", """    // rows that would strobe are drawn as a translucent swept volume instead of individual blades
    for (const r of registry.rotors) {
      const w = (r.sp === 'n1' ? this.state.n1 * N1_RPM : this.state.n2 * N2_RPM) / 60 * Math.PI * 2 * this.slow;
      const q = (w / 60) / (Math.PI * 2 / r.count);
      const b = this.spinOn ? smoothstep(0.30, 0.85, q) : 0;
      r.blur.value = b;
      r.ring.visible = b > 0.01 || this.warm;
      r.ring.material.opacity = 0.42 * b;
      r.mesh.castShadow = !!r.mesh.userData.cast && b < 0.5;
    }
    for (const m of registry.modules) {
      m.n1.rotation.x = this.ang.n1;""")
sub(E, "    this.spinOn = true;", "    this.spinOn = true;\n    this.warm = true; // keep ring meshes drawable until the first frames have compiled their shaders")
print('ok')
