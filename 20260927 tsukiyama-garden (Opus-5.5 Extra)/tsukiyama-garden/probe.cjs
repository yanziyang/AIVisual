const L = require('./_layout.cjs');
const f = (x,z)=>L.terrainH(x,z).toFixed(2);
const P = (name,x,z)=>console.log(name.padEnd(22), x.toFixed(2), z.toFixed(2), 'h=', f(x,z), 'wsd=', L.waterSD(x,z).toFixed(2));
// shoreline scan along x=-16.5 for waterfall
let s=''; for (let z=-13; z<=-6; z+=0.5) s += `${z}:${f(-16.6,z)} `; console.log('x=-16.6 scan', s);
s=''; for (let z=-19; z<=-11; z+=0.5) s += `${z}:${f(-2.4,z)} `; console.log('pav x=-2.4', s);
for (const Lt of L.LANTERNS) P('lantern '+Lt.type, Lt.x, Lt.z);
P('bridge a', ...L.BRIDGE.a); P('bridge b', ...L.BRIDGE.b);
for (let k=0;k<=10;k++){ const t=k/10; const x=L.BRIDGE.a[0]+(L.BRIDGE.b[0]-L.BRIDGE.a[0])*t, z=L.BRIDGE.a[1]+(L.BRIDGE.b[1]-L.BRIDGE.a[1])*t; process.stdout.write(`${t}:${f(x,z)} `);} console.log();
const S=L.STEPPING; for (let k=0;k<S.n;k++){ const t=k/(S.n-1); process.stdout.write(f(S.a[0]+(S.b[0]-S.a[0])*t, S.a[1]+(S.b[1]-S.a[1])*t)+' ');} console.log(' <- stepping');
for (const T of L.TREES) P('tree '+T.t, T.x, T.z);
