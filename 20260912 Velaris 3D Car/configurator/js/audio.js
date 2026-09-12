export class AmbientAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.playing = false;
    this._stopTimer = null;
  }

  _build() {
    const ctx = this.ctx;
    const master = ctx.createGain();
    master.gain.value = 0.0;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 340;
    filter.Q.value = 0.6;
    master.connect(filter);
    filter.connect(ctx.destination);

    const voices = [
      { freq: 55.0, type: "sine", gain: 0.42, detune: 0 },
      { freq: 82.41, type: "sine", gain: 0.22, detune: 4 },
      { freq: 110.0, type: "triangle", gain: 0.09, detune: -3 },
      { freq: 164.81, type: "sine", gain: 0.10, detune: 2 },
      { freq: 220.0, type: "sine", gain: 0.035, detune: -4 },
    ];
    for (const v of voices) {
      const osc = ctx.createOscillator();
      osc.type = v.type;
      osc.frequency.value = v.freq;
      osc.detune.value = v.detune;
      const g = ctx.createGain();
      g.gain.value = v.gain;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.035 + Math.random() * 0.05;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = v.gain * 0.55;
      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);
      osc.connect(g);
      g.connect(master);
      osc.start();
      lfo.start();
    }

    const sweep = ctx.createOscillator();
    sweep.frequency.value = 0.018;
    const sweepGain = ctx.createGain();
    sweepGain.gain.value = 130;
    sweep.connect(sweepGain);
    sweepGain.connect(filter.frequency);
    sweep.start();

    this.master = master;
  }

  async start() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this._build();
    }
    if (this._stopTimer) {
      clearTimeout(this._stopTimer);
      this._stopTimer = null;
    }
    await this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0.16, t + 2.4);
    this.playing = true;
    return true;
  }

  stop() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0.0, t + 0.9);
    this.playing = false;
    this._stopTimer = setTimeout(() => {
      if (this.ctx && !this.playing) this.ctx.suspend();
    }, 1200);
  }

  toggle() {
    if (this.playing) {
      this.stop();
      return Promise.resolve(false);
    }
    return this.start();
  }
}
