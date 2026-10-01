/* ============================================================================
   20-gfx: WebGL2 post pipeline
   layers  : bg (GL scene, float, MSAA) + overlay (Canvas 2D, premultiplied)
   pipeline: compose -> 6-level dual-filter bloom -> chromatic aberration,
             grade, vignette -> float accumulation (temporal super-sampling
             = real motion blur) -> grain + dither -> screen
   ========================================================================== */
const GFX = (() => {
  let gl, cv, w = W, h = H;
  const G = { gl: null, w, h, hasFloat: false, msaa: 0 };
  const VS_FS = `#version 300 es
in vec2 a; out vec2 vUv; void main(){ vUv = a*.5+.5; gl_Position = vec4(a,0.,1.); }`;

  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      throw new Error('shader compile: ' + log + '\n' + src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n').slice(0, 4000));
    }
    return s;
  }
  // program helper: auto-discovers uniforms; u(name, ...vals) sets by reflected type
  function prog(vs, fs, attribs = ['a']) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    attribs.forEach((n, i) => gl.bindAttribLocation(p, i, n));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    const U = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const name = info.name.replace(/\[0\]$/, '');
      U[name] = { loc: gl.getUniformLocation(p, info.name), type: info.type, size: info.size };
    }
    const obj = {
      p, U,
      use() { gl.useProgram(p); return obj; },
      u(name, ...v) {
        const e = U[name]; if (!e) return obj;
        const a = v.length === 1 && v[0] && v[0].length !== undefined ? v[0] : v;
        switch (e.type) {
          case gl.FLOAT: e.size > 1 ? gl.uniform1fv(e.loc, a) : gl.uniform1f(e.loc, a[0] !== undefined ? a[0] : a); break;
          case gl.FLOAT_VEC2: gl.uniform2fv(e.loc, a); break;
          case gl.FLOAT_VEC3: gl.uniform3fv(e.loc, a); break;
          case gl.FLOAT_VEC4: gl.uniform4fv(e.loc, a); break;
          case gl.INT: case gl.SAMPLER_2D: gl.uniform1i(e.loc, a[0] !== undefined ? a[0] : a); break;
          case gl.FLOAT_MAT4: gl.uniformMatrix4fv(e.loc, false, a); break;
          case gl.FLOAT_MAT3: gl.uniformMatrix3fv(e.loc, false, a); break;
          default: gl.uniform1f(e.loc, a[0] !== undefined ? a[0] : a);
        }
        return obj;
      },
    };
    return obj;
  }
  function mkTex(tw, th, fmt = 'f16', filter = gl.LINEAR) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    if (fmt === 'f16' && G.hasFloat) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, tw, th, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else if (fmt === 'f32') gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, tw, th, 0, gl.RGBA, gl.FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function mkFbo(tex) {
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return f;
  }
  const bindTex = (unit, tex) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); };
  function target(fbo, tw, th) { gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, tw, th); }

  let vao, P = {}, T = {}, F = {}, bloomLv = [];
  const NB = 6;

  function build() {
    // fullscreen triangle
    vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    P.compose = prog(VS_FS, `#version 300 es
precision highp float;
uniform sampler2D uOv, uBg;
uniform vec3 uBgA, uBgB;
uniform float uUseBg, uAspect;
uniform vec4 uCam;     // zoom, rot, offx, offy (in height units)
uniform float uZB;     // radial zoom blur
uniform vec2 uJit;     // sub-pixel jitter in uv
in vec2 vUv; out vec4 o;
vec4 fetchAll(vec2 uv, out vec3 bg){
  vec4 ov = texture(uOv, vec2(uv.x, 1.-uv.y));
  bg = texture(uBg, uv).rgb;
  return ov;
}
void main(){
  vec2 uv0 = vUv + uJit;
  vec2 p0 = (uv0-.5); p0.x *= uAspect;
  float cs = cos(uCam.y), sn = sin(uCam.y);
  vec3 acc = vec3(0.);
  const int NS = 10;
  int ns = uZB > 0.001 ? NS : 1;
  for(int k=0;k<NS;k++){
    if(k>=ns) break;
    float s = ns>1 ? float(k)/float(ns-1) : 0.;
    vec2 p = p0 * (1. - uZB*s);
    p = mat2(cs,-sn,sn,cs)*p/uCam.x + uCam.zw;
    vec2 uv = vec2(p.x/uAspect, p.y)+.5;
    vec3 bgT; vec4 ov = fetchAll(uv, bgT);
    float r = length(p);
    vec3 flatC = mix(uBgA, uBgB, smoothstep(0., 1.15, r));
    vec3 bg = mix(flatC, bgT, uUseBg);
    acc += bg*(1.-ov.a) + ov.rgb;
  }
  o = vec4(acc/float(ns), 1.);
}`);

    P.down = prog(VS_FS, `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uThresh, uKnee, uFirst;
in vec2 vUv; out vec4 o;
vec3 thr(vec3 c){
  float br = max(c.r,max(c.g,c.b));
  float soft = clamp(br - uThresh + uKnee, 0., 2.*uKnee); soft = soft*soft/(4.*uKnee+1e-4);
  float wgt = max(soft, br-uThresh)/max(br,1e-4);
  return c*wgt;
}
vec3 s(vec2 uv){ vec3 c = texture(uSrc, uv).rgb; return uFirst>.5 ? thr(c) : c; }
void main(){
  vec2 t = uTexel;
  vec3 a = s(vUv+t*vec2(-2.,-2.)), b = s(vUv+t*vec2(0.,-2.)), c = s(vUv+t*vec2(2.,-2.));
  vec3 d = s(vUv+t*vec2(-2.,0.)),  e = s(vUv),                f = s(vUv+t*vec2(2.,0.));
  vec3 g = s(vUv+t*vec2(-2.,2.)),  hh= s(vUv+t*vec2(0.,2.)),  i = s(vUv+t*vec2(2.,2.));
  vec3 j = s(vUv+t*vec2(-1.,-1.)), k = s(vUv+t*vec2(1.,-1.)), l = s(vUv+t*vec2(-1.,1.)), m = s(vUv+t*vec2(1.,1.));
  vec3 r = e*.125 + (a+c+g+i)*.03125 + (b+d+f+hh)*.0625 + (j+k+l+m)*.125;
  o = vec4(r,1.);
}`);
    P.up = prog(VS_FS, `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uRad, uGain;
in vec2 vUv; out vec4 o;
void main(){
  vec2 t = uTexel*uRad;
  vec3 r = texture(uSrc, vUv).rgb*4.;
  r += texture(uSrc, vUv+vec2(-t.x,0.)).rgb*2. + texture(uSrc, vUv+vec2(t.x,0.)).rgb*2.
     + texture(uSrc, vUv+vec2(0.,-t.y)).rgb*2. + texture(uSrc, vUv+vec2(0.,t.y)).rgb*2.;
  r += texture(uSrc, vUv+t*vec2(-1.,-1.)).rgb + texture(uSrc, vUv+t*vec2(1.,-1.)).rgb
     + texture(uSrc, vUv+t*vec2(-1.,1.)).rgb + texture(uSrc, vUv+t*vec2(1.,1.)).rgb;
  o = vec4(r/16.*uGain, 1.);
}`);
    P.final = prog(VS_FS, `#version 300 es
precision highp float;
uniform sampler2D uScene, uBloom, uUi;
uniform float uAspect, uCA, uBloomI, uVig, uFlash, uWeight, uSat, uContrast, uFade;
uniform vec3 uFlashC, uTint;
in vec2 vUv; out vec4 o;
vec3 shoulder(vec3 c){
  vec3 k = vec3(.82);
  vec3 over = max(c-k, 0.);
  return min(c,k) + (1.-k)*tanh(over/(1.-k));
}
void main(){
  vec2 d = vUv-.5; vec2 da = vec2(d.x*uAspect, d.y);
  float r2 = dot(da,da);
  vec2 off = d*uCA*(.35+r2*2.2);
  vec3 col;
  col.r = texture(uScene, vUv+off).r;
  col.g = texture(uScene, vUv).g;
  col.b = texture(uScene, vUv-off).b;
  vec3 bl = texture(uBloom, vUv).rgb;
  col += bl*uBloomI;
  col *= uTint;
  float lum = dot(col, vec3(.2126,.7152,.0722));
  col = mix(vec3(lum), col, uSat);
  col = (col-.5)*uContrast+.5;
  col = max(col, 0.);
  col = shoulder(col);
  float vig = 1. - uVig*smoothstep(.40, 1.30, sqrt(r2)*1.15);
  col *= vig;
  vec4 ui = texture(uUi, vec2(vUv.x, 1.-vUv.y));
  col = col*(1.-ui.a) + ui.rgb;
  col = mix(col, uFlashC, uFlash);
  col *= (1.-uFade);
  o = vec4(col*uWeight, 1.);
}`);
    P.present = prog(VS_FS, `#version 300 es
precision highp float;
uniform sampler2D uAcc; uniform float uGrain, uSeed;
in vec2 vUv; out vec4 o;
float hash(vec3 p){ p = fract(p*vec3(.1031,.1030,.0973)); p += dot(p,p.yxz+33.33); return fract((p.x+p.y)*p.z); }
void main(){
  vec3 c = texture(uAcc, vUv).rgb;
  float lum = dot(c, vec3(.2126,.7152,.0722));
  vec2 gp = floor(gl_FragCoord.xy*.5);       // grain on 2x2 blocks: reads as film grain but is far cheaper for the video encoder
  float g = (hash(vec3(gp, uSeed)) + hash(vec3(gp.yx+17., uSeed*1.37)) - 1.);
  c += g*uGrain*(.35 + .65*(1.-lum*.8));
  float dth = (hash(vec3(gl_FragCoord.xy*1.7, uSeed+9.)) + hash(vec3(gl_FragCoord.yx*1.3, uSeed+3.)) - 1.)/255.;
  c += dth;
  o = vec4(c, 1.);
}`);
    P.blit = prog(VS_FS, `#version 300 es
precision highp float; uniform sampler2D uSrc; in vec2 vUv; out vec4 o;
void main(){ o = texture(uSrc, vUv); }`);
  }

  function makeTargets() {
    const dispose = () => { try { Object.values(T).forEach(t => gl.deleteTexture(t)); Object.values(F).forEach(f => gl.deleteFramebuffer(f)); } catch (e) { } };
    dispose(); T = {}; F = {}; bloomLv = [];
    T.ov = mkTex(w, h, 'u8', gl.LINEAR);
    T.ui = mkTex(w, h, 'u8', gl.LINEAR);
    T.bg = mkTex(w, h, 'f16'); F.bg = mkFbo(T.bg);
    // multisampled bg + depth
    G.msaa = 0;
    for (const s of [4, 2]) {
      try {
        const ms = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, ms);
        const rc = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rc);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, s, G.hasFloat ? gl.RGBA16F : gl.RGBA8, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rc);
        const rd = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rd);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, s, gl.DEPTH_COMPONENT24, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rd);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) { F.ms = ms; G.msaa = s; break; }
      } catch (e) { }
    }
    // plain depth FBO fallback (no msaa)
    F.bgDepth = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, F.bgDepth);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, T.bg, 0);
    const rd2 = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rd2);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rd2);

    T.scene = mkTex(w, h, 'f16'); F.scene = mkFbo(T.scene);
    T.acc = mkTex(w, h, 'f16'); F.acc = mkFbo(T.acc);
    let lw = w >> 1, lh = h >> 1;
    for (let i = 0; i < NB; i++) {
      const t = mkTex(Math.max(2, lw), Math.max(2, lh), 'f16'); const f = mkFbo(t);
      bloomLv.push({ t, f, w: Math.max(2, lw), h: Math.max(2, lh) });
      lw >>= 1; lh >>= 1;
    }
  }

  G.init = function (canvas, rw = W, rh = H) {
    cv = canvas; w = rw; h = rh; cv.width = w; cv.height = h;
    gl = cv.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 is not available');
    G.gl = gl;
    G.hasFloat = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    gl.getExtension('EXT_color_buffer_half_float'); gl.getExtension('OES_texture_float_linear');
    G.w = w; G.h = h;
    build(); makeTargets();
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    return G;
  };
  G.resize = function (rw, rh) { w = rw; h = rh; cv.width = w; cv.height = h; G.w = w; G.h = h; makeTargets(); };

  G.prog = prog; G.mkTex = mkTex; G.mkFbo = mkFbo; G.bindTex = bindTex; G.target = target;
  G.fsq = () => { gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3); };
  G.vaoFS = () => vao;
  G.tex = () => T; G.fbo = () => F;

  // --- background GL layer --------------------------------------------------
  // begin: binds a (multisampled) float target with depth; end: resolves into T.bg
  let bgUsedMS = false;
  G.bgBegin = function (clear = [0, 0, 0, 1]) {
    bgUsedMS = !!F.ms;
    gl.bindFramebuffer(gl.FRAMEBUFFER, bgUsedMS ? F.ms : F.bgDepth);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.BLEND); gl.disable(gl.SCISSOR_TEST);
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.clearColor(clear[0], clear[1], clear[2], clear[3]); gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  };
  G.bgEnd = function () {
    gl.disable(gl.DEPTH_TEST);
    if (bgUsedMS) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, F.ms); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, F.bg);
      gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    }
  };
  // plain (non-MS, no depth) fullscreen target for shader-only scenes; optionally tiled to dodge GPU watchdogs
  G.bgFlat = function () { gl.bindFramebuffer(gl.FRAMEBUFFER, F.bg); gl.viewport(0, 0, w, h); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); };
  G.tiled = function (n, fn) {
    if (n <= 1) { fn(); return; }
    gl.enable(gl.SCISSOR_TEST);
    const th = Math.ceil(h / n);
    for (let i = 0; i < n; i++) { gl.scissor(0, i * th, w, th); fn(); gl.finish(); }
    gl.disable(gl.SCISSOR_TEST);
  };

  // --- compose + bloom + final -> accumulate ---------------------------------
  const lastFx = {};
  G.uploadOverlay = function (canvas2d) {
    bindTex(0, T.ov);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas2d);
  };
  G.uploadUi = function (canvas2d) {
    bindTex(2, T.ui);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas2d);
  };
  G.clearAcc = function () { target(F.acc, w, h); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); };
  G.composeAndAccumulate = function (fx, weight) {
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.SCISSOR_TEST);
    gl.bindVertexArray(vao);
    // 1. compose
    target(F.scene, w, h);
    P.compose.use()
      .u('uOv', 0).u('uBg', 1).u('uBgA', fx.bgA).u('uBgB', fx.bgB).u('uUseBg', fx.useBg ? 1 : 0)
      .u('uAspect', w / h).u('uCam', [fx.zoom, fx.rot, fx.offx, fx.offy]).u('uZB', fx.zb)
      .u('uJit', [0, 0]);
    bindTex(0, T.ov); bindTex(1, T.bg); G.fsq();
    // 2. bloom (down)
    let src = T.scene, sw = w, sh = h;
    P.down.use().u('uSrc', 0).u('uThresh', fx.bloomThresh).u('uKnee', 0.35);
    for (let i = 0; i < NB; i++) {
      const L = bloomLv[i];
      target(L.f, L.w, L.h);
      P.down.u('uTexel', [1 / sw, 1 / sh]).u('uFirst', i === 0 ? 1 : 0);
      bindTex(0, src); G.fsq();
      src = L.t; sw = L.w; sh = L.h;
    }
    // 3. bloom (up, additive)
    P.up.use().u('uSrc', 0).u('uRad', 1.0).u('uGain', 1.0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = NB - 1; i > 0; i--) {
      const A = bloomLv[i], B = bloomLv[i - 1];
      target(B.f, B.w, B.h);
      P.up.u('uTexel', [1 / A.w, 1 / A.h]).u('uGain', 0.62 + fx.bloomWide * 0.3);
      bindTex(0, A.t); G.fsq();
    }
    gl.disable(gl.BLEND);
    // 4. final into accumulation buffer (additive)
    target(F.acc, w, h);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    P.final.use().u('uScene', 0).u('uBloom', 1).u('uUi', 2).u('uAspect', w / h).u('uCA', fx.ca).u('uBloomI', fx.bloom)
      .u('uVig', fx.vig).u('uFlash', fx.flash).u('uFlashC', fx.flashC).u('uWeight', weight)
      .u('uSat', fx.sat).u('uContrast', fx.contrast).u('uTint', fx.tint).u('uFade', fx.fade);
    bindTex(0, T.scene); bindTex(1, bloomLv[0].t); G.fsq();
    gl.disable(gl.BLEND);
  };
  G.present = function (fx, seed) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    P.present.use().u('uAcc', 0).u('uGrain', fx.grain).u('uSeed', seed % 1000 + 1.0);
    bindTex(0, T.acc); G.fsq();
  };
  G.readPixels = function (buf) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return buf;
  };
  G.defaultFx = function () {
    return {
      bgA: norm3(C.ink2), bgB: norm3(C.ink), useBg: 0,
      zoom: 1, rot: 0, offx: 0, offy: 0, zb: 0, jx: 0, jy: 0,
      bloom: 0.55, bloomThresh: 0.62, bloomWide: 0.5,
      ca: 0.0, vig: 0.22, flash: 0, flashC: [1, 1, 1], sat: 1.05, contrast: 1.04, tint: [1, 1, 1], fade: 0, grain: 0.016,
    };
  };
  return G;
})();
