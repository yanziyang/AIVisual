/* ============================================================================
   Scene 05  MANDELBROT ZOOM   (10.0 - 13.33 s)
   Perturbation theory in fp32 with Zhuoran rebasing:
     reference orbit Z_n (float64 on the CPU, uploaded as an RG32F texture),
     per-pixel delta orbit  d_{n+1} = 2 Z_n d_n + d_n^2 + dc   (tiny numbers, fp32 is plenty)
     if |Z_n + d_n| < |d_n|  ->  d := Z_n + d_n, n := 0       (rebase, kills glitches)
   Smooth iteration count -> palindromic colour ramp; emboss from the screen-space derivative of the phase.
   ========================================================================== */
const MB = { c0: [-0.743643887037151, 0.131825904205330], cStart: [-0.55, 0.0], s0: 3.0, sEnd: 5e-6, ready: false, refLen: 0, ref: null, map: null };

SCENE_IMPL.mandel = {
  samples: 5,
  punch: 0.0, caKick: 0.0006,
  init() {
    const gl = GFX.gl;
    // ---- reference orbit (double precision) ----
    const NREF = 2600; let zr = 0, zi = 0; const ref = new Float32Array(2048 * Math.ceil((NREF + 2) / 2048) * 2); let n = 0;
    for (; n <= NREF; n++) {
      ref[n * 2] = zr; ref[n * 2 + 1] = zi;
      const nr = zr * zr - zi * zi + MB.c0[0], ni = 2 * zr * zi + MB.c0[1]; zr = nr; zi = ni;
      if (zr * zr + zi * zi > 1e10) { n++; ref[n * 2] = zr; ref[n * 2 + 1] = zi; break; }
    }
    MB.refLen = Math.min(n + 1, NREF + 1);
    LOG('mandel: reference orbit length ' + MB.refLen + ' (escaped=' + (MB.refLen < NREF) + ')');
    MB.refTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, MB.refTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, 2048, ref.length / 4096, 0, gl.RG, gl.FLOAT, ref);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    // ---- palindromic colour ramp (LUT) ----
    const stops = [[0, [0.008, 0.010, 0.035]], [0.10, [0.02, 0.06, 0.24]], [0.22, [0.10, 0.52, 0.95]], [0.32, [0.30, 0.88, 1.0]], [0.38, [0.54, 0.42, 1.0]], [0.44, [1.0, 0.33, 0.22]], [0.48, [1.0, 0.76, 0.28]], [0.5, [1.0, 0.95, 0.86]]];
    const N = 512, lut = new Uint8Array(N * 4);
    const ramp = x => { x = x > 0.5 ? 1 - x : x; let i = 0; while (i < stops.length - 2 && x > stops[i + 1][0]) i++; const [a, ca] = stops[i], [b, cb] = stops[i + 1]; const u = (x - a) / (b - a); return ca.map((c, k) => lerp(c, cb[k], u)); };
    for (let i = 0; i < N; i++) { const c = ramp(i / (N - 1)); lut[i * 4] = c[0] * 255; lut[i * 4 + 1] = c[1] * 255; lut[i * 4 + 2] = c[2] * 255; lut[i * 4 + 3] = 255; }
    MB.lutTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, MB.lutTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, N, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, lut);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.REPEAT], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    // ---- program ----
    const vs = `#version 300 es
in vec2 a; void main(){ gl_Position = vec4(a,0.,1.); }`;
    const fs = `#version 300 es
precision highp float; precision highp sampler2D;
uniform sampler2D uRef, uLut;
uniform vec2 uRes, uJit, uOff, uRot; uniform float uScale, uPhase, uTime;
uniform int uMaxIter, uRefLen;
out vec4 o;
vec2 refZ(int n){ return texelFetch(uRef, ivec2(n & 2047, n >> 11), 0).rg; }
void main(){
  vec2 p = (gl_FragCoord.xy + uJit - .5*uRes)/uRes.y;
  vec2 q = vec2(p.x*uRot.x - p.y*uRot.y, p.x*uRot.y + p.y*uRot.x);
  vec2 dc = uOff + q*uScale;
  vec2 dz = vec2(0.); int n = 0; float it = 0.; bool esc = false; float m2 = 0.;
  for(int i=0;i<4096;i++){
    if(i>=uMaxIter) break;
    vec2 Z = refZ(n);
    dz = vec2(2.*(Z.x*dz.x - Z.y*dz.y) + dz.x*dz.x - dz.y*dz.y, 2.*(Z.x*dz.y + Z.y*dz.x) + 2.*dz.x*dz.y) + dc;
    n++;
    vec2 z = refZ(n) + dz; m2 = dot(z,z);
    if(m2 > 65536.){ esc = true; break; }
    if(m2 < dot(dz,dz) || n >= uRefLen-1){ dz = z; n = 0; }
    it += 1.;
  }
  vec3 col = vec3(.008,.010,.026);
  if(esc){
    float mu = it + 1. - log2(.5*log(m2));
    float s = .115*pow(max(mu-1.,0.), .72) + uPhase;
    float g = dFdx(s)*.7071 - dFdy(s)*.7071;
    vec3 base = texture(uLut, vec2(fract(s), .5)).rgb;
    float shade = 1. + .26*clamp(g*3., -1., 1.);
    float far = smoothstep(1.5, 10., mu);
    col = base*shade*(.32 + .68*far);
    col += vec3(1.,.55,.25)*pow(clamp(1.-it/float(uMaxIter)*0.0,0.,1.),1.)*0.0;
  }
  o = vec4(col,1.);
}`;
    MB.prog = GFX.prog(vs, fs, ['a']);
    // ---- overview map for the HUD ----
    const mw = 300, mh = 200, cv = document.createElement('canvas'); cv.width = mw; cv.height = mh; const mx = cv.getContext('2d');
    const img = mx.createImageData(mw, mh); const span = 2.7, x0 = -0.62 - span * 0.5 * (mw / mh), y0 = -span * 0.5;
    for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) {
      const cr = x0 + (i / mw) * span * (mw / mh), ci = y0 + (j / mh) * span; let a = 0, b = 0, k = 0;
      for (; k < 70 && a * a + b * b < 256; k++) { const t = a * a - b * b + cr; b = 2 * a * b + ci; a = t; }
      const v = k >= 70 ? 0 : 40 + 215 * Math.pow(k / 70, 0.5), q = (j * mw + i) * 4;
      img.data[q] = v * 0.30; img.data[q + 1] = v * 0.40; img.data[q + 2] = v * 0.95; img.data[q + 3] = k >= 70 ? 255 : 255;
    }
    mx.putImageData(img, 0, 0); MB.map = { cv, x0, y0, span, w: mw, h: mh };
    MB.ready = true;
  },
  view(lt, dur) {
    const p = clamp(lt / dur), L = Math.log(MB.s0 / MB.sEnd);
    const e = p * p * (3 - 2 * p) * 0.6 + p * 0.4;                  // gentle ease, no hard stop
    const scale = MB.s0 * Math.exp(-L * e);
    const k = Math.pow(scale / MB.s0, 1.18);                         // centre drifts onto the target
    const cen = [MB.c0[0] + (MB.cStart[0] - MB.c0[0]) * k, MB.c0[1] + (MB.cStart[1] - MB.c0[1]) * k];
    const rot = 0.25 + 1.25 * p + 0.35 * Math.sin(p * 3);
    const maxIter = Math.min(2400, Math.round(260 + 175 * Math.log10(MB.s0 / scale)));
    return { scale, cen, rot, maxIter, mag: MB.s0 / scale, p };
  },
  bg(lt, t, fx, sc) {
    const gl = GFX.gl, V = this.view(lt, sc.dur);
    GFX.bgFlat();
    MB.prog.use().u('uRef', 0).u('uLut', 1).u('uRes', [GFX.w, GFX.h]).u('uJit', [fx.jx * GFX.w / W, fx.jy * GFX.h / H])
      .u('uOff', [V.cen[0] - MB.c0[0], V.cen[1] - MB.c0[1]]).u('uRot', [Math.cos(V.rot), Math.sin(V.rot)]).u('uScale', V.scale)
      .u('uPhase', -0.55 * V.p).u('uTime', t).u('uMaxIter', V.maxIter).u('uRefLen', MB.refLen);
    GFX.bindTex(0, MB.refTex); GFX.bindTex(1, MB.lutTex);
    gl.bindVertexArray(GFX.vaoFS());
    GFX.tiled(this.tiles || 6, () => gl.drawArrays(gl.TRIANGLES, 0, 3));
    GFX.bindTex(0, null);
  },
  fx(fx, lt, t, sc) { fx.bloom = 0.42; fx.bloomThresh = 0.78; fx.vig = 0.34; fx.hudAccent = C.gold; fx.sat = 1.06; },
  draw(ctx, lt, t, fx, sc) {
    const V = this.view(lt, sc.dur), Vf = this.view(FRAME_T - sc.t0, sc.dur);
    // soft radial scrims behind the type for legibility over the bright fractal
    for (const [sx, sy, sr, sa] of [[300, 220, 760, 0.72], [W - 200, 190, 640, 0.62], [300, H - 20, 560, 0.55], [W - 220, H - 60, 560, 0.45]]) {
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr); g.addColorStop(0, `rgba(4,5,12,${sa})`); g.addColorStop(0.55, `rgba(4,5,12,${sa * 0.55})`); g.addColorStop(1, 'rgba(4,5,12,0)');
      ctx.fillStyle = g; ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    }
    revealLine(ctx, 'INFINITY', 68, 200, 108, ez(E.out5, lt, 0.03, 0.5), { weight: 800, color: rgb(C.paper), halo: 'rgba(4,5,12,0.7)', haloW: 10 });
    revealLine(ctx, 'UP CLOSE.', 68, 300, 108, ez(E.out5, lt, 0.13, 0.6), { weight: 800, color: rgb(C.gold), halo: 'rgba(4,5,12,0.7)', haloW: 10 });
    // crosshair
    const cx = W / 2, cy = H / 2, ca = ez(E.out3, lt, 0.1, 0.5);
    ctx.save(); ctx.globalAlpha = ca * 0.85; ctx.strokeStyle = rgb(C.paper, 0.9); ctx.lineWidth = 1.6;
    ring(ctx, cx, cy, 26, rgb(C.paper), 1.6, 0.9);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) seg(ctx, cx + dx * 36, cy + dy * 36, cx + dx * 58, cy + dy * 58);
    ctx.restore();
    // magnification
    const man = Vf.mag / Math.pow(10, Math.floor(Math.log10(Vf.mag))), ex = Math.floor(Math.log10(Vf.mag));
    const ra = ez(E.out3, lt, 0.2, 0.6);
    text(ctx, 'MAGNIFICATION', W - 64, 140, { font: FONT.mono(500, 13), color: rgb(C.paper, 0.7), align: 'right', ls: 3, alpha: ra });
    if (ex >= 3) sciRight(ctx, man.toFixed(2), ex, W - 64, 232, 92, rgb(C.gold), ra, 800, 'rgba(4,5,12,0.75)');
    else text(ctx, '×' + Vf.mag.toFixed(Vf.mag < 10 ? 2 : 0), W - 64, 232, { font: FONT.disp(800, 92), color: rgb(C.gold), align: 'right', alpha: ra, halo: 'rgba(4,5,12,0.75)', haloW: 9 });
    text(ctx, 'MAX ITERATIONS  ' + String(Vf.maxIter).replace(/\B(?=(\d{3})+(?!\d))/g, ','), W - 64, 272, { font: FONT.mono(500, 14), color: rgb(C.paper, 0.75), align: 'right', ls: 2, alpha: ra });
    // minimap bottom-right
    const M = MB.map, mxp = W - 64 - M.w, myp = H - 250 - M.h + 30, ma = ez(E.out3, lt, 0.25, 0.7);
    ctx.save(); ctx.globalAlpha = ma;
    ctx.fillStyle = 'rgba(4,5,12,0.8)'; ctx.fillRect(mxp - 8, myp - 8, M.w + 16, M.h + 16);
    ctx.drawImage(M.cv, mxp, myp);
    ctx.strokeStyle = rgb(C.paper, 0.35); ctx.lineWidth = 1; ctx.strokeRect(mxp - 8.5, myp - 8.5, M.w + 17, M.h + 17);
    const toMap = (cr, ci) => [mxp + (cr - M.x0) / (M.span * (M.w / M.h)) * M.w, myp + (ci - M.y0) / M.span * M.h];
    const pc = toMap(MB.c0[0], MB.c0[1]);
    // view rectangle (centre follows the camera)
    const cm = toMap(Vf.cen[0], Vf.cen[1]), rw = Vf.scale * (W / H) / (M.span * (M.w / M.h)) * M.w, rh = Vf.scale / M.span * M.h;
    ctx.strokeStyle = rgb(C.gold); ctx.lineWidth = 1.6;
    if (rw > 6) ctx.strokeRect(cm[0] - rw / 2, cm[1] - rh / 2, rw, rh);
    glowDot(ctx, pc[0], pc[1], 2.6, C.ember, 1);
    ctx.restore();
    text(ctx, 'c = −0.74364 + 0.13183 i', mxp, myp + M.h + 34, { font: FONT.mono(500, 13), color: rgb(C.paper, 0.7), ls: 1.5, alpha: ma });
  },
};
