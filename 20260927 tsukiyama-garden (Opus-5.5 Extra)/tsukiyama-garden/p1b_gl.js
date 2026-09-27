/* ---------------- WebGL2 setup and helpers (from Clearwater, extended) ---------------- */
// (fail() and the error overlay are defined in the page head, before the pebble texture)
const Q = new URLSearchParams(location.search);
const FIXED_T = Q.has('t') ? parseFloat(Q.get('t')) : null;
const DEBUG = Q.has('debug');

const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2', { antialias:false, alpha:false, depth:false, stencil:false, powerPreference:'high-performance', preserveDrawingBuffer: Q.has('shot') });
if (!gl) { fail("WebGL2 is not available in this browser."); throw 0; }
const extF32 = gl.getExtension('EXT_color_buffer_float');
const extF16 = gl.getExtension('EXT_color_buffer_half_float');
const extAniso = gl.getExtension('EXT_texture_filter_anisotropic');
gl.getExtension('OES_texture_float_linear');
if (!extF32 && !extF16) { fail("This GPU cannot render to floating-point textures (EXT_color_buffer_float / EXT_color_buffer_half_float missing)."); throw 0; }
const FFT_FMT = extF32 ? gl.RGBA32F : gl.RGBA16F;

function sh(type, src, name){
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    const lines = src.split('\n').map((l,i)=>`${String(i+1).padStart(3)}  ${l}`);
    const m = /ERROR: \d+:(\d+)/.exec(log); const ln = m? +m[1] : 0;
    fail(`Shader "${name}":\n${log}\n` + (ln? lines.slice(Math.max(0,ln-4), ln+2).join('\n') : ''));
    throw new Error('shader '+name);
  }
  return s;
}
// defines are inserted after the #version line, so one source can build several variants
function prog(vs, fs, name, defines=''){
  const ins = src => defines ? src.replace(/^(#version 300 es\n)/, `$1${defines}\n`) : src;
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, ins(vs), name+'.vs'));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, ins(fs), name+'.fs'));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { fail(`Link "${name}": ${gl.getProgramInfoLog(p)}`); throw 0; }
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i=0;i<n;i++){ const info = gl.getActiveUniform(p,i); u[info.name.replace(/\[0\]$/,'')] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}
function tex(w, h, fmt, { filter=gl.LINEAR, wrap=gl.CLAMP_TO_EDGE, mip=false, aniso=0 } = {}){
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  const levels = mip ? Math.floor(Math.log2(Math.max(w,h)))+1 : 1;
  gl.texStorage2D(gl.TEXTURE_2D, levels, fmt, w, h);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  if (aniso && extAniso) gl.texParameterf(gl.TEXTURE_2D, extAniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(aniso, gl.getParameter(extAniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  return t;
}
function rt(w, h, fmt, opts){
  const t = tex(w,h,fmt,opts); const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (st !== gl.FRAMEBUFFER_COMPLETE) fail('Incomplete framebuffer ('+st+') '+w+'x'+h);
  return { t, fb, w, h };
}
function depthTex(w, h, compare=false){
  const d = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, d);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT32F, w, h);
  const f = compare ? gl.LINEAR : gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (compare){ gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL); }
  return d;
}
// colour + depth render target (depth is a sampleable texture)
function rtDepth(w, h, fmt){
  const r = rt(w, h, fmt); r.d = depthTex(w, h);
  gl.bindFramebuffer(gl.FRAMEBUFFER, r.fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, r.d, 0);
  const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER); if (st !== gl.FRAMEBUFFER_COMPLETE) fail('Incomplete depth framebuffer ('+st+')');
  return r;
}
function bindT(unit, t){ gl.activeTexture(gl.TEXTURE0+unit); gl.bindTexture(gl.TEXTURE_2D, t); }
function target(r){ gl.bindFramebuffer(gl.FRAMEBUFFER, r? r.fb : null); gl.viewport(0,0, r? r.w : canvas.width, r? r.h : canvas.height); }

const triVAO = gl.createVertexArray(); gl.bindVertexArray(triVAO);
{ const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0); }
function fullscreen(){ gl.bindVertexArray(triVAO); gl.drawArrays(gl.TRIANGLES, 0, 3); }

const VS = `#version 300 es
layout(location=0) in vec2 p; out vec2 vUv;
void main(){ vUv = p*.5+.5; gl_Position = vec4(p,0.,1.); }`;
const HEAD = `#version 300 es
precision highp float; precision highp sampler2D; precision highp int;
in vec2 vUv; out vec4 o;
`;

// upload a Mesh (interleaved STRIDE floats) into a VAO
function meshVAO(M, dynamic=false){
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, M instanceof Float32Array ? M : new Float32Array(M.v), dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
  const S = STRIDE*4;
  for (const [loc, n, off] of [[0,3,0],[1,3,3],[2,4,6],[3,2,10],[4,4,12]]){ gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, S, off*4); }
  let count = 0;
  if (!(M instanceof Float32Array)){
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(M.ix), gl.STATIC_DRAW);
    count = M.ix.length;
  }
  gl.bindVertexArray(null);
  return { vao, vb, count };
}
