/* ============================================================================
   MATH IN MOTION - a 20 s mathematics motion-design showreel
   00-core: constants, timeline, easing, palette, random, small helpers
   Everything below is a pure function of time t (seconds), so the same code
   drives the live page and the frame-exact offline MP4 render.
   ========================================================================== */
const W = 1920, H = 1080, FPS = 60, DUR = 20;
const BPM = 144, BEAT = 60 / BPM;            // 0.41666 s
const TAU = Math.PI * 2, PI = Math.PI;
const PHI = (1 + Math.sqrt(5)) / 2;
const GOLDEN_ANGLE = TAU * (1 - 1 / PHI);    // 2.39996 rad = 137.5077 deg

/* ---- palette (sRGB 0-255) ---------------------------------------------- */
const C = {
  ink:    [5, 7, 13],
  ink2:   [12, 17, 33],
  paper:  [243, 239, 229],
  ember:  [255, 91, 58],
  aqua:   [62, 224, 255],
  gold:   [255, 194, 71],
  violet: [138, 107, 255],
  mute:   [128, 138, 160],
};
const rgb = (c, a = 1) => a >= 0.999 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a < 0 ? 0 : a})`;
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const norm3 = c => [c[0] / 255, c[1] / 255, c[2] / 255];

/* ---- numeric helpers ---------------------------------------------------- */
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));                 // 0..1 progress between a and b
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const fract = x => x - Math.floor(x);
const mod = (a, n) => ((a % n) + n) % n;

/* ---- easing ------------------------------------------------------------- */
const E = {
  lin: t => t,
  in2: t => t * t,
  out2: t => 1 - (1 - t) * (1 - t),
  in3: t => t * t * t,
  out3: t => 1 - Math.pow(1 - t, 3),
  out4: t => 1 - Math.pow(1 - t, 4),
  out5: t => 1 - Math.pow(1 - t, 5),
  io2: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  io3: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  io5: t => t < .5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2,
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inExpo: t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10),
  ioExpo: t => t <= 0 ? 0 : t >= 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  ioSine: t => -(Math.cos(PI * t) - 1) / 2,
  outBack: (t, s = 1.70158) => { const c = s + 1; return 1 + c * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); },
  outElastic: t => t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (TAU / 3)) + 1,
};
// clamp + ease helper:  ez(E.out3, t, a, b)
const ez = (fn, t, a = 0, b = 1) => fn(prog(t, a, b));

/* ---- deterministic random + noise -------------------------------------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// smooth 1-D value noise (for camera shake etc.), deterministic
function vnoise(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const h = k => { const s = Math.sin((k + seed * 57.13) * 127.1) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

/* ---- timeline (in beats) ------------------------------------------------ */
//  id, start beat, end beat, index label, name, formula
const SCENES = [
  { id: 'origin',   b0: 0,  b1: 4,  idx: '01', name: 'UNIT CIRCLE',         formula: '*x*^2 + *y*^2 = 1',                          accent: C.aqua },
  { id: 'fourier',  b0: 4,  b1: 12, idx: '02', name: 'FOURIER SERIES',      formula: '*f*(*t*) = {sum} *c*_(*n*) *e*^(2π*i*·*n*·*t*)', accent: C.gold },
  { id: 'surface',  b0: 12, b1: 18, idx: '03', name: 'PARAMETRIC SURFACES', formula: '*S*(*u*,*v*) = (*x*, *y*, *z*)',             accent: C.violet },
  { id: 'chaos',    b0: 18, b1: 24, idx: '04', name: 'LORENZ ATTRACTOR',    formula: '*dx*/*dt* = σ(*y* − *x*)',          accent: C.ember },
  { id: 'mandel',   b0: 24, b1: 32, idx: '05', name: 'MANDELBROT SET',      formula: '*z* {->} *z*^2 + *c*',                       accent: C.gold },
  { id: 'times',    b0: 32, b1: 34, idx: '06', name: 'MODULAR TIMES TABLE', formula: '*k* {->} *m*·*k*  (mod *N*)',            accent: C.paper },
  { id: 'golden',   b0: 34, b1: 36, idx: '07', name: 'GOLDEN ANGLE',        formula: 'θ_(*n*) = *n* · 137.5077°',   accent: C.gold },
  { id: 'ulam',     b0: 36, b1: 38, idx: '08', name: 'ULAM SPIRAL',         formula: '*n*^2 + *n* + 41  {->}  prime',              accent: C.ember },
  { id: 'monte',    b0: 38, b1: 40, idx: '09', name: 'MONTE CARLO',         formula: 'π {approx} 4·*N*_(in) / *N*',      accent: C.aqua },
  { id: 'finale',   b0: 40, b1: 48, idx: '10', name: "EULER'S IDENTITY",    formula: '*e*^(*i*π) + 1 = 0',                    accent: C.aqua },
];
for (const s of SCENES) { s.t0 = s.b0 * BEAT; s.t1 = s.b1 * BEAT; s.dur = s.t1 - s.t0; }
const SC = Object.fromEntries(SCENES.map(s => [s.id, s]));
function sceneAt(t) {
  for (let i = SCENES.length - 1; i >= 0; i--) if (t >= SCENES[i].t0 - 1e-9) return SCENES[i];
  return SCENES[0];
}
const beatOf = t => t / BEAT;
// pulse that jumps to 1 on every beat (or every n-th) and decays: used for subtle "kick" motion
const beatPulse = (t, every = 1, k = 5) => { const b = t / BEAT / every; return Math.exp(-fract(b) * every * k * 0.5); };

const NSCHED = [1, 2, 3, 4, 6, 8, 12, 20];   // harmonics added per half-beat in Fourier part A (then 32): shared by the epicycles and the score

/* ---- the digits of pi and e (melody + typography) ---------------------- */
const PI_DIGITS = '31415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679';
const E_DIGITS = '27182818284590452353602874713526624977572470936999595749669676277240766303535475945713821785251664274';

let FRAME_T = 0;           // nominal time of the frame being rendered (text read-outs use this so digits never smear across sub-frames)
const SCENE_IMPL = {};   // id -> { init?, fx?, bg?, draw, samples? } (filled by the scene modules)

/* ---- logging hook (render harness) ------------------------------------- */
const LOG = (...a) => { try { if (window.__log) window.__log(a.join(' ')); } catch (e) { } };
