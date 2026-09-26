import pathlib,sys,subprocess,json,wave,math,ast,functools,base64,html
ROOT=pathlib.Path(__file__).parent.parent;sys.path.insert(0,str(ROOT/'video_deps'))
import numpy as np,imageio_ffmpeg
from PIL import Image,ImageDraw,ImageFont
OUT=ROOT/'liang_sicheng_dougong';FF=imageio_ffmpeg.get_ffmpeg_exe()
tree=ast.parse((ROOT/'scripts'/'make_video.py').read_text(encoding='utf-8'))
scenes=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='scenes' for t in n.targets))
timeline=json.loads((OUT/'timeline_3d.json').read_text())
chunks={
0:[('一座木建筑的屋檐，为什么能伸出柱子之外？','How can the eaves of a timber building extend beyond its columns?'),('答案，就藏在梁思成的这张图里。','The answer lies in this drawing by Liang Sicheng.')],
1:[('这页题为，中国建筑之，ORDER。','This page is titled The Chinese “Order”.'),('它把斗拱、柱、柱础连成一体，','It brings brackets, columns and column bases into one system,'),('让我们从屋檐一路读到地面。','guiding our eye from the eaves down to the ground.')],
2:[('先抓住一条线索：屋面的荷载，','Start with one clue: the load from the roof'),('通过梁枋和斗拱等构件，传到柱，','passes through beams, ties and brackets to the column,'),('再传向柱础与地基。','then continues to the base and foundation.')],
4:[('看编号二十，栌斗。','Look at number 20: the ludou, or principal block.'),('它坐在柱头上，是这组斗拱下部的重要承接节点。','It sits on the column head and receives the bracket assembly.'),('往上看，木件纵横相交。','Above it, timber members cross in different directions.')],
5:[('再看十九，华拱。','Now look at number 19: the huagong.'),('它向柱外伸出，形成出跳。','It extends beyond the column to create a projection.'),('屋檐的伸展，在这里开始有了清楚的结构层次。','Here the reach of the eaves begins to take a clear structural form.')],
6:[('编号十七是昂。图上能看到它斜向延伸。','Number 17 is the ang, shown as an inclined member.'),('注意，昂不是装饰花纹，','The ang is more than a decorative pattern:'),('而是这组构件关系中的一员。','it participates in the relationships within this assembly.')],
7:[('页旁直接写明：这幅示例出三跳，','The note beside the drawing explicitly describes three projections,'),('由一华拱、两昂组成。','formed by one huagong and two ang members.'),('跳，数的是向外挑出的层次，不是木块总数。','“Projection” counts outward-reaching stages, rather than individual blocks.')],
8:[('另一把钥匙，是材。','Another key is cai, the dimensional module.'),('页旁说，各部尺寸可以用材，','The note explains that dimensions can be measured in cai,'),('以及它的倍数或分数来度量。','and in its multiples or fractions.'),('这是一套相互协调的比例语言。','This provides a coordinated language of proportion.')],
12:[('下次走到古建筑前，抬头看看屋檐：','Next time you visit an old building, look up at its eaves.'),('找到柱，找到栌斗，','Locate the column and the principal block,'),('再沿着拱和昂，追踪它向外伸出的层次。','then follow the bracket arms and ang through their outward projections.'),('梁思成的一页图，就这样活了起来。','In this way, a page by Liang Sicheng comes to life.')]
}
for k,t in enumerate(timeline):
 if '--only-near' in sys.argv and t['id'] in [0,1,2,12]:continue
 if '--prepare' in sys.argv and k>=int(sys.argv[-1]):break
 folder=f'wide_chapter_{k:02}' if t['id'] in [0,1,2,12] else f'chapter_{k:02}'
 source=OUT/'render_3d'/folder/'%04d.png';target=OUT/f'chapter_3d_v2_{k:02}.mp4'
 if not target.exists():
  print('INTERPOLATE',k+1,flush=True)
  subprocess.run([FF,'-y','-loglevel','error','-threads','2','-filter_threads','2','-framerate','3','-i',str(source),'-vf','scale=640:360,minterpolate=fps=24:mi_mode=mci:mc_mode=obmc:me_mode=bidir:me=epzs:search_param=8:mb_size=16,scale=1280:720:flags=lanczos','-t',str(t['seconds']),'-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p',str(target)],check=True)
if '--prepare' in sys.argv or '--only-near' in sys.argv:sys.exit(0)
sr=24000;voice=[]
for t in timeline:
 with wave.open(str(OUT/f"voice_{t['id']:02}.wav"),'rb') as w:a=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(float)/32768
 a=np.concatenate([np.zeros(int(.35*sr)),a,np.zeros(int(.65*sr))]);length=round(t['seconds']*sr);a=np.pad(a,(0,max(0,length-len(a))))[:length];voice.append(a)
voice=np.concatenate(voice);total=len(voice)/sr;music=np.zeros(len(voice));notes=[146.832,164.814,195.998,220,246.942,293.665,329.628,391.995,440]
for n,start in enumerate(np.arange(0,total,.75)):
 freq=notes[[0,4,6,7,4,2,5,3,1,4,7,6,5,2,4,3][n%16]];ts=np.arange(int(2.8*sr))/sr
 sig=sum(np.sin(2*np.pi*freq*k*ts)*np.exp(-ts*(1.8+k*.7))/k**1.5 for k in range(1,6));sig*=np.minimum(ts/.008,1)*.1
 st=int(start*sr);end=min(st+len(sig),len(music));music[st:end]+=sig[:end-st]
ts=np.arange(len(music))/sr;music+=.014*np.sin(2*np.pi*73.416*ts)+.008*np.sin(2*np.pi*110*ts)
fade=np.minimum(ts/2,1)*np.minimum((total-ts)/3,1);duck=np.where(np.abs(voice)>.015,.42,.7);mix=voice*.88+music*fade*duck
with wave.open(str(OUT/'mix_3d.wav'),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes((np.clip(np.stack([mix,mix*.98],axis=1),-1,1)*32767).astype(np.int16).tobytes())
@functools.lru_cache(maxsize=20)
def font(sz,b=False):return ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc' if b else 'C:/Windows/Fonts/msyh.ttc',sz)
def center(d,y,s,sz,col):d.text(((1280-d.textlength(s,font=font(sz)))/2,y),s,font=font(sz),fill=col)
dest=ROOT/'dougong_3d_explained_bilingual.mp4'
proc=subprocess.Popen([FF,'-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s','1280x720','-r','24','-i','-','-i',str(OUT/'mix_3d.wav'),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart',str(dest)],stdin=subprocess.PIPE)
events=[];globalpos=0
for k,t in enumerate(timeline):
 idx=t['id'];parts=chunks[idx];weights=np.array([len(s[0]) for s in parts]);bound=np.concatenate([[0],np.cumsum(weights/weights.sum())]);sec=t['seconds'];duration_voice=sec-1
 for j,(cn,en) in enumerate(parts):events.append((globalpos+.35+bound[j]*duration_voice,globalpos+.35+bound[j+1]*duration_voice,cn,en))
 decoder=subprocess.Popen([FF,'-loglevel','error','-threads','2','-i',str(OUT/f'chapter_3d_v2_{k:02}.mp4'),'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
 n=0;last=None
 while True:
  data=decoder.stdout.read(1280*720*3)
  if len(data)!=1280*720*3:break
  last=data;local=n/24;part=min(len(parts)-1,max(0,int(np.searchsorted(bound,(local-.35)/duration_voice,side='right')-1)))
  image=Image.frombytes('RGB',(1280,720),data).convert('RGBA')
  scaled=image.resize((1067,600),Image.Resampling.LANCZOS);image=Image.new('RGBA',(1280,720),(5,20,17,255));image.paste(scaled,(106,8))
  overlay=Image.new('RGBA',(1280,720));d=ImageDraw.Draw(overlay)
  d.rectangle((0,0,420,90),fill=(5,20,17,180));d.rectangle((0,605,1280,720),fill=(5,20,17,230))
  d.text((35,17),scenes[idx][3],font=font(29,True),fill='#f6e6c9');d.text((35,57),'梁思成 · 一页看懂斗拱 / 三维结构演示',font=font(16),fill='#cbb38b');d.text((1100,30),f'{k+1:02} / 09',font=font(20),fill='#d3bf99')
  center(d,617,parts[part][0],27,'#fff0d4');center(d,661,parts[part][1],18,'#d9c9b0')
  d.text((35,577),'依据原页构件关系制作的三维教学模型',font=font(15),fill=(235,227,206,220));d.rectangle((0,714,int(1280*(globalpos+local)/total),720),fill='#c69a54')
  final=Image.alpha_composite(image,overlay).convert('RGB');proc.stdin.write(final.tobytes());n+=1
  if n==72:final.save(OUT/f'3d_final_preview_{k:02}.jpg')
 decoder.stdout.close();decoder.wait()
 # Optical interpolation can omit endpoint frames. Hold the last rendered view to match audio.
 wanted=round(sec*24)
 for extra in range(max(0,wanted-n)):
  proc.stdin.write(final.tobytes())
 globalpos+=sec;print('COMPOSE',k+1,flush=True)
proc.stdin.close();assert proc.wait()==0
def stamp(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
(ROOT/'dougong_3d_bilingual_subtitles.srt').write_text('\n\n'.join(f'{i+1}\n{stamp(a)} --> {stamp(b)}\n{cn}\n{en}' for i,(a,b,cn,en) in enumerate(events)),encoding='utf-8-sig')
(OUT/'3d_video_metadata.json').write_text(json.dumps({'duration':total,'bytes':dest.stat().st_size,'audio_peak':float(np.max(np.abs(mix))),'subtitles':'完整旁白中英字幕，依据语句长度分配时间，非TTS逐词时间戳','render_fps':3,'output_fps':24},ensure_ascii=False,indent=2),encoding='utf-8')
print('FINISHED',total,flush=True)
