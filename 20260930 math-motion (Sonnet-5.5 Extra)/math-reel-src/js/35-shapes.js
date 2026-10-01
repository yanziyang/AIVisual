/* ============================================================================
   35-shapes: glyph contour -> resampled closed curve -> DFT (for epicycles)
   ========================================================================== */
function glyphContourDFT(ch, fontFn, opts = {}) {
  const S = opts.size || 1100, M = opts.samples || 2048;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const x = cv.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
  x.fillStyle = '#fff'; x.font = fontFn(S * 0.78); x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  const m = x.measureText(ch);
  const bw = m.actualBoundingBoxLeft + m.actualBoundingBoxRight, bh = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  x.fillText(ch, (S - bw) / 2 + m.actualBoundingBoxLeft, (S - bh) / 2 + m.actualBoundingBoxAscent);
  const img = x.getImageData(0, 0, S, S).data;
  const mask = new Uint8Array(S * S);
  for (let i = 0; i < S * S; i++) mask[i] = img[i * 4] > 127 ? 1 : 0;

  // --- Moore-neighbour boundary tracing (outer contour of the first blob) ---
  let sx = -1, sy = -1;
  outer: for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) if (mask[y * S + xx]) { sx = xx; sy = y; break outer; }
  const D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const at = (xx, yy) => xx >= 0 && yy >= 0 && xx < S && yy < S && mask[yy * S + xx] === 1;
  const raw = []; let cx = sx, cy = sy, bdir = 4, second = null;
  for (let step = 0; step < S * S; step++) {
    raw.push([cx, cy]);
    let nx = -1, ny = -1, nb = 0, found = false;
    for (let i = 1; i <= 8; i++) {
      const d = (bdir + i) % 8, tx = cx + D[d][0], ty = cy + D[d][1];
      if (at(tx, ty)) {
        const pd = (bdir + i - 1) % 8, bx = cx + D[pd][0], by = cy + D[pd][1];
        const dx = bx - tx, dy = by - ty;
        nb = D.findIndex(v => v[0] === dx && v[1] === dy); nx = tx; ny = ty; found = true; break;
      }
    }
    if (!found) break;
    if (second === null) second = [nx, ny];
    else if (cx === sx && cy === sy && nx === second[0] && ny === second[1]) break;
    cx = nx; cy = ny; bdir = nb;
  }
  // --- smooth the staircase (circular moving average, 2 passes) ---
  let pts = raw;
  for (let pass = 0; pass < 2; pass++) {
    const n = pts.length, w = 4, out = new Array(n);
    for (let i = 0; i < n; i++) {
      let ax = 0, ay = 0;
      for (let k = -w; k <= w; k++) { const p = pts[(i + k + n) % n]; ax += p[0]; ay += p[1]; }
      out[i] = [ax / (2 * w + 1), ay / (2 * w + 1)];
    }
    pts = out;
  }
  // --- resample uniformly by arc length ---
  const n = pts.length; const cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; cum[i + 1] = cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]); }
  const total = cum[n]; const res = new Array(M); let j = 0;
  for (let i = 0; i < M; i++) {
    const d = i / M * total; while (cum[j + 1] < d) j++;
    const a = pts[j], b = pts[(j + 1) % n], u = (d - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j]);
    res[i] = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  }
  // normalise: centre of the bounding box at origin, y flipped later by the user
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  for (const p of res) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }
  const ox = (minx + maxx) / 2, oy = (miny + maxy) / 2, height = maxy - miny, width = maxx - minx;
  const z = res.map(p => [p[0] - ox, p[1] - oy]);
  // --- DFT ---
  const KMAX = opts.kmax || 128, coef = [];
  const cosT = new Float64Array(M), sinT = new Float64Array(M);
  for (let i = 0; i < M; i++) { cosT[i] = Math.cos(TAU * i / M); sinT[i] = Math.sin(TAU * i / M); }
  for (let k = -KMAX; k <= KMAX; k++) {
    let re = 0, im = 0;
    for (let i = 0; i < M; i++) {
      const idx = mod(k * i, M), c = cosT[idx], s = -sinT[idx];     // e^{-i 2pi k i / M}
      re += z[i][0] * c - z[i][1] * s; im += z[i][0] * s + z[i][1] * c;
    }
    re /= M; im /= M;
    coef.push({ k, re, im, amp: Math.hypot(re, im) });
  }
  const dc = coef.find(c => c.k === 0);
  const rest = coef.filter(c => c.k !== 0).sort((a, b) => b.amp - a.amp);
  return { z, coef: [dc, ...rest], height, width, M, S };
}
// evaluate the epicycle sum with the first n coefficients (DC + n-1 circles) at phase tau in [0,1).
// returns array of [centreX, centreY, radius] for circles 1..n-1 and sets out.tip = end of the chain
function epicycleChain(coef, n, tau, scale, ox, oy, out) {
  let x = ox + coef[0].re * scale, y = oy + coef[0].im * scale;
  out.length = 0;
  for (let i = 1; i < n; i++) {
    const c = coef[i], a = TAU * c.k * tau, cs = Math.cos(a), sn = Math.sin(a);
    out.push([x, y, c.amp * scale]);
    x += (c.re * cs - c.im * sn) * scale; y += (c.re * sn + c.im * cs) * scale;
  }
  out.tip = [x, y];
  return out;
}
