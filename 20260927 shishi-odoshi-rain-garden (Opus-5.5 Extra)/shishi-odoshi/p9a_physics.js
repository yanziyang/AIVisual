/* ---------------- Shishi-odoshi physics ---------------- */
// One degree of freedom: the tube's angle th about the axle (+ = mouth up). Torques: the tube's own weight (its centre of
// mass sits behind the axle, so the empty tube rests on the stone), the water in the chamber, and axle damping.
// The water collects against the chamber's node; as the tube tilts, it slides toward the mouth (a longer lever), which is
// what makes the tip run away once it starts. It spills when it rises above the lowest point of the lip.
const TUBE = {
  m: 1.3,                  // kg, the culm itself
  com: -0.085,             // m, centre of mass along the axis (behind the axle)
  I0: 0.085,               // kg m^2 about the axle
  lc: SHISHI.mouth - SHISHI.node - 0.02,   // m, usable chamber length
  A: Math.PI*SHISHI.r*SHISHI.r,             // m^2, chamber cross-section
  e: 0.34,                 // restitution when the closed end strikes the stone
  damp: 0.006,             // N m s, axle friction and air
};
const SH = { th: SHISHI.rest, om: 0, V: 0, flow: 0.08, pour: 0, inflow: 0, clacks: 0, t: 0, lastClackT: -99, cycle: 0, impacts: [], tipped: false };
// litres the chamber holds before water reaches the lowest point of the lip, at angle th
function vCap(th){
  if (th <= 0.003) return 0;
  return clamp(TUBE.lc - SHISHI.r/Math.tan(th), 0, TUBE.lc)*TUBE.A*1000;
}
// lever arm (m from the axle) of the water's centre of mass
function waterArm(V, th){
  const lcen = V/1000/TUBE.A, spread = th > 0.01 ? 0.5*SHISHI.r/Math.tan(th) : TUBE.lc;
  return SHISHI.node + 0.5*Math.min(TUBE.lc, lcen + spread);
}
function stepShishi(dt, inflow){
  const S = SHISHI, g = 9.81;
  SH.t += dt;
  SH.V += inflow*dt;
  const cap = vCap(SH.th);
  let out = 0;
  if (SH.V > cap) out = (SH.V - cap)*8 + (SH.th < 0 ? SH.V*(1.5 + 9*Math.sin(-SH.th)) : 0);
  out = Math.min(out, SH.V/dt);
  SH.V -= out*dt; SH.pour = out;
  const mw = SH.V, arm = waterArm(SH.V, SH.th), c = Math.cos(SH.th);
  const tau = -TUBE.m*g*TUBE.com*c - mw*g*arm*c - TUBE.damp*SH.om;
  SH.om += tau/(TUBE.I0 + mw*arm*arm)*dt;
  SH.th += SH.om*dt;
  if (SH.th < S.rest - 0.12) SH.tipped = true;
  if (SH.th >= S.rest){
    SH.th = S.rest;
    const v = SH.om*Math.abs(S.back);            // m/s at the striking end
    if (v > 0.06){
      SH.impacts.push(v);
      if (v > 0.25){ SH.clacks++; if (SH.tipped){ if (SH.cycleStart !== undefined && !SH.manual) SH.cycle = SH.t - SH.cycleStart; SH.cycleStart = SH.t; SH.manual = false; } SH.lastClackT = SH.t; }
      SH.tipped = false;
      SH.om = -SH.om*TUBE.e;
    } else if (SH.om > 0) SH.om = 0;
  }
  if (SH.th <= S.stop){ SH.th = S.stop; if (SH.om < 0) SH.om = -SH.om*0.15; }
}
