# FORM FOLLOWS FORMULA

A 20-second mathematics motion-design reel, with original procedural graphics and an original synthesized electronic score.

**Master:** 1920 × 1080, 60 fps, 1,200 frames, H.264 MP4, AAC stereo audio at 48 kHz.

| Time | Sequence | Mathematics |
|---|---|---|
| 0.0–2.5 | MATH MOVES | Three-petal polar rose and orbital choreography |
| 2.5–5.5 | EVERYTHING IS A WAVE | Odd Fourier harmonics and matching epicycles |
| 5.5–8.5 | BEND REALITY | Perspective projection of a parametric torus |
| 8.5–11.5 | COMPLEX BEAUTY | Zoom into a computed Mandelbrot set |
| 11.5–14.5 | NATURE HAS A NUMBER | Golden-angle phyllotaxis |
| 14.5–17.0 | NO BEGINNING. NO END. | Rotating trefoil with a tubular moving frame |
| 17.0–20.0 | FORM FOLLOWS FORMULA | Orbital wire sculpture and final title |

Palette: midnight blue, warm ivory, electric lime, cobalt, coral. Three staggered shutters transition between shots at musical boundaries. Typography uses installed Windows fonts. No stock footage, external images, or licensed music assets are included.

## Re-render

Install Python dependencies `numpy` and `Pillow`, set `FFMPEG` in `render.py` to your FFmpeg executable, then run `python render.py`. Run `python render.py --preview` for stills and a contact sheet. Resolution, frame rate, duration, scene timing, geometry, and soundtrack are editable in the source.

The master MP4 is in the parent folder. This `build` folder contains the web preview, poster, score, contact sheets, source, and validation report. `quality-check.json` records validation of the finished master.

`form-follows-formula.html` in the parent folder is a self-contained, approximately 47 MB web page with the full video embedded. It includes the original prompt, implementation details, renderer source, and validation report. Copy it anywhere and open it in a browser without a server. `build_page.py` regenerates it in that same root folder from the master and supporting files.
