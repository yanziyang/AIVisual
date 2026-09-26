import sys,math,json,re,wave,subprocess,time
from pathlib import Path
from functools import lru_cache
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
ROOT=Path(__file__).resolve().parent.parent; OUT=ROOT/'professional_animation'; OUT.mkdir(exist_ok=True)
sys.path.insert(0,str(ROOT/'.anim-deps'))
import imageio_ffmpeg
FF=imageio_ffmpeg.get_ffmpeg_exe()
DATA=json.loads((ROOT/'output/storyboard_and_narration.json').read_text(encoding='utf-8-sig'))
SCENES=DATA['scenes']; DUR=DATA['durations']; START=np.r_[0,np.cumsum(DUR)]; TOTAL=float(START[-1])
W,H=1920,1080; FPS=30
PAPER='#f5f3ec'; INK='#203e47'; MUTED='#73868a'; GRID='#dddeda'; RED='#d86e48'; BLUE='#38899a'; GOLD='#d4ad65'; GREEN='#718a69'
@lru_cache(None)
def font(n,b=False):return ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc' if b else 'C:/Windows/Fonts/msyh.ttc',n)
def txt(d,x,y,s,n=30,c=INK,a=None,b=False):d.text((x,y),s,font=font(n,b),fill=c,anchor=a)
def ease(x):x=max(0,min(1,x));return x*x*(3-2*x)
def blend(c1,c2,t):
 a=tuple(int(c1[k:k+2],16) for k in (1,3,5)) if isinstance(c1,str) else c1;b=tuple(int(c2[k:k+2],16) for k in (1,3,5)) if isinstance(c2,str) else c2;return tuple(round(x+(y-x)*t) for x,y in zip(a,b))
def stroke(d,p,c=INK,w=3):
 if len(p)>1:d.line([(int(x),int(y)) for x,y in p],fill=c,width=w,joint='curve')
def arrow(d,a,b,c=BLUE,w=4,size=14):
 stroke(d,[a,b],c,w);v=math.atan2(b[1]-a[1],b[0]-a[0]);d.polygon([tuple(b),(b[0]-size*math.cos(v-.45),b[1]-size*math.sin(v-.45)),(b[0]-size*math.cos(v+.45),b[1]-size*math.sin(v+.45))],fill=c)
def polyflow(d,p,t,c=RED,reveal=1,count=12,w=4,speed=.11):
 p=np.asarray(p,float);lim=max(2,int(len(p)*max(0.01,reveal)));stroke(d,p[:lim],c,w)
 for k in range(count):
  u=(t*speed+k/count)%1
  if u>reveal:continue
  idx=min(len(p)-2,int(u*(len(p)-1)));x,y=p[idx]
  for q in range(9):
   j=max(0,idx-q*2);xx,yy=p[j];rr=2+q*.03;col=blend(c,PAPER,q/11)
   d.ellipse((xx-rr,yy-rr,xx+rr,yy+rr),fill=col)
  d.ellipse((x-5,y-5,x+5,y+5),fill=c)
 for u in [.12,.37,.62,.87]:
  if u<reveal:
   i=int(u*(len(p)-1));arrow(d,p[i],p[min(i+4,len(p)-1)],c,w,13)
def card(d,box):d.rounded_rectangle(box,radius=22,fill='#fcfbf7',outline=GRID,width=2)
def tag(d,x,y,s,c=BLUE):
 tw=d.textlength(s,font=font(22));d.rounded_rectangle((x,y,x+tw+32,y+42),radius=10,fill=blend(c,PAPER,.9));txt(d,x+16,y+7,s,22,c)
def bezier(a,b,c,e,n=100):
 u=np.linspace(0,1,n)[:,None];return (1-u)**3*np.array(a)+3*(1-u)**2*u*np.array(b)+3*(1-u)*u*u*np.array(c)+u**3*np.array(e)
def globe(d,cx,cy,r,t,belts=False,shift=0,south=True):
 # Orthographic projection of a rotating wire sphere. Hidden segments are omitted.
 d.ellipse((cx-r-12,cy-r-12,cx+r+12,cy+r+12),outline='#e0e5df',width=2)
 d.ellipse((cx-r,cy-r,cx+r,cy+r),fill='#edf0e9',outline=INK,width=3)
 ang=t*.085+.3; tilt=.12
 def project(lat,lon):
  x=np.cos(lat)*np.sin(lon+ang); z=np.cos(lat)*np.cos(lon+ang);y=np.sin(lat)
  yy=y*math.cos(tilt)-z*math.sin(tilt);zz=y*math.sin(tilt)+z*math.cos(tilt)
  return cx+r*x,cy-r*yy,zz
 def drawcurve(lat,lon,c,w):
  x,y,z=project(lat,lon);seg=[]
  for xx,yy,zz in zip(x,y,z):
   if zz>=0:seg.append((xx,yy))
   else:
    stroke(d,seg,c,w);seg=[]
  stroke(d,seg,c,w)
 u=np.linspace(-math.pi,math.pi,150)
 for deg in range(-60,61,30):drawcurve(np.full(len(u),math.radians(deg)),u,GRID,2)
 v=np.linspace(-math.pi/2,math.pi/2,100)
 for lon in np.linspace(0,2*math.pi,18,endpoint=False):drawcurve(v,np.full(len(v),lon),GRID,2)
 for deg in ([0] if not belts else [-60,-30,0,30,60]):
  lat=math.radians(deg+shift);c=RED if deg in [-60,0,60] else BLUE
  drawcurve(np.full(len(u),lat),u,c,4)
  for k in range(9):
   lon=(t*.32+k*2*math.pi/9);x,y,z=project(lat,lon)
   if z>0:d.ellipse((x-5,y-5,x+5,y+5),fill=c)
 txt(d,cx,cy-r-40,'N',22,MUTED,'mm');
 if south:txt(d,cx,cy+r+35,'S',22,MUTED,'mm')
def loop(d,x1,x2,top,bottom,t,c,reverse=False,reveal=1):
 # Rounded circulation path: surface → ascent → upper branch → descent.
 rx=(x2-x1)/2;ry=(bottom-top)/2;cx=(x1+x2)/2;cy=(top+bottom)/2
 p=np.concatenate([bezier((x1,bottom-55),(x1,bottom-180),(x1,top+60),(x1+55,top)),bezier((x1+55,top),(cx,top-36),(x2-20,top-36),(x2,top+55)),bezier((x2,top+55),(x2,cy),(x2,bottom-50),(x2-55,bottom)),bezier((x2-55,bottom),(cx,bottom+15),(x1,bottom+15),(x1,bottom-55))])
 if reverse:p=p[::-1]
 polyflow(d,p,t,c,reveal,10,4)
def cells(d,t,focus=None,pressure=False,single=False):
 xs=[280,715,1150,1585];top=358;bottom=724
 tag(d,120,235,'北半球 · 纬度—高度剖面 / NORTHERN HEMISPHERE')
 stroke(d,[(230,bottom+28),(1640,bottom+28)],INK,3)
 txt(d,1740,top,'高空',25,MUTED,'mm');txt(d,1740,bottom,'地面',25,MUTED,'mm')
 names=['哈德莱环流','费雷尔环流','极地环流']; en=['HADLEY','FERREL','POLAR']; colors=[RED,GREEN,BLUE]
 if single:
  loop(d,xs[0],xs[3],top,bottom,t,RED,reveal=ease(t/1.8));txt(d,920,505,'不自转的概念模型',39,INK,'mm',True)
 else:
  for j in range(3):
   c=colors[j] if focus is None or focus==j else '#c7d0ca';delay=j*.3 if focus is None else 0
   loop(d,xs[j]+16,xs[j+1]-16,top,bottom,t,c,j==1,ease((t-delay)/1.5))
   txt(d,(xs[j]+xs[j+1])/2,310,names[j],32,c,'mm',True);txt(d,(xs[j]+xs[j+1])/2,528,en[j],24,c,'mm')
   if focus==j:tag(d,(xs[j]+xs[j+1])/2-75,560,['0°—30°','30°—60°','60°—90°'][j],c)
 for j,x in enumerate(xs):
  txt(d,x,bottom+63,['0°','30°N','60°N','90°N'][j],29,INK,'mm')
  if not single:
   col=RED if j%2==0 else BLUE
   d.ellipse((x-28,bottom+100,x+28,bottom+156),fill=blend(col,PAPER,.87));txt(d,x,bottom+127,'L' if j%2==0 else 'H',29,col,'mm',True)
 if pressure:
  for j,x in enumerate(xs):
   c=RED if j%2==0 else BLUE;yy=590+20*math.sin(t*2+j)
   arrow(d,(x,yy+30 if j%2==0 else yy-30),(x,yy-30 if j%2==0 else yy+30),c,5,17)
def belts(d,t,kind,season=False):
 globe(d,540,537,284,t,True,8*math.sin(t*.4) if season else 0)
 tag(d,248,865,'全球纬向平均 · 理想化示意')
 if season:
  txt(d,1210,288,'气压带和风带随季节移动',36,INK,'mm',True)
  for j,y in enumerate([420,550,680]):
   offset=60*math.sin(t*.4);stroke(d,[(930,y+offset),(1590,y+offset)],RED if j%2==0 else BLUE,4)
   for k in range(10):
    x=930+((t*90+k*66)%660);d.ellipse((x-4,y+offset-4,x+4,y+offset+4),fill=RED if j%2==0 else BLUE)
  txt(d,1230,355,'夏季北移 / SUMMER: NORTH',25,RED,'mm');txt(d,1230,790,'冬季南移 / WINTER: SOUTH',25,BLUE,'mm')
  return
 ys=[285,367,449,531,613,695,777];labs=['90°N','60°N','30°N','0°','30°S','60°S','90°S']
 names=['极地高压','副极地低压','副热带高压','赤道低压','副热带高压','副极地低压','极地高压']
 winds=['极地东风','盛行西风','东北信风','东南信风','盛行西风','极地东风']
 for j,y in enumerate(ys):
  c=BLUE if j%2==0 else RED;stroke(d,[(965,y),(1650,y)],blend(c,PAPER,.6),2);txt(d,906,y,labs[j],24,MUTED,'rm');txt(d,1720,y,'H' if j%2==0 else 'L',27,c,'mm',True)
  if kind=='belts':txt(d,1120,y-23,names[j],22,c)
 for j in range(6):
  y=(ys[j]+ys[j+1])/2;right=j in [1,4];down=j in [0,2,4];c=BLUE
  if kind=='trades' and j not in [2,3]:c='#c7d0ca'
  if kind=='winds' and j in [2,3]:c='#c7d0ca'
  sx,ex=(990,1180) if right else (1180,990)
  p=bezier((sx,y-16 if down else y+16),(sx+(ex-sx)*.35,y-16 if down else y+16),(sx+(ex-sx)*.7,y+16 if down else y-16),(ex,y+16 if down else y-16),60)
  polyflow(d,p,t+j,c,ease(t/1.2),4,3,.23);txt(d,1240,y,winds[j],25,c,'lm')
 txt(d,1240,865,'风向按来向命名 / WINDS ARE NAMED BY ORIGIN',21,MUTED,'mm')
def rain(d,t,quiz=False,answer=False):
 for box in [(155,295,903,810),(1017,295,1765,810)]:card(d,box)
 txt(d,529,347,'赤道 · 0°',33,RED,'mm',True);txt(d,1391,347,'副热带 · 30°',33,BLUE,'mm',True)
 for x in [270,355,438,520,606,689,772]:
  p=bezier((x,720),(x-35,620),(x+25,520),(x,458));polyflow(d,p,t,RED,ease(t/1.2),4,3,.22)
 for x in [1150,1233,1316,1399,1482,1565,1648]:
  p=bezier((x,450),(x+35,540),(x-25,625),(x,724));polyflow(d,p,t,BLUE,ease(t/1.2),4,3,.22)
 # Cloud outlines, vegetation and moving raindrops.
 for x,y,r in [(443,457,43),(502,425,56),(570,449,47)]:d.arc((x-r,y-r,x+r,y+r),180,355,fill=INK,width=4)
 stroke(d,[(400,478),(615,478)],INK,4)
 for k in range(12):
  x=405+k*18;y=498+((t*135+k*17)%155);stroke(d,[(x,y),(x-6,y+17)],BLUE,3)
 for x in range(330,760,65):
  stroke(d,[(x,741),(x,685)],GREEN,4);d.polygon([(x-23,708),(x,657),(x+23,708)],outline=GREEN)
 # Sun and dunes.
 d.ellipse((1340,434,1434,528),outline=GOLD,width=4)
 for k in range(12):
  a=k*math.pi/6+t*.04;stroke(d,[(1387+58*math.cos(a),481+58*math.sin(a)),(1387+72*math.cos(a),481+72*math.sin(a))],GOLD,3)
 for y in [710,743]:stroke(d,[(x,y+13*math.sin((x-1100)/95)) for x in range(1120,1680,4)],GOLD,3)
 txt(d,529,859,'上升 · 有利于云雨',29,RED,'mm',True)
 txt(d,1391,859,'上升还是下沉？' if quiz else '下沉 · 不利于降水',29,BLUE,'mm',True)
 if quiz and t>5:
  remaining=max(1,3-int(t-5));d.ellipse((1335,555,1445,665),fill=PAPER,outline=BLUE,width=4);txt(d,1390,610,str(remaining),51,BLUE,'mm',True)
def monsoon(d,t):
 tag(d,140,252,'北半球夏季示意 / NORTHERN HEMISPHERE SUMMER')
 stroke(d,[(210,728),(350,728),(455,533),(560,728),(850,728)],INK,4)
 for j in range(10):
  x=1000+j*60;stroke(d,[(x+k,732+6*math.sin(k/60*math.pi*2+t)) for k in range(60)],BLUE,3)
 txt(d,530,785,'陆地 / LAND',29,INK,'mm',True);txt(d,1320,785,'海洋 / OCEAN',29,BLUE,'mm',True)
 txt(d,530,430,'升温快 · 相对低压',32,RED,'mm');txt(d,1320,430,'升温慢 · 相对高压',32,BLUE,'mm')
 p=bezier((1470,630),(1100,500),(970,580),(630,632));polyflow(d,p,t,BLUE,ease(t/1.5),16,5,.09)
 arrow(d,(530,637),(530,498),RED,5,18);txt(d,960,848,'海陆热力差异 ＋ 环流季节移动',29,MUTED,'mm')

def scene_graphics(i,t):
 im=BG.copy();d=ImageDraw.Draw(im);typ=SCENES[i][3]
 e=ease(t/.8);offset=int((1-e)*24)
 txt(d,100,54,'ATMOSPHERE  /  地球空气快递局',23,MUTED)
 txt(d,100,103+offset,SCENES[i][0].split('：')[0] if typ in ['intro','end'] else SCENES[i][0],53,INK,b=True)
 txt(d,1800,73,f'{i+1:02} / 19',24,MUTED,'rm')
 stroke(d,[(100,185),(1820,185)],GRID,2)
 if typ in ['cells','hadley','ferrel','polar','pressure','single']:
  cells(d,t,{'hadley':0,'ferrel':1,'polar':2}.get(typ),typ=='pressure',typ=='single')
 elif typ in ['belts','trades','winds','season']:belts(d,t,typ,typ=='season')
 elif typ in ['rain','quiz','answer']:rain(d,t,typ=='quiz',typ=='answer')
 elif typ=='monsoon':monsoon(d,t)
 elif typ=='spin':
  globe(d,945,550,272,t,True)
  for cx,cy,flip,col in [(420,484,False,RED),(1510,614,True,BLUE)]:
   p=bezier((cx-70,cy+125),(cx-70,cy-50),(cx+(90 if not flip else -190),cy-85),(cx+(125 if not flip else -225),cy-130))
   polyflow(d,p,t,col,ease(t/1.5),9,4,.1)
  txt(d,395,750,'北半球 · 向右偏',31,RED,'mm',True);txt(d,1510,790,'南半球 · 向左偏',31,BLUE,'mm',True)
  tag(d,737,872,'相对于空气运动方向 / RELATIVE TO MOTION')
 elif typ=='heat':
  globe(d,1130,554,275,t,south=False)
  d.ellipse((246,404,430,588),outline=GOLD,width=4)
  for j in range(16):
   a=j*math.pi/8;stroke(d,[(338+106*math.cos(a),496+106*math.sin(a)),(338+132*math.cos(a),496+132*math.sin(a))],GOLD,4)
  for j in range(7):polyflow(d,[(x,416+j*29) for x in range(505,844,3)],t+j*.15,GOLD,ease(t/1.4),5,2,.14)
  txt(d,338,691,'太阳辐射',32,GOLD,'mm',True);txt(d,1130,871,'低纬受热多 · 高纬受热少',32,INK,'mm',True)
 elif typ=='end':
  globe(d,496,555,245,t,True)
  for j,(a,b) in enumerate([('01  受热不均','Uneven solar heating'),('02  地球自转','Rotation redirects moving air'),('03  三圈环流','Three cells in each hemisphere'),('04  七带六风','Seven pressure belts · six wind belts')]):
   y=295+j*143;card(d,(925,y,1760,y+117));txt(d,959,y+19,a,32,[RED,BLUE,GREEN,INK][j],b=True);txt(d,959,y+68,b,23,MUTED)
 else:
  globe(d,1170,552,292,t,True)
  txt(d,180,329,'看不见的风，',67,INK,b=True);txt(d,180,423,'如何运转整个星球？',60,INK,b=True)
  txt(d,184,544,'THE INVISIBLE ENGINE',30,BLUE);txt(d,184,597,'OF OUR PLANET',30,BLUE)
  tag(d,184,709,'热量 ＋ 水汽 / HEAT + MOISTURE',RED)
  for k in range(3):
   p=bezier((1010,818+k*15),(1560,840+k*15),(1660,260-k*15),(1080,251-k*15));polyflow(d,p,t+k*.2,blend(BLUE,PAPER,k*.23),ease(t/1.6),9,2,.09)
 # Subtitle strip is reserved and never overlaps diagrams.
 d.rectangle((0,930,W,H),fill=INK)
 return im
BG=Image.new('RGB',(W,H),PAPER);bd=ImageDraw.Draw(BG)
for x in range(100,W-90,32):
 for y in range(220,910,32):bd.ellipse((x,y,x+1,y+1),fill='#e0e1d9')
# Sentence-sized captions instead of paragraphs; time-weighted to match existing TTS.
CAPS=[]
for i,s in enumerate(SCENES):
 zh=[x for x in re.split(r'(?<=[。！？；，])',s[1]) if x.strip()];chunks=[];cur=''
 for part in zh:
  if len(cur)+len(part)>30 and cur:chunks.append(cur);cur=''
  cur+=part
 if cur:chunks.append(cur)
 words=s[2].split();enn=[]
 for j in range(len(chunks)):
  a=round(j*len(words)/len(chunks));b=round((j+1)*len(words)/len(chunks));enn.append(' '.join(words[a:b]))
 weights=np.array([len(x) for x in chunks],float);cs=np.r_[0,np.cumsum(weights/weights.sum()*DUR[i])]
 CAPS.append((chunks,enn,cs))
def caption(im,i,t):
 d=ImageDraw.Draw(im);zh,en,cs=CAPS[i];j=min(len(zh)-1,max(0,int(np.searchsorted(cs,t,side='right')-1)))
 txt(d,W/2,970,zh[j],36,'#ffffff','mm')
 words=SCENES[i][2].split();lines=[];current=''
 for word in words:
  if d.textlength(current+' '+word,font=font(24))>1700:lines.append(current);current=word
  else:current=(current+' '+word).strip()
 if current:lines.append(current)
 for k,s in enumerate(lines):txt(d,W/2,1018+k*31,s,24,'#c8dbdc','mm')
 d.rectangle((0,1075,int(W*(START[i]+t)/TOTAL),1079),fill=GOLD)
 return im
def frame(i,t):
 im=scene_graphics(i,t)
 if i>0 and t<.5:
  prev=scene_graphics(i-1,DUR[i-1]-.05);im=Image.blend(prev,im,ease(t/.5))
 return caption(im,i,t)
def stamp(x):
 ms=round(x*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
def preview():
 ids=[0,4,5,6,10,13];sheet=Image.new('RGB',(1920,1620),PAPER)
 for j,i in enumerate(ids):
  im=frame(i,4);im.save(OUT/f'preview_{i:02}.png');sheet.paste(im.resize((960,540),Image.Resampling.LANCZOS),((j%2)*960,(j//2)*540))
 sheet.save(OUT/'contact_sheet.png')
if '--preview' in sys.argv:preview();sys.exit()
preview()
# Reuse verified narration recordings; synthesize a less repetitive, quieter soundtrack.
sr=24000;voices=[]
for i in range(len(SCENES)):
 with wave.open(str(ROOT/'output'/f'voice_{i:02}.wav')) as w:a=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
 voices.append(np.r_[np.zeros(int(.3*sr)),a,np.zeros(int(.8*sr))])
v=np.concatenate(voices);music=np.zeros(len(v));rng=np.random.default_rng(23)
for k,start in enumerate(np.arange(0,TOTAL,.625)):
 chord=[[48,55,60,64],[45,52,57,60],[53,60,65,69],[43,50,55,59]][int(start/10)%4]
 n=chord[k%4]+(12 if k%8>3 else 0);freq=440*2**((n-69)/12);a=int(start*sr);count=min(int(2.4*sr),len(v)-a);q=np.arange(count)/sr
 tone=(np.sin(2*np.pi*freq*q)+.22*np.sin(2*np.pi*freq*2*q))*.023*np.exp(-q*2.6)*np.minimum(q/.018,1)
 music[a:a+count]+=tone
 if k%4==0:music[a:a+count]+=.025*np.sin(2*np.pi*freq/2*q)*np.exp(-q*2)*np.minimum(q/.02,1)
# Smooth amplitude-following sidechain: keep speech clear.
env=np.convolve(np.abs(v)[::240],np.ones(12)/12,mode='same');duck=np.interp(np.arange(len(v)),np.arange(len(env))*240,np.clip(1-env*5,.35,1))
tm=np.arange(len(v))/sr;music*=duck*np.minimum(tm/2,1)*np.minimum((TOTAL-tm)/3,1)
stereo=np.stack([v*.88+music,v*.88+np.roll(music,240)*.91],axis=1)
with wave.open(str(OUT/'professional_audio.wav'),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes((np.clip(stereo,-1,1)*32767).astype(np.int16).tobytes())
cmd=[FF,'-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i',str(OUT/'professional_audio.wav'),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart','-shortest',str(ROOT/'atmospheric_circulation_studio.mp4')]
p=subprocess.Popen(cmd,stdin=subprocess.PIPE)
for n in range(math.ceil(TOTAL*FPS)):
 sec=n/FPS;i=min(18,int(np.searchsorted(START,sec,side='right')-1));p.stdin.write(frame(i,sec-START[i]).tobytes())
 if n%(FPS*5)==0:print('RENDER',round(sec,1),'/',round(TOTAL,1),flush=True)
p.stdin.close();assert p.wait()==0
rows=[]
for i,(zh,en,cs) in enumerate(CAPS):
 for j in range(len(zh)):rows.append(f'{len(rows)+1}\n{stamp(START[i]+cs[j])} --> {stamp(START[i]+cs[j+1])}\n{zh[j]}\n{SCENES[i][2]}')
(OUT/'bilingual_subtitles.srt').write_text('\n\n'.join(rows),encoding='utf-8-sig')
print('DONE',TOTAL,flush=True)
