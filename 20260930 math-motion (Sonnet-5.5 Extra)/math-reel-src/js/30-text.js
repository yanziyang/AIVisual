/* ============================================================================
   30-text: typography helpers for Canvas 2D (design space 1920x1080)
   fonts: Inter Tight (display), JetBrains Mono (HUD), STIX Two Text (maths)
   formula mini-markup:  ^x  superscript   _x  subscript   ^(..) _(..) groups
                         {inf} {sqrt} {->} {=>} {approx} {dot} {sum} {int}  vector glyphs
                         *x*  italic (STIX) for variables
   ========================================================================== */
const FONT = {
  disp: (w, s) => `${w} ${s}px "Inter Tight", "Segoe UI", Arial, sans-serif`,
  mono: (w, s) => `${w} ${s}px "JetBrains Mono", Consolas, monospace`,
  math: (s, it = false, w = 400) => `${it ? 'italic ' : ''}${w} ${s}px "STIX Two Text", "Cambria Math", "Times New Roman", serif`,
};

/* load embedded fonts (FONT_DATA is injected by the build) */
async function loadFonts() {
  if (typeof FONT_DATA === 'undefined') return;
  const jobs = FONT_DATA.map(async f => {
    const bin = atob(f.b64); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const ff = new FontFace(f.family, u8.buffer, { weight: f.weight, style: f.style, unicodeRange: f.range });
    await ff.load(); document.fonts.add(ff);
  });
  await Promise.all(jobs);
  // make sure every face is "used" once so Chrome has the glyph data ready for canvas
  await document.fonts.load(FONT.disp(800, 40), 'AaBb09 πθ');
  await document.fonts.load(FONT.mono(500, 20), 'AaBb09 πθ');
  await document.fonts.load(FONT.math(40, true), 'eiπθφ');
  await document.fonts.load(FONT.math(40, false, 700), 'π');
}

/* ---- basic text -------------------------------------------------------- */
// opts: font(string), color, align('left'|'center'|'right'), base('alphabetic'|'middle'|..), ls(letterSpacing px), alpha, stroke(color), sw(strokeWidth)
function text(ctx, str, x, y, o = {}) {
  ctx.save();
  ctx.font = o.font || FONT.disp(700, 32);
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.base || 'alphabetic';
  try { ctx.letterSpacing = (o.ls || 0) + 'px'; } catch (e) { }
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (o.halo) {      // dark outline underneath for legibility over busy imagery
    ctx.lineJoin = 'round'; ctx.miterLimit = 2; ctx.strokeStyle = o.halo; ctx.lineWidth = o.haloW || 7; ctx.strokeText(str, x, y);
  }
  if (o.stroke) {
    ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    ctx.strokeStyle = o.stroke; ctx.lineWidth = o.sw || 2; ctx.strokeText(str, x, y);
  }
  if (o.fill !== false) { ctx.fillStyle = o.color || '#fff'; ctx.fillText(str, x, y); }
  ctx.restore();
}
function measure(ctx, str, font, ls = 0) {
  ctx.save(); ctx.font = font; try { ctx.letterSpacing = ls + 'px'; } catch (e) { }
  const m = ctx.measureText(str); ctx.restore();
  return m.width;
}

/* ---- masked line reveal: text slides up from under a mask ----------------- */
// p: 0..1 progress ; the line clips to its own cap-height box so it emerges "from nowhere"
function revealLine(ctx, str, x, y, size, p, o = {}) {
  if (p <= 0) return;
  const fnt = o.font || FONT.disp(o.weight || 800, size);
  const w = measure(ctx, str, fnt, o.ls || 0);
  const ax = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  ctx.save();
  ctx.beginPath(); ctx.rect(ax - 20, y - size * 1.0, w + 40, size * 1.25); ctx.clip();
  const e = E.out5(clamp(p));
  text(ctx, str, ax, y + (1 - e) * size * 1.1, { font: fnt, color: o.color || '#fff', ls: o.ls || 0, alpha: o.alpha, stroke: o.stroke, sw: o.sw, fill: o.fill, halo: o.halo, haloW: o.haloW });
  ctx.restore();
  return w;
}

/* ---- per-character kinetic text ------------------------------------------ */
// each char drops/slides/scales in with stagger; returns total width
function kinetic(ctx, str, x, y, size, t, o = {}) {
  const fnt = o.font || FONT.disp(o.weight || 800, size);
  const ls = o.ls || 0;
  ctx.save(); ctx.font = fnt; try { ctx.letterSpacing = '0px'; } catch (e) { }
  const widths = [...str].map(c => ctx.measureText(c).width + ls);
  const total = widths.reduce((a, b) => a + b, 0) - ls;
  let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
  const n = str.length;
  const stag = o.stagger ?? 0.03, dur = o.dur ?? 0.5;
  [...str].forEach((ch, i) => {
    const k = (o.reverse ? (n - 1 - i) : i);
    const p = clamp((t - (o.delay || 0) - k * stag) / dur);
    if (p > 0 && ch !== ' ') {
      const e = E.out5(p);
      ctx.save();
      ctx.globalAlpha *= (o.alpha ?? 1) * clamp(p * 3);
      let tx = cx, ty = y;
      const mode = o.mode || 'rise';
      if (mode === 'rise') ty += (1 - e) * size * 0.9;
      if (mode === 'fall') ty -= (1 - e) * size * 0.9;
      if (mode === 'slide') tx += (1 - e) * -size * 1.2;
      ctx.translate(tx, ty);
      if (mode === 'pop') { const s = E.outBack(p, 2.2); ctx.translate(widths[i] / 2, -size * .35); ctx.scale(s, s); ctx.translate(-widths[i] / 2, size * .35); }
      if (o.clip) { /* nothing */ }
      ctx.fillStyle = o.colorAt ? o.colorAt(i) : (o.color || '#fff'); ctx.textBaseline = 'alphabetic';
      if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.sw || 2; ctx.lineJoin = 'round'; ctx.strokeText(ch, 0, 0); }
      if (o.fill !== false) ctx.fillText(ch, 0, 0);
      ctx.restore();
    }
    cx += widths[i];
  });
  ctx.restore();
  return total;
}

/* ---- scramble / decode text ---------------------------------------------- */
const SCR = '0123456789+-=<>/\\|*#%&@';
function scramble(str, p, seed = 1) {
  const r = mulberry32(seed + Math.floor(p * 40));
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const lock = i / str.length * 0.7;
    if (str[i] === ' ' || p > lock + 0.3) out += str[i];
    else out += SCR[Math.floor(r() * SCR.length)];
  }
  return out;
}

/* ---- formula typesetting with markup ------------------------------------- */
// returns width. Draws with baseline at y. size = base font px.
function drawFormula(ctx, src, x, y, size, o = {}) {
  const color = o.color || '#fff';
  const nodes = parseFormula(src);
  const w = layoutFormula(ctx, nodes, 0, 0, size, o, true);
  const ax = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  ctx.save(); ctx.translate(ax, y);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  layoutFormula(ctx, nodes, 0, 0, size, o, false);
  ctx.restore();
  return w;
}
function parseFormula(s) {
  // tokens: {sym} ; ^ ; _ ; ( ) groups after ^ _ ; *italic* ; plain
  const out = []; let i = 0; let it = false;
  const readGroup = () => {
    if (s[i] === '(') {
      let d = 1, j = i + 1;
      while (j < s.length && d > 0) { if (s[j] === '(') d++; if (s[j] === ')') d--; j++; }
      const inner = s.slice(i + 1, j - 1); i = j; return parseFormula(inner);
    }
    if (s[i] === '{') { const j = s.indexOf('}', i); const sym = s.slice(i, j + 1); i = j + 1; return [{ k: 'sym', v: sym.slice(1, -1) }]; }
    const ch = s[i++]; return [{ k: 't', v: ch, it }];
  };
  while (i < s.length) {
    const c = s[i];
    if (c === '*') { it = !it; i++; continue; }
    if (c === '^') { i++; out.push({ k: 'sup', c: readGroup() }); continue; }
    if (c === '_') { i++; out.push({ k: 'sub', c: readGroup() }); continue; }
    if (c === '{') { const j = s.indexOf('}', i); out.push({ k: 'sym', v: s.slice(i + 1, j) }); i = j + 1; continue; }
    // plain run
    let j = i; while (j < s.length && !'*^_{'.includes(s[j])) j++;
    out.push({ k: 't', v: s.slice(i, j), it }); i = j;
  }
  return out;
}
function layoutFormula(ctx, nodes, x, y, size, o, measureOnly) {
  const color = o.color || '#fff';
  const mathFont = (sz, it) => FONT.math(sz, it, o.weight || 400);
  for (const n of nodes) {
    if (n.k === 't') {
      ctx.font = mathFont(size, n.it);
      try { ctx.letterSpacing = '0px'; } catch (e) { }
      const w = ctx.measureText(n.v).width;
      if (!measureOnly) { ctx.fillStyle = color; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillText(n.v, x, y); }
      x += w;
    } else if (n.k === 'sup' || n.k === 'sub') {
      const s2 = size * 0.62, dy = n.k === 'sup' ? -size * 0.38 : size * 0.22;
      x = layoutFormula(ctx, n.c, x, y + dy, s2, o, measureOnly);
    } else if (n.k === 'sym') {
      x += drawSym(ctx, n.v, x, y, size, color, measureOnly);
    }
  }
  return x;
}
// vector glyphs for symbols missing from the fonts
function drawSym(ctx, name, x, y, size, color, measureOnly) {
  const lw = Math.max(1.2, size * 0.065);
  const adv = { inf: 1.05, sqrt: 0.8, '->': 1.0, '=>': 1.05, approx: 0.85, dot: 0.5, sum: 0.9, int: 0.5, sp: 0.35, thin: 0.15 }[name] ?? 0.6;
  if (measureOnly) return adv * size;
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const s = size;
  if (name === 'inf') {
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) { const a = i / 80 * TAU, d = 1 + Math.sin(a) ** 2; const px = s * 0.5 + Math.cos(a) / d * s * 0.46, py = -s * 0.27 + Math.sin(a) * Math.cos(a) / d * s * 0.46 * 1.1; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke();
  } else if (name === 'sqrt') {
    ctx.beginPath(); ctx.moveTo(s * 0.04, -s * 0.28); ctx.lineTo(s * 0.18, -s * 0.2); ctx.lineTo(s * 0.34, s * 0.06); ctx.lineTo(s * 0.52, -s * 0.76); ctx.lineTo(s * 0.9, -s * 0.76); ctx.stroke();
  } else if (name === '->') {
    ctx.beginPath(); ctx.moveTo(s * 0.06, -s * 0.27); ctx.lineTo(s * 0.92, -s * 0.27); ctx.moveTo(s * 0.68, -s * 0.46); ctx.lineTo(s * 0.92, -s * 0.27); ctx.lineTo(s * 0.68, -s * 0.08); ctx.stroke();
  } else if (name === '=>') {
    ctx.beginPath(); ctx.moveTo(s * 0.06, -s * 0.36); ctx.lineTo(s * 0.8, -s * 0.36); ctx.moveTo(s * 0.06, -s * 0.18); ctx.lineTo(s * 0.8, -s * 0.18);
    ctx.moveTo(s * 0.62, -s * 0.54); ctx.lineTo(s * 0.92, -s * 0.27); ctx.lineTo(s * 0.62, 0); ctx.stroke();
  } else if (name === 'approx') {
    for (const dy of [-0.38, -0.17]) { ctx.beginPath(); for (let i = 0; i <= 20; i++) { const u = i / 20; const px = s * (0.05 + u * 0.75), py = -s * (-dy) + Math.sin(u * TAU) * -s * 0.06; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); }
  } else if (name === 'dot') {
    ctx.beginPath(); ctx.arc(s * 0.25, -s * 0.28, s * 0.07, 0, TAU); ctx.fill();
  } else if (name === 'sum') {
    ctx.beginPath(); ctx.moveTo(s * 0.78, -s * 0.64); ctx.lineTo(s * 0.78, -s * 0.74); ctx.lineTo(s * 0.06, -s * 0.74); ctx.lineTo(s * 0.42, -s * 0.28); ctx.lineTo(s * 0.06, s * 0.0); ctx.lineTo(s * 0.8, s * 0.0); ctx.lineTo(s * 0.8, -s * 0.12); ctx.stroke();
  } else if (name === 'int') {
    ctx.beginPath(); ctx.moveTo(s * 0.4, -s * 0.8); ctx.bezierCurveTo(s * 0.3, -s * 0.95, s * 0.2, -s * 0.8, s * 0.18, -s * 0.5); ctx.lineTo(s * 0.12, s * 0.0); ctx.bezierCurveTo(s * 0.1, s * 0.2, s * 0.0, s * 0.2, s * -0.02, s * 0.1); ctx.stroke();
  }
  ctx.restore();
  return adv * size;
}

/* ---- tiny UI atoms ---------------------------------------------------------- */
function plusMark(ctx, x, y, r, color, a = 1, lw = 1.2) {
  ctx.save(); ctx.strokeStyle = color; ctx.globalAlpha *= a; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke(); ctx.restore();
}
function ring(ctx, x, y, r, color, lw = 1.5, a = 1) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.globalAlpha *= a; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.restore();
}
function disc(ctx, x, y, r, color, a = 1) {
  ctx.save(); ctx.fillStyle = color; ctx.globalAlpha *= a; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
}
// glowing dot: crisp core + soft halo via radial gradient (additive-friendly)
function glowDot(ctx, x, y, r, col, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
  g.addColorStop(0, rgb(col, 0.55 * a)); g.addColorStop(0.25, rgb(col, 0.18 * a)); g.addColorStop(1, rgb(col, 0));
  ctx.save(); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 5, 0, TAU); ctx.fill();
  ctx.fillStyle = rgb([255, 255, 255], a); ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, TAU); ctx.fill();
  ctx.fillStyle = rgb(col, a); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha *= 0.85; ctx.fill();
  ctx.restore();
}
function lineTo2(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); }

// scientific notation, right-aligned:  m x 10^e   (exponent drawn as a real superscript, no special glyphs needed)
function sciRight(ctx, man, ex, xr, y, size, color, alpha = 1, weight = 800, halo = null) {
  const f1 = FONT.disp(weight, size), f2 = FONT.disp(weight, size * 0.46);
  const es = (ex < 0 ? '−' : '') + Math.abs(ex);
  const we = measure(ctx, es, f2), w10 = measure(ctx, '×10', f1);
  text(ctx, es, xr, y - size * 0.46, { font: f2, color, align: 'right', alpha, halo, haloW: size * 0.1 });
  text(ctx, '×10', xr - we - 2, y, { font: f1, color, align: 'right', alpha, halo, haloW: size * 0.1 });
  text(ctx, man, xr - we - w10 - 6, y, { font: f1, color, align: 'right', alpha, halo, haloW: size * 0.1 });
}
