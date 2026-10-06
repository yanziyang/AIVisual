// Combustor flame: ray-marched emissive volume in the annulus between the liner walls.
// A convex proxy cylinder gives exactly one fragment per pixel; the shader intersects the ray with the
// annulus analytically (outer cylinder minus inner cylinder, clipped to the combustor length) and
// integrates noise-modulated emission. Samples inside the cutaway wedge are skipped, so the flame is
// cut with the engine and you can look through the opening at the far side of the ring.
import * as THREE from 'three';
import { U } from './materials.js';
import { COMB } from './parts/comb.js';
import { lathe } from './geom.js';

const VERT = `
varying vec3 vW;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = `
precision highp float;
varying vec3 vW;
uniform vec3 uCam;
uniform vec4 uCut;
uniform float uTime;
uniform float uFlame;      // 0..1.3 overall intensity (throttle)
uniform float uXOff;       // explode offset of the module
uniform float uAlpha;
uniform vec4 uBox;         // xa, xb, rIn, rOut  (bounding annulus)

float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h31(i+vec3(0,0,0)),h31(i+vec3(1,0,0)),f.x), mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x), f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x), mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x), f.y), f.z);
}
float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<3;i++){ s+=a*vnoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; } return s; }

// radial extent of the flame tube at axial position x
float rIn(float x){ return 0.378 - 0.015*smoothstep(3.5,3.86,x); }
float rOut(float x){ return 0.545 - 0.045*smoothstep(3.5,3.86,x); }

vec2 cyl(vec2 o, vec2 d, float R){
  float a = dot(d,d), b = dot(o,d), c = dot(o,o) - R*R;
  float disc = b*b - a*c;
  if (disc < 0.0) return vec2(1e9, -1e9);
  float s = sqrt(disc);
  return vec2((-b - s)/a, (-b + s)/a);
}

vec3 ramp(float h){
  // black -> deep red -> orange -> yellow -> white-blue core
  vec3 c = vec3(0.0);
  c = mix(c, vec3(0.55,0.05,0.0), smoothstep(0.0,0.25,h));
  c = mix(c, vec3(1.0,0.32,0.03), smoothstep(0.2,0.55,h));
  c = mix(c, vec3(1.0,0.78,0.30), smoothstep(0.5,0.85,h));
  c = mix(c, vec3(1.0,0.97,0.88), smoothstep(0.85,1.15,h));
  return c;
}

float wedge(vec3 p){
  if (uCut.x < 0.5) return 1.0;
  float a = atan(p.z, p.y);
  float d = abs(mod(a - uCut.y + 3.14159265, 6.2831853) - 3.14159265);
  return step(uCut.z, d);
}

void main(){
  vec3 ro = uCam;
  vec3 rd = normalize(vW - uCam);
  float xa = uBox.x + uXOff, xb = uBox.y + uXOff;
  // x slab
  float t0 = 0.0, t1 = 1e9;
  if (abs(rd.x) > 1e-5){
    float ta = (xa - ro.x)/rd.x, tb = (xb - ro.x)/rd.x;
    t0 = min(ta,tb); t1 = max(ta,tb);
  } else if (ro.x < xa || ro.x > xb) discard;
  vec2 O = ro.yz, D = rd.yz;
  if (dot(D,D) < 1e-10) discard;
  vec2 ho = cyl(O, D, uBox.w);
  if (ho.x > ho.y) discard;
  vec2 hi = cyl(O, D, uBox.z);
  float tA0 = max(t0, ho.x), tA1 = min(t1, ho.y);
  vec3 acc = vec3(0.0);
  float stepsTot = 0.0;
  // interval(s): outer cylinder minus inner cylinder
  for (int seg = 0; seg < 2; seg++){
    float s0, s1;
    if (hi.x > hi.y){ if (seg == 1) break; s0 = tA0; s1 = tA1; }
    else if (seg == 0){ s0 = tA0; s1 = min(tA1, hi.x); }
    else { s0 = max(tA0, hi.y); s1 = tA1; }
    if (s1 <= s0) continue;
    const int N = 26;
    float dt = (s1 - s0) / float(N);
    float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453);
    for (int i = 0; i < N; i++){
      float t = s0 + (float(i) + jit) * dt;
      vec3 p = ro + rd * t;
      if (wedge(p) < 0.5) continue;
      float x = p.x - uXOff;
      float r = length(p.yz);
      float ri = rIn(x) + 0.006, ro_ = rOut(x) - 0.006;
      if (r < ri || r > ro_) continue;
      float u = (r - ri) / (ro_ - ri);
      float s = clamp((x - 3.31) / 0.55, 0.0, 1.0);
      float ang = atan(p.z, p.y);
      // swirl-stabilised flame: noise advected along x and rotated about the axis
      float spin = uTime * (1.4 + 1.2*uFlame);
      vec3 q = vec3(x * 7.0 - uTime * (4.0 + 3.0*uFlame), (ang + spin * 0.35 + s*2.2) * r * 9.0, u * 5.0 + uTime * 1.3);
      float n = fbm(q);
      float jets = 0.5 + 0.5*sin((ang * 20.0 + spin * 0.6));       // 20 fuel nozzles
      // primary zone: strong, short-lived; secondary zone trails toward the exit
      float len = 0.30 + 0.62 * clamp(uFlame, 0.0, 1.3);
      float core = exp(-pow(s / (0.45*len + 0.05), 1.7) * 1.4);
      float tail = exp(-s * (2.2 - 0.9*uFlame));
      float radial = smoothstep(0.0, 0.18, u) * smoothstep(1.0, 0.82, u);
      float dens = (core * (0.55 + 0.9 * n) * (0.65 + 0.5 * jets) + 0.45 * tail * n * n) * radial;
      dens *= smoothstep(0.0, 0.04, s);
      float heat = clamp(dens * 1.5 * (0.35 + 0.8*uFlame) + core * 0.3 * uFlame, 0.0, 1.6);
      acc += ramp(heat) * dens * dt;
    }
  }
  vec3 col = acc * (2.8 * uFlame) ;
  if (max(col.r, max(col.g, col.b)) < 0.002) discard;
  gl_FragColor = vec4(col * uAlpha, 1.0);
}`;

export function createFlame(mod) {
  // convex proxy: solid cylinder just inside the outer liner wall
  const poly = [[COMB.xDome + 0.012, 0.0], [COMB.xDome + 0.012, 0.545], [COMB.xExit, 0.5], [COMB.xExit, 0.0]];
  const geo = lathe(poly.concat([poly[0]]), { seg: 72, split: 10 });
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: {
      uCam: { value: new THREE.Vector3() }, uCut: U.cut, uTime: U.time, uFlame: { value: 0.5 },
      uXOff: { value: 0 }, uAlpha: { value: 1 }, uBox: { value: new THREE.Vector4(COMB.xDome + 0.012, COMB.xExit, 0.372, 0.545) },
    },
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.name = 'flame';
  mod.group.add(mesh);
  return { mesh, mat };
}
