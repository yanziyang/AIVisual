/* ---------------- Shaders ---------------- */
// Shared fragment-shader chunk: noise, sky, sun shadow, underwater light (caustics + absorption), lanterns.
const COMMON = `
uniform vec3 uSunDir, uSunCol, uSkyZen, uSkyHor, uSkyGlow, uAmbSky, uAmbGround, uCamPos;
uniform float uTime, uSnow, uWet, uLantern, uCloud, uHazeK;
uniform vec4 uSeason;
uniform highp sampler2DShadow uShadow; uniform mat4 uShadowVP; uniform float uShadowTexel;
uniform sampler2D uCaus, uRipN, uPeb, uNoise;
uniform vec2 uCausShift; uniform float uCausL;
uniform vec4 uRipRect;
uniform vec3 uSigA, uSigS;
uniform vec4 uKoiP[16]; uniform vec2 uKoiD[16]; uniform int uNKoi;
uniform vec4 uLamp[8]; uniform int uNLamp;
const float PI = 3.14159265359;
const float IOR = 1.3335;

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float hash13(vec3 p){ p = fract(p*.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
// value noise from a 256x256 random texture (one fetch per octave keeps the shaders small and fast to compile)
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
// sky: gradient + sun glow; the horizon warms toward the sun when it is low
vec3 skyBase(vec3 d){
  float e = max(d.y, 0.0), mu = dot(d, uSunDir);
  vec3 c = mix(uSkyHor, uSkyZen, pow(e, 0.45));
  float side = max(dot(normalize(d.xz + 1e-5), normalize(uSunDir.xz + 1e-5)), 0.0);
  c += uSkyGlow*(0.22*pow(max(mu,0.),6.) + 0.3*pow(max(mu,0.),48.) + 1.2*pow(max(mu,0.),1600.));
  c += uSkyGlow*0.3*pow(side, 3.0)*exp(-e*7.0);
  return c;
}
float ridge(float a){ return 0.075 + 0.03*sin(a*2.0+0.7) + 0.02*sin(a*5.0+2.1) + 0.009*sin(a*11.0+0.3) + 0.004*sin(a*23.0+1.7); }
vec3 skyFull(vec3 d, float disk){
  vec3 c = skyBase(d);
  // soft clouds
  if (d.y > 0.0){
    vec2 q = d.xz/(d.y + 0.1)*0.8 + uTime*vec2(0.004, 0.0015);
    float cl = fbm(q*1.4) - 0.5*(1.0 - uCloud) + 0.18;
    float cov = smoothstep(0.35, 0.75, cl)*smoothstep(0.0, 0.15, d.y);
    vec3 cc = mix(uSkyHor*1.08, uSkyHor*0.55 + uSkyZen*0.2, uCloud*0.8) + uSkyGlow*0.12*pow(max(dot(d,uSunDir),0.),4.0);
    c = mix(c, cc, cov*(0.55 + 0.4*uCloud));
  }
  // shakkei: distant blue ranges beyond the garden (Clearwater's headland silhouette, recoloured)
  float a = atan(d.z, d.x);
  float r1 = ridge(a) + 0.004*(vnoise(vec2(a*240.0, 0.0))-0.5);
  float r2 = 0.6*ridge(a*1.7+2.0) - 0.01 + 0.004*(vnoise(vec2(a*300.0, 5.0))-0.5);
  float w = fwidth(d.y)*1.2 + 2e-4;
  vec3 far = mix(uSkyHor, uSkyZen, 0.25)*0.82, near = mix(uSkyHor, uSkyZen, 0.35)*0.6 + vec3(0.0,0.01,0.0);
  c = mix(c, far, smoothstep(r1+w, r1-w, d.y));
  c = mix(c, near, smoothstep(r2+w, r2-w, d.y));
  c += uSunCol*3.0*disk*smoothstep(0.99994, 0.99998, dot(d, uSunDir));
  return c;
}
vec3 applyHaze(vec3 c, vec3 dir, float dist){
  float h = 1.0 - exp(-dist*uHazeK);
  vec3 hc = skyBase(normalize(vec3(dir.x, 0.04, dir.z)))*0.92;
  return mix(c, hc, h);
}
float shadowAt(vec3 P, vec3 N){
  vec3 q = P + N*0.05 + uSunDir*0.03;
  vec4 s = uShadowVP*vec4(q,1.0); vec3 c = s.xyz/s.w*0.5+0.5;
  if (c.x<0.0||c.y<0.0||c.x>1.0||c.y>1.0||c.z>1.0) return 1.0;
  float t = uShadowTexel*1.3, sum = 0.0;
  sum += texture(uShadow, vec3(c.xy, c.z));
  sum += texture(uShadow, vec3(c.xy + vec2( t, t*0.4), c.z));
  sum += texture(uShadow, vec3(c.xy + vec2(-t*0.4, t), c.z));
  sum += texture(uShadow, vec3(c.xy + vec2(-t,-t*0.4), c.z));
  sum += texture(uShadow, vec3(c.xy + vec2( t*0.4,-t), c.z));
  return sum*0.2;
}
vec3 ambientE(vec3 N){ return mix(uAmbGround, uAmbSky, 0.5+0.5*N.y); }
vec3 lampE(vec3 P, vec3 N){
  vec3 E = vec3(0.0);
  for (int i=0;i<8;i++){ if (i >= uNLamp) break;
    vec3 d = uLamp[i].xyz - P; float d2 = dot(d,d);
    E += uLamp[i].w*max(dot(N, d*inversesqrt(d2))*0.8+0.2, 0.0)/(d2 + 0.4); }
  return E*vec3(1.0,0.55,0.22)*uLantern;
}
// soft shadows of the koi on the pond bed, cast along the refracted sun ray
float koiShadow(vec3 P, vec3 sunT){
  float k = 1.0;
  for (int i=0;i<16;i++){ if (i >= uNKoi) break;
    vec4 f = uKoiP[i]; float dh = f.y - P.y; if (dh < 0.03) continue;
    vec2 Q = P.xz + sunT.xz*(dh/sunT.y);
    vec2 d = Q - f.xz, dir = uKoiD[i];
    float along = dot(d, dir), side = dot(d, vec2(dir.y, -dir.x));
    float m = length(vec2(along/(0.46*f.w), side/(0.1*f.w)));
    float pen = 0.25 + dh*1.4;
    k *= 1.0 - 0.6*smoothstep(1.0+pen, 1.0-pen*0.5, m)/(1.0 + dh*2.0);
  }
  return k;
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
  caus = mix(vec3(1.0), caus, smoothstep(0.0, 0.3, depth));
  vec3 SIG_T = uSigA + uSigS;
  vec3 Esun = uSunCol*Ts*exp(-SIG_T*depth/max(-sunT.y, 0.05))*caus*max(dot(N, -sunT), 0.0)*sh*koiShadow(P, sunT);
  vec3 Esky = uAmbSky*0.6*exp(-(uSigA + 0.4*uSigS)*depth*1.25)*ao*(0.55 + 0.45*N.y);
  return Esun + Esky;
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

// Vertex shader for static geometry and foliage cards: wind sway, ripple bobbing for floating things, seasonal culling.
const SCENE_VS = `#version 300 es
precision highp float; precision highp sampler2D;
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec4 aCol; layout(location=3) in vec2 aUV; layout(location=4) in vec4 aAttr;
uniform mat4 uVP; uniform float uTime; uniform vec3 uWindV; uniform vec4 uSeason; uniform sampler2D uRipN; uniform vec4 uRipRect;
out vec3 vP; out vec3 vN; out vec4 vCol; out vec2 vUV; flat out vec4 vAttr;
float seasonVis(float m){
  float b0 = mod(m, 2.0), b1 = mod(floor(m/2.0), 2.0), b2 = mod(floor(m/4.0), 2.0), b3 = floor(m/8.0);
  return dot(uSeason, vec4(b0,b1,b2,b3));
}
vec3 windOffset(vec3 p, float w, float seed){
  float ph = dot(p.xz, vec2(0.13, 0.09));
  float g = 0.55 + 0.45*sin(uTime*0.37 + ph*0.5);
  float s = sin(uTime*1.1 + ph + seed*6.2831)*0.6 + sin(uTime*2.7 + ph*1.9 + seed*3.0)*0.4;
  vec3 d = vec3(uWindV.x, 0.0, uWindV.z);
  return (d*(0.55*g + 0.45*s) + vec3(-d.z, 0.0, d.x)*0.35*s + vec3(0.0, 0.25*length(d)*s, 0.0))*w*0.07;
}
void main(){
  vec3 p = aPos;
#ifndef FOLIAGE
  if (aAttr.w > 0.5 && seasonVis(aAttr.w) < 0.5){ gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
#endif
  if (aAttr.y < -0.5){ vec2 ruv = (p.xz - uRipRect.xy)/uRipRect.zw; p.y += textureLod(uRipN, ruv, 0.0).r; }
  else if (aAttr.y > 0.0) p += windOffset(p, aAttr.y, aAttr.z);
  vP = p; vN = aNrm; vCol = aCol; vUV = aUV; vAttr = aAttr;
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
  return c*vec3(1.02,1.0,0.92)*0.72;
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
  float rough = 0.8, spec = 0.035, trans = 0.0, ao = vCol.a, snowK = 1.0;
  float seed = fract(vAttr.z);
  if (id == 0){                                   // terrain: lawn, moss, gravel path, suhama pebbles, pond bed
    float pathW = vCol.r, beach = vCol.g, marsh = vCol.b, moss = vAttr.z, dd = vUV.x;
    ao = vCol.a;
    float n0 = fbm(vP.xz*0.12), n1 = fbm(vP.xz*0.35), n2 = vnoise(vP.xz*3.1);
    float n3 = mix(0.5, vnoise(vP.xz*13.0), fadeF(13.0)), n4 = mix(0.5, vnoise(vP.xz*37.0), fadeF(37.0));
    // lawn: two greens, dry patches and fine texture; the colour follows the season
    vec3 grass = mix(vec3(0.045,0.075,0.018), vec3(0.09,0.11,0.03), n1)*(0.72 + 0.5*n2)*(0.85 + 0.3*n4);
    grass = mix(grass, vec3(0.12,0.11,0.045), smoothstep(0.58, 0.78, n0)*0.45);
    vec3 grassS = mix(vec3(0.06,0.1,0.02), vec3(0.11,0.14,0.035), n1)*(0.75 + 0.45*n2)*(0.85 + 0.3*n4);
    vec3 grassA = mix(vec3(0.1,0.095,0.035), vec3(0.15,0.12,0.045), n1)*(0.75 + 0.45*n2)*(0.85 + 0.3*n4);
    vec3 grassW = mix(vec3(0.075,0.07,0.045), vec3(0.1,0.09,0.06), n1)*(0.8 + 0.4*n2);
    grass = grassS*uSeason.x + grass*uSeason.y + grassA*uSeason.z + grassW*uSeason.w;
    // moss (sugigoke): deep, vivid, growing in clumps
    float clump = smoothstep(0.3, 0.7, n3);
    vec3 mossC = mix(vec3(0.014,0.04,0.006), vec3(0.05,0.095,0.012), clump*0.7 + n1*0.3);
    mossC = mix(mossC, mossC*vec3(1.3,0.95,0.7), uSeason.w*0.5 + uSeason.z*0.15);
    vec3 soil = vec3(0.06,0.045,0.032)*(0.8 + 0.4*n2);
    float mossW = clamp(moss + (n0-0.5)*0.7, 0.0, 1.0);
    alb = mix(grass, mossC, mossW);
    alb = mix(alb, soil, smoothstep(0.62, 0.8, n1*0.7 + n3*0.3)*0.45*(1.0 - mossW));
    // gravel path: Clearwater's pebble texture at a fine scale
    float hg; vec3 grav = pebbles(vP.xz*3.2, hg);
    grav = mix(vec3(dot(grav, vec3(0.33))), grav, 0.5)*vec3(1.08,1.0,0.88)*1.15;
    float pm = smoothstep(0.4, 0.62, pathW + (n2-0.5)*0.25);
    alb = mix(alb, grav, pm);
    float h = hg*0.006*pm + ((n3-0.5)*0.02*(0.4 + mossW) + (n4-0.5)*0.006)*(1.0 - pm);
    float hgt; vec3 peb = pebbles(vP.xz, hgt);
    float bm = smoothstep(0.3, 0.6, beach + (n2-0.5)*0.3)*smoothstep(1.4, 0.3, vP.y);
    alb = mix(alb, peb, bm); h += hgt*0.02*bm;
    alb = mix(alb, vec3(0.05,0.045,0.03)*(0.8 + 0.4*n2), marsh*smoothstep(0.5, 0.0, vP.y));
    float wetBand = smoothstep(0.14, 0.0, vP.y)*step(-0.01, vP.y);
    alb *= 1.0 - 0.4*wetBand;
    if (vP.y < 0.0){
      float shore = smoothstep(-2.8, -0.2, dd);
      vec3 silt = vec3(0.075,0.068,0.046)*(0.7 + 0.6*n1);
      vec3 bed = mix(silt, peb*0.9, max(shore*0.75, bm));
      bed = mix(bed, bed*vec3(0.6,0.75,0.42), smoothstep(0.55, 0.8, fbm(vP.xz*0.3 + 7.0))*0.7);
      alb = mix(alb, bed, smoothstep(0.0, -0.08, vP.y));
      h += hgt*0.015*shore;
    }
    N = bumpN(N, vP, h);
    rough = mix(0.92, 0.45, wetBand);
  } else if (id == 1 || id == 6){                 // rock / granite lantern stone
    float wetR = step(1.5, vAttr.z);
    vec3 q = vP*(id == 6 ? 3.5 : 1.9) + seed*37.0;
    float n1 = fbm3(q), n2 = noise3(q*4.3), n3 = mix(0.5, noise3(q*15.0), fadeF(15.0));
    float n4 = mix(0.5, noise3(q*41.0), fadeF(41.0));
    N = bumpN(N, vP, n1*(id == 6 ? 0.01 : 0.05) + n2*0.015 + n3*0.005 + n4*0.002);
    alb = vCol.rgb*(0.6 + 0.7*n1 + 0.3*(n2-0.5))*(0.85 + 0.3*n3)*(0.9 + 0.2*n4);
    alb *= mix(0.55, 1.0, smoothstep(0.35, 0.9, ao));
    if (id == 6) alb *= 0.9 + 0.25*step(0.8, noise3(vP*60.0))*fadeF(60.0);
    float above = smoothstep(0.02, 0.2, vP.y);
    float li = smoothstep(0.62, 0.72, noise3(vP*2.7 + seed*11.0))*above;
    alb = mix(alb, vec3(0.3,0.31,0.26), li*0.55);
    float ms = smoothstep(0.45, 0.85, N.y + (n1-0.5)*0.7)*smoothstep(0.2, 0.45, vP.y)*(1.0 - 0.6*wetR)*(id == 6 ? 0.35*smoothstep(0.55, 0.75, n2) : 1.0);
    alb = mix(alb, mix(vec3(0.02,0.05,0.01), vec3(0.05,0.08,0.015), n2)*(1.0 - 0.3*uSeason.w), ms*0.85);
    float band = smoothstep(0.22, 0.0, vP.y)*step(-0.02, vP.y);
    alb *= 1.0 - 0.45*band;
    if (vP.y < 0.0) alb = mix(alb, vec3(0.045,0.06,0.025)*(0.7 + 0.6*n1), 0.55*smoothstep(0.0, -0.3, vP.y));
    rough = mix(0.82, 0.32, max(band, uWet*0.7));
  } else if (id == 2 || id == 18 || id == 16){    // wood: posts and beams, floor planks, rafters
    float g = fbm(vec2(vUV.x*1.5, vUV.y*40.0)) ;
    alb = vCol.rgb*(0.72 + 0.45*g);
    if (id == 18){ float pl = fract(vUV.y/0.19); alb *= (0.85 + 0.3*hash12(vec2(floor(vUV.y/0.19), seed)))*(0.7 + 0.3*smoothstep(0.0, 0.05, pl)*smoothstep(1.0, 0.95, pl)); rough = 0.6; }
    if (id == 16){ float rf = fract(vUV.x/0.26); alb *= mix(0.45, 1.0, smoothstep(0.08, 0.14, rf)*smoothstep(0.6, 0.54, rf)); rough = 0.85; }
    N = bumpN(N, vP, g*0.002);
    rough = id == 2 ? 0.7 : rough;
  } else if (id == 3){                            // kawara tiles: round cover tiles running down the slope
    float c = cos(vUV.x*6.2831/0.28);
    float row = fract(vUV.y/0.3);
    float h = 0.022*smoothstep(-0.2, 1.0, c) + 0.012*smoothstep(0.85, 1.0, row);
    N = bumpN(N, vP, h*fadeF(8.0));
    float tv = hash12(floor(vec2(vUV.x/0.28, vUV.y/0.3)) + seed);
    alb = vCol.rgb*(0.8 + 0.4*tv)*(0.75 + 0.25*smoothstep(-1.0, 0.6, c));
    alb = mix(alb, vec3(0.1,0.1,0.07), smoothstep(0.7, 0.9, fbm(vP.xz*1.5))*0.35);
    rough = 0.42; spec = 0.045;
  } else if (id == 4){                            // shoji: paper in a kumiko lattice; glows warm at dusk
    vec2 g = vec2(fract(vUV.x/0.3), fract(vUV.y/0.24));
    float frame = max(smoothstep(0.06, 0.03, min(g.x, 1.0-g.x)), smoothstep(0.075, 0.04, min(g.y, 1.0-g.y)));
    alb = mix(vCol.rgb, vec3(0.09,0.065,0.045), frame);
    emis = vCol.rgb*(1.0 - frame)*vec3(1.0,0.6,0.28)*uLantern*(seed > 0.9 ? 3.0 : 0.9);
    rough = 0.9; snowK = 0.0;
  } else if (id == 5){                            // vermilion lacquer
    float w = fbm(vP.xz*4.0 + vP.y*3.0);
    alb = vCol.rgb*(0.82 + 0.3*w);
    alb = mix(alb, vec3(0.08,0.05,0.04), smoothstep(0.35, 0.0, vP.y)*0.6);
    rough = 0.38; spec = 0.05;
  } else if (id == 7){                            // lantern fire box: openings glow at dusk
    if (vAttr.z > 1.5){ alb = vec3(0.02); emis = vec3(1.0,0.55,0.2)*5.0*uLantern*(0.9 + 0.1*sin(uTime*13.0 + vP.x*7.0)); snowK = 0.0; }
    else {
      float face = floor(vUV.x), fu = fract(vUV.x);
      float win = (mod(face, 3.0) < 0.5) ? step(abs(fu-0.5), 0.3)*step(0.14, vUV.y)*step(vUV.y, 0.86) : 0.0;
      float moon = (mod(face, 3.0) > 0.5 && mod(face, 3.0) < 1.5) ? smoothstep(0.23, 0.2, length(vec2(fu-0.5, (vUV.y-0.5)*0.9))) : 0.0;
      float q = fbm3(vP*3.5 + 11.0);
      alb = vCol.rgb*(0.75 + 0.45*q)*(1.0 - 0.35*moon);
      alb = mix(alb, vec3(0.012), win);
      emis = win*vec3(1.0,0.55,0.2)*3.5*uLantern;
      rough = 0.85;
    }
  } else if (id == 8){                            // bark: pine plates, smooth maple, banded cherry
    float n1 = vnoise(vec2(vUV.x*9.0, vUV.y*3.0) + seed*20.0), n2 = vnoise(vec2(vUV.x*30.0, vUV.y*12.0));
    float k = 1.0;
    if (seed < 0.2) k = 0.55 + 0.6*smoothstep(0.35, 0.5, n1) + 0.2*n2;
    else if (seed > 0.7) k = 0.8 + 0.25*n2 + 0.35*step(0.8, fract(vUV.y*9.0 + n1*0.3))*step(0.3, n1);
    else k = 0.85 + 0.25*n1 + 0.1*n2;
    alb = vCol.rgb*k;
    alb = mix(alb, vec3(0.03,0.05,0.015), smoothstep(0.5, 0.9, N.y + n1*0.3)*0.4);
    N = bumpN(N, vP, n1*0.01);
    rough = 0.88;
  } else if (id == 9){                            // tatami with dark cloth borders
    vec2 m = vec2(fract((vUV.x + 3.0)/1.8), fract((vUV.y + 3.0)/0.9));
    float border = step(min(m.y, 1.0-m.y), 0.04);
    float weave = 0.9 + 0.1*sin(vUV.x*700.0*fadeF(110.0));
    alb = mix(vCol.rgb*weave, vec3(0.03,0.04,0.035), border);
    rough = 0.8; snowK = 0.0;
  } else if (id == 10){                           // plaster
    alb = vCol.rgb*(0.9 + 0.12*fbm(vP.xy*3.0 + vP.zy*3.0));
    alb *= 1.0 - 0.2*smoothstep(0.5, 0.9, fbm(vec2(vP.x + vP.z, vP.y*0.3)*4.0));
    rough = 0.95;
  } else if (id == 11){                           // lily pads: waxy, veined; brown in autumn
    float ang = atan(vUV.y, vUV.x), r = length(vUV);
    float vein = smoothstep(0.85, 1.0, sin(ang*14.0))*0.25*step(0.15, r);
    alb = vCol.rgb*(1.0 - vein)*(0.85 + 0.3*vnoise(vP.xz*20.0));
    alb = mix(alb, vec3(0.1,0.06,0.02), uSeason.z*0.55);
    alb = mix(alb, vec3(0.2,0.03,0.02), smoothstep(0.85, 1.0, r)*0.5);
    rough = 0.28; spec = 0.05; snowK = 0.0;
  } else if (id == 12){                           // petals
    alb = vCol.rgb; trans = 0.8; rough = 0.6; snowK = 0.0;
  } else if (id == 13){                           // clipped azalea: dense small leaves, flowers in spring
    float n1 = vnoise(vP.xz*16.0 + vP.y*9.0), n2 = vnoise(vP.xz*42.0 - vP.y*23.0);
    float leaf = mix(0.5, n2, fadeF(42.0));
    alb = mix(vec3(0.02,0.045,0.012), vec3(0.045,0.085,0.018), leaf)*(0.7 + 0.5*n1);
    alb = mix(alb, alb*vec3(2.2,0.9,0.5), uSeason.z*0.5*step(0.6, n1));
    float fl = smoothstep(0.55, 0.62, n1*0.6 + leaf*0.4)*uSeason.x;
    alb = mix(alb, mix(vec3(0.62,0.05,0.22), vec3(0.8,0.3,0.42), step(0.5, seed)), fl);
    N = bumpN(N, vP, (n1*0.03 + leaf*0.01));
    ao *= 0.75 + 0.25*leaf;
    rough = 0.75; trans = 0.3;
  } else if (id == 14){                           // iris blades
    alb = vCol.rgb*(0.8 + 0.4*vnoise(vP.xz*30.0 + vP.y*2.0));
    alb = mix(alb, vec3(0.13,0.09,0.03), uSeason.z*0.6 + uSeason.w*0.8);
    trans = 0.6; rough = 0.55;
  } else if (id == 17){                           // bronze giboshi
    alb = vCol.rgb*(0.8 + 0.4*fbm3(vP*20.0)); rough = 0.45; spec = 0.25;
  }
  // snow on upward faces (winter), wet darkening (rain)
  if (uSnow > 0.0 && vP.y > 0.02 && snowK > 0.0){
    float s = uSnow*smoothstep(0.5, 0.82, N.y + 0.3*(vnoise(vP.xz*2.3) - 0.5));
    alb = mix(alb, vec3(0.8,0.82,0.86), s); rough = mix(rough, 0.85, s); N = normalize(mix(N, vec3(0,1,0), s*0.6));
  }
  if (uWet > 0.0 && vP.y > 0.0 && id != 4 && id != 9){ alb *= 1.0 - 0.3*uWet*step(0.0, N.y); rough = mix(rough, rough*0.45, uWet); }

  vec3 col;
#ifndef REFL
  if (vP.y < -0.004){
    col = alb/PI*underwaterE(vP, N, ao) + emis;
  } else
#endif
  {
    float sh = uSunCol.r + uSunCol.g > 0.0 ? shadowAt(vP, N) : 0.0;
    vec3 L = uSunDir; float ndl = max(dot(N, L), 0.0);
    vec3 E = uSunCol*ndl*sh + ambientE(N)*ao + lampE(vP, N);
    col = alb/PI*E + emis;
    vec3 H = normalize(L + V); float nh = max(dot(N,H), 0.0), nv = max(dot(N,V), 1e-3);
    float a = rough*rough, a2 = a*a, dd = nh*nh*(a2-1.0) + 1.0, D = a2/(PI*dd*dd), k = a*0.5;
    float Vis = 0.25/((ndl*(1.0-k)+k)*(nv*(1.0-k)+k));
    float Fs = spec + (1.0-spec)*pow(1.0 - max(dot(H,V), 0.0), 5.0);
    col += uSunCol*sh*ndl*min(D*Vis*Fs, 60.0);
    float Fv = spec + (1.0-spec)*pow(1.0 - nv, 5.0);
    col += skyBase(reflect(-V, N))*Fv*(1.0-rough)*(1.0-rough)*ao*0.7;
    col += alb*uSunCol*sh*trans*pow(max(dot(-V, L), 0.0), 3.0)*0.5;
  }
#ifdef REFL
  col = applyHaze(col, -V, length(uCamPos - vP));
#endif
  o = vec4(col, vAttr.y < -0.5 ? 1.0 : 0.0);
}`;

const SHADOW_FS = `#version 300 es
precision highp float;
out vec4 o;
void main(){ o = vec4(1.0); }`;

// Leaf cards: alpha-tested cells of the painted atlas, coloured by season, lit with wrap diffuse + sun transmission.
const FOLIAGE_FS = `#version 300 es
precision highp float; precision highp sampler2D; precision highp int;
in vec3 vP; in vec3 vN; in vec4 vCol; in vec2 vUV; flat in vec4 vAttr;
out vec4 o;
uniform sampler2D uAtlas;
` + COMMON + `
void main(){
  int sp = int(vAttr.x + 0.5);
  float r1 = vCol.x, r2 = vCol.y;
  int cell = 8;
  if (sp == 0) cell = 0;
  else if (sp == 1) cell = r2 < uSeason.w ? 5 : 1;
  else if (sp == 2) cell = r2 < uSeason.w ? 5 : (r2 < uSeason.w + uSeason.x ? 2 : 3);
  else if (sp == 3) cell = 3;
  else if (sp == 4) cell = 9;
  else if (sp == 5) cell = 4;
  else if (sp == 6) cell = 6;
  else if (sp == 7) cell = 7;
  vec2 gdx = dFdx(vUV)*0.25, gdy = dFdy(vUV)*0.25;
  vec2 auv = (vec2(float(cell % 4), float(cell / 4)) + clamp(vUV, 0.004, 0.996))*0.25;
  vec4 t = textureGrad(uAtlas, auv, gdx, gdy);
  float lod = log2(max(max(length(gdx), length(gdy))*1024.0, 1e-4));
  float a = t.a*(1.0 + max(lod, 0.0)*0.3);
  if (sp >= 6) a *= step(hash12(gl_FragCoord.xy), vCol.x);
  if (a < 0.5) discard;
#ifdef SHADOW
  o = vec4(1.0);
#else
  float lum = t.r, var = t.g, fl = t.b;
  vec3 alb; float trans = 0.5;
  if (cell == 5){ alb = vec3(0.05,0.042,0.035)*(0.7 + 0.6*lum); trans = 0.0; }
  else if (sp == 0){ alb = mix(vec3(0.012,0.03,0.01), vec3(0.045,0.075,0.018), lum)*(0.8 + 0.4*var); trans = 0.25; }
  else if (sp == 1 || sp == 6){
    vec3 spr = mix(vec3(0.11,0.2,0.025), vec3(0.2,0.24,0.035), var); spr = mix(spr, vec3(0.3,0.08,0.03), step(0.88, var)*0.8);
    vec3 sum = mix(vec3(0.03,0.085,0.012), vec3(0.06,0.12,0.02), var);
    float hue = fract(var*0.6 + r1*0.5 + vAttr.z*0.3);
    vec3 aut = hue < 0.25 ? mix(vec3(0.55,0.22,0.01), vec3(0.62,0.34,0.02), hue*4.0) : mix(vec3(0.5,0.035,0.012), vec3(0.3,0.012,0.008), (hue-0.25)/0.75);
    aut = mix(aut, vec3(0.28,0.2,0.03), step(0.93, r2)*0.8);
    alb = sp == 6 ? aut : (spr*uSeason.x + sum*uSeason.y + aut*(uSeason.z + uSeason.w));
    alb *= 0.6 + 0.55*lum; trans = 1.0;
  }
  else if (sp == 2 || sp == 7){
    if (fl > 0.5 && (cell == 2 || sp == 7)) { alb = mix(vec3(0.75,0.42,0.5), vec3(0.95,0.85,0.88), lum); trans = 0.8; }
    else {
      vec3 spr = vec3(0.14,0.1,0.035), sum = vec3(0.03,0.075,0.012), aut = mix(vec3(0.5,0.1,0.02), vec3(0.55,0.3,0.03), var);
      alb = (spr*uSeason.x + sum*uSeason.y + aut*(uSeason.z + uSeason.w))*(0.6 + 0.6*lum); trans = 0.8;
    }
  }
  else if (sp == 3){ alb = mix(vec3(0.012,0.028,0.009), vec3(0.04,0.07,0.02), lum)*(0.8 + 0.4*var); alb = mix(alb, vec3(0.12,0.16,0.04)*lum, uSeason.x*step(0.8, var)*0.7); trans = 0.35; }
  else if (sp == 4){
    alb = mix(vec3(0.015,0.035,0.01), vec3(0.045,0.08,0.018), lum)*(0.8 + 0.4*var);
    alb = mix(alb, alb*vec3(2.5,0.9,0.4), uSeason.z*step(0.75, var)*0.8);
    alb = mix(alb, mix(vec3(0.62,0.04,0.22), vec3(0.85,0.32,0.45), step(0.5, r1))*lum, fl*uSeason.x);
    trans = 0.4;
  }
  else if (sp == 5){ alb = mix(vec3(0.012,0.028,0.01), vec3(0.04,0.065,0.02), lum)*(0.8 + 0.4*var); alb = mix(alb, alb*vec3(1.6,1.05,0.7), uSeason.w*0.6); trans = 0.25; }
  else if (sp == 8){ alb = vec3(0.85,0.87,0.9); trans = 0.2; }
  else { alb = vec3(0.12,0.07,0.03); trans = 0.0; }
  vec3 N = normalize(vN);
  if (uSnow > 0.0 && sp != 8 && sp < 6){ float s = uSnow*smoothstep(0.25, 0.8, N.y)*step(0.35, vnoise(vP.xz*6.0 + vP.y)); alb = mix(alb, vec3(0.8,0.82,0.86), s); trans *= 1.0 - s; }
  vec3 V = normalize(uCamPos - vP);
  float sh = uSunCol.r + uSunCol.g > 0.0 ? shadowAt(vP, N*0.5) : 0.0;
  float wrap = max(dot(N, uSunDir)*0.7 + 0.3, 0.0);
  float ao = vCol.w;
  vec3 col;
  {
    vec3 E = uSunCol*wrap*sh + ambientE(N)*ao + lampE(vP, N);
    col = alb/PI*E;
    float bl = pow(max(dot(-V, uSunDir), 0.0), 4.0);
    col += alb*uSunCol*sh*trans*(0.04 + 0.5*bl)*ao;
  }
#ifdef REFL
  col = applyHaze(col, -V, length(uCamPos - vP));
#endif
  o = vec4(col, vAttr.y < -0.5 ? 1.0 : 0.0);
#endif
}`;

// Koi: body undulation in the vertex shader, variety patterns and underwater lighting in the fragment shader.
const KOI_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec4 aCol; layout(location=3) in vec2 aUV; layout(location=4) in vec4 aAttr;
uniform mat4 uVP, uModel; uniform vec4 uKoi;
out vec3 vP; out vec3 vN; out vec3 vL; out vec2 vUV; flat out float vPart; out float vFin;
void main(){
  vec3 p = aPos, n = aNrm; float s = aUV.x, part = aAttr.x, amp = uKoi.y;
  float env = 0.035 + 1.1*s*s, ph = 6.2831*s*0.9 - uKoi.x;
  float lat = amp*env*sin(ph), dlat = amp*(2.2*s*sin(ph) + env*6.2831*0.9*cos(ph));
  if (part > 1.5 && part < 2.5) lat += amp*0.3*aCol.r*sin(ph - 0.9);
  p.x += lat - amp*0.05*sin(-uKoi.x);
  float ang = atan(dlat); float c = cos(ang), sn = sin(ang);
  n.xz = vec2(c*n.x + sn*n.z, -sn*n.x + c*n.z);
  if (part > 2.5){ float f = aCol.r; p.y += sin(uKoi.x*0.6 + aAttr.y)*0.02*f; p.x += aAttr.y*0.012*f*sin(uKoi.x*0.6 + 1.0); }
  vec4 w = uModel*vec4(p, 1.0);
  vP = w.xyz; vN = normalize(mat3(uModel)*n); vL = aPos; vUV = aUV; vPart = part; vFin = aCol.r;
  gl_Position = uVP*w;
}`;
const KOI_FS = `#version 300 es
precision highp float; precision highp sampler2D; precision highp int;
in vec3 vP; in vec3 vN; in vec3 vL; in vec2 vUV; flat in float vPart; in float vFin;
out vec4 o;
uniform vec4 uKoi;
` + COMMON + `
void main(){
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  float type = uKoi.z, sd = uKoi.w, s = vUV.x;
  vec3 q = vL*vec3(9.0, 9.0, 5.5) + sd;
  float n = fbm3(q), n2 = noise3(q*2.3 + 4.0);
  vec3 white = vec3(0.78,0.76,0.71), red = vec3(0.62,0.07,0.015), black = vec3(0.012,0.012,0.015);
  float up = smoothstep(-0.05, 0.015, vL.y);
  float hi = smoothstep(0.5, 0.56, n + 0.12*n2)*up*smoothstep(0.02, 0.1, s)*smoothstep(0.9, 0.72, s);
  float sumi = smoothstep(0.7, 0.74, noise3(q*1.7 + 9.0))*up;
  vec3 alb; float metal = 0.0, net = 0.15;
  if (type < 0.5) alb = mix(white, red, hi);
  else if (type < 1.5) alb = mix(mix(white, red, hi), black, sumi);
  else if (type < 2.5){ float w = smoothstep(0.55, 0.6, noise3(q*1.3 + 2.0)); alb = mix(black, red, hi); alb = mix(alb, white, w*(1.0-hi)*0.9); }
  else if (type < 3.5){ alb = vec3(0.85,0.5,0.1); metal = 1.0; }
  else if (type < 4.5){ alb = vec3(0.26,0.15,0.065); net = 0.45; }
  else if (type < 5.5){ float spot = smoothstep(0.07, 0.055, length(vec2(vL.x, vL.z - 0.37)))*step(0.0, vL.y); alb = mix(white, red, spot); }
  else if (type < 6.5){ alb = mix(vec3(0.62,0.14,0.03), vec3(0.2,0.27,0.36), smoothstep(-0.02, 0.04, vL.y)); net = 0.45; }
  else { alb = vec3(0.8,0.8,0.78); metal = 1.0; }
  if (vPart < 0.5){
    vec2 sc = vec2(s*52.0, vUV.y*18.0); vec2 cl = fract(sc + vec2(0.5*mod(floor(sc.y), 2.0), 0.0)) - 0.5;
    alb *= 1.0 - smoothstep(0.32, 0.5, max(abs(cl.x), abs(cl.y)))*net;
    alb = mix(alb, white*0.92, smoothstep(-0.02, -0.07, vL.y)*(type > 3.5 && type < 4.5 ? 0.25 : 0.6));
    float eye = length(vec3(abs(vL.x) - 0.057, vL.y - 0.014, vL.z - 0.43));
    alb = mix(alb, vec3(0.01), smoothstep(0.013, 0.009, eye));
  } else {
    alb = mix(alb, white*0.85, 0.45)*(0.88 + 0.12*sin(vUV.y*70.0));
    if (type > 1.5 && type < 2.5) alb = mix(alb, black, smoothstep(0.35, 0.0, vFin)*0.8);
  }
  vec3 col = alb/PI*underwaterE(vP, N, 1.0);
  vec3 sunT = refract(-uSunDir, vec3(0,1,0), 1.0/IOR), V = normalize(uCamPos - vP), H = normalize(V - sunT);
  float sp = pow(max(dot(N, H), 0.0), metal > 0.5 ? 24.0 : 70.0)*(metal > 0.5 ? 2.5 : 0.5);
  col += sp*uSunCol*exp(-(uSigA + uSigS)*max(-vP.y, 0.0)*2.0)*(metal > 0.5 ? alb : vec3(0.25));
  o = vec4(col, 0.0);
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

// Water: Clearwater's main water shader, turned into a compositing pass over the rendered garden.
// Reflections come from a planar mirror render; refraction reads the garden image behind the surface.
const WATER_FS = HEAD + `
uniform sampler2D uSurf, uScene, uDepth, uRefl;
uniform vec3 uR, uU, uF; uniform float uTanF, uAspect, uNear, uFar, uL;
uniform mat4 uVP;
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
      A = texture(uSurf, xz/uL); B = texture(uSurf, (M*xz)/(uL*SC) + 0.37);
      R = texture(uRipN, (xz - uRipRect.xy)/uRipRect.zw);
      t = (A.x + WB*SC*B.x + R.x - uCamPos.y)/wd.y;
    }
    vec3 P = uCamPos + wd*t;
    A = texBS(uSurf, P.xz/uL); B = texBS(uSurf, (M*P.xz)/(uL*SC) + 0.37);
    vec2 slope = A.yz + WB*(transpose(M)*B.yz) + R.yz;
    const mat2 M2 = mat2(0.28, 0.96, -0.96, 0.28);
    vec4 Cm = texture(uSurf, (M2*P.xz)/(uL*0.13) + 0.71);
    slope += 0.13*exp(-t*0.18)*(transpose(M2)*Cm.yz);
    float var = max(A.w - dot(A.yz,A.yz), 0.0) + WB*WB*max(B.w - dot(B.yz,B.yz), 0.0);
    vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));
    vec3 v = -wd; float nv = dot(n, v);
    if (nv < 0.02){ n = normalize(n + v*(0.02 - nv)); nv = dot(n, v); }
    float F = fresnel(nv, IOR);
    float sh = uSunCol.r + uSunCol.g > 0.0 ? shadowAt(P, vec3(0,1,0)) : 0.0;
    // ---- reflection: planar mirror image, displaced by the surface slope ----
    vec3 dn = n - vec3(0,1,0);
    vec2 ruv = clamp(vUv + vec2(dot(dn, uR), dot(dn, uU))*0.55, 0.001, 0.999);
    vec3 refl = texture(uRefl, ruv).rgb;
    // ---- refraction: read the garden image behind the surface, displaced by the surface slope and the depth below ----
    // (the garden is rendered with straight rays, so only the wave-induced bending is added here; bending the flat-water
    //  part as well would re-project occluders such as koi and produce ghost images)
    vec3 tr = refract(wd, n, 1.0/IOR);
    vec3 Ps = uCamPos + rd*min(tS, t + 40.0);
    float D = max(P.y - Ps.y, 0.0);
    vec2 uvR = clamp(vUv + vec2(dot(dn, uR), dot(dn, uU))*0.5*min(D, 1.2)/(1.0 + t*0.04), 0.001, 0.999);
    vec3 rdR = rayDir(uvR); float tSR = sceneT(uvR, rdR); vec3 PsR = uCamPos + rdR*min(tSR, t + 40.0);
    if (PsR.y > P.y + 0.01 || texture(uScene, uvR).a > 0.5){ uvR = vUv; PsR = Ps; }
    vec3 sceneUnder = texture(uScene, uvR).rgb;
    float s = min(length(PsR - P), 14.0);
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
      float dz = 0.12 + 0.2*float(k);
      float tt = dz/max(-tr.y, 0.05);
      vec2 q = (P.xz + tr.xz*tt)*48.0 + vec2(uTime*(0.05 + 0.03*float(k)), uTime*0.02) + float(k)*17.0;
      vec2 id = floor(q), f = fract(q) - 0.5;
      float r = hash12(id + float(k)*13.1);
      vec2 of = vec2(hash12(id + 3.1), hash12(id + 7.7)) - 0.5;
      float fw = fwidth(q.x) + fwidth(q.y);
      float dot_ = smoothstep(0.10 + fw, 0.0, length(f - of*0.6))*step(0.99, r)*step(tt, s);
      float fade = exp(-SIG_T.g*tt*2.0)*smoothstep(1.2, 0.3, fw);
      under += dot_*fade*uSunCol*Ts*sh*0.02*mix(vec3(0.9,1.0,0.9), vec3(0.45,0.4,0.3), step(0.995, r));
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
    tF = t;
  }
  if (tF < 1e5) col = applyHaze(col, rd, tF);
  o = vec4(max(col, 0.0), 1.0);
}`;

// Waterfall sheet and plunge foam, alpha-blended after the water pass.
const FALL_FS = `#version 300 es
precision highp float; precision highp sampler2D; precision highp int;
in vec3 vP; in vec3 vN; in vec4 vCol; in vec2 vUV; flat in vec4 vAttr;
out vec4 o;
` + COMMON + `
void main(){
  float f = vCol.r; vec3 N = normalize(vN);
  float a; vec3 base;
  if (f > 1.5){
    vec2 q = vUV - 0.5; float r = length(q)*2.0, ang = atan(q.y, q.x);
    float n = vnoise(vec2(ang*7.0, r*9.0 - uTime*1.3))*0.55 + vnoise(vec2(ang*17.0 + 3.0, r*23.0 - uTime*2.1))*0.45;
    a = smoothstep(0.95, 0.05, r)*smoothstep(0.5, 0.82, n)*0.55; base = vec3(0.8);
  } else {
    float spd = f > 0.0 ? 4.8 : 1.2;
    float n = vnoise(vec2(vUV.x*16.0, vUV.y*2.2 - uTime*spd))*0.65 + vnoise(vec2(vUV.x*41.0, vUV.y*5.0 - uTime*spd*1.4))*0.35;
    float edge = smoothstep(0.0, 0.16, vUV.x)*smoothstep(1.0, 0.84, vUV.x);
    float aer = clamp(f*1.4, 0.0, 1.0);
    a = edge*mix(0.3 + 0.3*n, 0.5 + 0.45*n, aer);
    base = mix(vec3(0.3,0.38,0.36), vec3(0.88), clamp(aer*0.75 + n*0.35*aer, 0.0, 1.0));
  }
  vec3 E = uSunCol*(0.35 + 0.4*max(dot(N, uSunDir), 0.0)) + ambientE(N) + lampE(vP, N);
  vec3 col = applyHaze(base/PI*E, normalize(vP - uCamPos), length(vP - uCamPos));
  o = vec4(col*a, a);
}`;
