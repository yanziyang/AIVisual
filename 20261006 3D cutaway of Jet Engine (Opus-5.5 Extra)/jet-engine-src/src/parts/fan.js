// Fan module: spinner, fan disc, 22 wide-chord blades, fan case containment, bypass OGVs.
import * as THREE from 'three';
import { Mod, registry } from '../module.js';
import { D, spinnerR, SPIN, nacInner } from '../path.js';
import { bladeGeometry, sheetPoly, rect, offsetRight, reversePath } from '../geom.js';
import { lerp, smoothstep } from '../util.js';
import { addFanCase } from './nacelle.js';
import { shaftTube, bearing } from './shafts.js';

export const FAN_BLADES = 22;

// One fan-blade section: wide chord, strongly swept and twisted, thin tip.
export function fanSection(s) {
  const chord = 0.30 + 0.205 * Math.pow(s, 0.75);
  const gamma = lerp(0.40, 1.14, Math.pow(s, 0.85));
  return {
    xle: 0.775 + 0.115 * Math.pow(s, 2.0),
    chord, gamma,
    camber: lerp(0.075, 0.020, s),
    thick: lerp(0.15, 0.020, Math.pow(s, 0.55)),
    tle: 0.5 * chord * Math.sin(gamma),
  };
}

export function buildFan() {
  const fan = new Mod('fan', 'Fan', { exOff: -0.7, color: '#8fd3ff' });
  addFanCase(fan);

  // ---- spinner (nose cone), hollow thin shell with the white spiral
  {
    const pts = [];
    const n = 44;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = SPIN.x0 + (SPIN.x1 - SPIN.x0) * Math.pow(u, 1.15);
      pts.push([x, spinnerR(x)]);
    }
    fan.surf(pts, 'spinner', { sp: 'n1', seg: 112 });
    fan.surf(reversePath(offsetRight(pts, 0.010)), 'castDark', { sp: 'n1', seg: 96 });
    fan.cap(sheetPoly(pts, 0.010));
    // spinner support cone inside
    const cone = [[0.80, 0.385], [0.80, 0.370], [0.95, 0.15], [0.95, 0.165]];
    fan.solid(cone, 'disc1', { sp: 'n1', seg: 80 });
  }

  // ---- fan hub drum (flow-path surface the blades sit on) + booster-side extension
  {
    const hub = [[0.80, 0.405], [0.95, 0.418], [1.10, 0.428], [1.34, 0.442]];
    fan.surf(hub, 'tiDark', { sp: 'n1', seg: 96 });
    fan.surf(reversePath(offsetRight(hub, 0.012)), 'castDark', { sp: 'n1', seg: 96 });
    fan.cap(sheetPoly(hub, 0.012));
  }

  // ---- fan disc (cut section is the classic bore-and-web shape)
  {
    const disc = [
      [0.82, 0.392], [1.08, 0.392], [1.08, 0.360], [1.01, 0.320], [0.98, 0.200], [1.03, 0.170],
      [1.03, 0.080], [0.88, 0.080], [0.88, 0.170], [0.93, 0.200], [0.90, 0.320], [0.82, 0.360],
    ];
    fan.solid(disc, 'disc1', { sp: 'n1', seg: 96, split: 25 });
  }

  // ---- LP shaft stub through the fan module
  shaftTube(fan, 'n1', 0.88, D.lpc.x0);

  // ---- bearings #1 (ball, takes the fan thrust) and #2 (roller) inside the hub
  bearing(fan, 'n1', 1.12, D.n1.ro, 0.135, 0.05, 'ball', 16);
  bearing(fan, 'n1', 1.27, D.n1.ro, 0.160, 0.05, 'roller', 14);

  // ---- fan blades (rotor, N1)
  const bg = bladeGeometry({ rh: 0.398, rt: D.fanTip, ns: 26, nc: 26, dir: 1, sec: fanSection });
  fan.row(bg, 'ti', FAN_BLADES, { sp: 'n1', rotor: true, cut: false, ringR: [0.40, D.fanTip] });

  // ---- outlet guide vanes (stator, in the bypass duct)
  const ogv = bladeGeometry({
    rh: 0.646, rt: 1.206, ns: 8, nc: 14, dir: -1,
    sec: (s) => ({ xle: D.xOGV0 + 0.02 * s, chord: 0.16, gamma: lerp(0.42, 0.20, s), camber: 0.07, thick: 0.075, tle: 0.5 * 0.16 * Math.sin(lerp(0.42, 0.2, s)) }),
  });
  fan.row(ogv, 'tiDark', 46, { phase: 0.03 });

  return fan;
}
