/* ---------------- Assemble the garden ---------------- */
const STATS = {};
const tBuild = performance.now();
const STATIC = new Mesh(), THIN = new Mesh(), FERNM = new Mesh(), TREEF = new Mesh();
buildTerrain(STATIC); STATS.terrainTris = STATIC.ix.length/3;
buildRocks(STATIC);
STATS.culms = buildFence(STATIC);
buildLantern(STATIC);
buildShishiStatic(STATIC);
for (const [x, z, R, H, sd] of TOKUSA) tokusa(STATIC, x, z, R, H, sd);
for (const [x, z, s, sd] of FERNS) fern(FERNM, x, z, s, sd);
groundLeaves(FERNM);
{ const r = mulberry(313); let n = 0;
  for (let k=0;k<900 && n<110;k++){ const x = YARD.x0 + 0.3 + r()*(YARD.x1 - YARD.x0 - 0.6), z = YARD.z0 + 0.3 + r()*(YARD.z1 - YARD.z0 - 0.6);
    if (occupied(x, z, 0.06)) continue; grassTuft(THIN, x, z, 0.09 + 0.14*r(), 1000 + k); n++; }
  STATS.tufts = n; }
mapleTree(STATIC, TREEF);
STATS.grove = bambooGrove(STATIC, TREEF);
const TUBEM = buildTube();
Object.assign(STATS, { staticTris: STATIC.ix.length/3, thinTris: THIN.ix.length/3, fernTris: FERNM.ix.length/3, treeCards: TREEF.ix.length/6,
  tubeTris: TUBEM.ix.length/3, buildMs: Math.round(performance.now() - tBuild) });
if (DEBUG) console.log('generated in', STATS.buildMs, 'ms', JSON.stringify(STATS));
const vStatic = meshVAO(STATIC), vThin = meshVAO(THIN), vFern = meshVAO(FERNM), vTree = meshVAO(TREEF), vTube = meshVAO(TUBEM);
STATIC.v = STATIC.ix = THIN.v = THIN.ix = FERNM.v = FERNM.ix = TREEF.v = TREEF.ix = null;
const dynFx = dynBuffer(), dynLeaf = dynBuffer();
const emptyVAO = gl.createVertexArray();
initLeaves();

const atlasTex = (() => {
  const A = paintAtlas(), t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, A.size, A.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, A.data);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, 7);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (extAniso) gl.texParameterf(gl.TEXTURE_2D, extAniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
  return t;
})();
const atlasRects = new Float32Array(ATLAS_RECTS.flat());

const tProg = performance.now();
const PR = {
  st:  prog(SCENE_VS, STATIC_FS, 'static'),
  stR: prog(SCENE_VS, STATIC_FS, 'static-reflection', '#define REFL'),
  stS: prog(SCENE_VS, SHADOW_FS, 'static-shadow'),
  fo:  prog(SCENE_VS, FOLIAGE_FS, 'foliage'),
  foR: prog(SCENE_VS, FOLIAGE_FS, 'foliage-reflection', '#define REFL'),
  foS: prog(SCENE_VS, FOLIAGE_FS, 'foliage-shadow', '#define SHADOW'),
  sky: prog(VS, SKY_FS, 'sky'),
  water: prog(VS, WATER_FS, 'water'),
  stream: prog(SCENE_VS, STREAM_FS, 'stream'),
  drop: prog(SCENE_VS, DROP_FS, 'droplets'),
  rain: prog(RAIN_VS, RAIN_FS, 'rain'),
  splash: prog(SPLASH_VS, SPLASH_FS, 'splash'),
};
STATS.shaderMs = Math.round(performance.now() - tProg);
if (DEBUG) console.log('shaders compiled in', STATS.shaderMs, 'ms');

/* ---- sun shadow map (only drawn while the sun breaks through) ---- */
const SHS = Math.min(2048, gl.getParameter(gl.MAX_TEXTURE_SIZE));
const shadowTex = depthTex(SHS, SHS, true);
const shadowFB = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTex, 0);
gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);

/* ---- height field: the yard seen from straight above, rendered once (sky occlusion, rain stops, splashes) ---- */
const HF = { x0: YARD.x0 - 0.1, z0: YARD.z0 - 0.1, sx: YARD.x1 - YARD.x0 + 0.2, sz: YARD.z1 - YARD.z0 + 0.2, top: 4.0, range: 5.0, n: 1024 };
const hfTex = depthTex(HF.n, HF.n, false);
const hfFB = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, hfFB); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, hfTex, 0);
gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);

/* ---- frame state: everything the shaders read ---- */
const S = {
  hour: 10.5, rain: 0.65, rainT: 0.65, wet: 1, wind: 0.25, lanternMode: 'auto',
  sun: [0,1,0], sunCol: [0,0,0], zen: [0,0,0], hor: [0,0,0], glow: [0,0,0], ambSky: [0,0,0], ambGround: [0,0,0], hazeCol: [0,0,0],
  exposure: 1, lantern: 0, cloud: 1, hazeK: 0.02, sigA: [1.3,0.75,0.62], sigS: [0.04,0.05,0.04], windV: [0,0,0], time: 0, shadowVP: new Float32Array(16),
};
function sunFromHour(h){
  const k = (h - 6)/12.5, s = Math.sin(Math.PI*k);
  const el = (55*Math.PI/180)*(k >= 0 && k <= 1 ? s : 0.35*s), az = (95 + 170*k)*Math.PI/180;
  return { el, v: [Math.sin(az)*Math.cos(el), Math.sin(el), -Math.cos(az)*Math.cos(el)] };
}
const lerp3 = (a,b,t) => a.map((v,i) => v + (b[i]-v)*t);
const lum3 = c => 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2];
function atmosphere(){
  const { el, v } = sunFromHour(S.hour); S.sun = v;
  const se = Math.sin(el), oc = clamp(0.42 + 0.58*Math.pow(S.rain, 0.5), 0, 1);
  const m = 1/(Math.max(se, 0) + 0.15*Math.pow(Math.max(el*180/Math.PI + 3.885, 0.1), -1.253));
  const vis = smooth(-0.03, 0.05, se);
  S.sunCol = [0.1, 0.19, 0.42].map((t,i) => [1.0,0.95,0.86][i]*6.0*Math.exp(-t*Math.min(m, 38)*0.55)*vis*Math.pow(1 - oc, 1.5));
  const day = smooth(-0.16, 0.3, se), gold = smooth(0.35, 0.02, se)*smooth(-0.12, 0.0, se);
  let zen = lerp3([0.011,0.017,0.036], [0.1,0.22,0.52], day), hor = lerp3([0.035,0.04,0.055], [0.55,0.65,0.78], day);
  hor = lerp3(hor, [0.9,0.55,0.35].map(x => x*Math.max(day, 0.2)), gold*0.6);
  const grey = [0.33,0.355,0.37].map((x,i) => x*Math.max(day, 0.03) + [0.006,0.009,0.016][i]);
  zen = lerp3(zen, grey.map(x => x*0.92), oc); hor = lerp3(hor, grey, oc);
  S.zen = zen; S.hor = hor;
  S.glow = [1.0,0.86,0.66].map(x => x*vis*(1 - oc)*0.8);
  S.ambSky = zen.map((x,i) => (x*0.6 + hor[i]*0.4)*Math.PI*0.62);
  S.ambGround = [0.1,0.15,0.06].map((g,i) => g*(S.sunCol[i]*Math.max(se, 0)*0.6 + S.ambSky[i])*0.35);
  S.hazeCol = lerp3(hor.map(x => x*0.32), [0.12,0.14,0.13].map(x => x*Math.max(day, 0.03)), 0.5*oc);
  S.cloud = oc;
  S.hazeK = 0.002 + 0.009*S.rain;
  const auto = smooth(0.12, -0.06, se);
  S.lantern = S.lanternMode === 'on' ? 1 : S.lanternMode === 'off' ? 0 : auto;
  // exposure follows the sky light, like a camera on auto; a little brighter at night so the lantern can carry the scene
  S.exposure = Math.min(19, 3.5/Math.pow(Math.max(lum3(S.ambSky) + 0.35*lum3(S.sunCol)*Math.max(se,0), 0.0025), 0.8));
  const wd = [0.8, 0, 0.55], ws = 0.15 + 1.3*S.wind + 0.4*S.rain; S.windV = wd.map(x => x*ws);
  const d = v3.norm([v[0], Math.max(v[1], 0.12), v[2]]), F = v3.mul(d, -1), pos = v3.madd([0, 0.6, 1.8], d, 30), R = v3.norm(v3.cross(F, [0,1,0])), U = v3.cross(R, F);
  S.shadowVP = M4.mul(M4.ortho(-9, 9, -9, 9, 5, 60), M4.view(pos, R, U, F));
}
const lampData = new Float32Array(16);
function setCommon(p, camPos){
  const u = p.u;
  gl.uniform3fv(u.uSunDir, S.sun); gl.uniform3fv(u.uSunCol, S.sunCol); gl.uniform3fv(u.uSkyZen, S.zen); gl.uniform3fv(u.uSkyHor, S.hor);
  gl.uniform3fv(u.uSkyGlow, S.glow); gl.uniform3fv(u.uAmbSky, S.ambSky); gl.uniform3fv(u.uAmbGround, S.ambGround); gl.uniform3fv(u.uCamPos, camPos);
  gl.uniform3fv(u.uHazeCol, S.hazeCol);
  gl.uniform1f(u.uTime, S.time); gl.uniform1f(u.uWet, S.wet); gl.uniform1f(u.uRain, S.rain); gl.uniform1f(u.uLantern, S.lantern);
  gl.uniform1f(u.uCloud, S.cloud); gl.uniform1f(u.uHazeK, S.hazeK);
  gl.uniform1i(u.uShadow, 0); gl.uniform1i(u.uCaus, 1); gl.uniform1i(u.uRipN, 2); gl.uniform1i(u.uPeb, 3); gl.uniform1i(u.uAtlas, 4); gl.uniform1i(u.uNoise, 9); gl.uniform1i(u.uHF, 10);
  gl.uniformMatrix4fv(u.uShadowVP, false, S.shadowVP); gl.uniform1f(u.uShadowTexel, 1/SHS);
  gl.uniform2fv(u.uCausShift, causShift); gl.uniform1f(u.uCausL, L);
  gl.uniform4f(u.uRipRect, RIP.x0, RIP.z0, RIP.sx, RIP.sz);
  gl.uniform4f(u.uHFRect, HF.x0, HF.z0, HF.sx, HF.sz); gl.uniform2f(u.uHFDepth, HF.top, HF.range);
  gl.uniform3fv(u.uSigA, S.sigA); gl.uniform3fv(u.uSigS, S.sigS);
  gl.uniform4fv(u.uLamp, lampData); gl.uniform1i(u.uNLamp, Math.min(4, LAMPS.length));
  gl.uniform3fv(u.uWindV, S.windV); gl.uniform1i(u.uUseModel, 0);
  if (u.uAtlasRect) gl.uniform4fv(u.uAtlasRect, atlasRects);
}
function bindCommonTextures(){ bindT(0, shadowTex); bindT(1, causRT.t); bindT(2, ripN.t); bindT(3, pebTex); bindT(4, atlasTex); bindT(9, noiseTex); bindT(10, hfTex); }
// 256x256 random texture for shader noise; G is R shifted by (37,17) so 3D noise needs a single fetch
const noiseTex = (() => {
  const n = 256, r = mulberry(4321), R = new Uint8Array(n*n), d = new Uint8Array(n*n*4);
  for (let i=0;i<n*n;i++) R[i] = Math.floor(r()*256);
  for (let y=0;y<n;y++) for (let x=0;x<n;x++){ const o = (y*n+x)*4; d[o] = R[y*n+x]; d[o+1] = R[((y+17)&255)*n + ((x+37)&255)]; d[o+2] = Math.floor(r()*256); d[o+3] = Math.floor(r()*256); }
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, n, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  return t;
})();

/* ---- render targets ---- */
let W=0, H=0, hdrRT, sceneRT, reflRT, hdrDepthFB, qA, qB, streakRT, b1, b2, b2t, dofA, dofB;
const DPR = Math.min(window.devicePixelRatio||1, 2);
let quality = FIXED_T !== null ? 1.0 : (DPR > 1.5 ? 0.66 : 0.9);
function freeRT(r){ if (!r) return; gl.deleteTexture(r.t); if (r.d) gl.deleteTexture(r.d); gl.deleteFramebuffer(r.fb); }
function alloc(){
  const cw = Math.max(1, Math.round(innerWidth*DPR*quality)), ch = Math.max(1, Math.round(innerHeight*DPR*quality));
  if (cw === W && ch === H) return;
  W = cw; H = ch; canvas.width = W; canvas.height = H;
  for (const r of [hdrRT, sceneRT, reflRT, qA, qB, streakRT, b1, b2, b2t, dofA, dofB]) freeRT(r);
  if (hdrDepthFB) gl.deleteFramebuffer(hdrDepthFB);
  sceneRT = rtDepth(W, H, gl.RGBA16F);
  reflRT = rtDepth(Math.max(1, W>>1), Math.max(1, H>>1), gl.RGBA16F);
  hdrRT = rt(W, H, gl.RGBA16F);
  hdrDepthFB = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, hdrDepthFB);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, hdrRT.t, 0);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, sceneRT.d, 0);
  const qw = Math.max(1, W>>1), qh = Math.max(1, H>>1);
  qA = rt(qw,qh,gl.RGBA16F); qB = rt(qw,qh,gl.RGBA16F); dofA = rt(qw,qh,gl.RGBA16F); dofB = rt(qw,qh,gl.RGBA16F);
  if (GLARE_ON) { allocGlare(); streakRT = rt(gSW,gSH,gl.RGBA16F); } else streakRT = rt(4,4,gl.RGBA16F);
  gl.bindFramebuffer(gl.FRAMEBUFFER, streakRT.fb); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
  b1 = rt(qw,qh,gl.RGBA16F);
  b2 = rt(Math.max(1,qw>>2),Math.max(1,qh>>2),gl.RGBA16F,{}); b2t = rt(b2.w,b2.h,gl.RGBA16F);
}
window.addEventListener('resize', alloc);

/* ---- passes ---- */
const FOV = 40*Math.PI/180, NEAR = 0.03, FAR = 160;
function drawMesh(p, VP, camPos, v, count, model){
  gl.useProgram(p.p); setCommon(p, camPos); gl.uniformMatrix4fv(p.u.uVP, false, VP);
  if (model){ gl.uniformMatrix4fv(p.u.uModel, false, model); gl.uniform1i(p.u.uUseModel, 1); }
  gl.bindVertexArray(v.vao); gl.drawElements(gl.TRIANGLES, count ?? v.count, gl.UNSIGNED_INT, 0);
}
function drawSky(mirror, B){
  gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
  gl.useProgram(PR.sky.p); setCommon(PR.sky, B.pos);
  gl.uniform3fv(PR.sky.u.uR, B.r); gl.uniform3fv(PR.sky.u.uU, B.u); gl.uniform3fv(PR.sky.u.uF, B.f);
  gl.uniform1f(PR.sky.u.uTanF, Math.tan(FOV/2)); gl.uniform1f(PR.sky.u.uAspect, W/H); gl.uniform1f(PR.sky.u.uMirror, mirror ? 1 : 0);
  fullscreen();
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS);
}
let tubeM = tubeMatrix(SHISHI.rest);
function shadowPass(){
  bindT(0, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB); gl.viewport(0, 0, SHS, SHS);
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS); gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 3.0); gl.disable(gl.CULL_FACE);
  drawMesh(PR.stS, S.shadowVP, [0,0,0], vStatic);
  drawMesh(PR.stS, S.shadowVP, [0,0,0], vThin);
  drawMesh(PR.stS, S.shadowVP, [0,0,0], vTube, undefined, tubeM);
  drawMesh(PR.foS, S.shadowVP, [0,0,0], vFern);
  drawMesh(PR.foS, S.shadowVP, [0,0,0], vTree);
  gl.disable(gl.POLYGON_OFFSET_FILL);
  bindT(0, shadowTex);
}
function heightFieldPass(){
  const cx = HF.x0 + HF.sx/2, cz = HF.z0 + HF.sz/2;
  const V = M4.view([cx, HF.top, cz], [1,0,0], [0,0,-1], [0,-1,0]);
  const P = M4.ortho(-HF.sx/2, HF.sx/2, HF.sz/2, -HF.sz/2, 0, HF.range);
  const VP = M4.mul(P, V);
  bindCommonTextures(); bindT(10, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, hfFB); gl.viewport(0, 0, HF.n, HF.n);
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT); gl.disable(gl.CULL_FACE);
  drawMesh(PR.stS, VP, [0,10,0], vStatic);
  drawMesh(PR.stS, VP, [0,10,0], vThin);
  drawMesh(PR.foS, VP, [0,10,0], vFern);
  bindT(10, hfTex);
}
function drawGarden(B, VP, camPos, reflection){
  gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(reflection ? gl.CW : gl.CCW);
  const st = reflection ? PR.stR : PR.st, fo = reflection ? PR.foR : PR.fo;
  drawMesh(st, VP, camPos, vStatic);
  drawMesh(st, VP, camPos, vTube, undefined, tubeM);
  gl.disable(gl.CULL_FACE);
  drawMesh(st, VP, camPos, vThin);
  drawMesh(fo, VP, camPos, vFern);
  drawMesh(fo, VP, camPos, vTree);
  if (dynLeaf.quads) drawMesh(fo, VP, camPos, dynLeaf, dynLeaf.quads*6);
  gl.frontFace(gl.CCW);
}
let viewVP = null;
function renderFrame(B, t){
  const view = M4.view(B.pos, B.r, B.u, B.f), proj = M4.persp(FOV, W/H, NEAR, FAR), VP = M4.mul(proj, view); viewVP = VP;
  const VPm = M4.mul(VP, new Float32Array([1,0,0,0, 0,-1,0,0, 0,0,1,0, 0,0,0,1]));
  const camM = [B.pos[0], -B.pos[1], B.pos[2]];
  bindCommonTextures();
  if (S.sunCol[0] + S.sunCol[1] > 0.02) shadowPass();
  // planar reflection (half resolution): the garden mirrored in the pond surface, clipped at y = 0
  target(reflRT); gl.clear(gl.DEPTH_BUFFER_BIT);
  drawSky(true, B); drawGarden(B, VPm, camM, true);
  // the garden itself, including the pond's walls and bed
  target(sceneRT); gl.clear(gl.DEPTH_BUFFER_BIT);
  drawSky(false, B); drawGarden(B, VP, B.pos, false);
  // water surface composite (Clearwater)
  gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
  target(hdrRT); gl.useProgram(PR.water.p); setCommon(PR.water, B.pos);
  const u = PR.water.u;
  bindT(5, surfRT.t); bindT(6, sceneRT.t); bindT(7, sceneRT.d); bindT(8, reflRT.t);
  gl.uniform1i(u.uSurf, 5); gl.uniform1i(u.uScene, 6); gl.uniform1i(u.uDepth, 7); gl.uniform1i(u.uRefl, 8);
  gl.uniform3fv(u.uR, B.r); gl.uniform3fv(u.uU, B.u); gl.uniform3fv(u.uF, B.f);
  gl.uniform1f(u.uTanF, Math.tan(FOV/2)); gl.uniform1f(u.uAspect, W/H); gl.uniform1f(u.uNear, NEAR); gl.uniform1f(u.uFar, FAR); gl.uniform1f(u.uL, L); gl.uniform1f(u.uAmp, 1.0);
  fullscreen();
  bindT(6, null); bindT(7, null);
  // transparent things, depth-tested against the garden: water jets, droplets, splash crowns, rain
  gl.bindFramebuffer(gl.FRAMEBUFFER, hdrDepthFB); gl.viewport(0, 0, W, H);
  gl.enable(gl.DEPTH_TEST); gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  // the jets write depth where they are visible, so depth of field keeps them in focus with the tube
  if (dynFx.nStream){ gl.depthMask(true); drawMesh(PR.stream, VP, B.pos, dynFx, dynFx.nStream/4*6); gl.depthMask(false); }
  if (dynFx.n > dynFx.nStream){ gl.useProgram(PR.drop.p); setCommon(PR.drop, B.pos); gl.uniformMatrix4fv(PR.drop.u.uVP, false, VP); gl.bindVertexArray(dynFx.vao);
    gl.drawElements(gl.TRIANGLES, (dynFx.n - dynFx.nStream)/4*6, gl.UNSIGNED_INT, dynFx.nStream/4*6*4); }
  if (S.rain > 0.01){
    const lp = LAMPS[0] || [0,0,0];
    for (const [p, n] of [[PR.splash, 2600], [PR.rain, 9000]]){
      gl.useProgram(p.p); const q = p.u;
      gl.uniformMatrix4fv(q.uVP, false, VP); gl.uniform3fv(q.uCamPos, B.pos); gl.uniform3fv(q.uCamF, B.f); gl.uniform3fv(q.uCamR, B.r); gl.uniform3fv(q.uCamU, B.u);
      gl.uniform3fv(q.uWindV, S.windV); gl.uniform1f(q.uTime, S.time); gl.uniform1f(q.uRain, S.rain); gl.uniform1f(q.uPx, 2/H);
      gl.uniform1i(q.uHF, 10); gl.uniform4f(q.uHFRect, HF.x0, HF.z0, HF.sx, HF.sz); gl.uniform2f(q.uHFDepth, HF.top, HF.range);
      gl.uniform3fv(q.uAmbSky, S.ambSky); gl.uniform3fv(q.uHazeCol, S.hazeCol); gl.uniform3f(q.uLampPos, lp[0], lp[1], lp[2]); gl.uniform1f(q.uLantern, S.lantern);
      gl.bindVertexArray(emptyVAO); gl.drawArrays(gl.TRIANGLES, 0, Math.round(n*Math.min(1, S.rain*1.15))*6);
    }
  }
  gl.disable(gl.BLEND); gl.depthMask(true); gl.disable(gl.DEPTH_TEST);
  post(t);
}
function post(t){
  gl.disable(gl.BLEND);
  gl.useProgram(pBright.p); bindT(0,hdrRT.t); gl.uniform1i(pBright.u.uSrc,0);
  target(qA); gl.uniform1f(pBright.u.uThr, 2.5); fullscreen();
  const glareNow = GLARE_ON && S.sunCol[0] > 0.4;
  if (glareNow && (glareTick++ % (quality < 0.55 ? 3 : 1) === 0)) renderGlare();
  else if (GLARE_ON && !glareNow && glareTick){ gl.bindFramebuffer(gl.FRAMEBUFFER, streakRT.fb); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); glareTick = 0; }
  gl.useProgram(pBlur.p); gl.uniform1i(pBlur.u.uSrc,0);
  target(qB); bindT(0,qA.t); gl.uniform2f(pBlur.u.uDir,1,0); fullscreen();
  target(b1); bindT(0,qB.t); gl.uniform2f(pBlur.u.uDir,0,1); fullscreen();
  gl.useProgram(pCopy.p); target(b2); bindT(0,b1.t); gl.uniform1i(pCopy.u.uSrc,0); gl.uniform1f(pCopy.u.uK,1.0); fullscreen();
  gl.useProgram(pBlur.p);
  for (let i=0;i<2;i++){ target(b2t); bindT(0,b2.t); gl.uniform2f(pBlur.u.uDir,1.5,0); fullscreen(); target(b2); bindT(0,b2t.t); gl.uniform2f(pBlur.u.uDir,0,1.5); fullscreen(); }
  if (cam.dof > 0.01){
    gl.useProgram(pCopy.p); target(dofA); bindT(0,hdrRT.t); gl.uniform1f(pCopy.u.uK,1.0); fullscreen();
    gl.useProgram(pBlur.p);
    for (let i=0;i<2;i++){ target(dofB); bindT(0,dofA.t); gl.uniform2f(pBlur.u.uDir,1.6,0); fullscreen(); target(dofA); bindT(0,dofB.t); gl.uniform2f(pBlur.u.uDir,0,1.6); fullscreen(); }
  }
  target(null); gl.useProgram(pFinal.p);
  bindT(0,hdrRT.t); bindT(1,streakRT.t); bindT(2,b1.t); bindT(3,b2.t); bindT(5, sceneRT.d); bindT(6, dofA.t);
  gl.uniform1i(pFinal.u.uHdr,0); gl.uniform1i(pFinal.u.uStreak,1); gl.uniform1i(pFinal.u.uB1,2); gl.uniform1i(pFinal.u.uB2,3); gl.uniform1i(pFinal.u.uDepth,5); gl.uniform1i(pFinal.u.uBlur,6);
  gl.uniform1f(pFinal.u.uExp, S.exposure); gl.uniform1f(pFinal.u.uNoPost, 0); gl.uniform1f(pFinal.u.uTime, t); gl.uniform2f(pFinal.u.uRes, W, H);
  gl.uniform1f(pFinal.u.uDof, cam.dof); gl.uniform1f(pFinal.u.uFocus, cam.dist); gl.uniform1f(pFinal.u.uNear, NEAR); gl.uniform1f(pFinal.u.uFar, FAR);
  fullscreen();
  bindT(5, null); bindT(6, null);
}
