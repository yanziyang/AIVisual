/* ============================================================================
   90-director: scene registry, HUD chrome, cut transitions, frame composition
   ========================================================================== */
const Reel = (() => {
  const R = { ready: false };
  let c2d, ctx, ui, uictx, scale = 1, gl;

  R.init = function (canvas, w = W, h = H) {
    GFX.init(canvas, w, h); gl = GFX.gl;
    c2d = document.createElement('canvas'); c2d.width = w; c2d.height = h;
    ctx = c2d.getContext('2d', { alpha: true });
    ui = document.createElement('canvas'); ui.width = w; ui.height = h; uictx = ui.getContext('2d', { alpha: true });
    scale = w / W;
    R.w = w; R.h = h;
  };
  R.resize = function (w, h) { GFX.resize(w, h); c2d.width = w; c2d.height = h; ui.width = w; ui.height = h; scale = w / W; R.w = w; R.h = h; };
  R.prepare = async function () {
    for (const s of SCENES) { const im = SCENE_IMPL[s.id]; if (im && im.init) await im.init(ctx); }
    R.ready = true;
  };
  R.ctx = () => ctx;

  /* ------------------------------ HUD chrome ------------------------------ */
  function tcString(t) {
    const s = Math.floor(t), f = Math.floor((t - s) * FPS);
    return `00:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  }
  function chrome(ctx, t, sc, lt, fx) {
    const ink = fx.hudColor || C.paper, acc = fx.hudAccent || sc.accent, A = fx.hudAlpha ?? 1;
    if (A <= 0.001) return;
    const mx = 64, my = 56;
    ctx.save(); ctx.globalAlpha = A;
    const pIn = ez(E.out4, t, 0.0, 0.7);
    // corner registration marks
    const m = 30;
    for (const [x, y] of [[m, m], [W - m, m], [m, H - m], [W - m, H - m]]) plusMark(ctx, x, y, 7, rgb(ink, 0.55), pIn, 1.4);
    // brand, top-left
    text(ctx, 'CLAUDE', mx, my + 8, { font: FONT.disp(800, 21), color: rgb(ink, 0.95), ls: 7, alpha: pIn });
    text(ctx, 'MATH IN MOTION  /  SHOWREEL ’26', mx + 136, my + 7, { font: FONT.mono(500, 12.5), color: rgb(ink, 0.5), ls: 2, alpha: pIn });
    // timecode, top-right
    text(ctx, tcString(t), W - mx, my + 7, { font: FONT.mono(500, 15), color: rgb(ink, 0.8), align: 'right', ls: 2, alpha: pIn });
    text(ctx, 'TC', W - mx - 108, my + 7, { font: FONT.mono(500, 11), color: rgb(ink, 0.4), align: 'right', ls: 2, alpha: pIn });
    // bottom-left: scene tag + formula
    const yb = H - my;
    const q = ez(E.out4, lt, 0.05, 0.55);
    text(ctx, sc.idx, mx, yb - 30, { font: FONT.mono(700, 13), color: rgb(acc), ls: 2, alpha: q });
    ctx.save(); ctx.globalAlpha *= q; ctx.fillStyle = rgb(acc); ctx.fillRect(mx + 34, yb - 36, 26 * q, 2); ctx.restore();
    revealLine(ctx, sc.name, mx + 74, yb - 25, 14, ez(E.out4, lt, 0.06, 0.5), { weight: 700, ls: 3.2, color: rgb(ink, 0.92) });
    if (!fx.hideFormula) drawFormula(ctx, sc.formula, mx, yb + 4, 25, { color: rgb(acc), alpha: ez(E.out3, lt, 0.2, 0.7) });
    // bottom-right: progress ticks (one per scene) + running bar
    const n = SCENES.length, tw = 26, gap = 7, totalW = n * tw + (n - 1) * gap;
    let x0 = W - mx - totalW;
    for (let i = 0; i < n; i++) {
      const s = SCENES[i], pr = prog(t, s.t0, s.t1);
      ctx.fillStyle = rgb(ink, 0.22); ctx.fillRect(x0 + i * (tw + gap), yb - 3, tw, 3);
      ctx.fillStyle = rgb(s === sc ? acc : ink, s === sc ? 1 : 0.85); ctx.fillRect(x0 + i * (tw + gap), yb - 3, tw * pr, 3);
    }
    text(ctx, `${sc.idx} / 10`, W - mx, yb - 20, { font: FONT.mono(500, 12), color: rgb(ink, 0.55), align: 'right', ls: 2 });
    ctx.restore();
  }

  /* ----------------------------- cut transitions -------------------------- */
  const CUTS = [
    { t: SC.surface.t0, type: 'slab', cols: [C.ember, C.paper, C.ink2], dur: 0.36 },
    { t: SC.chaos.t0, type: 'blinds', col: C.aqua, dur: 0.34 },
    { t: SC.mandel.t0, type: 'whip', dur: 0.30, col: C.paper },
    { t: SC.times.t0, type: 'clap', col: C.ember, dur: 0.16 },
    { t: SC.golden.t0, type: 'clap', col: C.ink, dur: 0.16 },
    { t: SC.ulam.t0, type: 'clap', col: C.paper, dur: 0.16 },
    { t: SC.monte.t0, type: 'clap', col: C.ember, dur: 0.16 },
    { t: SC.finale.t0, type: 'clap', col: C.paper, dur: 0.20 },
  ];
  function parallelogram(ctx, xl, xr, skew) {
    ctx.beginPath(); ctx.moveTo(xl + skew, -2); ctx.lineTo(xr + skew, -2); ctx.lineTo(xr - skew, H + 2); ctx.lineTo(xl - skew, H + 2); ctx.closePath(); ctx.fill();
  }
  function transitions(ctx, t, fx) {
    for (const c of CUTS) {
      const a = c.t - c.dur / 2, b = c.t + c.dur / 2;
      if (t < a - 0.35 || t > b + 0.35) continue;
      const p = (t - a) / c.dur;          // 0..1 across the wipe, cut at 0.5
      if (c.type === 'slab' && p > 0 && p < 1) {
        const n = c.cols.length, skew = 150;
        for (let i = 0; i < n; i++) {
          const enter = E.io3(prog(p, i * 0.09, 0.5 - (n - 1 - i) * 0.06 + 0.0));
          const exit = E.io3(prog(p, 0.5 + (n - 1 - i) * 0.09, 1.0 - i * 0.04));
          const lead = lerp(-skew * 2, W + skew * 2, enter), trail = lerp(-skew * 2, W + skew * 2, exit);
          if (lead - trail > 1) { ctx.fillStyle = rgb(c.cols[i]); parallelogram(ctx, trail, lead, skew); }
        }
      }
      if (c.type === 'blinds' && p > 0 && p < 1) {
        const rows = 9, hh = H / rows;
        for (let r = 0; r < rows; r++) {
          const d = r / rows * 0.34;
          const enter = E.io3(prog(p, d * 0.7, 0.5 - 0.0 + d * 0.0 - (rows - 1 - r) / rows * 0.14));
          const exit = E.io3(prog(p, 0.5 + d * 0.7, 1.0 - (rows - 1 - r) / rows * 0.05));
          const l = lerp(0, W, enter), tr = lerp(0, W, exit);
          if (l - tr > 0.5) { ctx.fillStyle = rgb(r % 2 ? C.paper : c.col); ctx.fillRect(tr, r * hh - 0.5, l - tr, hh + 1); }
        }
      }
      if (c.type === 'whip') {
        // radial whip zoom-blur ramps up, white flash at the cut, then settles
        const k = Math.exp(-Math.pow((t - c.t) / (c.dur * 0.3), 2));
        fx.zb = Math.max(fx.zb, 0.30 * k); fx.flash = Math.max(fx.flash, 0.85 * Math.exp(-Math.pow((t - c.t) / 0.032, 2)));
        fx.ca += 0.012 * k; fx.flashC = norm3(c.col);
      }
      if (c.type === 'clap') {
        const dt = t - c.t;
        if (dt >= -0.01 && dt < c.dur) {
          const k = 1 - dt / c.dur; fx.flash = Math.max(fx.flash, 0.85 * k * k); fx.flashC = norm3(c.col); fx.ca += 0.010 * k;
        }
      }
    }
  }

  /* ----------------------------- one sub-frame ---------------------------- */
  function subframe(ts, jx, jy, weight) {
    const sc = sceneAt(ts), lt = ts - sc.t0, impl = SCENE_IMPL[sc.id];
    const fx = GFX.defaultFx();
    fx.jx = jx; fx.jy = jy;      // sub-pixel jitter (px): applied by every layer in its own rasteriser = true super-sampling
    if (impl && impl.fx) impl.fx(fx, lt, ts, sc);
    // camera punch on the beat
    const pk = impl && impl.punch !== undefined ? impl.punch : 0.007;
    const bp = beatPulse(ts, 1, 7);
    fx.zoom *= 1 + pk * bp;
    fx.ca += (impl && impl.caKick !== undefined ? impl.caKick : 0.0016) * bp;
    if (impl && impl.bg) { impl.bg(lt, ts, fx, sc); fx.useBg = 1; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c2d.width, c2d.height);
    ctx.setTransform(scale, 0, 0, scale, jx, jy);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    if (impl && impl.draw) impl.draw(ctx, lt, ts, fx, sc);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    // UI layer (crisp, composited after bloom / CA): HUD + transition slabs
    uictx.setTransform(1, 0, 0, 1, 0, 0); uictx.clearRect(0, 0, ui.width, ui.height); uictx.setTransform(scale, 0, 0, scale, jx, jy);
    chrome(uictx, FRAME_T, sc, lt, fx);
    transitions(uictx, ts, fx);
    // final fade-out
    fx.fade = Math.max(fx.fade, ez(E.io2, ts, DUR - 0.25, DUR));
    GFX.uploadOverlay(c2d); GFX.uploadUi(ui);
    GFX.composeAndAccumulate(fx, weight);
    return fx;
  }

  // render one output frame at time t (seconds) with N temporal samples
  R.frame = function (t, opt = {}) {
    const impl = SCENE_IMPL[sceneAt(t).id];
    const N = Math.max(1, opt.samples ?? 1), shutter = opt.shutter ?? 0.5;
    FRAME_T = t;
    GFX.clearAcc();
    let fx;
    for (let s = 0; s < N; s++) {
      const ts = N > 1 ? t + ((s + 0.5) / N - 0.5) * shutter / FPS : t;
      const jx = N > 1 ? fract(0.5 + s * 0.7548776662) - 0.5 : 0, jy = N > 1 ? fract(0.5 + s * 0.5698402909) - 0.5 : 0;
      fx = subframe(Math.min(Math.max(ts, 0), DUR - 1e-4), jx, jy, 1 / N);
    }
    GFX.present(fx, opt.seed ?? Math.floor(t * FPS));
    return fx;
  };
  R.samplesFor = t => {
    const im = SCENE_IMPL[sceneAt(t).id]; let n = im && im.samples ? im.samples : 4;
    for (const c of CUTS) if ((c.type === 'slab' || c.type === 'blinds') && Math.abs(t - c.t) < c.dur / 2 + 0.04) n = Math.max(n, 16);
    return n;
  };
  return R;
})();
