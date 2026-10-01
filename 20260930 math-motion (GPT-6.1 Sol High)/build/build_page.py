"""Package the reel, brief, implementation, and source into one offline HTML."""
from pathlib import Path
import base64, html, json, re, hashlib

HERE=Path(__file__).resolve().parent
MASTER=HERE.parent/'FORM-FOLLOWS-FORMULA.mp4'
PROMPT="make a dynamic 20-second motion graphics video related to mathematics that shows what an incredible motion designer with mathematics skills you are, like it's your showreel for a résumé. go all out"
def embedded(path,mime):return 'data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode('ascii')
source=html.escape((HERE/'render.py').read_text(encoding='utf-8'))
checks=json.loads((HERE/'quality-check.json').read_text())
video=base64.b64encode(MASTER.read_bytes()).decode('ascii'); poster=embedded(HERE/'poster.png','image/png')
rows=[
 ('00.0–02.5','MATH MOVES','Polar geometry','r = a cos(3θ)','A three-petal rose rotates inside nested orbits while the opening typography rises into place.'),
 ('02.5–05.5','EVERYTHING IS A WAVE','Fourier synthesis','f(t) = Σ sin(nt) / n; n ∈ {1, 3, 5, 7}','Four epicycles generate a waveform. The endpoint and the composite wave share the same phase.'),
 ('05.5–08.5','BEND REALITY','Parametric topology','x = (R + r cos v) cos u; y = (R + r cos v) sin u; z = r sin v','A torus mesh rotates through a perspective camera. Latitude and longitude curves reveal its surface.'),
 ('08.5–11.5','COMPLEX BEAUTY','Complex dynamics','zₙ₊₁ = zₙ² + c','A Mandelbrot image is computed with 220 escape-time iterations, then cropped and resampled for a continuous zoom.'),
 ('11.5–14.5','NATURE HAS A NUMBER','Golden-angle phyllotaxis','r = a√n; θ = nα; α = π(3 − √5)','740 particles grow into a Vogel spiral, using the golden angle of approximately 137.507764 degrees.'),
 ('14.5–17.0','NO BEGINNING. NO END.','Trefoil geometry','x = sin t + 2 sin 2t; y = cos t − 2 cos 2t; z = −sin 3t','A local tangent, normal, and binormal create a tube around the closed knot. Its wire surface rotates continuously.'),
 ('17.0–20.0','FORM FOLLOWS FORMULA','Orbital sculpture','p′ = Rp; perspective = d / (d − z)','The final sculpture combines projected circular meridians, an orbiting accent, and a bright title. A six-frame fade closes the reel.'),
]
scene_html=''.join(f'<article class="scene"><div class="scene-top"><span class="mono">{time}</span><span class="tag">{topic}</span></div><h3>{title}</h3><p>{body}</p><div class="equation">{html.escape(eq)}</div></article>' for time,title,topic,eq,body in rows)
document='''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="A standalone 20-second mathematics motion reel, its original prompt, and the implementation behind every frame.">
<title>FORM FOLLOWS FORMULA — Reel, Prompt & Implementation</title>
<style>
:root{color-scheme:dark;--bg:#0c101c;--surface:#151b2b;--line:#30384c;--white:#f2f0e4;--muted:#9ba8c1;--lime:#dcff41;--blue:#64afff;--coral:#ff684e}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:24px}body{margin:0;background:var(--bg);color:var(--white);font-family:Arial,sans-serif;line-height:1.6}a{color:inherit;text-decoration:none}button{font:inherit;cursor:pointer}main{max-width:1240px;margin:auto;padding:30px 32px 64px}
.mono,.eyebrow,.tag,.section-number{font-family:Consolas,"Courier New",monospace}.eyebrow{color:var(--lime);font-size:12px;letter-spacing:2px;text-transform:uppercase}header{display:flex;align-items:center;justify-content:space-between;gap:24px;padding-bottom:22px;border-bottom:1px solid var(--line)}nav{display:flex;gap:24px;font-size:13px;color:var(--muted)}nav a:hover{color:var(--lime)}h1{font-size:clamp(42px,6.3vw,84px);line-height:1.04;font-weight:900;letter-spacing:-3px;margin:42px 0 20px;max-width:1040px}h1 em{font-style:normal;color:var(--lime)}.lede{color:var(--muted);font-size:18px;max-width:760px;margin:0 0 26px}.actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 28px}.button{display:inline-flex;align-items:center;justify-content:center;padding:11px 20px;border:1px solid var(--line);border-radius:6px;color:var(--white);background:transparent;font-size:14px;font-weight:bold}.button.primary{background:var(--lime);border-color:var(--lime);color:var(--bg)}.button:hover{filter:brightness(1.1);border-color:var(--lime)}.hint{color:var(--muted);font-size:12px}.player{overflow:hidden;border:1px solid var(--line);border-radius:12px;background:black}video{display:block;width:100%;aspect-ratio:16/9;object-fit:contain}.specs{display:grid;grid-template-columns:repeat(4,1fr);margin:20px 0 44px;border:1px solid var(--line);border-radius:8px}.spec{padding:15px 20px;border-right:1px solid var(--line)}.spec:last-child{border:0}.spec strong{display:block;font-size:23px;line-height:1.35}.spec span{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--muted)}
section{margin-top:48px}h2{font-size:30px;line-height:1.2;letter-spacing:-.7px;margin:0 0 20px}.section-number{color:var(--lime);font-size:13px;display:block;margin-bottom:9px;letter-spacing:2px}.brief{border:1px solid var(--line);border-left:4px solid var(--lime);background:var(--surface);padding:28px 32px;border-radius:8px}blockquote{margin:0;font-size:clamp(19px,2.2vw,26px);line-height:1.65}.section-intro{color:var(--muted);max-width:850px}.scenes{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:24px}.scene{padding:24px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}.scene:last-child{grid-column:1/-1}.scene-top{display:flex;gap:12px;align-items:center;justify-content:space-between;font-size:12px;color:var(--lime)}.tag{font-size:10px;color:var(--muted);text-align:right}.scene h3{font-size:23px;line-height:1.2;letter-spacing:-.5px;margin:16px 0 12px}.scene p{font-size:14px;color:var(--muted);margin:0 0 16px}.equation{font-family:Cambria,Georgia,serif;font-size:18px;color:var(--blue);line-height:1.6;padding-top:14px;border-top:1px solid var(--line)}.process{display:grid;grid-template-columns:repeat(2,1fr);gap:24px;margin-top:30px}.process article{padding:24px;border:1px solid var(--line);border-radius:8px}.process h3{font-size:19px;margin:0 0 10px}.process p{font-size:14px;color:var(--muted);margin:0}.swatches{display:flex;gap:9px;flex-wrap:wrap;margin-top:14px}.swatch{height:25px;width:50px;border-radius:4px;border:1px solid #ffffff20}.checks{display:flex;gap:12px;flex-wrap:wrap;margin-top:20px}.check{font:12px Consolas,monospace;color:var(--lime);background:#dcff410a;border:1px solid #dcff4133;border-radius:30px;padding:8px 14px}details{border:1px solid var(--line);border-radius:8px;margin-top:18px;overflow:hidden}summary{cursor:pointer;padding:18px 22px;font-weight:bold;font-size:14px;background:var(--surface)}summary:hover{color:var(--lime)}pre{margin:0;padding:22px;overflow:auto;max-height:620px;font:12px/1.7 Consolas,monospace;background:#090d16;color:#c6d4ed;tab-size:4}.footnote{font-size:13px;color:var(--muted)}footer{margin-top:56px;border-top:1px solid var(--line);padding-top:20px;display:flex;justify-content:space-between;gap:16px;color:var(--muted);font-size:11px;letter-spacing:1px}code{font-family:Consolas,monospace}a:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid var(--lime);outline-offset:5px}
@media(max-width:720px){main{padding:24px 20px 40px}header{align-items:flex-start;gap:16px}nav{gap:13px;font-size:11px}.eyebrow{font-size:10px;max-width:165px}h1{font-size:43px;letter-spacing:-1.5px;margin-top:30px}.lede{font-size:15px}.specs{grid-template-columns:repeat(2,1fr);margin-bottom:34px}.spec:nth-child(2){border-right:0}.spec:nth-child(-n+2){border-bottom:1px solid var(--line)}.spec strong{font-size:21px}.scenes,.process{grid-template-columns:1fr}.scene:last-child{grid-column:auto}.brief{padding:22px 20px}section{margin-top:34px}.scene{padding:20px}.scene h3{font-size:21px}.scene-top{font-size:11px;align-items:flex-start}h2{font-size:27px}footer{flex-direction:column}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style>
</head>
<body><main>
<header><span class="eyebrow">Mathematics × Motion Design</span><nav aria-label="Page sections"><a href="#prompt">Prompt</a><a href="#implementation">Build</a><a href="#source">Source</a></nav></header>
<h1>FORM FOLLOWS <em>FORMULA.</em></h1>
<p class="lede">Seven mathematical scenes. Kinetic typography. One original electronic score. The equation is the choreography.</p>
<div class="actions"><button class="button primary" id="play">▶ Play reel</button><a class="button" id="download" download="FORM-FOLLOWS-FORMULA.mp4">Download MP4 ↓</a><span class="hint">20 seconds · Sound on</span></div>
<div class="player"><video id="reel" controls playsinline preload="metadata" poster="@@POSTER@@" aria-label="Form Follows Formula mathematics motion graphics video"></video></div>
<div class="specs"><div class="spec"><strong>20.00s</strong><span>Duration</span></div><div class="spec"><strong>1080p</strong><span>1920 × 1080</span></div><div class="spec"><strong>60 fps</strong><span>1,200 frames</span></div><div class="spec"><strong>Original</strong><span>Visuals &amp; soundtrack</span></div></div>
<section id="prompt"><span class="section-number">01 / THE BRIEF</span><h2>Your original prompt</h2><div class="brief"><blockquote>@@PROMPT@@</blockquote></div></section>
<section id="implementation"><span class="section-number">02 / THE IMPLEMENTATION</span><h2>Mathematics behind the motion</h2><p class="section-intro">The graphics are generated procedurally in Python. NumPy defines the geometry and transformations; Pillow draws the typography and frames; FFmpeg encodes the finished reel. Every shot is evaluated at its frame time, with repeatable random seeds for texture and music.</p><div class="scenes">@@SCENES@@</div>
<div class="process"><article><h3>Visual direction &amp; timing</h3><p>Midnight blue and warm ivory alternate with electric lime, cobalt, and coral. Large condensed typography enters through eased baseline reveals. Three staggered shutters connect the scenes at musical boundaries. Glow comes from a blurred, quarter-resolution geometry pass composited over the full-resolution frame.</p><div class="swatches" aria-label="Color palette"><span class="swatch" style="background:#0c101c" title="Midnight #0C101C"></span><span class="swatch" style="background:#f2f0e4" title="Ivory #F2F0E4"></span><span class="swatch" style="background:#dcff41" title="Lime #DCFF41"></span><span class="swatch" style="background:#64afff" title="Cobalt #64AFFF"></span><span class="swatch" style="background:#ff684e" title="Coral #FF684E"></span></div></article>
<article><h3>Original synthesized score</h3><p>A 120 BPM electronic track is synthesized at 48 kHz in stereo. A pitch-decaying kick, noise-based snares and hi-hats, harmonic bass, D-minor arpeggios, pads, and ascending transition sweeps build the arrangement. Panning and delayed notes create width; a bell chord resolves the final shot.</p></article>
<article><h3>Render &amp; encoding</h3><p>Each 1920 × 1080 RGB frame is streamed directly to FFmpeg at 60 fps. The master uses H.264 with the fast preset, CRF 18, and YUV 4:2:0, plus AAC stereo audio at 320 kbps. MP4 fast-start metadata supports quick playback. Typography uses installed Windows fonts; no stock footage or third-party music is used.</p></article>
<article><h3>Validation of the finished master</h3><p>The entire encoded video was decoded successfully: exactly 1,200 frames and 20.00 seconds. Samples in all seven scenes showed motion. Audio is present throughout the reel, with a measured peak of −1.01 dBFS and RMS of −15.64 dBFS. Stills extracted from the MP4 were visually reviewed.</p></article></div>
<div class="checks"><span class="check">✓ Exact 20-second duration</span><span class="check">✓ 1,200 decoded frames</span><span class="check">✓ Motion in every scene</span><span class="check">✓ Stereo audio without clipping</span></div></section>
<section id="source"><span class="section-number">03 / UNDER THE HOOD</span><h2>Source &amp; verification</h2><p class="section-intro">The renderer and validation report are included below. To re-render, use Python with NumPy and Pillow and set the FFmpeg executable path in the source. The MP4 is written to the reel’s root folder; generated assets stay in <code>build</code>.</p>
<details><summary>View the complete renderer source · Python</summary><pre><code>@@SOURCE@@</code></pre></details>
<details><summary>View the master validation report · JSON</summary><pre><code>@@CHECKS@@</code></pre></details>
<p class="footnote">This is a self-contained HTML file. The video, poster, styles, original prompt, implementation notes, source, and validation report are embedded. It opens offline without a server or external assets.</p></section>
<footer><span>FORM FOLLOWS FORMULA / MATHEMATICS × MOTION</span><span>STANDALONE REEL &amp; PROCESS</span></footer>
</main><script id="embedded-video" type="application/octet-stream">@@VIDEO@@</script><script>
const reel=document.getElementById('reel');
const play=document.getElementById('play');
const encoded=document.getElementById('embedded-video').textContent.trim();
const chunks=[];
for(let offset=0;offset<encoded.length;offset+=1048576){const binary=atob(encoded.slice(offset,offset+1048576));const bytes=new Uint8Array(binary.length);for(let j=0;j<binary.length;j++)bytes[j]=binary.charCodeAt(j);chunks.push(bytes)}
const videoUrl=URL.createObjectURL(new Blob(chunks,{type:'video/mp4'}));
reel.src=videoUrl;
document.getElementById('download').href=videoUrl;
play.addEventListener('click',async()=>{if(reel.paused){if(reel.ended)reel.currentTime=0;try{await reel.play()}catch(error){play.textContent='▶ Use the video controls'}}else{reel.pause()}});
reel.addEventListener('play',()=>{play.textContent='Ⅱ Pause reel'});
reel.addEventListener('pause',()=>{play.textContent='▶ Play reel'});
reel.addEventListener('ended',()=>{play.textContent='↻ Replay reel'});
</script></body></html>'''
for token,value in {'POSTER':poster,'VIDEO':video,'PROMPT':html.escape(PROMPT),'SCENES':scene_html,'SOURCE':source,'CHECKS':html.escape(json.dumps(checks,indent=2))}.items():
    document=document.replace('@@'+token+'@@',value)
assert '@@' not in document
assert not re.search(r'(?:src|href)="https?://',document)
target=HERE.parent/'index.html'; target.write_text(document,encoding='utf-8')
# Verify the packaged payload is exactly the finished MP4, without printing it.
payload=re.search(r'<script id="embedded-video" type="application/octet-stream">([^<]+)</script>',document).group(1)
assert hashlib.sha256(base64.b64decode(payload)).digest()==hashlib.sha256(MASTER.read_bytes()).digest()
print(json.dumps({'html':str(target),'bytes':target.stat().st_size,'embedded_video_bytes':MASTER.stat().st_size,'self_contained':True,'payload_verified':True}))
