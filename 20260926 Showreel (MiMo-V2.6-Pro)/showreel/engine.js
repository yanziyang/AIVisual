'use strict';

const TAU = Math.PI * 2;

function clamp(v, a = 0, b = 1) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function invLerp(a, b, v) { return b === a ? 0 : (v - a) / (b - a); }
function map(v, a, b, c, d) { return lerp(c, d, clamp(invLerp(a, b, v))); }
function smoothstep(a, b, v) { const t = clamp(invLerp(a, b, v)); return t * t * (3 - 2 * t); }
function seg(t, a, b) { return clamp((t - a) / (b - a)); }

const E = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => t * (2 - t),
  inOutQuad: t => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  inCubic: t => t * t * t,
  outCubic: t => { const u = t - 1; return u * u * u + 1; },
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
  inQuart: t => t * t * t * t,
  outQuart: t => { const u = t - 1; return 1 - u * u * u * u; },
  inOutQuart: t => (t < 0.5 ? 8 * t * t * t * t : 1 - 8 * Math.pow(t - 1, 4)),
  inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * (t - 1))),
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: t => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
  },
  inCirc: t => 1 - Math.sqrt(1 - t * t),
  outCirc: t => { const u = t - 1; return Math.sqrt(1 - u * u); },
  inOutCirc: t => (t < 0.5
    ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
    : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2),
  inSine: t => 1 - Math.cos((t * Math.PI) / 2),
  outSine: t => Math.sin((t * Math.PI) / 2),
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: t => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  inBack: t => {
    const c1 = 1.70158, c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  outElastic: t => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const c4 = TAU / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  outBounce: t => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

function hash1(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, oct = 4) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += amp * noise2(x * f, y * f); amp *= 0.5; f *= 2; }
  return v;
}

function rgba(r, g, b, a = 1) { return `rgba(${r | 0},${g | 0},${b | 0},${a})`; }
function hsl(h, s, l, a = 1) { return `hsla(${h},${s}%,${l}%,${a})`; }

function textWidth(ctx, text, tracking = 0) {
  if (!text.length) return 0;
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + tracking;
  return w - tracking;
}

function drawTracked(ctx, text, x, y, tracking = 0, align = 'left') {
  const w = textWidth(ctx, text, tracking);
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + tracking;
  }
  return w;
}

function strokeTracked(ctx, text, x, y, tracking = 0, align = 'left') {
  const w = textWidth(ctx, text, tracking);
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  for (const ch of text) {
    ctx.strokeText(ch, cx, y);
    cx += ctx.measureText(ch).width + tracking;
  }
  return w;
}

function eachChar(ctx, text, x, y, tracking, align, fn) {
  const w = textWidth(ctx, text, tracking);
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const cw = ctx.measureText(ch).width;
    fn(ch, i, cx, y, cw);
    cx += cw + tracking;
  }
  return w;
}

function circularText(ctx, text, cx, cy, radius, startAngle, tracking, flip = false) {
  const chars = [...text];
  let total = 0;
  for (const ch of chars) total += ctx.measureText(ch).width + tracking;
  let ang = startAngle;
  for (const ch of chars) {
    const cw = ctx.measureText(ch).width;
    const step = (cw + tracking) / radius;
    ang += step / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius);
    ctx.rotate(ang + (flip ? -Math.PI / 2 : Math.PI / 2));
    ctx.fillText(ch, -cw / 2, 0);
    ctx.restore();
    ang += step / 2;
  }
}

function polyPath(ctx, cx, cy, r, sides, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i <= sides; i++) {
    const a = rot + (i / sides) * TAU - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function makeNoiseTile(createCanvas, size = 256, soft = false) {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let i = 0; i < size * size; i++) {
    let v = Math.random() * 255;
    if (soft) v = 128 + (v - 128) * 0.6;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const PALETTE = {
  ink: '#06070B',
  ink2: '#0B0D16',
  paper: '#F3EFE6',
  cyan: '#22E1FF',
  magenta: '#FF2D78',
  violet: '#7B5CFF',
  lime: '#C8FF32',
  gold: '#FFB020',
  white: '#FFFFFF',
};

module.exports = {
  TAU, clamp, lerp, invLerp, map, smoothstep, seg, E,
  hash1, hash2, noise2, fbm,
  rgba, hsl,
  textWidth, drawTracked, strokeTracked, eachChar, circularText,
  polyPath, roundRectPath, makeNoiseTile,
  PALETTE,
};
