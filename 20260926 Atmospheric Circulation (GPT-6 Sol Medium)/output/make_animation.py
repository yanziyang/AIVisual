import sys, os, asyncio, subprocess, wave, math, json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent/'.anim-deps'))
import edge_tts, imageio_ffmpeg, numpy as np
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).parent; OUT=ROOT/'atmospheric_circulation'; OUT.mkdir(exist_ok=True)
FF=imageio_ffmpeg.get_ffmpeg_exe()
scenes=[
('开场：空气也上班','想象空气是一群快递员。它们每天绕着地球跑，送的不是包裹，而是热量和水汽！','Air couriers travel around Earth, delivering heat and moisture.','intro'),
('风的起点：受热不均','为什么要跑？因为太阳加热不均。赤道接收的太阳辐射多，两极少，地球需要搬运热量。','Uneven solar heating drives heat transport from low to high latitudes.','heat'),
('热力环流：先看简化模型','先把地球自转按下暂停键。在简化模型里，赤道空气受热上升，高空向两极流动。','Without rotation, warm equatorial air rises and flows poleward aloft.','single'),
('热力环流：完成一圈','极地空气冷却下沉，近地面再流向赤道。空气流动的直接动力，是水平气压梯度力。','Cold polar air sinks; surface air returns toward the equator. Pressure gradients drive wind.','single'),
('地球自转：路线拐弯了','现实中，地球在自转！运动的空气发生偏转：北半球向右，南半球向左。这叫地转偏向力。','Rotation deflects moving air right in the north and left in the south.','spin'),
('三圈环流：三个接力队','于是，每个半球形成三圈环流：哈德莱环流、费雷尔环流和极地环流。下面看北半球示意。','Each hemisphere has Hadley, Ferrel and Polar cells. Here is the northern hemisphere.','cells'),
('哈德莱环流：0°—30°','赤道空气上升，高空向较高纬度运动，在三十度附近下沉，近地面回到赤道。第一棒，完成！','Hadley cell: air rises near 0°, sinks near 30°, and returns at the surface.','hadley'),
('费雷尔环流：30°—60°','三十度附近的近地面空气也向六十度流动，在那里与极地冷空气相遇并上升。这是费雷尔环流。','Ferrel cell: surface air moves from 30° toward 60°, where it converges and rises.','ferrel'),
('极地环流：60°—90°','极地冷空气下沉，近地面流向六十度，在极锋附近上升。注意，费雷尔环流主要由涡旋活动维持。','Polar cell: air sinks near 90° and rises near 60°. Eddies mainly sustain the Ferrel cell.','polar'),
('气压带：四个纬度锚点','记住零、三十、六十、九十度。近地面气压依次是低、高、低、高。上升处辐合，下沉处辐散。','Near-surface pressure at 0°, 30°, 60°, 90°: low, high, low, high.','pressure'),
('全球格局：七带六风','南北半球对称排列，形成七个气压带和六个风带。赤道低压带只有一个，其余气压带各有两个。','The idealized global pattern has seven pressure belts and six wind belts.','belts'),
('信风：低纬快递','近地面空气从副热带高压流向赤道低压，偏转后，北半球是东北信风，南半球是东南信风。','Trade winds blow toward the equator: northeasterly in the north, southeasterly in the south.','trades'),
('西风与极地东风','三十到六十度是盛行西风带；六十到九十度是极地东风带。风的名字，说的是它从哪里来！','Westerlies dominate 30°–60°; polar easterlies dominate 60°–90°. Winds are named by origin.','winds'),
('雨林与沙漠：空气的表情','赤道附近上升气流有利于云雨；三十度附近下沉气流不利于降水。雨林和沙漠，就有了重要线索！','Rising air favors rain near the equator; sinking air favors dryness near 30°.','rain'),
('季节移动：整队搬家','太阳直射点随季节移动，气压带和风带也大致跟着移动。北半球夏季北移，冬季南移。','Belts generally shift north in Northern Hemisphere summer and south in winter.','season'),
('季风：还有海陆的戏份','真实世界还有海陆分布和地形。海陆热力差异，以及气压带风带的季节移动，都能影响季风。','Land–sea thermal contrasts and seasonal belt shifts help shape monsoons.','monsoon'),
('快问快答：30°附近？','快递员考考你：三十度附近，空气主要上升还是下沉？更容易多雨还是干燥？想三秒！','Quick quiz: near 30°, does air rise or sink? Is rainfall favored or suppressed?','quiz'),
('揭晓：下沉，偏干','答案是下沉，偏干！这是副热带高压的典型影响，但具体降水还要看海陆位置、洋流和地形。','Answer: sinking air and dry conditions. Local rainfall also depends on oceans and terrain.','answer'),
('带走一张记忆卡','记住：受热不均是起点，自转改变路线，三圈环流搬运热量；七个气压带、六个风带，随季节移动！','Remember: uneven heating, rotation, three cells, seven pressure belts and six wind belts.','end')]
async def voices():
 for i,s in enumerate(scenes):
  p=OUT/f'voice_{i:02}.mp3'
  if not p.exists():
   await edge_tts.Communicate(s[1],'zh-CN-XiaoxiaoNeural',rate='+3%').save(str(p))
  print('TTS',i,flush=True)
asyncio.run(voices())
sr=24000; tracks=[]; durations=[]
for i in range(len(scenes)):
 p=OUT/f'voice_{i:02}.wav'
 subprocess.run([FF,'-y','-loglevel','error','-i',str(OUT/f'voice_{i:02}.mp3'),'-ar',str(sr),'-ac','1',str(p)],check=True)
 with wave.open(str(p)) as w: a=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
 a=np.concatenate([np.zeros(int(.3*sr)),a,np.zeros(int(.8*sr))]); tracks.append(a); durations.append(len(a)/sr)
voice=np.concatenate(tracks); total=len(voice)/sr; t=np.arange(len(voice))/sr
# Original playful marimba-like score: no external music or samples.
music=np.zeros(len(voice),np.float32); notes=[60,64,67,72,67,64,62,67,59,62,65,69,65,62,57,64]
beat=.375
for j,start in enumerate(np.arange(0,total,beat)):
 n=notes[j%len(notes)]; f=440*2**((n-69)/12); k=int(start*sr); span=min(int(.65*sr),len(music)-k); q=np.arange(span)/sr
 music[k:k+span]+=.045*np.exp(-q*7)*(np.sin(2*np.pi*f*q)+.25*np.sin(2*np.pi*f*2*q))
 if j%4==0: music[k:k+span]+=.025*np.exp(-q*5)*np.sin(2*np.pi*f/4*q)
fade=np.minimum(1,np.minimum(t/2,(total-t)/3)); mix=np.clip(voice*.88+music*fade,-1,1)
with wave.open(str(OUT/'narration_and_music.wav'),'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((mix*32767).astype(np.int16).tobytes())
W,H=1280,720; ink='#23313b'; red='#dd6b4c'; blue='#438aa6'; paper='#faf8f1'
fonts={n:ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',n) for n in [18,20,23,25,28,32,42,52]}
def text(d,xy,s,size=28,fill=ink,anchor=None): d.text(xy,s,font=fonts[size],fill=fill,anchor=anchor)
def line(d,pts,fill=ink,width=3): d.line(pts,fill=fill,width=width,joint='curve')
def arrow(d,a,b,color=blue,width=4):
 line(d,[a,b],color,width); ang=math.atan2(b[1]-a[1],b[0]-a[0]); r=13
 line(d,[(b[0]-r*math.cos(ang-.5),b[1]-r*math.sin(ang-.5)),b,(b[0]-r*math.cos(ang+.5),b[1]-r*math.sin(ang+.5))],color,width)
def face(d,x,y,r=27,happy=True):
 d.ellipse((x-r,y-r,x+r,y+r),outline=ink,width=3); d.ellipse((x-10,y-7,x-6,y-3),fill=ink);d.ellipse((x+6,y-7,x+10,y-3),fill=ink)
 d.arc((x-11,y-3,x+11,y+14),0,180,fill=ink,width=2)
def cloud(d,x,y):
 d.arc((x-45,y-20,x-5,y+20),150,285,fill=ink,width=3);d.arc((x-20,y-40,x+30,y+15),180,350,fill=ink,width=3);d.arc((x+15,y-15,x+55,y+20),250,90,fill=ink,width=3);line(d,[(x-42,y+17),(x+49,y+17)])
def globe(d,x,y,r,tt):
 d.ellipse((x-r,y-r,x+r,y+r),outline=ink,width=4);d.ellipse((x-r*.45,y-r,x+r*.45,y+r),outline=ink,width=2)
 for yy in [-.55,0,.55]:line(d,[(x-r*math.sqrt(1-yy*yy),y+r*yy),(x+r*math.sqrt(1-yy*yy),y+r*yy)],ink,2)
 face(d,x,y,24);arrow(d,(x+r+25,y+60),(x+r+25,y-60),blue)
def wrap(d,s,font,width):
 lines=[]; cur=''
 for c in s:
  if d.textlength(cur+c,font=font)>width: lines.append(cur);cur=c
  else:cur+=c
 if cur:lines.append(cur)
 return lines
def cells(d,tt,focus=None):
 xs=[200,490,780,1070]; y=432; top=220
 line(d,[(170,y),(1100,y)],ink,3)
 for x,lab,p in zip(xs,['0°','30°N','60°N','90°N'],['低 L','高 H','低 L','高 H']):
  text(d,(x,467),lab,25,anchor='mm');text(d,(x,505),p,25,red if '低' in p else blue,anchor='mm')
 names=['哈德莱 / Hadley','费雷尔 / Ferrel','极地 / Polar']
 for j in range(3):
  col=red if j==0 else blue; a,b=xs[j],xs[j+1]; pts=[(a,y-18),(a,top),(b,top),(b,y-18)] if j!=1 else [(a,top),(a,y-18),(b,y-18),(b,top)]
  if focus is not None and j!=focus:col='#c2c4c0'
  for k in range(4):arrow(d,pts[k],pts[(k+1)%4],col,4)
  text(d,((a+b)/2,172),names[j],23,anchor='mm')
  phase=(tt*.2+j*.25)%1; seg=phase*4; k=int(seg);p=seg-k;A=pts[k];B=pts[(k+1)%4];face(d,A[0]+(B[0]-A[0])*p,A[1]+(B[1]-A[1])*p,17)
 text(d,(1110,220),'高空',20);text(d,(1110,428),'地面',20)
def frame(i,tt):
 im=Image.new('RGB',(W,H),paper);d=ImageDraw.Draw(im)
 for x in range(25,W,28):
  for y in range(25,550,28): d.point((x,y),fill='#e6e3db')
 text(d,(55,31),'地球空气快递局  /  THE AIR EXPRESS',20)
 text(d,(55,77),scenes[i][0],42);text(d,(1220,43),f'{i+1:02} / {len(scenes)}',20,anchor='ra')
 typ=scenes[i][3]
 if typ=='single':
  pts=[(400,430),(400,225),(980,225),(980,430)]
  for k in range(4):arrow(d,pts[k],pts[(k+1)%4],red if k<2 else blue,4)
  phase=(tt*.13)%1;seg=phase*4;k=int(seg);q=seg-k;A=pts[k];B=pts[(k+1)%4];face(d,A[0]+(B[0]-A[0])*q,A[1]+(B[1]-A[1])*q,23)
  text(d,(400,485),'赤道：暖 · 上升',28,anchor='mm');text(d,(980,485),'极地：冷 · 下沉',28,anchor='mm');text(d,(690,175),'假设不自转 / No rotation',25,anchor='mm');text(d,(690,510),'单圈环流概念模型',25,anchor='mm')
 elif typ in ['cells','hadley','ferrel','polar','pressure']:
  cells(d,tt,{'hadley':0,'ferrel':1,'polar':2}.get(typ))
 elif typ in ['intro','heat','single','spin','end']:
  globe(d,640,335,155,tt)
  if typ in ['heat','single']:
   d.ellipse((110,235,210,335),outline=red,width=4)
   for j in range(12):
    a=j*math.pi/6;line(d,[(160+60*math.cos(a),285+60*math.sin(a)),(160+76*math.cos(a),285+76*math.sin(a))],red)
   arrow(d,(245,290),(435,330),red);text(d,(160,387),'太阳加热',28,anchor='mm');text(d,(640,510),'赤道暖 · 两极冷',28,anchor='mm')
  elif typ=='spin':
   arrow(d,(935,410),(935,320));arrow(d,(935,320),(1035,260));text(d,(980,455),'北右 / N: right',25,anchor='mm');text(d,(260,300),'南左',32);arrow(d,(300,420),(220,300))
  elif typ=='end':
   text(d,(250,250),'① 受热不均',28,anchor='mm');text(d,(250,350),'② 地球自转',28,anchor='mm');text(d,(1000,250),'③ 三圈环流',28,anchor='mm');text(d,(1000,350),'④ 七带六风',28,anchor='mm');text(d,(640,525),'热量搬运，全年无休！',28,anchor='mm')
  else:
   face(d,310+math.sin(tt)*20,310,48);arrow(d,(365,310),(445,310));cloud(d,990,310);text(d,(990,415),'今日派送：热量 + 水汽',25,anchor='mm')
 elif typ in ['belts','trades','winds']:
  ys=[175,225,275,325,375,425,475]; labs=['90°N  极地高压','60°N  副极地低压','30°N  副热带高压','0°      赤道低压','30°S  副热带高压','60°S  副极地低压','90°S  极地高压']
  for j,y in enumerate(ys):line(d,[(330,y),(950,y)],red if j%2 else blue,2);text(d,(80,y-13),labs[j],23)
  wind=['极地东风 Polar easterlies','盛行西风 Westerlies','东北信风 NE trades','东南信风 SE trades','盛行西风 Westerlies','极地东风 Polar easterlies']
  for j in range(6):
   y=(ys[j]+ys[j+1])/2;right=j in [1,4];down=j in [0,2,4];a=(500,y-10 if down else y+10);b=(590 if right else 410,y+10 if down else y-10);arrow(d,a,b,blue,3);text(d,(675,y),wind[j],20,anchor='lm');d.ellipse((a[0]+math.sin(tt*2)*12-4,y-4,a[0]+math.sin(tt*2)*12+4,y+4),fill=red)
 elif typ in ['rain','quiz','answer']:
  cloud(d,355,270);arrow(d,(355,440),(355,320),red);text(d,(355,190),'0°：上升',28,anchor='mm')
  for j in range(7):
   x=305+j*16;y=330+(tt*65+j*16)%110;line(d,[(x,y),(x-6,y+14)],blue,3)
  arrow(d,(930,240),(930,395),blue);line(d,[(780,455),(810,442),(850,455),(890,442),(945,455),(1020,442),(1080,455)])
  text(d,(930,190),'30°：？' if typ=='quiz' else '30°：下沉',28,anchor='mm');face(d,930,430,25)
  text(d,(640,510),'上升多雨？下沉少雨？' if typ=='quiz' else '上升有利于降水 · 下沉不利于降水',28,anchor='mm')
 elif typ=='season':
  globe(d,400,335,145,tt);shift=math.sin(tt*.6)*42
  for j in range(3):line(d,[(760,265+j*65+shift),(1080,265+j*65+shift)],red if j%2==0 else blue,4)
  arrow(d,(1130,365),(1130,235),red);text(d,(945,185),'北半球夏季：北移',28,anchor='mm');text(d,(945,500),'北半球冬季：南移',28,anchor='mm')
 elif typ=='monsoon':
  line(d,[(160,425),(330,425),(390,280),(460,425),(570,425)]);text(d,(360,465),'陆地 LAND',28,anchor='mm')
  for j in range(6):
   x=680+j*65;d.arc((x,405,x+65,435),0,180,fill=blue,width=3)
  text(d,(900,465),'海洋 OCEAN',28,anchor='mm');arrow(d,(930,320),(520,320),blue);text(d,(740,255),'夏季示意：海洋 → 陆地',28,anchor='mm');text(d,(740,510),'季风 = 季节性风向变化',28,anchor='mm')
 d.rectangle((0,558,W,H),fill='#23313b')
 z=wrap(d,scenes[i][1],fonts[28],1160)
 for j,s in enumerate(z):text(d,(640,584+j*38),s,28,'#ffffff',anchor='mm')
 en=wrap(d,scenes[i][2],fonts[20],1160)
 for j,s in enumerate(en):text(d,(640,657+j*25),s,20,'#dfdfd8',anchor='mm')
 return im
if '--preview' in sys.argv:
 sheet=Image.new('RGB',(1280,720*3),paper)
 for row,i in enumerate([3,5,12]):sheet.paste(frame(i,3),(0,row*720))
 sheet.save(OUT/'review_contact_sheet.png');sys.exit()
starts=np.r_[0,np.cumsum(durations)]; fps=20
cmd=[FF,'-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(fps),'-i','-','-i',str(OUT/'narration_and_music.wav'),'-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart','-shortest',str(OUT/'atmospheric_circulation_bilingual_animation.mp4')]
p=subprocess.Popen(cmd,stdin=subprocess.PIPE)
for n in range(math.ceil(total*fps)):
 sec=n/fps;i=min(len(scenes)-1,int(np.searchsorted(starts,sec,side='right')-1));im=frame(i,sec-starts[i]);p.stdin.write(im.tobytes())
 if n%(fps*10)==0:print('render',round(sec),round(total),flush=True)
p.stdin.close();assert p.wait()==0
frame(5,3).save(OUT/'preview.png')
def stamp(x):
 ms=round(x*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
(OUT/'bilingual_subtitles.srt').write_text('\n\n'.join(f'{i+1}\n{stamp(starts[i])} --> {stamp(starts[i+1])}\n{s[1]}\n{s[2]}' for i,s in enumerate(scenes)),encoding='utf-8-sig')
(OUT/'storyboard_and_narration.json').write_text(json.dumps({'duration':total,'scenes':scenes,'durations':durations,'voice':'zh-CN-XiaoxiaoNeural','music':'Original synthesized marimba score'},ensure_ascii=False,indent=2),encoding='utf-8')
print('DONE',total,flush=True)
