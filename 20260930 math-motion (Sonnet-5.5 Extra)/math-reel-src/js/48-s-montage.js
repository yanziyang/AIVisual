/* ============================================================================
   Scenes 06-09  MONTAGE: four 2-beat hits (0.83 s each)
   06 modular times table  - chords k -> m*k (mod N) on a circle: cardioid, nephroid, ...
   07 golden angle         - phyllotaxis r = c sqrt(n), theta = n*alpha, alpha sweeps 137.0 -> 137.5077 deg
   08 Ulam spiral          - primes on a square spiral; Euler's n^2+n+41 lights a diagonal
   09 Monte-Carlo pi       - 20 000 seeded random points, estimate = 4 * inside / N
   ========================================================================== */
function lightBg(fx, colCenter, colEdge, hud = C.ink) {
  fx.bgA = norm3(colCenter); fx.bgB = norm3(colEdge); fx.bloom = 0.10; fx.bloomThresh = 0.92; fx.vig = 0.16;
  fx.hudColor = hud; fx.hudAccent = hud; fx.sat = 1.0; fx.contrast = 1.02; fx.grain = 0.022;
}
const pop = (lt, a = 0, d = 0.28) => E.outBack(prog(lt, a, a + d), 1.8);
const fmtInt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/* -------------------------- 06 times table ------------------------------ */
SCENE_IMPL.times = {
  samples: 4,
  fx(fx, lt) { lightBg(fx, mixc(C.ember, [255, 150, 110], 0.35), mixc(C.ember, [150, 30, 18], 0.5)); },
  mAt(lt) {
    const step = BEAT / 2, k = Math.floor(lt / step), f = (lt - k * step) / step;
    return k === 0 ? 2 : (1 + k) + E.outBack(prog(f, 0, 0.6), 2.2);
  },
  draw(ctx, lt, t, fx) {
    const cx = 1130, cy = 540, R = 392, N = 240, m = this.mAt(lt), mr = Math.round(m);
    const ein = ez(E.out4, lt, 0, 0.22);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(0.86 + 0.14 * ein, 0.86 + 0.14 * ein); ctx.rotate((1 - ein) * 0.4); ctx.translate(-cx, -cy); ctx.globalAlpha = ein;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = i / N * TAU, b = m * a;
      ctx.moveTo(cx + R * Math.cos(a), cy - R * Math.sin(a)); ctx.lineTo(cx + R * Math.cos(b), cy - R * Math.sin(b));
    }
    ctx.strokeStyle = rgb(C.paper, 0.50); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = rgb(C.ink, 0.9); ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.fillStyle = rgb(C.ink);
    for (let i = 0; i < N; i += 2) { const a = i / N * TAU; ctx.beginPath(); ctx.arc(cx + R * Math.cos(a), cy - R * Math.sin(a), 3.2, 0, TAU); ctx.fill(); }
    ctx.restore();
    // giant multiplier
    const names = { 2: 'CARDIOID', 3: 'NEPHROID', 4: 'THREE CUSPS', 5: 'FOUR CUSPS', 6: 'FIVE CUSPS' };
    const p = pop(lt, 0.0, 0.3), since = (lt % (BEAT / 2)) / (BEAT / 2);
    ctx.save(); ctx.translate(64, 560); const sc = 1 + 0.10 * Math.exp(-since * 9); ctx.scale(sc, sc);
    text(ctx, '×' + mr, 0, 0, { font: FONT.disp(800, 330), color: rgb(C.ink), ls: -8 }); ctx.restore();
    text(ctx, (mr - 1) + (mr === 2 ? ' CUSP' : ' CUSPS') + '  ·  ' + (names[mr] || ''), 70, 622, { font: FONT.mono(700, 20), color: rgb(C.ink), ls: 3, alpha: ez(E.out3, lt, 0.05, 0.3) });
    text(ctx, 'N = 240 POINTS  ·  k → ' + mr + 'k  (mod 240)', 70, 658, { font: FONT.mono(500, 15), color: rgb(C.ink, 0.75), ls: 2, alpha: ez(E.out3, lt, 0.08, 0.34) });
    revealLine(ctx, 'STRINGS', 68, 200, 108, ez(E.out5, lt, 0.0, 0.3), { weight: 800, color: rgb(C.paper) });
  },
};

/* -------------------------- 07 golden angle ----------------------------- */
SCENE_IMPL.golden = {
  samples: 4,
  fx(fx, lt) { fx.bloom = 0.7; fx.bloomThresh = 0.6; fx.hudAccent = C.gold; },
  draw(ctx, lt, t, fx) {
    const N = 2400, cx = 640, cy = 540, c = 9.1;
    const alphaDeg = 137.0 + 0.5077 * E.io3(prog(lt, 0.04, 0.5)), alpha = alphaDeg * PI / 180;
    const rot = 1.2 * lt, nVis = Math.round(N * E.out3(prog(lt, 0.0, 0.34)));
    const alphaR = 137.0 + 0.5077 * E.io3(prog(FRAME_T - SC.golden.t0, 0.04, 0.5));
    const lock = prog(lt, 0.46, 0.56);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let n = 1; n <= nVis; n++) {
      const r = c * Math.sqrt(n), a = n * alpha + rot, x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      const u = n / N, rad = 1.6 + 4.6 * Math.sqrt(u);
      const col = mixc(C.gold, C.ember, Math.pow(u, 0.8));
      ctx.fillStyle = rgb(col, 0.72 + 0.2 * u); ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
    }
    // one set of 34 parastichies lights up once the angle locks
    if (lock > 0) {
      ctx.fillStyle = rgb(C.paper, lock);
      for (let n = 34; n <= nVis; n += 34) { const r = c * Math.sqrt(n), a = n * alpha + rot; ctx.beginPath(); ctx.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), 2.2 + 5.2 * Math.sqrt(n / N), 0, TAU); ctx.fill(); }
    }
    ctx.restore();
    // numbers
    const p = pop(lt, 0.0, 0.3);
    text(ctx, alphaR.toFixed(4) + '°', W - 64, 392, { font: FONT.disp(800, 134), color: rgb(C.gold), align: 'right', ls: -3, alpha: clamp(p * 2) });
    text(ctx, 'α  =  360° · (1 − 1/φ)', W - 64, 450, { font: FONT.mono(500, 20), color: rgb(C.paper, 0.8), align: 'right', ls: 2, alpha: ez(E.out3, lt, 0.1, 0.4) });
    text(ctx, 'THE ANGLE NATURE KEEPS', W - 64, 140, { font: FONT.mono(500, 13), color: rgb(C.paper, 0.55), align: 'right', ls: 3, alpha: ez(E.out3, lt, 0.05, 0.3) });
    if (lock > 0) text(ctx, '34 + 55 SPIRALS', W - 64, 500, { font: FONT.mono(700, 20), color: rgb(C.paper), align: 'right', ls: 3, alpha: lock });
    revealLine(ctx, 'SEEDS', W - 64, 250, 108, ez(E.out5, lt, 0.0, 0.3), { weight: 800, color: rgb(C.paper), align: 'right' });
  },
};

/* ------------------------------ 08 Ulam --------------------------------- */
const UL = { ready: false, N: 10201, xy: null, primes: null, euler: null };
SCENE_IMPL.ulam = {
  samples: 4,
  init() {
    const N = UL.N, isP = new Uint8Array(N + 1).fill(1); isP[0] = isP[1] = 0;
    for (let i = 2; i * i <= N; i++) if (isP[i]) for (let j = i * i; j <= N; j += i) isP[j] = 0;
    UL.isP = isP; UL.xy = new Int16Array((N + 1) * 2);
    let x = 0, y = 0, n = 1, len = 1, dir = 0; const D = [[1, 0], [0, -1], [-1, 0], [0, 1]];   // right, up(screen), left, down(screen)
    UL.xy[2] = 0; UL.xy[3] = 0;
    outer: while (n < N) { for (let rep = 0; rep < 2; rep++) { for (let s = 0; s < len; s++) { n++; if (n > N) break outer; x += D[dir][0]; y += D[dir][1]; UL.xy[n * 2] = x; UL.xy[n * 2 + 1] = y; } dir = (dir + 1) % 4; } len++; }
    const eu = new Uint8Array(N + 1); for (let k = 0; k < 100; k++) { const v = k * k + k + 41; if (v <= N && isP[v]) eu[v] = 1; }
    UL.euler = eu; UL.cum = new Int32Array(N + 1); for (let i = 1; i <= N; i++) UL.cum[i] = UL.cum[i - 1] + isP[i];
    UL.ready = true;
  },
  fx(fx, lt) { lightBg(fx, mixc(C.paper, [255, 252, 244], 0.5), mixc(C.paper, [205, 198, 182], 0.55)); },
  draw(ctx, lt, t, fx) {
    const cx = 1160, cy = 540, cell = 7.9, grow = E.io2(prog(lt, 0.04, 0.72)), nVis = Math.max(2, Math.round(UL.N * grow));
    const nVisR = Math.max(2, Math.round(UL.N * E.io2(prog(FRAME_T - SC.ulam.t0, 0.04, 0.72))));
    const zoom = lerp(2.6, 1.0, E.out3(prog(lt, 0.0, 0.78)));
    const hi = prog(lt, 0.50, 0.66);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(zoom, zoom);
    ctx.fillStyle = rgb(C.ink, 0.12);
    for (let n = 1; n <= nVis; n++) if (!UL.isP[n]) ctx.fillRect(UL.xy[n * 2] * cell - 0.8, UL.xy[n * 2 + 1] * cell - 0.8, 1.6, 1.6);
    ctx.fillStyle = rgb(C.ink);
    for (let n = 2; n <= nVis; n++) if (UL.isP[n] && !(hi > 0 && UL.euler[n])) ctx.fillRect(UL.xy[n * 2] * cell - 2.1, UL.xy[n * 2 + 1] * cell - 2.1, 4.2, 4.2);
    for (let n = 2; n <= nVis; n++) if (UL.euler[n]) { const e = hi > 0 ? hi : 0; ctx.fillStyle = hi > 0 ? rgb(mixc(C.ink, C.ember, e)) : rgb(C.ink); const s = 4.2 + 3 * e; ctx.fillRect(UL.xy[n * 2] * cell - s / 2, UL.xy[n * 2 + 1] * cell - s / 2, s, s); }
    ctx.restore();
    // numbers
    const pc = UL.cum[Math.min(nVisR, UL.N)];
    ctx.save(); ctx.translate(64, 470); const sc = 1 + 0.06 * Math.exp(-(lt % (BEAT / 2)) * 10); ctx.scale(sc, sc);
    text(ctx, fmtInt(pc), 0, 0, { font: FONT.disp(800, 200), color: rgb(C.ink), ls: -5 }); ctx.restore();
    text(ctx, 'PRIMES UP TO ' + fmtInt(nVisR) + '   ·   π(N)', 70, 548, { font: FONT.mono(700, 18), color: rgb(C.ink), ls: 2.5, alpha: ez(E.out3, lt, 0.05, 0.3) });
    if (hi > 0) text(ctx, 'ORANGE: n² + n + 41', 70, 584, { font: FONT.mono(700, 18), color: rgb(C.ember), ls: 2.5, alpha: hi });
    revealLine(ctx, 'PRIMES', 68, 200, 108, ez(E.out5, lt, 0.0, 0.3), { weight: 800, color: rgb(C.ink) });
  },
};

/* --------------------------- 09 Monte-Carlo pi -------------------------- */
const MC = { ready: false, N: 20000, x: null, y: null, cum: null };
SCENE_IMPL.monte = {
  samples: 4,
  init() {
    const r = mulberry32(2026), N = MC.N; MC.x = new Float32Array(N); MC.y = new Float32Array(N); MC.cum = new Int32Array(N + 1);
    for (let i = 0; i < N; i++) { MC.x[i] = r(); MC.y[i] = r(); MC.cum[i + 1] = MC.cum[i] + (MC.x[i] * MC.x[i] + MC.y[i] * MC.y[i] < 1 ? 1 : 0); }
    MC.ready = true;
  },
  fx(fx, lt) { fx.bloom = 0.55; fx.bloomThresh = 0.62; fx.hudAccent = C.aqua; },
  countAt(lt) { return Math.max(1, Math.min(MC.N, Math.floor(Math.pow(10, 1 + 3.3 * E.io2(prog(lt, 0.03, 0.80)))))); },
  draw(ctx, lt, t, fx) {
    const S = 640, bx = 470, by = 220, n = this.countAt(lt), nR = this.countAt(FRAME_T - SC.monte.t0);
    dotGrid(ctx, 0.07, 1e5, bx + S / 2, by + S / 2);
    const ein = ez(E.out4, lt, 0, 0.2);
    ctx.save(); ctx.globalAlpha = ein;
    ctx.strokeStyle = rgb(C.paper, 0.45); ctx.lineWidth = 1.6; ctx.strokeRect(bx, by, S, S);
    ctx.fillStyle = rgb(C.ember, 0.95);
    for (let i = 0; i < n; i++) if (MC.x[i] * MC.x[i] + MC.y[i] * MC.y[i] < 1) ctx.fillRect(bx + MC.x[i] * S - 1.2, by + (1 - MC.y[i]) * S - 1.2, 2.6, 2.6);
    ctx.fillStyle = rgb(C.aqua, 0.9);
    for (let i = 0; i < n; i++) if (MC.x[i] * MC.x[i] + MC.y[i] * MC.y[i] >= 1) ctx.fillRect(bx + MC.x[i] * S - 1.2, by + (1 - MC.y[i]) * S - 1.2, 2.6, 2.6);
    ctx.beginPath(); ctx.arc(bx, by + S, S, -PI / 2, 0); strokeGlow(ctx, C.paper, 2.4, 0.95, 2.5);
    ctx.restore();
    const est = 4 * MC.cum[nR] / nR;
    const p = pop(lt, 0, 0.3);
    text(ctx, est.toFixed(4), W - 64, 400, { font: FONT.disp(800, 168), color: rgb(C.paper), align: 'right', ls: -4, alpha: clamp(p * 2) });
    text(ctx, '4 · ' + fmtInt(MC.cum[nR]) + ' / ' + fmtInt(nR), W - 64, 456, { font: FONT.mono(500, 20), color: rgb(C.paper, 0.85), align: 'right', ls: 2, alpha: ez(E.out3, lt, 0.08, 0.35) });
    text(ctx, 'N = ' + fmtInt(nR) + ' RANDOM DOTS', W - 64, 140, { font: FONT.mono(500, 13), color: rgb(C.paper, 0.6), align: 'right', ls: 3, alpha: ez(E.out3, lt, 0.05, 0.3) });
    revealLine(ctx, 'CHANCE', W - 64, 250, 108, ez(E.out5, lt, 0.0, 0.3), { weight: 800, color: rgb(C.aqua), align: 'right' });
  },
};
