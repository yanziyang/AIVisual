/* ============================================================================
   Scene 04  LORENZ ATTRACTOR / THE BUTTERFLY EFFECT   (7.5 - 10.0 s)
   sigma=10, rho=28, beta=8/3 integrated with RK4. A 360-particle ensemble, a faint 40k-point ghost of the attractor,
   and two hero orbits started ~1e-5 apart. The scene clock is calibrated so the orbits visibly split ~62 % in,
   and a live x(t) strip chart shows the same story as a graph.
   ========================================================================== */
const LZ = { ready: false, dt: 0.004, stride: 2, tMin: -7, tA: -3, rate: 7, split: 0, nEns: 360, ghost: null, A: null, B: null, ens: null, dist: null };

function lorenzRK4(s, dt) {
  const f = (x, y, z) => [10 * (y - x), x * (28 - z) - y, x * y - (8 / 3) * z];
  const k1 = f(s[0], s[1], s[2]);
  const k2 = f(s[0] + dt / 2 * k1[0], s[1] + dt / 2 * k1[1], s[2] + dt / 2 * k1[2]);
  const k3 = f(s[0] + dt / 2 * k2[0], s[1] + dt / 2 * k2[1], s[2] + dt / 2 * k2[2]);
  const k4 = f(s[0] + dt * k3[0], s[1] + dt * k3[1], s[2] + dt * k3[2]);
  s[0] += dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
  s[1] += dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
  s[2] += dt / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
}
const LZ_STOPS = [C.aqua, C.violet, C.ember, C.gold];
function lzGrad(u) { const x = clamp(u) * (LZ_STOPS.length - 1), i = Math.min(LZ_STOPS.length - 2, Math.floor(x)); return mixc(LZ_STOPS[i], LZ_STOPS[i + 1], x - i); }

SCENE_IMPL.chaos = {
  samples: 4,
  init() {
    // burn-in onto the attractor
    const s0 = [1.2, 0.8, 22]; for (let i = 0; i < 6000; i++) lorenzRK4(s0, 0.005);
    const dt = LZ.dt, stride = LZ.stride, tMax = 21;           // sim horizon (rate <= 9 u/s over 2.5 s plus shutter margin)
    const steps = Math.ceil((tMax - LZ.tMin) / dt);
    const rnd = mulberry32(7);
    // hero orbits (pair separated by 1e-5 along a fixed direction)
    const A = [...s0], B = [s0[0] + 1e-5 * 0.577, s0[1] + 1e-5 * 0.577, s0[2] + 1e-5 * 0.577];
    LZ.A = new Float32Array((steps + 1) * 3); LZ.B = new Float32Array((steps + 1) * 3); LZ.dist = new Float32Array(steps + 1);
    for (let i = 0; i <= steps; i++) {
      LZ.A.set(A, i * 3); LZ.B.set(B, i * 3);
      LZ.dist[i] = Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
      lorenzRK4(A, dt); lorenzRK4(B, dt);
    }
    // calibrate the scene clock: first time the pair is > 8 apart (after tA) happens at lt = 1.55 s
    let is = 0; for (let i = 0; i <= steps; i++) if (LZ.dist[i] > 8) { is = i; break; }
    LZ.split = LZ.tMin + is * dt;
    LZ.rate = clamp((LZ.split - LZ.tA) / 1.55, 5.5, 9.0);
    // ensemble
    const nS = Math.floor(steps / stride) + 1, n = LZ.nEns;
    LZ.ens = new Float32Array(nS * n * 3);
    const P = []; for (let k = 0; k < n; k++) { const g = () => (rnd() + rnd() + rnd() - 1.5) * 2; P.push([s0[0] + 3e-4 * g(), s0[1] + 3e-4 * g(), s0[2] + 3e-4 * g()]); }
    // order by projection on the first axis so the colours start as a smooth gradient inside the clump
    P.sort((a, b) => (a[0] + a[1] * 0.7 + a[2] * 0.3) - (b[0] + b[1] * 0.7 + b[2] * 0.3));
    for (let i = 0; i <= steps; i++) {
      if (i % stride === 0) { const base = (i / stride) * n * 3; for (let k = 0; k < n; k++) { LZ.ens[base + k * 3] = P[k][0]; LZ.ens[base + k * 3 + 1] = P[k][1]; LZ.ens[base + k * 3 + 2] = P[k][2]; } }
      for (let k = 0; k < n; k++) lorenzRK4(P[k], dt);
    }
    LZ.nSamp = nS;
    // ghost attractor (one long orbit)
    const g = [...s0], NG = 42000; LZ.ghost = new Float32Array(NG * 3);
    for (let i = 0; i < NG; i++) { for (let j = 0; j < 3; j++) lorenzRK4(g, 0.004); LZ.ghost.set(g, i * 3); }
    LZ.ready = true;
    LOG('lorenz: split tau=' + LZ.split.toFixed(2) + ' rate=' + LZ.rate.toFixed(2));
  },
  tau(lt) { return LZ.tA + LZ.rate * lt; },
  sampleHero(arr, tau) {
    const nmax = arr.length / 3 - 2, f = clamp((tau - LZ.tMin) / LZ.dt, 0, nmax), i = Math.floor(f), u = f - i, a = i * 3;
    return [lerp(arr[a], arr[a + 3], u), lerp(arr[a + 1], arr[a + 4], u), lerp(arr[a + 2], arr[a + 5], u)];
  },
  fx(fx, lt) { fx.bloom = 0.85; fx.bloomThresh = 0.5; fx.hudAccent = C.ember; },
  draw(ctx, lt, t, fx, sc) {
    const tau = this.tau(lt), tauR = this.tau(FRAME_T - sc.t0);
    // camera
    const az = 0.30 + 0.34 * lt, dist = 112;
    const eye = [dist * Math.sin(az), -dist * Math.cos(az), 24 + 20 * Math.cos(0.4)];
    const proj = M4.mul(M4.translate(0.20, -0.02, 0), M4.persp(30 * PI / 180, W / H, 10, 400));
    const vp = M4.mul(proj, M4.lookAt(eye, [0, 0, 24], [0, 0, 1]));
    const pj = (x, y, z) => M4.project(vp, [x, y, z]);
    const dMid = Math.hypot(eye[0], eye[1], eye[2] - 24);
    dotGrid(ctx, 0.08, 1e5, 1190, 540);

    // --- ghost attractor (faint, drawn as one polyline) ---
    const ga = ez(E.out3, lt, 0.0, 0.5);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1; ctx.strokeStyle = rgb(C.violet, 0.05 * ga);
    ctx.beginPath(); const gh = LZ.ghost; let prev = null;
    for (let i = 0; i < gh.length; i += 3 * 2) { const p = pj(gh[i], gh[i + 1], gh[i + 2]); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    ctx.stroke(); ctx.restore();

    // --- ensemble ---
    const n = LZ.nEns, tr = 26;     // trail samples
    const fI = clamp((tau - LZ.tMin) / (LZ.dt * LZ.stride), 0, LZ.nSamp - 3), iI = Math.floor(fI), uI = fI - iI;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const posAt = (k, ii) => { const b = (ii * n + k) * 3; return [LZ.ens[b], LZ.ens[b + 1], LZ.ens[b + 2]]; };
    const ensA = ez(E.out3, lt, 0.05, 0.4);
    for (let k = 0; k < n; k++) {
      const col = lzGrad(k / (n - 1)); ctx.beginPath();
      for (let j = tr; j >= 0; j--) {
        const ii = Math.max(0, iI - j); const a = posAt(k, ii), b = posAt(k, ii + 1);
        const x = lerp(a[0], b[0], j === 0 ? uI : 0) , y = lerp(a[1], b[1], j === 0 ? uI : 0), z = lerp(a[2], b[2], j === 0 ? uI : 0);
        const p = pj(x, y, z); j === tr ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]);
      }
      ctx.strokeStyle = rgb(col, 0.13 * ensA); ctx.lineWidth = 1.6; ctx.stroke();
      const h = pj(...(() => { const a = posAt(k, iI), b = posAt(k, iI + 1); return [lerp(a[0], b[0], uI), lerp(a[1], b[1], uI), lerp(a[2], b[2], uI)]; })());
      ctx.fillStyle = rgb(col, 0.62 * ensA); ctx.beginPath(); ctx.arc(h[0], h[1], 2.7, 0, TAU); ctx.fill();
    }
    ctx.restore();

    // --- hero trails ---
    const heroes = [[LZ.A, C.ember], [LZ.B, C.aqua]], TL = 3.8, chunks = 28;
    const heads = [];
    for (const [arr, col] of heroes) {
      const pts = []; for (let i = 0; i <= 180; i++) { const tt = tau - TL * (1 - i / 180); if (tt < LZ.tMin) continue; pts.push(pj(...this.sampleHero(arr, tt))); }
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const per = Math.ceil(pts.length / chunks);
      for (let c = 0; c < chunks; c++) {
        const i0 = c * per, i1 = Math.min(pts.length - 1, (c + 1) * per); if (i1 <= i0) break;
        const u = (c + 1) / chunks, a = Math.pow(u, 1.6);
        ctx.beginPath(); for (let i = i0; i <= i1; i++) i === i0 ? ctx.moveTo(pts[i][0], pts[i][1]) : ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.strokeStyle = rgb(col, 0.20 * a); ctx.lineWidth = 11 * (0.4 + 0.6 * u); ctx.stroke();
        ctx.strokeStyle = rgb(col, a); ctx.lineWidth = 3.4 * (0.35 + 0.65 * u); ctx.stroke();
      }
      ctx.restore();
      heads.push(pts[pts.length - 1]);
    }
    glowDot(ctx, heads[0][0], heads[0][1], 8, C.ember, 1); glowDot(ctx, heads[1][0], heads[1][1], 8, C.aqua, 1);
    // link between the pair + split pulse
    const dReal = (() => { const a = this.sampleHero(LZ.A, tauR), b = this.sampleHero(LZ.B, tauR); return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); })();
    ctx.save(); ctx.strokeStyle = rgb(C.paper, 0.55); ctx.lineWidth = 1.4; ctx.setLineDash([3, 6]); seg(ctx, heads[0][0], heads[0][1], heads[1][0], heads[1][1]); ctx.restore();
    const lsplit = (LZ.split - LZ.tA) / LZ.rate, age = lt - lsplit;
    if (age > 0 && age < 0.7) {
      const mx = (heads[0][0] + heads[1][0]) / 2, my = (heads[0][1] + heads[1][1]) / 2;
      ring(ctx, mx, my, 20 + age * 520, rgb(C.paper), 2.2, Math.pow(1 - age / 0.7, 2));
      ring(ctx, mx, my, 10 + age * 300, rgb(C.gold), 1.6, Math.pow(1 - age / 0.7, 2));
    }

    // --- headline + equations ---
    revealLine(ctx, 'ORDER', 68, 200, 108, ez(E.out5, lt, 0.04, 0.5), { weight: 800, color: rgb(C.paper) });
    revealLine(ctx, 'BREAKS.', 68, 300, 108, ez(E.out5, lt, 0.14, 0.62), { weight: 800, color: rgb(C.ember) });
    const eqs = ['*dx*/*dt* = σ(*y* − *x*)', '*dy*/*dt* = *x*(ρ − *z*) − *y*', '*dz*/*dt* = *xy* − β*z*'];
    eqs.forEach((e, i) => drawFormula(ctx, e, 70, 392 + i * 44, 33, { color: rgb(C.paper, 0.92), alpha: ez(E.out3, lt, 0.3 + i * 0.1, 0.65 + i * 0.1) }));
    text(ctx, 'σ = 10    ρ = 28    β = 8/3', 70, 538, { font: FONT.mono(500, 15), color: rgb(C.ember), ls: 2, alpha: ez(E.out3, lt, 0.6, 0.95) });

    // --- strip chart: x(t) of both orbits ---
    const bx = 68, by = 640, bw = 600, bh = 230, tr0 = LZ.tA, tr1 = LZ.tA + LZ.rate * sc.dur;
    const ca = ez(E.out3, lt, 0.35, 0.8);
    ctx.save(); ctx.globalAlpha = ca;
    ctx.strokeStyle = rgb(C.paper, 0.22); ctx.lineWidth = 1.2; ctx.strokeRect(bx, by, bw, bh);
    seg(ctx, bx, by + bh / 2, bx + bw, by + bh / 2);
    text(ctx, 'x(t)  ·  TWO ORBITS, 0.00001 APART', bx, by - 14, { font: FONT.mono(500, 13), color: rgb(C.paper, 0.6), ls: 2 });
    const xs = tt => bx + (tt - tr0) / (tr1 - tr0) * bw, ys = x => by + bh / 2 - x / 22 * bh / 2;
    for (const [arr, col, lw] of [[LZ.A, C.ember, 2.6], [LZ.B, C.aqua, 2.0]]) {
      ctx.beginPath(); let first = true;
      for (let i = 0; i <= 320; i++) { const tt = tr0 + (tau - tr0) * i / 320; if (tt < tr0) continue; const s = this.sampleHero(arr, tt); const X = xs(tt), Y = ys(s[0]); first ? (ctx.moveTo(X, Y), first = false) : ctx.lineTo(X, Y); }
      ctx.strokeStyle = rgb(col, 0.95); ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke();
    }
    if (tau > LZ.split) { const X = xs(LZ.split); ctx.strokeStyle = rgb(C.paper, 0.45); ctx.setLineDash([3, 5]); seg(ctx, X, by, X, by + bh); ctx.setLineDash([]); text(ctx, 'THEY SPLIT', X + 8, by + 18, { font: FONT.mono(700, 12), color: rgb(C.paper), ls: 2 }); }
    ctx.restore();

    // --- big divergence read-out ---
    const ex = Math.floor(Math.log10(Math.max(dReal, 1e-12))), man = dReal / Math.pow(10, ex);
    const ra = ez(E.out3, lt, 0.3, 0.7);
    text(ctx, 'DISTANCE BETWEEN THE ORBITS', W - 64, 140, { font: FONT.mono(500, 13), color: rgb(C.paper, 0.55), align: 'right', ls: 3, alpha: ra });
    sciRight(ctx, man.toFixed(1), ex, W - 64, 232, 92, rgb(lt > lsplit ? C.gold : C.paper), ra);
    if (age > 0) text(ctx, 'THE BUTTERFLY EFFECT', W - 64, 280, { font: FONT.mono(700, 16), color: rgb(C.gold), align: 'right', ls: 4, alpha: clamp(age * 6) });
  },
};
