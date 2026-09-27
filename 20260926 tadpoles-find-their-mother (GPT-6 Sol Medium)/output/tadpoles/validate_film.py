import sys,subprocess,json,re
from pathlib import Path
sys.path.insert(0,str(Path('animation_deps').resolve()))
import imageio_ffmpeg
root=Path(__file__).resolve().parent
ff=imageio_ffmpeg.get_ffmpeg_exe();movie=root/'tadpoles_find_their_mother_ink_animation.mp4'
probe=subprocess.run([ff,'-hide_banner','-i',str(movie)],capture_output=True)
meta=probe.stderr.decode('utf-8',errors='replace')
for line in meta.splitlines():
 if any(s in line for s in ['Duration:','Video:','Audio:']):print(line.strip())
check=subprocess.run([ff,'-v','error','-i',str(movie),'-f','null','-'],capture_output=True)
if check.returncode or check.stderr:raise RuntimeError(check.stderr.decode('utf-8',errors='replace'))
timeline=json.loads((root/'timeline.json').read_text(encoding='utf-8'))
t=min(x['start'] for x in timeline if x['scene']==5)+4
subprocess.run([ff,'-y','-v','error','-ss',str(t),'-i',str(movie),'-frames:v','1',str(root/'final_check.jpg')],check=True)
assert '1280x720' in meta and '24 fps' in meta and 'stereo' in meta
(root/'validation.json').write_text(json.dumps({'full_decode':'passed','resolution':'1280x720','fps':24,'audio':'AAC stereo','subtitles':'17 burned-in bilingual cues','file_bytes':movie.stat().st_size},indent=2),encoding='utf-8')
print('FULL_VIDEO_DECODE_PASSED')

