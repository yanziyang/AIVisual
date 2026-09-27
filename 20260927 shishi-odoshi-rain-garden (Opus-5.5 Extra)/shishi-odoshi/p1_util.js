/* ---------------- Utilities: PRNG, noise, small vector maths ---------------- */
// mulberry32 PRNG, as in Clearwater: every placement below is seeded, so the garden is the same on every load.
function mulberry(a){ return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const clamp = (x,a,b) => x<a ? a : x>b ? b : x;
const lerp = (a,b,t) => a + (b-a)*t;
const smooth = (e0,e1,x) => { const t = clamp((x-e0)/(e1-e0),0,1); return t*t*(3-2*t); };
const TAU = Math.PI*2;

function hash2i(x,z,s){
  let h = (Math.imul(x|0, 374761393) + Math.imul(z|0, 668265263) + Math.imul(s|0, 1442695041))|0;
  h = Math.imul(h ^ (h>>>13), 1274126177); h ^= h>>>16; return (h>>>0)/4294967296;
}
function hash3i(x,y,z,s){
  let h = (Math.imul(x|0, 374761393) + Math.imul(y|0, 668265263) + Math.imul(z|0, 2246822519) + Math.imul(s|0, 1442695041))|0;
  h = Math.imul(h ^ (h>>>13), 1274126177); h ^= h>>>16; return (h>>>0)/4294967296;
}
function vnoise2(x,z,s=0){
  const ix=Math.floor(x), iz=Math.floor(z), fx=x-ix, fz=z-iz, ux=fx*fx*(3-2*fx), uz=fz*fz*(3-2*fz);
  const a=hash2i(ix,iz,s), b=hash2i(ix+1,iz,s), c=hash2i(ix,iz+1,s), d=hash2i(ix+1,iz+1,s);
  return a + (b-a)*ux + (c-a)*uz + (a-b-c+d)*ux*uz;
}
function fbm2(x,z,oct=4,s=0){
  let v=0, a=0.5, n=0;
  for (let i=0;i<oct;i++){ v += a*vnoise2(x,z,s+i*17); n += a; x = x*2.03+17.1; z = z*2.03-9.3; a *= 0.5; }
  return v/n;
}
function vnoise3(x,y,z,s=0){
  const ix=Math.floor(x), iy=Math.floor(y), iz=Math.floor(z);
  const fx=x-ix, fy=y-iy, fz=z-iz, ux=fx*fx*(3-2*fx), uy=fy*fy*(3-2*fy), uz=fz*fz*(3-2*fz);
  const h=(a,b,c)=>hash3i(ix+a,iy+b,iz+c,s);
  const x00=lerp(h(0,0,0),h(1,0,0),ux), x10=lerp(h(0,1,0),h(1,1,0),ux), x01=lerp(h(0,0,1),h(1,0,1),ux), x11=lerp(h(0,1,1),h(1,1,1),ux);
  return lerp(lerp(x00,x10,uy), lerp(x01,x11,uy), uz);
}
function fbm3(x,y,z,oct=4,s=0){
  let v=0, a=0.5, n=0;
  for (let i=0;i<oct;i++){ v += a*vnoise3(x,y,z,s+i*31); n += a; x=x*2.07+5.3; y=y*2.07-3.1; z=z*2.07+11.7; a*=0.5; }
  return v/n;
}

const v3 = {
  add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
  sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
  mul:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
  madd:(a,b,s)=>[a[0]+b[0]*s,a[1]+b[1]*s,a[2]+b[2]*s],
  dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  cross:(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]],
  len:(a)=>Math.hypot(a[0],a[1],a[2]),
  norm:(a)=>{ const l=Math.hypot(a[0],a[1],a[2])||1; return [a[0]/l,a[1]/l,a[2]/l]; },
  lerp:(a,b,t)=>[a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t],
};
// any unit vector perpendicular to n
function perp(n){ const a = Math.abs(n[1]) < 0.9 ? [0,1,0] : [1,0,0]; return v3.norm(v3.cross(a, n)); }
// rotate v about unit axis k by angle a (Rodrigues)
function rotAxis(v, k, a){
  const c=Math.cos(a), s=Math.sin(a), d=v3.dot(k,v), x=v3.cross(k,v);
  return [v[0]*c + x[0]*s + k[0]*d*(1-c), v[1]*c + x[1]*s + k[1]*d*(1-c), v[2]*c + x[2]*s + k[2]*d*(1-c)];
}

const M4 = {
  persp(fovy, asp, n, f){ const t = 1/Math.tan(fovy/2);
    return new Float32Array([t/asp,0,0,0, 0,t,0,0, 0,0,(f+n)/(n-f),-1, 0,0,2*f*n/(n-f),0]); },
  ortho(l,r,b,t,n,f){
    return new Float32Array([2/(r-l),0,0,0, 0,2/(t-b),0,0, 0,0,-2/(f-n),0, -(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]); },
  // view matrix from an orthonormal camera basis (R right, U up, F forward)
  view(pos, R, U, F){
    return new Float32Array([R[0],U[0],-F[0],0, R[1],U[1],-F[1],0, R[2],U[2],-F[2],0,
      -v3.dot(R,pos), -v3.dot(U,pos), v3.dot(F,pos), 1]); },
  mul(a,b){ const o = new Float32Array(16);
    for (let c=0;c<4;c++) for (let r=0;r<4;r++){ let s=0; for (let k=0;k<4;k++) s += a[k*4+r]*b[c*4+k]; o[c*4+r]=s; }
    return o; },
};
