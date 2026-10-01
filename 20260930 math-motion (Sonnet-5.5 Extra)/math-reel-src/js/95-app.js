/* ============================================================================
   95-app: live player (audio-clocked) + headless render job
   ========================================================================== */
(function () {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const renderMode = params.has('render');
  const canvas = $('stage'), wrap = $('wrap');
  const post = (path, body) => fetch(path, { method: 'POST', body });
  window.__log = m => { if (renderMode) post('/log', String(m)).catch(() => { }); else console.log(m); };
  window.addEventListener('error', e => { const m = 'ERROR ' + e.message + ' @' + e.filename + ':' + e.lineno; if (renderMode) post('/log', m); else showErr(m); });
  window.addEventListener('unhandledrejection', e => { const m = 'REJECT ' + (e.reason && (e.reason.stack || e.reason)); if (renderMode) post('/log', m); else showErr(m); });
  function showErr(m) { const e = $('err'); e.style.display = 'flex'; e.textContent = m; }

  // ---------------- audio ----------------
  const Aud = { L: null, R: null, ac: null, src: null, gain: null, t0: 0, off: 0, playing: false, muted: false, ok: false };
  Aud.prepare = function () {
    try { const s = renderScore(48000); Aud.L = s.L; Aud.R = s.R; Aud.ok = true; }
    catch (e) { LOG('score failed: ' + (e.stack || e)); Aud.ok = false; }
  };
  Aud.live = false;           // true only while the audio clock is actually running and driving the timeline
  Aud.start = function (off) {
    if (!Aud.ok) return;
    if (!Aud.ac) {
      Aud.ac = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
      const b = Aud.ac.createBuffer(2, Aud.L.length, 48000); b.copyToChannel(Aud.L, 0); b.copyToChannel(Aud.R, 1);
      Aud.buf = b; Aud.gain = Aud.ac.createGain(); Aud.gain.connect(Aud.ac.destination);
    }
    Aud.stop();
    if (Aud.ac.state !== 'running') {            // autoplay policy / no output device: run on the wall clock, join the audio as soon as it resumes
      Aud.live = false;
      Aud.ac.resume().then(() => { if (Aud.ac.state === 'running' && Aud.onReady) Aud.onReady(); }).catch(() => { });
      return;
    }
    Aud.src = Aud.ac.createBufferSource(); Aud.src.buffer = Aud.buf; Aud.src.connect(Aud.gain);
    Aud.gain.gain.value = Aud.muted ? 0 : 1;
    Aud.src.start(0, off); Aud.t0 = Aud.ac.currentTime; Aud.off = off; Aud.live = true;
  };
  Aud.stop = function () { try { if (Aud.src) { Aud.src.onended = null; Aud.src.stop(); Aud.src.disconnect(); } } catch (e) { } Aud.src = null; Aud.live = false; };

  // ---------------- render job (headless) ----------------
  async function runRender() {
    const cfg = await (await fetch('/cfg')).json();
    const buf = new Uint8Array(W * H * 4);
    if (cfg.mode === 'stills') {
      for (const t of cfg.times) {
        const t0 = performance.now();
        Reel.frame(t, { samples: cfg.samples || Reel.samplesFor(t), seed: Math.floor(t * FPS) });
        GFX.readPixels(buf);
        await post('/still?name=' + t.toFixed(2) + '&ms=' + Math.round(performance.now() - t0), buf);
      }
    } else {
      for (let i = cfg.from; i < cfg.to; i++) {
        const t = i / FPS;
        Reel.frame(t, { samples: cfg.samples || Reel.samplesFor(t), shutter: cfg.shutter, seed: i });
        GFX.readPixels(buf);
        await post('/frame?i=' + i, buf);
      }
    }
    await post('/done', '');
  }

  // ---------------- live player ----------------
  let resCap = 3;                                  // adaptive: drops to a lighter tier if this machine cannot keep up
  function chooseRes() {
    const r = wrap.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = r.width * dpr, tier = px > 1500 ? 3 : px > 1000 ? 2 : 1;
    const k = Math.min(tier, resCap);
    return k >= 3 ? [1920, 1080] : k === 2 ? [1280, 720] : [960, 540];
  }
  async function live() {
    const veilStatus = $('status');
    const fmt = s => s.toFixed(2).padStart(5, '0');
    let t = 0, playing = false, ended = false, started = false, last = 0, uiTimer = 0;
    const bar = $('bar'), fill = bar.querySelector('b'), knob = bar.querySelector('em');
    SCENES.forEach(s => { const e = document.createElement('s'); e.style.left = (s.t0 / DUR * 100) + '%'; bar.appendChild(e); });

    const clock = () => (playing && Aud.live) ? (Aud.ac.currentTime - Aud.t0 + Aud.off) : (playing ? (performance.now() - last) / 1000 + t : t);
    function setUI() {
      wrap.classList.toggle('paused', !playing);
      $('bPlay').textContent = playing ? 'Pause' : (ended ? 'Replay' : 'Play');
      $('bMute').textContent = Aud.muted ? 'Sound off' : 'Sound on';
    }
    function seek(nt) {
      t = clamp(nt, 0, DUR - 1 / FPS); ended = false; last = performance.now();
      if (playing) Aud.start(t);
    }
    function play() {
      if (ended) { t = 0; ended = false; }
      playing = true; started = true; last = performance.now();
      Aud.onReady = () => { if (playing) { t = clock(); last = performance.now(); Aud.start(t); } };
      Aud.start(t);
      $('veil').classList.add('hide'); setUI();
    }
    function pause() { t = clock(); playing = false; Aud.stop(); Aud.onReady = null; setUI(); }
    const toggle = () => playing ? pause() : play();

    $('veil').addEventListener('click', play);
    $('bPlay').addEventListener('click', toggle);
    $('bMute').addEventListener('click', () => { Aud.muted = !Aud.muted; if (Aud.gain) Aud.gain.gain.value = Aud.muted ? 0 : 1; setUI(); });
    $('bFull').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else wrap.requestFullscreen && wrap.requestFullscreen(); });
    $('bInfo').addEventListener('click', () => $('drawer').classList.toggle('open'));
    $('bClose').addEventListener('click', () => $('drawer').classList.remove('open'));
    let drag = false;
    const barSeek = e => { const r = bar.getBoundingClientRect(); seek((e.clientX - r.left) / r.width * DUR); frame(); };
    bar.addEventListener('pointerdown', e => { drag = true; bar.setPointerCapture(e.pointerId); barSeek(e); });
    bar.addEventListener('pointermove', e => { if (drag) barSeek(e); });
    bar.addEventListener('pointerup', () => { drag = false; });
    window.addEventListener('keydown', e => {
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      else if (e.key === 'm') $('bMute').click();
      else if (e.key === 'f') $('bFull').click();
      else if (e.key === 'ArrowRight') { seek(clock() + 1); frame(); }
      else if (e.key === 'ArrowLeft') { seek(clock() - 1); frame(); }
      else if (e.key === 'Escape') $('drawer').classList.remove('open');
    });
    wrap.addEventListener('pointermove', () => { wrap.classList.add('ui'); clearTimeout(uiTimer); uiTimer = setTimeout(() => wrap.classList.remove('ui'), 2600); });

    let res = chooseRes();
    new ResizeObserver(() => { const n = chooseRes(); if (n[0] !== res[0]) { res = n; Reel.resize(n[0], n[1]); frame(); } }).observe(wrap);

    function frame() {
      const tt = playing ? clock() : t;
      if (playing && tt >= DUR) { playing = false; ended = true; t = DUR - 1 / FPS; Aud.stop(); setUI(); }
      const ts = playing ? tt : t;
      Reel.frame(clamp(ts, 0, DUR - 1 / FPS), { samples: 1, seed: Math.floor(ts * FPS) });
      const pr = clamp(ts / DUR);
      fill.style.width = pr * 100 + '%'; knob.style.left = pr * 100 + '%';
      $('time').textContent = `${fmt(Math.min(ts, DUR))} / 20.00`;
    }
    let ema = 16, slow = 0;
    function loop() {
      if (playing) {
        const a = performance.now(); frame(); const dt = performance.now() - a;
        ema = ema * 0.9 + dt * 0.1; slow = ema > 38 ? slow + 1 : 0;
        if (slow > 45) { slow = 0; const n = chooseRes(); const cur = [R_W(), 0]; if (resCap > 1) { resCap--; const m = chooseRes(); if (m[0] !== n[0]) { res = m; Reel.resize(m[0], m[1]); ema = 16; } } }
      }
      requestAnimationFrame(loop);
    }
    const R_W = () => Reel.w;

    veilStatus.textContent = 'synthesising score…';
    await new Promise(r => setTimeout(r, 30));
    Aud.prepare();
    veilStatus.textContent = Aud.ok ? 'ready' : 'ready (audio unavailable)';
    t = params.has('t') ? parseFloat(params.get('t')) : 4.2;   // poster frame
    setUI(); frame(); loop();
    window.reel = { seek, play, pause, frame, get t() { return clock(); }, Reel, GFX, Aud };
    if (params.has('t')) { t = parseFloat(params.get('t')); frame(); }
  }

  (async function main() {
    try {
      await loadFonts();
      if (renderMode) { Reel.init(canvas, W, H); } else { const [rw, rh] = chooseRes(); Reel.init(canvas, rw, rh); }
      await Reel.prepare();
      if (renderMode) await runRender(); else await live();
    } catch (e) {
      const m = 'FATAL ' + (e && (e.stack || e.message || e));
      if (renderMode) { await post('/log', m); await post('/done', ''); } else showErr(m);
    }
  })();
})();
