/* ============================================================================
   10-audio: the score, synthesised sample-by-sample in plain JavaScript (runs in the page and in node)
   144 BPM, A minor.  Mathematics inside the music:
     - melody          = digits of pi (and later e) mapped onto an A-minor pentatonic scale
     - hi-hat rhythms  = Euclidean (Bjorklund-style) patterns; in the chaos scene the logistic map x -> 3.9 x (1-x)
     - Fourier scene   = the square-wave partials you see being added (1, 3, 5, ... with amplitude 1/k)
     - infinite zoom   = a Shepard tone (octave-spaced partials under a Gaussian window) that rises forever
   ========================================================================== */
function renderScore(SR = 48000) {
  const N = Math.round(SR * DUR), rnd = mulberry32(144);
  const st = () => ({ L: new Float32Array(N), R: new Float32Array(N) });
  const drums = st(), bass = st(), pad = st(), lead = st(), fxb = st(), rv = st();
  const T = b => b * BEAT;
  const clampI = i => Math.max(0, Math.min(N - 1, i));
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const kicks = [];

  /* ---- DSP primitives -------------------------------------------------- */
  class SVF {                                   // Chamberlin state-variable filter
    constructor() { this.lp = 0; this.bp = 0; this.hp = 0; }
    p(x, f, q) {
      const g = 2 * Math.sin(Math.PI * Math.min(f, 7800) / SR), k = 1 / q;
      this.hp = x - this.lp - k * this.bp; this.bp += g * this.hp; this.lp += g * this.bp; return this.lp;
    }
  }
  const blep = (t, dt) => t < dt ? (t /= dt, t + t - t * t - 1) : t > 1 - dt ? (t = (t - 1) / dt, t * t + t + t + 1) : 0;
  const add = (b, i, l, r) => { if (i >= 0 && i < N) { b.L[i] += l; b.R[i] += r; } };
  const panG = p => [Math.cos((p + 1) * PI / 4), Math.sin((p + 1) * PI / 4)];   // equal power, p in -1..1

  /* ---- drums ------------------------------------------------------------ */
  function kick(t, v = 1, len = 0.5) {
    const i0 = Math.round(t * SR), n = Math.round(len * SR); let ph = 0; kicks.push([t, v]);
    for (let k = 0; k < n; k++) {
      const tt = k / SR; ph += TAU * (44 + 118 * Math.exp(-tt * 30)) / SR;
      let s = Math.sin(ph) * Math.exp(-tt * 7.2) + Math.sin(ph * 2) * 0.10 * Math.exp(-tt * 22);
      if (tt < 0.004) s += (rnd() * 2 - 1) * 0.30 * (1 - tt / 0.004);
      s = Math.tanh(s * 1.7) * 0.92 * v; add(drums, i0 + k, s, s);
    }
  }
  function clap(t, v = 1, send = 0.3) {
    const i0 = Math.round(t * SR), n = Math.round(0.34 * SR), f = new SVF(), f2 = new SVF();
    for (let k = 0; k < n; k++) {
      const tt = k / SR; let e = Math.exp(-tt * 18) * 0.65;
      for (let b = 0; b < 3; b++) { const d = tt - b * 0.0105; if (d >= 0) e += Math.exp(-d * 190) * 0.55; }
      f.p(rnd() * 2 - 1, 1500, 0.9); f2.p(f.bp * 2.2, 2600, 0.8);
      const s = (f.bp * 0.9 + f2.bp * 0.5) * e * v * 0.55; add(drums, i0 + k, s * 0.95, s * 1.05); add(rv, i0 + k, s * send, s * send);
    }
  }
  function hat(t, open = false, v = 0.6, pan = 0) {
    const i0 = Math.round(t * SR), n = Math.round((open ? 0.22 : 0.06) * SR), f = new SVF(), [gl, gr] = panG(pan);
    for (let k = 0; k < n; k++) {
      const tt = k / SR; f.p(rnd() * 2 - 1, 7200, 0.7);
      const s = f.hp * Math.exp(-tt * (open ? 17 : 95)) * v * 0.30; add(drums, i0 + k, s * gl * 1.4, s * gr * 1.4);
    }
  }
  function tom(t, f0 = 120, v = 0.7) {
    const i0 = Math.round(t * SR), n = Math.round(0.3 * SR); let ph = 0;
    for (let k = 0; k < n; k++) { const tt = k / SR; ph += TAU * (f0 * (1 + 0.8 * Math.exp(-tt * 40))) / SR; const s = Math.sin(ph) * Math.exp(-tt * 13) * v * 0.6; add(drums, i0 + k, s, s); add(rv, i0 + k, s * 0.15, s * 0.15); }
  }
  function snareRoll(t0, t1, v0 = 0.25, v1 = 0.85, steps = 16) {
    for (let i = 0; i < steps; i++) { const u = i / (steps - 1), t = lerp(t0, t1, i / steps); clap(t, lerp(v0, v1, u), 0.18); }
  }

  /* ---- tonal voices -------------------------------------------------- */
  function bassNote(t, dur, f, v = 1, cut0 = 1000, cut1 = 150, wob = 0) {
    const i0 = Math.round(t * SR), n = Math.round((dur + 0.05) * SR), fl = new SVF(); let p1 = 0, p2 = rnd(), ps = 0;
    for (let k = 0; k < n; k++) {
      const tt = k / SR, dt1 = f / SR, dt2 = f * 1.006 / SR;
      const s1 = 2 * p1 - 1 - blep(p1, dt1), s2 = 2 * p2 - 1 - blep(p2, dt2); p1 = (p1 + dt1) % 1; p2 = (p2 + dt2) % 1; ps += TAU * f / SR;
      let cf = cut1 + (cut0 - cut1) * Math.exp(-tt * 14); if (wob) cf *= 0.55 + 0.45 * Math.sin(TAU * wob * tt + 1.2) * 0.5 + 0.45;
      const x = fl.p((s1 + s2) * 0.5, cf, 1.2) * 0.85 + Math.sin(ps) * 0.45;
      const env = Math.min(1, tt / 0.004) * (tt > dur ? Math.max(0, 1 - (tt - dur) / 0.05) : 1);
      const s = Math.tanh(x * 1.25) * env * v * 0.62; add(bass, i0 + k, s, s);
    }
  }
  function padChord(t, dur, notes, v = 1, att = 0.35, cutoff = 1800) {
    const i0 = Math.round(t * SR), n = Math.round((dur + 0.7) * SR);
    notes.forEach((m, ni) => {
      const f = mtof(m), fl = new SVF(), ph = [rnd(), rnd(), rnd()], det = [0.994, 1.0, 1.006], pan = [-0.7, 0, 0.7];
      for (let k = 0; k < n; k++) {
        const tt = k / SR; let sl = 0, sr = 0;
        for (let j = 0; j < 3; j++) { const dt = f * det[j] / SR, s = 2 * ph[j] - 1 - blep(ph[j], dt); ph[j] = (ph[j] + dt) % 1; const [gl, gr] = panG(pan[j]); sl += s * gl; sr += s * gr; }
        const env = Math.min(1, tt / att) * (tt > dur ? Math.max(0, 1 - (tt - dur) / 0.7) : 1);
        const cf = cutoff * (0.35 + 0.65 * Math.min(1, tt / (att * 3)));
        fl.p(0, cf, 0.9); const m1 = (sl + sr) * 0.5;   // filter on the mid, keep width from the voices
        const y = fl.p(m1, cf, 0.9);
        const w = 0.05 * v * env * (1 / Math.sqrt(notes.length));
        add(pad, i0 + k, (y + (sl - m1) * 0.2) * w, (y + (sr - m1) * 0.2) * w); add(rv, i0 + k, y * w * 0.9, y * w * 0.9);
      }
    });
  }
  function pluck(t, f, v = 1, pan = 0, send = 0.35, bright = 5200) {
    const i0 = Math.round(t * SR), n = Math.round(0.9 * SR), fl = new SVF(), [gl, gr] = panG(pan); let p1 = 0, p2 = 0;
    for (let k = 0; k < n; k++) {
      const tt = k / SR, d1 = f / SR, d2 = f * 1.004 / SR;
      const s = (2 * p1 - 1 - blep(p1, d1)) * 0.6 + (p2 < 0.5 ? 1 : -1) * 0.25; p1 = (p1 + d1) % 1; p2 = (p2 + d2) % 1;
      const y = fl.p(s, 450 + bright * Math.exp(-tt * 16), 1.1);
      const env = Math.min(1, tt / 0.003) * Math.exp(-tt * 5.2), o = y * env * v * 0.34;
      add(lead, i0 + k, o * gl * 1.4, o * gr * 1.4); add(rv, i0 + k, o * send, o * send);
    }
  }
  function stab(t, notes, dur = 0.25, v = 1) {
    const i0 = Math.round(t * SR), n = Math.round((dur + 0.35) * SR);
    notes.forEach(m => {
      const f = mtof(m), fl = new SVF(), ph = [rnd(), rnd(), rnd(), rnd(), rnd()], det = [0.988, 0.994, 1, 1.006, 1.012], pan = [-0.8, -0.35, 0, 0.35, 0.8];
      for (let k = 0; k < n; k++) {
        const tt = k / SR; let sl = 0, sr = 0;
        for (let j = 0; j < 5; j++) { const dt = f * det[j] / SR, s = 2 * ph[j] - 1 - blep(ph[j], dt); ph[j] = (ph[j] + dt) % 1; const [gl, gr] = panG(pan[j]); sl += s * gl; sr += s * gr; }
        const y = fl.p((sl + sr) * 0.5, 600 + 4200 * Math.exp(-tt * 9), 1.0);
        const env = Math.min(1, tt / 0.004) * (tt > dur ? Math.exp(-(tt - dur) * 14) : 1), w = 0.075 * v * env;
        add(lead, i0 + k, (y + (sl - (sl + sr) / 2) * 0.15) * w, (y + (sr - (sl + sr) / 2) * 0.15) * w); add(rv, i0 + k, y * w * 0.5, y * w * 0.5);
      }
    });
  }
  function bell(t, f, v = 1, send = 0.55, pan = 0) {
    const i0 = Math.round(t * SR), n = Math.round(2.4 * SR), [gl, gr] = panG(pan);
    for (let k = 0; k < n; k++) {
      const tt = k / SR, idx = 4.0 * Math.exp(-tt * 3.2), m = Math.sin(TAU * f * 3.5 * tt) * idx;
      const s = Math.sin(TAU * f * tt + m) * Math.exp(-tt * 2.1) * 0.5 + Math.sin(TAU * f * 2 * tt) * Math.exp(-tt * 4) * 0.12;
      const o = s * v * 0.42; add(fxb, i0 + k, o * gl * 1.4, o * gr * 1.4); add(rv, i0 + k, o * send, o * send);
    }
  }
  function tick(t, f = 1800, v = 0.5) {
    const i0 = Math.round(t * SR), n = Math.round(0.05 * SR); let ph = 0;
    for (let k = 0; k < n; k++) { const tt = k / SR; ph += TAU * f * (1 + 0.5 * Math.exp(-tt * 120)) / SR; const s = Math.sin(ph) * Math.exp(-tt * 85) * v * 0.35; add(fxb, i0 + k, s, s); add(rv, i0 + k, s * 0.2, s * 0.2); }
  }
  function noiseSweep(t0, t1, f0, f1, v = 1, q = 2.2, shape = 2) {          // riser / whoosh
    const i0 = Math.round(t0 * SR), n = Math.round((t1 - t0) * SR), fl = new SVF(), f2 = new SVF();
    for (let k = 0; k < n; k++) {
      const u = k / n, cf = f0 * Math.pow(f1 / f0, u), x = rnd() * 2 - 1;
      fl.p(x, cf, q); f2.p(fl.bp, cf * 1.5, q);
      const env = Math.pow(u, shape) * (u > 0.97 ? (1 - u) / 0.03 : 1), s = (fl.bp * 1.6 + f2.bp) * env * v * 0.22;
      add(fxb, i0 + k, s * 0.9, s * 1.1); add(rv, i0 + k, s * 0.3, s * 0.3);
    }
  }
  function impact(t, v = 1, long = 1.6) {
    const i0 = Math.round(t * SR), n = Math.round(long * SR), fl = new SVF(); let ph = 0;
    for (let k = 0; k < n; k++) {
      const tt = k / SR; ph += TAU * (30 + 70 * Math.exp(-tt * 9)) / SR;
      let s = Math.sin(ph) * Math.exp(-tt * 2.3) * 0.9;
      const nz = fl.p(rnd() * 2 - 1, 2400 * Math.exp(-tt * 3) + 120, 0.8) * Math.exp(-tt * 5.5) * 0.55;
      const o = Math.tanh((s + nz) * 1.3) * v * 0.85; add(fxb, i0 + k, o, o); add(rv, i0 + k, nz * v * 0.5, nz * v * 0.5);
    }
  }
  function crash(t, v = 1, len = 1.4) {
    const i0 = Math.round(t * SR), n = Math.round(len * SR), f = new SVF();
    for (let k = 0; k < n; k++) { const tt = k / SR; f.p(rnd() * 2 - 1, 5200, 0.7); const s = f.hp * Math.exp(-tt * 3.2) * v * 0.28; add(fxb, i0 + k, s, s * 0.92); add(rv, i0 + k, s * 0.4, s * 0.4); }
  }
  function shepard(t0, t1, v = 1) {
    const i0 = Math.round(t0 * SR), n = Math.round((t1 - t0) * SR), K = 9, ph = new Float64Array(K); const base = 36, rate = 0.62;
    for (let k = 0; k < n; k++) {
      const tt = k / SR, r = (tt * rate) % 1; let s = 0;
      for (let j = 0; j < K; j++) {
        const pos = j + r, f = mtof(base) * Math.pow(2, pos), w = Math.exp(-Math.pow((pos - K / 2) / 1.9, 2) / 2);
        ph[j] += TAU * f / SR; s += Math.sin(ph[j]) * w + Math.sin(ph[j] * 1.5) * w * 0.12;
      }
      const env = Math.min(1, tt / 0.6) * (k > n - 0.15 * SR ? (n - k) / (0.15 * SR) : 1), o = s * env * v * 0.075; add(fxb, i0 + k, o, o); add(rv, i0 + k, o * 0.35, o * 0.35);
    }
  }
  // the Fourier scene's square wave, built partial by partial exactly like the epicycles on screen
  function fourierVoice(t0, f0, v = 1) {
    const sched = NSCHED, half = BEAT / 2, i0 = Math.round(t0 * SR), dur = 8 * half, n = Math.round((dur + 0.25) * SR);
    const ph = new Float64Array(40);
    for (let k = 0; k < n; k++) {
      const tt = k / SR; let s = 0;
      for (let h = 1; h <= 32; h++) {
        const born = (() => { const idx = sched.findIndex(x => x >= h); return idx < 0 ? 8 * half : idx * half; })();
        const g = clamp((tt - born) / 0.02); if (g <= 0) continue;
        const f = f0 * (2 * h - 1); if (f > 9000) continue; ph[h] += TAU * f / SR; s += Math.sin(ph[h]) / (2 * h - 1) * g;
      }
      const env = Math.min(1, tt / 0.05) * (tt > dur ? Math.max(0, 1 - (tt - dur) / 0.25) : 1), o = s * env * v * 0.2; add(lead, i0 + k, o, o); add(rv, i0 + k, o * 0.3, o * 0.3);
    }
  }

  /* ---- patterns --------------------------------------------------------- */
  const euclid = (k, n, rot = 0) => Array.from({ length: n }, (_, i) => ((((i + rot) * k) % n) < k));
  const SCALE = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79];            // A minor pentatonic (A3 .. G5)
  let piIdx = 0; const nextPi = () => PI_DIGITS.charCodeAt(piIdx++ % PI_DIGITS.length) - 48;
  const CH = {                                                       // chord per bar: [bass root midi, pad notes]
    Am: [33, [45, 52, 57, 60, 64]], F: [29, [41, 48, 53, 57, 60]], C: [36, [48, 55, 60, 64, 67]], G: [31, [43, 50, 55, 59, 62]],
  };
  const BARS = ['Am', 'Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'Am', 'F', 'C', 'Am'];
  const chordAt = b => CH[BARS[Math.min(11, Math.floor(b / 4))]];

  /* ======================= ARRANGEMENT (beats) ========================= */
  // --- 01 ORIGIN (0-4): pizzicato on the quarter turns, pad swell, reverse riser
  kick(0, 0.7, 0.6); impact(0, 0.45, 1.6);
  [69, 72, 76, 81].forEach((m, i) => { bell(T(i), mtof(m), 0.7, 0.6, [-0.3, 0.3, -0.2, 0.2][i]); pluck(T(i), mtof(m - 12), 0.5, [-0.3, 0.3, -0.2, 0.2][i], 0.5); });
  padChord(0, 4 * BEAT + 0.2, CH.Am[1], 0.9, 1.4, 1400);
  noiseSweep(T(2.2), T(4), 400, 9000, 0.7, 2.0, 2.2);
  for (let i = 4; i < 8; i++) hat(T(i * 0.5), false, 0.28 + 0.03 * i, i % 2 ? 0.3 : -0.3);

  // --- 02 FOURIER (4-12)
  crash(T(4), 0.5, 1.3);
  fourierVoice(T(4), 110, 1.0);
  bassNote(T(4), 4 * BEAT, mtof(33), 0.9, 600, 120);
  for (let b = 4; b < 8; b++) kick(T(b), b === 4 ? 1 : 0.82);
  clap(T(5), 0.7); clap(T(7), 0.7);
  euclid(5, 16).forEach((on, i) => { if (on) hat(T(4 + i * 0.25), false, 0.34 + (i % 4 === 2 ? 0.14 : 0), i % 2 ? 0.35 : -0.35); });
  for (let b = 4; b < 8; b++) hat(T(b + 0.5), true, 0.34, 0.1);
  for (let i = 0; i < 8; i++) tick(T(4 + i * 0.5), 1500 + 90 * i, 0.22);              // one tick per harmonic added
  // part B (8-12): full groove, pi arpeggio enters, pad opens
  crash(T(8), 0.45, 1.0);
  padChord(T(8), 4 * BEAT, CH.F[1], 1.0, 0.4, 2200);
  noiseSweep(T(7.2), T(8), 800, 12000, 0.4, 1.8, 2.4);

  // grooves from beat 8 until 40: helper schedules one beat of drums+bass
  const grooveBeat = (b, o) => {
    const [root] = chordAt(b);
    kick(T(b), o.kv ?? 0.9);
    if (o.clap !== false && (b % 2 === 1)) clap(T(b), 0.62);
    if (o.bass !== false) {
      const f = mtof(root);
      if (o.roll) { for (let s = 0; s < 4; s++) bassNote(T(b + s * 0.25), 0.2, f * (s === 3 ? 2 : 1), 0.85, 900, 160); }
      else { bassNote(T(b + 0.5), 0.36 * BEAT * 2 / 2, f, 0.95, 900, 150, o.wob || 0); if (o.sub !== false) bassNote(T(b), 0.12, f * 1, 0.35, 400, 120); }
    }
  };

  for (let b = 8; b < 40; b++) {
    const sec = b < 12 ? 'B' : b < 18 ? 'S' : b < 24 ? 'C' : b < 32 ? 'M' : 'T';
    grooveBeat(b, {
      kv: sec === 'T' ? 0.95 : 0.9, roll: sec === 'M', wob: sec === 'C' ? 2.2 : 0,
      clap: !(sec === 'C' && b % 2 === 1 && b < 22) || b >= 22,
    });
    // chaos: half-time feel in the first part (clap only on beat 3 of the bar)
    if (sec === 'C' && b < 22 && b % 4 !== 2) { /* handled by clap mask above (we keep claps off the odd beats) */ }
    // hats
    if (sec === 'C') {
      // logistic map x -> 3.9 x (1-x): chaotic hat triggers + velocities
      let x = 0.37 + 0.0001 * b;
      for (let s = 0; s < 4; s++) { for (let q = 0; q < (b * 4 + s) % 7 + 3; q++) x = 3.9 * x * (1 - x); if (x > 0.32) hat(T(b + s * 0.25), x > 0.9, 0.18 + 0.5 * x, (x - 0.5) * 1.2); }
    } else {
      const pat = euclid(sec === 'M' || sec === 'T' ? 13 : 11, 16, b % 4);
      for (let s = 0; s < 4; s++) if (pat[(b % 4) * 4 + s]) hat(T(b + s * 0.25), false, 0.30 + (s === 2 ? 0.12 : 0), s % 2 ? 0.35 : -0.35);
      if (sec !== 'B') hat(T(b + 0.5), true, 0.32, 0.15);
    }
  }
  clap(T(20), 0.85);                       // half-time snare in the chaos breakdown
  // pad chords per bar (beats 12-40)
  for (let bar = 3; bar < 10; bar++) padChord(T(bar * 4), 4 * BEAT, chordAt(bar * 4)[1], bar < 6 ? 0.9 : 1.15, 0.3, bar >= 6 ? 3200 : 2400);
  // pi arpeggio (beats 8 - 40): 16th notes, one digit of pi per note, gated by a Euclidean mask
  {
    const gate = euclid(11, 16), arpEnd = 40;
    for (let s = 0; s < (arpEnd - 8) * 4; s++) {
      const beat = 8 + s * 0.25, d = nextPi();
      if (!gate[s % 16] && beat < 24) continue;
      if (beat >= 38.0) continue;
      const m = SCALE[d] + (beat >= 24 && beat < 32 ? 12 : 0), vel = (beat < 12 ? 0.55 : 0.75) * (s % 4 === 0 ? 1.15 : 1);
      pluck(T(beat), mtof(m), vel, Math.sin(s * 1.3) * 0.5, 0.35, 5600);
    }
  }

  // --- 03 SURFACE (12-18): impact on the slab wipe
  impact(T(12), 0.7, 1.4); crash(T(12), 0.5, 1.4); noiseSweep(T(11.4), T(12), 500, 7000, 0.6, 2, 1.6);
  stab(T(12), [60, 64, 67, 72], 0.5, 0.55);
  // --- 04 CHAOS (18-24): shutter transition, dark section, then riser + roll
  impact(T(18), 0.8, 1.6); noiseSweep(T(17.4), T(18), 500, 8000, 0.5, 2, 1.6);
  stab(T(18), [55, 62, 67, 71], 0.6, 0.5); stab(T(20), [57, 64, 69, 72], 0.35, 0.45);
  noiseSweep(T(21), T(24), 220, 10000, 1.0, 2.0, 2.6); snareRoll(T(22.5), T(24), 0.2, 0.9, 12);
  // --- 05 MANDELBROT (24-32): drop + infinite zoom
  impact(T(24), 0.9, 1.8); crash(T(24), 0.6, 1.6); shepard(T(24), T(32), 1.0);
  [[24, 'Am', [57, 60, 64, 69]], [26, 'Am', [57, 60, 64, 69]], [28, 'F', [53, 57, 60, 65]], [30, 'G', [55, 59, 62, 67]]].forEach(([b, , notes]) => stab(T(b), notes, 1.5 * BEAT, 0.8));
  noiseSweep(T(29.5), T(32), 300, 14000, 1.0, 1.8, 2.8); snareRoll(T(30.5), T(32), 0.25, 1.0, 16);
  // --- 06-09 MONTAGE (32-40): a stab + tom on every cut
  [[32, [57, 60, 64, 69]], [34, [53, 57, 60, 65]], [36, [60, 64, 67, 72]], [38, [55, 59, 62, 67]]].forEach(([b, notes], i) => {
    stab(T(b), notes, 0.35 * BEAT * 2, 0.95); tom(T(b), 95 + i * 14, 0.8); crash(T(b), 0.35, 0.7); impact(T(b), 0.25, 0.7);
    stab(T(b + 1.5), notes.map(m => m + 12), 0.2, 0.55);
  });
  noiseSweep(T(38.2), T(40), 400, 12000, 0.9, 2.0, 2.2); snareRoll(T(39), T(40), 0.3, 1.0, 20);

  // --- 10 FINALE (40-48): Euler. bells on landing and on every token, whoosh under the iris, title impact on beat 45
  const f0 = T(40);
  kick(f0, 1); impact(f0, 0.55, 1.2); padChord(f0, 5 * BEAT, CH.C[1], 1.0, 0.25, 2600);
  // arpeggio on the digits of e (one per eighth note), quiet
  { let ei = 0; for (let s = 0; s < 10; s++) { const d = E_DIGITS.charCodeAt(ei++) - 48; pluck(f0 + 0.1 + s * (BEAT / 2), mtof(SCALE[d] + 12), 0.55, Math.sin(s) * 0.4, 0.5, 4200); } }
  bell(f0 + 1.25, mtof(57), 0.9, 0.6, -0.4);                                                   // landing on -1
  [[1.28, 76], [1.40, 79], [1.50, 81], [1.60, 84], [1.70, 88]].forEach(([t, m], i) => { bell(f0 + t, mtof(m), 0.75, 0.6, -0.4 + i * 0.2); tick(f0 + t, 2200 + i * 200, 0.3); });
  noiseSweep(f0 + 1.45, f0 + 2.06, 300, 12000, 0.9, 2.0, 1.5);
  const tt = T(45);
  kick(tt, 1); impact(tt, 1.0, 2.6); crash(tt, 0.7, 1.8);
  padChord(tt, 1.45, [45, 52, 57, 64, 69, 72], 1.4, 0.02, 3800);
  [81, 84, 88, 93].forEach((m, i) => bell(tt + 0.06 + i * 0.09, mtof(m), 0.55, 0.7, i % 2 ? 0.4 : -0.4));
  bassNote(tt, 1.4, mtof(33), 1.0, 700, 120);

  /* ======================= MIX ======================================== */
  // reverb (Freeverb topology) on the send bus
  const combsL = [1215, 1293, 1390, 1476, 1548, 1623, 1695, 1760], apL = [605, 480, 371, 245], spread = 29;
  const mkComb = len => ({ b: new Float32Array(len), i: 0, s: 0 }), mkAp = len => ({ b: new Float32Array(len), i: 0 });
  const cL = combsL.map(mkComb), cR = combsL.map(l => mkComb(l + spread)), aL = apL.map(mkAp), aR = apL.map(l => mkAp(l + spread));
  const revL = new Float32Array(N), revR = new Float32Array(N), fb = 0.84, damp = 0.32;
  for (let i = 0; i < N; i++) {
    const x = (rv.L[i] + rv.R[i]) * 0.5 * 0.2;
    let oL = 0, oR = 0;
    for (const c of cL) { const y = c.b[c.i]; c.s = y * (1 - damp) + c.s * damp; c.b[c.i] = x + c.s * fb; if (++c.i >= c.b.length) c.i = 0; oL += y; }
    for (const c of cR) { const y = c.b[c.i]; c.s = y * (1 - damp) + c.s * damp; c.b[c.i] = x + c.s * fb; if (++c.i >= c.b.length) c.i = 0; oR += y; }
    for (const a of aL) { const y = a.b[a.i]; a.b[a.i] = oL + y * 0.5; oL = y - oL; if (++a.i >= a.b.length) a.i = 0; }
    for (const a of aR) { const y = a.b[a.i]; a.b[a.i] = oR + y * 0.5; oR = y - oR; if (++a.i >= a.b.length) a.i = 0; }
    revL[i] = oL; revR[i] = oR;
  }
  // stereo delay on the lead bus (dotted-eighth / quarter)
  const dl = Math.round(0.75 * BEAT * SR), dr = Math.round(1.0 * BEAT * SR), bL = new Float32Array(dl), bR = new Float32Array(dr); let pl = 0, pr = 0, lpL = 0, lpR = 0;
  const dlyL = new Float32Array(N), dlyR = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const yl = bL[pl], yr = bR[pr]; lpL += (yl - lpL) * 0.45; lpR += (yr - lpR) * 0.45;
    bL[pl] = lead.L[i] * 0.6 + lpR * 0.38; bR[pr] = lead.R[i] * 0.6 + lpL * 0.38;
    dlyL[i] = yl; dlyR[i] = yr; if (++pl >= dl) pl = 0; if (++pr >= dr) pr = 0;
  }
  // sidechain: duck bass / pad / lead on every kick
  const duck = new Float32Array(N).fill(1);
  for (const [t, v] of kicks) { const i0 = Math.round(t * SR), n = Math.round(0.28 * SR); for (let k = 0; k < n; k++) { const j = i0 + k; if (j >= N) break; duck[j] *= 1 - 0.72 * v * Math.exp(-k / (SR * 0.085)); } }
  // final drop-out right before the finale (beat 39.78 - 40.0)
  const gateA = Math.round(T(39.78) * SR), gateB = Math.round(T(40) * SR);
  const L = new Float32Array(N), R = new Float32Array(N); let hpl = 0, hpr = 0, xl1 = 0, xr1 = 0, x2l = 0, x2r = 0, h2pl = 0, h2pr = 0;
  const lead2 = 0.85, bassG = 0.5;
  for (let i = 0; i < N; i++) {
    const d = duck[i], dLead = 1 - (1 - d) * 0.55;
    let l = drums.L[i] + fxb.L[i] * 0.9 + (bass.L[i] * bassG + pad.L[i]) * d + (lead.L[i] * lead2 + dlyL[i] * 0.55) * dLead + revL[i] * 0.55;
    let r = drums.R[i] + fxb.R[i] * 0.9 + (bass.R[i] * bassG + pad.R[i]) * d + (lead.R[i] * lead2 + dlyR[i] * 0.55) * dLead + revR[i] * 0.55;
    if (i >= gateA && i < gateB) { const g = Math.max(0, 1 - Math.min(1, (i - gateA) / (0.012 * SR))) * 0.12; l *= g; r *= g; }
    // 2nd-order-ish 38 Hz high-pass (two one-pole stages)
    const hl = l - xl1 + 0.9951 * hpl; xl1 = l; hpl = hl; const hr = r - xr1 + 0.9951 * hpr; xr1 = r; hpr = hr;
    const h2l = hl - x2l + 0.9951 * h2pl; x2l = hl; h2pl = h2l; const h2r = hr - x2r + 0.9951 * h2pr; x2r = hr; h2pr = h2r;
    L[i] = h2l; R[i] = h2r;
  }
  // loudness: bring the whole piece to about -15 dBFS RMS, then a smooth limiter and a final -1 dBFS peak normalise
  let ss = 0; for (let i = 0; i < N; i++) ss += L[i] * L[i] + R[i] * R[i];
  const g0 = Math.pow(10, (-15 - 10 * Math.log10(ss / (2 * N))) / 20);
  const lim = x => x / Math.pow(1 + Math.pow(Math.abs(x), 3), 1 / 3);
  let pk = 0;
  for (let i = 0; i < N; i++) { L[i] = lim(L[i] * g0); R[i] = lim(R[i] * g0); pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); }
  const gain = 0.891 / pk, fi = Math.round(0.003 * SR), fo = Math.round(0.28 * SR);
  for (let i = 0; i < N; i++) {
    let g = gain; if (i < fi) g *= i / fi; if (i > N - fo) g *= Math.pow((N - i) / fo, 1.5);
    L[i] *= g; R[i] *= g;
  }
  return { L, R };
}
