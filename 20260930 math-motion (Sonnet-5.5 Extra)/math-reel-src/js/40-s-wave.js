/* ============================================================================
   Scene 01  UNIT CIRCLE   (0.0 - 1.67 s)
   Scene 02  FOURIER       (1.67 - 5.0 s)  part A: square-wave epicycles, part B: DFT chain draws the glyph pi
   The two scenes share one layout and one angle theta(t) = 2 pi t / bar, so the cut is invisible.
   ========================================================================== */
const OR = { cx: 500, cy: 590, R: 210, x0: 800, pxr: 148 };
const OMEGA = TAU / (4 * BEAT);                 // one revolution per bar
const PI_ZONE = { cx: 1060, cy: 612, H: 500 };

function dotGrid(ctx, a = 0.1, rev = 1e5, cx = W / 2, cy = H / 2, col = C.paper, step = 60) {
  ctx.save(); ctx.fillStyle = rgb(col);
  for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) {
    const d = Math.hypot(x - cx, y - cy), k = clamp((rev - d) / 160);
    if (k <= 0) continue;
    ctx.globalAlpha = a * k * (1 - 0.55 * clamp(d / 1500));
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }
  ctx.restore();
}
function seg(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function polyline(ctx, pts, from = 0, to = pts.length) { ctx.beginPath(); for (let i = from; i < to; i++) i === from ? ctx.moveTo(pts[i][0], pts[i][1]) : ctx.lineTo(pts[i][0], pts[i][1]); }
function strokeGlow(ctx, col, lw, a = 1, glowMul = 3.2) {
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = rgb(col, 0.16 * a); ctx.lineWidth = lw * glowMul; ctx.stroke();
  ctx.strokeStyle = rgb(col, a); ctx.lineWidth = lw; ctx.stroke(); ctx.restore();
}

/* ------------------------------- scene 01 -------------------------------- */
SCENE_IMPL.origin = {
  samples: 4,
  fx(fx, lt) { fx.flash = 0.3 * Math.exp(-lt * 38); fx.flashC = norm3(C.aqua); fx.bloom = 0.62; },
  draw(ctx, lt, t, fx) {
    const { cx, cy, R, x0, pxr } = OR;
    const th = Math.min(OMEGA * t, TAU), thR = Math.min(OMEGA * FRAME_T, TAU);
    dotGrid(ctx, 0.12, lt * 2800, cx, cy);

    // axes
    const axp = ez(E.out4, lt, 0.04, 0.55);
    ctx.save(); ctx.strokeStyle = rgb(C.paper, 0.2); ctx.lineWidth = 1.3;
    seg(ctx, cx - R - 80 * axp, cy, cx + (x0 + TAU * pxr - cx + 30) * axp, cy);
    seg(ctx, cx, cy - (R + 70) * axp, cx, cy + (R + 70) * axp);
    ctx.restore();

    // circle (draws ahead of the orbiting point), ticks, labels
    const cp = TAU * E.outExpo(prog(lt, 0.02, 0.62));
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, -cp, true); strokeGlow(ctx, C.aqua, 2.6, 0.95); ctx.restore();
    ctx.save(); ctx.strokeStyle = rgb(C.paper, 0.5); ctx.lineWidth = 1.4;
    for (let i = 0; i < 24; i++) {
      const a = i * PI / 12; if (a > cp) break;
      const r0 = R + (i % 6 === 0 ? -13 : -6), r1 = R + (i % 6 === 0 ? 11 : 4);
      seg(ctx, cx + Math.cos(a) * r0, cy - Math.sin(a) * r0, cx + Math.cos(a) * r1, cy - Math.sin(a) * r1);
    }
    ctx.restore();
    const lab = ['0', 'π/2', 'π', '3π/2'];
    for (let q = 0; q < 4; q++) {
      const a = q * PI / 2; if (a > cp) continue;
      text(ctx, lab[q], cx + Math.cos(a) * (R + 40), cy - Math.sin(a) * (R + 40) + 5, { font: FONT.mono(500, 14), color: rgb(C.paper, 0.6), align: 'center' });
    }

    // the orbiting point + its projections
    const P = [cx + R * Math.cos(th), cy - R * Math.sin(th)];
    const sg = ez(E.out3, lt, 0.1, 0.45);
    if (th > 0.02) {
      ctx.save(); ctx.globalAlpha = sg;
      ctx.strokeStyle = rgb(C.aqua, 0.85); ctx.lineWidth = 2; seg(ctx, cx, cy, P[0], P[1]);                      // radius
      ctx.strokeStyle = rgb(C.gold); ctx.lineWidth = 3.4; seg(ctx, cx, cy, P[0], cy);                             // cos
      ctx.strokeStyle = rgb(C.ember); ctx.lineWidth = 3.4; seg(ctx, P[0], cy, P[0], P[1]);                         // sin
      ctx.strokeStyle = rgb(C.paper, 0.85); ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(cx, cy, 50, 0, -th, true); ctx.stroke();   // theta arc
      ctx.restore();
      const am = th / 2; text(ctx, 'θ', cx + Math.cos(am) * 80 - 6, cy - Math.sin(am) * 80 + 9, { font: FONT.math(30, true), color: rgb(C.paper), alpha: sg * clamp(th * 3) });
      glowDot(ctx, P[0], cy, 5, C.gold, sg); glowDot(ctx, cx, P[1], 0.1, C.ember, 0);
    }
    // wave (sin theta unrolled to the right) with dashed connector
    const head = [x0, P[1]];
    const n = 320, pts = [];
    for (let i = 0; i <= n; i++) { const ph = th * (1 - i / n); pts.push([x0 + (th - ph) * pxr, cy - R * Math.sin(ph)]); }
    if (th > 0.02) {
      ctx.save(); ctx.setLineDash([3, 8]); ctx.strokeStyle = rgb(C.paper, 0.55); ctx.lineWidth = 1.6; seg(ctx, P[0], P[1], x0, P[1]); ctx.restore();
      polyline(ctx, pts); strokeGlow(ctx, C.ember, 3.4, 1);
      glowDot(ctx, head[0], head[1], 7, C.ember, 1);
    }
    glowDot(ctx, P[0], P[1], 8, C.aqua, ez(E.outBack, lt, 0, 0.3));
    // ping rings on the quarter turns (they lock to the pizzicato of the score)
    for (let b = 0; b < 4; b++) {
      const age = lt - b * BEAT; if (age < 0 || age > 0.6) continue;
      const a0 = OMEGA * b * BEAT, px = cx + R * Math.cos(a0), py = cy - R * Math.sin(a0);
      ring(ctx, px, py, 10 + age * 230, rgb(C.aqua), 2, Math.pow(1 - age / 0.6, 2) * 0.8);
    }
    // readouts
    const ro = ez(E.out3, lt, 0.3, 0.7), fm = FONT.mono(500, 17), v = x => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(3);
    const bx = cx - R, by = cy + R + 62;
    text(ctx, 'θ     = ' + thR.toFixed(3) + ' rad', bx, by, { font: fm, color: rgb(C.aqua), alpha: ro });
    text(ctx, 'sin θ = ' + v(Math.sin(thR)), bx, by + 28, { font: fm, color: rgb(C.ember), alpha: ro });
    text(ctx, 'cos θ = ' + v(Math.cos(thR)), bx, by + 56, { font: fm, color: rgb(C.gold), alpha: ro });
    text(ctx, '*y* = sin *θ*'.replace(/\*/g, ''), x0 + TAU * pxr, cy - R - 34, { font: FONT.math(32, true), color: rgb(C.ember), align: 'right', alpha: ez(E.out3, lt, 0.6, 1.0) });

    // headline
    kinetic(ctx, 'ONE CIRCLE', 64, 200, 108, lt, { delay: 0.28, stagger: 0.04, dur: 0.5, mode: 'rise', colorAt: i => i < 4 ? rgb(C.paper) : rgb(C.aqua), ls: 0 });
  },
};

/* ------------------------------- scene 02 -------------------------------- */
const harmonicsAt = lt => { const h = Math.floor(lt / (BEAT / 2)); return h < NSCHED.length ? NSCHED[h] : 32; };
const harmonicBirth = k => { let h = NSCHED.findIndex(n => n >= k); return h < 0 ? NSCHED.length * BEAT / 2 : h * BEAT / 2; };
const PIA = { dft: null, path: null, trail: null, scale: 1, nUse: 0, nDraw: 96 };

SCENE_IMPL.fourier = {
  samples: 4,
  init() {
    const d = glyphContourDFT('π', s => FONT.math(s, false, 700), { kmax: 110, samples: 2048 });
    PIA.dft = d; PIA.scale = PI_ZONE.H / d.height; PIA.nUse = d.coef.length;
    const p = new Path2D(); d.z.forEach((q, i) => { const x = PI_ZONE.cx + q[0] * PIA.scale, y = PI_ZONE.cy + q[1] * PIA.scale; i ? p.lineTo(x, y) : p.moveTo(x, y); }); p.closePath(); PIA.path = p;
    const tmp = [], J = 1000; PIA.trail = [];
    for (let j = 0; j <= J; j++) PIA.trail.push(epicycleChain(d.coef, PIA.nUse, j / J, PIA.scale, PI_ZONE.cx, PI_ZONE.cy, tmp).tip.slice());
  },
  fx(fx, lt) { fx.bloom = 0.62; },
  draw(ctx, lt, t, fx) {
    const { cx, cy, R, x0, pxr } = OR;
    const tB = lt - 4 * BEAT;                     // time inside part B (negative during A)
    dotGrid(ctx, 0.12, 1e5, cx, cy);
    const A = R * PI / 4;                          // square-wave amplitude in px
    const aA = 1 - E.in3(prog(tB, 0.0, 0.24));     // part-A visibility
    if (aA > 0.002) {
      ctx.save(); ctx.globalAlpha = aA;
      const th = OMEGA * t, n = harmonicsAt(Math.min(lt, 4 * BEAT - 1e-6));
      const g = []; for (let k = 1; k <= 32; k++) g.push(k <= n ? E.outBack(prog(lt, harmonicBirth(k), harmonicBirth(k) + 0.16)) : 0);
      const wc = mixc(C.ember, C.gold, clamp((n - 1) / 8));
      // axes
      ctx.strokeStyle = rgb(C.paper, 0.2); ctx.lineWidth = 1.3; seg(ctx, cx - R - 80, cy, x0 + TAU * pxr + 30, cy); seg(ctx, cx, cy - R - 70, cx, cy + R + 70);
      // ideal square wave (ghost) + Gibbs reference levels
      const gib = ez(E.out3, lt, 4 * BEAT * 0.2, 4 * BEAT * 0.6);
      ctx.save(); ctx.globalAlpha *= 0.28; ctx.strokeStyle = rgb(C.paper); ctx.lineWidth = 1.6; ctx.setLineDash([2, 7]);
      ctx.beginPath(); for (let i = 0; i <= 200; i++) { const ph = th - TAU * i / 200, s = Math.sin(ph) >= 0 ? 1 : -1; const X = x0 + (th - ph) * pxr, Y = cy - A * s; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } ctx.stroke(); ctx.restore();
      if (gib > 0.01) {
        ctx.save(); ctx.globalAlpha *= gib * 0.7; ctx.setLineDash([6, 6]); ctx.lineWidth = 1.3; ctx.strokeStyle = rgb(C.aqua, 0.8);
        const yy = cy - A * 1.179; seg(ctx, x0, yy, x0 + TAU * pxr, yy);
        ctx.restore();
        text(ctx, 'GIBBS OVERSHOOT ≈ 9 % OF THE JUMP', x0 + TAU * pxr, cy - A * 1.179 - 12, { font: FONT.mono(500, 13), color: rgb(C.aqua), align: 'right', alpha: gib, ls: 1.5 });
      }
      // partial-sum wave
      const NS = 560, pts = [];
      for (let i = 0; i <= NS; i++) {
        const ph = th - TAU * i / NS; let s = 0;
        for (let k = 1; k <= 32; k++) if (g[k - 1] > 0) s += g[k - 1] * R / (2 * k - 1) * Math.sin((2 * k - 1) * ph);
        pts.push([x0 + (th - ph) * pxr, cy - s]);
      }
      // epicycle chain
      let px = cx, py = cy;
      const circ = [];
      for (let k = 1; k <= 32; k++) {
        if (g[k - 1] <= 0) break;
        const r = g[k - 1] * R / (2 * k - 1), a = (2 * k - 1) * th;
        circ.push([px, py, r, a]); px += r * Math.cos(a); py -= r * Math.sin(a);
      }
      // connector + wave
      ctx.save(); ctx.setLineDash([3, 8]); ctx.strokeStyle = rgb(C.paper, 0.55); ctx.lineWidth = 1.6; seg(ctx, px, py, x0, py); ctx.restore();
      polyline(ctx, pts); strokeGlow(ctx, wc, 3.6, 1);
      // circles
      circ.forEach((c, i) => {
        const a = clamp(0.2 + 0.7 * Math.pow(c[2] / R, 0.35));
        ring(ctx, c[0], c[1], c[2], rgb(C.aqua), i === 0 ? 2.4 : 1.4, a);
        ctx.strokeStyle = rgb(C.aqua, a * 0.9); ctx.lineWidth = i === 0 ? 2 : 1.3; seg(ctx, c[0], c[1], c[0] + c[2] * Math.cos(c[3]), c[1] - c[2] * Math.sin(c[3]));
      });
      glowDot(ctx, x0, py, 7, wc, 1);
      glowDot(ctx, px, py, 7, C.gold, 1);
      // counter + equation
      const ltF = FRAME_T - SC.fourier.t0, nbF = Math.min(harmonicsAt(Math.min(ltF, 4 * BEAT - 1e-6)), 32), nb = nbF, since = ltF - (nb === 32 ? 3.9 * BEAT : harmonicBirth(nb));
      const pulse = 1 + 0.16 * Math.exp(-since * 14);
      ctx.save(); ctx.translate(W - 64, 210); ctx.scale(pulse, pulse);
      text(ctx, String(nb), 0, 0, { font: FONT.disp(800, 150), color: rgb(C.gold), align: 'right' }); ctx.restore();
      text(ctx, 'HARMONICS IN THE SUM', W - 64, 252, { font: FONT.mono(500, 13), color: rgb(C.paper, 0.55), align: 'right', ls: 3 });
      drawFormula(ctx, '*sq*(*t*) = (4/π) {sum} sin((2*k*− 1)*t*) / (2*k* − 1)', x0 - 24, cy + R + 108, 31, { color: rgb(C.paper, 0.9), alpha: ez(E.out3, lt, 0.25, 0.6) });
      ctx.restore();
    }
    // headline (part A lines, part B line)
    const lA = ez(E.out5, lt, 0.2 * 0 + 0.15, 0.6), outA = 1 - ez(E.in3, tB, 0, 0.2);
    // line 1 persists from scene 01 until the shape appears
    if (tB < 0.2) {
      ctx.save(); ctx.globalAlpha = outA;
      kinetic(ctx, 'ONE CIRCLE', 64, 200, 108, 9, { colorAt: i => i < 4 ? rgb(C.paper) : rgb(C.aqua) });
      revealLine(ctx, 'BECOMES EVERY WAVE.', 68, 284, 58, lA * outA, { weight: 700, color: rgb(C.paper, 0.95), ls: 1 });
      ctx.restore();
    }
    // -------- part B: DFT chain draws the glyph --------
    if (tB > -0.05) {
      const d = PIA.dft, sc = PIA.scale, N = PIA.nUse;
      const tau = E.io2(prog(tB, 0.30, 1.40));
      const chainA = prog(tB, 0.12, 0.3) * (1 - prog(tB, 1.38, 1.52));
      // ghost outline
      ctx.save(); ctx.globalAlpha = 0.5 * ez(E.out3, tB, 0.1, 0.5) * (1 - prog(tB, 1.4, 1.55)); ctx.setLineDash([2, 6]); ctx.strokeStyle = rgb(C.paper, 0.5); ctx.lineWidth = 1.4; ctx.stroke(PIA.path); ctx.restore();
      if (chainA > 0.01) {
        const nCirc = Math.round(N * E.out3(prog(tB, 0.15, 0.7)));
        const chain = epicycleChain(d.coef, Math.max(2, nCirc), tau, sc, PI_ZONE.cx, PI_ZONE.cy, []);
        ctx.save(); ctx.globalAlpha = chainA;
        const nd = Math.min(PIA.nDraw, chain.length), rmax = chain[0] ? chain[0][2] : 1;
        for (let i = 0; i < nd; i++) {
          const c = chain[i], k = d.coef[i + 1], a = TAU * k.k * tau;
          const al = 0.20 + 0.65 * Math.pow(c[2] / rmax, 0.35);
          const born = E.outBack(prog(tB, 0.14 + i * 0.0035, 0.34 + i * 0.0035));
          ring(ctx, c[0], c[1], c[2] * born, rgb(C.aqua), i < 6 ? 2.2 : 1.3, al);
          ctx.strokeStyle = rgb(C.aqua, al * 0.9); ctx.lineWidth = i < 6 ? 2 : 1.2;
          const ang = Math.atan2(k.re * Math.sin(a) + k.im * Math.cos(a), k.re * Math.cos(a) - k.im * Math.sin(a));
          seg(ctx, c[0], c[1], c[0] + Math.cos(ang) * c[2] * born, c[1] + Math.sin(ang) * c[2] * born);
        }
        ctx.restore();
        // trail
        const J = PIA.trail.length - 1, up = Math.floor(tau * J);
        ctx.save(); ctx.globalAlpha = Math.min(1, prog(tB, 0.28, 0.34) + 0.0);
        polyline(ctx, PIA.trail, 0, up + 1); ctx.lineTo(chain.tip[0], chain.tip[1]);
        strokeGlow(ctx, C.gold, 3.4, 1, 3.4);
        ctx.restore();
        glowDot(ctx, chain.tip[0], chain.tip[1], 8, C.gold, chainA);
      }
      // finished glyph: fill + edge + pulse
      const fillA = E.out3(prog(tB, 1.38, 1.6));
      if (fillA > 0) {
        ctx.save(); ctx.globalAlpha = fillA; ctx.fillStyle = rgb(C.paper); ctx.fill(PIA.path);
        ctx.restore();
        ctx.save(); ctx.strokeStyle = rgb(C.gold); ctx.lineWidth = 3; ctx.globalAlpha = fillA; ctx.stroke(PIA.path); ctx.restore();
      }
      // headline B + counter
      revealLine(ctx, 'AND EVERY SHAPE.', 68, 200, 96, ez(E.out5, tB, 0.20, 0.66), { weight: 800, color: rgb(C.paper), ls: 0 });
      revealLine(ctx, 'EVEN π.', 70, 284, 58, ez(E.out5, tB, 0.42, 0.85), { weight: 700, color: rgb(C.gold), ls: 1 });
      const cnt = Math.round(N * E.out3(prog(FRAME_T - SC.fourier.t0 - 4 * BEAT, 0.15, 0.9)));
      const aB = ez(E.out3, tB, 0.24, 0.5);
      text(ctx, String(cnt), W - 64, 210, { font: FONT.disp(800, 150), color: rgb(C.gold), align: 'right', alpha: aB });
      text(ctx, 'EPICYCLES TRACING A GLYPH', W - 64, 252, { font: FONT.mono(500, 13), color: rgb(C.paper, 0.55), align: 'right', ls: 3, alpha: aB });
      drawFormula(ctx, '*z*(*t*) = {sum}_(*k*) *c*_(*k*) *e*^(2π*i*·*k*·*t*)', 70, H - 168, 30, { color: rgb(C.paper, 0.9), alpha: aB });
    }
  },
};
