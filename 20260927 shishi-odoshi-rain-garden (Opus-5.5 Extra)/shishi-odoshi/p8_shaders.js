/* ---------------- Shaders ---------------- */
// Shared fragment chunk: noise, overcast sky, sun shadow, height-field sky occlusion, underwater light, lantern light.
const COMMON = `
uniform vec3 uSunDir, uSunCol, uSkyZen, uSkyHor, uSkyGlow, uAmbSky, uAmbGround, uCamPos, uHazeCol;
uniform float uTime, uWet, uRain, uLantern, uCloud, uHazeK;
uniform highp sampler2DShadow uShadow; uniform mat4 uShadowVP; uniform float uShadowTexel;
uniform sampler2D uCaus, uRipN, uPeb, uNoise, uHF;
uniform vec2 uCausShift; uniform float uCausL;
uniform vec4 uRipRect, uHFRect; uniform vec2 uHFDepth;
uniform vec3 uSigA, uSigS;
uniform vec4 uLamp[4]; uniform int uNLamp;
const float PI = 3.14159265359;
const float IOR = 1.3335;

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float hash13(vec3 p){ p = fract(p*.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return textureLod(uNoise, (i + f + 0.5)/256.0, 0.0).r; }
float fbm(vec2 p){ float v=0., a=0.5; for(int i=0;i<4;i++){ v+=a*vnoise(p); p=p*2.03+17.1; a*=0.5; } return v/0.9375; }
float noise3(vec3 x){ vec3 p = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  vec2 uv = (p.xy + vec2(37.0,17.0)*p.z) + f.xy; vec2 rg = textureLod(uNoise, (uv + 0.5)/256.0, 0.0).rg; return mix(rg.x, rg.y, f.z); }
float fbm3(vec3 p){ float v=0., a=0.5; for(int i=0;i<3;i++){ v+=a*noise3(p); p=p*2.07+5.3; a*=0.5; } return v/0.875; }
float fresnel(float ci, float n){
  ci = clamp(ci, 0.0, 1.0);
  float st2 = (1.0-ci*ci)/(n*n); if (st2 >= 1.0) return 1.0;
  float ct = sqrt(1.0-st2);
  float rs = (ci - n*ct)/(ci + n*ct), rp = (n*ci - ct)/(n*ci + ct);
  return 0.5*(rs*rs + rp*rp);
}
// overcast sky: a bright, flat deck; the sun only shows through when the rain eases
vec3 skyBase(vec3 d){
  float e = max(d.y, 0.0), mu = dot(d, uSunDir);
  vec3 c = mix(uSkyHor, uSkyZen, pow(e, 0.55));
  c += uSkyGlow*(0.22*pow(max(mu,0.),5.) + 0.35*pow(max(mu,0.),48.));
  return c;
}
vec3 skyFull(vec3 d, float disk){
  vec3 c = skyBase(d);
  if (d.y > 0.0){
    vec2 q = d.xz/(d.y + 0.12)*0.8 + uTime*vec2(0.008, 0.003);
    float cl = fbm(q*1.5), cl2 = fbm(q*4.1 + 7.0);
    float deck = mix(0.8 + 0.4*cl, 1.0, 0.0);
    c *= mix(1.0, 0.78 + 0.34*cl + 0.1*cl2, uCloud*smoothstep(0.0, 0.25, d.y));
    float brk = smoothstep(0.58, 0.8, cl + 0.25*(1.0 - uCloud))*(1.0 - uCloud);
    c = mix(c, c*0.8 + uSkyGlow*0.25, brk*0.5);
    c += uSunCol*2.0*disk*smoothstep(0.99990, 0.99996, dot(d, uSunDir))*(1.0 - uCloud);
    c *= deck;
  }
  return c;
}
// ground-hugging mist: denser in rain and near the ground
vec3 applyHaze(vec3 c, vec3 dir, float dist, float y){
  float dens = uHazeK*(0.55 + 0.9*exp(-max(y, 0.0)*0.7));
  return mix(c, uHazeCol, 1.0 - exp(-dist*dens));
}
float shadowAt(vec3 P, vec3 N){
  vec3 q = P + N*0.02 + uSunDir*0.015;
  vec4 s = uShadowVP*vec4(q,1.0); vec3 c = s.xyz/s.w*0.5+0.5;
  if (c.x<0.0||c.y<0.0||c.x>1.0||c.y>1.0||c.z>1.0) return 1.0;
  float t = uShadowTexel*(1.5 + 3.0*uCloud), sum = 0.0;
  sum += texture(uShadow, vec3(c.xy, c.z));
  sum += texture(uShadow, vec3(c.xy + vec2( t, t*0.4), c.z));
  sum += texture(uShadow, vec3(c.xy + vec2(-t*0.4, t), c.z));
  sum += texture(uShadow, vec3(c.xy + vec2(-t,-t*0.4), c.z));
  sum += texture(uShadow, vec3(c.xy + vec2( t*0.4,-t), c.z));
  return sum*0.2;
}
// height of the tallest static surface at xz (top-down depth map rendered once at load)
float heightAt(vec2 xz){
  vec2 uv = (xz - uHFRect.xy)/uHFRect.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return -9.0;
  return uHFDepth.x - textureLod(uHF, uv, 0.0).r*uHFDepth.y;
}
// sky occlusion from the height field: horizon elevation in 8 directions (Clearwater has no scene; this is new)
float hfAO(vec3 P){
  float occ = 0.0;
  for (int i=0;i<8;i++){
    float a = float(i)*0.7854 + 0.39; vec2 d = vec2(cos(a), sin(a)); float s = 0.0;
    for (int j=0;j<3;j++){
      float r = j == 0 ? 0.05 : (j == 1 ? 0.15 : 0.42);
      float h = heightAt(P.xz + d*r) - P.y - 0.012;
      s = max(s, clamp(h*inversesqrt(h*h + r*r), 0.0, 1.0));
    }
    occ += s*s;
  }
  return 1.0 - occ/8.0;
}
vec3 ambientE(vec3 N){ return mix(uAmbGround, uAmbSky, 0.5 + 0.5*N.y); }
vec3 lampE(vec3 P, vec3 N){
  vec3 E = vec3(0.0);
  for (int i=0;i<4;i++){ if (i >= uNLamp) break;
    vec3 d = uLamp[i].xyz - P; float d2 = dot(d,d);
    E += uLamp[i].w*max(dot(N, d*inversesqrt(d2))*0.85 + 0.15, 0.0)/(d2*(1.0 + d2) + 0.02); }
  return E*vec3(1.0,0.56,0.24)*uLantern;
}
// what a glossy surface in the yard sees: the sky above the fence line, dark fence and grove below it
vec3 envRefl(vec3 R, float rough){
  vec3 wall = vec3(0.17,0.15,0.1)/PI*(uAmbSky*0.55 + uAmbGround);
  return mix(wall, skyBase(R), smoothstep(0.1, 0.5, R.y + rough*0.25));
}
vec3 underwaterE(vec3 P, vec3 N, float ao){
  float depth = max(-P.y, 0.0);
  vec3 sunT = refract(-uSunDir, vec3(0,1,0), 1.0/IOR);
  vec2 S = P.xz - sunT.xz*depth/max(-sunT.y, 0.05);
  float sh = shadowAt(vec3(S.x, 0.0, S.y), vec3(0,1,0));
  float Ts = 1.0 - fresnel(max(uSunDir.y, 0.0), IOR);
  vec3 caus = texture(uCaus, (P.xz - uCausShift)/uCausL, 1.0).rgb;
  float lap = texture(uRipN, (S - uRipRect.xy)/uRipRect.zw).a;
  caus *= clamp(1.0/(1.0 + 0.12*depth*lap), 0.45, 3.0);
  caus = mix(vec3(1.0), caus, smoothstep(0.0, 0.2, depth));
  vec3 SIG_T = uSigA + uSigS;
  vec3 Esun = uSunCol*Ts*exp(-SIG_T*depth/max(-sunT.y, 0.05))*caus*max(dot(N, -sunT), 0.0)*sh;
  vec3 Esky = uAmbSky*0.6*exp(-(uSigA + 0.4*uSigS)*depth*1.25)*ao*(0.55 + 0.45*N.y);
  return Esun + Esky + lampE(P, N)*exp(-SIG_T*depth*2.0);
}
vec3 bumpN(vec3 N, vec3 P, float h){
  vec3 dpdx = dFdx(P), dpdy = dFdy(P);
  float dhx = dFdx(h), dhy = dFdy(h);
  vec3 r1 = cross(dpdy, N), r2 = cross(N, dpdx);
  float det = dot(dpdx, r1);
  if (abs(det) < 1e-14) return N;
  vec3 g = sign(det)*(dhx*r1 + dhy*r2);
  return normalize(abs(det)*N - g);
}
`;

// Vertex shader for static geometry, the moving tube (uModel) and foliage: wind sway, ripple bobbing for floating leaves.
const SCENE_VS = `#version 300 es
precision highp float; precision highp sampler2D;
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec4 aCol; layout(location=3) in vec2 aUV; layout(location=4) in vec4 aAttr;
uniform mat4 uVP, uModel; uniform int uUseModel; uniform float uTime; uniform vec3 uWindV; uniform sampler2D uRipN; uniform vec4 uRipRect;
out vec3 vP; out vec3 vN; out vec4 vCol; out vec2 vUV; flat out vec4 vAttr;
vec3 windOffset(vec3 p, float w, float seed){
  float ph = dot(p.xz, vec2(1.3, 0.9));
  float g = 0.55 + 0.45*sin(uTime*0.43 + ph*0.3);
  float s = sin(uTime*1.7 + ph + seed*6.2831)*0.6 + sin(uTime*3.9 + ph*1.7 + seed*3.0)*0.4;
  vec3 d = vec3(uWindV.x, 0.0, uWindV.z);
  return (d*(0.5*g + 0.5*s) + vec3(-d.z, 0.0, d.x)*0.4*s + vec3(0.0, 0.3*length(d)*s, 0.0))*w*0.035;
}
void main(){
  vec3 p = aPos, n = aNrm;
  if (uUseModel == 1){ p = (uModel*vec4(p, 1.0)).xyz; n = mat3(uModel)*n; }
  if (aAttr.y < -0.5){ vec2 ruv = (p.xz - uRipRect.xy)/uRipRect.zw; p.y += textureLod(uRipN, ruv, 0.0).r; }
  else if (aAttr.y > 0.0) p += windOffset(p, aAttr.y, aAttr.z);
  vP = p; vN = n; vCol = aCol; vUV = aUV; vAttr = aAttr;
  gl_Position = uVP*vec4(p, 1.0);
}`;

const STATIC_FS = `#version 300 es
precision highp float; precision highp sampler2D; precision highp int;
in vec3 vP; in vec3 vN; in vec4 vCol; in vec2 vUV; flat in vec4 vAttr;
out vec4 o;
` + COMMON + `
float PX;
float fadeF(float f){ return clamp(1.5 - PX*f*2.0, 0.0, 1.0); }
vec3 pebbles(vec2 x, out float hgt){
  vec2 uv = x/0.62; vec2 dx = dFdx(uv), dy = dFdy(uv);
  float k = vnoise(x*0.85); float l = k*8.0; float ia = floor(l), f = fract(l);
  vec2 oa = sin(vec2(3.0,7.0)*ia), ob = sin(vec2(3.0,7.0)*(ia+1.0));
  vec3 a = textureGrad(uPeb, uv+oa, dx, dy).rgb, b = textureGrad(uPeb, uv+ob, dx, dy).rgb;
  float m = smoothstep(0.2, 0.8, f - 0.1*dot(a-b, vec3(1)));
  vec3 c = mix(a, b, m); hgt = dot(c, vec3(0.3,0.55,0.15));
  return c*vec3(1.0,1.0,0.94)*0.7;
}
// moss (sugigoke / hai-goke): cushions, tufts and fine stems; returns albedo and adds relief to h
vec3 moss(vec3 P, inout float h){
  vec3 Q = P + vec3(0.0, 0.0, P.y*0.7);
  float n1 = fbm(Q.xz*1.3 + P.y*1.1);
  float n2 = mix(0.5, vnoise(Q.xz*27.0 + P.y*19.0), fadeF(27.0));
  float n3 = mix(0.5, vnoise(Q.xz*85.0 + P.y*53.0), fadeF(85.0));
  float n4 = mix(0.5, vnoise(Q.xz*240.0 - P.y*151.0), fadeF(240.0));
  vec3 deep = vec3(0.03,0.064,0.011), mid = vec3(0.068,0.135,0.022), tip = vec3(0.13,0.21,0.036);
  vec3 c = mix(deep, mid, smoothstep(0.2, 0.7, n2*0.45 + n1*0.25 + n3*0.3));
  c = mix(c, tip, smoothstep(0.55, 0.95, n3*0.6 + n4*0.4)*0.5);
  c *= 0.82 + 0.36*n4;
  c = mix(c, c*vec3(1.25,1.1,0.72), smoothstep(0.62, 0.85, fbm(P.xz*0.5 + 3.0))*0.35);
  h += n2*0.006 + n3*0.003 + n4*0.0014;
  return c;
}
float drops(vec2 st, float sd){
  float h = 0.0;
  for (int k=0;k<2;k++){
    float sc = k == 0 ? 34.0 : 19.0;
    vec2 q = st*sc + float(k)*0.37; vec2 id = floor(q), f = fract(q) - 0.5;
    vec2 c = (vec2(hash12(id + 1.3 + sd), hash12(id + 7.1 + sd)) - 0.5)*0.62;
    float rad = (k == 0 ? 0.1 : 0.14) + 0.12*hash12(id + 3.7);
    float d = length((f - c)*vec2(1.0, 0.8))/rad;
    h = max(h, step(hash12(id + sd*13.0 + float(k)*5.0), uWet*(k == 0 ? 0.13 : 0.06))*max(0.0, 1.0 - d*d));
  }
  return h;
}
void main(){
#ifdef REFL
  if (vP.y < -0.01) discard;
#endif
  PX = length(fwidth(vP));
  int id = int(vAttr.x + 0.5);
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCamPos - vP);
  vec3 alb = vCol.rgb, emis = vec3(0.0);
  float rough = 0.8, spec = 0.035, trans = 0.0, ao = vCol.a, hao = 1.0, wetK = 1.0;
  float seed = fract(vAttr.z), flag = vAttr.w;
  if (id == 0){                                   // moss ground, bare soil, the pond's walls and bed
    float mossK = vCol.r, soil = vCol.g, sd = vUV.x;
    float h = 0.0; vec3 mc = moss(vP, h);
    float ns = vnoise(vP.xz*7.0), ns2 = mix(0.5, vnoise(vP.xz*38.0), fadeF(38.0));
    vec3 soilC = vec3(0.045,0.034,0.024)*(0.7 + 0.5*ns)*(0.8 + 0.4*ns2);
    float mk = smoothstep(0.3, 0.6, mossK + (fbm(vP.xz*3.0) - 0.5)*0.5);
    alb = mix(soilC, mc, mk);
    float lip = smoothstep(0.2, 0.03, sd)*smoothstep(-0.1, 0.03, sd);
    alb = mix(alb, mix(mc*0.55, soilC*0.7, smoothstep(0.07, 0.0, vP.y)), lip);
    h = h*mk + (ns2 - 0.5)*0.004*(1.0 - mk);
    if (vP.y < 0.03 && sd < 0.3){
      float d = -sd, hp; vec3 peb = pebbles(vP.xz*1.7, hp);
      vec3 silt = vec3(0.04,0.036,0.026)*(0.7 + 0.6*fbm(vP.xz*2.3));
      vec3 bed = mix(peb*0.5, silt, smoothstep(0.08, 0.4, d));
      float lf = smoothstep(0.68, 0.74, vnoise(vP.xz*8.0 + 4.0));
      bed = mix(bed, vec3(0.08,0.035,0.012), lf*0.6);
      float wall = smoothstep(0.03, -0.05, vP.y);
      alb = mix(alb*0.75, bed, wall);
      h = mix(h, hp*0.008, wall);
    }
    N = bumpN(N, vP, h);
    rough = mix(0.92, 0.7, 1.0 - mk); wetK = 0.6;
    hao = hfAO(vP);
  } else if (id == 1 || id == 6 || id == 7){      // rocks, the lantern's granite
    float kind = id == 1 ? flag : 0.0;
    vec3 q = vP*(id == 1 ? 2.2 : 3.4) + seed*37.0;
    float n1 = fbm3(q), n2 = noise3(q*4.3), n3 = mix(0.5, noise3(q*15.0), fadeF(15.0)), n4 = mix(0.5, noise3(q*45.0), fadeF(45.0));
    float h = n1*0.03 + n2*0.012 + n3*0.004 + n4*0.0015;
    if (kind > 2.5) h *= 0.35;
    alb = vCol.rgb*(0.66 + 0.6*n1 + 0.25*(n2-0.5))*(0.86 + 0.28*n3)*(0.9 + 0.2*n4);
    alb *= mix(0.6, 1.0, smoothstep(0.3, 0.9, ao));
    if (kind < 0.5){
      alb *= 0.92 + 0.3*step(0.74, noise3(vP*140.0))*fadeF(140.0);                     // feldspar and mica specks
      alb = mix(alb, vec3(0.3,0.32,0.27), smoothstep(0.55, 0.7, noise3(vP*5.0 + 3.0))*0.35);   // grey lichen crust
      float dots = smoothstep(0.62, 0.7, noise3(vP*75.0 + 1.7))*fadeF(75.0)*smoothstep(-0.3, 0.5, N.y)*smoothstep(0.3, 0.6, noise3(vP*7.0 + 9.0));
      alb = mix(alb, vec3(0.06,0.11,0.022), dots*0.6);                                     // speckled moss
    }
    float mm;
    if (kind > 0.5 && kind < 1.5) mm = smoothstep(0.18, 0.5, N.y + (n1 - 0.5)*0.8 + 0.05*(n2 - 0.5));
    else if (kind > 2.5) mm = smoothstep(0.8, 0.95, 1.0 - N.y + (n1 - 0.5)*0.35)*0.9;
    else if (kind > 1.5) mm = smoothstep(0.55, 0.9, N.y + (n1 - 0.5)*0.6)*0.35;
    else mm = smoothstep(0.3, 0.85, N.y + (n1 - 0.5)*0.8)*(id == 1 ? 0.3 : 0.55*smoothstep(0.45, 0.65, n2));
    mm *= smoothstep(0.0, 0.07, vP.y);
    float mh = 0.0; vec3 mc = moss(vP, mh);
    alb = mix(alb, mc, mm);
    h = mix(h, h*0.3 + mh + 0.005, mm);
    float band = smoothstep(0.1, 0.0, vP.y)*step(-0.03, vP.y);
    alb *= 1.0 - 0.4*band;
    if (vP.y < 0.0) alb = mix(alb, vec3(0.03,0.04,0.02)*(0.7 + 0.6*n1), 0.6*smoothstep(0.0, -0.2, vP.y));
    N = bumpN(N, vP, h);
    rough = mix(kind > 2.5 ? 0.5 : 0.72, 0.95, mm); if (mm > 0.5) wetK = 0.6;
    if (id == 7){                                 // lantern fire box: openings glow when lit
      if (seed > 0.5){ alb = vec3(0.015); emis = vec3(1.0,0.55,0.2)*1.6*uLantern*(0.92 + 0.08*sin(uTime*11.0 + vP.x*7.0)); wetK = 0.0; }
      else {
        float face = floor(vUV.x), fu = fract(vUV.x);
        float win = (mod(face, 3.0) < 0.5) ? step(abs(fu-0.5), 0.3)*step(0.14, vUV.y)*step(vUV.y, 0.86) : 0.0;
        float moon = (mod(face, 3.0) > 0.5 && mod(face, 3.0) < 1.5) ? smoothstep(0.23, 0.2, length(vec2(fu-0.5, (vUV.y-0.5)*0.9))) : 0.0;
        alb = mix(alb*(1.0 - 0.35*moon), vec3(0.012), win);
        emis = (win + moon*0.25)*vec3(1.0,0.55,0.2)*1.1*uLantern;
      }
    }
  } else if (id == 2 || id == 3 || id == 4){      // bamboo: fresh green (tube, posts, kakei), weathered fence culms, pale rails
    if (flag > 0.5){
      float rr = vUV.y;
      if (flag < 1.5){ float wall = smoothstep(0.8, 0.87, rr);
        alb = mix(vec3(0.24,0.2,0.11), vec3(0.4,0.36,0.22), wall)*(0.8 + 0.3*vnoise(vP.xz*90.0 + vP.y*50.0));
        if (id == 3) alb = mix(alb*0.45, vec3(0.1,0.095,0.085), 0.55); }
      else alb = vec3(0.4,0.36,0.23)*(id == 3 ? 0.5 : 1.0);
      rough = 0.65;
    } else {
      float u = vUV.y, f = fract(u), dn = min(f, 1.0 - f);
      float ridge = exp(-(dn*dn)/0.00018);
      float str = mix(0.5, vnoise(vec2(vUV.x*170.0, u*5.0)), fadeF(600.0));
      float str2 = vnoise(vec2(vUV.x*23.0 + seed*9.0, u*1.3));
      float h = ridge*0.0025 + (str - 0.5)*0.0004;
      if (id == 2){
        alb = vCol.rgb*(0.85 + 0.2*str2)*(0.94 + 0.12*str);
        alb = mix(alb, alb*vec3(1.35,1.25,0.8), smoothstep(0.1, 0.0, f)*0.6);                    // yellower just above a node
        alb = mix(alb, vec3(0.34,0.36,0.26), smoothstep(0.92, 0.99, f)*0.35);                    // waxy bloom below it
        alb = mix(alb, alb*0.55, ridge);
        float dr = drops(vec2(vUV.x*0.3, u*0.42), seed*7.0)*clamp(1.4 - PX*300.0, 0.0, 1.0);
        h += dr*0.0012;
        rough = mix(0.32, 0.18, uWet); spec = 0.045;
      } else if (id == 3){
        float blot = fbm(vec2(vUV.x*6.0 + seed*20.0, u*0.9));
        alb = vCol.rgb*(0.75 + 0.35*str2)*(0.9 + 0.2*str);
        alb = mix(alb, vec3(0.1,0.1,0.09), smoothstep(0.55, 0.8, blot)*0.45);                   // grey weathering
        alb = mix(alb, alb*0.45, ridge*0.8);
        alb = mix(alb, vec3(0.2,0.21,0.17), smoothstep(0.7, 0.75, vnoise(vec2(vUV.x*30.0, u*6.0) + seed*40.0))*0.5); // lichen spots
        alb *= mix(0.55, 1.0, smoothstep(0.02, 0.35, vP.y));                                      // damp foot
        rough = 0.62;
      } else {
        alb = vCol.rgb*(0.8 + 0.3*str2)*(0.92 + 0.16*str);
        alb = mix(alb, vec3(0.2,0.19,0.16), smoothstep(0.5, 0.8, fbm(vec2(vUV.x*5.0, u*1.1)))*0.35);
        alb = mix(alb, alb*0.5, ridge);
        rough = 0.55;
      }
      N = bumpN(N, vP, h);
    }
  } else if (id == 5){                            // shuro rope: twisted black fibre
    float tw = sin((vUV.x*6.2831 + vUV.y*420.0)*2.0);
    alb = vCol.rgb*(0.75 + 0.35*tw); N = bumpN(N, vP, tw*0.0005); rough = 0.85;
  } else if (id == 8){                            // inside of a culm: pale, wet, darkening into the tube
    alb = vCol.rgb*(0.85 + 0.2*vnoise(vec2(vUV.x*40.0, vUV.y*9.0)));
    rough = 0.3; spec = 0.03;
  } else if (id == 9){                            // tokusa: jointed stems, a black sheath with a pale rim at each joint
    float f = fract(vUV.y/0.072 + seed*3.0);
    float sheath = smoothstep(0.0, 0.015, f)*smoothstep(0.075, 0.06, f);
    float rim = smoothstep(0.075, 0.085, f)*smoothstep(0.1, 0.09, f);
    float rib = mix(0.5, 0.5 + 0.5*sin(vUV.x*6.2831*9.0), fadeF(200.0));
    alb = vCol.rgb*(0.8 + 0.3*rib);
    alb = mix(alb, vec3(0.012,0.012,0.01), sheath);
    alb = mix(alb, vec3(0.3,0.3,0.22), rim*0.8);
    rough = 0.42; spec = 0.04; trans = 0.15;
    hao = mix(hfAO(vP), 1.0, 0.6);
  } else if (id == 10){                           // grass blades: paler toward the tips, a little translucent
    alb = vCol.rgb*mix(0.7, 1.35, vUV.y)*(0.85 + 0.3*vnoise(vec2(vUV.y*20.0, seed*50.0)));
    rough = 0.7; spec = 0.02; trans = 0.5; wetK = 0.5;
    hao = mix(hfAO(vP), 1.0, 0.5);
  } else if (id == 12){                           // maple bark
    float n1 = vnoise(vec2(vUV.x*9.0, vUV.y*3.0) + seed*20.0);
    alb = vCol.rgb*(0.8 + 0.35*n1); rough = 0.85;
    N = bumpN(N, vP, n1*0.004);
  } else if (id == 13){ alb = vCol.rgb*(0.8 + 0.3*vnoise(vUV*30.0)); rough = 0.6; }
  if (uWet > 0.0 && wetK > 0.0 && vP.y > -0.005){
    float up = smoothstep(-0.3, 0.6, N.y), w = uWet*wetK;
    alb *= 1.0 - 0.3*w*(0.4 + 0.6*up);
    rough = mix(rough, rough*(wetK < 0.9 ? 0.85 : 0.5), w*(0.5 + 0.5*up));
  }
  float aoT = ao*hao;
  vec3 col;
#ifndef REFL
  if (vP.y < -0.004){
    col = alb/PI*underwaterE(vP, N, aoT) + emis;
  } else
#endif
  {
    float sh = uSunCol.r + uSunCol.g > 0.02 ? shadowAt(vP, N) : 0.0;
    vec3 L = uSunDir; float ndl = max(dot(N, L), 0.0);
    vec3 E = uSunCol*ndl*sh + ambientE(N)*aoT + lampE(vP, N);
    col = alb/PI*E + emis;
    vec3 H = normalize(L + V); float nh = max(dot(N,H), 0.0), nv = max(dot(N,V), 1e-3);
    float a = rough*rough, a2 = a*a, dd = nh*nh*(a2-1.0) + 1.0, D = a2/(PI*dd*dd), k = a*0.5;
    float Vis = 0.25/((ndl*(1.0-k)+k)*(nv*(1.0-k)+k));
    float Fs = spec + (1.0-spec)*pow(1.0 - max(dot(H,V), 0.0), 5.0);
    col += uSunCol*sh*ndl*min(D*Vis*Fs, 60.0);
    float Fv = spec + (1.0-spec)*pow(1.0 - nv, 5.0);
    col += envRefl(reflect(-V, N), rough)*Fv*pow(1.0 - rough, 3.0)*aoT*1.6*clamp(0.3 + nv*2.0, 0.0, 1.0);
    col += alb*ambientE(-N)*trans*0.3*aoT;
  }
  o = vec4(col, vAttr.y < -0.5 ? 1.0 : 0.0);
}`;

const SHADOW_FS = `#version 300 es
precision highp float;
out vec4 o;
void main(){ o = vec4(1.0); }`;

// Leaf cards and fern fronds: alpha-tested atlas rects, coloured per species, lit with wrap diffuse and sky transmission.
const FOLIAGE_FS = `#version 300 es
precision highp float; precision highp sampler2D; precision highp int;
in vec3 vP; in vec3 vN; in vec4 vCol; in vec2 vUV; flat in vec4 vAttr;
out vec4 o;
uniform sampler2D uAtlas; uniform vec4 uAtlasRect[6];
` + COMMON + `
void main(){
  int sp = int(vAttr.x + 0.5);
  vec4 R = uAtlasRect[sp];
  vec2 uv = R.xy + clamp(vUV, 0.002, 0.998)*R.zw;
  vec2 gdx = dFdx(vUV)*R.zw, gdy = dFdy(vUV)*R.zw;
  vec4 t = textureGrad(uAtlas, uv, gdx, gdy);
  float lod = log2(max(max(length(gdx), length(gdy))*2048.0, 1e-4));
  float a = t.a*(1.0 + max(lod, 0.0)*0.3);
  if (a < 0.5) discard;
#ifdef SHADOW
  o = vec4(1.0);
#else
#ifdef REFL
  if (vP.y < -0.01) discard;
#endif
  float lum = t.r, var = t.g, r1 = vCol.x, r2 = vCol.y;
  vec3 alb; float trans = 0.5, rough = 0.55;
  if (sp <= 1){
    alb = mix(vec3(0.018,0.042,0.009), vec3(0.07,0.13,0.02), lum)*(0.82 + 0.3*var)*(0.9 + 0.2*r1);
    alb = mix(alb, alb*vec3(1.25,1.15,0.7), smoothstep(0.75, 1.0, vUV.y)*0.5);
    trans = 0.7; rough = 0.45;
  } else if (sp == 2){
    float hue = fract(var*0.7 + r1*0.6);
    vec3 green = mix(vec3(0.04,0.09,0.014), vec3(0.08,0.13,0.02), var);
    vec3 aut = hue < 0.3 ? mix(vec3(0.5,0.25,0.012), vec3(0.6,0.36,0.03), hue/0.3) : mix(vec3(0.5,0.04,0.012), vec3(0.32,0.015,0.008), (hue - 0.3)/0.7);
    alb = mix(green, aut, smoothstep(0.25, 0.55, r2*0.7 + var*0.3))*(0.6 + 0.55*lum);
    trans = 1.0;
  } else if (sp == 3){
    alb = mix(vec3(0.035,0.06,0.012), vec3(0.1,0.14,0.03), lum)*(0.85 + 0.3*var); trans = 0.8;
  } else if (sp == 4){
    alb = mix(vec3(0.42,0.03,0.01), vec3(0.62,0.2,0.02), fract(r1*1.7 + var*0.3))*(0.65 + 0.4*lum); trans = 0.6; rough = 0.4;
  } else {
    alb = vec3(0.3,0.24,0.15)*(0.7 + 0.35*lum)*(0.85 + 0.25*r1); trans = 0.4; rough = 0.45;
  }
  vec3 N = normalize(vN);
  vec3 V = normalize(uCamPos - vP);
  float ao = vCol.w;
  float hao = sp <= 1 ? mix(hfAO(vP), 1.0, 0.35) : 1.0;
  if (uWet > 0.0){ alb *= 1.0 - 0.2*uWet; rough = mix(rough, 0.38, uWet); }
  float sh = uSunCol.r + uSunCol.g > 0.02 ? shadowAt(vP, N*0.5) : 0.0;
  float wrap = max(dot(N, uSunDir)*0.7 + 0.3, 0.0);
  vec3 E = uSunCol*wrap*sh + ambientE(N)*ao*hao + lampE(vP, N);
  vec3 col = alb/PI*E;
  col += alb*(uSunCol*sh*pow(max(dot(-V, uSunDir), 0.0), 4.0)*0.5 + uAmbSky*0.12)*trans*ao*hao;
  float nv = max(abs(dot(N, V)), 1e-3), Fv = 0.04 + 0.96*pow(1.0 - nv, 5.0);
  col += envRefl(reflect(-V, N), rough)*Fv*pow(1.0 - rough, 3.0)*ao*hao*clamp(0.2 + nv*2.0, 0.0, 1.0);
  o = vec4(col, vAttr.y < -0.5 ? 1.0 : 0.0);
#endif
}`;

const SKY_FS = HEAD + `
uniform vec3 uR, uU, uF; uniform float uTanF, uAspect, uMirror;
` + COMMON + `
void main(){
  vec2 ndc = vUv*2.0 - 1.0;
  vec3 rd = normalize(uF + ndc.x*uAspect*uTanF*uR + ndc.y*uTanF*uU);
  if (uMirror > 0.5) rd.y = -rd.y;
  o = vec4(skyFull(rd, 1.0 - uMirror), 0.0);
}`;

// Water: Clearwater's main water shader, as a compositing pass over the rendered garden.
// Reflections come from a planar mirror render; refraction reads the garden image behind the surface.
// Added here: raindrop rings (procedural, on top of the simulated ones) and splash specks.
const WATER_FS = HEAD + `
uniform sampler2D uSurf, uScene, uDepth, uRefl;
uniform vec3 uR, uU, uF; uniform float uTanF, uAspect, uNear, uFar, uL, uAmp;
` + COMMON + `
vec4 texBS(sampler2D t, vec2 uv){
  vec2 ts = vec2(textureSize(t,0)); vec2 p = uv*ts - 0.5; vec2 f = fract(p); p = floor(p);
  vec2 f2 = f*f, f3 = f2*f;
  vec2 w0 = (-f3 + 3.0*f2 - 3.0*f + 1.0)/6.0, w1 = (3.0*f3 - 6.0*f2 + 4.0)/6.0;
  vec2 w2 = (-3.0*f3 + 3.0*f2 + 3.0*f + 1.0)/6.0, w3 = f3/6.0;
  vec2 g0 = w0+w1, g1 = w2+w3; vec2 h0 = (w1/g0 - 0.5 + p)/ts, h1 = (w3/g1 + 1.5 + p)/ts;
  return (texture(t, vec2(h0.x,h0.y))*g0.x + texture(t, vec2(h1.x,h0.y))*g1.x)*g0.y
       + (texture(t, vec2(h0.x,h1.y))*g0.x + texture(t, vec2(h1.x,h1.y))*g1.x)*g1.y;
}
float linDepth(float d){ float z = d*2.0 - 1.0; return 2.0*uNear*uFar/(uFar + uNear - z*(uFar - uNear)); }
vec3 rayDir(vec2 uv){ vec2 ndc = uv*2.0 - 1.0; return normalize(uF + ndc.x*uAspect*uTanF*uR + ndc.y*uTanF*uU); }
float sceneT(vec2 uv, vec3 rd){ float d = texture(uDepth, uv).r; return d >= 1.0 ? 1e6 : linDepth(d)/dot(rd, uF); }
// raindrop rings: one drop per cell per cycle in three layers of cells; returns the surface slope and a splash term
vec3 rainRings(vec2 p, float fw){
  vec2 g = vec2(0.0); float spk = 0.0;
  float fade = smoothstep(0.02, 0.006, fw);
  if (fade <= 0.0 || uRain <= 0.01) return vec3(0.0);
  for (int k=0;k<3;k++){
    float sc = 7.0 + 4.0*float(k);
    vec2 q = p*sc + vec2(float(k)*0.37, float(k)*0.71);
    vec2 id = floor(q), f = fract(q) - 0.5;
    float h1 = hash12(id + float(k)*19.1);
    float rate = 0.8 + 0.7*hash12(id + 5.5);
    float cyc = uTime*rate + hash12(id + 1.1);
    float ph = fract(cyc);
    float on = step(hash12(id + floor(cyc)*3.7 + float(k)), uRain*0.85);
    vec2 c = (vec2(hash12(id + 3.7 + floor(cyc)), hash12(id + 9.2 + floor(cyc))) - 0.5)*0.4;
    vec2 dv = (f - c)/sc; float d = length(dv);
    float rr = ph*0.3/sc, xm = d - rr, w = 0.0045 + 0.004*ph;
    float env = (1.0 - ph)*(1.0 - ph)*on;
    float s = env*0.0005*(-2.0*xm/(w*w))*exp(-xm*xm/(w*w));
    g += s*dv/max(d, 1e-5);
    spk += on*step(ph, 0.05)*smoothstep(0.006, 0.0, d);
  }
  return vec3(g*fade, spk*fade);
}
void main(){
  vec3 rd = rayDir(vUv);
  vec4 sc = texture(uScene, vUv);
  float tS = sceneT(vUv, rd);
  vec3 col = sc.rgb;
  float tW = rd.y < -1e-5 ? -uCamPos.y/rd.y : 1e6;
  float tF = tS;
  if (tW < tS && sc.a < 0.5 && uCamPos.y > 0.0){
    // ---- surface intersection (height field, fixed-point) ----
    vec3 wd = rd; wd.y = min(wd.y, -0.0015); wd = normalize(wd);
    float t = -uCamPos.y/wd.y;
    vec2 xz; vec4 A, B, R;
    const mat2 M = mat2(0.8, -0.6, 0.6, 0.8);
    const float SC = 0.41, WB = 0.10;
    for (int i=0;i<3;i++){
      xz = uCamPos.xz + wd.xz*t;
      A = texture(uSurf, xz/uL)*uAmp; B = texture(uSurf, (M*xz)/(uL*SC) + 0.37)*uAmp;
      R = texture(uRipN, (xz - uRipRect.xy)/uRipRect.zw);
      t = (A.x + WB*SC*B.x + R.x - uCamPos.y)/wd.y;
    }
    vec3 P = uCamPos + wd*t;
    A = texBS(uSurf, P.xz/uL)*uAmp; B = texBS(uSurf, (M*P.xz)/(uL*SC) + 0.37)*uAmp;
    vec2 slope = A.yz + WB*(transpose(M)*B.yz) + R.yz;
    float fw = length(fwidth(P.xz));
    vec3 rr = rainRings(P.xz, fw);
    slope += rr.xy;
    float var = (max(A.w - dot(A.yz,A.yz), 0.0) + WB*WB*max(B.w - dot(B.yz,B.yz), 0.0))*uAmp + uRain*0.0006;
    vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));
    vec3 v = -wd; float nv = dot(n, v);
    if (nv < 0.02){ n = normalize(n + v*(0.02 - nv)); nv = dot(n, v); }
    float F = fresnel(nv, IOR);
    float sh = uSunCol.r + uSunCol.g > 0.02 ? shadowAt(P, vec3(0,1,0)) : 0.0;
    // ---- reflection: planar mirror image, displaced by the surface slope ----
    vec3 dn = n - vec3(0,1,0);
    vec2 ruv = clamp(vUv + vec2(dot(dn, uR), dot(dn, uU))*0.22, 0.001, 0.999);
    vec3 refl = texture(uRefl, ruv).rgb;
    // ---- refraction: the garden image behind the surface, displaced by the slope and the depth below ----
    vec3 tr = refract(wd, n, 1.0/IOR);
    vec3 Ps = uCamPos + rd*min(tS, t + 20.0);
    float D = max(P.y - Ps.y, 0.0);
    vec2 uvR = clamp(vUv + vec2(dot(dn, uR), dot(dn, uU))*0.5*min(D, 0.6)/(1.0 + t*0.04), 0.001, 0.999);
    vec3 rdR = rayDir(uvR); float tSR = sceneT(uvR, rdR); vec3 PsR = uCamPos + rdR*min(tSR, t + 20.0);
    if (PsR.y > P.y + 0.01 || texture(uScene, uvR).a > 0.5){ uvR = vUv; PsR = Ps; }
    vec3 sceneUnder = texture(uScene, uvR).rgb;
    float s = min(length(PsR - P), 6.0);
    vec3 SIG_T = uSigA + uSigS;
    vec3 Tv = exp(-SIG_T*s);
    vec3 sunT = refract(-uSunDir, vec3(0,1,0), 1.0/IOR);
    float Ts = 1.0 - fresnel(max(uSunDir.y, 0.0), IOR);
    float depthHere = max(P.y - PsR.y, 0.0);
    float cosS = dot(sunT, -tr);
    float g = 0.8; float ph = (1.0-g*g)/(4.0*PI*pow(1.0 + g*g - 2.0*g*cosS, 1.5));
    vec3 Lmid = uSunCol*Ts*exp(-SIG_T*depthHere*0.5/max(-sunT.y, 0.05))*(ph + 0.02)*sh + uAmbSky*0.6*exp(-uSigA*depthHere*0.6)/(4.0*PI);
    vec3 Lin = uSigS/SIG_T*Lmid*(1.0 - Tv)*3.2;
    vec3 under = sceneUnder*Tv + Lin;
    // suspended specks at three depths (Clearwater)
    for (int k=0;k<3;k++){
      float dz = 0.05 + 0.08*float(k);
      float tt = dz/max(-tr.y, 0.05);
      vec2 q = (P.xz + tr.xz*tt)*60.0 + vec2(uTime*(0.03 + 0.02*float(k)), uTime*0.015) + float(k)*17.0;
      vec2 id = floor(q), f = fract(q) - 0.5;
      float r = hash12(id + float(k)*13.1);
      vec2 of = vec2(hash12(id + 3.1), hash12(id + 7.7)) - 0.5;
      float fwq = fwidth(q.x) + fwidth(q.y);
      float dot_ = smoothstep(0.10 + fwq, 0.0, length(f - of*0.6))*step(0.99, r)*step(tt, s);
      float fade = exp(-SIG_T.g*tt*2.0)*smoothstep(1.2, 0.3, fwq);
      under += dot_*fade*(uSunCol*Ts*sh + uAmbSky*0.15)*0.02*mix(vec3(0.9,1.0,0.9), vec3(0.45,0.4,0.3), step(0.995, r));
    }
    // ---- sun glints: Beckmann lobe widened by sub-pixel slope variance (LEAN-style) ----
    float a2 = 0.00012 + 1.2*var;
    vec3 h = normalize(v + uSunDir);
    float nh = max(dot(n, h), 0.0), nl = max(dot(n, uSunDir), 0.0);
    float c2 = max(nh*nh, 1e-4); float tan2 = (1.0 - c2)/c2;
    float Db = exp(-tan2/a2)/(PI*a2*c2*c2);
    float Vis = 0.5/(nl*sqrt(nv*nv*(1.0 - a2) + a2) + nv*sqrt(nl*nl*(1.0 - a2) + a2) + 1e-5);
    float Fh = fresnel(max(dot(h, v), 0.0), IOR);
    vec3 spec = uSunCol*min(Db*Vis*Fh*nl, 12000.0)*sh;
    col = F*refl + (1.0 - F)*under + spec;
    col += rr.z*(uAmbSky*0.35 + uSunCol*0.2);
    tF = t;
  }
  if (tF < 1e5) col = applyHaze(col, rd, tF, uCamPos.y + rd.y*tF);
  o = vec4(max(col, 0.0), 1.0);
}`;

// Water streams (the kakei trickle and the tube's pour): camera-facing ribbons shaded as a round jet of water.
const STREAM_FS = `#version 300 es
precision highp float; precision highp sampler2D; precision highp int;
in vec3 vP; in vec3 vN; in vec4 vCol; in vec2 vUV; flat in vec4 vAttr;
out vec4 o;
` + COMMON + `
void main(){
  float u = vUV.x, v = vUV.y, cover = vCol.x, speed = vAttr.w;
  float cx = u*2.0 - 1.0;
  vec3 V = normalize(uCamPos - vP), side = normalize(vN);
  vec3 nrm = normalize(side*cx + V*sqrt(max(1.0 - cx*cx, 0.0)));
  float n = vnoise(vec2(u*5.0 + vAttr.z*10.0, v*22.0 - uTime*speed*7.0))*0.6 + vnoise(vec2(u*11.0 + 3.0, v*55.0 - uTime*speed*13.0))*0.4;
  float core = 1.0 - cx*cx;
  float F = fresnel(max(dot(nrm, V), 0.0), IOR);
  vec3 refl = envRefl(reflect(-V, nrm), 0.05);
  vec3 body = uAmbSky*0.035 + lampE(vP, nrm)*0.05;
  vec3 col = refl*(0.12 + 0.88*F) + body*core + uAmbSky*0.12*smoothstep(0.62, 0.9, n)*core;
  vec3 H = normalize(uSunDir + V); col += uSunCol*pow(max(dot(nrm, H), 0.0), 120.0)*2.0;
  float a = clamp((0.3 + 0.55*n)*smoothstep(0.0, 0.5, core) + F*0.5, 0.0, 1.0)*cover;
  if (a < 0.04) discard;
  col = applyHaze(col, -V, length(uCamPos - vP), vP.y);
  o = vec4(col*a, a);
}`;

// Rain: streaks generated entirely in the vertex shader from gl_VertexID, wrapped in a box that follows the camera.
// Drops stop at the height field, so no rain falls under the lantern roof or through the pond surface.
const RAIN_VS = `#version 300 es
precision highp float; precision highp sampler2D;
uniform mat4 uVP; uniform vec3 uCamPos, uCamF, uWindV; uniform float uTime, uRain, uPx;
uniform sampler2D uHF; uniform vec4 uHFRect; uniform vec2 uHFDepth;
out float vA; out vec2 vQ; out vec3 vP;
float h1(float n){ return fract(sin(n*12.9898)*43758.5453); }
float heightAt(vec2 xz){ vec2 uv = (xz - uHFRect.xy)/uHFRect.zw; if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.1; return uHFDepth.x - textureLod(uHF, uv, 0.0).r*uHFDepth.y; }
void main(){
  int id = gl_VertexID/6, cv = gl_VertexID - id*6;
  float fi = float(id);
  vec3 box = vec3(9.0, 6.0, 9.0);
  vec3 rnd = vec3(h1(fi*1.13 + 0.1), h1(fi*2.71 + 0.3), h1(fi*0.73 + 0.7));
  float speed = 6.0 + 2.5*h1(fi*3.3 + 0.9);
  vec3 vel = vec3(uWindV.x*0.8, -speed, uWindV.z*0.8);
  vec3 center = uCamPos + uCamF*3.5;
  vec3 p = rnd*box + vel*uTime;
  p = center + mod(p - center + box*0.5, box) - box*0.5;
  float ground = max(heightAt(p.xz), 0.0);
  float alive = step(h1(fi*5.17 + 0.2), uRain)*step(ground, p.y);
  vec3 a = p, b = p - normalize(vel)*speed*0.024;
  vec4 A = uVP*vec4(a, 1.0), B = uVP*vec4(b, 1.0);
  vec2 sa = A.xy/max(A.w, 1e-3), sb = B.xy/max(B.w, 1e-3);
  vec2 dir = normalize(sb - sa + vec2(1e-6, 0.0)), nrm = vec2(-dir.y, dir.x);
  int end = (cv == 2 || cv == 4 || cv == 5) ? 1 : 0;
  float sd = (cv == 1 || cv == 2 || cv == 4) ? 1.0 : -1.0;
  vec4 P = end == 1 ? B : A;
  float dist = length(p - uCamPos);
  float wpx = max(0.9, 0.0012/(dist*uPx));      // at least ~1 px wide; drops near the lens get wider
  P.xy += nrm*sd*wpx*uPx*P.w*1.0;
  gl_Position = alive > 0.5 && A.w > 0.05 ? P : vec4(2.0, 2.0, 2.0, 1.0);
  vA = (0.55 + 0.45*h1(fi*7.7))/wpx*smoothstep(1.3, 3.0, dist)*smoothstep(9.0, 4.5, dist);
  vQ = vec2(sd, float(end)); vP = p;
}`;
const RAIN_FS = `#version 300 es
precision highp float;
in float vA; in vec2 vQ; in vec3 vP;
uniform vec3 uAmbSky, uHazeCol, uLampPos; uniform float uLantern;
out vec4 o;
void main(){
  float across = 1.0 - abs(vQ.x);
  float along = smoothstep(0.0, 0.35, vQ.y)*smoothstep(1.0, 0.65, vQ.y) + 0.35;
  vec3 c = (uAmbSky*0.012 + uHazeCol*0.03 + vec3(1.0,0.56,0.24)*uLantern*0.06/(1.0 + dot(vP - uLampPos, vP - uLampPos)*3.0));
  float a = vA*across*along*0.5;
  o = vec4(c*a, 0.0);
}`;

// Splash crowns where drops hit stone, moss and bamboo (placed on the height field, one short life per cycle).
const SPLASH_VS = `#version 300 es
precision highp float; precision highp sampler2D;
uniform mat4 uVP; uniform vec3 uCamPos, uCamR, uCamU; uniform float uTime, uRain;
uniform sampler2D uHF; uniform vec4 uHFRect; uniform vec2 uHFDepth;
out vec2 vQ; out float vPh; out vec3 vP;
float h1(float n){ return fract(sin(n*12.9898)*43758.5453); }
void main(){
  int id = gl_VertexID/6, cv = gl_VertexID - id*6;
  float fi = float(id);
  float rate = 1.4 + 1.2*h1(fi*0.37);
  float cyc = uTime*rate + h1(fi*1.91);
  float ph = fract(cyc), k = floor(cyc);
  // a new spot each cycle, biased toward the part of the yard in front of the camera
  vec2 r = vec2(h1(fi*3.1 + k*7.13), h1(fi*5.3 + k*3.71));
  vec2 xz = uHFRect.xy + r*uHFRect.zw;
  vec2 uv = r;
  float y = uHFDepth.x - textureLod(uHF, uv, 0.0).r*uHFDepth.y;
  float dist = length(vec3(xz.x, y, xz.y) - uCamPos);
  float alive = step(h1(fi*9.7 + k), uRain)*step(0.01, y)*step(ph, 0.16)*step(dist, 7.5);
  vec2 q = vec2(cv == 1 || cv == 2 || cv == 4 ? 1.0 : -1.0, cv == 2 || cv == 4 || cv == 5 ? 1.0 : 0.0);
  float s = 0.008 + 0.01*h1(fi*2.2);
  vec3 p = vec3(xz.x, y, xz.y) + uCamR*q.x*s + vec3(0.0, 1.0, 0.0)*q.y*s*1.2;
  gl_Position = alive > 0.5 ? uVP*vec4(p, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
  vQ = q; vPh = ph/0.16; vP = p;
}`;
const SPLASH_FS = `#version 300 es
precision highp float;
in vec2 vQ; in float vPh; in vec3 vP;
uniform vec3 uAmbSky, uHazeCol;
out vec4 o;
void main(){
  // a crown: a thin arc that rises and spreads, plus two flying beads
  float r = length(vec2(vQ.x, (vQ.y - 0.05)*1.6));
  float ring = smoothstep(0.16, 0.0, abs(r - (0.25 + 0.6*vPh)))*step(0.02, vQ.y)*smoothstep(1.0, 0.4, vQ.y);
  vec2 b1 = vec2(-0.45 - 0.3*vPh, 0.35 + 0.5*vPh - vPh*vPh*0.6), b2 = vec2(0.5 + 0.3*vPh, 0.4 + 0.45*vPh - vPh*vPh*0.6);
  float beads = smoothstep(0.1, 0.0, length(vQ - b1)) + smoothstep(0.1, 0.0, length(vQ - b2));
  float a = (ring*0.7 + beads)*(1.0 - vPh)*0.35;
  vec3 c = uAmbSky*0.012 + uHazeCol*0.015;
  o = vec4(c*a, a*0.1);
}`;

// Flying droplets (pour splash, the strike): short streaks built on the CPU.
const DROP_FS = `#version 300 es
precision highp float; precision highp sampler2D; precision highp int;
in vec3 vP; in vec3 vN; in vec4 vCol; in vec2 vUV; flat in vec4 vAttr;
out vec4 o;
` + COMMON + `
void main(){
  float across = 1.0 - abs(vUV.x*2.0 - 1.0), a = across*vCol.x;
  vec3 c = uAmbSky*0.035 + uHazeCol*0.04 + lampE(vP, vec3(0,1,0))*0.02;
  o = vec4(c*a, a*0.4);
}`;
