import sys,subprocess,re,json
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0,str(Path(__file__).parent/'deps'))
import imageio_ffmpeg
from PIL import Image
root=Path(__file__).resolve().parent.parent
ff=imageio_ffmpeg.get_ffmpeg_exe()
video=root/'five-thousand-years-line-art-animation.mp4'
r=subprocess.run([ff,'-hide_banner','-i',str(video),'-f','null','-'],capture_output=True,text=True,encoding='utf-8',errors='replace')
(root/'work/final-decode.log').write_text(r.stderr,encoding='utf-8')
assert r.returncode==0,r.stderr[-2000:]
assert '1280x720' in r.stderr and '24 fps' in r.stderr
assert 'Audio: aac' in r.stderr
assert '00:02:08' in r.stderr
assert r.stderr.split('Stream mapping:')[0].count('Chapter #0:')==19
assert 'frame= 3072' in r.stderr or 'frame=3072' in r.stderr
import ast
m=ast.parse((root/'work/build_film.py').read_text(encoding='utf-8'))
scenes=next(ast.literal_eval(n.value) for n in m.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='SCENES' for t in n.targets))
start=0;frames=[]
for s in scenes:
    frames.append(int((start+s[2]*.57)*24));start+=s[2]
expr='+'.join(f'eq(n,{x})' for x in frames)
subprocess.run([ff,'-y','-v','error','-i',str(video),'-vf',f"select='{expr}',scale=384:216,tile=4x5:nb_frames=19",'-frames:v','1',str(root/'work/final-contact.jpg')],check=True)
report={'duration_seconds':128,'resolution':[1280,720],'fps':24,'chapters':19,'decoded_frames':3072,'audio':'AAC stereo','decode':'passed','file_bytes':video.stat().st_size}
(root/'work/verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
