// Airflow visualisation: thousands of particles that follow streamlines through the real flow-path
// geometry. Colour = gas temperature at that station (cold blue -> white -> yellow -> orange).
// Speed follows the station velocity table; compression shows as particles crowding together.
import * as THREE from 'three';
import { D, coreHub, coreCase, cowlOut, nacInner, plugR, nozzleIn, fanHubR, SPIN } from './path.js';
import { curve, lerp, smoothstep, clamp, rng, TAU } from './util.js';
import { U } from './materials.js';

const X0 = -1.0, X1 = 8.6, XS = -0.55, DX = 0.01, NL = Math.round((X1 - X0) / DX) + 1;

// ---- station tables (x, value) -------------------------------------------------------------
// Gas temperature in kelvin at idle and at take-off power, and velocity in m/s.
const T_X = [-1.0, 0.7, 1.28, 1.86, 2.14, 3.10, 3.24, 3.84, 4.30, 4.50, 5.30, 5.72, 6.55, 8.6];
const T_TO = [288, 288, 335, 440, 445, 880, 885, 1750, 1340, 1320, 830, 805, 790, 560];
const T_ID = [288, 288, 295, 322, 324, 520, 525, 1050, 880, 875, 650, 640, 630, 450];
const P_TO = [1.0, 1.0, 1.55, 3.4, 3.35, 36, 35.5, 34, 11.5, 11, 1.9, 1.55, 1.1, 1.0];
const P_ID = [1.0, 1.0, 1.10, 1.6, 1.58, 7.0, 6.9, 6.6, 2.6, 2.5, 1.25, 1.1, 1.02, 1.0];
const V_CORE = [60, 150, 190, 150, 140, 115, 90, 100, 330, 280, 260, 520, 470, 360];
const TB_TO = [288, 288, 335, 338, 338, 338, 338, 338, 336, 334, 332, 330, 330, 320];
const TB_ID = [288, 288, 297, 298, 298, 298, 298, 298, 298, 298, 297, 297, 297, 295];
const V_BYP = [60, 150, 230, 215, 215, 215, 235, 255, 270, 280, 330, 330, 300, 240];
const mk = (ys) => curve(T_X.map((x, i) => [x, ys[i]]));
export const gas = {
  tTO: mk(T_TO), tID: mk(T_ID), pTO: mk(P_TO), pID: mk(P_ID), vCore: mk(V_CORE),
  tbTO: mk(TB_TO), tbID: mk(TB_ID), vByp: mk(V_BYP),
  T: (x, load) => lerp(gas.tID(x), gas.tTO(x), load),
  P: (x, load) => lerp(gas.pID(x), gas.pTO(x), load),
  Tb: (x, load) => lerp(gas.tbID(x), gas.tbTO(x), load),
};

// ---- flow-path radii (extended upstream of the lip and downstream of the nozzle) ------------
const coreInR = (x) => (x < 5.30 ? coreHub(x) : Math.max(plugR(x), 0) * (x <= 6.55 ? 1 : 0));
const coreOutR = (x) => (x < 5.30 ? coreCase(x) : x <= 5.72 ? nozzleIn(x) : 0.668 + 0.07 * (x - 5.72));
const bypInR = (x) => (x < 5.72 ? cowlOut(x) : 0.690 + 0.07 * (x - 5.72));
const bypOutR = (x) => (x <= 5.30 ? nacInner(x) : 1.004 + 0.015 * (x - 5.30));
const fanOutR = (x) => {
  if (x >= 0.12) return nacInner(x);
  const s = smoothstep(-0.95, 0.12, x);
  return lerp(1.38, nacInner(0.12), s);
};
const fanInR = (x) => (x < SPIN_X0 ? 0 : fanHubR(x));
const SPIN_X0 = SPIN.x0;

// fraction of the fan annulus (by area) that goes to the core, from the splitter geometry
const PSI_C = (() => {
  const x = D.xSplit, rin = fanHubR(x), rout = nacInner(x), rs = 0.646;
  return (rs * rs - rin * rin) / (rout * rout - rin * rin);
})();
export const BYPASS_RATIO = (1 - PSI_C) / PSI_C;

// swirl (rad/s of visual angular velocity) imparted by rotors and removed by vanes
const swirlCore = curve([[-1, 0], [0.7, 0], [0.9, 1.1], [1.3, 0.8], [1.9, 0.5], [3.1, 0.55], [3.3, 0.9], [3.9, 1.1], [4.3, 0.8], [5.3, 0.4], [5.8, 0.1], [8.6, 0]]);
const swirlByp = curve([[-1, 0], [0.7, 0], [0.9, 1.1], [1.36, 0.7], [1.55, 0.05], [8.6, 0]]);

// ---- lookup tables so the per-particle work is just a few array reads -------------------------
const L = {};
function build() {
  const names = ['fanIn', 'fanOut', 'coreIn', 'coreOut', 'bypIn', 'bypOut', 'vCore', 'vByp', 'swC', 'swB'];
  for (const n of names) L[n] = new Float32Array(NL);
  for (let i = 0; i < NL; i++) {
    const x = X0 + i * DX;
    L.fanIn[i] = fanInR(x); L.fanOut[i] = fanOutR(x);
    L.coreIn[i] = coreInR(x); L.coreOut[i] = coreOutR(x);
    L.bypIn[i] = bypInR(x); L.bypOut[i] = bypOutR(x);
    L.vCore[i] = gas.vCore(x); L.vByp[i] = gas.vByp(x);
    L.swC[i] = swirlCore(x); L.swB[i] = swirlByp(x);
  }
}
build();
function at(arr, x) {
  const f = (x - X0) / DX;
  if (f <= 0) return arr[0];
  if (f >= NL - 1) return arr[NL - 1];
  const i = f | 0, t = f - i;
  return arr[i] * (1 - t) + arr[i + 1] * t;
}
const radial = (rin, rout, f) => Math.sqrt(Math.max(0, rin * rin + f * (rout * rout - rin * rin)));

// radius of a streamline (stream: 0 core, 1 bypass) with stream coordinate psi in the full fan annulus
export function streamRadius(stream, psi, x) {
  const rf = radial(at(L.fanIn, x), at(L.fanOut, x), psi);
  const w = smoothstep(D.xSplit - 0.18, D.xSplit + 0.06, x);
  if (w <= 0) return rf;
  let ra;
  if (stream === 0) ra = radial(at(L.coreIn, x), at(L.coreOut, x), psi / PSI_C);
  else ra = radial(at(L.bypIn, x), at(L.bypOut, x), (psi - PSI_C) / (1 - PSI_C));
  return lerp(rf, ra, w);
}

// ---- temperature colour ramp (LUT, 256 steps, 250 K .. 1800 K) ---------------------------------
const RAMP = (() => {
  const stops = [[250, [0.20, 0.45, 1.0]], [320, [0.30, 0.72, 1.0]], [430, [0.45, 0.92, 1.0]], [560, [0.92, 0.97, 1.0]],
    [760, [1.0, 0.92, 0.55]], [1000, [1.0, 0.68, 0.22]], [1350, [1.0, 0.42, 0.12]], [1800, [1.0, 0.95, 0.80]]];
  const out = new Float32Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const T = lerp(250, 1800, i / 255);
    let k = 0; while (k < stops.length - 2 && T > stops[k + 1][0]) k++;
    const a = stops[k], b = stops[k + 1];
    const t = clamp((T - a[0]) / (b[0] - a[0]));
    for (let c = 0; c < 3; c++) out[i * 3 + c] = lerp(a[1][c], b[1][c], t);
  }
  return out;
})();

const VERT = `
attribute vec2 aCorner;
attribute vec3 aHead;
attribute vec3 aTail;
attribute vec3 aColor;
attribute float aAlpha;
attribute float aW;
uniform vec2 uRes;
uniform float uMinLen;
varying vec3 vC;
varying float vA;
varying vec2 vUv;
void main(){
  vec4 h = projectionMatrix * viewMatrix * vec4(aHead, 1.0);
  vec4 t = projectionMatrix * viewMatrix * vec4(aTail, 1.0);
  vec2 hs = h.xy / h.w * uRes * 0.5;
  vec2 ts = t.xy / t.w * uRes * 0.5;
  vec2 d = hs - ts;
  float len = length(d);
  vec2 dir = len > 1e-3 ? d / len : vec2(1.0, 0.0);
  if (len < uMinLen) ts = hs - dir * uMinLen;
  vec2 nrm = vec2(-dir.y, dir.x);
  vec4 base = mix(t, h, aCorner.x);
  vec2 ps = mix(ts, hs, aCorner.x) + nrm * aCorner.y * aW;
  gl_Position = vec4(ps / (uRes * 0.5) * base.w, base.z, base.w);
  vC = aColor; vA = aAlpha; vUv = vec2(aCorner.x, aCorner.y);
}`;
const FRAG = `
varying vec3 vC; varying float vA; varying vec2 vUv;
void main(){
  float along = pow(max(vUv.x, 0.0), 1.6);
  float across = max(1.0 - vUv.y * vUv.y, 0.0);
  float a = along * across * vA;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vC * a, 1.0);
}`;

export class Flow {
  constructor(parent, N = 6500) {
    this.N = N;
    this.px = new Float32Array(N); this.psi = new Float32Array(N); this.th = new Float32Array(N);
    this.stream = new Uint8Array(N); this.jit = new Float32Array(N);
    const r = rng(77);
    for (let i = 0; i < N; i++) this._spawn(i, r, true);
    this.rand = rng(1234);
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3)); // unused, required by three
    g.setAttribute('aCorner', new THREE.BufferAttribute(new Float32Array([0, -1, 1, -1, 1, 1, 0, 1]), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const mkA = (n) => new THREE.InstancedBufferAttribute(new Float32Array(N * n), n).setUsage(THREE.DynamicDrawUsage);
    this.head = mkA(3); this.tail = mkA(3); this.colA = mkA(3); this.alphaA = mkA(1); this.wA = mkA(1);
    g.setAttribute('aHead', this.head); g.setAttribute('aTail', this.tail); g.setAttribute('aColor', this.colA);
    g.setAttribute('aAlpha', this.alphaA); g.setAttribute('aW', this.wA);
    g.instanceCount = N;
    for (let i = 0; i < N; i++) this.wA.array[i] = 0.55 + 0.9 * this.jit[i];
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { uRes: { value: new THREE.Vector2(1000, 800) }, uMinLen: { value: 7 } },
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 4;
    parent.add(this.mesh);
    this.visible = true;
    this.rng = { x0: -9, x1: 99, core: 1, byp: 1, amt: 0 }; this.rngT = null;
  }

  // restrict the visible airflow to an x range / stream (null = everything)
  setRange(r) { this.rngT = r; }

  _spawn(i, r, initial) {
    this.stream[i] = r() < 0.5 ? 0 : 1;
    this.psi[i] = this.stream[i] === 0 ? r() * PSI_C : PSI_C + r() * (1 - PSI_C);
    this.th[i] = r() * TAU;
    this.jit[i] = r();
    this.px[i] = initial ? XS + r() * (X1 - XS) : XS + r() * 0.12;
  }

  update(dt, st, cut, explode, camera, viewW, viewH, pr = 1) {
    const { load, n1 } = st;
    const speed = 0.0105 * (0.38 + 0.62 * n1);
    const half = cut.on ? cut.half : -1, center = cut.center;
    const N = this.N, rand = this.rand;
    const fade = clamp(1 - explode * 4);
    const R = this.rng, T = this.rngT, ke = 1 - Math.exp(-dt * 4);
    if (T) { R.x0 += (T.x0 - R.x0) * ke; R.x1 += (T.x1 - R.x1) * ke; R.core += (T.core - R.core) * ke; R.byp += (T.byp - R.byp) * ke; R.amt += (1 - R.amt) * ke; }
    else R.amt += (0 - R.amt) * ke;
    this.mesh.visible = fade > 0.02 && this.visible;
    if (!this.mesh.visible) return;
    const H = this.head.array, T3 = this.tail.array, C = this.colA.array, A = this.alphaA.array;
    for (let i = 0; i < N; i++) {
      let x = this.px[i];
      const s = this.stream[i];
      const v = s === 0 ? at(L.vCore, x) : at(L.vByp, x);
      x += v * speed * dt * (0.85 + 0.3 * this.jit[i]);
      if (x > X1) { this._spawn(i, rand, false); x = this.px[i]; }
      this.px[i] = x;
      const sw = (s === 0 ? at(L.swC, x) : at(L.swB, x)) * (0.5 + n1);
      this.th[i] = (this.th[i] + sw * dt) % TAU;
      const psi = this.psi[i], th = this.th[i];
      const T = s === 0 ? gas.T(x, load) : gas.Tb(x, load);
      const ci = clamp(((T - 250) / 1550) * 255, 0, 255) | 0;
      const bright = 0.8 + 1.4 * smoothstep(900, 1750, T);
      const life = smoothstep(XS, XS + 0.45, x) * smoothstep(X1, X1 - 0.9, x);
      const stretch = (0.05 + 0.00055 * v) * (0.45 + n1) * (0.8 + 0.4 * this.jit[i]);
      const xt = x - stretch;
      const rh = streamRadius(s, psi, x), rt = streamRadius(s, psi, xt);
      const at_ = th - 0.02 * sw;
      const ch = Math.cos(th), sh = Math.sin(th), ct = Math.cos(at_), st_ = Math.sin(at_);
      H[i * 3] = x; H[i * 3 + 1] = rh * ch; H[i * 3 + 2] = rh * sh;
      T3[i * 3] = xt; T3[i * 3 + 1] = rt * ct; T3[i * 3 + 2] = rt * st_;
      const ca = Math.abs(((th - center + 3 * Math.PI) % TAU) - Math.PI);
      let foc = 1;
      if (R.amt > 0.002) { const fx = smoothstep(R.x0 - 0.3, R.x0 + 0.2, x) * smoothstep(R.x1 + 0.3, R.x1 - 0.2, x) * (s === 0 ? R.core : R.byp); foc = 1 + (fx - 1) * R.amt; }
      A[i] = ca < half ? 0 : fade * life * bright * 0.9 * foc;
      C[i * 3] = RAMP[ci * 3]; C[i * 3 + 1] = RAMP[ci * 3 + 1]; C[i * 3 + 2] = RAMP[ci * 3 + 2];
    }
    this.head.needsUpdate = true; this.tail.needsUpdate = true; this.colA.needsUpdate = true; this.alphaA.needsUpdate = true;
    this.mat.uniforms.uRes.value.set(viewW, viewH);
    this.mat.uniforms.uMinLen.value = 6 * pr;
    this.wA.needsUpdate = true;
  }
}
