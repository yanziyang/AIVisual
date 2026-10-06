"""Create the editable Blender landscape and its web-ready glTF export.
Run with Blender 3.6+: blender --background --python create_landscape.py
"""
import bpy, math, random, os
from mathutils import Vector
from collections import defaultdict

random.seed(17)
OUT=os.path.dirname(os.path.abspath(__file__))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.materials): bpy.data.materials.remove(block)
M={}; B=defaultdict(lambda:[[],[]])
def mat(name,color,rough=0.85,metal=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    M[name]=m
for name,c in {
    'meadow':(0.29,.43,.18),'grass_light':(.42,.53,.25),'grass_dark':(.19,.33,.14),
    'earth':(.20,.25,.16),'earth_layer':(.32,.31,.21),'sand':(.63,.60,.40),
    'path':(.71,.64,.49),'path_edge':(.58,.51,.36),'stone':(.52,.51,.43),
    'stone_light':(.73,.70,.60),'wall_cream':(.88,.81,.63),'wall_peach':(.82,.63,.48),
    'wall_white':(.88,.87,.76),'wall_gold':(.82,.73,.46),'wall_pink':(.80,.63,.59),
    'roof':(.49,.18,.12),'roof_light':(.63,.28,.18),'roof_dark':(.36,.14,.11),
    'wood':(.28,.18,.11),'wood_light':(.47,.34,.20),'wood_old':(.36,.35,.27),
    'shutter_blue':(.17,.32,.40),'shutter_sage':(.28,.40,.30),'shutter_red':(.46,.19,.15),
    'glass':(.16,.29,.29),'frame':(.77,.73,.59),'trunk':(.26,.20,.12),
    'leaf_dark':(.10,.24,.15),'leaf':(.20,.36,.18),'leaf_light':(.32,.46,.21),
    'leaf_gold':(.50,.53,.20),'leaf_silver':(.39,.48,.31),'pine':(.09,.23,.18),
    'flower_pink':(.89,.35,.49),'flower_white':(.96,.90,.70),'flower_purple':(.46,.29,.66),
    'flower_yellow':(.94,.66,.18),'flower_red':(.78,.19,.23),'stem':(.22,.36,.14),
    'lavender':(.47,.39,.68),'pot':(.62,.31,.20),'iron':(.16,.20,.17),
    'moss':(.29,.37,.17),'ruin':(.58,.55,.42),'awnings':(.89,.79,.56)
}.items():mat(name,c)
mat('water',(.08,.39,.40),.2,.15);mat('water_foam',(.41,.67,.60),.25)

def mesh(k,vs,fs):
    v,f=B[k];n=len(v);v.extend(vs);f.extend([tuple(n+i for i in a) for a in fs])
def box(k,c,s,angle=0):
    x,y,z=c;a,b,h=[t/2 for t in s];ca,sa=math.cos(angle),math.sin(angle)
    vs=[(x+u*ca-v*sa,y+u*sa+v*ca,z+w) for u,v,w in [(-a,-b,-h),(a,-b,-h),(a,b,-h),(-a,b,-h),(-a,-b,h),(a,-b,h),(a,b,h),(-a,b,h)]]
    mesh(k,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
def cone(k,c,r1,r2,h,n=8):
    x,y,z=c;vs=[]
    for zz,rr in [(z-h/2,r1),(z+h/2,r2)]:
        vs += [(x+rr*math.cos(i*math.tau/n),y+rr*math.sin(i*math.tau/n),zz) for i in range(n)]
    fs=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh(k,vs,fs)
def ball(k,c,s,n=7,rings=5):
    x,y,z=c;rx,ry,rz=s;vs=[(x,y,z-rz)]
    for j in range(1,rings):
        lat=-math.pi/2+j*math.pi/rings
        vs += [(x+rx*math.cos(lat)*math.cos(i*math.tau/n),y+ry*math.cos(lat)*math.sin(i*math.tau/n),z+rz*math.sin(lat)) for i in range(n)]
    vs.append((x,y,z+rz));fs=[]
    for i in range(n):fs.append((0,1+(i+1)%n,1+i))
    for j in range(rings-2):
        for i in range(n): a=1+j*n+i;b=1+j*n+(i+1)%n;fs.append((a,b,b+n,a+n))
    top=len(vs)-1
    for i in range(n):fs.append((top,1+(rings-2)*n+i,1+(rings-2)*n+(i+1)%n))
    mesh(k,vs,fs)
def beam(k,a,b,r=.12):
    av,bv=Vector(a),Vector(b);d=bv-av;mid=(av+bv)/2;rot=d.to_track_quat('Z','Y').to_matrix();n=6
    vs=[tuple(mid+rot@Vector((r*math.cos(i*math.tau/n),r*math.sin(i*math.tau/n),zz))) for zz in [-d.length/2,d.length/2] for i in range(n)]
    mesh(k,vs,[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)])
def terrain(x,y):
    r=math.hypot(x,y)
    return .52+max(0,r-34)*.06+math.sin(x*.12)*math.cos(y*.10)*max(0,r-29)*.018
def lake_radius(a):return 1+.05*math.sin(a*3+.5)+.034*math.sin(a*7)
def lake_ring(a):r=lake_radius(a);return 21.5*r*math.cos(a),17.8*r*math.sin(a)

# A sculpted circular landscape with a cutaway earth edge.
N=112;vs=[(0,0,.5)];fs=[]
for j in range(1,15):
    for i in range(N):
        a=i*math.tau/N;r=j*4.15;rr=r*(1+.018*math.sin(5*a)+.012*math.cos(9*a))
        x,y=rr*math.cos(a),rr*math.sin(a);vs.append((x,y,terrain(x,y)))
for i in range(N):fs.append((0,1+i,1+(i+1)%N))
for j in range(13):
    for i in range(N):a=1+j*N+i;b=1+j*N+(i+1)%N;fs.append((a,b,b+N,a+N))
mesh('meadow',vs,fs)
edge=vs[-N:]
for i in range(N):
    j=(i+1)%N;a,b=edge[i],edge[j]
    mesh('earth', [a,b,(b[0],b[1],-3.4),(a[0],a[1],-3.4)],[(0,1,2,3)])
    mesh('earth_layer',[(a[0]*1.001,a[1]*1.001,-1.7),(b[0]*1.001,b[1]*1.001,-1.7),(b[0]*1.001,b[1]*1.001,-2.12),(a[0]*1.001,a[1]*1.001,-2.12)],[(0,1,2,3)])
cone('earth',(0,0,-3.45),58,58,.12,112)
# Shore bevel and lake, including an island hole.
shore=[lake_ring(i*math.tau/N) for i in range(N)]
for i in range(N):
    j=(i+1)%N;a,b=shore[i],shore[j]
    mesh('sand',[(a[0]*1.055,a[1]*1.055,.56),(b[0]*1.055,b[1]*1.055,.56),(b[0],b[1],.66),(a[0],a[1],.66)],[(0,1,2,3)])
    mesh('water',[(6*math.cos(i*math.tau/N),5.7*math.sin(i*math.tau/N),.68),(a[0],a[1],.68),(b[0],b[1],.68),(6*math.cos(j*math.tau/N),5.7*math.sin(j*math.tau/N),.68)],[(0,1,2,3)])
cone('sand',(0,0,.61),6.55,6.2,.27,48);cone('grass_dark',(0,0,.81),6.2,5.75,.28,48)

def ribbon(points,width,k='path',height=.035):
    for j in range(len(points)-1):
        x,y=points[j];xx,yy=points[j+1];dx,dy=xx-x,yy-y;l=math.hypot(dx,dy)
        if l<.001:continue
        nx,ny=-dy/l*width/2,dx/l*width/2
        mesh(k,[(x+nx,y+ny,terrain(x,y)+height),(x-nx,y-ny,terrain(x,y)+height),(xx-nx,yy-ny,terrain(xx,yy)+height),(xx+nx,yy+ny,terrain(xx,yy)+height)],[(0,1,2,3)])
ring=[]
for i in range(145):
    a=i*math.tau/144;x,y=lake_ring(a);ring.append((x*1.23,y*1.28))
ribbon(ring,1.8,'path_edge',.02);ribbon(ring,1.45)
# Three paths between the ring, square, chapel and woodland.
for p,w in [([(0,-23),(0,-31),(7,-35),(18,-37),(29,-41)],2.2),([(-26,-1),(-34,-4),(-41,-10),(-48,-16)],1.6),([(17,18),(25,24),(30,31),(37,38),(42,47)],1.8),([(-15,19),(-19,27),(-27,33)],1.5),([(24,-6),(33,-9),(42,-12)],1.4)]:ribbon(p,w)
cone('path_edge',(0,-29,.57),5.8,5.8,.08,40);cone('path',(0,-29,.64),5.55,5.55,.06,40)

def flower(x,y,z,col=None,s=.22):
    col=col or random.choice(['flower_pink','flower_purple','flower_yellow','flower_white'])
    beam('stem',(x,y,z),(x+.02,y,z+.36),.025)
    ball(col,(x,y,z+.40),(s,s,s*.65),5,3)
    ball('flower_yellow',(x,y,z+.46),(s*.35,s*.35,s*.25),5,3)
def flowerbed(x,y,w,d,ang=0,col=None):
    box('earth',(x,y,terrain(x,y)+.055),(w,d,.09),ang)
    ca,sa=math.cos(ang),math.sin(ang)
    for i in range(max(7,int(w*d*4))):
        u,v=random.uniform(-w*.45,w*.45),random.uniform(-d*.43,d*.43)
        xx,yy=x+u*ca-v*sa,y+u*sa+v*ca
        flower(xx,yy,terrain(xx,yy)+.07,col,random.uniform(.14,.23))

def house(x,y,w,d,h,ang=0,wall='wall_cream',shutter='shutter_blue',ruin=False):
    z=terrain(x,y) if not ruin else .98;ca,sa=math.cos(ang),math.sin(ang)
    def pos(u,v,zz):return(x+u*ca-v*sa,y+u*sa+v*ca,z+zz)
    def cb(k,u,v,zz,ww,dd,hh):box(k,pos(u,v,zz),(ww,dd,hh),ang)
    cb('stone',0,0,.17,w+.22,d+.22,.34)
    cb('ruin' if ruin else wall,0,0,h/2+.3,w,d,h)
    cb('frame',0,0,h+.24,w+.14,d+.14,.14)
    peak=h+2.15;rz=h+.34;ww=w/2+.46;dd=d/2+.42
    mesh('roof_dark' if ruin else 'roof', [pos(-ww,-dd,rz),pos(ww,-dd,rz),pos(ww,dd,rz),pos(-ww,dd,rz),pos(0,-dd,peak),pos(0,dd,peak)],[(0,1,4),(3,5,2),(0,4,5,3),(4,1,2,5)])
    # Gable plaster triangles.
    mesh('ruin' if ruin else wall,[pos(-w/2,-d/2-.002,h+.25),pos(w/2,-d/2-.002,h+.25),pos(0,-d/2-.002,peak-.25),pos(-w/2,d/2+.002,h+.25),pos(w/2,d/2+.002,h+.25),pos(0,d/2+.002,peak-.25)],[(0,1,2),(3,5,4)])
    # Individually laid terracotta roof tiles, with gaps on the abandoned roof.
    for side in [-1,1]:
        for row in range(6):
            u=side*(row+.5)/6*ww;zz=peak-(row+.5)/6*(peak-rz)+.035
            for q in range(max(5,int(d*1.1))):
                if ruin and side==1 and row in [2,3,4] and q in [2,3]:continue
                v=-dd+(q+.5)*2*dd/max(5,int(d*1.1))
                # Thin ridges read as tiles at village scale.
                beam(random.choice(['roof','roof_light','roof_dark']),pos(u,v-.33,zz),pos(u,v+.33,zz),.055)
    cb('stone_light',w*.27,d*.20,h+1.15,.55,.60,2.0);cb('roof_dark',w*.27,d*.20,h+2.2,.73,.76,.15)
    # Front door and stone steps.
    cb('wood_old' if ruin else 'wood',0,-d/2-.025,1.2,.95,.09,1.80)
    cb('frame',-.57,-d/2-.085,1.2,.13,.12,1.99);cb('frame',.57,-d/2-.085,1.2,.13,.12,1.99);cb('frame',0,-d/2-.08,2.2,1.27,.13,.15)
    cb('stone_light',0,-d/2-.38,.22,1.5,.70,.16)
    cb('stone',0,-d/2-.72,.11,1.7,.56,.12)
    floors=[1.7,4.0] if h>4.3 else [1.7]
    for level in floors:
        for u in [-w*.28,w*.28]:
            cb('frame',u,-d/2-.035,level,1.05,.08,1.38);cb('glass',u,-d/2-.085,level,.83,.045,1.14)
            cb('frame',u,-d/2-.125,level,.055,.055,1.14);cb('frame',u,-d/2-.125,level,.83,.055,.06)
            for si in [-1,1]:
                cb('wood_old' if ruin else shutter,u+si*.66,-d/2-.09,level,.32,.13,1.36)
                for k in range(5):cb('wood' if ruin else shutter,u+si*.66,-d/2-.165,level-.5+k*.24,.33,.015,.035)
            if ruin:
                beam('wood_old',pos(u-.42,-d/2-.18,level-.42),pos(u+.40,-d/2-.18,level+.43),.10)
                beam('wood_old',pos(u-.42,-d/2-.20,level+.22),pos(u+.43,-d/2-.20,level+.14),.09)
            else:
                cb('pot',u,-d/2-.29,level-.80,1.24,.43,.27)
                for k in range(6):
                    xp,yp,zp=pos(u-.48+k*.19,-d/2-.31,level-.7)
                    ball('leaf',(xp,yp,zp),(.22,.22,.18),5,3);flower(xp,yp,zp,random.choice(['flower_red','flower_pink','flower_white']),.13)
        # Windows on both side walls make the village readable from every angle.
        for side in [-1,1]:
            for v in [-d*.23,d*.23]:
                cb('frame',side*(w/2+.035),v,level,.10,1.03,1.3)
                cb('glass',side*(w/2+.10),v,level,.06,.82,1.08)
                cb(shutter,side*(w/2+.11),v-.63,level,.13,.30,1.3);cb(shutter,side*(w/2+.11),v+.63,level,.13,.30,1.3)
    if not ruin:
        for side in [-1,1]:
            u=side*(w*.48+1.0);xx,yy,_=pos(u,0,0);flowerbed(xx,yy,1.25,d*.83,ang)
        # Climbing roses at one corner.
        for k in range(11):
            xx,yy,zz=pos(-w*.47+random.uniform(-.18,.18),-d/2-.22,random.uniform(.5,h*.9))
            ball('leaf',(xx,yy,zz),(.27,.24,.31),5,3)
            if k%2==0:ball('flower_pink',(xx,yy-.12,zz+.08),(.15,.14,.15),5,3)
    else:
        # Moss, cracked masonry, missing plaster and roof collapse.
        for k in range(38):
            xx,yy,zz=pos(random.uniform(-w/2,w/2),-d/2-.08,random.uniform(.35,h*.7))
            ball('moss',(xx,yy,zz),(.25,.07,.3),5,3)
        cb('glass',w*.26,0,h+1.0,w*.32,d*.48,.02)
        for k in range(5):beam('wood_old',pos(w*.10+k*.22,-d*.19,h+.74),pos(w*.10+k*.22,d*.19,h+.74),.065)
        for k in range(18):
            xx,yy,_=pos(random.uniform(-w*.7,w*.7),random.uniform(-d*.7,d*.7),0)
            if abs(xx-x)>w/2 or abs(yy-y)>d/2:ball('stone',(xx,yy,z+.10),(.22,.22,.13),5,3)
    return pos

# Village quarters, oriented toward the lake and connected to its promenade.
houses=[(-14,-28,4.5,5.0,4.8,-.28),(-22,-23,4.4,4.7,3.4,-.7),(-30,-15,4.8,4.6,4.7,-1.0),(-33,-5,4.1,4.8,3.4,-1.38),(-34,5,4.3,5.2,4.6,-1.7),(-28,17,5.1,5.0,3.6,-2.1),(-20,26,4.3,4.8,4.6,-2.55),(-9,29,4.7,5.0,3.6,-2.85),(4,30,4.4,4.7,4.8,3.03),(16,28,4.7,5.0,3.6,2.72),(28,20,4.6,4.5,4.8,2.2),(33,9,4.5,5.2,3.5,1.85),(32,-4,4.7,4.9,4.7,1.42),(28,-17,4.6,4.5,3.4,1.0),(20,-26,4.8,4.8,4.8,.62),(11,-32,4.8,5,3.5,.32),(-7,-37,4.4,4.7,4.8,-.05),(-17,-36,4.4,4.5,3.4,-.15),(5,-40,4.2,4.6,4.4,.02),(24,-35,4.0,4.8,3.5,.35)]
wallcolors=['wall_cream','wall_white','wall_peach','wall_gold','wall_pink'];shutters=['shutter_blue','shutter_sage','shutter_red']
for i,(x,y,w,d,h,a) in enumerate(houses):
    house(x,y,w,d,h,a,wallcolors[i%5],shutters[i%3])
    r=math.sqrt((x/21.5)**2+(y/17.8)**2);to=(x/r*1.25,y/r*1.28)
    fx=x+math.sin(a)*(d/2+1.2);fy=y-math.cos(a)*(d/2+1.2)
    if y>-34:ribbon([(fx,fy),to],1.10)

# Boulangerie terrace, awning and café chairs by the village square.
box('awnings',(-6.8,-34.7,3.2),(4.3,2.0,.13))
for x in [-8.8,-4.8]:beam('wood_light',(x,-35.5,.6),(x,-35.5,3.2),.075)
for x,y in [(-7,-32.9),(6,-29),(3.6,-32),(-3.5,-32)]:
    z=terrain(x,y);cone('wood_light',(x,y,z+1.03),.72,.72,.10,12);cone('iron',(x,y,z+.51),.05,.05,.98,6)
    for a in [0,2.1,4.2]:
        xx,yy=x+1.05*math.cos(a),y+1.05*math.sin(a);box('wood_light',(xx,yy,z+.57),(.47,.47,.08),a);box('wood',(xx,yy,z+.91),(.50,.08,.61),a)
        for dx in [-.18,.18]:beam('iron',(xx+dx,yy,z),(xx+dx,yy,z+.56),.035)
# Central fountain in the square.
cone('stone_light',(0,-28.7,.78),1.65,1.65,.34,24);cone('stone',(0,-28.7,1.06),1.47,1.47,.18,24);cone('water',(0,-28.7,1.17),1.28,1.28,.025,24)
cone('stone_light',(0,-28.7,1.7),.23,.18,1.2,10);cone('stone_light',(0,-28.7,2.3),.75,.82,.16,18);ball('stone_light',(0,-28.7,2.62),(.22,.22,.30),8,5)
for k in range(9):a=k*math.tau/9;flowerbed(4.7*math.cos(a),-28.7+4.7*math.sin(a),1.2,.55,a+math.pi/2)

# A small Romanesque chapel above the eastern village.
pos=house(31,31,5.2,8.3,5.8,2.3,'wall_white','shutter_sage')
box('stone_light',(27,31,4.3),(2.8,2.8,7.5));cone('roof_dark',(27,31,9.0),2.15,0,3.0,4)
for dx,dy in [(0,-1.43),(0,1.43),(-1.43,0),(1.43,0)]:box('glass',(27+dx,31+dy,6.3),(.72 if dx==0 else .09,.09 if dx==0 else .72,1.50))
beam('iron',(27,31,10.45),(27,31,11.8),.06);beam('iron',(26.65,31,11.35),(27.35,31,11.35),.06)

# The abandoned maison, on its own overgrown island.
house(0,.1,5.5,5.8,5.4,.08,'ruin','wood_old',True)
box('stone',(3.35,1.2,2.4),(1.4,2.4,3.0),.08)
for x,y in [(-4,-2.8),(3.7,-3.2),(-3.9,3.2),(4,2.9)]:
    for k in range(8):ball('moss',(x+random.uniform(-.6,.6),y+random.uniform(-.6,.6),1.12),(.4,.4,.28),6,3)
# Narrow plank bridge from the island to the south shore.
for i in range(53):
    y=-4.3-i*.30;box('wood_old',(0,y,1.02),(1.9,.24,.12),random.uniform(-.012,.012))
for x in [-.83,.83]:
    beam('wood',(x,-4.5,.84),(x,-20,.84),.13)
    for i in range(9):
        y=-4.6-i*1.91;beam('wood_old',(x,y,.50),(x,y,1.94),.07)
    # One broken section of railing reinforces abandonment.
    for i in range(8):
        if x>.0 and i==2:continue
        beam('wood_old',(x,-4.6-i*1.91,1.83),(x,-4.6-(i+1)*1.91,1.83),.05)
ribbon([(0,-20),(0,-23),(0,-26)],1.5)

# Lakeside jetty, rowing boat, benches and lanterns.
for i in range(12):box('wood_light',(18.4,-9.2+i*.27,.92),(2.6,.21,.13),-.4)
for x,y in [(17.1,-9.5),(19.6,-9.5),(17.1,-6.5),(19.6,-6.5)]:cone('wood',(x,y,.6),.10,.10,1.7,6)
# Boat hull with pointed ends.
mesh('wood_light',[(15.5,-8,.81),(16.2,-9.4,.81),(16.8,-8,.81),(16.2,-6.6,.81),(16.2,-8,.53)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)])
box('wood',(16.2,-8,.84),(1.1,.28,.08));beam('wood_light',(15.1,-8.5,.90),(17.5,-7.2,.9),.045)
for a in [-2.5,-1.3,-.3,.8,1.8,2.8]:
    x,y=lake_ring(a);x*=1.13;y*=1.17;z=terrain(x,y)
    box('wood_light',(x,y,z+.65),(2.0,.6,.13),a);box('wood',(x+.15*math.cos(a),y+.15*math.sin(a),z+1.08),(2,.12,.65),a)
    for u in [-.7,.7]:box('iron',(x+u*math.cos(a),y+u*math.sin(a),z+.30),(.11,.4,.6),a)
for i in range(17):
    a=i*math.tau/17;x,y=lake_ring(a);x*=1.30;y*=1.34;z=terrain(x,y)
    cone('iron',(x,y,z+1.1),.055,.055,2.2,6);box('iron',(x,y,z+2.28),(.43,.43,.60));box('flower_yellow',(x,y,z+2.28),(.32,.32,.46));cone('iron',(x,y,z+2.71),.38,0,.35,4)

def tree(x,y,scale=1,pine=False):
    z=terrain(x,y);h=random.uniform(4.4,7)*scale
    cone('trunk',(x,y,z+h*.42),.24*scale,.12*scale,h*.84,7)
    if pine:
        for j in range(3):cone('pine' if j<2 else 'leaf_dark',(x,y,z+h*(.50+j*.20)),(1.55-j*.36)*scale,.06,(2.8-j*.36)*scale,7)
    else:
        cols=['leaf','leaf_light','leaf_dark','leaf_silver']
        for j in range(5):
            a=j*2.39;r=.64*scale;xx,yy=x+math.cos(a)*r,y+math.sin(a)*r
            ball(random.choice(cols),(xx,yy,z+h*.73+random.uniform(-.7,.8)*scale),(random.uniform(1.25,1.65)*scale,random.uniform(1.22,1.58)*scale,random.uniform(1.6,2.2)*scale),7,5)
    return h
# Dense woodland frames the whole inhabited clearing, rather than hiding its buildings.
for i in range(340):
    a=random.uniform(0,math.tau);r=random.uniform(40.5,56.5);x,y=r*math.cos(a),r*math.sin(a)
    if math.hypot(x-31,y-31)<9:continue
    if (x>25 and -45<y<-35) or (abs(x-y)<2 and x>36):continue
    tree(x,y,random.uniform(.69,1.18),random.random()<.30)
for x,y in [(-38,-24),(-24,-30),(-10,-23),(10,-23),(24,-22),(-31,10),(-22,22),(23,20),(-11,23),(8,23)]:tree(x,y,.64)

# Garden hedges, lavender rows and meadow flowers.
for x,y,w,d,h,a in houses:
    for k in range(8):
        xx=x-w*.6+k*w*.17;yy=y+d*.7
        ball('leaf',(xx,yy,terrain(xx,yy)+.6),(.53,.47,.54),7,4)
for cx,cy in [(-22,-39),(17,-38),(36,-21),(-35,21),(10,36)]:
    for row in range(4):
        for k in range(14):
            x=cx+(k-7)*.35;y=cy+(row-1.5)*.56
            ball('leaf',(x,y,terrain(x,y)+.2),(.19,.21,.17),5,3);ball('lavender',(x,y,terrain(x,y)+.52),(.13,.13,.29),5,3)
for i in range(640):
    x,y=random.uniform(-40,40),random.uniform(-40,40)
    r=math.sqrt((x/21.5)**2+(y/17.8)**2)
    if r<1.50 or math.hypot(x,y)>40:continue
    if any(abs(x-h[0])<h[2]/2+1 and abs(y-h[1])<h[3]/2+1 for h in houses):continue
    flower(x,y,terrain(x,y),None,random.uniform(.10,.20))
# Reed beds and lily pads sit just inside the shoreline.
for i in range(120):
    a=random.uniform(0,math.tau)
    if -1.75<a<-1.40:continue
    x,y=lake_ring(a);rr=random.uniform(.93,.986);x*=rr;y*=rr
    for j in range(3):beam('stem',(x+j*.08,y,.70),(x+j*.08+random.uniform(-.2,.2),y,random.uniform(1.15,1.75)),.022)
for i in range(30):
    a=random.uniform(0,math.tau);x,y=lake_ring(a);x*=random.uniform(.73,.88);y*=random.uniform(.73,.88)
    cone('leaf',(x,y,.71),.26,.26,.018,8)
    if i%3==0:ball('flower_white',(x+.06,y,.79),(.11,.11,.10),5,3)
for i in range(42):
    a=random.uniform(0,math.tau);x,y=lake_ring(a);x*=1.05;y*=1.05;ball('stone',(x,y,.72),(.35,.28,.18),7,4)

# One material-batched mesh per material keeps the browser scene responsive.
for name,(verts,faces) in B.items():
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.materials.append(M[name]);data.update()
    obj=bpy.data.objects.new('Lake surface' if name=='water' else name,data);bpy.context.collection.objects.link(obj)
    if name.startswith('leaf') or name in ['water','stone','grass_dark','grass_light']:
        for p in data.polygons:p.use_smooth=True
world=bpy.context.scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.65,.78,.79,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
bpy.ops.object.light_add(type='SUN',location=(-35,-40,55));bpy.context.object.rotation_euler=(.38,-.55,-.45);bpy.context.object.data.energy=2.4;bpy.context.object.data.angle=.13
bpy.ops.object.camera_add(location=(77,-85,72));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=126;bpy.context.scene.camera=cam
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.eevee.use_gtao=True;scene.eevee.gtao_distance=3;scene.eevee.gtao_factor=1.25;scene.render.resolution_x=1600;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard';scene.view_settings.look='Medium High Contrast';scene.view_settings.exposure=0;scene.view_settings.gamma=1
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'lac-des-fleurs.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'landscape.glb'),export_format='GLB',export_cameras=False,export_lights=False,export_yup=True)
print('LANDSCAPE_READY',len(B),'materials',sum(len(v[0]) for v in B.values()),'vertices')
