from pathlib import Path
import base64, html

root = Path(__file__).resolve().parent
video = base64.b64encode((root / 'FORM_FLOW_Showreel.mp4').read_bytes()).decode('ascii')
poster = base64.b64encode((root / 'FORM_FLOW/poster.jpg').read_bytes()).decode('ascii')
source = html.escape((root / 'render_showreel.py').read_text(encoding='utf-8'))
page = r'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="FORM / FLOW: a 15-second motion design showreel, its original prompt, and a detailed breakdown of the procedural animation and original score.">
<title>FORM / FLOW — A motion design study</title>
<style>
:root{color-scheme:dark;--ink:#0e1011;--paper:#f2f0e4;--lime:#cdff44;--muted:#a8aaa1;--line:#333731;--blue:#6d7bff;--peach:#ff876a}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:28px}body{margin:0;background:var(--ink);color:var(--paper);font-family:Arial,Helvetica,sans-serif}a{color:inherit;text-underline-offset:5px}button{font:inherit}button,a,summary{touch-action:manipulation}a:focus-visible,button:focus-visible,summary:focus-visible{outline:3px solid var(--lime);outline-offset:6px}.wrap{width:min(1320px,calc(100% - 96px));margin:auto}.mono,.eyebrow{font-family:Consolas,'Courier New',monospace;font-size:12px;letter-spacing:.07em;text-transform:uppercase}.top{display:flex;justify-content:space-between;align-items:center;padding:28px 0;border-bottom:1px solid var(--line)}.brand{font-weight:800;letter-spacing:.09em}.top nav{display:flex;gap:26px}.top a{text-decoration:none;color:var(--muted)}.top a:hover{color:var(--lime)}.hero{position:relative;padding:70px 0 34px}.eyebrow{color:var(--lime);margin:0 0 23px}.hero h1{font-family:'Arial Black',Arial,sans-serif;font-size:clamp(70px,11vw,154px);line-height:.91;letter-spacing:-.065em;margin:0 0 32px;font-weight:900}.hero h1 span{color:var(--lime)}.intro{display:flex;align-items:end;justify-content:space-between;gap:30px}.intro p{max-width:570px;margin:0;color:var(--muted);font-size:18px;line-height:1.6}.badge{white-space:nowrap;border:1px solid var(--line);padding:12px 16px;border-radius:30px}.player{margin-top:34px;border:1px solid var(--line);background:#080a09;position:relative}video{display:block;width:100%;aspect-ratio:16/9;object-fit:contain;background:var(--ink)}.player-foot{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:20px 23px;border-top:1px solid var(--line)}.status{color:var(--muted)}.download{display:inline-flex;align-items:center;gap:14px;color:var(--lime);text-decoration:none}.download:hover{text-decoration:underline}.chapters{display:grid;grid-template-columns:repeat(8,1fr);border-bottom:1px solid var(--line);margin-top:16px}.chapter{appearance:none;background:transparent;border:0;border-bottom:3px solid transparent;text-align:left;color:var(--muted);cursor:pointer;padding:19px 12px 20px;min-height:90px}.chapter .time{display:block;font-size:11px;color:var(--muted);margin-bottom:11px}.chapter strong{font-size:12px;line-height:1.5;font-weight:400}.chapter:hover{color:var(--lime);background:#171b14}.chapter.active{border-bottom-color:var(--lime);color:var(--paper)}.section{padding:64px 0;border-bottom:1px solid var(--line)}.section-grid{display:grid;grid-template-columns:260px 1fr;gap:60px}.section-label{color:var(--muted);margin:7px 0 0}.section h2{font-size:36px;letter-spacing:-.04em;margin:0 0 24px;line-height:1.12}.section h3{font-size:20px;letter-spacing:-.02em;margin:0 0 12px}.section p{font-size:16px;line-height:1.7;color:var(--muted);margin:0 0 18px}.prompt{font-size:clamp(23px,3vw,38px);font-weight:600;line-height:1.45;letter-spacing:-.025em;margin:0;padding:0;border:0;max-width:900px}.prompt:before{content:'“';display:block;font-size:70px;line-height:.7;color:var(--lime);margin-bottom:20px}.caption{font-family:Consolas,monospace;font-size:12px!important;margin:24px 0 0!important}.palette{display:flex;flex-wrap:wrap;gap:20px;margin-top:28px}.swatch{display:flex;align-items:center;gap:12px;font-family:Consolas,monospace;font-size:11px;color:var(--muted)}.swatch i{display:block;width:28px;height:28px;border-radius:50%;background:var(--c);border:1px solid #555}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin:30px 0 0}.stat{border-top:1px solid var(--line);padding-top:20px}.stat b{font-size:28px;display:block;letter-spacing:-.03em;margin-bottom:8px}.stat span{color:var(--muted);font-family:Consolas,monospace;font-size:11px}.process{display:grid;grid-template-columns:1fr 1fr;gap:35px 45px;margin-top:28px}.process article{border-top:1px solid var(--line);padding-top:22px}.step{color:var(--lime);font-family:Consolas,monospace;font-size:12px;display:block;margin-bottom:17px}.process p{font-size:15px;margin:0}.equation{margin:25px 0;padding:20px 24px;border-left:3px solid var(--lime);background:#161a14;color:var(--paper);overflow:auto;font:14px/1.8 Consolas,monospace;white-space:pre-wrap}.specs{width:100%;border-collapse:collapse;font-size:14px}.specs th,.specs td{text-align:left;padding:16px 0;border-bottom:1px solid var(--line);line-height:1.5;vertical-align:top}.specs th{width:32%;font-weight:400;color:var(--muted);padding-right:20px}.specs tr:last-child>*{border-bottom:0}.verification{color:var(--lime)!important;font-family:Consolas,monospace;font-size:12px!important;margin-top:22px!important}.dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--lime);margin-right:8px}.source-toolbar{display:flex;justify-content:space-between;align-items:center;gap:20px;margin:22px 0}.source-toolbar span{color:var(--muted)}details{border:1px solid var(--line)}summary{padding:20px;cursor:pointer;font-family:Consolas,monospace;font-size:13px}summary:hover{color:var(--lime)}pre{margin:0;background:#080a09;padding:24px;overflow:auto;max-height:550px;font:12px/1.7 Consolas,monospace;tab-size:4}code{font-family:Consolas,monospace;font-size:.9em;color:var(--paper)}footer{padding:30px 0 50px;display:flex;justify-content:space-between;gap:30px;color:var(--muted);font-family:Consolas,monospace;font-size:11px}noscript p{padding:16px;color:var(--muted)}
@media(max-width:1000px){.wrap{width:calc(100% - 48px)}.section-grid{grid-template-columns:180px 1fr;gap:35px}.chapters{grid-template-columns:repeat(4,1fr)}.hero{padding-top:55px}.stats{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.wrap{width:calc(100% - 32px)}.top{padding:22px 0}.top nav{gap:16px;font-size:10px}.brand{font-size:11px}.hero{padding:42px 0 20px}.hero h1{font-size:clamp(56px,13vw,85px);margin-bottom:24px}.intro{display:block}.intro p{font-size:16px}.badge{display:inline-block;margin-top:20px;font-size:10px}.player{margin-top:28px}.player-foot{padding:15px 12px;font-size:10px;gap:12px}.chapter{padding:14px 7px;min-height:85px}.chapter strong{font-size:11px}.chapter .time{font-size:10px}.section{padding:40px 0}.section-grid{display:block}.section-label{margin-bottom:25px}.section h2{font-size:30px}.prompt{font-size:25px}.process{grid-template-columns:1fr;gap:28px}.stats{gap:22px}.specs th{width:38%}.specs{font-size:12px}.source-toolbar{align-items:start;flex-direction:column}footer{flex-direction:column;gap:12px}.equation{font-size:12px;padding:15px}.palette{gap:16px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
@media print{body{background:white;color:black}.wrap{width:100%}.top nav,.player,.chapters,.download{display:none}.section{break-inside:avoid}.section p,.section-label{color:#333}.hero h1 span,.eyebrow{color:#333}.section-grid{grid-template-columns:160px 1fr}details{display:none}}
</style>
</head>
<body>
<div class="wrap">
<header class="top"><div class="brand">CODEX / MOTION STUDIES</div><nav class="mono" aria-label="Page navigation"><a href="#brief">Prompt</a><a href="#craft">Process</a><a href="#source">Source</a></nav></header>
<main>
<section class="hero" aria-labelledby="title"><p class="eyebrow">Creative showreel / 2026</p><h1 id="title">FORM <span>/</span> FLOW</h1><div class="intro"><p>A fifteen-second study in type, form, rhythm, and feeling. Eight scenes. One visual language. Every frame and every sound built from code.</p><span class="badge mono">15 seconds · 1080p · 60 fps</span></div>
<div class="player"><video id="reel" controls playsinline preload="metadata" poster="data:image/jpeg;base64,__POSTER__" aria-label="FORM / FLOW motion design showreel with original electronic music"><source src="data:video/mp4;base64,__VIDEO__" type="video/mp4">Your browser does not support HTML video.</video><div class="player-foot mono"><span id="status" class="status" aria-live="polite">Original score / sound on for the full experience</span><a id="video-download" class="download" download="FORM_FLOW_Showreel.mp4" href="#reel">Download MP4 <span aria-hidden="true">↗</span></a></div></div>
<div class="chapters" aria-label="Jump to a scene">
<button class="chapter active" data-time="0" aria-label="Seek to The impulse, 0 seconds"><span class="time mono">01 / 00.000</span><strong>The impulse</strong></button>
<button class="chapter" data-time="1.875" aria-label="Seek to Kinetic type, 1.875 seconds"><span class="time mono">02 / 01.875</span><strong>Kinetic type</strong></button>
<button class="chapter" data-time="3.75" aria-label="Seek to Flow systems, 3.75 seconds"><span class="time mono">03 / 03.750</span><strong>Flow systems</strong></button>
<button class="chapter" data-time="5.625" aria-label="Seek to Dimension, 5.625 seconds"><span class="time mono">04 / 05.625</span><strong>Dimension</strong></button>
<button class="chapter" data-time="7.5" aria-label="Seek to Elastic behaviour, 7.5 seconds"><span class="time mono">05 / 07.500</span><strong>Elastic behaviour</strong></button>
<button class="chapter" data-time="9.375" aria-label="Seek to Design in motion, 9.375 seconds"><span class="time mono">06 / 09.375</span><strong>Design in motion</strong></button>
<button class="chapter" data-time="11.25" aria-label="Seek to Make an impression, 11.25 seconds"><span class="time mono">07 / 11.250</span><strong>Make an impression</strong></button>
<button class="chapter" data-time="13.125" aria-label="Seek to Closing identity, 13.125 seconds"><span class="time mono">08 / 13.125</span><strong>Closing identity</strong></button>
</div><noscript><p>The video plays with native controls. Enable JavaScript to use the scene shortcuts and download buttons.</p></noscript></section>
<section id="brief" class="section section-grid"><p class="section-label mono">01 / The brief</p><div><blockquote class="prompt">make a dynamic 15-second motion graphics video that shows what an incredible motion designer you are, like it's your showreel for a résumé. go all out</blockquote><p class="caption">Original user prompt · reproduced verbatim</p></div></section>
<section class="section section-grid"><p class="section-label mono">02 / Art direction</p><div><h2>Make it move. With intent.</h2><p>The reel uses oversized typography and a restrained palette to keep a fast sequence coherent. Electric lime supplies the punch; warm white gives the type room to breathe. Periwinkle and coral introduce dimension and play.</p><p>The opening spark expands into “MAKE IT MOVE.” Repeating type gives way to sinusoidal ribbons, then a rotating, reflective sculpture. A modular shape grid and three identity panels lead into “DESIGN / FEEL / SOMETHING.” The closing card resolves the sequence with “CODEX MOTION.”</p><div class="palette" aria-label="Color palette"><span class="swatch"><i style="--c:#0e1011"></i>INK #0E1011</span><span class="swatch"><i style="--c:#f2f0e4"></i>PAPER #F2F0E4</span><span class="swatch"><i style="--c:#cdff44"></i>LIME #CDFF44</span><span class="swatch"><i style="--c:#6d7bff"></i>BLUE #6D7BFF</span><span class="swatch"><i style="--c:#ff876a"></i>CORAL #FF876A</span></div></div></section>
<section id="craft" class="section section-grid"><p class="section-label mono">03 / Implementation</p><div><h2>A small procedural production engine.</h2><p>Python generates the animation and the music. Pillow draws the frames, NumPy handles geometry and audio synthesis, and FFmpeg encodes the finished film. The composition uses a 1600 × 900 coordinate system scaled to a 1920 × 1080 output.</p><div class="stats"><div class="stat"><b>900</b><span>rendered frames</span></div><div class="stat"><b>128</b><span>beats per minute</span></div><div class="stat"><b>8</b><span>scenes / musical bars</span></div><div class="stat"><b>6,912</b><span>3D mesh faces per frame</span></div></div>
<div class="process">
<article><span class="step">01 / TIMING & TYPOGRAPHY</span><h3>Animate time, then draw.</h3><p>Each frame is evaluated at <code>t = frame / 60</code>. Scene selection uses 1.875-second intervals, matching one four-beat bar at 128 BPM. Arial Black and Consolas are rendered into cached grayscale masks, then resized, rotated, faded, and composited. Solid and outlined type share the same mask pipeline.</p></article>
<article><span class="step">02 / MOTION & TRANSITIONS</span><h3>Give shapes a sense of weight.</h3><p>A quartic ease-out drives type reveals, a damped cosine gives entrances their overshoot, and smoothstep controls diagonal wipes during the last 0.17 seconds of each transition. Phase-offset sine waves animate the ribbons, orbiting dots, and modular shape grid.</p></article>
<article><span class="step">03 / DIMENSION & LIGHT</span><h3>Sculpt the surface mathematically.</h3><p>A deformed torus is sampled on a 144 × 48 grid. Its radius and tube thickness vary over time. Rotation matrices orient the mesh; perspective projection maps it into the frame. Face normals drive diffuse light, sharp highlights, and rim brightness. Faces are sorted by depth and painted with a blue-to-lime color gradient.</p></article>
<article><span class="step">04 / ORIGINAL SOUND DESIGN</span><h3>Build a score around the edit.</h3><p>NumPy synthesizes a pitch-decaying kick, noise claps and hi-hats, harmonic bass, FM plucks, and sustained chords. Stereo panning and delayed pluck repeats add width. Rising noise sweeps and tuned impacts mark scene changes. Soft saturation controls peaks, and a final fade resolves the ending.</p></article>
</div><div class="equation" aria-label="Motion equations">ease(x) = 1 − (1 − clamp(x))⁴
spring(x) = 1 − exp(−8x) × cos(12x)
bar length = 4 × (60 / 128) = 1.875 seconds
8 bars × 1.875 seconds = 15 seconds</div><p>Raw RGB frames are streamed directly into FFmpeg. The separately generated 48 kHz stereo WAV is muxed into the final MP4. All visuals and music are procedural; the production uses no stock footage or stock music.</p></div></section>
<section class="section section-grid"><p class="section-label mono">04 / Delivery & verification</p><div><h2>The finished film.</h2><table class="specs"><caption class="mono" style="text-align:left;color:var(--muted);margin-bottom:12px">Export specification</caption><tbody><tr><th scope="row">Duration / frames</th><td>15.00 seconds / 900 frames</td></tr><tr><th scope="row">Picture</th><td>1920 × 1080 · 16:9 · 60 fps · progressive</td></tr><tr><th scope="row">Video encoding</th><td>H.264 High profile · libx264 · CRF 18 · fast preset · YUV 4:2:0</td></tr><tr><th scope="row">Audio encoding</th><td>AAC LC · stereo · 48 kHz · 320 kb/s</td></tr><tr><th scope="row">Container / size</th><td>MP4 with fast-start metadata · 6,405,469 bytes (6.41 MB)</td></tr><tr><th scope="row">Production stack</th><td>Python · Pillow · NumPy · imageio-ffmpeg / FFmpeg</td></tr><tr><th scope="row">Typography</th><td>Windows Arial Black and Consolas</td></tr></tbody></table><p class="verification"><span class="dot"></span>All 900 exported frames and the audio stream decoded successfully.</p><p>Storyboard frames were inspected before rendering, and a frame extracted from the encoded video was checked afterward. The export was verified as exactly 15 seconds with 1080p picture at 60 fps and stereo AAC audio.</p></div></section>
<section id="source" class="section section-grid"><p class="section-label mono">05 / Reproduce it</p><div><h2>The source, included.</h2><p>This HTML is a self-contained case study: the MP4, poster image, styles, script, and rendering source are embedded. It opens offline and can be shared as one file.</p><p>Download the Python source into a working folder, install its packages, then run it on Windows. The renderer writes the MP4, soundtrack, storyboard, poster, and encoding log into a <code>FORM_FLOW</code> subfolder. The delivered MP4 was subsequently moved to the project root.</p><div class="equation">python -m pip install Pillow numpy imageio-ffmpeg
python render_showreel.py

# Generate the storyboard without rendering the video:
python render_showreel.py --preview</div><div class="source-toolbar mono"><span>render_showreel.py / full production source</span><a class="download" id="source-download" href="#source-code" download="render_showreel.py">Download Python <span aria-hidden="true">↗</span></a></div><details><summary>Inspect the complete implementation</summary><pre><code id="source-code">__SOURCE__</code></pre></details></div></section>
</main><footer><span>FORM / FLOW — CODEX MOTION STUDIES</span><span>September 2026 · Made from a single creative brief.</span></footer>
</div>
<script>
(() => {
  const video = document.getElementById('reel');
  const chapters = [...document.querySelectorAll('.chapter')];
  const status = document.getElementById('status');
  const download = document.getElementById('video-download');
  download.href = video.querySelector('source').src;
  let pendingSeek = null;
  function seek(time) {
    if (video.readyState < 1) { pendingSeek = time; video.load(); return; }
    video.currentTime = time;
    status.textContent = 'Scene selected / press play to watch';
    update();
  }
  function update() {
    const active = Math.min(7, Math.floor(video.currentTime / 1.875));
    chapters.forEach((button, index) => {
      button.classList.toggle('active', index === active);
      if (index === active) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
  }
  video.addEventListener('loadedmetadata', () => {
    if (pendingSeek !== null) { const time = pendingSeek; pendingSeek = null; seek(time); }
  });
  chapters.forEach(button => button.addEventListener('click', () => seek(Number(button.dataset.time))));
  video.addEventListener('timeupdate', update);
  video.addEventListener('play', () => { status.textContent = 'Playing / original 128 BPM stereo score'; });
  video.addEventListener('pause', () => { if (!video.ended) status.textContent = 'Paused / ' + video.currentTime.toFixed(2) + ' seconds'; });
  video.addEventListener('ended', () => { status.textContent = '15 seconds / ideas, in motion.'; });
  video.addEventListener('error', () => { status.textContent = 'Playback unavailable / download the MP4 to watch locally'; });
  const sourceBlob = new Blob([document.getElementById('source-code').textContent], { type: 'text/x-python;charset=utf-8' });
  const sourceUrl = URL.createObjectURL(sourceBlob);
  document.getElementById('source-download').href = sourceUrl;
  window.addEventListener('pagehide', event => { if (!event.persisted) URL.revokeObjectURL(sourceUrl); });
  update();
})();
</script>
</body>
</html>'''
page = page.replace('__VIDEO__', video).replace('__POSTER__', poster).replace('__SOURCE__', source)
destination = root / 'FORM_FLOW.html'
destination.write_text(page, encoding='utf-8')
print(f'Created {destination} ({destination.stat().st_size:,} bytes)')
