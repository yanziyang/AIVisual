"""FORM FOLLOWS FORMULA — an original, deterministic mathematics motion reel.
Render: python render.py     Contact sheet: python render.py --preview
All geometry, typography, texture, and music are generated locally.
"""
from pathlib import Path
from functools import lru_cache
import math, sys, subprocess, wave, time, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent
MASTER_DIR = ROOT.parent if ROOT.name == 'build' else ROOT
FFMPEG = Path(r'C:\MyProjects\AIVisual\20260926 tadpoles-find-their-mother (GPT-6 Sol Medium)\animation_deps\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v7.1.exe')
W, H, FPS, DURATION = 1920, 1080, 60, 20
TAU = math.tau
INK = (12, 16, 28)
WHITE = (242, 240, 228)
LIME = (220, 255, 65)
BLUE = (100, 175, 255)
CORAL = (255, 104, 78)
MUTED = (131, 143, 165)
SCENES = [0, 2.5, 5.5, 8.5, 11.5, 14.5, 17, 20]
NAMES = ['FORM / 01', 'HARMONICS / 02', 'TOPOLOGY / 03', 'COMPLEXITY / 04', 'GROWTH / 05', 'CONTINUITY / 06', 'FORMULA / 07']

def clamp(v, a=0., b=1.): return max(a, min(b, v))
def ease(v):
    v = clamp(v)
    return 1 - (1-v)**4
def smooth(v):
    v = clamp(v)
    return v*v*(3-2*v)
def mix(a,b,v): return a+(b-a)*v
def tint(a,b,v): return tuple(int(mix(x,y,v)) for x,y in zip(a,b))

@lru_cache(None)
def font(size, kind='bold'):
    paths={'bold':'arialbd.ttf','heavy':'impact.ttf','mono':'consola.ttf','regular':'arial.ttf','math':'cambria.ttc'}
    return ImageFont.truetype('C:/Windows/Fonts/'+paths[kind],size)

@lru_cache(512)
def glyph(text,size,kind='bold',color=WHITE,tracking=0):
    f=font(size,kind)
    box=f.getbbox(text)
    width=int(sum(f.getlength(c)+tracking for c in text)-tracking) if tracking else int(f.getlength(text))
    im=Image.new('RGBA',(width+8,size*2),(0,0,0,0)); d=ImageDraw.Draw(im)
    if tracking:
        x=0
        for c in text:
            d.text((x,-box[1]),c,font=f,fill=color); x+=f.getlength(c)+tracking
    else: d.text((0,-box[1]),text,font=f,fill=color)
    return im.crop((0,0,width+4,box[3]-box[1]+3))

def txt(im,text,x,y,size=26,color=WHITE,kind='bold',tracking=0,alpha=1,scale=1):
    g=glyph(text,size,kind,tuple(color),tracking)
    if scale!=1: g=g.resize((max(1,int(g.width*scale)),max(1,int(g.height*scale))),Image.Resampling.BICUBIC)
    if alpha<1:
        g=g.copy(); g.putalpha(g.getchannel('A').point(lambda v:int(v*clamp(alpha))))
    im.paste(g,(int(x),int(y)),g)

def title(im,text,x,y,size,u,color=WHITE,delay=0):
    p=ease((u-delay)/.55)
    g=glyph(text,size,'heavy',tuple(color))
    # A clean baseline reveal with a small overshoot on the entrance.
    offset=int((1-p)*(g.height+35))
    clip=Image.new('RGBA',(g.width,g.height+8))
    clip.paste(g,(0,offset),g)
    im.paste(clip,(int(x),int(y)),clip)

def ellipse(d,x,y,r,fill=None,outline=None,width=1):
    d.ellipse((x-r,y-r,x+r,y+r),fill=fill,outline=outline,width=width)

def path(d,p,color,width=2):
    p=np.asarray(p)
    if len(p)>1: d.line([tuple(q) for q in p],fill=color,width=width,joint='curve')

rng=np.random.default_rng(27)
yy,xx=np.mgrid[0:H,0:W]
v=np.exp(-(((xx-W*.67)/(W*.8))**2+((yy-H*.42)/(H*.9))**2)*3)
grain=rng.normal(0,.62,(H,W))
base=np.zeros((H,W,3),np.uint8)
for c in range(3): base[:,:,c]=np.clip(INK[c]+v*[3,5,12][c]+grain,0,255)
DARK=Image.fromarray(base)
PAPER=Image.new('RGB',(W,H),WHITE)
ACID=Image.new('RGB',(W,H),LIME)
del xx,yy,v,grain,base

def frame_base(light=False): return (PAPER if light else DARK).copy()

def furniture(im,t,scene,light=False):
    d=ImageDraw.Draw(im); col=INK if light else MUTED
    txt(im,'FORM FOLLOWS FORMULA',85,53,22,col,'mono',2)
    txt(im,'MATHEMATICS × MOTION',1440,53,20,col,'mono',1)
    d.line((85,99,1835,99),fill=tint(col, WHITE if light else INK,.65),width=1)
    txt(im,NAMES[scene],85,997,20,col,'mono',2)
    txt(im,f'{int(t*FPS):04d} / 1200',1615,997,20,col,'mono',1)
    for j in range(40):
        x=650+j*16
        d.line((x,1000,x,1000+(16 if j%5==0 else 6)),fill=(INK if light else WHITE) if j<=int(t*2) else tint(col, WHITE if light else INK,.6),width=2)

def glow(im, curves, color=LIME, width=3, amount=.45):
    small=Image.new('RGB',(W//4,H//4)); d=ImageDraw.Draw(small)
    for pts in curves: path(d,np.asarray(pts)/4,color,max(1,width//2))
    small=small.filter(ImageFilter.GaussianBlur(5)).resize((W,H),Image.Resampling.BILINEAR)
    # Screen blend of a low-resolution bloom pass.
    im.paste(Image.blend(im,Image.fromarray(np.minimum(255,np.asarray(im).astype(np.uint16)+np.asarray(small).astype(np.uint16)).astype(np.uint8)),amount))

def transform(points,t,scale=1,center=(1250,540),axis=0):
    a=t*.55; b=.6+math.sin(t*.38)*.3
    ca,sa,cb,sb=math.cos(a),math.sin(a),math.cos(b),math.sin(b)
    rot=np.array([[ca,0,sa],[sa*sb,cb,-ca*sb],[-sa*cb,sb,ca*cb]])
    p=np.asarray(points)@rot.T
    perspective=4.8/(4.8-p[:,2])
    return np.column_stack((center[0]+p[:,0]*perspective*scale,center[1]+p[:,1]*perspective*scale)),p[:,2]

def intro(t,u):
    im=frame_base(); d=ImageDraw.Draw(im)
    p=ease(u/.9)
    # Orbit scaffold becomes an energetic nested radial system.
    center=(1410,540)
    for j in range(13):
        r=(70+j*24)*p
        a=np.linspace(0,TAU*clamp((u-.025*j)/.85),240)
        angle=u*.5+j*.17
        pts=np.column_stack((center[0]+r*np.cos(a+angle),center[1]+r*np.sin(a+angle)))
        path(d,pts,tint(BLUE,INK,.58),2)
    for j in range(42):
        a=j*TAU/42+u*.3
        r=(250+55*math.sin(a*5+u*2))*p
        x=center[0]+r*math.cos(a); y=center[1]+r*math.sin(a)
        ellipse(d,x,y,4 if j%3 else 8,LIME if j%3 else CORAL)
    # A three-petal rose: r = a cos(3θ), rotating as the orbit opens.
    a=np.linspace(0,TAU,900); r=320*np.cos(3*a)*p
    rose=np.column_stack((center[0]+r*np.cos(a+u*.5),center[1]+r*np.sin(a+u*.5)))
    glow(im,[rose],LIME,4,.5); d=ImageDraw.Draw(im); path(d,rose,LIME,4)
    txt(im,'A STUDY IN BEAUTIFUL PRECISION',90,190,25,MUTED,'mono',2,alpha=ease(u/.4))
    title(im,'MATH',80,292,235,u)
    title(im,'MOVES.',80,538,235,u,delay=.13)
    txt(im,'r = a cos(3θ)',1170,876,29,BLUE,'math',alpha=ease((u-.6)/.4))
    txt(im,'20 SECONDS. INFINITE POSSIBILITIES.',90,858,24,LIME,'mono',1,alpha=ease((u-.8)/.4))
    return im

def harmonics(t,u):
    im=frame_base(); d=ImageDraw.Draw(im)
    txt(im,'01 / FOURIER SYNTHESIS',90,161,25,LIME,'mono',2)
    title(im,'EVERYTHING',85,223,124,u)
    title(im,'IS A WAVE.',85,360,124,u,delay=.08)
    phase=u*TAU*.9
    center=np.array([440.,720.]); tip=center.copy(); circles=[]
    for k,n in enumerate([1,3,5,7]):
        r=175/n*ease(u/.65)
        ellipse(d,*tip,r,outline=tint(BLUE,INK,.52),width=2)
        tip2=tip+np.array([math.cos(n*phase),-math.sin(n*phase)])*r
        path(d,[tip,tip2],WHITE,2); ellipse(d,*tip2,5,LIME)
        tip=tip2
    # The epicycle endpoint exactly matches the Fourier waveform at x=790.
    s=np.linspace(0,TAU*2.6,800); x=790+s/(TAU*2.6)*1020
    val=sum(np.sin(n*(phase-s))/n for n in [1,3,5,7])
    y=720-175*val*ease(u/.65)
    curve=np.column_stack((x,y))
    curves=[curve]
    glow(im,curves,LIME,5,.55); d=ImageDraw.Draw(im)
    d.line((760,720,1830,720),fill=(46,53,67),width=1)
    d.line((790,540,790,905),fill=(46,53,67),width=1)
    path(d,[tip,[790,y[0]]],tint(WHITE,INK,.55),2)
    path(d,curve,LIME,5); ellipse(d,790,y[0],9,WHITE)
    # Ghost harmonics, separately visible behind the sum.
    for n,c in zip([3,5,7],[BLUE,CORAL,MUTED]):
        path(d,np.column_stack((x,720-175/n*np.sin(n*(phase-s)))),tint(c,INK,.5),1)
    txt(im,'f(t) = Σ sin(nt) / n',1160,432,36,WHITE,'math')
    txt(im,'n ∈ {1, 3, 5, 7}',1160,484,25,MUTED,'math')
    txt(im,'ROTATION → OSCILLATION',90,925,22,MUTED,'mono',2)
    return im

def topology(t,u):
    im=frame_base(True); d=ImageDraw.Draw(im)
    txt(im,'02 / PARAMETRIC SURFACES',90,162,25,INK,'mono',2)
    title(im,'BEND',80,282,174,u,INK)
    title(im,'REALITY.',80,472,174,u,INK,.08)
    # A torus, projected through a continuously rotating perspective camera.
    a=np.linspace(0,TAU,220); curves=[]
    def project_torus(xyz):
        spin=u*.62; tilt=.9+.12*math.sin(u*1.7)
        cs,ss,ct,st=math.cos(spin),math.sin(spin),math.cos(tilt),math.sin(tilt)
        rot=np.array([[cs,-ss,0],[ss*ct,cs*ct,-st],[ss*st,cs*st,ct]])
        p=xyz@rot.T; f=6.5/(6.5-p[:,2])
        return np.column_stack((1330+p[:,0]*f*224*expand,550+p[:,1]*f*224*expand)),p[:,2]
    R=1.35; r=.53+.08*math.sin(u*2)
    expand=.65+.35*ease(u/.8)
    for b in np.linspace(0,TAU,32,endpoint=False):
        xyz=np.column_stack(((R+r*math.cos(b))*np.cos(a),(R+r*math.cos(b))*np.sin(a),np.full_like(a,r*math.sin(b))))
        q,z=project_torus(xyz)
        curves.append((float(np.mean(z)),q,b))
    for _,q,b in sorted(curves,key=lambda v:v[0]): path(d,q,tint((90,69,218),CORAL,(math.sin(b)+1)/2),3)
    for b in np.linspace(0,TAU,40,endpoint=False):
        xyz=np.column_stack(((R+r*np.cos(a))*math.cos(b),(R+r*np.cos(a))*math.sin(b),r*np.sin(a)))
        q,z=project_torus(xyz); path(d,q,tint((90,69,218),INK,.25),2)
    txt(im,'x = (R + r cos v) cos u',90,796,30,INK,'math')
    txt(im,'y = (R + r cos v) sin u',90,838,30,INK,'math')
    txt(im,'z = r sin v',90,880,30,INK,'math')
    txt(im,'TORUS / GENUS 1',1280,925,22,INK,'mono',2)
    return im

FRACTAL=None
def fractal_asset():
    global FRACTAL
    if FRACTAL is not None: return FRACTAL
    print('Generating Mandelbrot artwork...',flush=True)
    fw,fh=2560,1440
    x=np.linspace(-.756,-.731,fw,dtype=np.float32); y=np.linspace(.1248,.1388625,fh,dtype=np.float32)
    c=x[None,:]+1j*y[:,None]; z=np.zeros(c.shape,np.complex64); nu=np.zeros(c.shape,np.float32); active=np.ones(c.shape,bool)
    for n in range(220):
        z[active]=z[active]*z[active]+c[active]
        escaped=active & (abs(z)>4)
        if np.any(escaped): nu[escaped]=n+1-np.log2(np.log2(abs(z[escaped])))
        active[escaped]=False
    # Deep cobalt interiors, alternating electric turquoise and coral filaments.
    palette=np.array([[8,13,27],[26,36,81],[73,90,181],[86,199,217],[216,255,99],[255,140,90],[57,64,128],[8,13,27]],dtype=float)
    q=(nu*.12)%7; idx=np.floor(q).astype(int); f=q-idx
    col=palette[idx]*(1-f[:,:,None])+palette[idx+1]*f[:,:,None]
    col[active]=[10,14,25]
    FRACTAL=Image.fromarray(np.uint8(col)); return FRACTAL

def complexity(t,u):
    art=fractal_asset(); zoom=1+1.1*smooth(u/3)
    cw=art.width/zoom; ch=art.height/zoom
    cx=art.width*.57+65*math.sin(u*.4); cy=art.height*.49
    im=art.transform((W,H),Image.Transform.EXTENT,(cx-cw/2,cy-ch/2,cx+cw/2,cy+ch/2),Image.Resampling.BICUBIC)
    # A gradient preserves the real fractal while giving the type a quiet region.
    veil=Image.new('RGBA',(W,H),(8,12,24,0)); mask=Image.fromarray(np.broadcast_to(np.linspace(205,15,W,dtype=np.uint8),(H,W)).copy())
    veil.putalpha(mask); im.paste(veil,(0,0),veil)
    txt(im,'03 / THE MANDELBROT SET',90,160,25,LIME,'mono',2)
    title(im,'COMPLEX',82,568,170,u)
    title(im,'BEAUTY.',82,757,170,u,delay=.08)
    txt(im,'zₙ₊₁ = zₙ² + c',90,263,57,WHITE,'math')
    txt(im,'ONE RULE. ENDLESS DETAIL.',90,345,22,WHITE,'mono',2)
    d=ImageDraw.Draw(im)
    cx,cy=1410,480
    r=90+18*math.sin(u*1.4)
    for dx,dy in [(-1,-1),(1,-1),(-1,1),(1,1)]:
        x=cx+dx*r; y=cy+dy*r
        d.line((x,y,x-dx*23,y),fill=WHITE,width=2); d.line((x,y,x,y-dy*23),fill=WHITE,width=2)
    txt(im,f'SCALE × {zoom:.2f}',1330,610,22,WHITE,'mono',2)
    return im

def growth(t,u):
    im=frame_base(); d=ImageDraw.Draw(im)
    txt(im,'04 / THE GOLDEN ANGLE',90,160,25,LIME,'mono',2)
    title(im,'NATURE',80,277,151,u)
    title(im,'HAS A',80,443,151,u,delay=.05)
    title(im,'NUMBER.',80,609,151,u,delay=.1)
    txt(im,'137.507764°',90,854,49,BLUE,'math')
    cx,cy=1340,545; ga=math.pi*(3-math.sqrt(5)); p=ease(u/1.2)
    count=int(740*p); spin=u*.22
    # Vogel's model: the actual golden-angle phyllotaxis construction.
    for j in range(count,0,-1):
        a=j*ga+spin; rad=14*math.sqrt(j)*(.8+.2*p)
        x=cx+rad*math.cos(a); y=cy+rad*math.sin(a)
        size=3+4.6*j/740
        col=tint(BLUE,LIME,(math.sin(j*.03-u*3)+1)/2)
        ellipse(d,x,y,size,col)
        if j%23==0:
            ellipse(d,x,y,size+8,outline=tint(col,INK,.65),width=1)
    ellipse(d,cx,cy,8,WHITE)
    for j in range(0,200,34):
        a=np.arange(j,min(j+360,count),34)
        if len(a)>1:
            angles=a*ga+spin; radii=14*np.sqrt(a)*(.8+.2*p)
            path(d,np.column_stack((cx+radii*np.cos(angles),cy+radii*np.sin(angles))),tint(LIME,INK,.6),1)
    txt(im,'r = a√n   /   θ = nα',1120,943,27,MUTED,'math')
    return im

def continuity(t,u):
    im=frame_base(); d=ImageDraw.Draw(im)
    txt(im,'05 / THE TREFOIL KNOT',90,160,25,LIME,'mono',2)
    title(im,'NO BEGINNING.',80,217,127,u)
    title(im,'NO END.',80,361,127,u,delay=.08)
    theta=np.linspace(0,TAU,700)
    curves=[]
    p=ease(u/.8)
    for j in range(32):
        b=j*TAU/32
        # Tube around a trefoil centerline, using a local Frenet-like frame.
        xyz=np.column_stack((np.sin(theta)+2*np.sin(2*theta),np.cos(theta)-2*np.cos(2*theta),-np.sin(3*theta)))
        tangent=np.column_stack((np.cos(theta)+4*np.cos(2*theta),-np.sin(theta)+4*np.sin(2*theta),-3*np.cos(3*theta)))
        tangent/=np.linalg.norm(tangent,axis=1)[:,None]
        normal=np.cross(tangent,np.array([0.,0.,1.])); normal/=np.linalg.norm(normal,axis=1)[:,None]
        binormal=np.cross(tangent,normal)
        tube=xyz*.63+.12*(normal*math.cos(b)+binormal*math.sin(b))
        q,z=transform(tube,u*1.5+3,170*(.7+.3*p),(1250,705))
        curves.append((float(np.mean(z)),q,b))
    glow(im,[q for _,q,_ in curves[::4]],BLUE,3,.8); d=ImageDraw.Draw(im)
    for _,q,b in sorted(curves,key=lambda v:v[0]): path(d,q,tint(BLUE,LIME,(math.sin(b)+1)/2),2)
    txt(im,'x = sin t + 2 sin 2t',90,646,27,MUTED,'math')
    txt(im,'y = cos t − 2 cos 2t',90,691,27,MUTED,'math')
    txt(im,'z = −sin 3t',90,736,27,MUTED,'math')
    txt(im,'CLOSED CURVE / R³',90,920,22,WHITE,'mono',2)
    return im

def finale(t,u):
    im=ACID.copy(); d=ImageDraw.Draw(im)
    txt(im,'THE EQUATION IS THE CHOREOGRAPHY.',90,162,25,INK,'mono',2)
    title(im,'FORM',80,248,192,u,INK)
    title(im,'FOLLOWS',80,454,192,u,INK,.07)
    title(im,'FORMULA.',80,660,192,u,INK,.14)
    # Orbital armillary, with an inverse-color core and smooth approach to rest.
    cx,cy=1435,535; p=ease(u/.8); angle=u*.9
    r=260*p
    ellipse(d,cx,cy,r,INK)
    a=np.linspace(0,TAU,260)
    for j in range(14):
        b=j*math.pi/14+angle*.3
        pts=np.column_stack((np.cos(a),np.sin(a)*math.cos(b),np.sin(a)*math.sin(b)))
        q,z=transform(pts,angle+1.2,246*p,(cx,cy))
        path(d,q,tint(LIME,BLUE,j/14),2)
    ellipse(d,cx,cy,8,LIME)
    # An orbit breaks the silhouette and makes the sculpture feel dimensional.
    pts=np.column_stack((1.48*np.cos(a),.33*np.sin(a),.4*np.sin(a)))
    q,z=transform(pts,angle*.6,245*p,(cx,cy)); path(d,q,INK,4)
    k=int((u*.18%1)*(len(q)-1)); ellipse(d,*q[k],11,CORAL)
    txt(im,'MATHEMATICS × MOTION DESIGN',90,925,24,INK,'mono',2)
    txt(im,'20.00s / 60fps',1480,925,22,INK,'mono',1)
    return im

RENDERERS=[intro,harmonics,topology,complexity,growth,continuity,finale]
def frame(t,transitions=True):
    i=min(6,int(np.searchsorted(SCENES,t,side='right')-1)); u=t-SCENES[i]
    im=RENDERERS[i](t,u); furniture(im,t,i,i in (2,6))
    # Three staggered shutters, timed to the musical cuts. No dissolves.
    if transitions and i<6 and t>SCENES[i+1]-.18:
        v=(t-(SCENES[i+1]-.18))/.18
        nextim=RENDERERS[i+1](SCENES[i+1],0); furniture(nextim,SCENES[i+1],i+1,i+1 in (2,6))
        for band in range(3):
            p=ease((v-band*.1)/.8); bw=int(W*p)
            y0=band*H//3; y1=(band+1)*H//3
            if bw: im.paste(nextim.crop((W-bw,y0,W,y1)),(W-bw,y0))
    # A deliberate final hold and short 6-frame fade to black.
    if t>19.9: im=Image.blend(im,Image.new('RGB',(W,H),INK),clamp((t-19.9)/.1))
    return im

def soundtrack():
    print('Synthesizing original soundtrack...',flush=True)
    sr=48000; size=sr*DURATION; stereo=np.zeros((size,2),np.float64); rng=np.random.default_rng(100)
    def add(start,a,gain=1,pan=0):
        off=int(start*sr)
        if off>=size:return
        a=a[:size-off]*gain
        stereo[off:off+len(a),0]+=a*math.sqrt((1-pan)/2)
        stereo[off:off+len(a),1]+=a*math.sqrt((1+pan)/2)
    def tone(freq,dur,kind='sine'):
        tt=np.arange(int(sr*dur))/sr
        sig=np.sin(TAU*freq*tt)
        if kind=='rich':sig+=.28*np.sin(TAU*freq*2*tt)+.13*np.sin(TAU*freq*3*tt)
        return tt,sig
    def midi(n):return 440*2**((n-69)/12)
    # A tight 120 BPM pulse, with a restrained intro and wider stereo detail.
    for beat in range(40):
        start=beat*.5
        tt=np.arange(int(sr*.45))/sr
        phase=TAU*(45*tt+105*.035*(1-np.exp(-tt/.035)))
        kick=np.sin(phase)*np.exp(-tt*12)+.07*rng.normal(size=len(tt))*np.exp(-tt*150)
        add(start,kick,.68 if beat>3 else .38)
        if beat%2==1:
            tt=np.arange(int(sr*.19))/sr; noise=rng.normal(size=len(tt))
            noise=np.r_[0,np.diff(noise)]
            snare=(noise*.38+np.sin(TAU*180*tt)*.15)*np.exp(-tt*26)
            add(start,snare,.24,pan=.12)
        notes=[38,38,41,45,38,48,45,41]
        tt,sig=tone(midi(notes[(beat//2)%8]),.35,'rich')
        env=np.minimum(1,tt/.008)*np.exp(-tt*9)
        add(start+.025,sig*env,.25)
    for eighth in range(80):
        start=eighth*.25
        tt=np.arange(int(sr*.08))/sr; noise=rng.normal(size=len(tt)); noise=np.r_[0,np.diff(noise)]
        add(start,noise*np.exp(-tt*75),.026 if eighth%2 else .045,pan=(-1 if eighth%2 else 1)*.55)
        if 8<=eighth<72:
            notes=[74,77,81,84,81,77,72,69]
            tt,sig=tone(midi(notes[eighth%8]),.38,'rich'); env=np.minimum(1,tt/.005)*np.exp(-tt*13)
            a=sig*env
            add(start,a,.09,pan=math.sin(eighth*1.4)*.65)
            add(start+.1875,a,.025,pan=-math.sin(eighth*1.4)*.7)
    # Airy sustained D-minor color; modulation provides a slow widening texture.
    tt=np.arange(size)/sr
    for n in [50,57,65,69]:
        f=midi(n); env=(.5-.5*np.cos(TAU*np.minimum(tt/2,1)/2))*np.minimum(1,(20-tt)/1.2)
        stereo[:,0]+=.035*np.sin(TAU*f*tt+.012*np.sin(TAU*.33*tt))*env
        stereo[:,1]+=.035*np.sin(TAU*f*tt+.035*np.sin(TAU*.31*tt))*env
    # Ascending transitions and short impact accents at the scene boundaries.
    for boundary in SCENES[1:-1]:
        tt=np.arange(int(sr*.38))/sr; frac=tt/.38
        sweep=np.sin(TAU*(320*tt+1600*tt*tt))*frac**2
        add(boundary-.38,sweep,.07,pan=-.3)
        tt,sig=tone(midi(86),.7); add(boundary,sig*np.exp(-tt*8),.14,.3)
        noise=rng.normal(size=len(tt)); add(boundary,noise*np.exp(-tt*20),.03)
    # Finale resolves to a longer bell, then a controlled tail.
    for n in [62,69,74,77]:
        tt,sig=tone(midi(n),3); add(17,sig*np.exp(-tt*1.8),.06,(n-70)/18)
    fadein=np.minimum(1,np.arange(size)/(sr*.025))
    fadeout=np.minimum(1,(size-np.arange(size))/(sr*.18))
    stereo=np.tanh(stereo*1.3)*fadein[:,None]*fadeout[:,None]
    stereo*=.89/max(np.max(np.abs(stereo)),.01)
    with wave.open(str(ROOT/'score.wav'),'wb') as out:
        out.setnchannels(2);out.setsampwidth(2);out.setframerate(sr);out.writeframes((stereo*32767).astype('<i2').tobytes())

def preview():
    times=[1.5,4.2,7.2,10.2,13.3,16,18.8]
    sheet=Image.new('RGB',(1280,4*392),INK)
    for j,t in enumerate(times):
        im=frame(t); im.save(ROOT/f'frame-{j+1:02d}.png')
        thumb=im.resize((640,360),Image.Resampling.LANCZOS)
        x=(j%2)*640;y=(j//2)*392;sheet.paste(thumb,(x,y))
        ImageDraw.Draw(sheet).text((x+14,y+366),f'{t:04.1f}s  |  {NAMES[j]}',font=font(18,'mono'),fill=WHITE)
    sheet.save(ROOT/'contact-sheet.jpg',quality=94)
    frame(18.8).save(ROOT/'poster.png')
    print('Preview written.',flush=True)

def render():
    soundtrack(); fractal_asset()
    video=MASTER_DIR/'FORM-FOLLOWS-FORMULA.mp4'
    cmd=[str(FFMPEG),'-hide_banner','-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0','-i',str(ROOT/'score.wav'),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','320k','-ar','48000','-t','20','-movflags','+faststart','-metadata','title=FORM FOLLOWS FORMULA','-metadata','comment=Original procedural mathematics motion design and synthesized score.','-loglevel','warning',str(video)]
    proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=open(ROOT/'encode.log','w'))
    began=time.time()
    try:
        for j in range(FPS*DURATION):
            proc.stdin.write(frame(j/FPS).tobytes())
            if j%60==0:print(f'Render {j//60:02d}/20 s | elapsed {time.time()-began:.1f}s',flush=True)
        proc.stdin.close(); code=proc.wait()
        if code:raise RuntimeError(f'Encoder exited {code}')
    except Exception:
        proc.kill();raise
    preview()
    print(f'COMPLETE {video} ({video.stat().st_size/1e6:.1f} MB)',flush=True)

if __name__=='__main__':
    if '--preview' in sys.argv:preview()
    else:render()
