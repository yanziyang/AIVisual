/* ---------------- Post: bloom + glare + tonemap (from Clearwater; depth of field added) ---------------- */
const pBright = prog(VS, HEAD+`
uniform sampler2D uSrc; uniform float uThr;
void main(){
  vec2 px = 1.0/vec2(textureSize(uSrc,0));
  vec3 c = vec3(0);
  for (int y=-1;y<=2;y++) for (int x=-1;x<=2;x++) c += texture(uSrc, vUv + (vec2(x,y)-0.5)*px*1.0).rgb;
  c /= 16.0;
  float l = max(max(c.r,c.g),c.b);
  float k = max(l - uThr, 0.0) / max(l, 1e-4);
  o = vec4(min(c*k, vec3(160.0)), 1);
}`, 'bright');
const pStreak = prog(VS, HEAD+`
uniform sampler2D uSrc; uniform vec2 uDir; uniform float uStep, uAtt;
void main(){
  vec2 px = 1.0/vec2(textureSize(uSrc,0));
  vec3 c = vec3(0); float ws = 0.0;
  for (int s=0;s<4;s++){ float w = pow(uAtt, uStep*float(s)); c += w*texture(uSrc, vUv + uDir*px*uStep*float(s)).rgb; ws += w; }
  o = vec4(c/ws, 1);
}`, 'streak');
const pBlur = prog(VS, HEAD+`
uniform sampler2D uSrc; uniform vec2 uDir;
void main(){
  vec2 px = uDir/vec2(textureSize(uSrc,0));
  vec3 c = texture(uSrc, vUv).rgb*0.2270270270;
  c += (texture(uSrc, vUv+px*1.3846153846).rgb + texture(uSrc, vUv-px*1.3846153846).rgb)*0.3162162162;
  c += (texture(uSrc, vUv+px*3.2307692308).rgb + texture(uSrc, vUv-px*3.2307692308).rgb)*0.0702702703;
  o = vec4(c,1);
}`, 'blur');
const pCopy = prog(VS, HEAD+`uniform sampler2D uSrc; uniform float uK; void main(){ o = vec4(texture(uSrc,vUv).rgb*uK,1); }`, 'copy');
const pRaw = prog(VS, HEAD+`uniform sampler2D uSrc; void main(){ o = texelFetch(uSrc, ivec2(gl_FragCoord.xy), 0); }`, 'raw');
const pFinal = prog(VS, HEAD+`
uniform sampler2D uHdr, uStreak, uB1, uB2, uDepth, uBlur; uniform float uExp, uTime, uNoPost, uFocus, uDof, uNear, uFar; uniform vec2 uRes;
vec3 bicubic(sampler2D t, vec2 uv){
  vec2 ts = vec2(textureSize(t,0)); vec2 p = uv*ts - 0.5; vec2 f = fract(p); p = floor(p);
  vec2 w0 = f*(-0.5+f*(1.0-0.5*f)), w1 = 1.0+f*f*(-2.5+1.5*f), w2 = f*(0.5+f*(2.0-1.5*f)), w3 = f*f*(-0.5+0.5*f);
  vec2 g0 = w0+w1, g1 = w2+w3; vec2 h0 = (w1/g0 - 0.5 + p)/ts, h1 = (w3/g1 + 1.5 + p)/ts;
  return (texture(t, vec2(h0.x,h0.y)).rgb*g0.x + texture(t, vec2(h1.x,h0.y)).rgb*g1.x)*g0.y + (texture(t, vec2(h0.x,h1.y)).rgb*g0.x + texture(t, vec2(h1.x,h1.y)).rgb*g1.x)*g1.y;
}
vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.,1.); }
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float linD(float d){ float z = d*2.0 - 1.0; return 2.0*uNear*uFar/(uFar + uNear - z*(uFar - uNear)); }
void main(){
  vec2 uv = vUv;
  vec2 cc = uv-0.5; float ca = 0.0012*dot(cc,cc)*4.0;
  vec3 c;
  c.r = texture(uHdr, uv + cc*ca).r; c.g = texture(uHdr, uv).g; c.b = texture(uHdr, uv - cc*ca).b;
  // depth of field for the close viewpoints: blend toward the half-resolution blur by circle of confusion
  if (uDof > 0.0){
    float z = linD(texture(uDepth, uv).r);
    float coc = clamp(abs(z - uFocus)/max(z, 0.05)*uDof, 0.0, 1.0);
    c = mix(c, bicubic(uBlur, uv), smoothstep(0.05, 0.9, coc));
  }
  if (uNoPost < 0.5) c += texture(uStreak, uv).rgb * 0.9;
  if (uNoPost < 0.5) c += texture(uB1, uv).rgb * 0.03 + bicubic(uB2, uv) * 0.04;
  c *= uExp;
  float vig = 1.0 - 0.25*dot(cc*vec2(1.0,0.8), cc*vec2(1.0,0.8))*2.2;
  c *= vig;
  c = aces(c);
  float lum = dot(c, vec3(0.2126,0.7152,0.0722));
  c = mix(vec3(lum), c, 0.92);
  c = mix(c, c*vec3(0.95,1.0,1.04), 1.0 - smoothstep(0.0, 0.35, lum));
  c = pow(c, vec3(1.0/2.2));
  float g = hash(gl_FragCoord.xy + fract(uTime*7.13)*917.0) - 0.5;
  c += g * 0.016 * (1.0 - c*0.6);
  o = vec4(c, 1);
}`, 'final');


/* ---------------- Lens diffraction glare ----------------
   The star around each sun glint is the lens aperture's diffraction pattern (its Fourier transform),
   integrated over wavelengths so the spikes carry faint rainbow tints. The bright image is convolved
   with it by FFT every frame, so the cost does not depend on how many glints there are. */
const GLARE_ON = !!extF32 && !Q.has('noglare');
const pFFTg = prog(VS, HEAD+`
uniform sampler2D uSrc; uniform int uP, uHoriz, uHalf; uniform float uSign;
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
void main(){
  ivec2 id = ivec2(gl_FragCoord.xy);
  int j = uHoriz==1 ? id.x : id.y;
  int k = j & (uP-1);
  int i = ((j - (j & (2*uP-1))) >> 1) + k;
  bool y1 = (j & uP) != 0;
  ivec2 a = uHoriz==1 ? ivec2(i, id.y) : ivec2(id.x, i);
  ivec2 b = uHoriz==1 ? ivec2(i+uHalf, id.y) : ivec2(id.x, i+uHalf);
  vec4 x0 = texelFetch(uSrc, a, 0), x1 = texelFetch(uSrc, b, 0);
  float ang = uSign*3.14159265359*float(k)/float(uP);
  vec2 w = vec2(cos(ang), sin(ang));
  vec4 wx = vec4(cmul(w,x1.xy), cmul(w,x1.zw));
  o = y1 ? x0-wx : x0+wx;
}`, 'fftGlare');
const pGSrc = prog(VS, HEAD+`
uniform sampler2D uSrc; uniform float uThr, uWhich;
void main(){
  vec2 px = 1.0/vec2(textureSize(uSrc,0));
  vec2 st = 1.0/vec2(textureSize(uSrc,0)) * vec2(textureSize(uSrc,0)) / vec2(textureSize(uSrc,0));
  vec3 c = vec3(0);
  // 4 bilinear taps = 16 texels, enough for the ~4-5x downscale
  for (int y=0;y<2;y++) for (int x=0;x<2;x++) c += texture(uSrc, vUv + (vec2(x,y)-0.5)*px*2.0).rgb;
  c *= 0.25;
  float l = max(max(c.r,c.g),c.b);
  c *= max(l - uThr, 0.0)/max(l, 1e-4);
  c = min(c, vec3(80000.0)) * 1e-3;
  o = uWhich < 0.5 ? vec4(c.r, 0.0, c.g, 0.0) : vec4(c.b, 0.0, 0.0, 0.0);
}`, 'glareSrc');
const pGMul = prog(VS, HEAD+`
uniform sampler2D uSrc, uK;
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
void main(){ ivec2 id = ivec2(gl_FragCoord.xy); vec4 a = texelFetch(uSrc,id,0), k = texelFetch(uK,id,0); o = vec4(cmul(a.xy,k.xy), cmul(a.zw,k.zw)); }`, 'glareMul');
const pGOut = prog(VS, HEAD+`
uniform sampler2D uA, uB; uniform vec2 uScale;
void main(){ ivec2 id = ivec2(gl_FragCoord.xy); vec4 a = texelFetch(uA,id,0), b = texelFetch(uB,id,0);
  o = vec4(max(vec3(a.x, a.z, b.x), 0.0)*1e3, 1); }`, 'glareOut');

function fft1(re, im, n, inv){
  for (let i=1,j=0;i<n;i++){ let bit=n>>1; for(;j&bit;bit>>=1) j^=bit; j^=bit;
    if(i<j){ let t=re[i]; re[i]=re[j]; re[j]=t; t=im[i]; im[i]=im[j]; im[j]=t; } }
  for (let len=2; len<=n; len<<=1){
    const ang=2*Math.PI/len*(inv?1:-1), wr=Math.cos(ang), wi=Math.sin(ang), h=len>>1;
    for (let i=0;i<n;i+=len){ let cr=1, ci=0;
      for (let k=0;k<h;k++){ const a=i+k, b=a+h; const xr=re[b]*cr-im[b]*ci, xi=re[b]*ci+im[b]*cr;
        re[b]=re[a]-xr; im[b]=im[a]-xi; re[a]+=xr; im[a]+=xi; const t=cr*wr-ci*wi; ci=cr*wi+ci*wr; cr=t; } } }
}
function fft2(re, im, w, h, inv){
  const rr=new Float32Array(w), ri=new Float32Array(w);
  for (let y=0;y<h;y++){ const o=y*w; rr.set(re.subarray(o,o+w)); ri.set(im.subarray(o,o+w)); fft1(rr,ri,w,inv); re.set(rr,o); im.set(ri,o); }
  const cr=new Float32Array(h), ci=new Float32Array(h);
  for (let x=0;x<w;x++){ for (let y=0;y<h;y++){ cr[y]=re[y*w+x]; ci[y]=im[y*w+x]; } fft1(cr,ci,h,inv); for (let y=0;y<h;y++){ re[y*w+x]=cr[y]; im[y*w+x]=ci[y]; } }
}
// Aperture: round lens with slightly flattened hexagonal edge, two hairline scratches and a few dust specks.
let PSF = null;
function buildPSF(){
  const n = 512, R = n*0.11, SS = 3, D = Math.PI/180;
  const re = new Float32Array(n*n), im = new Float32Array(n*n);
  const flats = [0,1,2,3,4,5].map(k => (15 + k*60)*D);
  const scratches = [ {a:21*D, o:0.12*R, w:2.2}, {a:22.5*D, o:-0.38*R, w:1.6}, {a:19*D, o:0.55*R, w:1.2}, {a:152*D, o:0.25*R, w:1.0}, {a:84*D, o:-0.2*R, w:0.8} ];
  const r2 = mulberry(3); const dust = Array.from({length:7}, () => ({x:(r2()-0.5)*1.4*R, y:(r2()-0.5)*1.4*R, r:(0.015+0.03*r2())*R}));
  for (let y=0;y<n;y++) for (let x=0;x<n;x++){
    let acc = 0;
    for (let sy=0; sy<SS; sy++) for (let sx=0; sx<SS; sx++){
      const dx = x - n/2 + (sx+0.5)/SS - 0.5, dy = y - n/2 + (sy+0.5)/SS - 0.5;
      if (dx*dx+dy*dy > R*R) continue;
      let ok = true;
      for (const f of flats) if (dx*Math.cos(f)+dy*Math.sin(f) > R*0.955) { ok=false; break; }
      if (ok) for (const sc of scratches) if (Math.abs(dx*Math.cos(sc.a)+dy*Math.sin(sc.a) - sc.o) < sc.w*0.5) { ok=false; break; }
      if (ok) for (const d of dust) if ((dx-d.x)**2+(dy-d.y)**2 < d.r*d.r) { ok=false; break; }
      if (ok) acc++;
    }
    re[y*n+x] = acc/(SS*SS);
  }
  fft2(re, im, n, n, false);
  const P = new Float32Array(n*n);
  for (let y=0;y<n;y++) for (let x=0;x<n;x++){ const i=((y+n/2)%n)*n + ((x+n/2)%n); P[y*n+x] = re[i]*re[i]+im[i]*im[i]; }
  // integrate over the visible spectrum: the pattern scales with wavelength
  const bands = [[440,[0.10,0.00,0.85]],[470,[0.00,0.15,1.00]],[500,[0.00,0.60,0.55]],[530,[0.05,1.00,0.15]],[560,[0.45,0.95,0.00]],[590,[0.95,0.55,0.00]],[620,[1.00,0.20,0.00]],[650,[0.70,0.05,0.00]]];
  const out = new Float32Array(n*n*3), sum=[0,0,0];
  const samp = (u,v) => { if (u<0||v<0||u>=n-1||v>=n-1) return 0; const x0=u|0, y0=v|0, fx=u-x0, fy=v-y0, i=y0*n+x0;
    return (P[i]*(1-fx)+P[i+1]*fx)*(1-fy) + (P[i+n]*(1-fx)+P[i+n+1]*fx)*fy; };
  for (const [lam, w] of bands){ const s = lam/550;
    for (let y=0;y<n;y++) for (let x=0;x<n;x++){ const v = samp(n/2+(x-n/2)/s, n/2+(y-n/2)/s)/(s*s); const o=(y*n+x)*3;
      out[o]+=v*w[0]; out[o+1]+=v*w[1]; out[o+2]+=v*w[2]; } }
  // phone lenses flare harder than an ideal aperture: lift the far field relative to the core
  for (let y=0;y<n;y++) for (let x=0;x<n;x++){ const r = Math.hypot(x-n/2, y-n/2); const w = 1 + 7*Math.min(1, Math.max(0, (r-3)/30)); const o=(y*n+x)*3; out[o]*=w; out[o+1]*=w; out[o+2]*=w; }
  for (let i=0;i<n*n;i++) for (let c=0;c<3;c++) sum[c]+=out[i*3+c];
  for (let i=0;i<n*n;i++) for (let c=0;c<3;c++) out[i*3+c]/=sum[c];
  PSF = { n, rgb: out };
}
let glareTick = 0, gX=0, gY=0, gSW=0, gSH=0, gA=[], gB=[], gK1=null, gK2=null;
function allocGlare(){
  for (const r of [...gA, ...gB]) { gl.deleteTexture(r.t); gl.deleteFramebuffer(r.fb); }
  if (gK1) { gl.deleteTexture(gK1); gl.deleteTexture(gK2); }
  gX = W>=H ? 512 : 256; gY = W>=H ? 256 : 512;
  // fit the frame inside ~75% of the grid so the spikes have room to fade before wrapping around
  const f = Math.min(gX*0.75/W, gY*0.75/H); gSW = Math.max(1, Math.round(W*f)); gSH = Math.max(1, Math.round(H*f));
  gA = [0,1].map(()=>rt(gX,gY,FFT_FMT,{filter:gl.NEAREST})); gB = [0,1].map(()=>rt(gX,gY,FFT_FMT,{filter:gl.NEAREST}));
  if (!PSF) buildPSF();
  // resample the PSF onto the grid: its full width spans ~1.15x the frame height
  const n = PSF.n, KH = 1.15*gSH, sc = n/KH;
  const kr = [0,1,2].map(()=>({re:new Float32Array(gX*gY), im:new Float32Array(gX*gY)}));
  const tot=[0,0,0];
  for (let gy=-gY/2; gy<gY/2; gy++) for (let gx=-gX/2; gx<gX/2; gx++){
    const u = n/2 + gx*sc, v = n/2 + gy*sc; if (u<0||v<0||u>=n-1||v>=n-1) continue;
    const x0=u|0, y0=v|0, fx=u-x0, fy=v-y0, i=((gy+gY)%gY)*gX + ((gx+gX)%gX);
    for (let c=0;c<3;c++){ const P = PSF.rgb, a=(y0*n+x0)*3+c;
      const val = (P[a]*(1-fx)+P[a+3]*fx)*(1-fy) + (P[a+n*3]*(1-fx)+P[a+n*3+3]*fx)*fy;
      kr[c].re[i] = val; tot[c] += val; } }
  const norm = 1/(gX*gY);
  for (let c=0;c<3;c++){ for (let i=0;i<gX*gY;i++) kr[c].re[i] *= norm/tot[c]; fft2(kr[c].re, kr[c].im, gX, gY, false); }
  const d1 = new Float32Array(gX*gY*4), d2 = new Float32Array(gX*gY*4);
  for (let i=0;i<gX*gY;i++){ d1[i*4]=kr[0].re[i]; d1[i*4+1]=kr[0].im[i]; d1[i*4+2]=kr[1].re[i]; d1[i*4+3]=kr[1].im[i]; d2[i*4]=kr[2].re[i]; d2[i*4+1]=kr[2].im[i]; }
  gK1 = tex(gX,gY,gl.RGBA32F,{filter:gl.NEAREST}); gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gX,gY,gl.RGBA,gl.FLOAT,d1);
  gK2 = tex(gX,gY,gl.RGBA32F,{filter:gl.NEAREST}); gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gX,gY,gl.RGBA,gl.FLOAT,d2);
}
function fftGrid(pair, sign){
  gl.useProgram(pFFTg.p); gl.uniform1i(pFFTg.u.uSrc,0); gl.uniform1f(pFFTg.u.uSign, sign);
  let src = 0;
  for (const [horiz, len] of [[1,gX],[0,gY]]){
    gl.uniform1i(pFFTg.u.uHoriz, horiz); gl.uniform1i(pFFTg.u.uHalf, len/2);
    for (let p=1; p<len; p<<=1){ target(pair[1-src]); bindT(0, pair[src].t); gl.uniform1i(pFFTg.u.uP, p); fullscreen(); src = 1-src; }
  }
  return src;
}
function renderGlare(){
  gl.disable(gl.BLEND);
  gl.useProgram(pGSrc.p); bindT(0, hdrRT.t); gl.uniform1i(pGSrc.u.uSrc,0); gl.uniform1f(pGSrc.u.uThr, 14.0);
  for (const [pair, which] of [[gA,0],[gB,1]]){
    gl.bindFramebuffer(gl.FRAMEBUFFER, pair[0].fb); gl.viewport(0,0,gX,gY); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(0,0,gSW,gSH); gl.uniform1f(pGSrc.u.uWhich, which); fullscreen();
  }
  const res = [];
  for (const [pair, K] of [[gA,gK1],[gB,gK2]]){
    let s = fftGrid(pair, -1);
    target(pair[1-s]); gl.useProgram(pGMul.p); bindT(0, pair[s].t); bindT(1, K); gl.uniform1i(pGMul.u.uSrc,0); gl.uniform1i(pGMul.u.uK,1); fullscreen(); s = 1-s;
    if (s !== 0) { /* fftGrid always starts from index 0: copy back */ target(pair[0]); gl.useProgram(pRaw.p); bindT(0,pair[1].t); gl.uniform1i(pRaw.u.uSrc,0); fullscreen(); }
    res.push(pair[fftGrid(pair, 1)]);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, streakRT.fb); gl.viewport(0,0,streakRT.w,streakRT.h);
  gl.useProgram(pGOut.p); bindT(0,res[0].t); bindT(1,res[1].t); gl.uniform1i(pGOut.u.uA,0); gl.uniform1i(pGOut.u.uB,1); fullscreen();
}
