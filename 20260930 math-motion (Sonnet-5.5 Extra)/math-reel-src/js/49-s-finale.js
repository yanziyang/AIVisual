/* ============================================================================
   Scene 10  EULER'S IDENTITY + TITLE LOCK-UP   (16.67 - 20.0 s)
   e^{i theta} walks half-way round the unit circle to -1; five constants assemble into  e^{i pi} + 1 = 0.
   The unit circle then swells into a paper iris (match cut) that carries the lock-up; the opening motif returns.
   ========================================================================== */
const EU = { cx: 590, cy: 560, R: 250 };
const T_IRIS0 = 1.72, T_IRIS1 = 2.06, T_TITLE = 5 * BEAT;      // title lands on beat 45

SCENE_IMPL.finale = {
  samples: 4,
  fx(fx, lt) {
    const iris = ez(E.io3, lt, T_IRIS0, T_IRIS1);
    const ink = lt > T_IRIS1 - 0.04;
    fx.hudColor = ink ? C.ink : C.paper; fx.hudAccent = ink ? C.ember : C.aqua;
    fx.bloom = 0.75 * (1 - clamp(iris * 3.5)) + 0.08 * clamp(iris * 3.5); fx.bloomThresh = lerp(0.6, 0.95, clamp(iris * 3)); fx.vig = lerp(0.25, 0.10, iris);
    const age = lt - T_TITLE; if (age > 0 && age < 0.25) { fx.flash = 0.22 * Math.pow(1 - age / 0.25, 2); fx.flashC = norm3(C.paper); }
    fx.ca = 0.002 * (1 - iris);
  },
  draw(ctx, lt, t, fx) {
    const { cx, cy, R } = EU;
    const iris = ez(E.io3, lt, T_IRIS0, T_IRIS1);
    if (iris < 1) this.eulerPart(ctx, lt, t, iris);
    if (iris > 0) {
      // paper iris grows out of the unit circle
      const r = lerp(R, 1500, E.io3(prog(lt, T_IRIS0, T_IRIS1)));
      ctx.save(); ctx.fillStyle = rgb(C.paper); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgb(C.aqua, 1 - iris); ctx.lineWidth = 5; ctx.stroke(); ctx.restore();
    }
    if (lt > T_IRIS1 - 0.1) this.lockup(ctx, lt, t);
  },
  eulerPart(ctx, lt, t, iris) {
    const { cx, cy, R } = EU, a0 = 1 - clamp(iris * 1.6);
    ctx.save(); ctx.globalAlpha = a0;
    dotGrid(ctx, 0.12, lt * 3500, cx, cy);
    const th = PI * E.io3(prog(lt, 0.10, 1.25)), thR = PI * E.io3(prog(FRAME_T - SC.finale.t0, 0.10, 1.25));
    const P = [cx + R * Math.cos(th), cy - R * Math.sin(th)];
    const ein = ez(E.out4, lt, 0.0, 0.35);
    // axes + unit circle + labels
    ctx.strokeStyle = rgb(C.paper, 0.22); ctx.lineWidth = 1.3;
    seg(ctx, cx - (R + 70) * ein, cy, cx + (R + 70) * ein, cy); seg(ctx, cx, cy - (R + 70) * ein, cx, cy + (R + 70) * ein);
    ring(ctx, cx, cy, R, rgb(C.paper), 1.6, 0.35 * ein);
    const lab = ez(E.out3, lt, 0.1, 0.5), lf = FONT.math(34, true);
    text(ctx, '1', cx + R + 18, cy + 40, { font: lf, color: rgb(C.paper, 0.85), alpha: lab });
    text(ctx, '−1', cx - R - 62, cy + 40, { font: lf, color: rgb(C.gold), alpha: lab });
    text(ctx, '*i*'.replace(/\*/g, ''), cx + 16, cy - R - 16, { font: lf, color: rgb(C.paper, 0.85), alpha: lab });
    text(ctx, '−' + 'i', cx + 16, cy + R + 44, { font: lf, color: rgb(C.paper, 0.6), alpha: lab });
    text(ctx, 'Re', cx + R + 66, cy - 10, { font: FONT.mono(500, 13), color: rgb(C.paper, 0.5), alpha: lab, ls: 2 });
    text(ctx, 'Im', cx + 12, cy - R - 64, { font: FONT.mono(500, 13), color: rgb(C.paper, 0.5), alpha: lab, ls: 2 });
    // swept arc, projections, point
    if (th > 0.01) {
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, -th, true); strokeGlow(ctx, C.aqua, 4.2, 1, 3);
      ctx.strokeStyle = rgb(C.aqua, 0.85); ctx.lineWidth = 2; seg(ctx, cx, cy, P[0], P[1]);
      ctx.strokeStyle = rgb(C.gold); ctx.lineWidth = 3.4; seg(ctx, cx, cy, P[0], cy);
      ctx.strokeStyle = rgb(C.ember); ctx.lineWidth = 3.4; seg(ctx, P[0], cy, P[0], P[1]);
      ctx.strokeStyle = rgb(C.paper, 0.85); ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(cx, cy, 56, 0, -th, true); ctx.stroke();
      text(ctx, 'θ', cx + Math.cos(th / 2) * 90 - 8, cy - Math.sin(th / 2) * 90 + 10, { font: FONT.math(32, true), color: rgb(C.paper) });
    }
    glowDot(ctx, P[0], P[1], 9, C.aqua, ez(E.outBack, lt, 0, 0.3));
    // landing at -1
    const land = lt - 1.25;
    if (land > 0 && land < 0.7) { ring(ctx, cx - R, cy, 12 + land * 360, rgb(C.gold), 2.6, Math.pow(1 - land / 0.7, 2)); ring(ctx, cx - R, cy, 8 + land * 200, rgb(C.paper), 1.8, Math.pow(1 - land / 0.7, 2) * 0.8); }
    // read-outs
    const fm = FONT.mono(500, 17), v = x => (x < -0.00005 ? '−' : '+') + Math.abs(x).toFixed(4), ro = ez(E.out3, lt, 0.2, 0.6);
    text(ctx, 'θ       = ' + thR.toFixed(4), cx - R, cy + R + 76, { font: fm, color: rgb(C.aqua), alpha: ro });
    text(ctx, 'cos θ   = ' + v(Math.cos(thR)), cx - R, cy + R + 104, { font: fm, color: rgb(C.gold), alpha: ro });
    text(ctx, 'sin θ   = ' + v(Math.sin(thR)), cx - R, cy + R + 132, { font: fm, color: rgb(C.ember), alpha: ro });
    drawFormula(ctx, '*e*^(*i*θ) = cos θ + *i* sin θ', cx - R, 205, 40, { color: rgb(C.paper, 0.92), alpha: ez(E.out3, lt, 0.05, 0.45) });
    // the equation, token by token
    const size = 134, gap = size * 0.30, yb = 612, defs = [
      { s: '*e*^(*i*π)', col: C.aqua, t: 1.28 }, { s: '+', col: C.paper, t: 1.40 }, { s: '1', col: C.gold, t: 1.50 }, { s: '=', col: C.paper, t: 1.60 }, { s: '0', col: C.ember, t: 1.70 }];
    ctx.save(); ctx.font = FONT.math(size, false);
    const widths = defs.map(d => layoutFormula(ctx, parseFormula(d.s), 0, 0, size, {}, true));
    ctx.restore();
    const total = widths.reduce((a, b) => a + b, 0) + gap * (defs.length - 1); let x = W - 96 - total;
    text(ctx, 'FIVE CONSTANTS  ·  ONE LINE', x, yb - size * 0.95, { font: FONT.mono(500, 15), color: rgb(C.paper, 0.6), ls: 4, alpha: ez(E.out3, lt, 1.2, 1.5) });
    defs.forEach((d, i) => {
      const p = prog(lt, d.t, d.t + 0.26);
      if (p > 0) {
        const e = E.outBack(p, 2.0); ctx.save(); ctx.globalAlpha *= clamp(p * 3);
        ctx.translate(x + widths[i] / 2, yb - size * 0.3); ctx.scale(1 + (1 - e) * 0.4, 1 + (1 - e) * 0.4); ctx.translate(-widths[i] / 2, size * 0.3 + (1 - e) * 36);
        drawFormula(ctx, d.s, 0, 0, size, { color: rgb(d.col) });
        ctx.restore();
        const a = lt - d.t; if (a > 0 && a < 0.4) ring(ctx, x + widths[i] / 2, yb - size * 0.3, 30 + a * 200, rgb(d.col), 1.6, Math.pow(1 - a / 0.4, 2) * 0.45);
      }
      x += widths[i] + gap;
    });
    ctx.restore();
  },
  lockup(ctx, lt, t) {
    const lc = lt - T_TITLE;                         // time since the title hit
    const cx = W / 2, cy = 520;
    // bookend: thin circle + orbiting dot (the very first motif of the reel)
    const rp = E.outExpo(prog(lc, -0.05, 0.55)), Rr = 640;
    ctx.save(); ctx.strokeStyle = rgb(C.ink, 0.9); ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(cx, cy, Rr, -PI / 2, -PI / 2 + TAU * rp); ctx.stroke();
    ctx.lineWidth = 1.4; ctx.strokeStyle = rgb(C.ink, 0.55);
    for (let i = 0; i < 72; i++) { const a = i / 72 * TAU - PI / 2; if (a > -PI / 2 + TAU * rp) break; const l = i % 6 === 0 ? 22 : 10; seg(ctx, cx + Math.cos(a) * (Rr + 6), cy + Math.sin(a) * (Rr + 6), cx + Math.cos(a) * (Rr + 6 + l), cy + Math.sin(a) * (Rr + 6 + l)); }
    const oa = OMEGA * (t) - PI / 2, ox = cx + Rr * Math.cos(oa), oy = cy + Rr * Math.sin(oa);
    ctx.fillStyle = rgb(C.ember); ctx.beginPath(); ctx.arc(ox, oy, 12 * ez(E.outBack, lc, 0.1, 0.45), 0, TAU); ctx.fill();
    ctx.restore();
    // title
    const sz = 300;
    ctx.save(); ctx.font = FONT.disp(800, sz); try { ctx.letterSpacing = '-9px'; } catch (e) { }
    const tw = ctx.measureText('CLAUDE').width; ctx.restore();
    kinetic(ctx, 'CLAUDE', cx - tw / 2 - 4, cy + 90, sz, lc, { delay: 0.0, stagger: 0.045, dur: 0.55, mode: 'rise', color: rgb(C.ink), ls: -9 });
    revealLine(ctx, 'MOTION DESIGN  ×  MATHEMATICS', cx, cy + 178, 38, ez(E.out5, lc, 0.28, 0.75), { weight: 600, color: rgb(C.ink), align: 'center', ls: 12 });
    const la = ez(E.out3, lc, 0.5, 0.9);
    text(ctx, 'SHOWREEL 2026   ·   20 SEC   ·   144 BPM', cx, cy + 232, { font: FONT.mono(500, 17), color: rgb(C.ink, 0.65), align: 'center', ls: 5, alpha: la });
    drawFormula(ctx, '*e*^(*i*π) + 1 = 0', cx, cy - 240, 40, { color: rgb(C.ink, 0.85), align: 'center', alpha: ez(E.out3, lc, 0.35, 0.8) });
  },
};
