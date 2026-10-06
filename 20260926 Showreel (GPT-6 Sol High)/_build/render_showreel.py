from PIL import Image, ImageDraw, ImageFont
import numpy as np
import math, subprocess, wave, functools, time
import imageio_ffmpeg
from pathlib import Path
SCRIPT_DIR=Path(__file__).resolve().parent
ROOT=SCRIPT_DIR.parent if SCRIPT_DIR.name.casefold()=='_build' else SCRIPT_DIR
OUT=ROOT/'FORM_FLOW'
OUT.mkdir(exist_ok=True)
W,H,FPS=1920,1080,60
S=W/1600
BAR=1.875
BLACK=(14,16,17)
WHITE=(242,240,228)
LIME=(205,255,68)
PEACH=(255,135,106)
BLUE=(109,123,255)
TAU=math.tau
def clamp(x):return max(0,min(1,x))
def ease(x):return 1-(1-clamp(x))**4
def smooth(x):
    x=clamp(x);return x*x*(3-2*x)
def spring(x):return 1-math.exp(-8*max(0,x))*math.cos(12*max(0,x))
def mix(a,b,t):return tuple(int(a[i]+(b[i]-a[i])*clamp(t)) for i in range(3))
def pt(x,y):return (int(x*S),int(y*S))
def box(x,y,w,h):return (int(x*S),int(y*S),int((x+w)*S),int((y+h)*S))
@functools.lru_cache(maxsize=100)
def font(size,style='bold'):
    names={'bold':'ariblk.ttf','condensed':'impact.ttf','regular':'arial.ttf','mono':'consola.ttf'}
    return ImageFont.truetype('C:/Windows/Fonts/'+names[style],int(size*S))
@functools.lru_cache(maxsize=500)
def glyph(word,size,style='bold',outline=False):
    f=font(size,style);b=f.getbbox(word);pad=8
    im=Image.new('L',(b[2]-b[0]+pad*2,b[3]-b[1]+pad*2));d=ImageDraw.Draw(im)
    d.text((pad-b[0],pad-b[1]),word,font=f,fill=0 if outline else 255,stroke_width=max(1,int(1.8*S)) if outline else 0,stroke_fill=255)
    return im
def text(im,word,x,y,size,color=WHITE,style='bold',anchor='left',width=None,angle=0,alpha=1,outline=False):
    mask=glyph(word,size,style,outline)
    if width is not None:mask=mask.resize((max(1,int(width*S)),mask.height),Image.Resampling.BICUBIC)
    if angle:mask=mask.rotate(angle,Image.Resampling.BICUBIC,expand=True)
    if alpha<1:mask=mask.point(lambda v:int(v*clamp(alpha)))
    xx=int(x*S)-(mask.width//2 if anchor=='center' else mask.width if anchor=='right' else 0)
    im.paste(color,(xx,int(y*S)),mask)
def line(d,pts,c,width=1):d.line([pt(*p) for p in pts],fill=c,width=max(1,int(width*S)),joint='curve')
def circle(d,x,y,r,c,outline=None,width=1):d.ellipse(box(x-r,y-r,r*2,r*2),fill=c,outline=outline,width=max(1,int(width*S)))
def star(d,x,y,r,c,rot=0,n=8,inner=.34):
    d.polygon([pt(x+math.cos(rot+i*math.pi/n)*r*(1 if i%2==0 else inner),y+math.sin(rot+i*math.pi/n)*r*(1 if i%2==0 else inner)) for i in range(n*2)],fill=c)
def arrow(d,x,y,length,c,angle=0,width=10):
    dx,dy=math.cos(angle),math.sin(angle);px,py=-dy,dx
    line(d,[(x,y),(x+dx*length,y+dy*length)],c,width)
    line(d,[(x+dx*length-px*length*.22-dx*length*.22,y+dy*length-py*length*.22-dy*length*.22),(x+dx*length,y+dy*length),(x+dx*length+px*length*.22-dx*length*.22,y+dy*length+py*length*.22-dy*length*.22)],c,width)
def frame(im,t,num,label,color=WHITE):
    d=ImageDraw.Draw(im)
    text(im,'CODEX  /  MOTION STUDIES',55,36,17,color,'mono')
    text(im,'SHOWREEL 26',1545,36,17,color,'mono',anchor='right')
    line(d,[(55,814),(1545,814)],color,1)
    text(im,f'{num:02d} / {label}',55,835,16,color,'mono')
    text(im,f'{t:05.2f} / 15.00',1545,835,16,color,'mono',anchor='right')
    d.rectangle(box(55,889,1490*t/15,3),fill=color)
def torus(im,t,cx=800,cy=440,scale=1):
    d=ImageDraw.Draw(im);nu,nv=144,48
    u=np.linspace(0,TAU,nu,endpoint=False)[:,None];v=np.linspace(0,TAU,nv,endpoint=False)[None,:]
    radial=215+22*np.cos(3*u+t*2);rr=76+13*np.sin(2*u-t*3)
    x=(radial+rr*np.cos(v))*np.cos(u);y=(radial+rr*np.cos(v))*np.sin(u);z=rr*np.sin(v)+63*np.sin(3*u+t*.8)
    coords=np.stack(np.broadcast_arrays(x,y,z),axis=-1)
    ax=.75+.25*math.sin(t*1.1);az=t*.75
    rx=np.array([[1,0,0],[0,math.cos(ax),-math.sin(ax)],[0,math.sin(ax),math.cos(ax)]])
    rz=np.array([[math.cos(az),-math.sin(az),0],[math.sin(az),math.cos(az),0],[0,0,1]])
    coords=coords@rx.T@rz.T
    verts=np.stack([coords,np.roll(coords,-1,axis=0),np.roll(np.roll(coords,-1,axis=0),-1,axis=1),np.roll(coords,-1,axis=1)],axis=2).reshape(-1,4,3)
    normals=np.cross(verts[:,1]-verts[:,0],verts[:,3]-verts[:,0]);normals/=np.linalg.norm(normals,axis=1)[:,None]+1e-9
    light=np.array([-.35,-.65,1]);light/=np.linalg.norm(light)
    bright=np.abs(normals@light);edge=np.abs(normals[:,2]);hue=(np.sin(np.repeat(np.arange(nu),nv)/nu*TAU*2+t)+1)/2
    base=np.array(BLUE)[None,:]+(np.array(LIME)-np.array(BLUE))[None,:]*hue[:,None]
    colors=np.clip(base*(.15+.6*bright[:,None])+np.array([225,230,255])[None,:]*bright[:,None]**22*.85+55*(1-edge[:,None])**3,0,255).astype(int)
    persp=1000/(1000-verts[:,:,2]);px=cx+verts[:,:,0]*persp*scale;py=cy+verts[:,:,1]*persp*scale
    for k in np.argsort(verts[:,:,2].mean(axis=1)):
        d.polygon([pt(px[k,j],py[k,j]) for j in range(4)],fill=tuple(colors[k]))
def render(t):
    scene=min(7,int(t/BAR));u=t-scene*BAR
    if scene==0:
        im=Image.new('RGB',(W,H),BLACK);d=ImageDraw.Draw(im);e=spring(u*1.5)
        for r in range(6):circle(d,800,425,(90+r*65)*ease(u*1.8),None,mix(BLACK,LIME,.13+.06*r),2)
        star(d,800,420,max(2,155*e*(1-smooth((u-.65)/.6))),LIME,t*1.5)
        a=ease((u-.42)/.55);text(im,'MAKE',800,205+160*(1-a),205,WHITE,anchor='center',width=900,alpha=a)
        b=ease((u-.67)/.55);text(im,'IT MOVE.',800,430+140*(1-b),190,LIME,anchor='center',width=1290,alpha=b)
        text(im,'IDEAS ARE ONLY THE BEGINNING.',800,694,21,WHITE,'mono',anchor='center',alpha=ease((u-1.05)/.4));frame(im,t,1,'THE IMPULSE')
    elif scene==1:
        im=Image.new('RGB',(W,H),LIME);d=ImageDraw.Draw(im)
        for j in range(5):
            y=105+j*137;offset=(t*180*((-1)**j))%500
            for k in range(-2,5):text(im,'MOVE',k*650-offset,y,180,BLACK,width=590,outline=(j!=2))
        x=800+140*math.sin(u*3)
        d.polygon([pt(x-370,80),pt(x+170,80),pt(x+450,790),pt(x-90,790)],fill=BLACK)
        text(im,'WITH',x,290,90,WHITE,anchor='center',width=320,angle=-12)
        text(im,'INTENT',x+38,408,95,WHITE,anchor='center',width=440,angle=-12)
        star(d,1400,170,60,BLACK,t*2,n=4,inner=.22);frame(im,t,2,'KINETIC TYPE',BLACK)
    elif scene==2:
        im=Image.new('RGB',(W,H),WHITE);d=ImageDraw.Draw(im)
        for j in range(10):
            points=[(x,460+155*math.sin(x/270-u*3+j*.16)+j*19-90) for x in range(-50,1660,8)]
            line(d,points,BLACK if j%2 else BLUE,12)
        text(im,'F',72,145,320,BLACK,width=230);text(im,'L',360,175+60*math.sin(u*3),320,BLACK,width=230)
        text(im,'O',700,140+40*math.sin(u*3+1),320,BLACK,width=295);text(im,'W',1075,175,320,BLACK,width=420)
        d.rectangle(box(61,639,485,76),fill=LIME);text(im,'RHYTHM INTO FORM',80,663,27,BLACK,'mono')
        arrow(d,1360,680,120,BLACK,-.3,8);frame(im,t,3,'FLOW SYSTEMS',BLACK)
    elif scene==3:
        im=Image.new('RGB',(W,H),BLACK);d=ImageDraw.Draw(im)
        for j in range(11):line(d,[(80,560+j*j*2.05),(1520,560+j*j*2.05)],(35,38,39),1)
        for j in range(-10,11):line(d,[(800+j*30,510),(800+j*160,790)],(35,38,39),1)
        text(im,'BEYOND',55,120,94,WHITE,width=530)
        torus(im,u,865,421,.94*spring(u*2))
        text(im,'THE FLAT.',1545,683,70,LIME,anchor='right',width=585)
        for j in range(3):
            a=u*1.9+j*TAU/3;circle(d,865+365*math.cos(a),437+195*math.sin(a),7,LIME)
        text(im,'X / Y / Z',55,712,18,WHITE,'mono');frame(im,t,4,'DIMENSION')
    elif scene==4:
        im=Image.new('RGB',(W,H),PEACH);d=ImageDraw.Draw(im);size=182;x0=840;y0=133
        for row in range(3):
            for col in range(3):
                x=x0+col*212;y=y0+row*212;d.rounded_rectangle(box(x,y,size,size),radius=int(18*S),fill=BLACK)
                phase=u*4+col*.7+row*.85;rad=52+23*math.sin(phase)
                if (row+col)%3==0:circle(d,x+91+18*math.sin(phase),y+91,rad,LIME)
                elif (row+col)%3==1:star(d,x+91,y+91,rad+10,WHITE,phase*.4,n=4,inner=.4)
                else:circle(d,x+91,y+91,rad,None,BLUE,18);circle(d,x+91,y+91,12,PEACH)
        text(im,'PLAY',60,215,173,BLACK,width=660);text(im,'HAS',62,395,122,BLACK,width=425);text(im,'PURPOSE.',65,536,112,BLACK,width=660)
        text(im,'A LITTLE JOY. A LOT OF CONTROL.',68,735,19,BLACK,'mono');frame(im,t,5,'ELASTIC BEHAVIOUR',BLACK)
    elif scene==5:
        im=Image.new('RGB',(W,H),BLACK);d=ImageDraw.Draw(im);text(im,'ONE IDEA. EVERY DIMENSION.',55,105,63,WHITE,width=1480)
        for i,c in enumerate([LIME,WHITE,BLUE]):
            x=55+i*506;y=245+80*(1-spring(max(0,u-i*.12)*2));d.rounded_rectangle(box(x,y,478,482),radius=int(16*S),fill=c)
            text(im,f'0{i+1}',x+26,y+23,23,BLACK,'mono')
            if i==0:
                for j in range(7):
                    a=j*TAU/7+u;circle(d,x+239+math.cos(a)*90,y+239+math.sin(a)*90,64,None,BLACK,3)
            elif i==1:
                for j in range(9):
                    a=u*.8+j*.11;line(d,[(x+239+px*math.cos(a)-py*math.sin(a),y+235+px*math.sin(a)+py*math.cos(a)) for px,py in [(-106,-106),(106,-106),(106,106),(-106,106),(-106,-106)]],BLACK,2)
            else:star(d,x+239,y+235,143,BLACK,u,n=12,inner=.62);circle(d,x+239,y+235,55,c)
            text(im,['IDENTITY','SYSTEMS','EXPRESSION'][i],x+26,y+414,35,BLACK,width=422)
        frame(im,t,6,'DESIGN IN MOTION')
    elif scene==6:
        im=Image.new('RGB',(W,H),WHITE);d=ImageDraw.Draw(im);stage=min(2,int(u/.625));p=(u-stage*.625)/.625
        word=['DESIGN','FEEL','SOMETHING.'][stage];color=[BLACK,BLUE,BLACK][stage]
        for j in range(4):text(im,word,800+(j-1.5)*22*math.sin(p*math.pi),120+j*160,190,color,anchor='center',width=1460,outline=(j!=1))
        d.rectangle(box(55+1490*ease(p),92,12,678),fill=LIME);frame(im,t,7,'MAKE AN IMPRESSION',BLACK)
    else:
        im=Image.new('RGB',(W,H),BLACK);d=ImageDraw.Draw(im);a=ease(u/.7)
        star(d,1365,256,140*spring(u*1.9),LIME,u*.5,n=8,inner=.3)
        text(im,'CODEX',60,158+120*(1-a),226,WHITE,width=1110,alpha=a);text(im,'MOTION',60,407+90*(1-a),211,LIME,width=1475,alpha=a)
        text(im,'IDEAS, IN MOTION.',65,698,29,WHITE,'mono',alpha=ease((u-.55)/.4))
        text(im,'TYPE / FORM / RHYTHM / FEELING',1545,710,18,WHITE,'mono',anchor='right',alpha=ease((u-.7)/.4));frame(im,t,8,'CREATIVE SHOWREEL')
    if scene<7 and u>BAR-.17:
        p=smooth((u-(BAR-.17))/.17);nextcol=[LIME,WHITE,BLACK,PEACH,BLACK,WHITE,BLACK][scene];d=ImageDraw.Draw(im);x=1600*(1-p)
        d.polygon([pt(x+170,0),pt(1700,0),pt(1700,900),pt(x-170,900)],fill=nextcol)
    return im
def audio():
    sr=48000;n=sr*15;out=np.zeros((n,2),dtype=np.float64);rng=np.random.default_rng(26)
    def add(start,v,gain=1,pan=0):
        ix=int(start*sr)
        if ix<0:v=v[-ix:];ix=0
        m=min(len(v),n-ix)
        if m<=0:return
        out[ix:ix+m,0]+=v[:m]*gain*math.sqrt((1-pan)/2);out[ix:ix+m,1]+=v[:m]*gain*math.sqrt((1+pan)/2)
    beat=60/128
    for k in range(32):
        st=k*beat
        if k>=28 and k!=28:continue
        tt=np.arange(int(sr*.38))/sr;phase=TAU*(48*tt+115*.035*(1-np.exp(-tt/.035)))
        kick=np.sin(phase)*np.exp(-tt/.11)+rng.normal(0,1,len(tt))*np.exp(-tt/.006)*.18;add(st,kick,.8)
        if k%2==1:
            tt=np.arange(int(sr*.19))/sr;noise=rng.normal(0,1,len(tt));noise=np.concatenate([[0],np.diff(noise)])
            add(st,noise*np.exp(-tt/.045)*(.45+.55*np.sin(TAU*78*tt)**2),.22)
        for h in range(2 if k<20 else 4):
            tt=np.arange(int(sr*.045))/sr;z=rng.normal(0,1,len(tt));z=np.concatenate([[0],np.diff(z)])
            add(st+h*beat/(2 if k<20 else 4),z*np.exp(-tt/.013),.075 if h%2 else .1,(-1)**h*.5)
    roots=[36,36,32,32,39,39,34,36]
    for bar in range(8):
        root=roots[bar]
        for j in range(8):
            if bar==7 and j>0:continue
            st=bar*BAR+j*beat/2;tt=np.arange(int(sr*.24))/sr;freq=440*2**((root-69)/12)
            env=(1-np.exp(-tt/.005))*np.exp(-tt/.09);bass=(np.sin(TAU*freq*tt)+.28*np.sin(TAU*freq*2*tt)+.14*np.sin(TAU*freq*3*tt))*env;add(st,bass,.25)
            note=root+24+[0,7,12,15,7,10,12,19][j];freq=440*2**((note-69)/12);tt=np.arange(int(sr*.62))/sr
            env=(1-np.exp(-tt/.004))*np.exp(-tt/.14);pluck=np.sin(TAU*freq*tt+2.1*np.sin(TAU*freq*2*tt)*np.exp(-tt/.055))*env;pan=math.sin(j*2)*.55
            add(st,pluck,.13,pan);add(st+beat*.75,pluck,.035,-pan)
        tt=np.arange(int(sr*(BAR+1)))/sr;env=np.minimum(tt/.15,1)*np.exp(-tt/1.5)*np.minimum((BAR+1-tt)/.5,1);chord=np.zeros(len(tt))
        for note in [root+12,root+15,root+19,root+26]:
            f=440*2**((note-69)/12);chord+=np.sin(TAU*f*tt+.15*np.sin(TAU*.7*tt))/4
        add(bar*BAR,chord*env,.13)
    for k in range(1,8):
        tt=np.arange(int(sr*.33))/sr;noise=rng.normal(0,1,len(tt));add(k*BAR-.27,noise*np.sin(math.pi*tt/.33)**2*.07,1,-.2)
        tt=np.arange(int(sr*.65))/sr;add(k*BAR,np.sin(TAU*(90*tt+50*tt**2))*np.exp(-tt/.16),.16,.2)
    out=np.tanh(out*1.55);out*=.9/max(.9,np.max(np.abs(out)));tt=np.arange(n)/sr
    out*=np.minimum(tt/.025,1)[:,None]*np.clip((15-tt)/.45,0,1)[:,None]
    with wave.open(str(OUT/'soundtrack.wav'),'wb') as w:
        w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes((out*32767).astype('<i2').tobytes())
def contact():
    sheet=Image.new('RGB',(1920,1080),BLACK)
    for j,t in enumerate([1.3,2.6,4.6,6.6,8.3,10.4,12.2,14.3]):sheet.paste(render(t).resize((480,270),Image.Resampling.LANCZOS),((j%4)*480,(j//4)*540+135))
    sheet.save(OUT/'contact-sheet.jpg',quality=94);render(14.4).save(OUT/'poster.jpg',quality=96)
if __name__=='__main__':
    import sys
    contact()
    if '--preview' in sys.argv:print('Contact sheet ready',flush=True);raise SystemExit
    audio();exe=imageio_ffmpeg.get_ffmpeg_exe()
    args=[exe,'-y','-f','rawvideo','-vcodec','rawvideo','-s',f'{W}x{H}','-pix_fmt','rgb24','-r',str(FPS),'-i','-','-i',str(OUT/'soundtrack.wav'),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','320k','-t','15','-movflags','+faststart',str(OUT/'FORM_FLOW_Showreel.mp4')]
    with open(OUT/'encode.log','w') as log:
        proc=subprocess.Popen(args,stdin=subprocess.PIPE,stdout=log,stderr=log);start=time.time()
        for k in range(FPS*15):
            proc.stdin.write(render(k/FPS).tobytes())
            if k%60==0:print(f'Rendered {k//60:02d}/15 seconds ({time.time()-start:.1f}s elapsed)',flush=True)
        proc.stdin.close();ret=proc.wait()
        if ret:raise RuntimeError('Encoding failed; inspect encode.log')
    print('Complete: '+str(OUT/'FORM_FLOW_Showreel.mp4'),flush=True)
