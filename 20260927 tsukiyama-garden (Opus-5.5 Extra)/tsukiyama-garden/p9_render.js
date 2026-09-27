/* ---------------- Assemble the garden ---------------- */
const STATS = {};
const tBuild = performance.now();
const STATIC = new Mesh(), FOL = new Mesh(), WF = new Mesh();
buildTerrain(STATIC); STATS.terrainTris = STATIC.ix.length/3;
STATS.bankRocks = bankRocks(STATIC);
featureRocks(STATIC);
buildPavilion(STATIC);
buildBridge(STATIC);
for (const Ln of LANTERNS) buildLantern(STATIC, Ln);
for (const T of TREES) (T.t === 'pine') ? pineTree(STATIC, FOL, T) : broadTree(STATIC, FOL, T, T.t);
const BG = shrubsAndBackground(STATIC, FOL);
irises(STATIC); lilies(STATIC); buildWaterfall(WF);
const KOIM = buildKoiMesh(); initKoi();
Object.assign(STATS, { staticTris: STATIC.ix.length/3, staticVerts: STATIC.count, cards: FOL.ix.length/6, koiTris: KOIM.ix.length/3,
  backgroundTrees: BG.nb, azaleas: BG.na, lamps: LAMPS.length, buildMs: Math.round(performance.now() - tBuild) });
if (DEBUG) console.log('generated in', STATS.buildMs, 'ms', JSON.stringify(STATS));
const vStatic = meshVAO(STATIC), vFol = meshVAO(FOL), vFall = meshVAO(WF), vKoi = meshVAO(KOIM);
STATIC.v = STATIC.ix = FOL.v = FOL.ix = null;

const PART_MAX = 2600, partData = new Float32Array(PART_MAX*4*STRIDE);
const vPart = (() => {
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, partData.byteLength, gl.DYNAMIC_DRAW);
  for (const [loc, n, off] of [[0,3,0],[1,3,3],[2,4,6],[3,2,10],[4,4,12]]){ gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, STRIDE*4, off*4); }
  const idx = new Uint32Array(PART_MAX*6); for (let k=0;k<PART_MAX;k++) idx.set([4*k,4*k+1,4*k+2,4*k,4*k+2,4*k+3], 6*k);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.bindVertexArray(null); return { vao, vb };
})();

const atlasTex = (() => {
  const A = paintAtlas(), t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, A.size, A.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, A.data);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, 6);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (extAniso) gl.texParameterf(gl.TEXTURE_2D, extAniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);
  return t;
})();

const tProg = performance.now();
const PR = {
  st:  prog(SCENE_VS, STATIC_FS, 'static'),
  stR: prog(SCENE_VS, STATIC_FS, 'static-reflection', '#define REFL'),
  stS: prog(SCENE_VS, SHADOW_FS, 'static-shadow'),
  fo:  prog(SCENE_VS, FOLIAGE_FS, 'foliage', '#define FOLIAGE'),
  foR: prog(SCENE_VS, FOLIAGE_FS, 'foliage-reflection', '#define FOLIAGE\n#define REFL'),
  foS: prog(SCENE_VS, FOLIAGE_FS, 'foliage-shadow', '#define FOLIAGE\n#define SHADOW'),
  koi: prog(KOI_VS, KOI_FS, 'koi'),
  sky: prog(VS, SKY_FS, 'sky'),
  water: prog(VS, WATER_FS, 'water'),
  fall: prog(SCENE_VS, FALL_FS, 'waterfall'),
};
STATS.shaderMs = Math.round(performance.now() - tProg);
if (DEBUG) console.log('shaders compiled in', STATS.shaderMs, 'ms');

/* ---- sun shadow map ---- */
const SHS = Math.min(DEVICE_SMALL() ? 2048 : 4096, gl.getParameter(gl.MAX_TEXTURE_SIZE));
function DEVICE_SMALL(){ return Math.min(screen.width, screen.height) < 700; }
const shadowTex = depthTex(SHS, SHS, true);
const shadowFB = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTex, 0);
gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);

/* ---- frame state: everything the shaders read ---- */
const S = {
  hour: 16.3, season: [0,0,1,0], seasonT: [0,0,1,0], wind: 0.35, clarity: 0.55, rain: 0, rainT: 0, snow: 0,
  sun: [0,1,0], sunCol: [0,0,0], zen: [0,0,0], hor: [0,0,0], glow: [0,0,0], ambSky: [0,0,0], ambGround: [0,0,0],
  exposure: 0.63, lantern: 0, cloud: 0.35, hazeK: 0.0032, sigA: [0,0,0], sigS: [0,0,0], windV: [0,0,0], time: 0, shadowVP: new Float32Array(16),
};
function sunFromHour(h){
  const k = (h - 6)/12, s = Math.sin(Math.PI*k);
  const el = (58*Math.PI/180)*(k >= 0 && k <= 1 ? s : 0.35*s), az = (90 + 180*k)*Math.PI/180;
  return { el, v: [Math.sin(az)*Math.cos(el), Math.sin(el), -Math.cos(az)*Math.cos(el)] };
}
const lerp3 = (a,b,t) => a.map((v,i) => v + (b[i]-v)*t);
function atmosphere(){
  const { el, v } = sunFromHour(S.hour); S.sun = v;
  const se = Math.sin(el), rain = S.rain;
  const m = 1/(Math.max(se, 0) + 0.15*Math.pow(Math.max(el*180/Math.PI + 3.885, 0.1), -1.253));
  const vis = smooth(-0.03, 0.05, se);
  S.sunCol = [0.1, 0.19, 0.42].map((t,i) => [1.0,0.95,0.86][i]*6.6*Math.exp(-t*Math.min(m, 38)*0.55)*vis*(1 - 0.9*rain));
  const day = smooth(-0.14, 0.32, se), gold = smooth(0.4, 0.02, se)*smooth(-0.12, 0.0, se);
  let zen = lerp3([0.012,0.02,0.045], [0.1,0.23,0.56], day);
  let hor = lerp3([0.05,0.045,0.06], [0.6,0.71,0.84], day);
  hor = lerp3(hor, [0.95,0.6,0.38].map(x => x*Math.max(day, 0.25)), gold*0.65);
  zen = lerp3(zen, zen.map((x,i) => x*[0.8,0.85,1.0][i]), gold);
  let glow = [1.0,0.86,0.66].map((x,i) => x*lerp(1, [1.3,0.75,0.4][i], gold)*Math.max(vis, 0.3*smooth(-0.15, 0, se)));
  const grey = [0.32,0.34,0.37].map(x => x*Math.max(day, 0.08));
  zen = lerp3(zen, grey.map(x => x*0.85), rain); hor = lerp3(hor, grey, rain); glow = glow.map(x => x*(1 - 0.85*rain));
  S.zen = zen; S.hor = hor; S.glow = glow;
  S.ambSky = zen.map((x,i) => (x*0.55 + hor[i]*0.45)*Math.PI*0.56);
  S.ambGround = [0.13,0.14,0.09].map((g,i) => g*(S.sunCol[i]*Math.max(se, 0) + S.ambSky[i])*0.3);
  S.exposure = 0.63*lerp(3.4, 1.0, smooth(-0.1, 0.35, se))*(1 + 0.7*rain);
  S.lantern = clamp(smooth(0.2, -0.05, se) + rain*0.25, 0, 1);
  S.cloud = clamp(0.3 + 0.7*rain, 0, 1);
  S.hazeK = 0.0032 + 0.012*rain + 0.004*S.season[3];
  const c = S.clarity;
  S.sigA = lerp3([0.6,0.24,0.46], [0.36,0.07,0.085], c); S.sigS = lerp3([0.15,0.18,0.14], [0.026,0.048,0.062], c);
  const wd = [0.8, 0, 0.6], ws = 0.25 + 1.6*S.wind + 0.8*rain; S.windV = wd.map(x => x*ws);
  // sun shadow camera: orthographic, never lower than ~6 degrees so the map stays usable at dusk
  let d = v3.norm([v[0], Math.max(v[1], 0.1), v[2]]);
  const F = v3.mul(d, -1), pos = v3.madd([-1, 1, -3], d, 150), R = v3.norm(v3.cross(F, [0,1,0])), U = v3.cross(R, F);
  S.shadowVP = M4.mul(M4.ortho(-46, 46, -46, 46, 10, 330), M4.view(pos, R, U, F));
}
const koiP = new Float32Array(64), koiD = new Float32Array(32), lampData = new Float32Array(32);
LAMPS.slice(0, 8).forEach((l,i) => lampData.set(l, i*4));
function setCommon(p, camPos){
  const u = p.u;
  gl.uniform3fv(u.uSunDir, S.sun); gl.uniform3fv(u.uSunCol, S.sunCol); gl.uniform3fv(u.uSkyZen, S.zen); gl.uniform3fv(u.uSkyHor, S.hor);
  gl.uniform3fv(u.uSkyGlow, S.glow); gl.uniform3fv(u.uAmbSky, S.ambSky); gl.uniform3fv(u.uAmbGround, S.ambGround); gl.uniform3fv(u.uCamPos, camPos);
  gl.uniform1f(u.uTime, S.time); gl.uniform1f(u.uSnow, S.snow); gl.uniform1f(u.uWet, S.rain); gl.uniform1f(u.uLantern, S.lantern);
  gl.uniform1f(u.uCloud, S.cloud); gl.uniform1f(u.uHazeK, S.hazeK); gl.uniform4fv(u.uSeason, S.season);
  gl.uniform1i(u.uShadow, 0); gl.uniform1i(u.uCaus, 1); gl.uniform1i(u.uRipN, 2); gl.uniform1i(u.uPeb, 3); gl.uniform1i(u.uAtlas, 4); gl.uniform1i(u.uNoise, 9);
  gl.uniformMatrix4fv(u.uShadowVP, false, S.shadowVP); gl.uniform1f(u.uShadowTexel, 1/SHS);
  gl.uniform2fv(u.uCausShift, causShift); gl.uniform1f(u.uCausL, L);
  gl.uniform4f(u.uRipRect, RIP.x0, RIP.z0, RIP.sx, RIP.sz);
  gl.uniform3fv(u.uSigA, S.sigA); gl.uniform3fv(u.uSigS, S.sigS);
  gl.uniform4fv(u.uKoiP, koiP); gl.uniform2fv(u.uKoiD, koiD); gl.uniform1i(u.uNKoi, Math.min(16, koi.length));
  gl.uniform4fv(u.uLamp, lampData); gl.uniform1i(u.uNLamp, Math.min(8, LAMPS.length));
  gl.uniform3fv(u.uWindV, S.windV);
}
function bindCommonTextures(){ bindT(0, shadowTex); bindT(1, causRT.t); bindT(2, ripN.t); bindT(3, pebTex); bindT(4, atlasTex); bindT(9, noiseTex); }
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
let W=0, H=0, hdrRT, sceneRT, reflRT, hdrDepthFB, qA, qS, qB, qC, streakRT, b1, b2, b2t;
const DPR = Math.min(window.devicePixelRatio||1, 2);
let quality = FIXED_T !== null ? 1.0 : (DPR > 1.5 ? 0.66 : 0.9);
function freeRT(r){ if (!r) return; gl.deleteTexture(r.t); if (r.d) gl.deleteTexture(r.d); gl.deleteFramebuffer(r.fb); }
function alloc(){
  const cw = Math.max(1, Math.round(innerWidth*DPR*quality)), ch = Math.max(1, Math.round(innerHeight*DPR*quality));
  if (cw === W && ch === H) return;
  W = cw; H = ch; canvas.width = W; canvas.height = H;
  for (const r of [hdrRT, sceneRT, reflRT, qA, qS, qB, qC, streakRT, b1, b2, b2t]) freeRT(r);
  if (hdrDepthFB) gl.deleteFramebuffer(hdrDepthFB);
  sceneRT = rtDepth(W, H, gl.RGBA16F);
  reflRT = rtDepth(Math.max(1, W>>1), Math.max(1, H>>1), gl.RGBA16F);
  hdrRT = rt(W, H, gl.RGBA16F);
  hdrDepthFB = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, hdrDepthFB);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, hdrRT.t, 0);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, sceneRT.d, 0);
  const qw = Math.max(1, W>>1), qh = Math.max(1, H>>1);
  qA = rt(qw,qh,gl.RGBA16F); qS = rt(qw,qh,gl.RGBA16F); qB = rt(qw,qh,gl.RGBA16F); qC = rt(qw,qh,gl.RGBA16F);
  if (GLARE_ON) { allocGlare(); streakRT = rt(gSW,gSH,gl.RGBA16F); } else { streakRT = rt(4,4,gl.RGBA16F); gl.bindFramebuffer(gl.FRAMEBUFFER, streakRT.fb); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); }
  b1 = rt(qw,qh,gl.RGBA16F);
  b2 = rt(Math.max(1,qw>>2),Math.max(1,qh>>2),gl.RGBA16F,{}); b2t = rt(b2.w,b2.h,gl.RGBA16F);
}
window.addEventListener('resize', alloc);

/* ---- passes ---- */
const FOV = 52*Math.PI/180, NEAR = 0.08, FAR = 420;
function drawMesh(p, VP, camPos, v, count){ gl.useProgram(p.p); setCommon(p, camPos); gl.uniformMatrix4fv(p.u.uVP, false, VP); gl.bindVertexArray(v.vao); gl.drawElements(gl.TRIANGLES, count ?? v.count, gl.UNSIGNED_INT, 0); }
function drawSky(mirror, B){
  gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
  gl.useProgram(PR.sky.p); setCommon(PR.sky, B.pos);
  gl.uniform3fv(PR.sky.u.uR, B.r); gl.uniform3fv(PR.sky.u.uU, B.u); gl.uniform3fv(PR.sky.u.uF, B.f);
  gl.uniform1f(PR.sky.u.uTanF, Math.tan(FOV/2)); gl.uniform1f(PR.sky.u.uAspect, W/H); gl.uniform1f(PR.sky.u.uMirror, mirror ? 1 : 0);
  fullscreen();
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS);
}
function shadowPass(){
  bindT(0, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB); gl.viewport(0, 0, SHS, SHS);
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS); gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 3.0); gl.disable(gl.CULL_FACE);
  drawMesh(PR.stS, S.shadowVP, [0,0,0], vStatic);
  drawMesh(PR.foS, S.shadowVP, [0,0,0], vFol);
  gl.disable(gl.POLYGON_OFFSET_FILL);
  bindT(0, shadowTex);
}
let nPartVerts = 0;
function drawGarden(B, VP, camPos, reflection){
  gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(reflection ? gl.CW : gl.CCW);
  drawMesh(reflection ? PR.stR : PR.st, VP, camPos, vStatic);
  gl.disable(gl.CULL_FACE);
  drawMesh(reflection ? PR.foR : PR.fo, VP, camPos, vFol);
  if (nPartVerts) drawMesh(reflection ? PR.foR : PR.fo, VP, camPos, vPart, nPartVerts/4*6);
  if (!reflection){
    gl.enable(gl.CULL_FACE);
    gl.useProgram(PR.koi.p); setCommon(PR.koi, camPos); gl.uniformMatrix4fv(PR.koi.u.uVP, false, VP); gl.bindVertexArray(vKoi.vao);
    for (const k of koi){
      gl.uniformMatrix4fv(PR.koi.u.uModel, false, koiMatrix(k));
      gl.uniform4f(PR.koi.u.uKoi, k.phase, k.amp, k.type, k.seed);
      gl.drawElements(gl.TRIANGLES, vKoi.count, gl.UNSIGNED_INT, 0);
    }
  }
  gl.disable(gl.CULL_FACE); gl.frontFace(gl.CCW);
}
function renderFrame(B, t){
  const view = M4.view(B.pos, B.r, B.u, B.f), proj = M4.persp(FOV, W/H, NEAR, FAR), VP = M4.mul(proj, view);
  const VPm = M4.mul(VP, new Float32Array([1,0,0,0, 0,-1,0,0, 0,0,1,0, 0,0,0,1]));
  const camM = [B.pos[0], -B.pos[1], B.pos[2]];
  koi.forEach((k,i) => { if (i < 16){ koiP.set([k.x, k.y, k.z, k.len], i*4); koiD.set([Math.sin(k.heading), Math.cos(k.heading)], i*2); } });
  bindCommonTextures();
  if (S.sunCol[0] + S.sunCol[1] > 0.001) shadowPass();
  // planar reflection (half resolution): the garden mirrored in the water plane, clipped at y = 0
  target(reflRT); gl.clear(gl.DEPTH_BUFFER_BIT);
  drawSky(true, B); drawGarden(B, VPm, camM, true);
  // the garden itself, including everything under the water (lit with caustics and absorption along the sun path)
  target(sceneRT); gl.clear(gl.DEPTH_BUFFER_BIT);
  drawSky(false, B); drawGarden(B, VP, B.pos, false);
  // water surface composite
  gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
  target(hdrRT); gl.useProgram(PR.water.p); setCommon(PR.water, B.pos);
  const u = PR.water.u;
  bindT(5, surfRT.t); bindT(6, sceneRT.t); bindT(7, sceneRT.d); bindT(8, reflRT.t);
  gl.uniform1i(u.uSurf, 5); gl.uniform1i(u.uScene, 6); gl.uniform1i(u.uDepth, 7); gl.uniform1i(u.uRefl, 8);
  gl.uniform3fv(u.uR, B.r); gl.uniform3fv(u.uU, B.u); gl.uniform3fv(u.uF, B.f);
  gl.uniform1f(u.uTanF, Math.tan(FOV/2)); gl.uniform1f(u.uAspect, W/H); gl.uniform1f(u.uNear, NEAR); gl.uniform1f(u.uFar, FAR); gl.uniform1f(u.uL, L);
  gl.uniformMatrix4fv(u.uVP, false, VP);
  fullscreen();
  bindT(6, null); bindT(7, null);
  // waterfall and foam, blended over the composite with the garden's depth
  gl.bindFramebuffer(gl.FRAMEBUFFER, hdrDepthFB); gl.viewport(0, 0, W, H);
  gl.enable(gl.DEPTH_TEST); gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  drawMesh(PR.fall, VP, B.pos, vFall);
  gl.disable(gl.BLEND); gl.depthMask(true); gl.disable(gl.DEPTH_TEST);
  post(t);
}
function post(t){
  gl.disable(gl.BLEND);
  gl.useProgram(pBright.p); bindT(0,hdrRT.t); gl.uniform1i(pBright.u.uSrc,0);
  target(qA); gl.uniform1f(pBright.u.uThr, 2.5); fullscreen();
  const every = FIXED_T!==null ? 1 : (quality < 0.55 ? 3 : (DPR > 1.5 ? 2 : 1));
  if (GLARE_ON && (glareTick++ % every === 0)) renderGlare();
  gl.useProgram(pBlur.p); gl.uniform1i(pBlur.u.uSrc,0);
  target(qB); bindT(0,qA.t); gl.uniform2f(pBlur.u.uDir,1,0); fullscreen();
  target(b1); bindT(0,qB.t); gl.uniform2f(pBlur.u.uDir,0,1); fullscreen();
  gl.useProgram(pCopy.p); target(b2); bindT(0,b1.t); gl.uniform1i(pCopy.u.uSrc,0); gl.uniform1f(pCopy.u.uK,1.0); fullscreen();
  gl.useProgram(pBlur.p);
  for (let i=0;i<2;i++){ target(b2t); bindT(0,b2.t); gl.uniform2f(pBlur.u.uDir,1.5,0); fullscreen(); target(b2); bindT(0,b2t.t); gl.uniform2f(pBlur.u.uDir,0,1.5); fullscreen(); }
  target(null); gl.useProgram(pFinal.p);
  bindT(0,hdrRT.t); bindT(1,streakRT.t); bindT(2,b1.t); bindT(3,b2.t);
  gl.uniform1i(pFinal.u.uHdr,0); gl.uniform1i(pFinal.u.uStreak,1); gl.uniform1i(pFinal.u.uB1,2); gl.uniform1i(pFinal.u.uB2,3);
  gl.uniform1f(pFinal.u.uExp, S.exposure); gl.uniform1f(pFinal.u.uNoPost, 0); gl.uniform1f(pFinal.u.uTime, t); gl.uniform2f(pFinal.u.uRes, W, H);
  gl.uniform1f(pFinal.u.uRain, S.rain);
  fullscreen();
}
