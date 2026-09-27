import sys, os, math, asyncio, subprocess, wave, json, random
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path
sys.path.insert(0,str(Path('animation_deps').resolve()))
import edge_tts, imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT=Path(__file__).resolve().parent
FF=imageio_ffmpeg.get_ffmpeg_exe()
W,H,FPS=1280,720,24
fontpath='C:/Windows/Fonts/msyh.ttc'
F={s:ImageFont.truetype(fontpath,s) for s in [18,22,26,28,32,40,64,78]}
# scene, Chinese, English, voice
LINES=[
(0,'春天，把池塘轻轻唤醒了。','Spring gently woke the pond.','n'),
(0,'一群小蝌蚪，第一次看见了这个世界。','A little shoal of tadpoles saw the world for the first time.','n'),
(1,'鸭妈妈带着宝宝游过。可是，我们的妈妈在哪里？','A mother duck swam by with her ducklings. But where was our mother?','n'),
(1,'鸭妈妈，您是我们的妈妈吗？','Mother Duck, are you our mother?','c'),
(1,'你们的妈妈有两只大眼睛。往前找找吧！','Your mother has two big eyes. Keep looking ahead!','m'),
(2,'大眼睛！小蝌蚪追上了金色的鲤鱼。','Big eyes! The tadpoles hurried after a golden carp.','n'),
(2,'我不是你们的妈妈。她还有四条腿呢。','I am not your mother. She has four legs, too.','m'),
(3,'四条腿！那一定是岸边的乌龟吧？','Four legs! Could it be the turtle by the bank?','c'),
(3,'别着急。你们的妈妈，穿着绿色的衣裳。','Take your time. Your mother wears a green coat.','m'),
(4,'天忽然暗了。雨，把池塘敲得叮叮咚咚。','The sky grew dark. Rain tapped a little song on the pond.','n'),
(4,'世界这么大，妈妈会不会找不到我们？','The world is so big. What if Mom cannot find us?','c'),
(4,'他们挨在一起。谁也没有放开谁。','They stayed close together. No one left anyone behind.','n'),
(5,'就在这时，荷叶下面，传来一声：呱！','Then, from beneath a lotus leaf, came a gentle croak!','n'),
(5,'大眼睛，四条腿，绿色的衣裳！妈妈！','Big eyes, four legs, a green coat! Mom!','c'),
(5,'好孩子，妈妈在这里。','My little ones, Mommy is right here.','m'),
(6,'他们终于明白：一路寻找，也是在一点一点长大。','They discovered that every step of the search helped them grow.','n'),
(6,'而妈妈的怀抱，是世界上最温暖的池塘。','And their mother’s embrace was the warmest pond in the world.','n'),
]
VOICES={'n':('zh-CN-XiaoxiaoNeural','-8%','+0Hz'),'c':('zh-CN-XiaoyiNeural','+0%','+6Hz'),'m':('zh-CN-XiaoxiaoNeural','-12%','-3Hz')}
def decode(path):
 b=subprocess.check_output([FF,'-v','error','-i',str(path),'-f','f32le','-ac','1','-ar','44100','-'])
 return np.frombuffer(b,dtype=np.float32).copy()
async def voices():
 for i,(_,zh,en,v) in enumerate(LINES):
  path=ROOT/f'voice_{i:02}.mp3'
  if not path.exists():
   vn,rate,pitch=VOICES[v]
   for attempt in range(3):
    try:
     await edge_tts.Communicate(zh,vn,rate=rate,pitch=pitch).save(str(path));break
    except Exception:
     if attempt==2:raise
     await asyncio.sleep(1)
  print('voice',i,flush=True)
asyncio.run(voices())
clips=[decode(ROOT/f'voice_{i:02}.mp3') for i in range(len(LINES))]
timeline=[];t=5.0
for i,(line,clip) in enumerate(zip(LINES,clips)):
 scene,zh,en,v=line
 if i and scene!=LINES[i-1][0]: t+=1.3
 dur=len(clip)/44100
 timeline.append(dict(scene=scene,start=t,end=t+dur,zh=zh,en=en))
 t+=dur+1.3
DURATION=t+5
bounds={s:min(x['start'] for x in timeline if x['scene']==s)-1 for s in range(7)}
bounds[0]=0
(ROOT/'timeline.json').write_text(json.dumps(timeline,ensure_ascii=False,indent=2),encoding='utf-8')
def stamp(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
(ROOT/'subtitles.zh-en.srt').write_text('\n\n'.join(f"{i+1}\n{stamp(x['start'])} --> {stamp(x['end']+.3)}\n{x['zh']}\n{x['en']}" for i,x in enumerate(timeline)),encoding='utf-8')
# Original pentatonic score: plucked strings, breathy flute and soft water percussion.
SR=44100; N=int((DURATION+.2)*SR); score=np.zeros((N,2),np.float32)
rng=np.random.default_rng(17)
def note(at,dur,midi,amp,kind=0,pan=0):
 start=int(at*SR);n=min(int(dur*SR),N-start)
 if n<=0:return
 q=np.arange(n)/SR;hz=440*2**((midi-69)/12)
 if kind==0:
  a=sum(np.sin(2*np.pi*hz*k*q)*np.exp(-q*(1.5+k*.9))/k**1.5 for k in range(1,6))
  a*=np.minimum(q/.015,1)*np.minimum((dur-q)/.15,1)
 else:
  a=(np.sin(2*np.pi*hz*q+0.035*np.sin(q*31))+ .18*np.sin(4*np.pi*hz*q))
  a*=np.minimum(q/.25,1)*np.minimum((dur-q)/.4,1)*(.85+.15*np.sin(q*6))
 a=a*amp
 score[start:start+n,0]+=a*(.7-pan*.25);score[start:start+n,1]+=a*(.7+pan*.25)
melody=[74,77,79,81,79,77,74,72,69,72,74,77,74,72,69,67]
for j,at in enumerate(np.arange(0,DURATION,1.65)):
 scene=max(s for s,b in bounds.items() if at>=b)
 amp=.07 if scene!=4 else .035
 note(at,3,melody[j%len(melody)]-(12 if scene==4 else 0),amp,0,math.sin(j)*.7)
 if j%4==0: note(at,5,[50,53,57,60][j//4%4],.035,0,-.5)
 if j%3==0 and scene!=4:note(at+.45,2.5,melody[(j+4)%len(melody)],.027,1,.5)
voice=np.zeros(N,np.float32)
for x,c in zip(timeline,clips):
 st=int(x['start']*SR);voice[st:st+len(c)]+=c
 # Duck music smoothly under speech.
 a=max(0,st-int(.25*SR));b=min(N,st+len(c)+int(.4*SR));score[a:b]*=.52
# Rain rises during the moment of uncertainty, then falls away.
rain_start=bounds[4];rain_end=bounds[5]
for at in np.arange(rain_start,rain_end,.18):
 st=int(at*SR);n=2200;q=np.arange(n)/SR
 drop=rng.normal(0,1,n)*np.exp(-q*110)*.025
 score[st:st+n,0]+=drop;score[st:st+n,1]+=drop[::-1]*.5
mix=score+voice[:,None]*.85
fade=np.minimum(np.arange(N)/SR/2,1)*np.minimum((N-np.arange(N))/SR/4,1)
mix*=fade[:,None];mix=np.clip(mix,-.95,.95)
with wave.open(str(ROOT/'soundtrack.wav'),'wb') as wf:
 wf.setnchannels(2);wf.setsampwidth(2);wf.setframerate(SR);wf.writeframes((mix*32767).astype('<i2').tobytes())
print('DURATION',DURATION,flush=True)
BG=Image.open(ROOT/'pond.png').convert('RGB').resize((W,H),Image.Resampling.LANCZOS)
INK=(35,45,39,230);GREEN=(80,113,67,210)
def ellipse(d,box,fill):
 d.ellipse(box,fill=fill)
def sprite(kind):
 im=Image.new('RGBA',(420,310));d=ImageDraw.Draw(im)
 if kind=='duck':
  ellipse(d,(100,124,315,245),(203,190,144,220));ellipse(d,(264,46,345,143),(212,198,147,230))
  d.polygon([(330,88),(388,103),(335,117)],fill=(164,100,50,240));d.polygon([(121,160),(56,117),(106,214)],fill=(126,115,82,190))
  d.arc((130,144,280,236),20,210,fill=(82,78,60,160),width=4);ellipse(d,(312,77,320,85),INK)
 elif kind=='fish':
  ellipse(d,(96,99,310,220),(189,117,71,220));d.polygon([(109,150),(38,85),(48,239),(116,177)],fill=(150,80,52,190))
  d.polygon([(147,113),(208,50),(266,114)],fill=(180,102,67,170));d.polygon([(169,192),(214,257),(253,205)],fill=(174,102,64,180))
  for k in range(5):d.arc((134+k*27,119,185+k*27,195),80,260,fill=(106,78,57,130),width=2)
  ellipse(d,(271,126,290,144),(239,227,195,240));ellipse(d,(279,130,287,139),INK)
  d.arc((270,123,309,211),80,160,fill=INK,width=3)
 elif kind=='turtle':
  for x,y in [(111,98),(244,101),(109,215),(249,213)]:ellipse(d,(x-27,y-18,x+30,y+20),GREEN)
  ellipse(d,(85,82,300,237),(90,108,72,230));ellipse(d,(279,126,367,186),(133,147,95,230))
  ellipse(d,(341,139,350,148),INK);d.polygon([(173,101),(228,104),(260,154),(227,203),(171,207),(136,151)],outline=(44,65,44,200),width=4)
  for a,b in [((173,101),(143,84)),((228,104),(267,91)),((260,154),(295,151)),((227,203),(261,230)),((171,207),(130,225)),((136,151),(89,152))]:d.line([a,b],fill=(44,65,44,160),width=3)
 elif kind=='frog':
  ellipse(d,(58,149,166,273),GREEN);ellipse(d,(251,149,368,274),GREEN)
  ellipse(d,(108,92,318,266),(93,127,74,235));ellipse(d,(133,141,293,257),(186,198,136,210))
  ellipse(d,(113,42,200,131),GREEN);ellipse(d,(230,42,316,131),GREEN)
  for x in [140,257]:
   ellipse(d,(x,59,x+39,102),(227,226,189,245));ellipse(d,(x+13,66,x+28,90),INK)
  d.arc((151,97,283,170),8,168,fill=INK,width=4)
  d.line([(146,181),(126,257),(99,268)],fill=(43,72,45,220),width=9);d.line([(278,181),(297,257),(329,268)],fill=(43,72,45,220),width=9)
  for x,y in [(119,128),(288,128),(112,217),(308,221)]:ellipse(d,(x,y,x+13,y+9),(45,77,46,150))
 # Delicate feathered edges create a wet brush impression.
 halo=im.filter(ImageFilter.GaussianBlur(2.2));halo.alpha_composite(im)
 return halo
SPR={k:sprite(k) for k in ['duck','fish','turtle','frog']}
sheetpath=ROOT/'characters.png'
if sheetpath.exists():
 sheet=Image.open(sheetpath).convert('RGBA')
 for kind,box in zip(['duck','fish','turtle','frog'],[(0,0,.485,.54),(.485,0,1,.54),(0,.54,.55,1),(.55,.54,1,1)]):
  tile=sheet.crop(tuple(round(v*(sheet.width if i%2==0 else sheet.height)) for i,v in enumerate(box)))
  box=tile.getchannel('A').getbbox()
  if box:tile=tile.crop(box)
  tile.thumbnail((390,285),Image.Resampling.LANCZOS)
  canvas=Image.new('RGBA',(420,310));canvas.alpha_composite(tile,((420-tile.width)//2,(310-tile.height)//2))
  SPR[kind]=canvas
SIZED={}
def put(im,kind,x,y,scale=1,angle=0):
 key=(kind,scale)
 if key not in SIZED:SIZED[key]=SPR[kind].resize((int(420*scale),int(310*scale)),Image.Resampling.BICUBIC)
 sp=SIZED[key]
 if angle:sp=sp.rotate(angle,resample=Image.Resampling.BICUBIC,expand=True)
 im.alpha_composite(sp,(int(x-sp.width/2),int(y-sp.height/2)))
def tadpole(d,x,y,size,phase,heading=1,legs=False):
 # Flexible tail drawn in tapering brush strokes, animated per frame.
 pts=[]
 for k in range(22):
  u=k/21;pts.append((x-heading*(size*.5+size*3*u),y+math.sin(u*5-phase)*size*.7*u))
 for k in range(21):d.line([pts[k],pts[k+1]],fill=(37,47,41,220-int(k*2)),width=max(1,int(size*.42*(1-k/22))))
 ellipse(d,(x-size,y-size*.73,x+size,y+size*.73),(30,39,33,240))
 ellipse(d,(x-size*.6,y-size*.5,x+size*.55,y+size*.3),(47,57,47,155))
 ellipse(d,(x+heading*size*.38-2,y-size*.3-2,x+heading*size*.38+2,y-size*.3+2),(237,234,213,215))
 if legs:
  for side in [-1,1]:d.line([(x-size*.4,y),(x-size,y+side*size),(x-size*1.5,y+side*size)],fill=INK,width=3)
def center(d,txt,y,size,color):
 box=d.textbbox((0,0),txt,font=F[size]);d.text(((W-(box[2]-box[0]))/2,y),txt,font=F[size],fill=color)
def frame(t):
 scene=max(s for s,b in bounds.items() if t>=b);local=t-bounds[scene]
 zoom=1+.012*(.5+.5*math.sin(t*.055))
 im=BG.transform((W,H),Image.Transform.AFFINE,(1/zoom,0,(W-W/zoom)/2,0,1/zoom,(H-H/zoom)/2),Image.Resampling.BILINEAR).convert('RGBA');ov=Image.new('RGBA',(W,H));d=ImageDraw.Draw(ov)
 # Water rings gently expand and fade, independent of the camera.
 for k in range(7):
  q=(t*.35+k*.27)%2;r=20+q*32;x=170+k*150;y=320+(k%3)*76
  d.ellipse((x-r,y-r*.22,x+r,y+r*.22),outline=(93,122,111,int(32*(1-q/2))),width=2)
 im.alpha_composite(ov)
 if scene==1:
  x=860+35*math.sin(local*.3);put(im,'duck',x,365,.65,math.sin(t*2)*2)
  for k in range(3):put(im,'duck',x-140-k*75,410+math.sin(t*3+k)*8,.21)
 if scene==2:put(im,'fish',870+50*math.sin(local*.32),380+math.sin(t*2)*11,.78,math.sin(t)*4)
 if scene==3:put(im,'turtle',905+15*math.sin(local*.2),412,.78,math.sin(t*.6))
 if scene>=5:
  # A broad lotus leaf shelters the mother.
  leaf=Image.new('RGBA',(W,H));ld=ImageDraw.Draw(leaf)
  ld.ellipse((729,209,1120,318),fill=(80,112,71,210));ld.line([(919,266),(982,412)],fill=(53,82,57,160),width=5)
  for k in range(9):
   a=k*math.pi/4.5;ld.line([(919,264),(919+183*math.cos(a),264+45*math.sin(a))],fill=(42,77,47,85),width=2)
  im.alpha_composite(leaf)
  arrival=min(1,max(0,local/2));put(im,'frog',928,450-60*arrival+math.sin(t*2)*3,.83)
 ov=Image.new('RGBA',(W,H));d=ImageDraw.Draw(ov)
 for k in range(6):
  if scene==0:x=370+k*67+60*math.sin(t*.4+k*.2);y=412+35*math.sin(t*.7+k)
  elif scene==4:x=605+math.cos(k*math.pi/3)*60;y=422+math.sin(k*math.pi/3)*38+math.sin(t*2+k)*5
  elif scene>=5:
   p=min(1,local/10);x=430+k*28+p*(290+35*math.sin(k));y=422+math.cos(k)*45+math.sin(t*1.5+k)*8
  else:x=405+k*38+45*math.sin(t*.5+k*.25);y=414+35*math.sin(k*1.4+t*.6)
  tadpole(d,x,y,17 if k==0 else 13,t*7+k,legs=scene==6)
 if scene==4:
  for k in range(70):
   x=(k*137.1+t*38)%W;y=(k*78+t*210)%H
   d.line([(x,y),(x-5,y+15)],fill=(69,97,95,70),width=1)
 im.alpha_composite(ov)
 if scene==4:
  im.alpha_composite(Image.new('RGBA',(W,H),(31,59,62,32)))
 elif scene>=5:
  im.alpha_composite(Image.new('RGBA',(W,H),(255,225,155,12)))
 ov=Image.new('RGBA',(W,H));d=ImageDraw.Draw(ov)
 chapter=['初醒 · A new world','一问 · Mother Duck','再问 · The golden carp','线索 · Four little legs','风雨 · Stay together','回声 · A familiar voice','团圆 · Home'][scene]
 d.rounded_rectangle((30,24,390,72),radius=10,fill=(243,239,226,190))
 d.text((46,32),chapter,font=F[22],fill=(49,69,53,180))
 if t<5:
  alpha=int(255*min(1,t/1,(5-t)/.8));d.rectangle((0,0,W,H),fill=(242,238,224,155))
  center(d,'小蝌蚪找妈妈',220,78,(32,51,39,alpha));center(d,'TADPOLES FIND THEIR MOTHER',326,28,(58,78,62,alpha))
  center(d,'一场关于寻找、勇气与爱的水墨旅程',389,26,(71,88,68,alpha))
  d.rectangle((607,450,672,505),fill=(159,59,46,alpha));center(d,'春 生',462,22,(248,240,220,alpha))
 for line in timeline:
  if line['start']<=t<=line['end']+.4:
   d.rounded_rectangle((80,592,1200,700),radius=12,fill=(242,239,226,224))
   center(d,line['zh'],602,32,(27,46,37,255));center(d,line['en'],654,22,(56,74,62,255));break
 if t>DURATION-6:
  a=int(230*min(1,(t-(DURATION-6))/2));d.rectangle((0,0,W,H),fill=(243,239,226,a))
  center(d,'每一次寻找，都让爱更近一点。',270,40,(37,61,44,255))
  center(d,'Every little journey brings love closer.',336,26,(66,88,70,255))
  center(d,'小蝌蚪找妈妈  ·  完',431,26,(101,117,93,255))
 im.alpha_composite(ov)
 return im.convert('RGB')
if '--preview' in sys.argv:
 for s in range(7):frame(bounds[s]+5).save(ROOT/f'preview_{s}.jpg',quality=90)
 print('PREVIEWS_DONE',flush=True)
elif '--audio-only' not in sys.argv:
 out=ROOT/'tadpoles_find_their_mother_ink_animation.mp4'
 cmd=[FF,'-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i',str(ROOT/'soundtrack.wav'),'-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-t',str(DURATION),'-movflags','+faststart',str(out)]
 proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
 for n in range(math.ceil(DURATION*FPS)):
  proc.stdin.write(frame(n/FPS).tobytes())
  if n%(FPS*10)==0:print('render',round(n/FPS),'/',round(DURATION),flush=True)
 proc.stdin.close()
 if proc.wait()!=0:raise RuntimeError('Encoding failed')
 for s in range(7):frame(bounds[s]+3).save(ROOT/f'scene_{s}.jpg',quality=90)
 frame(2).save(ROOT/'poster.jpg',quality=95)
 print('DONE',str(out),flush=True)

