/* ---------------- Sound: synthesised with Web Audio, no audio files ---------------- */
// Rain patter, the trickle into the tube (its pitch rises as the air column shortens), the pour, and the "kon":
// the closed end of the culm striking the stone, a few damped modes plus a click, echoed by the fence and the house.
const AUD = { ctx: null, on: false, ready: false };
function audioInit(){
  if (AUD.ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  const ctx = AUD.ctx = new AC(), sr = ctx.sampleRate, rnd = mulberry(99);
  const buf = (sec, fill, ch=1) => { const b = ctx.createBuffer(ch, Math.floor(sec*sr), sr); for (let c=0;c<ch;c++) fill(b.getChannelData(c), c); return b; };
  // rain: a hiss of pink noise plus thousands of tiny drop clicks at random pitches
  const rainBuf = buf(8, (d, c) => {
    let b0=0,b1=0,b2=0;
    for (let i=0;i<d.length;i++){ const w = rnd()*2-1; b0 = 0.99765*b0 + w*0.099; b1 = 0.963*b1 + w*0.2965; b2 = 0.57*b2 + w*1.0527; d[i] = (b0 + b1 + b2 + w*0.1848)*0.035; }
    for (let k=0;k<9000;k++){
      const t0 = Math.floor(rnd()*d.length), f = 1800 + 6000*rnd(), dec = 0.0006 + 0.0025*rnd(), a = 0.04*Math.pow(rnd(), 3) + 0.004;
      const n = Math.floor(dec*6*sr);
      for (let j=0;j<n;j++){ const i = (t0 + j)%d.length, tt = j/sr; d[i] += a*Math.exp(-tt/dec)*Math.sin(TAU*f*tt)*(1 + 0.3*(rnd()-0.5)); }
    }
  }, 2);
  // trickle: small bubbles (a sine whose pitch rises as it decays: the Minnaert resonance of a closing bubble)
  const bubbles = (sec, rate, fLo, fHi, amp, noiseAmp) => buf(sec, d => {
    for (let i=0;i<d.length;i++) d[i] = (rnd()*2-1)*noiseAmp;
    const nb = Math.floor(sec*rate);
    for (let k=0;k<nb;k++){
      const t0 = Math.floor(rnd()*d.length), f0 = fLo*Math.pow(fHi/fLo, rnd()), dec = 0.006 + 0.03*rnd()*(600/f0), a = amp*(0.3 + rnd());
      const n = Math.floor(dec*5*sr); let ph = 0;
      for (let j=0;j<n;j++){ const i = (t0 + j)%d.length, tt = j/sr, f = f0*(1 + 0.9*tt/dec*0.3); ph += TAU*f/sr; d[i] += a*Math.exp(-tt/dec)*Math.sin(ph); }
    }
  });
  const trickleBuf = bubbles(6, 34, 500, 2400, 0.09, 0.012);
  const plashBuf = bubbles(6, 60, 250, 1500, 0.08, 0.03);
  const pourBuf = bubbles(4, 260, 160, 1200, 0.07, 0.09);
  // room: a short garden reverb (the fence, the veranda) and a slap echo off the house
  const irBuf = buf(1.6, (d, c) => { for (let i=0;i<d.length;i++){ const t = i/sr; d[i] = (rnd()*2-1)*Math.exp(-t*4.2)*(t < 0.012 ? t/0.012 : 1)*0.6; }
    for (const [tt, a] of [[0.021,0.5],[0.034,0.35],[0.047,0.3],[0.063,0.22]]) d[Math.floor((tt + c*0.004)*sr)] += a; }, 2);
  const master = AUD.master = ctx.createGain(); master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
  master.connect(comp); comp.connect(ctx.destination);
  const rev = ctx.createConvolver(); rev.buffer = irBuf; const revG = ctx.createGain(); revG.gain.value = 0.55; rev.connect(revG); revG.connect(master);
  const echo = ctx.createDelay(1.0); echo.delayTime.value = 0.14; const echoF = ctx.createBiquadFilter(); echoF.type = 'lowpass'; echoF.frequency.value = 2400;
  const echoG = ctx.createGain(); echoG.gain.value = 0.28; echo.connect(echoF); echoF.connect(echoG); echoG.connect(master); echoG.connect(echo);
  AUD.send = ctx.createGain(); AUD.send.connect(rev); AUD.send.connect(echo);
  const loop = (b, rate=1) => { const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.playbackRate.value = rate; s.start(); return s; };
  const chain = (src, filt) => { const g = ctx.createGain(); g.gain.value = 0; if (filt){ src.connect(filt); filt.connect(g); } else src.connect(g); g.connect(master); return g; };
  AUD.rainF = ctx.createBiquadFilter(); AUD.rainF.type = 'lowpass'; AUD.rainF.frequency.value = 6000;
  AUD.rainG = chain(loop(rainBuf), AUD.rainF);
  AUD.trickleSrc = loop(trickleBuf); AUD.tricklePan = ctx.createStereoPanner(); AUD.trickleSrc.connect(AUD.tricklePan);
  AUD.trickleG = chain(AUD.tricklePan); AUD.trickleG.connect(AUD.send);
  AUD.plashSrc = loop(plashBuf, 0.9); AUD.plashPan = ctx.createStereoPanner(); AUD.plashSrc.connect(AUD.plashPan);
  AUD.plashG = chain(AUD.plashPan);
  AUD.pourSrc = loop(pourBuf); AUD.pourPan = ctx.createStereoPanner(); AUD.pourSrc.connect(AUD.pourPan);
  AUD.pourG = chain(AUD.pourPan); AUD.pourG.connect(AUD.send);
  AUD.ready = true;
}
function audioSet(on){
  if (on) audioInit();
  if (!AUD.ctx) return false;
  AUD.on = on;
  if (on && AUD.ctx.state !== 'running') AUD.ctx.resume();
  AUD.master.gain.setTargetAtTime(on ? 0.9 : 0, AUD.ctx.currentTime, 0.15);
  return true;
}
// the strike: modal synthesis of a hollow culm (fundamental of the closed tube, bending modes) plus the stone's click
function playClack(v, pan, dist){
  if (!AUD.on || !AUD.ready) return;
  const ctx = AUD.ctx, t = ctx.currentTime + 0.005, g = clamp(v/1.5, 0.04, 1.2)/(1 + dist*0.18);
  const out = ctx.createGain(); out.gain.value = g; const pn = ctx.createStereoPanner(); pn.pan.value = clamp(pan, -0.8, 0.8);
  out.connect(pn); pn.connect(AUD.master); pn.connect(AUD.send);
  const jit = 1 + (Math.random() - 0.5)*0.02;
  for (const [f, dec, a] of [[742,0.075,1.0],[1486,0.045,0.42],[2230,0.03,0.3],[3405,0.018,0.2],[395,0.11,0.36],[5200,0.008,0.12]]){
    const o = ctx.createOscillator(), e = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f*jit*(1 + 0.012*Math.min(v, 2)); o.connect(e); e.connect(out);
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(a, t + 0.0012); e.gain.exponentialRampToValueAtTime(0.0001, t + dec*6);
    o.start(t); o.stop(t + dec*6 + 0.05);
  }
  const nb = ctx.createBuffer(1, Math.floor(ctx.sampleRate*0.02), ctx.sampleRate), nd = nb.getChannelData(0);
  for (let i=0;i<nd.length;i++) nd[i] = (Math.random()*2-1)*Math.exp(-i/(ctx.sampleRate*0.0025));
  const ns = ctx.createBufferSource(); ns.buffer = nb; const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 3200; hp.Q.value = 0.9;
  const ng = ctx.createGain(); ng.gain.value = 0.7; ns.connect(hp); hp.connect(ng); ng.connect(out); ns.start(t);
}
// continuous sounds follow the state of the jet, the pour and the rain
function audioUpdate(dt, cam){
  if (!AUD.on || !AUD.ready) return;
  const t = AUD.ctx.currentTime;
  const rel = v3.sub(SHISHI.mouthRest, cam.pos), d = v3.len(rel), pan = clamp(v3.dot(v3.mul(rel, 1/d), cam.r), -1, 1)*0.7, att = 1/(1 + d*0.2);
  const intoTube = FX.jet && FX.jet.hit === 'mouth', ontoWater = FX.jet && (FX.jet.hit === 'water' || FX.jet.hit === 'tube');
  const fill = clamp(SH.V/SHISHI.tipVolume, 0, 1.3), flowK = Math.sqrt(SH.flow/0.08);
  AUD.trickleSrc.playbackRate.setTargetAtTime(0.85 + 0.75*fill, t, 0.2);
  AUD.trickleG.gain.setTargetAtTime(intoTube ? 0.55*flowK*att : 0, t, 0.05);
  AUD.plashG.gain.setTargetAtTime(ontoWater ? 0.6*flowK*att : 0, t, 0.05);
  AUD.pourG.gain.setTargetAtTime(Math.min(1.2, Math.sqrt(SH.pour)*1.2)*att, t, 0.03);
  for (const p of [AUD.tricklePan, AUD.plashPan, AUD.pourPan]) p.pan.setTargetAtTime(pan, t, 0.1);
  AUD.rainG.gain.setTargetAtTime(0.9*Math.pow(S.rain, 0.8), t, 0.3);
  AUD.rainF.frequency.setTargetAtTime(2500 + 6000*S.rain, t, 0.3);
}
