// Optional engine sound, synthesised live from the engine state (off until the viewer asks for it).
// Pitch scaled down from the real blade-pass frequencies so it stays pleasant: a buzz-saw fan tone,
// a turbine whine, jet roar and combustion rumble that all follow the spool speeds and thrust.
import { N1_RPM, N2_RPM } from './engine.js';

export class EngineAudio {
  constructor() { this.ctx = null; this.on = false; }

  _build() {
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = this.master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 6;
    master.connect(comp); comp.connect(ctx.destination);
    // 3 s of white noise, looped
    const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const noise = () => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
    const chain = (src, nodes) => nodes.reduce((a, b) => { a.connect(b); return b; }, src);
    // roar
    this.roarBP = ctx.createBiquadFilter(); this.roarBP.type = 'bandpass'; this.roarBP.Q.value = 0.55;
    this.roarG = ctx.createGain(); this.roarG.gain.value = 0;
    chain(noise(), [this.roarBP, this.roarG, master]);
    // rumble
    this.rumLP = ctx.createBiquadFilter(); this.rumLP.type = 'lowpass'; this.rumLP.frequency.value = 220;
    this.rumG = ctx.createGain(); this.rumG.gain.value = 0;
    chain(noise(), [this.rumLP, this.rumG, master]);
    // fan buzz
    this.fanO = ctx.createOscillator(); this.fanO.type = 'sawtooth';
    this.fanLP = ctx.createBiquadFilter(); this.fanLP.type = 'lowpass'; this.fanLP.frequency.value = 1600;
    this.fanG = ctx.createGain(); this.fanG.gain.value = 0;
    chain(this.fanO, [this.fanLP, this.fanG, master]); this.fanO.start();
    // turbine whine
    this.whO = ctx.createOscillator(); this.whO.type = 'triangle';
    this.whG = ctx.createGain(); this.whG.gain.value = 0;
    chain(this.whO, [this.whG, master]); this.whO.start();
  }

  set(on) {
    this.on = on;
    if (on) { if (!this.ctx) this._build(); this.ctx.resume(); }
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.25);
  }

  update(st) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime, k = 0.12;
    const n1 = st.n1, n2 = st.n2, th = Math.pow(Math.max(0, (st.thrust - 6) / 294), 0.8);
    this.roarBP.frequency.setTargetAtTime(500 + 1500 * n1, t, k);
    this.roarG.gain.setTargetAtTime(0.10 + 0.55 * th, t, k);
    this.rumG.gain.setTargetAtTime(0.25 + 0.5 * n2 * n2, t, k);
    this.fanO.frequency.setTargetAtTime(22 * n1 * N1_RPM / 60 * 0.5, t, k);
    this.fanLP.frequency.setTargetAtTime(700 + 1400 * n1, t, k);
    this.fanG.gain.setTargetAtTime(0.02 + 0.10 * n1 * n1, t, k);
    this.whO.frequency.setTargetAtTime(1000 + 1500 * n2 * (N2_RPM / 12400), t, k);
    this.whG.gain.setTargetAtTime(0.004 + 0.02 * n2 * n2, t, k);
  }
}
