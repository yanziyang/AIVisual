const L = require('./_layout.cjs'); const f=(x,z)=>L.terrainH(x,z).toFixed(2);
let s=''; for (let z=-13; z<=-7.5; z+=0.25) s += `${z}:${f(-16.8,z)} `; console.log('fall scan', s);
for (const [n,x,z] of [['kasuga pav',2.3,-15.1],['maple isle',12.9,-0.2],['cam south',2,16],['kotoji',-1.05,8.55]]) console.log(n, f(x,z), L.waterSD(x,z).toFixed(2));
