/* ============================================================================
   Scene 03  PARAMETRIC SURFACES / TORUS KNOTS   (5.0 - 7.5 s)
   The mesh is only a (u,v) grid. In the vertex shader a space curve K(u) (a blend of a circle, the trefoil (2,3)
   and the cinquefoil (2,5) torus knots) gets an exact Frenet frame from its analytic K', K''; the tube is
       S(u,v) = K(u) + rho (cos v N + sin v B)       and its normal is simply  cos v N + sin v B.
   All three curves share one parameter, so the morph never tears. Iso-lines are anti-aliased with fwidth().
   ========================================================================== */
const SURF = { prog: null, floor: null, vao: null, nIdx: 0, ready: false };

SCENE_IMPL.surface = {
  samples: 4,
  init() {
    const gl = GFX.gl;
    const KNOT = `
void knot(float u, float p, float q, float R, float r, out vec3 C, out vec3 C1, out vec3 C2){
  float rho = R + r*cos(q*u), r1 = -r*q*sin(q*u), r2 = -r*q*q*cos(q*u);
  float cp = cos(p*u), sp = sin(p*u);
  C  = vec3(rho*cp, r*sin(q*u), rho*sp);
  C1 = vec3(r1*cp - p*rho*sp, r*q*cos(q*u), r1*sp + p*rho*cp);
  C2 = vec3(r2*cp - 2.*p*r1*sp - p*p*rho*cp, -r*q*q*sin(q*u), r2*sp + 2.*p*r1*cp - p*p*rho*sp);
}`;
    const vs = `#version 300 es
precision highp float;
in vec2 a_uv;
uniform mat4 uVP, uModel; uniform vec3 uW; uniform float uTube;
out vec3 vW; out vec3 vN; out vec2 vUV;
const float TAU = 6.28318530718;
${KNOT}
void main(){
  float u = a_uv.x*TAU, v = a_uv.y*TAU;
  vec3 C0,C10,C20, C1_,C11,C21, C2_,C12,C22;
  knot(u, 1., 0., 1.55, 0., C0, C10, C20);
  knot(u, 2., 3., 1.30, 0.62, C1_, C11, C21);
  knot(u, 2., 5., 1.35, 0.50, C2_, C12, C22);
  vec3 C  = uW.x*C0  + uW.y*C1_ + uW.z*C2_;
  vec3 D1 = uW.x*C10 + uW.y*C11 + uW.z*C12;
  vec3 D2 = uW.x*C20 + uW.y*C21 + uW.z*C22;
  vec3 T = normalize(D1); vec3 B = normalize(cross(D1, D2)); vec3 N = cross(B, T);
  vec3 nrm = cos(v)*N + sin(v)*B;
  vec3 P = C + uTube*nrm;
  vec4 w = uModel*vec4(P,1.);
  vW = w.xyz; vN = mat3(uModel)*nrm; vUV = a_uv;
  gl_Position = uVP*w;
}`;
    const fs = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; in vec2 vUV;
uniform vec3 uCam; uniform float uTime; uniform float uLines;
out vec4 o;
const float TAU = 6.28318530718;
float lineAA(float x, float w){ float fw = fwidth(x); float d = abs(fract(x-.5)-.5)/max(fw,1e-5); return 1.-clamp(d-w,0.,1.); }
vec3 env(vec3 d){
  float h = d.y*.5+.5;
  vec3 sky = mix(vec3(.006,.008,.02), vec3(.05,.06,.15), h);
  float k1 = pow(max(dot(d, normalize(vec3(-.5,.8,.5))),0.), 18.);
  float k2 = pow(max(dot(d, normalize(vec3(.85,.15,-.4))),0.), 36.);
  float k3 = pow(max(dot(d, normalize(vec3(.0,-.5,.85))),0.), 26.);
  float k4 = pow(max(dot(d, normalize(vec3(-.9,.1,-.3))),0.), 50.);
  return sky + k1*vec3(1.,.95,.9)*1.7 + k2*vec3(.24,.88,1.)*2.4 + k3*vec3(1.,.36,.23)*1.7 + k4*vec3(.54,.42,1.)*2.0;
}
void main(){
  vec3 V = normalize(uCam - vW);
  vec3 N = normalize(vN);
  bool back = dot(N,V) < 0.; if(back) N = -N;
  float ndv = clamp(dot(N,V),0.,1.);
  vec3 Rr = reflect(-V,N);
  float fres = .035 + .965*pow(1.-ndv,5.);
  vec3 col = vec3(.010,.014,.036);
  vec3 L1 = normalize(vec3(-.4,.9,.5)), L2 = normalize(vec3(.8,.2,-.5));
  col += vec3(.9,.95,1.)*max(dot(N,L1),0.)*.07 + vec3(.2,.7,1.)*max(dot(N,L2),0.)*.12;
  col += env(Rr)*(.30+1.5*fres);
  vec3 iri = .5+.5*cos(TAU*(vec3(0.,.33,.67) + ndv*1.3 + vUV.x*.5 + uTime*.06));
  col += iri*pow(1.-ndv,3.)*.6;
  float lu = lineAA(vUV.x*96., .5), lv = lineAA(vUV.y*14., .5);
  float l = max(lu*.75, lv);
  vec3 lc = mix(vec3(.24,.88,1.), vec3(1.,.36,.23), .5+.5*sin(vUV.x*TAU*2.+uTime*1.5));
  col += lc*l*(.55+1.6*pow(1.-ndv,1.4))*uLines;
  if(back) col *= .55;
  o = vec4(col,1.);
}`;
    SURF.prog = GFX.prog(vs, fs, ['a_uv']);
    // floor: fullscreen ray-cast polar grid + glow pool + backdrop gradient
    const fvs = `#version 300 es
in vec2 a; out vec2 vUv; void main(){ vUv=a*.5+.5; gl_Position=vec4(a,0.,1.); }`;
    const ffs = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform mat4 uInvVP; uniform vec3 uCam; uniform float uTime, uFloorY;
float lineAA(float x, float w){ float fw = fwidth(x); float d = abs(fract(x-.5)-.5)/max(fw,1e-5); return 1.-clamp(d-w,0.,1.); }
void main(){
  vec2 ndc = vUv*2.-1.;
  vec4 p = uInvVP*vec4(ndc,1.,1.); p.xyz /= p.w;
  vec3 rd = normalize(p.xyz-uCam);
  vec3 col = mix(vec3(.020,.026,.062), vec3(.003,.004,.010), clamp(length(ndc*vec2(.9,1.1)),0.,1.));
  float tt = (uFloorY-uCam.y)/rd.y;
  if(tt>0.){
    vec3 h = uCam + rd*tt;
    float r = length(h.xz), ang = atan(h.z,h.x);
    float fade = exp(-r*.34)*smoothstep(0.,.6,r)*clamp(-rd.y*6.,0.,1.);
    float rings = lineAA(r/.6, .35);
    float spokes = lineAA(ang/(6.28318/48.), .35)*smoothstep(1.,2.5,r);
    float g = max(rings, spokes*.7);
    col += vec3(.24,.80,1.)*g*fade*.55;
    col += vec3(.24,.55,1.)*exp(-r*r*.16)*.10 + vec3(1.,.36,.23)*exp(-r*r*.9)*.05;
    col *= 1. - .6*exp(-r*r*1.2)*0.0;
  }
  o = vec4(col,1.);
}`;
    SURF.floor = GFX.prog(fvs, ffs, ['a']);
    // mesh
    const NU = 480, NV = 96, verts = new Float32Array((NU + 1) * (NV + 1) * 2); let k = 0;
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) { verts[k++] = i / NU; verts[k++] = j / NV; }
    const idx = new Uint32Array(NU * NV * 6); k = 0;
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1;
      idx[k++] = a; idx[k++] = b; idx[k++] = c; idx[k++] = b; idx[k++] = d; idx[k++] = c;
    }
    SURF.vao = gl.createVertexArray(); gl.bindVertexArray(SURF.vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    SURF.nIdx = idx.length; gl.bindVertexArray(null); SURF.ready = true;
  },
  state(lt, jx = 0, jy = 0) {
    const m1 = E.io3(prog(lt, 0.9 * BEAT, 2.9 * BEAT)), m2 = E.io3(prog(lt, 3.3 * BEAT, 5.4 * BEAT));
    const w = [1 - m1, m1 * (1 - m2), m1 * m2];
    const az = 0.65 + 0.42 * lt + 0.12 * Math.sin(lt * 2), el = 0.30 - 0.07 * Math.min(1, lt / 2);
    const dist = 10.2 - 0.9 * E.out3(prog(lt, 0, 2.5));
    const eye = [dist * Math.sin(az) * Math.cos(el), dist * Math.sin(el) + 0.6, dist * Math.cos(az) * Math.cos(el)];
    const proj = M4.mul(M4.translate(2 * jx / GFX.w, -2 * jy / GFX.h, 0), M4.persp(34 * PI / 180, W / H, 0.5, 60));
    const view = M4.lookAt(eye, [0.9, 0.0, 0], [0, 1, 0]);
    const vp = M4.mul(proj, view);
    const model = M4.mul(M4.rotY(0.5 + lt * 0.55), M4.mul(M4.rotX(0.5 * Math.sin(lt * 1.3 + 0.4)), M4.rotZ(0.18 * Math.sin(lt * 0.9))));
    return { w, m1, m2, eye, vp, model };
  },
  bg(lt, t, fx) {
    const gl = GFX.gl, S = this.state(lt, fx.jx, fx.jy);
    GFX.bgBegin([0.004, 0.005, 0.012, 1]);
    // floor
    gl.disable(gl.DEPTH_TEST);
    SURF.floor.use().u('uInvVP', M4.inv(S.vp)).u('uCam', S.eye).u('uTime', t).u('uFloorY', -2.55);
    GFX.fsq();
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    // knot tube
    const tube = lerp(0.52, 0.30, S.m1) - 0.04 * S.m2;
    SURF.prog.use().u('uVP', S.vp).u('uModel', S.model).u('uW', S.w).u('uTube', tube).u('uCam', S.eye).u('uTime', t).u('uLines', 1.0);
    gl.bindVertexArray(SURF.vao);
    gl.drawElements(gl.TRIANGLES, SURF.nIdx, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    GFX.bgEnd();
  },
  fx(fx, lt) { fx.bloom = 0.8; fx.bloomThresh = 0.7; fx.vig = 0.3; fx.hudAccent = C.violet; },
  draw(ctx, lt, t, fx, sc) {
    const S = this.state(lt);
    // headline
    revealLine(ctx, 'TIE SPACE', 68, 200, 108, ez(E.out5, lt, 0.05, 0.55), { weight: 800, color: rgb(C.paper) });
    revealLine(ctx, 'IN KNOTS.', 68, 300, 108, ez(E.out5, lt, 0.16, 0.66), { weight: 800, color: rgb(C.violet) });
    // orbit ring on the floor, projected with the same camera
    const ringR = 3.6, fy = -2.55;
    ctx.save(); ctx.strokeStyle = rgb(C.aqua, 0.5); ctx.lineWidth = 1.4;
    ctx.beginPath(); for (let i = 0; i <= 160; i++) { const a = i / 160 * TAU, p = M4.project(S.vp, [Math.cos(a) * ringR, fy, Math.sin(a) * ringR]); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } ctx.stroke();
    ctx.lineWidth = 1.2; ctx.strokeStyle = rgb(C.aqua, 0.6);
    for (let i = 0; i < 72; i++) {
      const a = i / 72 * TAU + t * 0.25, l = i % 6 === 0 ? 0.28 : 0.12;
      const p0 = M4.project(S.vp, [Math.cos(a) * ringR, fy, Math.sin(a) * ringR]), p1 = M4.project(S.vp, [Math.cos(a) * (ringR + l), fy, Math.sin(a) * (ringR + l)]);
      ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
    }
    ctx.restore();
    // (p,q) read-out
    const names = ['CIRCLE', 'TREFOIL', 'CINQUEFOIL'], pq = ['(1, 0)', '(2, 3)', '(2, 5)'];
    const wi = S.w.indexOf(Math.max(...S.w));
    const a0 = ez(E.out3, lt, 0.3, 0.7);
    text(ctx, 'TORUS KNOT  (p, q)', W - 64, 140, { font: FONT.mono(500, 13), color: rgb(C.paper, 0.55), align: 'right', ls: 3, alpha: a0 });
    text(ctx, pq[wi], W - 64, 250, { font: FONT.disp(800, 120), color: rgb(C.violet), align: 'right', alpha: a0 });
    text(ctx, names[wi], W - 64, 292, { font: FONT.mono(700, 18), color: rgb(C.paper, 0.85), align: 'right', ls: 4, alpha: a0 });
    // bottom-left info
    const ia = ez(E.out3, lt, 0.45, 0.9);
    text(ctx, 'χ = 0   ·   GENUS 1   ·   EVERY KNOT IS A TORUS', 68, H - 262, { font: FONT.mono(500, 13), color: rgb(C.paper, 0.6), ls: 2, alpha: ia });
    drawFormula(ctx, '*S*(*u*,*v*) = *K*(*u*) + ρ(cos *v* **N** + sin *v* **B**)'.replace(/\*\*/g, ''), 68, H - 218, 30, { color: rgb(C.paper, 0.92), alpha: ia });
    drawFormula(ctx, '*K*(*u*) = ((*R* + *r*cos *qu*)cos *pu*,  *r*sin *qu*,  (*R* + *r*cos *qu*)sin *pu*)', 68, H - 176, 24, { color: rgb(C.violet, 0.9), alpha: ia });
  },
};
