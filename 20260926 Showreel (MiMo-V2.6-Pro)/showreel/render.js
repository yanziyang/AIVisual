'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { createCanvas } = require('@napi-rs/canvas');
const {
  TAU, clamp, lerp, seg, E, hash1, hash2, rgba, hsl,
  textWidth, drawTracked, strokeTracked, eachChar, circularText,
  polyPath, roundRectPath, makeNoiseTile, PALETTE,
} = require('./engine');

const W = 1920;
const H = 1080;
const FPS = 60;
const DURATION = 15.0;
const TOTAL = Math.round(FPS * DURATION);
const BAR = 1.875;

const SCENES = [
  { id: 'ignition', name: 'IGNITION', start: 0.0, end: 1.875 },
  { id: 'kinetic', name: 'KINETIC TYPE', start: 1.875, end: 3.75 },
  { id: 'glitch', name: 'SIGNAL / GLITCH', start: 3.75, end: 5.625 },
  { id: 'spatial', name: 'SPATIAL SYSTEM', start: 5.625, end: 7.5 },
  { id: 'liquid', name: 'LIQUID FORM', start: 7.5, end: 9.375 },
  { id: 'line', name: 'LINE CRAFT', start: 9.375, end: 11.25 },
  { id: 'impact', name: 'IMPACT', start: 11.25, end: 13.125 },
  { id: 'outro', name: 'OUTRO', start: 13.125, end: 15.0 },
];

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

const offA = createCanvas(W, H);
const offActx = offA.getContext('2d');

const BALL_W = 640;
const BALL_H = 360;
const ballCv = createCanvas(BALL_W, BALL_H);
const ballCtx = ballCv.getContext('2d');
const ballImg = ballCtx.createImageData(BALL_W, BALL_H);

const noiseTiles = [
  makeNoiseTile(createCanvas, 256, false),
  makeNoiseTile(createCanvas, 256, true),
  makeNoiseTile(createCanvas, 256, false),
  makeNoiseTile(createCanvas, 256, true),
];

const HAS_FILTER = (() => {
  try {
    ctx.filter = 'blur(2px)';
    const ok = ctx.filter === 'blur(2px)';
    ctx.filter = 'none';
    return ok;
  } catch { return false; }
})();

const FONT_DISPLAY = 'Impact';
const FONT_UI = '"Segoe UI"';
const FONT_MONO = 'Consolas';

function bgFill(c, color, pad = 60) {
  c.fillStyle = color;
  c.fillRect(-pad, -pad, W + pad * 2, H + pad * 2);
}

function gradBg(c, top, bottom) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  c.fillStyle = g;
  c.fillRect(-60, -60, W + 120, H + 120);
}

function sceneIndexOf(t) {
  for (let i = SCENES.length - 1; i >= 0; i--) if (t >= SCENES[i].start) return i;
  return 0;
}

/* ============================================================
   SCENE 01 — IGNITION
   ============================================================ */
function sceneIgnition(t) {
  const cx = W / 2, cy = H / 2;

  bgFill(ctx, PALETTE.ink, 80);

  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.62);
  glow.addColorStop(0, 'rgba(70,40,160,0.42)');
  glow.addColorStop(0.42, 'rgba(28,12,72,0.20)');
  glow.addColorStop(1, 'rgba(6,7,11,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const implode = E.inExpo(seg(t, 0.42, 0.90));
  const explode = E.inExpo(seg(t, 0.90, 1.62));
  const fadeOut = 1 - E.inQuad(seg(t, 1.42, 1.875));

  const N = 1500;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < N; i++) {
    const a0 = hash1(i * 1.31) * TAU;
    const r0 = 120 + hash1(i * 2.77) * 620;
    const spin = (hash1(i * 3.11) - 0.5) * 3.2;
    const size = 0.7 + hash1(i * 5.19) * 2.6;
    const hue = 185 + hash1(i * 7.31) * 120;

    const ang = a0 + t * spin * (1 - implode * 0.55);
    const rImp = r0 * (1 - implode * 0.985);
    const rExp = explode * (240 + hash1(i * 9.17) * 1250);
    const r = rImp + rExp;
    const wob = 6 * Math.sin(t * 3.1 + i * 0.37) * (1 - implode);

    const x = cx + Math.cos(ang) * (r + wob);
    const y = cy + Math.sin(ang) * (r + wob) * 0.92;

    const a = clamp(seg(t, 0, 0.28) * 0.85 + 0.15, 0, 1)
      * (1 - explode * 0.85) * fadeOut
      * (0.35 + hash1(i * 11.3) * 0.65);
    if (a <= 0.01) continue;

    ctx.fillStyle = hsl(hue, 95, 62, a);
    ctx.beginPath();
    ctx.arc(x, y, size * (1 + implode * 0.4), 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  const flashP = seg(t, 0.86, 1.06);
  if (flashP > 0 && flashP < 1) {
    const fa = (1 - flashP) * 0.92;
    const fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.75);
    fg.addColorStop(0, `rgba(255,255,255,${fa})`);
    fg.addColorStop(0.28, `rgba(150,210,255,${fa * 0.5})`);
    fg.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, W, H);
  }

  const ringP = E.outCubic(seg(t, 0.30, 1.02));
  if (ringP > 0) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = PALETTE.cyan;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.arc(cx, cy, 214, -Math.PI / 2, -Math.PI / 2 + TAU * ringP);
    ctx.stroke();

    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 11]);
    ctx.lineDashOffset = -t * 90;
    ctx.beginPath();
    ctx.arc(cx, cy, 268, -Math.PI / 2, -Math.PI / 2 + TAU * ringP);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.globalAlpha = 0.32;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 320, -Math.PI / 2, -Math.PI / 2 + TAU * ringP);
    ctx.stroke();
    ctx.restore();
  }

  const tickP = E.outExpo(seg(t, 0.62, 1.18));
  ctx.save();
  ctx.globalAlpha = 0.6 * tickP;
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU + t * 0.18;
    const long = i % 9 === 0;
    const r1 = 352, r2 = 352 + (long ? 26 : 12);
    ctx.strokeStyle = long ? PALETTE.magenta : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = long ? 2.2 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.stroke();
  }
  ctx.restore();

  const circAlpha = clamp(seg(t, 0.55, 1.05)) * (1 - E.inQuad(seg(t, 1.55, 1.875)));
  if (circAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = circAlpha * 0.85;
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = `16px ${FONT_MONO}`;
    circularText(ctx, 'MOTION DESIGN  ·  SHOWREEL 2026  ·  MOTION DESIGN  ·  SHOWREEL 2026  ·  ',
      cx, cy, 296, t * 0.22 - Math.PI / 2, 7);
    ctx.restore();
  }

  const markP = E.outBack(seg(t, 0.80, 1.24));
  if (markP > 0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(markP, markP);
    ctx.rotate((1 - markP) * 1.4);

    ctx.fillStyle = '#FFFFFF';
    polyPath(ctx, 0, 0, 46, 3, -Math.PI / 2 + Math.PI);
    ctx.fill();

    ctx.fillStyle = PALETTE.cyan;
    polyPath(ctx, 0, 0, 24, 3, -Math.PI / 2);
    ctx.fill();

    ctx.globalAlpha = 0.9;
    ctx.fillStyle = PALETTE.magenta;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  const labelP = clamp(seg(t, 1.02, 1.34)) * (1 - E.inQuad(seg(t, 1.62, 1.875)));
  if (labelP > 0.01) {
    ctx.save();
    ctx.globalAlpha = labelP;
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.font = `15px ${FONT_MONO}`;
    drawTracked(ctx, 'SYSTEM ONLINE', cx, cy + 128, 9, 'center');
    ctx.restore();
  }
}

/* ============================================================
   SCENE 02 — KINETIC TYPE "MOTION"
   ============================================================ */
const KIN = {
  size: 320,
  tracking: 16,
  y: H * 0.545,
  letters: 'MOTION'.split('').map((ch, i) => ({
    ch,
    dx: (hash1(i * 3.17) - 0.5) * 1900,
    dy: (hash1(i * 5.91) - 0.5) * 1100,
    rot: (hash1(i * 2.43) - 0.5) * 1.5,
    dir: hash1(i * 8.11) > 0.5 ? 1 : -1,
    t0: 0.10 + i * 0.072,
    dur: 0.58,
    hue: [188, 322, 268, 188, 322, 268][i],
  })),
};

function drawKineticLetter(i, time, alphaMul, ghost) {
  const L = KIN.letters[i];
  const p = seg(time, L.t0, L.t0 + L.dur);
  if (p <= 0 && alphaMul < 1) return;

  const e = E.outExpo(clamp(p));
  const eb = E.outBack(clamp(p * 1.02));

  const ex = E.inQuart(seg(time, 1.48, 1.875));
  const exE = ex * ex;

  ctx.save();
  ctx.font = `${KIN.size}px ${FONT_DISPLAY}`;
  ctx.textBaseline = 'alphabetic';

  const tw = textWidth(ctx, KIN.letters.map(l => l.ch).join(''), KIN.tracking);
  let acc = 0;
  for (let k = 0; k < i; k++) acc += ctx.measureText(KIN.letters[k].ch).width + KIN.tracking;
  const targetX = W / 2 - tw / 2 + acc + ctx.measureText(L.ch).width / 2;
  const targetY = KIN.y;

  const x = lerp(targetX + L.dx, targetX, e) + exE * L.dir * 260;
  const y = lerp(targetY + L.dy, targetY, e) + Math.sin(time * 2.6 + i * 1.1) * 4 * e - exE * 520;
  const sc = lerp(2.35, 1, eb) * (1 - exE * 0.55);
  const rot = lerp(L.rot, 0, eb) + exE * L.dir * 0.7;

  let a = clamp(seg(time, L.t0, L.t0 + 0.14)) * (1 - exE) * alphaMul;
  if (a <= 0.004) { ctx.restore(); return; }

  ctx.globalAlpha = a;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(sc, sc);
  ctx.textAlign = 'center';

  if (ghost) {
    ctx.fillStyle = hsl(L.hue, 95, 66, 1);
    ctx.fillText(L.ch, 0, 0);
    ctx.restore();
    return;
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(L.ch, 0, 0);

  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a * 0.55;
  ctx.fillStyle = hsl(L.hue, 100, 55, 1);
  ctx.fillText(L.ch, -7, 3);
  ctx.fillStyle = hsl((L.hue + 140) % 360, 100, 55, 1);
  ctx.fillText(L.ch, 7, -3);
  ctx.restore();
}

function sceneKinetic(t) {
  gradBg(ctx, '#0A0B14', '#05060C');

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const hx = hash1(i * 4.7);
    const sp = 90 + hash1(i * 6.3) * 240;
    const bx = ((hx * W * 2 + t * sp) % (W * 2)) - W * 0.5;
    const bw = 90 + hash1(i * 2.1) * 260;
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    const hue = [190, 320, 270, 45, 190, 320, 270][i];
    g.addColorStop(0, hsl(hue, 90, 55, 0));
    g.addColorStop(0.5, hsl(hue, 90, 55, 0.10 + hash1(i * 9.1) * 0.10));
    g.addColorStop(1, hsl(hue, 90, 55, 0));
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(bx + bw / 2, H / 2);
    ctx.rotate(-0.42);
    ctx.fillRect(-bw / 2, -H, bw, H * 2);
    ctx.restore();
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70; i++) {
    const sp = 700 + hash1(i * 1.7) * 2100;
    const x = ((hash1(i * 3.3) * W * 2 + t * sp) % (W * 2.2)) - W * 0.6;
    const y = hash1(i * 5.5) * H;
    const len = 60 + hash1(i * 7.7) * 520;
    const a = 0.05 + hash1(i * 9.9) * 0.20;
    ctx.fillStyle = i % 3 === 0 ? rgba(255, 45, 120, a) : rgba(34, 225, 255, a);
    ctx.fillRect(x, y, len, 1.2 + hash1(i * 2.2) * 1.8);
  }
  ctx.restore();

  for (let g = 7; g >= 1; g--) {
    ctx.save();
    ctx.globalAlpha = 0.085 * (1 - g / 8) * 2.4;
    for (let i = 0; i < KIN.letters.length; i++) drawKineticLetter(i, t - g * 0.014, 1, true);
    ctx.restore();
  }
  for (let i = 0; i < KIN.letters.length; i++) drawKineticLetter(i, t, 1, false);

  const barP = seg(t, 0.28, 1.32);
  const barY = KIN.y + 88;
  const barW = 980;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(W / 2 - barW / 2, barY, barW, 5);
  const head = E.outExpo(barP);
  const lg = ctx.createLinearGradient(W / 2 - barW / 2, 0, W / 2 - barW / 2 + barW * head, 0);
  lg.addColorStop(0, PALETTE.cyan);
  lg.addColorStop(0.6, PALETTE.violet);
  lg.addColorStop(1, PALETTE.magenta);
  ctx.fillStyle = lg;
  ctx.fillRect(W / 2 - barW / 2, barY, barW * head, 5);
  ctx.restore();

  const subP = clamp(seg(t, 0.62, 1.05)) * (1 - E.inQuad(seg(t, 1.55, 1.875)));
  if (subP > 0.01) {
    ctx.save();
    ctx.globalAlpha = subP * 0.85;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `17px ${FONT_MONO}`;
    drawTracked(ctx, '01 — KINETIC TYPOGRAPHY', W / 2, barY + 52, 8, 'center');
    ctx.restore();
  }

  const edge = clamp(seg(t, 0.05, 0.5)) * (1 - E.inQuad(seg(t, 1.6, 1.875)));
  ctx.save();
  ctx.globalAlpha = edge * 0.55;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(120, 168); ctx.lineTo(120, 120); ctx.lineTo(180, 120);
  ctx.moveTo(W - 120, 168); ctx.lineTo(W - 120, 120); ctx.lineTo(W - 180, 120);
  ctx.moveTo(120, H - 168); ctx.lineTo(120, H - 120); ctx.lineTo(180, H - 120);
  ctx.moveTo(W - 120, H - 168); ctx.lineTo(W - 120, H - 120); ctx.lineTo(W - 180, H - 120);
  ctx.stroke();
  ctx.restore();
}

/* ============================================================
   SCENE 03 — SIGNAL / GLITCH  "DESIGN"
   ============================================================ */
function sceneGlitch(t) {
  gradBg(ctx, '#08090F', '#04050A');

  const o = offActx;
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.clearRect(0, 0, W, H);

  const word = 'DESIGN';
  const size = 420;
  o.font = `${size}px ${FONT_DISPLAY}`;
  o.textAlign = 'center';
  o.textBaseline = 'middle';

  const pulse = 1 + 0.018 * Math.sin(t * 9.5) + 0.035 * E.outExpo(seg(t, 0, 0.22));
  const dxBase = 5 + 11 * Math.abs(Math.sin(t * 4.2)) + 26 * (hash1(Math.floor(t * 17) * 3.1) > 0.72 ? 1 : 0);

  o.save();
  o.translate(W / 2, H * 0.5);
  o.scale(pulse, pulse);
  o.globalCompositeOperation = 'lighter';

  o.fillStyle = 'rgb(255,40,70)';
  o.fillText(word, -dxBase, 4);
  o.fillStyle = 'rgb(40,255,160)';
  o.fillText(word, 0, 0);
  o.fillStyle = 'rgb(70,110,255)';
  o.fillText(word, dxBase, -4);

  o.globalCompositeOperation = 'source-over';
  o.lineWidth = 2;
  o.strokeStyle = 'rgba(255,255,255,0.28)';
  o.strokeText(word, 0, 0);
  o.restore();

  const bands = 26;
  const gseed = Math.floor(t * 21);
  const roll = hash1(gseed * 1.73);
  const spike = roll > 0.87 ? 1 : roll > 0.62 ? 0.26 : 0;

  ctx.save();
  for (let b = 0; b < bands; b++) {
    const y0 = (b / bands) * H;
    const bh = H / bands + 1;
    const rp = E.outExpo(seg(t, 0.06 + b * 0.017, 0.60 + b * 0.017));
    const dir = b % 2 ? 1 : -1;
    const revealDx = (1 - rp) * dir * W * 1.35;
    const gd = hash2(b * 3.37, gseed);
    const glitchDx = spike ? (gd - 0.5) * 210 * spike : 0;
    const gy = spike > 0.6 ? (hash2(b * 7.1, gseed * 1.3) - 0.5) * 18 * spike : 0;
    ctx.drawImage(offA, 0, y0, W, bh, revealDx + glitchDx, y0 + gy, W, bh);
  }
  ctx.restore();

  if (spike > 0.4) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const nb = Math.floor(6 + spike * 22);
    for (let i = 0; i < nb; i++) {
      const rx = hash2(i * 13.1, gseed) * W;
      const ry = hash2(i * 17.7, gseed * 1.7) * H;
      const rw = 30 + hash2(i * 23.3, gseed) * 320;
      const rh = 3 + hash2(i * 29.1, gseed) * 22;
      const v = hash2(i * 31.7, gseed) * 90;
      ctx.fillStyle = rgba(v + 40, v + 20, v + 130, 0.22 + spike * 0.28);
      ctx.fillRect(rx, ry, rw, rh);
    }
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#000000';
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  ctx.restore();

  const zoom = 1 + 0.055 * E.inOutSine(seg(t, 0, 1.875));
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-W / 2, -H / 2);

  const tagP = clamp(seg(t, 0.42, 0.85)) * (1 - E.inQuad(seg(t, 1.55, 1.875)));
  if (tagP > 0.01) {
    ctx.globalAlpha = tagP;
    ctx.fillStyle = PALETTE.cyan;
    ctx.font = `16px ${FONT_MONO}`;
    drawTracked(ctx, '02 — VISUAL SYSTEMS', W / 2, H * 0.5 + 268, 9, 'center');

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `14px ${FONT_MONO}`;
    drawTracked(ctx, 'RGB SPLIT', 172, 176, 6);
    drawTracked(ctx, 'SIGNAL LOSS', 172, 202, 6);
    drawTracked(ctx, 'FRAME 0' + (3 + Math.floor(t * 12)), 172, 228, 6);

    ctx.textAlign = 'right';
    drawTracked(ctx, 'DATAMOSH', W - 172, H - 210, 6, 'right');
    drawTracked(ctx, 'SCANLINE', W - 172, H - 184, 6, 'right');
    drawTracked(ctx, 'DISPLACE', W - 172, H - 158, 6, 'right');
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  const numP = clamp(seg(t, 0.15, 0.55));
  ctx.save();
  ctx.globalAlpha = numP * 0.16;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3;
  ctx.font = `${360}px ${FONT_DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText('03', W / 2, H / 2);
  ctx.restore();

  ctx.restore();

  const railP = clamp(seg(t, 0.22, 0.7)) * (1 - E.inQuad(seg(t, 1.62, 1.875)));
  if (railP > 0) {
    ctx.save();
    ctx.globalAlpha = railP * 0.85;
    const cx = W / 2;
    for (let i = 0; i < 44; i++) {
      const x = cx - 420 + i * 19.2;
      const h = 8 + hash1(i * 3.7) * 42;
      ctx.fillStyle = i % 4 === 0 ? PALETTE.magenta : 'rgba(255,255,255,0.35)';
      ctx.fillRect(x, H - 320, 2, h);
    }
    ctx.restore();
  }
}

/* ============================================================
   SCENE 04 — SPATIAL SYSTEM
   ============================================================ */
function drawWireCube(c, x, y, s, rot, color, alpha, lw) {
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const cr2 = Math.cos(rot * 0.68), sr2 = Math.sin(rot * 0.68);
  const v = [];
  for (let i = 0; i < 8; i++) {
    const px = (i & 1 ? 1 : -1), py = (i & 2 ? 1 : -1), pz = (i & 4 ? 1 : -1);
    const x1 = px * cr + pz * sr;
    const z1 = -px * sr + pz * cr;
    const y1 = py * cr2 - z1 * sr2;
    const z2 = py * sr2 + z1 * cr2;
    const persp = 2.4 / (2.4 + z2 * 0.62);
    v.push([x + x1 * s * persp, y + y1 * s * persp]);
  }
  const edges = [
    [0, 1], [1, 3], [3, 2], [2, 0],
    [4, 5], [5, 7], [7, 6], [6, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  c.save();
  c.globalAlpha = alpha;
  c.strokeStyle = color;
  c.lineWidth = lw;
  c.lineJoin = 'round';
  c.beginPath();
  for (const [a, b] of edges) {
    c.moveTo(v[a][0], v[a][1]);
    c.lineTo(v[b][0], v[b][1]);
  }
  c.stroke();
  c.restore();
}

function sceneSpatial(t) {
  gradBg(ctx, '#0B0A1A', '#05060E');

  const horizon = H * 0.44;
  const vx = W * 0.5 + Math.sin(t * 0.55) * 70;
  const vy = horizon;

  const sky = ctx.createLinearGradient(0, 0, 0, horizon + 40);
  sky.addColorStop(0, 'rgba(20,10,50,0.9)');
  sky.addColorStop(0.55, 'rgba(90,30,150,0.42)');
  sky.addColorStop(1, 'rgba(255,60,140,0.28)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon + 40);

  const sun = ctx.createRadialGradient(vx, vy - 40, 0, vx, vy - 40, 340);
  sun.addColorStop(0, 'rgba(255,120,190,0.55)');
  sun.addColorStop(1, 'rgba(255,60,140,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, horizon + 60);

  ctx.save();
  const scroll = (t * 2.35) % 1;
  const k = 1250;

  for (let i = 0; i < 34; i++) {
    const z = 0.55 + i - scroll;
    const y = vy + k / z;
    if (y > H + 30 || y < vy) continue;
    const a = clamp(1 - (y - vy) / (H - vy * 0.2)) * 0.55 + 0.05;
    ctx.strokeStyle = rgba(34, 225, 255, a);
    ctx.lineWidth = z < 2 ? 2.2 : 1.1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  for (let i = -22; i <= 22; i++) {
    const xEnd = vx + i * 210;
    const a = 0.30 - Math.abs(i) * 0.008;
    if (a <= 0.02) continue;
    ctx.strokeStyle = rgba(255, 45, 120, a);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.lineTo(xEnd, H + 60);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(34,225,255,0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, vy);
  ctx.lineTo(W, vy);
  ctx.stroke();
  ctx.restore();

  const shapes = [];
  for (let i = 0; i < 16; i++) {
    const sp = 0.55 + hash1(i * 3.1) * 0.95;
    let z = hash1(i * 7.7) * 16 - (t * sp * 3.1) % 16;
    z = ((z % 16) + 16) % 16;
    shapes.push({
      x: (hash1(i * 11.3) - 0.5) * 2600,
      y: (hash1(i * 13.9) - 0.5) * 720,
      z,
      size: 26 + hash1(i * 17.1) * 78,
      rot: hash1(i * 19.3) * TAU + t * (0.4 + hash1(i * 23.7) * 1.4) * (i % 2 ? 1 : -1),
      kind: i % 4,
      color: [PALETTE.cyan, PALETTE.magenta, PALETTE.violet, PALETTE.lime][i % 4],
    });
  }
  shapes.sort((a, b) => b.z - a.z);

  for (const s of shapes) {
    const persp = 3.2 / (3.2 + s.z * 0.42);
    const x = vx + s.x * persp;
    const y = vy - 150 + s.y * persp;
    const sc = s.size * persp;
    const alpha = clamp((16 - s.z) / 16) * 0.85 + 0.08;
    if (sc < 3) continue;

    ctx.save();
    if (s.kind === 0) {
      drawWireCube(ctx, x, y, sc, s.rot, s.color, alpha, 2.2);
    } else if (s.kind === 1) {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(x, y, sc, sc * 0.36, s.rot * 0.4, 0, TAU);
      ctx.stroke();
    } else if (s.kind === 2) {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2.2;
      polyPath(ctx, x, y, sc, 3, s.rot);
      ctx.stroke();
    } else {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2.2;
      polyPath(ctx, x, y, sc, 6, s.rot);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.35;
      polyPath(ctx, x, y, sc * 0.55, 6, -s.rot * 1.3);
      ctx.stroke();
    }
    ctx.restore();
  }

  const titleP = E.outExpo(seg(t, 0.12, 0.72));
  const titleExit = E.inQuad(seg(t, 1.50, 1.875));
  if (titleP > 0) {
    ctx.save();
    ctx.globalAlpha = (1 - titleExit);
    ctx.textBaseline = 'middle';
    const tr = lerp(120, 18, titleP);
    const yy = H * 0.5 - titleExit * 60;

    const scrim = ctx.createLinearGradient(0, yy - 220, 0, yy + 190);
    scrim.addColorStop(0, 'rgba(6,8,18,0)');
    scrim.addColorStop(0.42, 'rgba(6,8,18,0.62)');
    scrim.addColorStop(0.62, 'rgba(6,8,18,0.62)');
    scrim.addColorStop(1, 'rgba(6,8,18,0)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, yy - 220, W, 410);

    ctx.font = `${170}px ${FONT_DISPLAY}`;
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = '#FFFFFF';
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    drawTracked(ctx, 'SPATIAL', W / 2, yy, tr, 'center');
    strokeTracked(ctx, 'SPATIAL', W / 2, yy, tr, 'center');

    ctx.font = `16px ${FONT_MONO}`;
    ctx.fillStyle = PALETTE.cyan;
    const sp2 = clamp(seg(t, 0.55, 1.0)) * 0.95;
    drawTracked(ctx, '03 — SPACE  ·  PARALLAX  ·  FORM', W / 2, yy + 132, 9, 'center');
    ctx.globalAlpha = sp2 * (1 - titleExit);
    drawTracked(ctx, 'CAMERA 04', 172, 176, 6);
    drawTracked(ctx, 'LENS 24MM', 172, 202, 6);
    ctx.restore();
  }
}

/* ============================================================
   SCENE 05 — LIQUID FORM (metaballs)
   ============================================================ */
function sceneLiquid(t) {
  const d = ballImg.data;
  const blobs = [];
  for (let i = 0; i < 11; i++) {
    const ph = hash1(i * 7.31) * TAU;
    const sp = 0.50 + hash1(i * 3.17) * 0.95;
    const px = 0.5
      + 0.31 * Math.sin(t * sp * 0.82 + ph)
      + 0.07 * Math.sin(t * 1.55 + ph * 2.1);
    const py = 0.5
      + 0.30 * Math.cos(t * sp * 0.70 + ph * 1.27)
      + 0.06 * Math.cos(t * 1.95 + ph * 1.7);
    blobs.push({
      x: px * BALL_W,
      y: py * BALL_H,
      r: (0.040 + hash1(i * 11.7) * 0.046) * BALL_W,
    });
  }

  for (let y = 0; y < BALL_H; y++) {
    const ny = y / BALL_H;
    const row = y * BALL_W * 4;
    for (let x = 0; x < BALL_W; x++) {
      const nx = x / BALL_W;
      let f = 0;
      for (let i = 0; i < 11; i++) {
        const b = blobs[i];
        const ddx = x - b.x;
        const ddy = y - b.y;
        f += (b.r * b.r) / (ddx * ddx + ddy * ddy + 4);
      }
      const i4 = row + x * 4;
      if (f < 0.72) {
        d[i4] = 7; d[i4 + 1] = 8; d[i4 + 2] = 20; d[i4 + 3] = 255;
        continue;
      }
      const edge = clamp((f - 0.72) / 0.52);
      const core = clamp((f - 1.35) * 0.55);
      const hue = 186 + 118 * nx + 46 * Math.sin(ny * 3.1 + t * 1.05) + 26 * Math.sin(t * 0.75 + nx * 5.2);
      const light = 22 + core * 46 + edge * 12;
      const sat = 88 - core * 22;
      const h = ((hue % 360) + 360) % 360;
      const c1 = hslToRgb(h / 360, sat / 100, light / 100);
      d[i4] = c1[0]; d[i4 + 1] = c1[1]; d[i4 + 2] = c1[2];
      d[i4 + 3] = 255;
    }
  }
  ballCtx.putImageData(ballImg, 0, 0);

  bgFill(ctx, '#070812');

  const bgg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6);
  bgg.addColorStop(0, 'rgba(40,16,90,0.55)');
  bgg.addColorStop(1, 'rgba(7,8,18,0)');
  ctx.fillStyle = bgg;
  ctx.fillRect(0, 0, W, H);

  const zoom = 1.04 + 0.05 * Math.sin(t * 1.1);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-W / 2, -H / 2);
  if (HAS_FILTER) ctx.filter = 'blur(1.2px)';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(ballCv, 0, 0, W, H);
  if (HAS_FILTER) ctx.filter = 'none';
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.16;
  if (HAS_FILTER) ctx.filter = 'blur(34px)';
  ctx.drawImage(ballCv, -20, -20, W + 40, H + 40);
  if (HAS_FILTER) ctx.filter = 'none';
  ctx.restore();

  const txtP = E.outExpo(seg(t, 0.18, 0.85));
  const txtOut = E.inQuad(seg(t, 1.52, 1.875));
  if (txtP > 0) {
    ctx.save();
    ctx.globalAlpha = 1 - txtOut;
    ctx.textBaseline = 'middle';
    ctx.font = `${128}px ${FONT_DISPLAY}`;
    const tr = lerp(70, 12, txtP);
    ctx.shadowColor = 'rgba(4,4,14,0.85)';
    ctx.shadowBlur = 34;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#FFFFFF';
    drawTracked(ctx, 'LIQUID FORM', W / 2, H * 0.5, tr, 'center');
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.restore();
  }

  const labP = clamp(seg(t, 0.55, 1.0)) * (1 - txtOut);
  if (labP > 0.01) {
    ctx.save();
    ctx.globalAlpha = labP * 0.95;
    ctx.shadowColor = 'rgba(4,4,14,0.9)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `15px ${FONT_MONO}`;
    drawTracked(ctx, '04 — PROCEDURAL  ·  GOO  ·  GRADIENT', W / 2, H * 0.5 + 92, 9, 'center');
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo((W / 8) * i, 0);
    ctx.lineTo((W / 8) * i, H);
    ctx.stroke();
  }
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (H / 5) * i);
    ctx.lineTo(W, (H / 5) * i);
    ctx.stroke();
  }
  ctx.restore();
}

function hslToRgb(h, s, l) {
  if (s === 0) { const v = l * 255; return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);
  return [r * 255, g * 255, b * 255];
}
function hue2rgb(p, q, t2) {
  let s = t2;
  if (s < 0) s += 1;
  if (s > 1) s -= 1;
  if (s < 1 / 6) return p + (q - p) * 6 * s;
  if (s < 1 / 2) return q;
  if (s < 2 / 3) return p + (q - p) * (2 / 3 - s) * 6;
  return p;
}

/* ============================================================
   SCENE 06 — LINE CRAFT
   ============================================================ */
function sceneLine(t) {
  bgFill(ctx, '#06070B');

  const cx = W / 2, cy = H / 2;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.5);
  g.addColorStop(0, 'rgba(40,20,110,0.30)');
  g.addColorStop(0.55, 'rgba(18,10,50,0.12)');
  g.addColorStop(1, 'rgba(6,7,11,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const rings = [
    { r: 108, w: 2, dash: [3, 9], sp: 0.85, col: PALETTE.cyan, d0: 0.02 },
    { r: 158, w: 3.2, dash: [46, 16], sp: -0.55, col: '#FFFFFF', d0: 0.08 },
    { r: 214, w: 1.6, dash: [2, 8], sp: 1.15, col: PALETTE.magenta, d0: 0.14 },
    { r: 286, w: 5.5, dash: [110, 44], sp: -0.34, col: PALETTE.violet, d0: 0.20 },
    { r: 366, w: 2, dash: [14, 12], sp: 0.46, col: PALETTE.cyan, d0: 0.26 },
    { r: 452, w: 1.2, dash: [3, 15], sp: -0.82, col: 'rgba(255,255,255,0.85)', d0: 0.32 },
    { r: 548, w: 1.6, dash: [26, 18], sp: 0.28, col: PALETTE.magenta, d0: 0.38 },
    { r: 640, w: 1, dash: [2, 10], sp: -0.62, col: 'rgba(255,255,255,0.55)', d0: 0.44 },
  ];

  ctx.save();
  ctx.lineCap = 'round';
  for (const ring of rings) {
    const p = E.outCubic(seg(t, ring.d0, ring.d0 + 0.72));
    if (p <= 0) continue;
    ctx.setLineDash(ring.dash);
    ctx.lineDashOffset = -t * ring.sp * 260;
    ctx.lineWidth = ring.w;
    ctx.strokeStyle = ring.col;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(cx, cy, ring.r * (0.82 + 0.18 * p), -Math.PI / 2, -Math.PI / 2 + TAU * p);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();

  ctx.save();
  for (let i = 0; i < 54; i++) {
    const p = E.outCubic(seg(t, 0.10 + i * 0.0065, 0.58 + i * 0.0065));
    if (p <= 0) continue;
    const a = (i / 54) * TAU + t * 0.16;
    const long = i % 6 === 0;
    const r0 = 232 * p;
    const r1 = (long ? 336 : 292) * p;
    ctx.strokeStyle = long ? 'rgba(255,255,255,0.75)' : 'rgba(120,140,255,0.36)';
    ctx.lineWidth = long ? 2.4 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.restore();

  const hexP = E.outExpo(seg(t, 0.30, 1.02));
  if (hexP > 0) {
    ctx.save();
    ctx.globalAlpha = hexP * 0.95;
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = PALETTE.cyan;
    polyPath(ctx, cx, cy, 318 * (0.7 + 0.3 * hexP), 6, t * 0.22);
    ctx.stroke();

    ctx.lineWidth = 2.2;
    ctx.strokeStyle = PALETTE.magenta;
    polyPath(ctx, cx, cy, 232 * (0.7 + 0.3 * hexP), 3, -Math.PI / 2 - t * 0.38);
    ctx.stroke();

    ctx.lineWidth = 1.4;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    polyPath(ctx, cx, cy, 168 * (0.7 + 0.3 * hexP), 4, Math.PI / 4 + t * 0.5);
    ctx.stroke();
    ctx.restore();
  }

  const arcP = seg(t, 0.2, 1.5);
  if (arcP > 0) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 6;
    ctx.strokeStyle = PALETTE.gold;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(cx, cy, 402, t * 0.9, t * 0.9 + 1.25);
    ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(cx, cy, 402, t * 0.9 + Math.PI, t * 0.9 + Math.PI + 0.65);
    ctx.stroke();
    ctx.restore();
  }

  const wordP = E.outExpo(seg(t, 0.38, 1.08));
  const wordOut = E.inQuad(seg(t, 1.55, 1.875));
  if (wordP > 0) {
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const tr = lerp(88, 14, wordP);
    ctx.font = `112px ${FONT_UI}`;
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.globalAlpha = 1 - wordOut;
    drawTracked(ctx, 'CRAFT', cx, cy, tr, 'center');

    ctx.globalAlpha = (1 - wordOut) * 0.85;
    ctx.font = `15px ${FONT_MONO}`;
    ctx.fillStyle = PALETTE.cyan;
    drawTracked(ctx, '05 — DRAW-ON  ·  STROKE  ·  RHYTHM', cx, cy + 86, 9, 'center');
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = 0.5 * (1 - wordOut);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const a = t * 0.6 + (i / 4) * TAU;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 90, cy + Math.sin(a) * 90);
    ctx.lineTo(cx + Math.cos(a) * 700, cy + Math.sin(a) * 700);
    ctx.stroke();
  }
  ctx.restore();
}

/* ============================================================
   SCENE 07 — IMPACT  "GO ALL OUT"
   ============================================================ */
function sceneImpact(t) {
  const flip = t >= 1.02;
  const pre = E.inOutSine(seg(t, 0, 1.02));

  bgFill(ctx, flip ? '#07080E' : PALETTE.paper);

  if (!flip) {
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = '#0A0A12';
    for (let i = -8; i < 26; i++) {
      const x = i * 130 - ((t * 260) % 130);
      ctx.save();
      ctx.translate(x, 0);
      ctx.rotate(-0.36);
      ctx.fillRect(0, -200, 58, H * 2);
      ctx.restore();
    }
    ctx.restore();
  } else {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.13;
    for (let i = -8; i < 26; i++) {
      const x = i * 130 - ((t * 320) % 130);
      ctx.save();
      ctx.translate(x, 0);
      ctx.rotate(-0.36);
      ctx.fillStyle = i % 2 ? PALETTE.violet : PALETTE.magenta;
      ctx.fillRect(0, -200, 52, H * 2);
      ctx.restore();
    }
    ctx.restore();
  }

  const textCol = flip ? '#FFFFFF' : '#0B0C12';
  const accent = flip ? PALETTE.cyan : PALETTE.magenta;

  const word = 'GO ALL OUT';
  const baseSize = 168;
  const pIn = E.outExpo(seg(t, 0.02, 0.42));
  const pPush = E.inOutSine(seg(t, 0.42, 1.02));
  const pFlare = flip ? E.outExpo(seg(t, 1.02, 1.30)) : 0;
  const pOut = E.inQuart(seg(t, 1.42, 1.875));

  const scale = lerp(0.42, 1, pIn) * (1 + pPush * 0.62) * (1 + pFlare * 0.55) * (1 - pOut * 0.75);
  const track = lerp(48, 6, pIn) - pPush * 6;

  const drawWord = (scaleMul, trackAdd, alpha, col, blurGhost) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale * scaleMul, scale * scaleMul);
    ctx.translate(-W / 2, -H / 2);
    ctx.font = `${baseSize}px ${FONT_DISPLAY}`;
    ctx.fillStyle = col;
    drawTracked(ctx, word, W / 2, H / 2 + 8, track + trackAdd, 'center');
    ctx.restore();
    return blurGhost;
  };

  for (let g = 9; g >= 1; g--) {
    const k = g * 0.028;
    drawWord(1 - k * 0.9, g * 7, 0.055 * (1 - g / 11), flip ? 'rgba(120,150,255,1)' : 'rgba(20,20,40,1)');
  }
  drawWord(1, 0, 1, textCol);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.30 + 0.25 * pFlare;
  ctx.font = `${baseSize}px ${FONT_DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(W / 2, H / 2);
  ctx.scale(scale, scale);
  ctx.translate(-W / 2, -H / 2);
  ctx.fillStyle = accent;
  drawTracked(ctx, word, W / 2 + 6, H / 2 + 2, track, 'center');
  ctx.restore();

  const barP = clamp(seg(t, 0.25, 0.95));
  ctx.save();
  ctx.globalAlpha = 0.9 * (1 - pOut);
  ctx.fillStyle = accent;
  const bw = 620 * barP;
  ctx.fillRect(W / 2 - bw / 2, H / 2 + 128, bw, 6);
  ctx.restore();

  const capP = clamp(seg(t, 0.18, 0.6)) * (1 - pOut);
  if (capP > 0.01) {
    ctx.save();
    ctx.globalAlpha = capP * 0.85;
    ctx.fillStyle = flip ? 'rgba(255,255,255,0.75)' : 'rgba(12,12,20,0.72)';
    ctx.font = `16px ${FONT_MONO}`;
    drawTracked(ctx, '06 — NO COMPROMISE', W / 2, H / 2 + 176, 10, 'center');
    ctx.restore();
  }

  if (flip) {
    const fa = 1 - E.outExpo(seg(t, 1.02, 1.20));
    if (fa > 0) {
      ctx.save();
      ctx.globalAlpha = fa;
      ctx.fillStyle = PALETTE.paper;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
}

/* ============================================================
   SCENE 08 — OUTRO
   ============================================================ */
const OUTRO_PTS = (() => {
  const pts = [];
  for (let i = 0; i < 760; i++) {
    const a = (i / 760) * TAU;
    const wob = 1 + 0.010 * Math.sin(a * 6);
    pts.push({ x: Math.cos(a) * 268 * wob, y: Math.sin(a) * 268 * wob, s: 2.6, k: 0 });
  }
  for (let i = 0; i < 420; i++) {
    const u = (i / 420) * 3;
    const seg2 = Math.floor(u);
    const f = u - seg2;
    const verts = [[0, -172], [149, 86], [-149, 86]];
    const a2 = verts[seg2 % 3], b2 = verts[(seg2 + 1) % 3];
    pts.push({ x: lerp(a2[0], b2[0], f), y: lerp(a2[1], b2[1], f), s: 3.0, k: 1 });
  }
  for (let i = 0; i < 140; i++) {
    const a = (i / 140) * TAU;
    pts.push({ x: Math.cos(a) * 40, y: Math.sin(a) * 40, s: 2.4, k: 2 });
  }
  return pts;
})();

function sceneOutro(t) {
  bgFill(ctx, '#06070B');

  const cx = W / 2, cy = H * 0.395;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.52);
  g.addColorStop(0, 'rgba(60,30,150,0.40)');
  g.addColorStop(0.5, 'rgba(24,10,70,0.18)');
  g.addColorStop(1, 'rgba(6,7,11,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const conv = E.inOutCubic(seg(t, 0.02, 1.02));

  const glowA = clamp(seg(t, 0.35, 1.15)) * 0.42;
  if (glowA > 0.01) {
    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, 330);
    bloom.addColorStop(0, `rgba(90,60,220,${glowA})`);
    bloom.addColorStop(0.55, `rgba(40,20,120,${glowA * 0.45})`);
    bloom.addColorStop(1, 'rgba(20,10,60,0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(cx - 360, cy - 360, 720, 720);
  }

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < OUTRO_PTS.length; i++) {
    const p = OUTRO_PTS[i];
    const a0 = hash1(i * 3.7) * TAU;
    const r0 = 640 + hash1(i * 5.3) * 820;
    const sx = cx + Math.cos(a0) * r0;
    const sy = cy + Math.sin(a0) * r0 * 0.72;
    const ex = cx + p.x, ey = cy + p.y;
    const e = E.outCubic(clamp(conv * 1.18 - hash1(i * 7.1) * 0.22));
    const x = lerp(sx, ex, e);
    const y = lerp(sy, ey, e);
    const tw = (1 - e) * 30 + p.s * 1.5;
    const alpha = (0.30 + hash1(i * 9.3) * 0.70) * (0.32 + e * 0.82);
    ctx.fillStyle = p.k === 1
      ? rgba(255, 45, 120, alpha)
      : p.k === 2
        ? rgba(255, 255, 255, alpha)
        : rgba(34, 225, 255, alpha);
    ctx.fillRect(x - tw / 2, y - tw * 0.28, tw, tw * 0.56);
  }
  ctx.restore();

  const drawP = E.outCubic(seg(t, 0.62, 1.22));
  if (drawP > 0) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.translate(cx, cy);

    ctx.shadowColor = 'rgba(34,225,255,0.6)';
    ctx.shadowBlur = 30;
    ctx.lineWidth = 6;
    ctx.strokeStyle = PALETTE.cyan;
    ctx.beginPath();
    ctx.arc(0, 0, 268, -Math.PI / 2, -Math.PI / 2 + TAU * drawP);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    ctx.shadowColor = 'rgba(255,45,120,0.55)';
    ctx.shadowBlur = 26;
    ctx.lineWidth = 5;
    ctx.strokeStyle = PALETTE.magenta;
    ctx.beginPath();
    const verts = [[0, -172], [149, 86], [-149, 86]];
    const per = 3;
    const totalLen = drawP * per;
    for (let i = 0; i < per; i++) {
      const a2 = verts[i], b2 = verts[(i + 1) % per];
      const f = clamp(totalLen - i);
      if (f <= 0) break;
      if (i === 0) ctx.moveTo(a2[0], a2[1]);
      ctx.lineTo(lerp(a2[0], b2[0], f), lerp(a2[1], b2[1], f));
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    ctx.globalAlpha = drawP;
    ctx.fillStyle = PALETTE.lime;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  const nameP = E.outExpo(seg(t, 0.92, 1.42));
  const fadeOut = 1 - E.inQuad(seg(t, 1.52, 1.875));
  if (nameP > 0) {
    ctx.save();
    ctx.globalAlpha = nameP * fadeOut;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const tr = lerp(64, 12, nameP);
    ctx.font = `96px ${FONT_UI}`;
    ctx.fillStyle = '#FFFFFF';
    drawTracked(ctx, 'ALEX RIVERA', W / 2, H * 0.735, tr, 'center');

    const subP = E.outExpo(seg(t, 1.10, 1.52));
    ctx.globalAlpha = subP * fadeOut;
    ctx.font = `17px ${FONT_MONO}`;
    ctx.fillStyle = PALETTE.cyan;
    drawTracked(ctx, 'MOTION DESIGNER  ·  DIRECTION  ·  3D  ·  TYPE', W / 2, H * 0.735 + 78, 8, 'center');

    const ctP = E.outExpo(seg(t, 1.26, 1.66));
    ctx.globalAlpha = ctP * fadeOut * 0.8;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = `15px ${FONT_MONO}`;
    drawTracked(ctx, 'HELLO@ALEXRIVERA.DESIGN   /   ALEXRIVERA.DESIGN', W / 2, H * 0.735 + 132, 7, 'center');

    ctx.globalAlpha = nameP * fadeOut * 0.75;
    ctx.fillStyle = PALETTE.magenta;
    ctx.fillRect(W / 2 - 140 * nameP, H * 0.735 - 76, 280 * nameP, 3);
    ctx.restore();
  }

  if (fadeOut < 1) {
    ctx.save();
    ctx.globalAlpha = 1 - fadeOut;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

/* ============================================================
   POST FX + HUD
   ============================================================ */
function postFx(t, frame, sceneIdx) {
  const scene = SCENES[sceneIdx];
  const lightBg = scene.id === 'impact' && (t - scene.start) < 1.02;

  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 1.02);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(0.62, `rgba(0,0,0,${lightBg ? 0.06 : 0.16})`);
  vg.addColorStop(1, `rgba(0,0,0,${lightBg ? 0.26 : 0.62})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = lightBg ? 0.035 : 0.062;
  ctx.globalCompositeOperation = 'overlay';
  const tile = noiseTiles[frame % noiseTiles.length];
  const ox = -Math.floor(hash1(frame * 1.13) * 256);
  const oy = -Math.floor(hash1(frame * 2.71 + 5) * 256);
  for (let x = ox; x < W; x += 256) {
    for (let y = oy; y < H; y += 256) ctx.drawImage(tile, x, y);
  }
  ctx.restore();

  for (const s of SCENES) {
    if (s.start === 0) continue;
    const d = t - s.start;
    if (d >= 0 && d < 0.036) {
      const a = Math.pow(1 - d / 0.036, 1.6) * 0.46;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  const beat = (t / 0.46875) % 1;
  const pulse = Math.pow(1 - beat, 6);
  if (pulse > 0.01) {
    ctx.save();
    ctx.globalAlpha = pulse * 0.055;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  const hudA = lightBg ? 0.72 : 0.52;
  const hudInk = lightBg ? 'rgba(18,16,22,' : 'rgba(255,255,255,';
  ctx.save();
  ctx.globalAlpha = hudA;
  ctx.strokeStyle = hudInk + '0.70)';
  ctx.lineWidth = 1.4;
  const m = 72, L = 34;
  ctx.beginPath();
  ctx.moveTo(m, m + L); ctx.lineTo(m, m); ctx.lineTo(m + L, m);
  ctx.moveTo(W - m - L, m); ctx.lineTo(W - m, m); ctx.lineTo(W - m, m + L);
  ctx.moveTo(m, H - m - L); ctx.lineTo(m, H - m); ctx.lineTo(m + L, H - m);
  ctx.moveTo(W - m - L, H - m); ctx.lineTo(W - m, H - m); ctx.lineTo(W - m, H - m - L);
  ctx.stroke();

  ctx.fillStyle = hudInk + '0.88)';
  ctx.font = `13px ${FONT_MONO}`;
  drawTracked(ctx, 'REEL / 2026', m + 18, m + 30, 5);
  drawTracked(ctx, '1920x1080  ·  60 FPS', W - m - 18, m + 30, 5, 'right');

  const sec = Math.floor(t);
  const fr = Math.floor((t - sec) * FPS);
  const tc = `00:${String(sec).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
  drawTracked(ctx, tc, m + 18, H - m - 22, 5);
  drawTracked(ctx, SCENES[sceneIdx].name, W - m - 18, H - m - 22, 5, 'right');
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = lightBg ? 0.32 : 0.22;
  ctx.fillStyle = lightBg ? '#18161C' : '#FFFFFF';
  ctx.fillRect(m + 18, H - m - 6, W - m * 2 - 36, 2);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.9;
  const pg = ctx.createLinearGradient(m + 18, 0, W - m - 18, 0);
  pg.addColorStop(0, PALETTE.cyan);
  pg.addColorStop(0.55, PALETTE.violet);
  pg.addColorStop(1, PALETTE.magenta);
  ctx.fillStyle = pg;
  ctx.fillRect(m + 18, H - m - 6, (W - m * 2 - 36) * clamp(t / DURATION), 2);
  ctx.restore();
}

/* ============================================================
   RENDER LOOP
   ============================================================ */
const SCENE_FN = {
  ignition: sceneIgnition,
  kinetic: sceneKinetic,
  glitch: sceneGlitch,
  spatial: sceneSpatial,
  liquid: sceneLiquid,
  line: sceneLine,
  impact: sceneImpact,
  outro: sceneOutro,
};

function shakeFor(t) {
  const bursts = [
    { t: 0.90, mag: 22, dur: 0.38 },
    { t: 1.875, mag: 10, dur: 0.18 },
    { t: 3.75, mag: 12, dur: 0.18 },
    { t: 5.625, mag: 10, dur: 0.18 },
    { t: 7.5, mag: 10, dur: 0.18 },
    { t: 9.375, mag: 10, dur: 0.18 },
    { t: 11.25, mag: 18, dur: 0.30 },
    { t: 13.125, mag: 12, dur: 0.22 },
    { t: 1.30, mag: 8, dur: 0.20 },
    { t: 4.60, mag: 8, dur: 0.20 },
    { t: 8.10, mag: 8, dur: 0.20 },
    { t: 12.10, mag: 14, dur: 0.26 },
  ];
  let ax = 0, ay = 0;
  for (const b of bursts) {
    const d = t - b.t;
    if (d < 0 || d > b.dur) continue;
    const k = (1 - d / b.dur) * b.mag;
    ax += (hash1(Math.floor(t * 120) * 1.7 + b.t) * 2 - 1) * k;
    ay += (hash1(Math.floor(t * 120) * 2.3 + b.t + 9) * 2 - 1) * k;
  }
  return [ax, ay];
}

function renderFrame(frame) {
  const t = frame / FPS;
  const idx = sceneIndexOf(t);
  const scene = SCENES[idx];
  const fn = SCENE_FN[scene.id];

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);

  const [sx, sy] = shakeFor(t);
  ctx.save();
  ctx.translate(sx, sy);

  fn(t - scene.start);

  ctx.restore();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  postFx(t, frame, idx);

  return ctx.getImageData(0, 0, W, H).data;
}

function writeChunk(stream, buf) {
  return new Promise((resolve, reject) => {
    stream.write(buf, (err) => (err ? reject(err) : resolve()));
  });
}

async function main() {
  const outName = process.argv[2] || 'showreel.mp4';
  const outPath = path.resolve(__dirname, '..', outName);
  const audioPath = path.resolve(__dirname, 'audio.wav');
  const hasAudio = fs.existsSync(audioPath);
  const ffmpeg = require('ffmpeg-static');

  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', 'pipe:0',
  ];
  if (hasAudio) args.push('-i', audioPath);
  args.push(
    '-map', '0:v',
    ...(hasAudio ? ['-map', '1:a'] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2',
    '-x264-params', 'ref=5:bframes=4',
    ...(hasAudio ? ['-c:a', 'aac', '-b:a', '256k'] : []),
    '-movflags', '+faststart',
    '-t', String(DURATION),
    '-r', String(FPS),
    outPath
  );

  console.log(`encoding ${TOTAL} frames @ ${FPS}fps -> ${path.basename(outPath)}`);
  if (!hasAudio) console.log('note: audio.wav not found, rendering silent');

  const ff = spawn(ffmpeg, args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const started = Date.now();

  for (let f = 0; f < TOTAL; f++) {
    const data = renderFrame(f);
    await writeChunk(ff.stdin, Buffer.from(data.buffer, data.byteOffset, data.byteLength));
    if (f % 60 === 0 || f === TOTAL - 1) {
      const el = (Date.now() - started) / 1000;
      const rate = (f + 1) / el;
      const eta = (TOTAL - f - 1) / Math.max(rate, 0.01);
      process.stdout.write(`\r  frame ${f + 1}/${TOTAL}  ${rate.toFixed(1)} fps  eta ${eta.toFixed(0)}s   `);
    }
  }

  await new Promise((resolve) => ff.stdin.end(resolve));
  await new Promise((resolve) => ff.on('close', resolve));
  console.log(`\ndone in ${((Date.now() - started) / 1000).toFixed(1)}s -> ${outPath}`);
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { renderFrame, W, H, FPS, TOTAL, SCENES };
