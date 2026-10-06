// Geometry builders: surfaces of revolution (the casings, discs, shafts), cut-face
// polygons, and aerofoil blades.
//
// Conventions
//  - The engine axis is +X (flow goes +X). Profiles are lists of [x, r] points.
//  - A profile is "travelled" so that the visible face is on the LEFT of travel
//    (x to the right, r up). Closed solids are therefore clockwise polygons.
//  - Angle a is measured from +Y toward +Z, so the point (x, r, a) is
//    (x, r cos a, r sin a). A rotor spinning "forward" has +a velocity.
import * as THREE from 'three';
import { clamp, lerp, TAU } from './util.js';

// ---------------------------------------------------------------- paths
export const reversePath = (p) => p.slice().reverse();

export function pathLen(p) {
  let s = 0;
  for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return s;
}

// Offset a path to the RIGHT of travel (into the material) by d, with mitred joints.
export function offsetRight(p, d) {
  const n = p.length, out = [];
  const segN = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = p[i + 1][0] - p[i][0], dr = p[i + 1][1] - p[i][1];
    const l = Math.hypot(dx, dr) || 1;
    segN.push([-dr / l, dx / l]); // left normal
  }
  for (let i = 0; i < n; i++) {
    const a = segN[Math.max(0, i - 1)], b = segN[Math.min(n - 2, i)];
    let nx = a[0] + b[0], nr = a[1] + b[1];
    const l = Math.hypot(nx, nr) || 1;
    nx /= l; nr /= l;
    const c = clamp(nx * b[0] + nr * b[1], 0.55, 1);
    out.push([p[i][0] - nx * d / c, p[i][1] - nr * d / c]);
  }
  return out;
}

// Closed polygon of a thin sheet: visible face = path, material to its right by t.
export function sheetPoly(path, t) {
  return path.concat(reversePath(offsetRight(path, t)));
}

// Clockwise rectangle in (x, r).
export const rect = (x0, x1, r0, r1) => [[x0, r1], [x1, r1], [x1, r0], [x0, r0]];

// Remove consecutive duplicates (needed by the triangulator).
export function dedupe(poly, eps = 1e-6) {
  const out = [];
  for (const p of poly) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > eps) out.push(p);
  }
  const a = out[0], b = out[out.length - 1];
  if (out.length > 1 && Math.hypot(a[0] - b[0], a[1] - b[1]) <= eps) out.pop();
  return out;
}

// Round a polygon's corners (clockwise polygon, visible face on the left). Used for fillets.
export function arcPts(cx, cr, rad, a0, a1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); out.push([cx + rad * Math.cos(a), cr + rad * Math.sin(a)]); }
  return out;
}

// ---------------------------------------------------------------- lathe
// Surface of revolution of an [x, r] path. Hard corners (turn > splitDeg) keep split normals.
export function lathe(path, opt = {}) {
  const seg = opt.seg ?? 96;
  const split = (opt.split ?? 38) * Math.PI / 180;
  const a0 = opt.a0 ?? 0, a1 = opt.a1 ?? TAU;
  const n = path.length;
  const segN = [], arc = [0];
  for (let i = 0; i < n - 1; i++) {
    const dx = path[i + 1][0] - path[i][0], dr = path[i + 1][1] - path[i][1];
    const l = Math.hypot(dx, dr) || 1e-9;
    segN.push([-dr / l, dx / l]);
    arc.push(arc[i] + l);
  }
  const closed = opt.closed ?? false;
  const pv = []; // {x, r, nx, nr, v, brk}
  for (let i = 0; i < n; i++) {
    let pn = i > 0 ? segN[i - 1] : (closed ? segN[n - 2] : null);
    let nn = i < n - 1 ? segN[i] : (closed ? segN[0] : null);
    const [x, r] = path[i];
    if (pn && nn) {
      const dot = clamp(pn[0] * nn[0] + pn[1] * nn[1], -1, 1);
      if (Math.acos(dot) > split) {
        pv.push({ x, r, nx: pn[0], nr: pn[1], v: arc[i], brk: true });
        pv.push({ x, r, nx: nn[0], nr: nn[1], v: arc[i], brk: false });
      } else {
        let nx = pn[0] + nn[0], nr = pn[1] + nn[1];
        const l = Math.hypot(nx, nr) || 1;
        pv.push({ x, r, nx: nx / l, nr: nr / l, v: arc[i], brk: false });
      }
    } else {
      const q = pn || nn;
      pv.push({ x, r, nx: q[0], nr: q[1], v: arc[i], brk: false });
    }
  }
  const np = pv.length, cols = seg + 1;
  const pos = new Float32Array(np * cols * 3), nor = new Float32Array(np * cols * 3), uv = new Float32Array(np * cols * 2);
  const total = arc[n - 1] || 1;
  for (let k = 0; k < np; k++) {
    const p = pv[k];
    for (let j = 0; j < cols; j++) {
      const a = lerp(a0, a1, j / seg), c = Math.cos(a), s = Math.sin(a);
      const o = k * cols + j;
      pos[o * 3] = p.x; pos[o * 3 + 1] = p.r * c; pos[o * 3 + 2] = p.r * s;
      nor[o * 3] = p.nx; nor[o * 3 + 1] = p.nr * c; nor[o * 3 + 2] = p.nr * s;
      uv[o * 2] = j / seg; uv[o * 2 + 1] = p.v / total;
    }
  }
  const idx = [];
  for (let k = 0; k < np - 1; k++) {
    if (pv[k].brk) continue;
    for (let j = 0; j < seg; j++) {
      const a = k * cols + j, b = (k + 1) * cols + j, c = k * cols + j + 1, d = (k + 1) * cols + j + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.userData.arcLength = total;
  return g;
}

// Planar cut face for a closed [x, r] polygon, lying in the XY plane (y = r).
export function capGeometry(poly) {
  const pts = dedupe(poly).map((p) => new THREE.Vector2(p[0], p[1]));
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts));
  g.userData.isCap = true;
  return g;
}

// ---------------------------------------------------------------- blades
// Cambered aerofoil blade lofted along its span on cylinders about the X axis.
//   o.rh, o.rt   root and tip radius
//   o.ns, o.nc   spanwise / chordwise segments
//   o.dir        +1 rotor (turns toward +a), -1 stator (mirror image)
//   o.sec(s)     -> { xle, chord, gamma (stagger, rad), camber, thick, tle }
// Built around a = 0 (pointing +Y) so rows are made by rotating copies about X.
export function bladeGeometry(o) {
  const ns = o.ns, nc = o.nc, dir = o.dir ?? 1;
  const ring = 2 * nc + 1;
  const pos = [], uv = [];
  const xi = (i) => 0.5 * (1 - Math.cos(Math.PI * i / nc));
  for (let j = 0; j <= ns; j++) {
    const s = j / ns;
    const S = o.sec(s);
    const r = lerp(o.rh, o.rt, s);
    const cg = Math.cos(S.gamma), sg = Math.sin(S.gamma);
    for (let k = 0; k < ring; k++) {
      let i, sgn;
      if (k <= nc) { i = nc - k; sgn = -1; } else { i = k - nc; sgn = 1; }
      const x = xi(i);
      const yt = 5 * S.thick * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
      const yc = -4 * S.camber * x * (1 - x);
      const th = Math.atan(-4 * S.camber * (1 - 2 * x));
      const xu = x - sgn * yt * Math.sin(th), yu = yc + sgn * yt * Math.cos(th);
      const a = xu * S.chord, b = yu * S.chord;
      const axial = S.xle + a * cg + b * sg;
      let tang = S.tle - a * sg + b * cg;
      if (dir < 0) tang = -tang;
      const phi = tang / r;
      pos.push(axial, r * Math.cos(phi), r * Math.sin(phi));
      uv.push(k / (ring - 1), s);
    }
  }
  const idx = [];
  for (let j = 0; j < ns; j++) {
    for (let k = 0; k < ring - 1; k++) {
      const a = j * ring + k, b = a + 1, c = a + ring, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  // end caps (fan to ring centroid) so a clipped or tilted view never sees inside
  for (const jj of [0, ns]) {
    const base = pos.length / 3;
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < ring; k++) { const q = (jj * ring + k) * 3; cx += pos[q]; cy += pos[q + 1]; cz += pos[q + 2]; }
    pos.push(cx / ring, cy / ring, cz / ring); uv.push(0.5, jj / ns);
    for (let k = 0; k < ring - 1; k++) {
      const a = jj * ring + k, b = a + 1;
      idx.push(base, a, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // orientation check: surface normals should point away from the section centroid
  const P = g.attributes.position, N = g.attributes.normal;
  let acc = 0;
  for (let j = 1; j < ns; j++) {
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < ring; k++) { const q = j * ring + k; cx += P.getX(q); cy += P.getY(q); cz += P.getZ(q); }
    cx /= ring; cy /= ring; cz /= ring;
    for (let k = 0; k < ring; k++) {
      const q = j * ring + k;
      acc += (P.getX(q) - cx) * N.getX(q) + (P.getY(q) - cy) * N.getY(q) + (P.getZ(q) - cz) * N.getZ(q);
    }
  }
  if (acc < 0) {
    const ix = g.index.array;
    for (let t = 0; t < ix.length; t += 3) { const tmp = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = tmp; }
    g.computeVertexNormals();
  }
  return g;
}

// Merge several same-attribute geometries (position/normal/uv/index) into one.
export function mergeGeos(list) {
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (const g of list) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.array[i] + vo;
    else for (let i = 0; i < c; i++) idx[io++] = i + vo;
    vo += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

// Transform a geometry by a Matrix4 (positions + normals), returning it.
export function xform(g, m) { g.applyMatrix4(m); return g; }

// Sample f(x) over [xa, xb] (either direction) into [[x, f(x)], ...].
export const sampleX = (f, xa, xb, n) => {
  const out = [];
  for (let i = 0; i <= n; i++) { const x = lerp(xa, xb, i / n); out.push([x, f(x)]); }
  return out;
};

// Split an x-monotone path at x = xc into two paths sharing the exact split point.
export function cutAtX(path, xc) {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    if ((a[0] - xc) * (b[0] - xc) <= 0 && a[0] !== b[0]) {
      const t = (xc - a[0]) / (b[0] - a[0]);
      const p = [xc, lerp(a[1], b[1], t)];
      return [path.slice(0, i + 1).concat([p]), [p].concat(path.slice(i + 1))];
    }
  }
  return [path, []];
}
