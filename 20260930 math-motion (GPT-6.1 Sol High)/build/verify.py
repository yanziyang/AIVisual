"""Validate the encoded deliverable, including decoding every frame."""
from pathlib import Path
import subprocess, re, json, wave
import numpy as np
from PIL import Image, ImageDraw
from render import FFMPEG, ROOT, MASTER_DIR

video=MASTER_DIR/'FORM-FOLLOWS-FORMULA.mp4'
info=subprocess.run([str(FFMPEG),'-hide_banner','-i',str(video)],capture_output=True,text=True).stderr
decode=subprocess.run([str(FFMPEG),'-v','error','-i',str(video),'-map','0:v:0','-progress','pipe:1','-f','null','-'],capture_output=True,text=True)
frames=re.findall(r'^frame=(\d+)$',decode.stdout,re.M)
audio=subprocess.run([str(FFMPEG),'-v','error','-i',str(video),'-map','0:a:0','-f','s16le','-acodec','pcm_s16le','-ac','2','pipe:1'],capture_output=True)
samples=np.frombuffer(audio.stdout,dtype='<i2').reshape(-1,2)/32768
stats={
    'file':video.name,'bytes':video.stat().st_size,
    'duration_seconds':float(re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)',info)[3]),
    'resolution':[1920,1080] if '1920x1080' in info else None,
    'fps':60 if re.search(r'60 fps',info) else None,
    'decoded_frames':int(frames[-1]) if frames else 0,
    'decode_exit_code':decode.returncode,
    'decode_errors':decode.stderr.strip(),
    'video_codec':'H.264' if 'Video: h264' in info else None,
    'audio_codec':'AAC' if 'Audio: aac' in info else None,
    'audio_sample_rate_hz':48000 if '48000 Hz' in info else None,
    'audio_channels':2,'decoded_audio_samples':len(samples),
    'audio_peak_dbfs':round(float(20*np.log10(max(np.max(np.abs(samples)),1e-9))),2),
    'audio_rms_dbfs':round(float(20*np.log10(max(np.sqrt(np.mean(samples*samples)),1e-9))),2),
    'audible_seconds':sum(float(np.sqrt(np.mean(samples[j*48000:(j+1)*48000]**2)))>.001 for j in range(20)),
}
motion=[]
for start in [1.5,4.2,7.2,10.2,13.3,16,18.8]:
    result=subprocess.run([str(FFMPEG),'-v','error','-ss',str(start),'-i',str(video),'-t','0.5','-vf','fps=4,scale=192:108','-f','rawvideo','-pix_fmt','gray','pipe:1'],capture_output=True,check=True)
    images=np.frombuffer(result.stdout,dtype=np.uint8).reshape(-1,108,192)
    change=float(np.mean(np.abs(images[1].astype(float)-images[0])))
    motion.append({'time_seconds':start,'mean_pixel_change_over_250ms':round(change,3)})
assert all(m['mean_pixel_change_over_250ms']>.08 for m in motion)
stats['motion_in_every_scene']=motion
assert stats['duration_seconds']==20
assert stats['resolution']==[1920,1080] and stats['fps']==60
assert stats['decoded_frames']==1200 and decode.returncode==0 and not stats['decode_errors']
assert stats['video_codec']=='H.264' and stats['audio_codec']=='AAC'
assert stats['audible_seconds']==20 and stats['audio_peak_dbfs']<0
stats['passed']=True
(ROOT/'quality-check.json').write_text(json.dumps(stats,indent=2))
print(json.dumps(stats,indent=2))
# Stills decoded from the actual master, rather than only the renderer.
for j,t in enumerate([1.5,4.2,7.2,10.2,13.3,16,18.8]):
    subprocess.run([str(FFMPEG),'-v','error','-y','-ss',str(t),'-i',str(video),'-frames:v','1',str(ROOT/f'encoded-{j+1:02d}.jpg')],check=True)
sheet=Image.new('RGB',(1280,1440),(12,16,28))
for j in range(7):
    im=Image.open(ROOT/f'encoded-{j+1:02d}.jpg').resize((640,360),Image.Resampling.LANCZOS)
    sheet.paste(im,((j%2)*640,(j//2)*360))
sheet.save(ROOT/'encoded-contact-sheet.jpg',quality=94)
