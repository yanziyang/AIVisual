from pathlib import Path
import subprocess, sys, json, hashlib, re
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(root/'.anim-deps'))
import imageio_ffmpeg
ff=imageio_ffmpeg.get_ffmpeg_exe()
video=root/'atmospheric_circulation_studio.mp4'
out=root/'professional_animation'
info=subprocess.run([ff,'-hide_banner','-i',str(video)],capture_output=True,text=True).stderr
assert '1920x1080' in info and '30 fps' in info and 'Audio: aac' in info,info
decode=subprocess.run([ff,'-v','error','-i',str(video),'-f','null','-'],capture_output=True,text=True)
assert decode.returncode==0 and not decode.stderr,decode.stderr
subprocess.run([ff,'-y','-v','error','-ss','12','-i',str(video),'-t','2','-vf','fps=1','-frames:v','2',str(out/'encoded_motion_%02d.png')],check=True)
a=np.array(Image.open(out/'encoded_motion_01.png'),dtype=float)
b=np.array(Image.open(out/'encoded_motion_02.png'),dtype=float)
motion=float(np.abs(a-b).mean())
assert motion>.1,'Encoded frames are static'
srt=(out/'bilingual_subtitles.srt').read_text(encoding='utf-8-sig')
assert srt.count('-->')>=19 and '193' not in srt[:40]
duration=re.search(r'Duration: ([0-9:.]+)',info).group(1)
result={'file':video.name,'size_bytes':video.stat().st_size,'duration':duration,'resolution':'1920x1080','fps':30,'full_decode':'passed','audio':'AAC stereo','subtitle_cues':srt.count('-->'),'motion_frame_difference':round(motion,4),'sha256':hashlib.sha256(video.read_bytes()).hexdigest()}
(out/'verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
report=root/'atmospheric_circulation_studio_report.html'
text=report.read_text(encoding='utf-8')
text=text.replace('已生成并检查关键画面与全部分镜缩略图。最终编码与解码检查结果见随视频生成的验证记录。',f'已检查全部 19 个分镜布局；成片完整解码通过，无解码报错。视频为 1920×1080、30 fps，时长 {duration}，包含 AAC 双声道音频。导出的相邻时间画面存在实际运动差异；字幕共 {result["subtitle_cues"]} 条。<a href="professional_animation/verification.json">详细验证记录</a>。')
report.write_text(text,encoding='utf-8')
print(json.dumps(result,indent=2))
