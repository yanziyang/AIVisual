# Math in Motion - source

20-second mathematics motion-design showreel. One code base drives both the live page (WebGL2 + Canvas 2D, real time)
and the frame-exact 1080p60 MP4 (headless Chrome streaming raw frames into ffmpeg).

```
js/00-core.js      constants, timeline (48 beats @ 144 BPM), easing, palette, RNG
js/10-audio.js     the score, synthesised sample by sample (runs in the page and in node)
js/20-gfx.js       WebGL2 post pipeline: compose, bloom, CA, accumulation (motion blur), grain
js/30-text.js      typography helpers (kinetic type, formula mini-markup, vector symbols)
js/35-shapes.js    glyph contour -> DFT (epicycles)       js/36-math3d.js   mat4 helpers
js/40..49-s-*.js   the ten scenes (wave/Fourier, surface, chaos, mandel, montage, finale)
js/90-director.js  scene registry, HUD chrome, cut transitions, frame composition
js/95-app.js       live player + headless render job
template.html      page shell + colophon          build.mjs  -> dist/reel.html (single file, fonts embedded)
tools/render.mjs   stills / video renderer           tools/audio.mjs  score -> out/score.wav
tools/mux.mjs      video + audio -> mp4              tools/verify.mjs sanity-check an mp4
```

Run: `npm install` (only the three font packages), `node build.mjs`, `node tools/audio.mjs`,
`node tools/render.mjs video --crf=18 --preset=medium`, `node tools/mux.mjs "<out.mp4>"`.
Paths to Chrome and ffmpeg are set at the top of `tools/render.mjs` / `mux.mjs` / `verify.mjs`.
Fonts (SIL OFL): Inter Tight, JetBrains Mono, STIX Two Text.
