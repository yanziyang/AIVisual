// Engine dimensions in metres. X is the engine axis (air flows +X), intake at x = 0.
// One authoritative table: every part, the airflow particles and the labels read from here.
import { curve, sample, lerp } from './util.js';

export const D = {
  // fan
  fanTip: 1.20, fanHub: 0.40,
  xFan0: 0.78, xFan1: 1.10,
  // stations
  xSplit: 1.28,
  xOGV0: 1.36, xOGV1: 1.52,
  lpc: { x0: 1.34, x1: 1.86 },
  inter: { x0: 1.86, x1: 2.14 },
  hpc: { x0: 2.14, x1: 3.10 },
  diff: { x0: 3.10, x1: 3.24 },
  comb: { x0: 3.24, x1: 3.86 },
  hpt: { x0: 3.86, x1: 4.30 },
  idt: { x0: 4.30, x1: 4.50 },
  lpt: { x0: 4.50, x1: 5.30 },
  trf: { x0: 5.30, x1: 5.46 },
  xNozzle: 5.72, xPlug: 6.55,
  xNacTE: 5.30,
  // shafts
  n1: { ro: 0.080, ri: 0.062 },
  n2: { ro: 0.168, ri: 0.146 },
};

// --- nacelle (outer skin, inner barrel) ---------------------------------
export const nacOuter = curve([
  [0.12, 1.272], [0.40, 1.352], [0.80, 1.420], [1.40, 1.462], [2.20, 1.452],
  [3.20, 1.376], [4.20, 1.226], [5.00, 1.085], [5.30, 1.035],
]);
export const nacInner = curve([
  [0.12, 1.168], [0.30, 1.158], [0.52, 1.178], [0.72, 1.207], [1.15, 1.207],
  [1.40, 1.202], [2.20, 1.182], [3.50, 1.120], [4.50, 1.045], [5.30, 1.004],
]);

// --- core cowl (inner wall of the bypass duct) ---------------------------
export const cowlOut = curve([
  [1.28, 0.652], [1.60, 0.650], [1.90, 0.628], [2.30, 0.578], [2.90, 0.566],
  [3.30, 0.690], [3.70, 0.696], [4.10, 0.648], [4.50, 0.700], [5.00, 0.772], [5.30, 0.775], [5.72, 0.690],
]);

// --- core gas path: hub and casing radius -------------------------------
export const coreHub = curve([
  [1.28, 0.440], [1.40, 0.443], [1.86, 0.465], [2.14, 0.340], [2.30, 0.322], [3.10, 0.350],
  [3.24, 0.300], [3.86, 0.350], [4.30, 0.330], [4.50, 0.385], [5.30, 0.420],
]);
export const coreCase = curve([
  [1.28, 0.640], [1.40, 0.634], [1.86, 0.575], [2.14, 0.470], [3.10, 0.405],
  [3.24, 0.620], [3.84, 0.620], [3.90, 0.492], [4.30, 0.530], [4.50, 0.585], [5.30, 0.725],
]);

// --- tail plug ----------------------------------------------------------
export const plugR = curve([
  [5.30, 0.420], [5.72, 0.350], [6.05, 0.225], [6.35, 0.085], [6.55, 0.0],
]);
export const nozzleIn = curve([[5.30, 0.725], [5.72, 0.668]]);

// --- spinner ------------------------------------------------------------
export const SPIN = { x0: 0.14, x1: 0.80, r: 0.405 };
export function spinnerR(x) {
  const u = (x - SPIN.x0) / (SPIN.x1 - SPIN.x0);
  if (u <= 0) return 0;
  const t = Math.min(1, u);
  // elongated ogive, blunted a little at the tip
  return SPIN.r * Math.pow(Math.sin(Math.PI / 2 * Math.pow(t, 0.82)), 0.78);
}
// hub surface the fan blades sit on: spinner, then the fan hub ring
export const fanHubR = (x) => (x < SPIN.x1 ? spinnerR(x) : lerp(0.405, 0.436, Math.min(1, (x - SPIN.x1) / 0.5)));

// --- engine-wide helper: flow region at axial station x -----------------
// Returns the annulus the core stream occupies at x (hub, casing).
export const coreAnnulus = (x) => [coreHub(x), coreCase(x)];
export const bypassAnnulus = (x) => [cowlOut(x) + 0.0, nacInner(x) - 0.0];
export const fanAnnulus = (x) => [fanHubR(x), nacInner(x)];

// profile tables for plots / debug
export const tableRows = (f, x0, x1, n = 40) => sample(f, x0, x1, n);
