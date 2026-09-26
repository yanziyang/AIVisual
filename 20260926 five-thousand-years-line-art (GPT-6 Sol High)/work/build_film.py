import os, sys, math, random, subprocess, wave, json
from pathlib import Path
import numpy as np
import multiprocessing as mp
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0,str(Path(__file__).parent/'deps'))
import imageio_ffmpeg
sys.stdout.reconfigure(encoding='utf-8')

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'outputs'
WORK=ROOT/'work'
W,H=1280,720
S=1.5
FPS=24
INK='#293331'; RED='#bc493a'; MUTED='#75776a'; PAPER='#f7f2e7'; PALE='#dfd7c5'
FONTS={}
def font(n,b=False):
    key=(n,b)
    if key not in FONTS:FONTS[key]=ImageFont.truetype('C:/Windows/Fonts/msyh'+('bd' if b else '')+'.ttc',round(n*S))
    return FONTS[key]

SCENES=[
('开卷！','文明长卷 · 约两分钟快进',6,'五千年的故事，怎么一口气看完？','让这卷小竹简，带你跑一趟！','intro'),
('先把日子种出来','新石器时代 · 文明起源',7,'黄河与长江流域等地，聚落与农耕渐渐发展。','从种粟种稻、制陶养蚕开始，生活有了新模样。','farm'),
('治水，开启新篇','夏 · 传统记载的早期王朝',6,'大禹治水的故事流传至今，夏见于传世文献。','夏的年代及其与考古遗址的关系，仍有讨论。','xia'),
('文字开始留档','商 · 约前1600—前1046年',6,'青铜器庄重登场，甲骨文留下商人的记录。','几千年前的提问，今天还能读到。','shang'),
('天下，分工管理','周 · 约前1046—前256年',6,'西周以分封与礼制组织秩序。','到了东周，诸侯竞争，也催生了新的思想。','zhou'),
('思想家，开麦！','春秋战国 · 百家争鸣',7,'孔子谈仁与礼，墨子讲兼爱，庄子追问自由。','诸子各有主张，思想的热闹一直影响后世。','think'),
('统一标准，出发','秦 · 前221—前206年',7,'秦统一六国，推行郡县，统一文字与度量衡。','标准统一了，路途也更好接上了。','qin'),
('向西，交个朋友','汉 · 前206—公元220年',7,'汉代开拓交流，丝绸之路连接东西。','纸的应用逐渐发展，知识有了更轻便的载体。','han'),
('分合之间，仍在生长','三国两晋南北朝 · 220—589年',6,'政权分合、人口迁徙，带来交流与融合。','书法、佛教艺术与江南开发，也在不断生长。','divide'),
('南北，水路相连','隋 · 581—618年',6,'隋重新统一，大运河沟通南北。','科举制度逐步形成，选官有了新的路径。','sui'),
('长安，热闹开场','唐 · 618—907年',8,'长安汇聚四方来客，诗歌与艺术灿烂发展。','胡旋舞转起来，诗人的灵感也跟着上线！','tang'),
('城市生活，升级','宋 · 960—1279年',8,'与辽、西夏、金等政权并立，宋的城市与商业繁盛。','活字印刷、航海用指南针，让知识和航路更远。','song'),
('道路越走越远','元 · 1271—1368年',6,'元建立并完成统一，驿站网络连接广阔地区。','各地交流增多，元曲也把人生唱上舞台。','yuan'),
('乘风，也修长城','明 · 1368—1644年',7,'郑和船队远航，青花瓷走向更远的市场。','今天熟悉的许多长城段落，也在明代修建。','ming'),
('盛景之后，迎来巨变','清 · 1636—1912年；1644年入关',7,'清代多民族国家进一步发展，文学与工艺繁盛。','十九世纪，列强侵略与内外危机带来剧烈变局。','qing'),
('风雨中，寻找新路','近代 · 1840—1949年',8,'辛亥革命结束帝制，新的思想与社会力量兴起。','抗日战争等苦难岁月中，无数人守护家园。','modern'),
('建设与改革，向前','1949年以后',7,'中华人民共和国成立，展开国家建设。','1978年，改革开放开启新的发展阶段。','reform'),
('把远方，变成日常','当代 · 故事仍在继续',7,'高铁穿城而过，航天探索更远的天空。','古老文明中的每个人，都在写下今天的新一页。','today'),
('下一笔，由你来写','文明延续 · 也属于普通人的日常',6,'五千年，不只是朝代更替。','也是人们生活、创造、交流与不断出发的故事。','end')]
STARTS=[]; TOTAL=0
for s in SCENES: STARTS.append(TOTAL); TOTAL+=s[2]

def ease(v):return 1-(1-max(0,min(1,v)))**3
def points_arc(cx,cy,rx,ry,a=0,b=360,n=40):
    return [(cx+rx*math.cos(math.radians(a+(b-a)*i/n)),cy+ry*math.sin(math.radians(a+(b-a)*i/n))) for i in range(n+1)]

class Art:
    def __init__(self):self.ops=[]
    def line(self,p,c=INK,w=3):self.ops.append(('line',p,c,w))
    def ell(self,x,y,rx,ry,c=INK,w=3):self.line(points_arc(x,y,rx,ry),c,w)
    def arc(self,x,y,rx,ry,a,b,c=INK,w=3):self.line(points_arc(x,y,rx,ry,a,b),c,w)
    def rect(self,x,y,w,h,c=INK,sw=3):self.line([(x,y),(x+w,y),(x+w,y+h),(x,y+h),(x,y)],c,sw)
    def text(self,x,y,t,n=22,c=INK,b=False,anchor='mm'):self.ops.append(('text',(x,y,t,n,b,anchor),c,0))
    def fill(self,p,c=PAPER):self.ops.append(('fill',p,c,0))
    def draw(self,im,reveal=1):
        d=ImageDraw.Draw(im)
        cap=reveal*len(self.ops)
        for i,(kind,p,c,w) in enumerate(self.ops):
            q=max(0,min(1,cap-i))
            if not q:break
            if kind=='fill':
                d.polygon([(round(x*S),round(y*S)) for x,y in p],fill=c)
                continue
            if kind=='text':
                if q>.8:
                    x,y,t,n,b,anchor=p;d.text((x*S,y*S),t,font=font(n,b),fill=c,anchor=anchor)
                continue
            if q<1:
                j=q*(len(p)-1);k=int(j);p=p[:k+1]+[(p[k][0]+(p[min(k+1,len(p)-1)][0]-p[k][0])*(j-k),p[k][1]+(p[min(k+1,len(p)-1)][1]-p[k][1])*(j-k))]
            if len(p)>1:d.line([(round(x*S),round(y*S)) for x,y in p],fill=c,width=round(w*S),joint='curve')

def star(a,x,y,r=10,c=RED):
    a.line([(x-r,y),(x+r,y)],c,2);a.line([(x,y-r),(x,y+r)],c,2)
def cloud(a,x,y,k=1):
    a.line([(x-48*k,y),(x-42*k,y-9*k),(x-25*k,y-9*k),(x-19*k,y-22*k),(x,y-24*k),(x+13*k,y-10*k),(x+34*k,y-10*k),(x+42*k,y),(x-48*k,y)],PALE,2)
def waves(a,x,y,w,t,rows=2):
    for j in range(rows):a.line([(x+i*w/50,y+j*13+3*math.sin(i*.8+t*2+j)) for i in range(51)],MUTED,2)
def person(a,x,y,k=1,t=0,pose='normal',hat=None,c=INK):
    bob=math.sin(t*3)*2*k; y+=bob
    a.fill(points_arc(x,y-74*k,16*k,19*k))
    a.fill([(x-12*k,y-59*k),(x-25*k,y-8*k),(x+25*k,y-8*k),(x+12*k,y-59*k)])
    a.ell(x,y-74*k,16*k,19*k,c)
    a.line([(x-12*k,y-59*k),(x-25*k,y-8*k),(x+25*k,y-8*k),(x+12*k,y-59*k)],c)
    a.line([(x-7*k,y-8*k),(x-10*k+math.sin(t*4)*5*k,y+17*k)],c)
    a.line([(x+7*k,y-8*k),(x+10*k-math.sin(t*4)*5*k,y+17*k)],c)
    if int(t*5)%21==17:
        a.line([(x-8*k,y-77*k),(x-3*k,y-77*k)],c,2);a.line([(x+3*k,y-77*k),(x+8*k,y-77*k)],c,2)
    else:
        a.ell(x-5*k,y-77*k,1.3*k,1.3*k,c,2);a.ell(x+5*k,y-77*k,1.3*k,1.3*k,c,2)
    a.line([(x-8*k,y-83*k),(x-3*k,y-84*k)],c,1.5);a.line([(x+3*k,y-84*k),(x+8*k,y-83*k)],c,1.5)
    a.arc(x,y-72*k,5*k,4*k,0,180,c,2)
    a.line([(x-11*k,y-56*k),(x+5*k,y-40*k),(x+12*k,y-56*k)],c,2)
    a.line([(x-19*k,y-27*k),(x+19*k,y-27*k)],RED,2)
    a.line([(x+4*k,y-39*k),(x+4*k,y-11*k)],c,1.5)
    if hat=='scholar':a.line([(x-7*k,y-61*k),(x,y-50*k),(x+7*k,y-61*k)],c,2)
    if pose=='wave':
        a.line([(x+12*k,y-54*k),(x+37*k,y-59*k),(x+42*k+math.sin(t*7)*5*k,y-86*k)],c)
        a.line([(x-12*k,y-53*k),(x-34*k,y-31*k)],c)
    elif pose=='work':
        a.line([(x+12*k,y-54*k),(x+40*k,y-37*k),(x+60*k,y-50*k)],c)
        a.line([(x-12*k,y-54*k),(x+18*k,y-30*k),(x+58*k,y-45*k)],c)
    elif pose=='dance':
        a.line([(x-12*k,y-54*k),(x-48*k,y-75*k),(x-62*k,y-65*k)],c)
        a.line([(x+12*k,y-54*k),(x+45*k,y-80*k),(x+63*k,y-72*k)],c)
    else:
        a.line([(x-12*k,y-54*k),(x-32*k,y-28*k)],c)
        a.line([(x+12*k,y-54*k),(x+34*k,y-29*k)],c)
    if hat=='scholar':
        a.line([(x-23*k,y-91*k),(x-13*k,y-101*k),(x+13*k,y-101*k),(x+23*k,y-91*k)],c)
        a.line([(x,y-101*k),(x,y-116*k),(x+8*k,y-116*k),(x+8*k,y-101*k)],c)
    elif hat=='king':
        a.rect(x-23*k,y-107*k,46*k,7*k,c)
        for j in range(5):
            xx=x+(j-2)*9*k;a.line([(xx,y-100*k),(xx,y-85*k)],c,2)
    elif hat=='farmer':a.line([(x-30*k,y-90*k),(x,y-111*k),(x+30*k,y-90*k),(x-30*k,y-90*k)],c)
    elif hat=='official':
        a.rect(x-17*k,y-105*k,34*k,12*k,c);a.line([(x-17*k,y-100*k),(x-45*k,y-100*k)],c);a.line([(x+17*k,y-100*k),(x+45*k,y-100*k)],c)

def mascot(a,x,y,k,t,excited=True):
    y+=math.sin(t*4)*4
    a.rect(x-28*k,y-37*k,56*k,74*k,INK,3)
    for dx in [-20,-10,0,10,20]:a.line([(x+dx*k,y-34*k),(x+dx*k,y+34*k)],PALE,2)
    a.line([(x-33*k,y-21*k),(x+33*k,y-21*k)],RED,3);a.line([(x-33*k,y+22*k),(x+33*k,y+22*k)],RED,3)
    a.ell(x-10*k,y-5*k,2*k,3*k);a.ell(x+10*k,y-5*k,2*k,3*k)
    a.arc(x,y+2*k,8*k,7*k,0,180,INK,2)
    a.line([(x-28*k,y),(x-48*k,y-15*k)],INK,3)
    a.line([(x+28*k,y),(x+47*k,y-20*k+math.sin(t*7)*6)],INK,3)
    a.line([(x-13*k,y+37*k),(x-18*k+math.sin(t*6)*7,y+58*k)],INK,3)
    a.line([(x+13*k,y+37*k),(x+18*k-math.sin(t*6)*7,y+58*k)],INK,3)
    if excited:star(a,x+57*k,y-43*k,8*k)

def roof(a,x,y,w,h=85):
    a.line([(x-w/2-16,y+10),(x-w/2+12,y+3),(x,y-h*.38),(x+w/2-12,y+3),(x+w/2+16,y+10)],INK,4)
    a.line([(x-w/2-16,y+10),(x+w/2+16,y+10)],INK)
    a.line([(x-w/2+8,y+10),(x-w/2+8,y+h),(x+w/2-8,y+h),(x+w/2-8,y+10)],INK)
    for dx in [-.3,0,.3]:a.line([(x+dx*w,y+12),(x+dx*w,y+h)],INK,2)
def hut(a,x,y):
    a.line([(x-65,y-70),(x,y-130),(x+65,y-70),(x-65,y-70)],INK)
    a.rect(x-50,y-70,100,70);a.rect(x-14,y-43,28,43)
    for j in range(6):a.line([(x-47+j*18,y-72),(x-12+j*5,y-117)],PALE,2)
def crop(a,x,y,t):
    a.line([(x,y),(x+math.sin(t*2)*5,y-57)],INK,2)
    for j in range(4):
        yy=y-17-j*9;xx=x+math.sin(t*2)*5*j/4
        a.line([(xx,yy),(xx-13,yy-10),(xx,yy-6),(xx+13,yy-16)],INK,2)
def vessel(a,x,y,k=1,c=INK):
    a.line([(x-35*k,y-43*k),(x-30*k,y-80*k),(x-17*k,y-80*k),(x-17*k,y-43*k)],c)
    a.line([(x+35*k,y-43*k),(x+30*k,y-80*k),(x+17*k,y-80*k),(x+17*k,y-43*k)],c)
    a.ell(x,y-43*k,52*k,12*k,c)
    a.line([(x-50*k,y-43*k),(x-42*k,y+20*k),(x-28*k,y+35*k),(x+28*k,y+35*k),(x+42*k,y+20*k),(x+50*k,y-43*k)],c,4)
    for dx in [-26,26]:a.line([(x+dx*k,y+30*k),(x+(dx+(-6 if dx<0 else 6))*k,y+65*k)],c,4)
    a.line([(x,y+35*k),(x,y+65*k)],c,4)
    for dx in [-20,20]:
        a.rect(x+(dx-10)*k,y-20*k,20*k,25*k,c,2);a.line([(x+dx*k,y-18*k),(x+dx*k,y+3*k)],c,2)
def scroll(a,x,y,w=150,h=90,label=None):
    a.rect(x,y,w,h);a.ell(x,y+h/2,7,h/2);a.ell(x+w,y+h/2,7,h/2)
    if label:a.text(x+w/2,y+h/2,label,26,RED)
def speech(a,x,y,text,w=180):
    a.fill([(x-w/2,y-21),(x+w/2,y-21),(x+w/2,y+21),(x+12,y+21),(x,y+34),(x-3,y+21),(x-w/2,y+21)])
    a.line([(x-w/2,y-21),(x+w/2,y-21),(x+w/2,y+21),(x+12,y+21),(x,y+34),(x-3,y+21),(x-w/2,y+21),(x-w/2,y-21)],MUTED,2)
    a.text(x,y,text,21,RED)
def pagoda(a,x,y,k=1):
    for j in range(4):roof(a,x,y-j*42*k,(100-j*18)*k,34*k)
    a.line([(x,y-153*k),(x,y-175*k)],INK,2)
def wall(a,x,y,w=660):
    a.line([(x,y),(x+w*.25,y-40),(x+w*.55,y-20),(x+w*.8,y-70),(x+w,y-45)],INK,4)
    a.line([(x,y+40),(x+w*.25,y),(x+w*.55,y+20),(x+w*.8,y-30),(x+w,y-5)],INK,4)
    for j in range(30):
        xx=x+j*w/30; yy=y-40*math.sin(j/30*math.pi)*.7
        a.line([(xx,yy),(xx,yy-15),(xx+12,yy-15),(xx+12,yy)],INK,2)
    for xx,yy in [(x+w*.25,y-40),(x+w*.8,y-70)]:
        a.rect(xx-26,yy-70,52,70);a.line([(xx-30,yy-70),(xx-30,yy-85),(xx-10,yy-85),(xx-10,yy-75),(xx+10,yy-75),(xx+10,yy-85),(xx+30,yy-85),(xx+30,yy-70)],INK)
def camel(a,x,y,t,k=1):
    a.line([(x-70*k,y-20*k),(x-50*k,y-35*k),(x-30*k,y-74*k),(x-12*k,y-30*k),(x+8*k,y-72*k),(x+26*k,y-28*k),(x+52*k,y-31*k),(x+58*k,y-74*k),(x+72*k,y-83*k),(x+90*k,y-76*k),(x+86*k,y-63*k),(x+72*k,y-62*k),(x+74*k,y-10*k),(x+45*k,y+8*k),(x-52*k,y+8*k),(x-70*k,y-20*k)],INK)
    for dx in [-47,-26,37,56]:a.line([(x+dx*k,y+8*k),(x+dx*k+math.sin(t*5+dx)*9*k,y+50*k)],INK,3)
    a.ell(x+75*k,y-73*k,2,2);a.line([(x-70*k,y-20*k),(x-85*k,y+10*k)],INK)
    a.rect(x-35*k,y-22*k,65*k,27*k,RED,2)
def boat(a,x,y,t,k=1):
    a.line([(x-112*k,y),(x-75*k,y+38*k),(x+78*k,y+38*k),(x+120*k,y-4*k),(x-112*k,y)],INK,4)
    for dx in [-45,25]:
        a.line([(x+dx*k,y),(x+dx*k,y-155*k)],INK)
        a.line([(x+dx*k,y-146*k),(x+(dx+70)*k,y-112*k),(x+(dx+60)*k,y-20*k),(x+dx*k,y-30*k),(x+dx*k,y-146*k)],INK)
        for j in range(4):a.line([(x+dx*k,y-(40+j*25)*k),(x+(dx+60+j*2)*k,y-(30+j*22)*k)],INK,2)
    a.line([(x+25*k,y-155*k),(x+55*k,y-151*k),(x+25*k,y-135*k)],RED)
def horse(a,x,y,t,k=1):
    a.line([(x-65*k,y-15*k),(x-45*k,y-45*k),(x+26*k,y-45*k),(x+39*k,y-82*k),(x+60*k,y-86*k),(x+78*k,y-61*k),(x+60*k,y-56*k),(x+47*k,y-14*k),(x+22*k,y+5*k),(x-48*k,y+5*k),(x-65*k,y-15*k)],INK)
    for dx in [-45,-23,23,43]:a.line([(x+dx*k,y),(x+dx*k+math.sin(t*8+dx)*18*k,y+47*k)],INK)
    a.line([(x-60*k,y-27*k),(x-90*k,y-5*k)],INK);a.ell(x+59*k,y-73*k,2,2)
def vase(a,x,y,k=1):
    a.line([(x-25*k,y-105*k),(x+25*k,y-105*k),(x+17*k,y-65*k),(x+51*k,y-22*k),(x+40*k,y+35*k),(x-40*k,y+35*k),(x-51*k,y-22*k),(x-17*k,y-65*k),(x-25*k,y-105*k)],INK,3)
    a.ell(x,y-104*k,25*k,5*k);a.ell(x,y+35*k,40*k,5*k)
    for j in range(3):a.arc(x,y-20*k+j*15*k,35*k,8*k,0,180,RED,2)
    a.line([(x-15*k,y-60*k),(x+15*k,y-60*k)],RED,2)

def scene_art(kind,t,dur):
    a=Art(); tt=t
    if kind in ['intro','end']:
        for j in range(3):cloud(a,840+j*100,225+j*74,1.2)
        mascot(a,850,397,2.5,t)
        a.line([(625,490),(700,505),(755,493)],PALE,2)
        if kind=='intro':
            a.text(95,285,'一卷穿越',68,INK,True,'lm');a.text(95,384,'五千年',100,RED,True,'lm')
            a.text(100,478,'种下文明  /  写下历史  /  奔向未来',23,MUTED,False,'lm')
            for x,y in [(755,270),(1000,380),(825,220)]:star(a,x,y,10+math.sin(t*3)*3)
        else:
            a.text(95,300,'历史的下一页',65,INK,True,'lm');a.text(95,400,'现在，开写。',67,RED,True,'lm')
            a.line([(100,480),(535,480)],RED,3);a.line([(495,466),(535,480),(495,494)],RED,3)
    elif kind=='farm':
        hut(a,315,460);hut(a,520,420)
        for j in range(8):crop(a,640+j*40,495-(j%2)*15,t+j)
        person(a,570,493,1.0,t,'work','farmer');a.line([(627,446),(661,510),(684,510)],INK)
        a.ell(880,350,45,16);a.line([(835,350),(847,403),(913,403),(925,350)],INK)
        waves(a,160,515,870,t)
        if t>2.3:speech(a,770,242,'先种田，再开饭！',225)
    elif kind=='xia':
        for j in range(3):waves(a,205,390+j*42,700,t,1)
        person(a,525,478,1.7,t,'work','farmer')
        a.line([(625,400),(670,497),(710,500)],INK,4)
        a.line([(718,480),(900,480),(925,500),(750,515)],MUTED,3)
        for j in range(3):a.line([(765+j*45,465),(775+j*45,454),(790+j*45,465)],RED,2)
        if t>2:speech(a,830,280,'给水，找条路',210)
    elif kind=='shang':
        vessel(a,380,405,1.45)
        a.line([(655,278),(755,254),(865,278),(846,440),(740,470),(644,425),(655,278)],INK,4)
        for x,y in [(703,323),(782,348),(709,398)]:
            a.line([(x-13,y),(x+13,y),(x,y),(x,y-24),(x,y+24),(x-16,y+40)],INK,2)
            a.line([(x-13,y+8),(x+14,y+15)],INK,2)
        a.text(762,492,'甲骨 · 记录与占卜',22,MUTED)
        if t>2.4:speech(a,975,318,'今天会下雨吗？',205)
    elif kind=='zhou':
        roof(a,610,255,205,80);person(a,610,430,1.25,t,'wave','king')
        for x,label in [(285,'齐'),(450,'鲁'),(770,'晋'),(935,'楚')]:
            a.line([(x,485),(x,425)],INK,3);a.rect(x,425,47,31,RED,2);a.text(x+23,440,label,20,RED)
            a.line([(610,360),(x+23,413)],PALE,2)
        if t>2:speech(a,300,300,'各守一方，各有任务',255)
    elif kind=='think':
        for x,y,k,label in [(340,465,1.65,'仁与礼'),(615,465,1.65,'兼爱'),(890,465,1.65,'逍遥')]:
            person(a,x,y,k,t+x*.01,'wave','scholar');speech(a,x,250,label,150)
        a.text(340,521,'孔子',24);a.text(615,521,'墨子',24);a.text(890,521,'庄子',24)
        a.line([(295,422),(387,422)],RED,2)
        for j in range(3):star(a,690+j*35,318+j*13,6)
    elif kind=='qin':
        wall(a,205,427,800);person(a,610,459,1.5,t,'wave','king')
        for x,y,lab in [(260,245,'文字'),(525,220,'度量衡'),(820,245,'郡县')]:
            scroll(a,x,y,150,70,lab)
        if t>2.7:speech(a,990,385,'标准，统一！',180)
    elif kind=='han':
        a.line([(185,463),(280,433),(330,470),(420,452),(480,487),(565,455),(620,490),(1030,490)],PALE,2)
        for j in range(2):camel(a,430+j*245+math.sin(t*.6)*15,413-j*8,t+j,.95)
        person(a,915,437,1.0,t,'wave','scholar')
        scroll(a,220,265,160,82,'丝绸之路');a.rect(858,245,108,90,INK,2)
        for j in range(5):a.line([(870,259+j*13),(950,259+j*13)],PALE,2)
        if t>2.3:speech(a,675,234,'远方，也能连接',225)
    elif kind=='divide':
        for x in [300,600,900]:roof(a,x,330,150,85)
        for j,x in enumerate([275,550,800]):
            person(a,x+30*math.sin(t*.7),478,1.0,t+j,'normal','scholar')
            a.line([(x+53,448),(x+95,448),(x+110,471),(x+45,471),(x+53,448)],INK,2)
        a.line([(300,256),(490,256)],RED,2);a.line([(720,256),(900,256)],RED,2)
        a.text(598,245,'迁徙 · 交流 · 融合',26,RED)
        if t>2.5:speech(a,590,302,'书法，还得练',200)
    elif kind=='sui':
        waves(a,170,452,890,t,4);boat(a,550+math.sin(t*.5)*35,411,t,.68)
        a.line([(200,388),(200,312),(385,312),(385,388)],INK,2);a.arc(293,388,72,49,180,360,INK,3)
        person(a,867,466,1.25,t,'work','scholar');scroll(a,828,242,137,62,'科举')
        if t>2:speech(a,563,236,'南北，连上了！',215)
    elif kind=='tang':
        roof(a,580,286,650,83)
        for x in [220,1000]:pagoda(a,x,360,.68)
        person(a,380,470,1.3,t,'work','scholar');scroll(a,450,371,95,64,'诗')
        x=675+math.sin(t*2)*23;person(a,x,477,1.6,t,'dance')
        a.ell(x,476,77,14,RED,2);a.arc(x,476,104,24,15,140,RED,2)
        person(a,914,470,1.15,t,'wave','farmer')
        if t>2.5:speech(a,603,214,'长安的热闹，满格！',265)
    elif kind=='song':
        roof(a,275,325,170,120);roof(a,495,345,185,100)
        for x,lab in [(270,'茶'),(490,'书')]:a.rect(x-28,373,56,42,RED,2);a.text(x,394,lab,25,RED)
        person(a,368,475,.9,t,'normal','official')
        a.rect(663,371,142,78);a.rect(674,352,119,20)
        for j in range(5):
            for k in range(3):a.rect(680+j*22,379+k*20,15,14,INK,1)
        a.text(737,482,'活字印刷',22)
        a.ell(926,371,64,64);a.ell(926,371,49,49,PALE,2)
        ang=t*.5;a.line([(926-42*math.sin(ang),371+42*math.cos(ang)),(926+42*math.sin(ang),371-42*math.cos(ang))],RED,4)
        a.text(926,478,'航海指南针',22)
        if t>2.7:speech(a,615,243,'知识，批量上线',230)
    elif kind=='yuan':
        horse(a,375+30*math.sin(t*.5),424,t,1.4);person(a,390+30*math.sin(t*.5),340,.85,t,'wave','official')
        a.line([(236,505),(520,505)],PALE,2)
        a.rect(585,266,400,220);a.line([(585,266),(640,350),(625,468)],RED,4);a.line([(985,266),(930,350),(945,468)],RED,4)
        person(a,785,452,1.4,t,'dance','scholar');a.text(785,306,'元曲',30,RED)
        if t>2.4:speech(a,340,221,'驿站接力，继续赶路',270)
    elif kind=='ming':
        boat(a,430+15*math.sin(t*.8),425+4*math.sin(t*2),t,1.05);waves(a,195,474,480,t,2)
        vase(a,850,410,1.18);wall(a,705,280,300)
        if t>2.5:speech(a,550,222,'乘风出海去！',210)
        a.text(840,513,'青花瓷 · 远航 · 长城',22,MUTED)
    elif kind=='qing':
        roof(a,335,310,240,125);scroll(a,545,285,125,160)
        a.text(608,365,'文学',25,RED);vase(a,798,410,.85)
        person(a,945,465,1.25,t,'normal','official')
        if t<3.4:speech(a,650,235,'故事，越写越长',230)
        else:
            a.line([(525,235),(550,267),(528,285),(554,307)],RED,3)
            a.text(662,236,'十九世纪 · 危机与变局',26,RED)
    elif kind=='modern':
        if t<3.5:
            a.rect(230,302,190,178);a.text(325,335,'新报',31,RED)
            for j in range(6):a.line([(249,364+j*16),(402,364+j*16)],PALE,2)
            a.text(645,314,'1911',72,RED,True);a.text(645,387,'结束帝制',30)
            person(a,912,466,1.4,t,'wave')
        else:
            for x in [300,895]:hut(a,x,473)
            person(a,587,465,1.45,0,'normal');person(a,709,465,1.2,0,'normal')
            a.line([(500,251),(515,271),(509,292),(530,311)],MUTED,2)
            a.line([(780,260),(768,287),(790,305)],MUTED,2)
            a.text(640,241,'守护家园 · 铭记苦难',32,INK)
            a.line([(550,503),(738,503)],RED,3)
    elif kind=='reform':
        roof(a,360,325,270,120);a.text(355,251,'1949',43,RED,True)
        a.line([(545,390),(692,390)],RED,3);a.line([(675,377),(692,390),(675,403)],RED,3)
        a.rect(740,305,260,161);a.line([(750,303),(782,280),(815,303),(848,280),(881,303),(915,280),(958,303)],INK)
        for j in range(5):a.rect(762+j*43,337,25,44,INK,2)
        a.rect(768,414,210,22,RED,2);a.text(869,250,'1978',43,RED,True)
        person(a,642,484,1.1,t,'wave');a.text(870,503,'改革开放',26,RED)
    elif kind=='today':
        for j in range(7):
            x=230+j*75;hh=75+(j*43)%140;a.rect(x,490-hh,53,hh)
            for k in range(int(hh/22)-1):a.line([(x+11,490-hh+19+k*22),(x+42,490-hh+19+k*22)],PALE,2)
        tx=470+50*math.sin(t*.5)
        a.line([(tx-195,455),(tx+175,455),(tx+227,478),(tx+239,498),(tx-195,498),(tx-195,455)],INK,4)
        for j in range(9):a.rect(tx-175+j*39,466,26,13,INK,2)
        a.line([(tx-190,488),(tx+223,488)],RED,3)
        a.line([(205,508),(865,508)],INK,2)
        ry=385-t*12
        a.line([(953,ry+30),(953,ry-60),(975,ry-99),(997,ry-60),(997,ry+30),(953,ry+30)],INK,3)
        a.ell(975,ry-39,12,15,RED,2);a.line([(953,ry),(934,ry+35),(953,ry+25)],INK);a.line([(997,ry),(1016,ry+35),(997,ry+25)],INK)
        for j in range(3):a.line([(961+j*13,ry+36),(961+j*13,ry+62+math.sin(t*13+j)*12)],RED,3)
        if t>2.2:speech(a,724,220,'下一站，更远！',220)
    if kind not in ['intro','end']:mascot(a,1135,478,.86,t,kind!='modern')
    return a

random.seed(19)
base=Image.new('RGB',(round(W*S),round(H*S)),PAPER)
bd=ImageDraw.Draw(base)
for _ in range(7800):
    x=random.randrange(base.width);y=random.randrange(base.height)
    bd.point((x,y),fill=random.choice(['#ece5d8','#f1eadf','#eee8dd']))

def render(idx,t):
    title,date,dur,line1,line2,kind=SCENES[idx]
    im=base.copy();d=ImageDraw.Draw(im)
    def txt(x,y,text,n=20,c=INK,b=False,anchor='la'):
        d.text((round(x*S),round(y*S)),text,font=font(n,b),fill=c,anchor=anchor)
    txt(65,31,'时空快递  /  一卷穿越五千年',19,MUTED)
    txt(1215,31,f'{idx+1:02d} / {len(SCENES):02d}',19,MUTED,anchor='ra')
    d.line([(65*S,66*S),(1215*S,66*S)],fill=PALE,width=2)
    if kind not in ['intro','end']:
        slide=18*(1-ease(t/.6))
        txt(65,87+slide,title,48,INK,True)
        txt(67,153+slide,date,22,MUTED)
        d.line([(65*S,197*S),(140*S,197*S)],fill=RED,width=round(3*S))
    else:txt(66,99,title,29,INK,True);txt(1215,109,date,21,MUTED,anchor='ra')
    art=scene_art(kind,t,dur)
    art.draw(im,ease(t/1.45))
    # Subtitles remain legible as drawings move; only the current sentence is emphasized.
    d=ImageDraw.Draw(im)
    d.line([(65*S,556*S),(1215*S,556*S)],fill=PALE,width=2)
    active1=t<dur*.52
    txt(640,585,line1,27,INK if active1 else MUTED,active1,'mm')
    if t>.4:txt(640,628,line2,27,RED if not active1 else INK,not active1,'mm')
    if kind=='farm':txt(1215,537,'多地起源 · 长期发展',17,MUTED,anchor='ra')
    if kind=='song':txt(65,536,'907—960年：五代十国',17,MUTED)
    if kind=='intro':txt(1215,537,'“五千年”概括文明历程，非精确纪年',16,MUTED,anchor='ra')
    y=679
    d.line([(65*S,y*S),(1215*S,y*S)],fill=PALE,width=round(3*S))
    for j in range(len(SCENES)):
        x=65+1150*STARTS[j]/TOTAL
        d.line([(x*S,(y-4)*S),(x*S,(y+4)*S)],fill=MUTED,width=1)
    p=(STARTS[idx]+t)/TOTAL
    d.line([(65*S,y*S),((65+1150*p)*S,y*S)],fill=RED,width=round(3*S))
    d.ellipse(((60+1150*p)*S,(y-5)*S,(70+1150*p)*S,(y+5)*S),fill=RED)
    txt(65,694,'文明起源',14,MUTED);txt(1215,694,'今天与未来',14,MUTED,anchor='ra')
    # A moving paper fold sweeps across each cut, preserving a continuous scroll motif.
    if idx and t<.32:
        edge=W*(1-ease(t/.32))
        d.rectangle((0,0,edge*S,H*S),fill=PAPER)
        d.line([(edge*S,0),(edge*S,H*S)],fill=PALE,width=round(5*S))
    return im.resize((W,H),Image.Resampling.LANCZOS)

def make_music():
    sr=44100;n=int(TOTAL*sr);mix=np.zeros((n,2),dtype=np.float32)
    rng=np.random.default_rng(78)
    def add(at,dur,freq,kind='pluck',gain=.15,pan=0):
        start=int(at*sr);ln=min(int(dur*sr),n-start)
        if ln<=0:return
        t=np.arange(ln)/sr
        if kind=='pluck':
            z=sum(np.sin(2*np.pi*freq*h*t+(.1*h))*math.exp(-h*.27)*np.exp(-t*(2.4+h*.8)) for h in range(1,7))
            z*=np.minimum(t/.006,1)
        elif kind=='flute':
            phase=2*np.pi*freq*t+.021*np.sin(2*np.pi*5.5*t)
            z=(np.sin(phase)+.22*np.sin(phase*2)+.07*np.sin(phase*3))*np.minimum(t/.065,1)*np.minimum((dur-t)/.13,1)*np.exp(-t*.2)
        elif kind=='bass':z=np.sin(2*np.pi*freq*t)*np.exp(-t*3)*np.minimum(t/.01,1)
        elif kind=='kick':z=np.sin(2*np.pi*(52*t+16*(1-np.exp(-t*25))))*np.exp(-t*16)
        elif kind=='wood':z=(np.sin(2*np.pi*970*t)+.4*np.sin(2*np.pi*1620*t))*np.exp(-t*65)
        elif kind=='hat':z=rng.normal(0,1,ln)*np.exp(-t*90)*.28
        else:z=np.sin(2*np.pi*freq*t)*np.exp(-t*8)
        z=z.astype(np.float32)*gain
        l=math.sqrt((1-pan)/2);r=math.sqrt((1+pan)/2)
        mix[start:start+ln,0]+=z*l;mix[start:start+ln,1]+=z*r
        for delay,vol in [(.11,.12),(.23,.07)]:
            st=start+int(delay*sr);nn=min(ln,n-st)
            if nn>0:mix[st:st+nn,0]+=z[:nn]*r*vol;mix[st:st+nn,1]+=z[:nn]*l*vol
    # Original pentatonic motifs: plucked strings, flute, wood percussion, and warm bass.
    motifs=[[0,2,4,7,9,7,4,2],[4,7,9,12,9,7,4,7],[0,4,2,7,4,9,7,2],[7,9,12,14,12,9,7,4]]
    tempo=112;beat=60/tempo
    for idx,s in enumerate(SCENES):
        at=STARTS[idx];dur=s[2];kind=s[5];quiet=kind=='modern'
        root=[60,60,62,60,60,62,60,60,57,60,62,60,62,60,57,57,60,62,60][idx]
        motif=motifs[idx%4];g=.06 if quiet else .11
        steps=int(dur/(beat/2))
        for j in range(steps):
            tm=at+j*beat/2
            note=root+motif[j%8]+(12 if j%8==7 and idx%3==0 else 0)
            f=440*2**((note-69)/12)
            add(tm,.75,f,'pluck',g,(-.4 if j%2 else .4))
            if j%4==0:add(tm,1.6,440*2**((root-24-69)/12),'bass',.11 if not quiet else .035)
            if not quiet:
                if j%4==0:add(tm,.2,1,'kick',.14)
                if j%4==2:add(tm,.1,1,'wood',.07)
                if j%2:add(tm,.08,1,'hat',.035)
        if not quiet:
            for j in range(int(dur/beat)-1):
                note=root+12+motif[(j*2+idx)%8]
                add(at+beat*(j+.2),beat*.84,440*2**((note-69)/12),'flute',.055,-.22)
        else:
            for j,note in enumerate([root+12,root+7,root+4,root+2]):add(at+j*1.6,1.7,440*2**((note-69)/12),'flute',.035,0)
        if kind in ['qin','tang','today','end']:
            for j,note in enumerate([0,2,4,7,9,12]):add(at+.04*j,.7,440*2**((root+12+note-69)/12),'pluck',.08,j/10-.25)
    # Final cadence and gentle fade.
    for j,note in enumerate([72,69,67,64,60]):add(TOTAL-2.5+j*.36,1.5,440*2**((note-69)/12),'pluck',.13)
    fade=np.minimum(np.arange(n)/sr/1.5,1)*np.minimum((n-np.arange(n))/sr/2,1)
    mix*=fade[:,None];mix=np.tanh(mix*1.35)
    peak=np.max(np.abs(mix));mix*=.85/max(peak,.85)
    data=(mix*32767).astype('<i2')
    path=WORK/'original-score.wav'
    with wave.open(str(path),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(sr);f.writeframes(data.tobytes())
    return path

def subtitle_files():
    def stamp(t):
        ms=int(round(t*1000));return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}'
    rows=[];number=0
    for start,s in zip(STARTS,SCENES):
        for i,line in enumerate(s[3:5]):
            number+=1;a=start+(0 if not i else s[2]*.52);b=start+(s[2]*.52 if not i else s[2])
            rows.append(f'{number}\n{stamp(a)} --> {stamp(b)}\n{line}\n')
    (OUT/'five-thousand-years-subtitles.srt').write_text('\n'.join(rows),encoding='utf-8-sig')

def render_job(job):
    idx,frame=job
    return render(idx,frame/FPS).tobytes()

def main():
    OUT.mkdir(exist_ok=True);WORK.mkdir(exist_ok=True)
    if '--preview' in sys.argv:
        thumbs=[]
        for i,s in enumerate(SCENES):
            im=render(i,s[2]*.57);im.save(WORK/f'scene-{i:02d}.jpg',quality=90);thumbs.append(im.resize((384,216)))
        contact=Image.new('RGB',(384*4,216*5),PAPER)
        for j,im in enumerate(thumbs):contact.paste(im,(j%4*384,j//4*216))
        contact.save(WORK/'contact-sheet.jpg',quality=92)
        render(0,3).save(OUT/'five-thousand-years-cover.jpg',quality=95)
        print('Preview generated',TOTAL,'seconds',flush=True);return
    score=make_music();subtitle_files();ff=imageio_ffmpeg.get_ffmpeg_exe()
    silent=WORK/'silent.mp4'
    cmd=[ff,'-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-threads','4',str(silent)]
    log=open(WORK/'encode.log','w');p=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log)
    try:
        with mp.Pool(3) as pool:
            jobs=((idx,frame) for idx,s in enumerate(SCENES) for frame in range(s[2]*FPS))
            ends=np.cumsum([s[2]*FPS for s in SCENES]).tolist()
            for j,data in enumerate(pool.imap(render_job,jobs,chunksize=4),1):
                p.stdin.write(data)
                if j in ends:
                    idx=ends.index(j)
                    print(f'{idx+1}/{len(SCENES)} {SCENES[idx][0]}',flush=True)
        p.stdin.close();p.wait()
    except Exception:
        p.kill();raise
    if p.returncode:raise RuntimeError('Video encoding failed')
    target=ROOT/'five-thousand-years-line-art-animation.mp4'
    metadata=WORK/'chapters.ffmeta'
    entries=[';FFMETADATA1','title=一卷穿越五千年','artist=原创线稿动画与器乐配乐','comment=19幕中华文明快速回顾；中文字幕；128秒']
    for start,s in zip(STARTS,SCENES):
        entries.extend(['[CHAPTER]','TIMEBASE=1/1000',f'START={start*1000}',f'END={(start+s[2])*1000}',f'title={s[0]}'])
    metadata.write_text('\n'.join(entries),encoding='utf-8')
    subprocess.run([ff,'-y','-i',str(silent),'-i',str(score),'-i',str(metadata),'-map','0:v:0','-map','1:a:0','-map_metadata','2','-map_chapters','2','-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart','-shortest',str(target)],stderr=log,check=True)
    log.close();print('DONE',target,flush=True)

if __name__=='__main__':main()
