import sys, pathlib, asyncio, subprocess, json, wave, math
from functools import lru_cache
ROOT=pathlib.Path(__file__).parent.parent
sys.path.insert(0,str(ROOT/'video_deps'))
import edge_tts, imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont
OUT=ROOT/'liang_sicheng_dougong'; OUT.mkdir(exist_ok=True)
FF=imageio_ffmpeg.get_ffmpeg_exe()
scenes=[
('屋檐，为什么能伸出去？','How can an eave reach beyond its columns?','一座木建筑的屋檐，为什么能伸出柱子之外？答案，就藏在梁思成的这张图里。','一页里的结构密码','THE SECRET INSIDE A PAGE','full'),
('中国建筑之 ORDER','The Chinese “Order”','这页题为，中国建筑之，ORDER。它把斗拱、柱、柱础连成一体，让我们从屋檐一路读到地面。','从屋檐，读到地面','EAVES • BRACKETS • COLUMN • BASE','full'),
('先看路径：屋面 → 斗拱 → 柱 → 柱础','Follow the load: roof → brackets → column → base','先抓住一条线索：屋面的荷载，通过梁枋和斗拱等构件，传到柱，再传向柱础与地基。','重量怎样落地？','A SIMPLIFIED LOAD PATH','load'),
('斗与拱，像托盘与伸出的手臂','Blocks receive; arms reach outward','斗拱，像一组层层伸出的手臂。斗承接交叉的木件，拱向不同方向伸展。它们一起托起屋檐。','斗 × 拱','BLOCKS × BRACKET ARMS','bracket'),
('20 栌斗：柱头上的承接节点','20 • Ludou: the receiving block above the column','看编号二十，栌斗。它坐在柱头上，是这组斗拱下部的重要承接节点。往上看，木件纵横相交。','找到栌斗','20 • LUDOU','bracket'),
('19 华拱：向外出跳的构件','19 • Huagong: an outward-reaching arm','再看十九，华拱。它向柱外伸出，形成出跳。屋檐的伸展，在这里开始有了清楚的结构层次。','第一跳：华拱','FIRST PROJECTION • HUAGONG','bracket'),
('17 昂：图中斜向延伸的构件','17 • Ang: the inclined members in the drawing','编号十七是昂。图上能看到它斜向延伸。注意，昂不是装饰花纹，而是这组构件关系中的一员。','再往外：昂','17 • ANG','bracket'),
('这组斗拱：三跳 = 一华拱 + 两昂','Three projections = one huagong + two ang','页旁直接写明：这幅示例出三跳，由一华拱、两昂组成。跳，数的是向外挑出的层次，不是木块总数。','三跳，怎么数？','1 HUAGONG + 2 ANG = 3 PROJECTIONS','steps'),
('材：让构件尺寸互相协调的比例基准','Cai: a modular reference for coordinated dimensions','另一把钥匙，是材。页旁说，各部尺寸可以用材，以及它的倍数或分数来度量。这是一套相互协调的比例语言。','材：建筑的比例语言','CAI • A MODULAR REFERENCE','module'),
('上部：飞椽、檐椽与橑檐枋','Above: flying rafters, eave rafters and eave purlin','回到屋檐。编号一是飞椽，二是檐椽，三是橑檐枋。密密的线条，原来都在说明构件怎样衔接。','屋檐的线条，有名字','1 • 2 • 3 / THE EAVE MEMBERS','roof'),
('下部：柱、柱础与地栿','Below: column, base and ground-level tie','再往下，二十四是柱，二十六是柱础，二十五是地栿。柱础下的分项，让支承的底部也有了细致的名字。','从柱身到柱础','24 • COLUMN / 26 • BASE','base'),
('ORDER：读懂构件之间的秩序','Order: reading the relationships between parts','这里的，ORDER，可以理解为一种构件组合的秩序。读这页，关键不只是记住名词，而是看懂尺寸、层次和承接关系。','看懂关系，才看懂建筑','PROPORTION • PROJECTION • SUPPORT','full'),
('下次抬头看屋檐，你会看到结构','Next time you look up, you will see the structure','下次走到古建筑前，抬头看看屋檐：找到柱，找到栌斗，再沿着拱和昂，追踪它向外伸出的层次。梁思成的一页图，就这样活了起来。','让一页图，活起来','LOOK UP. FOLLOW THE STRUCTURE.','full')]
async def voices():
 for i,s in enumerate(scenes):
  p=OUT/f'voice_{i:02}.mp3'
  if not p.exists():
   await edge_tts.Communicate(s[2], 'zh-CN-YunxiNeural',rate='+2%').save(str(p))
  subprocess.run([FF,'-y','-loglevel','error','-i',str(p),'-ar','24000','-ac','1',str(OUT/f'voice_{i:02}.wav')],check=True)
asyncio.run(voices())
dur=[]; aud=[]; sr=24000
for i in range(len(scenes)):
 with wave.open(str(OUT/f'voice_{i:02}.wav'),'rb') as w: a=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float64)/32768
 a=np.concatenate([np.zeros(int(.35*sr)),a,np.zeros(int(.65*sr))]); aud.append(a);dur.append(len(a)/sr)
total=sum(dur); print('DURATION',total,flush=True)
voice=np.concatenate(aud); music=np.zeros(len(voice)); rng=np.random.default_rng(42)
# Original pentatonic score: plucked-string timbre, soft drone and sparse bell accents.
notes=[146.832,164.814,195.998,220,246.942,293.665,329.628,391.995,440]
for n,start in enumerate(np.arange(0,total,0.75)):
 freq=notes[[0,4,6,7,4,2,5,3,1,4,7,6,5,2,4,3][n%16]]
 ts=np.arange(int(2.8*sr))/sr
 sig=sum(np.sin(2*np.pi*freq*k*ts)*np.exp(-ts*(1.8+k*.7))/k**1.5 for k in range(1,6))
 sig*=np.minimum(ts/.008,1)*.11
 st=int(start*sr); end=min(st+len(sig),len(music));music[st:end]+=sig[:end-st]
t=np.arange(len(music))/sr
music+=.018*np.sin(2*np.pi*73.416*t)+.012*np.sin(2*np.pi*110*t)
fade=np.minimum(t/2,1)*np.minimum((total-t)/3,1)
duck=np.where(np.abs(voice)>.015,.42,.7)
mix=voice*.88+music*fade*duck
stereo=np.stack([mix,mix*.98],axis=1)
with wave.open(str(OUT/'mix.wav'),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes((np.clip(stereo,-1,1)*32767).astype(np.int16).tobytes())
W,H=1280,720;FPS=24
src=Image.open(ROOT/'pictorial_history_of_chinese_architecture.jpg').convert('RGB')
fontpath='C:/Windows/Fonts/msyh.ttc';bold='C:/Windows/Fonts/msyhbd.ttc'
@lru_cache(maxsize=32)
def font(size,b=False):return ImageFont.truetype(bold if b else fontpath,size)
def text(d,xy,s,size=24,color='#eadbc4',b=False):d.text(xy,s,font=font(size,b),fill=color)
def center(d,y,s,size,color='#f6ecd9',b=False):d.text(((W-d.textlength(s,font=font(size,b)))/2,y),s,font=font(size,b),fill=color)
def wrap(s,maxw,size):
 lines=[];line=''
 for c in s:
  if font(size).getlength(line+c)>maxw:lines.append(line);line=c
  else:line+=c
 lines.append(line);return lines
def arrow(d,a,b,color='#d7ac62',width=6):
 d.line([a,b],fill=color,width=width);ang=math.atan2(b[1]-a[1],b[0]-a[0]);pts=[b,(b[0]-18*math.cos(ang-.5),b[1]-18*math.sin(ang-.5)),(b[0]-18*math.cos(ang+.5),b[1]-18*math.sin(ang+.5))];d.polygon(pts,fill=color)
def frame(i,p):
 s=scenes[i];im=Image.new('RGB',(W,H),'#10221f');d=ImageDraw.Draw(im)
 for y in range(H):d.line((0,y,W,y),fill=(15+int(y/70),31+int(y/90),29+int(y/100)))
 text(d,(48,25),'梁思成 · 图像中国建筑史',20);text(d,(1055,28),f'{i+1:02} / {len(scenes):02}',19)
 d.line((48,65,1232,65),fill='#826b49',width=1)
 text(d,(48,91),s[3],39,b=True);text(d,(50,147),s[4],17,color='#d3ac70')
 mode=s[5]
 if mode in ['full','bracket','roof','base']:
  box={'full':(0,0,858,1130),'bracket':(255,65,765,515),'roof':(15,15,750,270),'base':(345,440,828,1090)}[mode]
  pic=src.crop(box);maxw=660;maxh=350;scale=min(maxw/pic.width,maxh/pic.height)*(1+.045*p)
  pic=pic.resize((int(pic.width*scale),int(pic.height*scale)),Image.Resampling.LANCZOS)
  x=int(845-pic.width/2);y=int(365-pic.height/2);im.paste(pic,(x,y));d=ImageDraw.Draw(im)
  desc={'full':['一张图，连接屋檐与地面','Read the whole structural system'],'bracket':['斗 · 拱 · 昂','Blocks, arms and inclined members'],'roof':['① 飞椽  ② 檐椽  ③ 橑檐枋','The eave is a coordinated assembly'],'base':['㉔ 柱  ㉖ 柱础','Support continues down to the ground']}[mode]
  text(d,(50,240),desc[0],24);text(d,(50,281),desc[1],15)
  if mode=='bracket':
   pts={4:(505,410),5:(400,360),6:(365,255)}
   if i in pts:
    a=pts[i];xx=x+int((a[0]-box[0])*scale);yy=y+int((a[1]-box[1])*scale)
    r=30+5*math.sin(p*math.pi*3);d.ellipse((xx-r,yy-r,xx+r,yy+r),outline='#e99f36',width=4)
  if mode=='full':text(d,(50,390),'原页细读 / ORIGINAL DRAWING',14,color='#a58e6d')
 elif mode=='load':
  labels=[('屋面','ROOF'),('斗拱等构件','BRACKETS & MEMBERS'),('柱','COLUMN'),('柱础 · 地基','BASE & FOUNDATION')]
  for k,(cn,en) in enumerate(labels):
   yy=219+k*77;d.rounded_rectangle((490,yy,1010,yy+58),radius=10,fill='#263c34',outline='#987c50',width=2);text(d,(510,yy+9),cn,24);text(d,(730,yy+18),en,14)
   if k<3:arrow(d,(750,yy+59),(750,yy+75),width=3)
  yy=225+(p*3%1)*275;d.ellipse((1030,yy-8,1046,yy+8),fill='#edc37b')
  text(d,(50,245),'先追踪重量',28);text(d,(50,292),'受力路径为简化示意',18,color='#bfa885')
 elif mode=='steps':
  d.rectangle((550,417,615,533),fill='#786345');d.rectangle((530,386,635,416),fill='#bb965c')
  for k in range(3):
   xx=610+k*150; yy=365-k*65
   d.rounded_rectangle((565,yy,xx+100,yy+25),radius=5,fill=['#c6a16b','#dcba82','#ead4a9'][k]);arrow(d,(630,yy-18),(xx+90,yy-18),width=3)
   text(d,(1060,yy-2),['1 华拱','2 昂','3 昂'][k],24)
   dotx=630+(xx+90-630)*((p*2+k*.25)%1);d.ellipse((dotx-5,yy-23,dotx+5,yy-13),fill='#fff0c8')
  text(d,(50,240),'跳 = 向外挑出的层次',26);text(d,(50,289),'PROJECTIONS, NOT BLOCK COUNT',14);text(d,(700,482),'原页：一华拱 + 两昂',22);text(d,(50,335),'层次示意，非构造复原',18,color='#bfa885')
 elif mode=='module':
  text(d,(50,250),'共同基准 → 协调比例',27);text(d,(50,299),'ONE MODULE, RELATED DIMENSIONS',14)
  for k,n in enumerate([1,2,3]):
   yy=225+k*100
   for j in range(n):d.rectangle((665+j*110,yy,760+j*110,yy+52),fill='#b99864',outline='#e9d1a4',width=2)
   text(d,(1040,yy+5),f'{n} × 材',25)
  text(d,(655,532),'比例示意，不代表具体构件实测尺寸',16,color='#bfa885')
 d.rounded_rectangle((30,584,1250,686),radius=14,fill='#081511')
 lines=wrap(s[0],1170,27)
 for k,line in enumerate(lines):center(d,598+k*33,line,27)
 enlines=wrap(s[1],1150,19)
 for k,line in enumerate(enlines):center(d,641+k*24,line,19,color='#cbbb9e')
 d.rectangle((0,712,int(W*(sum(dur[:i])+p*dur[i])/total),720),fill='#cba25e')
 # A short dissolve from darkness gives each chapter a soft entrance.
 fac=min(1,p*dur[i]/.4,(1-p)*dur[i]/.35)
 if fac<1:im=Image.blend(Image.new('RGB',(W,H),'#10221f'),im,max(0,fac))
 return im
cmd=[FF,'-y','-loglevel','error','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i',str(OUT/'mix.wav'),'-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart',str(OUT/'dougong_explained_bilingual.mp4')]
proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
for i,seconds in enumerate(dur):
 print('RENDER',i+1,flush=True)
 count=round(seconds*FPS)
 for n in range(count):proc.stdin.write(frame(i,n/max(1,count-1)).tobytes())
 frame(i,.5).save(OUT/f'preview_{i:02}.jpg')
proc.stdin.close();rc=proc.wait();assert rc==0
def stamp(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
subs=[];pos=0
for i,s in enumerate(scenes):subs.append(f'{i+1}\n{stamp(pos)} --> {stamp(pos+dur[i])}\n{s[0]}\n{s[1]}\n');pos+=dur[i]
(OUT/'bilingual_subtitles.srt').write_text('\n'.join(subs),encoding='utf-8-sig')
(OUT/'interpretation_and_production_notes.md').write_text('# 一页看懂斗拱\n\n原图：用户提供的《图像中国建筑史》书页。片中解说为现代释读，不是梁思成原话。\n\n本页标题为 The Chinese “Order”，将斗拱、柱、柱础组合为结构体系；页旁明确写出以材及其倍数、分数为比例基准，并说明示例为三跳，一华拱、两昂。图中20为栌斗，19为华拱，17为昂，24为柱，26为柱础，25为地栿。ORDER在片中解释为构件组合的秩序，不将其机械等同于西方古典柱式。\n\n受力路径和比例方块是教学简图，不是力学计算或实测复原。原图特写保留原始线稿。音乐为代码原创合成的五声音阶拨弦配乐；中文旁白由 zh-CN-YunxiNeural TTS 合成。视频含烧录中英字幕，同时提供SRT。\n\n延伸核验参考（材分制、出跳与《营造法式》）：https://www.jgcm.ac.cn/jah/cn/article/pdf/preview/10.12329/20969368.2021.02007.pdf\n\n## 旁白\n\n'+'\n\n'.join(s[2] for s in scenes),encoding='utf-8')
print('DONE',OUT,flush=True)
