import bpy, math, os, json, sys
from mathutils import Vector
from math import sin, cos, pi, exp, sqrt
ROOT=os.path.dirname(os.path.abspath(__file__))
OUT=os.path.join(ROOT,'renders')
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for d in list(bpy.data.collections):
    if d.name!='Collection': bpy.data.collections.remove(d)
base=bpy.data.collections.get('Collection'); base.name='01 | Airframe'
COL={}
for name in ['01 | Airframe','02 | Cockpit','03 | Intakes & exhausts','04 | Surface details','05 | Landing gear','06 | Reference images','07 | Studio']:
    c=bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in bpy.context.scene.collection.children: bpy.context.scene.collection.children.link(c)
    COL[name]=c
CUR=COL['01 | Airframe']
def move(o):
    for c in list(o.users_collection): c.objects.unlink(o)
    CUR.objects.link(o); return o

def mat(name,col,metal=0,rough=.5):
    m=bpy.data.materials.new(name); m.diffuse_color=(*col,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*col,1); p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    return m
skin=mat('Coating | blue graphite grey',(.125,.16,.18),.30,.48)
# Subtle paint breakup, visible only near the surface.
p=skin.node_tree.nodes.get('Principled BSDF'); n=skin.node_tree.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value=145; n.inputs['Detail'].default_value=2
b=skin.node_tree.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value=.12; b.inputs['Distance'].default_value=.012; skin.node_tree.links.new(n.outputs['Fac'],b.inputs['Height']); skin.node_tree.links.new(b.outputs['Normal'],p.inputs['Normal'])
edge=mat('Leading edge | RAM grey',(.18,.225,.25),.26,.51)
panel=mat('Control surfaces | muted graphite',(.105,.139,.16),.28,.53)
seam=mat('Panel gaps | charcoal',(.045,.057,.062),.12,.68)
black=mat('Intake and exhaust interiors',(.009,.013,.016),.12,.75)
metal=mat('Titanium | exhaust petals',(.21,.205,.19),.82,.35)
metalDark=mat('Heat stained titanium',(.10,.115,.12),.7,.42)
chrome=mat('Gear | polished steel',(.49,.55,.59),.85,.2)
gearpaint=mat('Gear | light grey',(.51,.57,.58),.48,.4)
rubber=mat('Tires',(.012,.015,.017),.02,.86)
white=mat('Faded stencils',(.49,.54,.55),.1,.65)
glass=mat('Canopy | smoked bronze',(.027,.043,.045),.53,.21)
glass.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight' if 'Coat Weight' in glass.node_tree.nodes.get('Principled BSDF').inputs else 'Clearcoat'].default_value=.65
sensor=mat('Optical windows',(.052,.14,.135),.7,.16)
red=mat('Port navigation light',(.30,.004,.003),.4,.22)
green=mat('Starboard navigation light',(.004,.20,.095),.4,.22)

def mesh(name,v,f,m,smooth=False):
    d=bpy.data.meshes.new(name); d.from_pydata(v,[],f); d.update(); o=bpy.data.objects.new(name,d); CUR.objects.link(o); o.data.materials.append(m)
    if smooth:
        for p in d.polygons:p.use_smooth=True
    return o

def curve(name,pts,m=seam,r=.012,closed=False):
    d=bpy.data.curves.new(name,'CURVE'); d.dimensions='3D'; d.resolution_u=1; d.bevel_depth=r; d.bevel_resolution=2
    s=d.splines.new('POLY'); s.points.add(len(pts)-1)
    for p,co in zip(s.points,pts):p.co=(*co,1)
    s.use_cyclic_u=closed; o=bpy.data.objects.new(name,d); CUR.objects.link(o); o.data.materials.append(m); return o

def cube(name,loc,scale,m,bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=move(bpy.context.object); o.name=name; o.dimensions=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
    if bevel:
        q=o.modifiers.new('Manufactured edge radius','BEVEL'); q.width=bevel;q.segments=3
        o.data.use_auto_smooth=True; o.modifiers.new('Corner normals','WEIGHTED_NORMAL')
    return o

def rod(name,a,b,r,m,verts=16):
    d=Vector(b)-Vector(a); bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=d.length,location=(Vector(a)+Vector(b))/2);o=move(bpy.context.object);o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(m)
    for p in o.data.polygons:p.use_smooth=True
    return o

def uv(name,loc,scale,m):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=loc);o=move(bpy.context.object);o.name=name;o.scale=scale;o.data.materials.append(m)
    for p in o.data.polygons:p.use_smooth=True
    return o

def lerp_table(a,table):
    for i in range(len(table)-1):
        x,v=table[i]; xx,vv=table[i+1]
        if a<=xx:return v+(vv-v)*max(0,min(1,(a-x)/(xx-x)))
    return table[-1][1]
SPAN=11.6
LE=[(0,-14),(4.55,-2.5),(11.6,7.95)]
TE=[(0,11.35),(.65,11.62),(1.05,11.32),(1.75,11.85),(2.4,11.55),(3.25,11.75),(11.6,8.12)]
def bounds(x):return lerp_table(abs(x),LE),lerp_table(abs(x),TE)
def surf(x,y,upper=True):
    ax=abs(x); le,te=bounds(x); t=max(0,min(1,(y-le)/max(.001,te-le)))
    chord=max(0,sin(pi*t))**.53
    wing=.145*chord*(1-.64*(ax/SPAN)**1.2)
    body=.86*exp(-(ax/2.28)**2)*exp(-((y+1)/13.5)**4)*chord
    aft=max(0,min(1,(y-1)/5))
    ridges=sum(.33*exp(-((x-e)/.83)**4) for e in [-1.65,0,1.65])*aft*chord
    z=.06+wing+body+ridges
    if not upper:z=-.06-wing-.48*exp(-(ax/2.6)**4)*chord-.12*aft*exp(-(ax/3)**4)*chord
    return z

# Watertight lenticular mesh with the traced cranked-delta outline.
NX=200; NY=160; v=[]
for upper in [True,False]:
    for i in range(NX+1):
        x=-SPAN+2*SPAN*i/NX;le,te=bounds(x)
        for j in range(NY+1):
            y=le+(te-le)*j/NY;v.append((x,y,surf(x,y,upper)))
f=[];n=(NX+1)*(NY+1)
for side in range(2):
    off=side*n
    for i in range(NX):
        for j in range(NY):
            a=off+i*(NY+1)+j;face=(a,a+NY+1,a+NY+2,a+1);f.append(face if side==0 else face[::-1])
for i in range(NX):
    a=i*(NY+1);bb=(i+1)*(NY+1);f.append((a,a+n,bb+n,bb))
    a+=NY;bb+=NY;f.append((bb,bb+n,a+n,a))
for i in [0,NX]:
    for j in range(NY):
        a=i*(NY+1)+j;f.append((a,a+1,a+1+n,a+n) if i==NX else (a+n,a+1+n,a+1,a))
airframe=mesh('J-36 | continuous blended delta airframe',v,f,skin,True)
airframe['reference_basis']='Supplied schematic planform and underside image; visual reconstruction, dimensions nominal.'

CUR=COL['04 | Surface details']
def surface_line(name,xy,upper=True,m=seam,r=.01,closed=False):
    pts=[]
    pairs=list(zip(xy,xy[1:]+([xy[0]] if closed else [])))
    for (x,y),(xx,yy) in pairs:
        dist=math.hypot(xx-x,yy-y);num=max(2,int(dist*14))
        for i in range(num):
            t=i/num;px=x+(xx-x)*t;py=y+(yy-y)*t;pts.append((px,py,surf(px,py,upper)+(.014 if upper else -.014)))
    if not closed:
        px,py=xy[-1];pts.append((px,py,surf(px,py,upper)+(.014 if upper else -.014)))
    return curve(name,pts,m,r,closed)

def patch(name,xy,m,upper=True):
    # Fan of densely interpolated strips keeps panels conformal to the airframe.
    cx=sum(p[0] for p in xy)/len(xy);cy=sum(p[1] for p in xy)/len(xy);vs=[(cx,cy,surf(cx,cy,upper)+(.009 if upper else -.009))];fs=[]
    ring=[]
    for a,b in zip(xy,xy[1:]+xy[:1]):
        for k in range(15):ring.append((a[0]+(b[0]-a[0])*k/15,a[1]+(b[1]-a[1])*k/15))
    for k in range(1,14):
        t=k/13
        for x,y in ring:
            px=cx+(x-cx)*t;py=cy+(y-cy)*t;vs.append((px,py,surf(px,py,upper)+(.012 if upper else -.012)))
    L=len(ring)
    for k in range(L):fs.append((0,1+k,1+(k+1)%L))
    for j in range(12):
        for k in range(L):a=1+j*L+k;b=1+j*L+(k+1)%L;fs.append((a,a+L,b+L,b))
    return mesh(name,vs,fs,m,True)

for upper in [True,False]:
    for s in [-1,1]:
        # Narrow radar-absorbent leading-edge band.
        poly=[(s*.04,-13.8),(s*4.55,-2.5),(s*11.52,7.94),(s*11.29,8.00),(s*4.40,-2.15),(s*.12,-13.3)]
        patch('Leading edge coating '+str((s,upper)),poly,edge,upper)
        surface_line('Leading-edge panel boundary',[(s*.12,-13.3),(s*4.40,-2.15),(s*11.29,8.00)],upper,r=.012)
        # Three aft control surfaces per side, traced to the swept trailing edge.
        for k,(a,b) in enumerate([(3.15,5.95),(6.03,8.65),(8.73,11.35)]):
            ay=bounds(a)[1];by=bounds(b)[1]
            poly=[(s*a,ay-.12),(s*b,by-.12),(s*b,by-1.10),(s*a,ay-1.32)]
            patch('Elevon %d %s %s'%(k,s,upper),poly,panel,upper);surface_line('Elevon gap',poly,upper,r=.018,closed=True)
            for x in [a+.22,b-.22]:
                y=bounds(x)[1]-.77
                if upper:uv('Control actuator fairing',(s*x,y,surf(s*x,y)+.045),(.115,.58,.10),skin)
        surface_line('Wing structural panel',[(s*3.0,8.9),(s*3.3,-.8),(s*4.40,-2.15)],upper,r=.011)
        surface_line('Wing aft spar',[(s*3.0,7.4),(s*10.55,7.1)],upper,r=.009)
        surface_line('Wing outer panel',[(s*6.2,.15),(s*5.95,10.35)],upper,r=.008)
        # Aft engine shroud panel lines.
        surface_line('Outer nacelle boundary',[(s*2.3,-1.9),(s*2.6,4),(s*2.75,10.6)],upper,r=.013)
        for y in [3.5,7.25]:surface_line('Nacelle cross seam',[(0,y),(s*2.60,y+.2)],upper,r=.011)
    surface_line('Radome seam',[(-1.28,-10.7),(0,-10.7),(1.28,-10.7)],upper,r=.013)
    surface_line('Forebody equipment seam',[(-2.35,-7.8),(0,-7.8),(2.35,-7.8)],upper,r=.011)

# Small flush access hatches and fasteners.
for s in [-1,1]:
    for x,y in [(3.7,3.4),(4.9,5.7),(2.35,-6.8),(1.4,8.4)]:
        xx=s*x;poly=[(xx-.15,y-.25),(xx+.15,y-.25),(xx+.19,y+.17),(xx-.18,y+.22)]
        surface_line('Flush service hatch',poly,True,r=.008,closed=True)
        for dx,dy in [(-.12,-.20),(.12,-.20),(.12,.13),(-.12,.13)]:
            uv('Captive panel fastener',(xx+dx,y+dy,surf(xx+dx,y+dy)+.017),(.014,.014,.006),metalDark)
    for y in [5.2,7.7]:
        poly=[(s*.85,y-.16),(s*1.03,y),(s*.85,y+.16),(s*.67,y)]
        patch('Ventral antenna',poly,metalDark,False)

# Angular raised cockpit, dark glazing and transverse frame.
CUR=COL['02 | Cockpit']
sections=[(-10.15,.05,0),(-9.92,.50,.24),(-9.5,.83,.49),(-9.0,1.08,.68),(-8.35,1.13,.72),(-7.7,1.06,.60),(-7.3,.88,.36),(-7.13,.52,.05),(-7.11,.03,0)]
verts=[];faces=[];N=32
for y,w,h in sections:
    for j in range(N+1):
        theta=pi*j/N;x=-w*cos(theta);z=surf(x,y)+.045+h*sin(theta)**.68;verts.append((x,y,z))
for i in range(len(sections)-1):
    for j in range(N):a=i*(N+1)+j;faces.append((a,a+1,a+N+2,a+N+1))
can=mesh('Smoked cockpit canopy',verts,faces,glass,True)
for s in [-1,1]:
    curve('Canopy perimeter seal',[(s*w,y,surf(s*w,y)+.052) for y,w,h in sections],seam,.048)
    curve('Canopy perimeter frame',[(s*w,y,surf(s*w,y)+.072) for y,w,h in sections],skin,.028)
# A restrained bow follows the actual bubble contour.
y,w,h=sections[3]
curve('Forward canopy bow',[(-w*cos(pi*j/40),y,surf(-w*cos(pi*j/40),y)+.054+h*sin(pi*j/40)**.68) for j in range(41)],skin,.022)
# Side electro-optical windows.
CUR=COL['04 | Surface details']
for s in [-1,1]:
    patch('Conformal optical aperture',[(s*.40,-12.0),(s*.63,-11.7),(s*.78,-11.25),(s*.49,-11.4)],sensor,True)
    patch('Chine optical aperture',[(s*1.6,-9.7),(s*1.9,-9.2),(s*1.76,-8.97),(s*1.5,-9.45)],sensor,False)

CUR=COL['03 | Intakes & exhausts']
def duct(name,rings,m):
    vs=[p for ring in rings for p in ring];L=len(rings[0]);fs=[]
    for k in range(len(rings)-1):
        for j in range(L):a=k*L+j;b=k*L+(j+1)%L;fs.append((a,b,b+L,a+L))
    o=mesh(name,vs,fs,m,True);o.data.use_auto_smooth=True;o.data.auto_smooth_angle=math.radians(35);return o
# Smooth conformal dorsal scoop, open at its forward arch.
vv=[];ff=[];NW=48;NL=80
for i in range(NL+1):
    t=i/NL;y=-2.25+8.05*t;w=1.30-.20*t
    h=.57*(1-t)**1.45
    for j in range(NW+1):
        u=-1+2*j/NW;x=w*u
        z=surf(x,y)+.007+h*max(0,cos(pi*u/2))**.70
        vv.append((x,y+.12*abs(u)*(1-t),z))
for i in range(NL):
    for j in range(NW):
        a=i*(NW+1)+j;ff.append((a,a+1,a+NW+2,a+NW+1))
mesh('Dorsal intake | blended curved shroud',vv,ff,skin,True)
arch=vv[:NW+1]
curve('Dorsal intake | rolled leading lip',arch,edge,.028)
inner=[(x*.92,y+.045,surf(x*.92,y+.045)+max(.018,(z-surf(x,y))*.86)) for x,y,z in arch]
deep=[(x*.86,y+.38,z-.018) for x,y,z in inner]
duct('Dorsal intake | recessed arch walls',[inner,deep],metalDark)
mesh('Dorsal intake | shadowed throat',deep,[tuple(range(len(deep)))],black)
# Side intake shells have trapezoid mouths, recessed throats and chin lips.
for s in [-1,1]:
    ring=[(s*1.52,-5.95,-.36),(s*2.15,-5.75,-.30),(s*2.90,-4.68,-.37),(s*2.55,-4.90,-1.00),(s*1.75,-5.78,-.99)]
    aft=[(s*1.54,-2.00,-.39),(s*2.35,-1.9,-.40),(s*3.00,-1.75,-.17),(s*2.65,-1.75,-.54),(s*1.7,-1.90,-.61)]
    duct('Side intake fairing '+str(s),[ring,aft],skin)
    center=sum((Vector(p) for p in ring),Vector())/len(ring)
    inner=[tuple(center+(Vector(p)-center)*.87+Vector((0,.08,0))) for p in ring]
    deep=[(x,y+1.1,z+.06) for x,y,z in inner]
    duct('Side intake tunnel '+str(s),[inner,deep],metalDark);mesh('Side intake dark recess '+str(s),deep,[tuple(range(5))],black)
    curve('Side intake rim '+str(s),ring,edge,.045,True)
    uv('Diverterless intake shoulder '+str(s),(s*1.70,-4.20,.26),(.45,1.04,.28),skin)

# Three visible exhaust troughs, petal rings and deeply recessed centers.
for idx,x in enumerate([-1.65,0,1.65]):
    y=11.3 if idx!=1 else 11.02;z=.23
    rings=[]
    for yy,rx,rz in [(y-1,.68,.48),(y-.18,.65,.44),(y+.26,.71,.39)]:
        rings.append([(x+rx*cos(2*pi*j/48),yy,z+rz*sin(2*pi*j/48)) for j in range(48)])
    duct('Engine %d | nozzle casing'%(idx+1),rings,metalDark)
    inner=[(x+.53*cos(2*pi*j/48),y+.08,z+.30*sin(2*pi*j/48)) for j in range(48)]
    rear=[(x+.49*cos(2*pi*j/48),y-.7,z+.28*sin(2*pi*j/48)) for j in range(48)]
    duct('Engine %d | nozzle inside'%(idx+1),[inner,rear],black);mesh('Engine core darkness',rear,[tuple(range(48))],black)
    for j in range(24):
        a=2*pi*j/24+.014;bb=2*pi*(j+1)/24-.014
        vv=[(x+.655*cos(a),y-.26,z+.445*sin(a)),(x+.655*cos(bb),y-.26,z+.445*sin(bb)),(x+.71*cos(bb),y+.27,z+.39*sin(bb)),(x+.71*cos(a),y+.27,z+.39*sin(a))]
        mesh('Engine %d | petal %02d'%(idx+1,j+1),vv,[(0,1,2,3)],metal if j%3 else metalDark)
    for s in [-1,1]:
        mesh('Exhaust trough heat shield',[(x+s*.70,y-.5,-.14),(x+s*.90,y+.9,-.11),(x+s*.34,y+.96,-.25),(x+s*.28,y-.5,-.25)],[(0,1,2,3)],metalDark)

# Closed ventral bay outlines, taken from the supplied underside view.
CUR=COL['04 | Surface details']
for s in [-1,1]:
    poly=[(s*.08,-5.8),(s*.66,-5.8),(s*.89,-5.36),(s*.89,2.2),(s*.68,2.58),(s*.08,2.58)]
    patch('Ventral main bay door '+str(s),poly,skin,False);surface_line('Main bay sawtooth seal',poly,False,r=.022,closed=True)
    poly=[(s*1.00,-5.2),(s*1.43,-5.2),(s*1.62,-4.8),(s*1.62,1.7),(s*1.38,2.05),(s*1.0,2.05)]
    surface_line('Outboard ventral door seal',poly,False,r=.018,closed=True)
    for y in [-3.8,-.8,1.1]:surface_line('Recessed door hinge',[(s*.86,y),(s*1.0,y)],False,r=.026)

CUR=COL['05 | Landing gear']
def tire(name,x,y,z,r,w):
    # Tire body with rounded shoulders and a recessed alloy hub.
    profile=[(-w/2,.68*r),(-w*.49,.83*r),(-w*.34,.98*r),(w*.34,.98*r),(w*.49,.83*r),(w/2,.68*r)]
    vv=[];ff=[];N=56
    for dx,rad in profile:
        for j in range(N):a=j*2*pi/N;vv.append((x+dx,y+rad*sin(a),z+rad*cos(a)))
    for k in range(len(profile)-1):
        for j in range(N):a=k*N+j;b=k*N+(j+1)%N;ff.append((a,b,b+N,a+N))
    mesh(name+' | tire',vv,ff,rubber,True)
    rod(name+' | wheel rim',(x-w*.5,y,z),(x+w*.5,y,z),r*.59,gearpaint,40)
    for s in [-1,1]:
        rod(name+' | recessed hub',(x+s*w*.501,y,z),(x+s*w*.52,y,z),r*.40,metalDark,32)
        rod(name+' | axle cap',(x+s*w*.52,y,z),(x+s*w*.54,y,z),r*.19,chrome,24)
        for j in range(8):
            a=j*2*pi/8;yy=y+.28*r*sin(a);zz=z+.28*r*cos(a)
            rod(name+' | hub bolt',(x+s*w*.53,yy,zz),(x+s*w*.55,yy,zz),.027,chrome,8)
    for dx in [-w*.19,0,w*.19]:
        curve(name+' | tread groove',[(x+dx,y+r*.982*sin(j*2*pi/96),z+r*.982*cos(j*2*pi/96)) for j in range(96)],seam,.009,True)

for s in [-1,1]:
    x=s*2.05
    patch('Main gear well shadow '+str(s),[(x-.46,-1.8),(x+.46,-1.8),(x+.46,2.3),(x-.46,2.3)],black,False)
    rod('Main gear shock upper',(x,.18,-.45),(x,.40,-1.42),.115,gearpaint)
    rod('Main gear polished piston',(x,.40,-1.35),(x,.55,-2.15),.074,chrome)
    rod('Main gear tandem bogie',(x,-.36,-2.13),(x,1.32,-2.13),.11,gearpaint)
    rod('Main gear drag brace',(x,-1.32,-.45),(x,.42,-1.67),.055,chrome)
    rod('Main gear diagonal stay',(x+s*.6,1.10,-.30),(x,.42,-1.56),.060,gearpaint)
    curve('Main gear hydraulic hose',[(x+.13,.1,-.55),(x+.18,.26,-1.2),(x+.17,.48,-1.8),(x+.1,.95,-2.03)],black,.023)
    for y in [-.36,1.32]:tire('Main wheel '+str((s,y)),x,y,-2.10,.55,.35)
    door=cube('Main gear hanging door',(x+s*.51,.25,-1.10),(.06,3.78,1.10),skin,.045);door.rotation_euler[1]=s*.10
    for yy in [-1.1,.2,1.5]:cube('Gear door inner stiffener',(x+s*.47,yy,-1.08),(.05,.055,.84),gearpaint,.014)
# Nose twin wheels and forward angled oleo.
x=0;y=-9.1
patch('Nose well', [(-.4,-10.2),(.4,-10.2),(.4,-8.35),(-.4,-8.35)],black,False)
rod('Nose gear upper',(0,-8.70,-.34),(0,-9.03,-1.43),.085,gearpaint)
rod('Nose gear piston',(0,-9.03,-1.30),(0,-9.18,-2.19),.055,chrome)
rod('Nose gear brace',(0,-7.9,-.35),(0,-9.04,-1.65),.047,gearpaint)
rod('Nose wheel axle',(-.37,-9.18,-2.24),(.37,-9.18,-2.24),.065,chrome)
for s in [-1,1]:
    tire('Nose wheel '+str(s),s*.23,-9.18,-2.24,.41,.20)
    cube('Nose gear door',(s*.45,-9.26,-.86),(.045,1.87,.72),skin,.022)
curve('Nose gear torque link',[(.08,-9.02,-1.4),(.13,-9.36,-1.70),(.08,-9.16,-1.92)],gearpaint,.036)

# Quiet, low-visibility prototype markings.
CUR=COL['04 | Surface details']
def label(name,body,loc,size,rot=(0,0,0),m=white):
    d=bpy.data.curves.new(name,'FONT');d.body=body;d.size=size;d.align_x='CENTER';d.extrude=0;d.space_character=1.1
    o=bpy.data.objects.new(name,d);CUR.objects.link(o);o.location=loc;o.rotation_euler=rot;o.data.materials.append(m);return o
for s in [-1,1]:
    label('Prototype serial','36011',(s*4.9,4.7,surf(s*4.9,4.7)+.035),.25,rot=(0,0,pi))
    # Discrete monochrome wing star; visual marking only.
    xx=s*7.05;yy=5.75;pts=[]
    for j in range(10):
        a=pi/2+2*pi*j/10;r=.24 if j%2==0 else .105;px=xx+r*cos(a);py=yy+r*sin(a);pts.append((px,py))
    surface_line('Low visibility wing star',pts,True,white,.012,True)
    surface_line('Wing insignia bar',[(xx-.46,yy),(xx-.24,yy)],True,white,.018)
    surface_line('Wing insignia bar',[(xx+.24,yy),(xx+.46,yy)],True,white,.018)
    for y in [2.0,4.0]:
        label('Service stencil','NO STEP',(s*3.4,y,surf(s*3.4,y)+.031),.087,rot=(0,0,pi))
    uv('Navigation aperture',(s*11.34,8.02,.115),(.09,.07,.037),red if s==-1 else green)

# Reference plates are packed but hidden for presentation.
CUR=COL['06 | Reference images'];CUR.hide_render=True;CUR.hide_viewport=True
for filename,loc in [('J-36 Stealth Bomber 01.jpg',(0,0,-5)),('J-36 Stealth Bomber 02.png',(0,30,0))]:
    path=os.path.join(os.path.dirname(ROOT),'J-36 Stealth Bomber images',filename)
    im=bpy.data.images.load(path);im.pack();o=bpy.data.objects.new('REFERENCE | '+filename,None);CUR.objects.link(o);o.empty_display_type='IMAGE';o.data=im;o.empty_display_size=28;o.location=loc

CUR=COL['07 | Studio']
floor=mat('Studio | warm slate',(.075,.090,.105),.05,.68)
plane=cube('Studio floor',(0,0,-2.73),(200,200,.12),floor,0)
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.eevee.use_gtao=True;scene.eevee.gtao_distance=1.3;scene.eevee.gtao_factor=1.15;scene.eevee.use_soft_shadows=True;scene.eevee.taa_render_samples=128
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.20,.27,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5

def area(name,loc,power,size,col,target=(0,0,0)):
    bpy.ops.object.light_add(type='AREA',location=loc);o=move(bpy.context.object);o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=col;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
area('Key | broad softbox',(-12,-15,24),11500,16,(.86,.92,1))
area('Fill | warm',(17,-4,13),8500,13,(1,.87,.71))
area('Rim | aft',(2,18,19),14500,12,(.76,.87,1))
area('Nose fill',(0,-20,5),2700,8,(1,1,1))
area('Underside fill',(-12,-8,-10),5000,12,(.79,.86,1))
CAM={}
def camera(name,loc,target,ortho):
    bpy.ops.object.camera_add(location=loc);o=move(bpy.context.object);o.name=name;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();o.data.type='ORTHO';o.data.ortho_scale=ortho;o.data.lens=52;CAM[name]=o;return o
camera('01 | Front three-quarter',(30,-37,23),(0,-.2,-.1),34)
camera('02 | Top plan',(0,-1,45),(0,-1,0),38)
CAM['02 | Top plan'].rotation_euler[2]=pi
camera('03 | Rear three-quarter',(-29,34,17),(0,1,0),33)
camera('04 | Underside reference',(23,-34,-42),(0,-1,0),33)
camera('05 | Front elevation',(0,-42,3),(0,0,0),27)
scene.camera=CAM['01 | Front three-quarter'];scene.render.resolution_x=1440;scene.render.resolution_y=1120;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Filmic';scene.view_settings.look='Medium High Contrast';scene.view_settings.exposure=-.1;scene.view_settings.gamma=1
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.unit_settings.system='METRIC'
scene['Project']='J-36 visual reconstruction | Blender 3.6.23'
scene['Accuracy']='Photo-based exterior study. Nominal scale. Supplied illustration is not an authoritative technical drawing; hidden geometry is inferred. No percentage accuracy claimed.'
scene['Configuration']='Landing gear deployed; closed ventral doors; three cosmetic exhausts.'
# A clean opening viewport with the model selected and the studio helpers hidden.
for o in CUR.objects:
    if o.type in {'LIGHT','CAMERA'} or o==plane:o.hide_set(True)
bpy.ops.object.select_all(action='DESELECT');airframe.hide_set(False);airframe.select_set(True);bpy.context.view_layer.objects.active=airframe
for a in bpy.context.screen.areas:
    if a.type=='VIEW_3D':
        a.spaces.active.region_3d.view_distance=37;a.spaces.active.region_3d.view_location=(0,-1,0);a.spaces.active.region_3d.view_rotation=CAM['01 | Front three-quarter'].rotation_euler.to_quaternion();a.spaces.active.shading.type='MATERIAL';a.spaces.active.overlay.show_floor=False
readme=bpy.data.texts.new('READ ME | reference and model notes');readme.write('J-36 EXTERIOR VISUAL STUDY\nBlender 3.6.23\n\nBased on the two user-supplied images, packed in the reference collection.\nNominal 25.9 m length / 23.2 m span is a modeling scale, not a verified aircraft dimension.\nTailless cranked delta, three exhausts, dorsal and side intakes, smoked canopy,\nclosed ventral doors, twin nose wheels and tandem main wheels.\n\nCollections separate editable surface details, gear, cockpit and studio.\nReference collection is hidden by default. Choose one of the five named cameras.\nStudio lights are hidden only in the viewport; they remain enabled for rendering.\nNo engineering or performance properties are represented.\nA percentage of likeness cannot be established from two non-calibrated images.\n')
bpy.context.preferences.filepaths.save_version=0
blend=os.path.join(ROOT,'J36_Reference_Model.blend');bpy.ops.wm.save_as_mainfile(filepath=blend)
mode=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
views=['01 | Front three-quarter','02 | Top plan','03 | Rear three-quarter','04 | Underside reference'] if 'all' in mode else ['01 | Front three-quarter']
for name in views:
    scene.camera=CAM[name];plane.hide_render=('Underside' in name)
    scene.render.filepath=os.path.join(OUT,{'01 | Front three-quarter':'01_beauty','02 | Top plan':'02_top','03 | Rear three-quarter':'03_rear','04 | Underside reference':'04_underside'}[name]+'.png')
    bpy.ops.render.render(write_still=True)
scene.camera=CAM['01 | Front three-quarter'];plane.hide_render=False
bpy.ops.wm.save_as_mainfile(filepath=blend)
print('MODEL_COMPLETE '+blend)
