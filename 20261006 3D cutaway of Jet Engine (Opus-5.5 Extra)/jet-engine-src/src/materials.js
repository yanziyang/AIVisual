// Materials. Every part shares one shader patch that adds:
//   - the cutaway wedge (fragments whose angle about the engine axis lies in the wedge are discarded)
//   - per-module "ghost" dimming (used to spotlight the focused module)
//   - optional surface effects: section hatching, acoustic perforations, combustor holes, spinner spiral
import * as THREE from 'three';

export const U = {
  cut: { value: new THREE.Vector4(1, 1.4, 1.1, 0) }, // x = on, y = wedge centre angle, z = half width
  time: { value: 0 },
  heat: { value: 0 },
};
const ONE = { value: 1 };
const ZERO = { value: 0 };

const VERT_DECL = 'varying vec3 vCutP;\nvarying vec2 vLUv;\n';
const VERT_BODY = `
  vec4 cw_ = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    cw_ = instanceMatrix * cw_;
  #endif
  cw_ = modelMatrix * cw_;
  vCutP = cw_.xyz;
  vLUv = uv;
`;
const FRAG_DECL = `
uniform vec4 uCut;
uniform float uGhost;
uniform float uHeat;
uniform float uTime;
uniform float uBlur;
varying vec3 vCutP;
varying vec2 vLUv;
float bayer4_(vec2 p){
  return fract(52.9829189 * fract(0.06711056 * p.x + 0.00583715 * p.y));
}
`;
const FRAG_CUT = `
#ifdef CUTTABLE
  if (uCut.x > 0.5) {
    float ca_ = atan(vCutP.z, vCutP.y);
    float dd_ = abs(mod(ca_ - uCut.y + 3.14159265, 6.2831853) - 3.14159265);
    if (dd_ < uCut.z) discard;
  }
#endif
#ifdef BLUR
  if (uBlur > 0.002 && bayer4_(gl_FragCoord.xy) < uBlur * 0.84) discard;
#endif
#ifdef HOLES
  {
    float rr_ = length(vCutP.yz);
    float aa_ = atan(vCutP.z, vCutP.y);
    float row_ = floor((vCutP.x - HOLE_X0) / HOLE_DX + 0.5);
    float cx_ = HOLE_X0 + HOLE_DX * row_;
    float arcStep_ = 6.2831853 / HOLE_N;
    float stag_ = mod(row_, 2.0) * 0.5;
    float ia_ = floor(aa_ / arcStep_ + stag_ + 0.5);
    float ac_ = (ia_ - stag_) * arcStep_;
    vec2 dv_ = vec2(vCutP.x - cx_, (aa_ - ac_) * rr_);
    if (row_ >= 0.0 && row_ < HOLE_ROWS && length(dv_) < HOLE_R) discard;
  }
#endif
`;
// focus mode: modules outside the focus fall back to a dark, slightly blue silhouette
const FRAG_DIM = `
  { float gk_ = clamp(uGhost, 0.0, 1.0);
    vec3 dim_ = gl_FragColor.rgb * 0.17 + vec3(0.004, 0.007, 0.011);
    gl_FragColor.rgb = mix(dim_, gl_FragColor.rgb, gk_); }
`;
const FRAG_COLOR = `
#ifdef HATCH
  { vec2 hp_ = vLUv * 30.0; float h_ = abs(fract(hp_.x + hp_.y) - 0.5);
    diffuseColor.rgb *= mix(0.70, 1.0, smoothstep(0.035, 0.11, h_)); }
#endif
#ifdef PERF
  { float rr_ = length(vCutP.yz); float aa_ = atan(vCutP.z, vCutP.y);
    vec2 g_ = vec2(vCutP.x, aa_ * rr_) / 0.014; vec2 f_ = fract(g_) - 0.5;
    float d_ = length(f_);
    diffuseColor.rgb *= 1.0 - 0.62 * smoothstep(0.30, 0.20, d_); }
#endif
#ifdef SPIRAL
  { float s_ = fract(vLUv.x * 2.0 - vLUv.y * 1.45);
    float st_ = smoothstep(0.46, 0.50, s_) * smoothstep(0.96, 0.92, s_);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.94, 0.95), st_); }
#endif
#ifdef SEAMS
  { float ss_ = smoothstep(0.0035, 0.0, abs(vLUv.x - 0.0)) + smoothstep(0.0035, 0.0, abs(vLUv.x - 0.5));
    diffuseColor.rgb *= 1.0 - 0.45 * clamp(ss_, 0.0, 1.0); }
#endif
`;

export function patchMaterial(mat, { cut = true, ghost = null, defs = {}, key = '', blur = null } = {}) {
  const gu = ghost || ONE;
  const bu = blur || ZERO;
  mat.defines = Object.assign({}, mat.defines, defs);
  if (cut) mat.defines.CUTTABLE = '';
  mat.defines.GHOSTABLE = '';
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uCut = U.cut;
    sh.uniforms.uGhost = gu;
    sh.uniforms.uBlur = bu;
    sh.uniforms.uHeat = U.heat;
    sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_DECL)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_BODY);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_DECL)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + FRAG_CUT)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_COLOR)
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + FRAG_DIM);
  };
  mat.customProgramCacheKey = () => 'jet:' + (cut ? 'c' : 'n') + ':' + Object.keys(mat.defines).sort().join(',') + ':' + Object.values(mat.defines).join(',') + key;
  return mat;
}

// Depth material used for shadow casting: same wedge cut, so light pours in through the opening.
export function makeDepthMat(cut = true) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.defines = {};
  if (cut) m.defines.CUTTABLE = '';
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCut = U.cut;
    sh.uniforms.uGhost = ONE;
    sh.uniforms.uBlur = ZERO;
    sh.uniforms.uHeat = U.heat;
    sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_DECL)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_BODY);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_DECL)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + FRAG_CUT);
  };
  m.customProgramCacheKey = () => 'jetdepth:' + (cut ? 'c' : 'n');
  return m;
}
export const depthCut = makeDepthMat(true);
export const depthNoCut = makeDepthMat(false);

// ---------------------------------------------------------------- catalogue
// Colour-coding: LP spool (N1) is tinted cool steel-blue, HP spool (N2) warm bronze.
export const SPOOL_COL = { n1: 0x6fa8dc, n2: 0xd9a24f };

const P = (o) => ({ type: 'phys', ...o });
const CAT = {
  ti: P({ color: 0xc7ccd4, metalness: 1, roughness: 0.27 }),
  tiDark: P({ color: 0x9aa0a9, metalness: 1, roughness: 0.33 }),
  steel: P({ color: 0xaeb3bb, metalness: 1, roughness: 0.31 }),
  nickel: P({ color: 0x80848c, metalness: 1, roughness: 0.38 }),
  hotblade: P({ color: 0x5d6068, metalness: 1, roughness: 0.42, emissive: 0x000000 }),
  cast: P({ color: 0x8e949c, metalness: 0.85, roughness: 0.52 }),
  castDark: P({ color: 0x555b63, metalness: 0.85, roughness: 0.5 }),
  hotcase: P({ color: 0x6a6e75, metalness: 0.8, roughness: 0.55, emissive: 0x000000 }),
  cowl: P({ color: 0xbec3ca, metalness: 0.8, roughness: 0.34, clearcoat: 0.3 }),
  cowlIn: P({ color: 0x7c828a, metalness: 0.6, roughness: 0.6 }),
  paint: P({ color: 0xd2d6db, metalness: 0.1, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.12 }),
  paintIn: P({ color: 0xcfd4da, metalness: 0.2, roughness: 0.45 }),
  linerAc: P({ color: 0x252b32, metalness: 0.3, roughness: 0.82, defs: { PERF: '' } }),
  spinner: P({ color: 0x23282e, metalness: 0.25, roughness: 0.28, clearcoat: 0.85, clearcoatRoughness: 0.08, defs: { SPIRAL: '' } }),
  cap: P({ color: 0xe0562c, metalness: 0.25, roughness: 0.55, side: THREE.DoubleSide, defs: { HATCH: '' }, noCutDiscard: true }),
  tbc: P({ color: 0xb9a888, metalness: 0.2, roughness: 0.78, side: THREE.DoubleSide, emissive: 0x000000 }),
  bearing: P({ color: 0xe3e6eb, metalness: 1, roughness: 0.16 }),
  shaft1: P({ color: SPOOL_COL.n1, metalness: 1, roughness: 0.22 }),
  shaft2: P({ color: SPOOL_COL.n2, metalness: 1, roughness: 0.24 }),
  disc1: P({ color: 0x8fb4d8, metalness: 1, roughness: 0.34 }),
  disc2: P({ color: 0xc9a66a, metalness: 1, roughness: 0.36 }),
  dark: P({ color: 0x1b1f24, metalness: 0.6, roughness: 0.6 }),
  plug: P({ color: 0x7b7f86, metalness: 0.9, roughness: 0.5, emissive: 0x000000 }),
  copper: P({ color: 0xc27a4a, metalness: 1, roughness: 0.3 }),
  ring: P({ color: 0xaeb8c4, metalness: 0.35, roughness: 0.45 }),
  blackSteel: P({ color: 0x2c3036, metalness: 0.9, roughness: 0.4 }),
};

export function makeMat(name, ghostU, extra = {}) {
  const d = CAT[name];
  if (!d) throw new Error('unknown material ' + name);
  const o = { color: d.color, metalness: d.metalness, roughness: d.roughness, side: d.side ?? THREE.FrontSide };
  if (d.emissive !== undefined) o.emissive = d.emissive;
  if (d.clearcoat) { o.clearcoat = d.clearcoat; o.clearcoatRoughness = d.clearcoatRoughness ?? 0.2; }
  const m = new THREE.MeshPhysicalMaterial(o);
  m.name = name;
  const cut = extra.cut ?? true;
  patchMaterial(m, { cut, ghost: ghostU, defs: { ...(d.defs || {}), ...(extra.defs || {}) }, key: name + (extra.key || ''), blur: extra.blur });
  return m;
}
