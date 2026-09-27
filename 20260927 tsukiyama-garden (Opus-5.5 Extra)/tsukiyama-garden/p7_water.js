/* ---------------- Clearwater core: FFT spectrum, ripples, caustics, pebbles ---------------- */
// Ocean spectrum (FFT): Clearwater's Tessendorf-style patch, unchanged except for an amplitude uniform
// so the "wind" control can calm it down to a garden-pond breeze.
const N = 256, LOGN = 8;
const L = 4.6;               // patch size (m)
const CAUS_DEPTH = 1.25;     // depth used to focus the caustic pattern (m)
const TARGET_SLOPE = 0.078;  // RMS slope at full amplitude (Clearwater's open-water value)

const rnd = mulberry(7);
function gauss(){ let u=0,v=0; while(!u) u=rnd(); v=rnd(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }

function buildH0(){
  const kp = 2*Math.PI/0.62, kcut = 2*Math.PI/0.045;
  const wd = [0.8, 0.6];
  const re = new Float32Array(N*N), im = new Float32Array(N*N);
  let s2 = 0;
  for (let m=0;m<N;m++) for (let n=0;n<N;n++){
    const nx = n<N/2? n : n-N, nz = m<N/2? m : m-N;
    const kx = 2*Math.PI*nx/L, kz = 2*Math.PI*nz/L, k = Math.hypot(kx,kz);
    let P = 0;
    if (k>1e-6){
      const lk = Math.log(k/kp);
      const bump = Math.exp(-0.5*(lk/0.36)**2);
      const tail = 0.035*Math.exp(-((kp/k)**2))*Math.exp(-((k/kcut)**2));
      const swell = 0.35*Math.exp(-0.5*(Math.log(k/(2*Math.PI/1.6))/0.3)**2);
      const c = (kx*wd[0]+kz*wd[1])/k;
      const spread = (0.3 + 0.7*c*c) * (c<0? 0.35 : 1);
      P = (bump + tail + swell) * spread / (k*k*k*k);
    }
    const a = Math.sqrt(P/2);
    const i = m*N+n; re[i] = gauss()*a; im[i] = gauss()*a;
    s2 += 2*k*k*(re[i]*re[i]+im[i]*im[i]);
  }
  const sc = TARGET_SLOPE/Math.sqrt(s2);
  const data = new Float32Array(N*N*4);
  for (let m=0;m<N;m++) for (let n=0;n<N;n++){
    const i=m*N+n, j=((N-m)%N)*N + ((N-n)%N);
    data[i*4]=re[i]*sc; data[i*4+1]=im[i]*sc; data[i*4+2]=re[j]*sc; data[i*4+3]=-im[j]*sc;
  }
  const t = tex(N,N,gl.RGBA32F,{filter:gl.NEAREST, wrap:gl.REPEAT});
  gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,N,N,gl.RGBA,gl.FLOAT,data);
  return t;
}
const h0Tex = buildH0();
const fftA = rt(N,N,FFT_FMT,{filter:gl.NEAREST, wrap:gl.REPEAT});
const fftB = rt(N,N,FFT_FMT,{filter:gl.NEAREST, wrap:gl.REPEAT});
const surfRT = rt(N,N,gl.RGBA16F,{wrap:gl.REPEAT, mip:true, aniso:8});

const pSpec = prog(VS, HEAD+`
uniform sampler2D uH0; uniform float uT, uL, uAmp;
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
void main(){
  ivec2 id = ivec2(gl_FragCoord.xy);
  vec4 s = texelFetch(uH0, id, 0);
  vec2 n = vec2(id); n -= step(${N/2}.0, n) * ${N}.0;
  vec2 k = 6.28318530718*n/uL; float kl = length(k);
  float w = sqrt(9.81*kl + 7.4e-5*kl*kl*kl);
  float w0 = 6.28318530718/60.0; w = floor(w/w0)*w0;
  float c = cos(w*uT), sn = sin(w*uT);
  vec2 H = (cmul(s.xy, vec2(c,sn)) + cmul(s.zw, vec2(c,-sn))) * uAmp;
  vec2 C1 = H - k.x*H;
  vec2 C2 = vec2(-k.y*H.y, k.y*H.x);
  o = vec4(C1, C2);
}`, 'spectrum');

const pFFT = prog(VS, HEAD+`
uniform sampler2D uSrc; uniform int uP, uHoriz;
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
void main(){
  ivec2 id = ivec2(gl_FragCoord.xy);
  int j = uHoriz==1 ? id.x : id.y;
  int k = j & (uP-1);
  int i = ((j - (j & (2*uP-1))) >> 1) + k;
  bool y1 = (j & uP) != 0;
  ivec2 a = uHoriz==1 ? ivec2(i, id.y) : ivec2(id.x, i);
  ivec2 b = uHoriz==1 ? ivec2(i+${N/2}, id.y) : ivec2(id.x, i+${N/2});
  vec4 x0 = texelFetch(uSrc, a, 0), x1 = texelFetch(uSrc, b, 0);
  float ang = 3.14159265359*float(k)/float(uP);
  vec2 w = vec2(cos(ang), sin(ang));
  vec4 wx = vec4(cmul(w,x1.xy), cmul(w,x1.zw));
  o = y1 ? x0-wx : x0+wx;
}`, 'fft');

const pResolve = prog(VS, HEAD+`
uniform sampler2D uSrc;
void main(){
  vec4 s = texelFetch(uSrc, ivec2(gl_FragCoord.xy), 0);
  vec2 sl = vec2(s.y, s.z);
  o = vec4(s.x, sl, dot(sl,sl));
}`, 'resolve');

function runFFT(t, amp){
  gl.disable(gl.BLEND);
  target(fftA); gl.useProgram(pSpec.p); bindT(0,h0Tex); gl.uniform1i(pSpec.u.uH0,0); gl.uniform1f(pSpec.u.uT,t); gl.uniform1f(pSpec.u.uL,L); gl.uniform1f(pSpec.u.uAmp, amp); fullscreen();
  gl.useProgram(pFFT.p); gl.uniform1i(pFFT.u.uSrc,0);
  let src=fftA, dst=fftB;
  for (let horiz=1; horiz>=0; horiz--) for (let s=0;s<LOGN;s++){
    target(dst); bindT(0,src.t); gl.uniform1i(pFFT.u.uP, 1<<s); gl.uniform1i(pFFT.u.uHoriz, horiz); fullscreen();
    [src,dst]=[dst,src];
  }
  target(surfRT); gl.useProgram(pResolve.p); bindT(0,src.t); gl.uniform1i(pResolve.u.uSrc,0); fullscreen();
  gl.bindTexture(gl.TEXTURE_2D, surfRT.t); gl.generateMipmap(gl.TEXTURE_2D);
}

/* ---- Interactive ripples: Clearwater's wave-equation grid, stretched over the whole pond ---- */
// The grid covers the pond at ~4.7 cm per texel; the bank mask pins the height to zero on land,
// so rings reflect off the shore and the islands instead of running into the lawn.
const RIP = { x0:-25, z0:-17, sx:48, sz:30, nx:1024, nz:640 };
const RIP_TEXEL = RIP.sx/RIP.nx;
const rip = [0,1].map(()=>rt(RIP.nx,RIP.nz,gl.RGBA16F,{wrap:gl.CLAMP_TO_EDGE}));
const ripN = rt(RIP.nx,RIP.nz,gl.RGBA16F,{wrap:gl.CLAMP_TO_EDGE});
let ripIdx = 0;
for (const r of [...rip, ripN]){ gl.bindFramebuffer(gl.FRAMEBUFFER, r.fb); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); }
const ripMask = (() => {
  const mx = 256, mz = 160, d = new Uint8Array(mx*mz);
  for (let j=0;j<mz;j++) for (let i=0;i<mx;i++){
    const x = RIP.x0 + (i+0.5)/mx*RIP.sx, z = RIP.z0 + (j+0.5)/mz*RIP.sz;
    d[j*mx+i] = Math.round(255*smooth(0.0, -0.07, terrainH(x,z)));
  }
  const t = tex(mx, mz, gl.R8); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, mx, mz, gl.RED, gl.UNSIGNED_BYTE, d); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  return t;
})();
const MAX_DROPS = 32;
const pRipple = prog(VS, HEAD+`
uniform sampler2D uSrc, uMask; uniform vec4 uDrops[${MAX_DROPS}]; uniform int uNDrops; uniform vec2 uSize; uniform float uC;
void main(){
  vec2 px = 1.0/vec2(textureSize(uSrc,0));
  vec4 c = texture(uSrc, vUv);
  float avg = 0.25*(texture(uSrc, vUv+vec2(px.x,0)).r + texture(uSrc, vUv-vec2(px.x,0)).r + texture(uSrc, vUv+vec2(0,px.y)).r + texture(uSrc, vUv-vec2(0,px.y)).r);
  float v = c.g + (avg - c.r)*uC;
  v *= 0.9955;
  float h = c.r + v;
  h *= 0.9985;
  for (int i=0;i<${MAX_DROPS};i++){
    if (i >= uNDrops) break;
    vec4 d = uDrops[i]; float dist = length((vUv - d.xy)*uSize);
    if (dist < d.z) h -= d.w*(0.5 + 0.5*cos(3.14159*dist/d.z));
  }
  float m = texture(uMask, vUv).r;
  o = vec4(h*m, v*m, 0, 1);
}`, 'ripple');
const pRipN = prog(VS, HEAD+`
uniform sampler2D uSrc; uniform float uTexel;
void main(){
  vec2 px = 1.0/vec2(textureSize(uSrc,0));
  float hx = texture(uSrc, vUv+vec2(px.x,0)).r - texture(uSrc, vUv-vec2(px.x,0)).r;
  float hz = texture(uSrc, vUv+vec2(0,px.y)).r - texture(uSrc, vUv-vec2(0,px.y)).r;
  float h = texture(uSrc,vUv).r;
  float lap = (texture(uSrc, vUv+vec2(px.x,0)).r + texture(uSrc, vUv-vec2(px.x,0)).r + texture(uSrc, vUv+vec2(0,px.y)).r + texture(uSrc, vUv-vec2(0,px.y)).r - 4.0*h)/(uTexel*uTexel);
  o = vec4(h, hx/(2.0*uTexel), hz/(2.0*uTexel), lap);
}`, 'rippleNormals');
const dropBuf = new Float32Array(MAX_DROPS*4);
function stepRipples(){
  gl.disable(gl.BLEND); gl.useProgram(pRipple.p);
  const n = Math.min(MAX_DROPS, dropQueue.length);
  for (let i=0;i<n;i++){ const [x,z,r,s] = dropQueue.shift(); dropBuf.set([(x-RIP.x0)/RIP.sx, (z-RIP.z0)/RIP.sz, r, s], i*4); }
  const src = rip[ripIdx], dst = rip[1-ripIdx];
  target(dst); bindT(0, src.t); bindT(1, ripMask);
  gl.uniform1i(pRipple.u.uSrc,0); gl.uniform1i(pRipple.u.uMask,1); gl.uniform4fv(pRipple.u.uDrops, dropBuf); gl.uniform1i(pRipple.u.uNDrops, n);
  gl.uniform2f(pRipple.u.uSize, RIP.sx, RIP.sz); gl.uniform1f(pRipple.u.uC, 0.62);
  fullscreen(); ripIdx = 1-ripIdx;
}
function rippleNormals(){
  target(ripN); gl.useProgram(pRipN.p); bindT(0, rip[ripIdx].t); gl.uniform1i(pRipN.u.uSrc,0); gl.uniform1f(pRipN.u.uTexel, RIP_TEXEL); fullscreen();
}

/* ---- Caustics: Clearwater's refracted-grid method, unchanged ---- */
const G = 256, C = 1024;
const causRT = rt(C,C,gl.RGBA16F,{wrap:gl.REPEAT, mip:true, aniso:8});
const gridVAO = gl.createVertexArray(); gl.bindVertexArray(gridVAO);
{
  const v = new Float32Array((G+1)*(G+1)*2); let o=0;
  for (let j=0;j<=G;j++) for (let i=0;i<=G;i++){ v[o++]=i/G; v[o++]=j/G; }
  const idx = new Uint32Array(G*G*6); o=0;
  for (let j=0;j<G;j++) for (let i=0;i<G;i++){ const a=j*(G+1)+i, b=a+1, c=a+G+1, d=c+1; idx[o++]=a; idx[o++]=b; idx[o++]=c; idx[o++]=b; idx[o++]=d; idx[o++]=c; }
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
}
gl.bindVertexArray(null);
const pCaus = prog(`#version 300 es
precision highp float; precision highp sampler2D;
layout(location=0) in vec2 aUV;
uniform sampler2D uSurf; uniform float uL, uDepth, uIor; uniform vec3 uSun; uniform vec2 uShift;
out vec2 vSrc;
void main(){
  ivec2 off = ivec2(gl_InstanceID % 3 - 1, gl_InstanceID / 3 - 1);
  vec4 s = textureLod(uSurf, aUV, 0.0);
  vec3 n = normalize(vec3(-s.y, 1.0, -s.z));
  vec3 r = refract(-uSun, n, 1.0/uIor);
  vec3 P = vec3(aUV.x*uL, s.x, aUV.y*uL);
  vec3 F = P + r*((-uDepth - s.x)/r.y);
  vSrc = aUV*uL;
  vec2 c = (F.xz - uShift)/uL + vec2(off);
  gl_Position = vec4(c*2.0-1.0, 0.0, 1.0);
}`, `#version 300 es
precision highp float;
in vec2 vSrc; out vec4 o; uniform float uNorm;
void main(){
  vec2 a = dFdx(vSrc), b = dFdy(vSrc);
  float area = abs(a.x*b.y - a.y*b.x);
  float I = min(area*uNorm, 40.0);
  o = vec4(I);
}`, 'caustics');
const IORS = [1.3315, 1.3335, 1.3365];
let causShift = [0,0];
function renderCaustics(sun){
  target(causRT); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  gl.useProgram(pCaus.p); bindT(0, surfRT.t); gl.uniform1i(pCaus.u.uSurf,0);
  gl.uniform1f(pCaus.u.uL, L); gl.uniform1f(pCaus.u.uDepth, CAUS_DEPTH); gl.uniform3fv(pCaus.u.uSun, sun);
  gl.uniform1f(pCaus.u.uNorm, (C/L)*(C/L));
  const sy = sun[1], sinI = Math.sqrt(1-sy*sy), sinT = sinI/IORS[1], cosT = Math.sqrt(1-sinT*sinT);
  const hd = Math.hypot(sun[0],sun[2]) || 1, tanT = sinT/cosT;
  causShift = [-sun[0]/hd*CAUS_DEPTH*tanT, -sun[2]/hd*CAUS_DEPTH*tanT];
  gl.uniform2fv(pCaus.u.uShift, causShift);
  gl.bindVertexArray(gridVAO);
  const masks = [[1,0,0,0],[0,1,0,0],[0,0,1,0]];
  for (let c=0;c<3;c++){ gl.colorMask(...masks[c]); gl.uniform1f(pCaus.u.uIor, IORS[c]); gl.drawElementsInstanced(gl.TRIANGLES, G*G*6, gl.UNSIGNED_INT, 0, 9); }
  gl.colorMask(true,true,true,true); gl.disable(gl.BLEND);
  gl.bindTexture(gl.TEXTURE_2D, causRT.t); gl.generateMipmap(gl.TEXTURE_2D);
}

/* ---- Pebbles: Clearwater's embedded seamless pebble texture (suhama beach and pond bed) ---- */
const pebTex = tex(1024, 1024, gl.SRGB8_ALPHA8, { wrap:gl.REPEAT, mip:true, aniso:16 });
let pebReady = false;
{ const img = new Image(); img.onload = () => { gl.bindTexture(gl.TEXTURE_2D, pebTex); gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,img); gl.generateMipmap(gl.TEXTURE_2D); pebReady = true; };
  img.onerror = () => fail('Could not decode the pebble texture.');
  img.src = 'data:image/jpeg;base64,' + document.getElementById('pebbles-texture').textContent.trim(); }
