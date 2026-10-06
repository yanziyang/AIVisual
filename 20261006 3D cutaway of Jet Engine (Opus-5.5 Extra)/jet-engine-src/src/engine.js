// Engine assembly + the little "engine model" (spool speeds, temperatures, thrust) that every
// visual reads from. All geometry lives in parts/*.js; this file wires modules together.
import * as THREE from 'three';
import { U } from './materials.js';
import { registry } from './module.js';
import { clamp, lerp, smoothstep } from './util.js';
import { buildNacelle } from './parts/nacelle.js';
import { buildFan } from './parts/fan.js';
import { buildLPC } from './parts/lpc.js';
import { buildHPC } from './parts/hpc.js';
import { buildComb } from './parts/comb.js';
import { buildHPT, buildLPT } from './parts/turbines.js';
import { buildExhaust, buildCowl } from './parts/exhaust.js';
import { buildStand } from './parts/stand.js';
import { createFlame } from './flame.js';
import { Flow } from './flow.js';

export const N1_RPM = 3900, N2_RPM = 12400;
const HEAT = { hotblade: 1.0, hotcase: 0.6, tbc: 0.8, plug: 0.5 };
// black-body-ish ramp: 0 = cold metal ... 1 = bright orange-yellow
function heatColor(c, h) {
  const e = Math.pow(clamp(h), 2.2);
  c.setRGB(0.95 * e, 0.34 * Math.pow(e, 1.7), 0.05 * Math.pow(e, 3));
}

// Operating point from the thrust lever t in [0,1]
export function operating(t) {
  const n1 = 0.24 + 0.76 * Math.pow(t, 0.9);
  const n2 = 0.60 + 0.40 * Math.pow(t, 0.6);
  const load = clamp((n2 - 0.60) / 0.40);
  return {
    n1, n2, load,
    egt: 380 + 520 * Math.pow(t, 0.85),
    thrust: 6 + 294 * Math.pow(t, 1.55),
    fuel: 0.18 + 2.35 * Math.pow(t, 1.4),
    opr: 7 + 29 * Math.pow(load, 1.4),
  };
}

export class Engine {
  constructor(stage) {
    this.stage = stage;
    this.root = new THREE.Group();
    stage.scene.add(this.root);
    this.mods = {};
    this.cut = { on: true, center: 1.5, half: 1.2 };
    this.explode = 0;
    this.throttle = 0.5;
    this.target = operating(this.throttle);
    this.state = { ...this.target };      // lagged actual values
    this.ang = { n1: 0, n2: 0 };
    this.view = { w: 1000, h: 800, pr: 1 };
    this.slow = 1 / 70;                   // visual slow-motion factor
    this.spinOn = true;
    this.warm = true; // keep ring meshes drawable until the first frames have compiled their shaders
    this._build();
  }

  add(mod) { this.mods[mod.id] = mod; this.root.add(mod.group); return mod; }

  _build() {
    const { inlet, aft } = buildNacelle();
    this.add(inlet); this.add(aft);
    this.add(buildFan());
    this.add(buildLPC());
    this.add(buildHPC());
    this.add(buildComb());
    this.add(buildHPT());
    this.add(buildLPT());
    this.add(buildExhaust());
    this.add(buildCowl());
    this.add(buildStand());
    this.flame = createFlame(this.mods.comb);
    this.flow = new Flow(this.root);
  }

  // incandescence of hot-section parts, driven by the HP spool load
  _heat(load) {
    const h = Math.pow(load, 1.15);
    for (const m of registry.modules) {
      const modK = { hpt: 1.0, comb: 1.0, lpt: 0.45, exhaust: 0.5, cowl: 0.35 }[m.id] ?? 0;
      if (!modK) continue;
      for (const mat of m._mats.values()) {
        const k = HEAT[mat.name];
        if (!k) continue;
        heatColor(mat.emissive, h * k * modK);
      }
    }
  }

  // dim every module except the listed ones (empty list = show everything)
  setFocus(ids) {
    this.focus = ids;
    for (const m of registry.modules) m.setGhost(!ids.length || ids.includes(m.id) ? 1 : 0);
  }

  setCut(on, center, half) {
    if (on !== undefined) this.cut.on = on;
    if (center !== undefined) this.cut.center = center;
    if (half !== undefined) this.cut.half = half;
  }

  setView(w, h, pr) { this.view = { w, h, pr }; }

  update(dt, time, camera) {
    U.time.value = time;
    // spool lag: N2 answers faster than N1
    const tgt = operating(this.throttle);
    const k1 = 1 - Math.exp(-dt / 1.7), k2 = 1 - Math.exp(-dt / 0.9);
    this.state.n1 += (tgt.n1 - this.state.n1) * k1;
    this.state.n2 += (tgt.n2 - this.state.n2) * k2;
    const load = clamp((this.state.n2 - 0.60) / 0.40);
    const t = clamp((this.state.n1 - 0.24) / 0.76);
    Object.assign(this.state, { load, egt: 380 + 520 * Math.pow(t, 0.85), thrust: 6 + 294 * Math.pow(t, 1.55), fuel: 0.18 + 2.35 * Math.pow(t, 1.4), opr: 7 + 29 * Math.pow(load, 1.4) });
    U.heat.value = load;

    if (this.spinOn) {
      this.ang.n1 += this.state.n1 * N1_RPM / 60 * Math.PI * 2 * this.slow * dt;
      this.ang.n2 += this.state.n2 * N2_RPM / 60 * Math.PI * 2 * this.slow * dt;
    }
    // rows that would strobe are drawn as a translucent swept volume instead of individual blades
    for (const r of registry.rotors) {
      const w = (r.sp === 'n1' ? this.state.n1 * N1_RPM : this.state.n2 * N2_RPM) / 60 * Math.PI * 2 * this.slow;
      const q = (w / 60) / (Math.PI * 2 / r.count);
      const b = this.spinOn ? smoothstep(0.40, 0.95, q) : 0;
      r.blur.value = b;
      r.ring.visible = b > 0.01 || this.warm;
      r.ring.material.opacity = 0.34 * b;
      r.mesh.castShadow = !!r.mesh.userData.cast && b < 0.5;
    }
    this.mods.stand.group.visible = this.explode < 0.03;
    for (const m of registry.modules) {
      m.n1.rotation.x = this.ang.n1;
      m.n2.rotation.x = this.ang.n2;
      m.group.position.x = this.explode * m.exOff;
      const g = m.ghost.value, gt = m.ghostT;
      m.ghost.value = g + (gt - g) * (1 - Math.exp(-dt * 9));
    }
    this._heat(load);
    // flame volume + the warm light it throws on the liner and vanes
    const fu = this.flame.mat.uniforms, cm = this.mods.comb;
    fu.uFlame.value = 0.22 + 0.95 * load;
    fu.uXOff.value = cm.group.position.x;
    fu.uAlpha.value = 0.3 + 0.7 * cm.ghost.value;
    if (camera) fu.uCam.value.copy(camera.position);
    const fl = this.stage.flameLight, cth = this.cut.center;
    fl.position.set(3.50 + cm.group.position.x, 0.46 * Math.cos(cth), 0.46 * Math.sin(cth));
    fl.intensity = 0.8 + 5.5 * load * load;
    if (this.flow) this.flow.update(dt, this.state, this.cut, this.explode, camera || this.stage.camera, this.view.w, this.view.h, this.view.pr);
    // wedge cut: uniform for fragment discard + cut-face planes
    const { on, center, half } = this.cut;
    U.cut.value.set(on ? 1 : 0, center, half, 0);
    for (const c of registry.caps) {
      c.a.visible = c.b.visible = on;
      c.a.rotation.x = center - half;
      c.b.rotation.x = center + half;
    }
  }
}
