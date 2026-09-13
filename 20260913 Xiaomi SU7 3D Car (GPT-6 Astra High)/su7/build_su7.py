"""Photo-referenced first-generation Xiaomi SU7 Max. Blender 3.6.23.
Run: blender --background --python build_su7.py -- --draft
Units: metres. X points rearwards, Z upwards. Editable procedural source.
"""
import bpy, math, os, sys, json
from mathutils import Vector, Matrix
from math import sin, cos, pi, sqrt

ROOT = os.path.dirname(os.path.abspath(__file__))
RENDERS = os.path.join(ROOT, 'renders')
os.makedirs(RENDERS, exist_ok=True)
ARGS = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
DRAFT = '--draft' in ARGS
VERSION = '08'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):
    if c.name != 'Collection': bpy.data.collections.remove(c)
main = bpy.data.collections.get('Collection'); main.name = 'SU7 | BODY'
COL = main
def collection(name):
    global COL
    COL = bpy.data.collections.new(name); bpy.context.scene.collection.children.link(COL)
def link(obj):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    COL.objects.link(obj)
    return obj
def mat(name, color, metal=0, rough=.35, coat=0, transmission=0, emission=None):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    p.inputs['Clearcoat'].default_value=coat; p.inputs['Clearcoat Roughness'].default_value=.12
    p.inputs['Transmission'].default_value=transmission
    if emission:
        p.inputs['Emission'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=emission
    return m
paint=mat('AQUA BLUE | multilayer metallic clearcoat',(.005,.42,.53),.70,.27,.25)
p=paint.node_tree.nodes.get('Principled BSDF')
noise=paint.node_tree.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=1450; noise.inputs['Detail'].default_value=2
ramp=paint.node_tree.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].position=.2; ramp.color_ramp.elements[0].color=(.15,.15,.15,1); ramp.color_ramp.elements[1].position=.8; ramp.color_ramp.elements[1].color=(.29,.29,.29,1)
paint.node_tree.links.new(noise.outputs['Fac'],ramp.inputs[0]); paint.node_tree.links.new(ramp.outputs[0],p.inputs['Roughness'])
black=mat('Obsidian gloss | aero components',(.006,.009,.012),.10,.29,.22)
rubber=mat('Tire | carbon rubber',(.008,.010,.012),.0,.72)
n=rubber.node_tree.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value=220
b=rubber.node_tree.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value=.18;b.inputs['Distance'].default_value=.0015
rubber.node_tree.links.new(n.outputs['Fac'],b.inputs['Height']); rubber.node_tree.links.new(b.outputs['Normal'],rubber.node_tree.nodes.get('Principled BSDF').inputs['Normal'])
gap=mat('Panel gaps and cavities',(.004,.007,.009),.05,.5)
glass=mat('Tinted laminated glazing',(.007,.017,.029),.0,.16,.0,transmission=.0)
# Absorptive dark automotive tint; restrained, blue-tinted reflections.
gn=glass.node_tree.nodes;gl=glass.node_tree.links
gn.clear()
go=gn.new('ShaderNodeOutputMaterial');gd=gn.new('ShaderNodeBsdfDiffuse');gg=gn.new('ShaderNodeBsdfGlossy');gf=gn.new('ShaderNodeFresnel');gm=gn.new('ShaderNodeMixShader')
gd.inputs['Color'].default_value=(.008,.018,.031,1);gd.inputs['Roughness'].default_value=.25
gg.inputs['Color'].default_value=(.13,.20,.28,1);gg.inputs['Roughness'].default_value=.13;gf.inputs['IOR'].default_value=1.46
gl.new(gf.outputs[0],gm.inputs[0]);gl.new(gd.outputs[0],gm.inputs[1]);gl.new(gg.outputs[0],gm.inputs[2]);gl.new(gm.outputs[0],go.inputs['Surface'])
lampglass=mat('Smoked optical polycarbonate',(.006,.013,.020),.12,.18,.35)
silver=mat('Machined diamond-cut aluminum',(.49,.55,.60),.88,.25)
rotor=mat('Brushed iron brake discs',(.13,.15,.17),.75,.43)
yellow=mat('Performance caliper | yellow',(.95,.56,.008),.25,.3,.25)
white=mat('Ceramic white LED',(.76,.94,1.0),.05,.19,emission=2.2)
red=mat('Ruby red light guide',(.58,.008,.018),.25,.2,.5,emission=1.7)
red_dark=mat('Red rear optical housing',(.19,.003,.009),.3,.2,.4)
plate=mat('Satin white license plate',(.8,.84,.85),.25,.35)
leather=mat('Pale gray leather',(.31,.35,.37),.0,.58)

def mesh(name, verts, faces, material, smooth=True):
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    ob=bpy.data.objects.new(name,me); COL.objects.link(ob)
    if material: me.materials.append(material)
    for f in me.polygons: f.use_smooth=smooth
    return ob
def bevel(obj, amount=.006, segments=3):
    obj.data.use_auto_smooth=True
    m=obj.modifiers.new('Manufacturing edge radii','BEVEL'); m.width=amount;m.segments=segments
    m=obj.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return obj
def cube(name,loc,scale,material,rad=.01):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); ob=link(bpy.context.object);ob.name=name
    ob.dimensions=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    ob.data.materials.append(material)
    if rad: bevel(ob,rad,4)
    return ob
def uv(name,loc,scale,material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40,ring_count=20,location=loc);o=link(bpy.context.object);o.name=name;o.scale=scale;o.data.materials.append(material)
    for f in o.data.polygons: f.use_smooth=True
    return o
def curve(name,pts,material,r=.003,cyclic=False,bezier=False):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=16;c.bevel_depth=r;c.bevel_resolution=3
    if bezier:
        s=c.splines.new('BEZIER');s.bezier_points.add(len(pts)-1)
        for b,p in zip(s.bezier_points,pts):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
    else:
        s=c.splines.new('POLY');s.points.add(len(pts)-1)
        for b,p in zip(s.points,pts):b.co=(*p,1)
    s.use_cyclic_u=cyclic;o=bpy.data.objects.new(name,c);COL.objects.link(o);o.data.materials.append(material);return o
def cyl(name,loc,r,depth,material,axis='Y',vertices=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc)
    o=link(bpy.context.object);o.name=name
    if axis=='Y':o.rotation_euler[0]=pi/2
    if axis=='X':o.rotation_euler[1]=pi/2
    o.data.materials.append(material);bevel(o,.0018,2)
    for f in o.data.polygons:f.use_smooth=True
    return o
def torus(name,loc,major,minor,material):
    bpy.ops.mesh.primitive_torus_add(major_segments=96,minor_segments=12,location=loc,major_radius=major,minor_radius=minor,rotation=(pi/2,0,0))
    o=link(bpy.context.object);o.name=name;o.data.materials.append(material)
    for f in o.data.polygons:f.use_smooth=True
    return o
def textobj(name,body,loc,size,material,normal=(0,-1,0),right=(1,0,0),extrude=.0003):
    c=bpy.data.curves.new(name,'FONT');c.body=body;c.size=size;c.align_x='CENTER';c.align_y='CENTER';c.extrude=extrude;c.bevel_depth=.0001
    o=bpy.data.objects.new(name,c);COL.objects.link(o);o.location=loc
    r=Vector(right).normalized();n=Vector(normal).normalized();u=n.cross(r)
    o.rotation_euler=Matrix((r,u,n)).transposed().to_euler();c.materials.append(material);return o
def lerp(a,b,t):return a+(b-a)*t
def smooth_open_path(points,steps=24):
    out=[]
    for i in range(len(points)-1):
        p0=Vector(points[max(0,i-1)]);p1=Vector(points[i]);p2=Vector(points[i+1]);p3=Vector(points[min(len(points)-1,i+2)])
        for k in range(steps):
            t=k/steps
            out.append(tuple(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)))
    out.append(points[-1]);return out

def clamp(a):return max(0,min(1,a))
def smooth(t):t=clamp(t);return t*t*(3-2*t)
def sample(table,x):
    if x<=table[0][0]:return table[0][1]
    if x>=table[-1][0]:return table[-1][1]
    for i in range(len(table)-1):
        a,b=table[i],table[i+1]
        if a[0]<=x<=b[0]:
            t=(x-a[0])/(b[0]-a[0])
            m0=(b[1]-table[max(0,i-1)][1])/(b[0]-table[max(0,i-1)][0])
            m1=(table[min(len(table)-1,i+2)][1]-a[1])/(table[min(len(table)-1,i+2)][0]-a[0])
            d=b[0]-a[0]
            return (2*t**3-3*t*t+1)*a[1]+(t**3-2*t*t+t)*d*m0+(-2*t**3+3*t*t)*b[1]+(t**3-t*t)*d*m1

WX=[(-2.4985,.92),(-2.25,.965),(-1.6,.9815),(-.9,.955),(0,.950),(1.0,.970),(1.4,.9815),(2.1,.964),(2.4985,.91)]
HZ=[(-2.4985,.685),(-2.32,.78),(-2.05,.845),(-1.65,.903),(-1.1,.947),(-.8,.953),(0,.95),(.8,.971),(1.4,.993),(1.9,1.01),(2.25,1.02),(2.4985,.93)]
AXLES=[-1.60,1.40];R=.357;WZ=.357
def width(x):return sample(WX,x)
def hood(x):return sample(HZ,x)
def xwarp(x,t):return x+.215*abs(t)**3*(1-smooth((x+2.4985)/.58))-.11*abs(t)**3*smooth((x-2.03)/.47)
def archbottom(x):
    b=.205
    for a in AXLES:
        d=abs(x-a)
        if d<.398:b=max(b,WZ+sqrt(max(0,.398**2-d*d)))
        elif d<.423:b=max(b,lerp(.205,WZ,smooth((.423-d)/.025)))
    return b
def bodypoint(x,t,side=1):
    w=width(x);h=hood(x);f=.060+.018*sum(math.exp(-((x-a)/.55)**2) for a in AXLES)
    if t<=.70:
        s=sin(t/.70*1.35);y=w*s;z=h+f*s**4-.095*s**8
    else:
        v=(t-.7)/.3;s=sin(1.35);top=h+f*s**4-.095*s**8
        z=lerp(top,archbottom(x),v)
        y=w*(s+.031*sin(pi*v)-.030*v)
        # Broad lower door concavity, fading out over the wheel arches.
        middle=(1-math.exp(-min(abs(x-a) for a in AXLES)**2/.13))
        y-=.045*sin(pi*v)**2*middle
    return (xwarp(x,y/w),side*y,z)
def topsurf(x,y,offset=0):
    t=math.asin(min(.9757,abs(y)/width(x)))/1.35*.7
    p=bodypoint(x,t,1 if y>=0 else -1)
    return (p[0],p[1],p[2]+offset)
def sidepoint(x,z,s,offset=.0025):
    p=bodypoint(x,.7,s);v=clamp((p[2]-z)/max(.001,p[2]-archbottom(x)))
    q=bodypoint(x,.7+.3*v,s)
    return (q[0],q[1]+s*offset,z)

NX=360;NT=48
# One welded body mesh. End caps share the longitudinal boundary vertices.
vs=[];fs=[];rings=[]
for i in range(NX+1):
    x=lerp(-2.4985,2.4985,i/NX)
    ring=[bodypoint(x,j/NT,1) for j in range(NT+1)]
    ring += [bodypoint(x,j/NT,-1) for j in range(NT,-1,-1)]
    rings.append(len(vs));vs.extend(ring)
NR=2*(NT+1)
for i in range(NX):
    for j in range(NR-1):
        a=i*NR+j;fs.append((a,a+NR,a+NR+1,a+1))
def frontx(y,z):return -2.4985+.215*(abs(y)/width(-2.4985))**3+.035*(1-smooth((z-.22)/.42))
def rearx(y,z):return 2.4985-.11*(abs(y)/width(2.4985))**3-.060*(1-smooth((z-.21)/.58))
for front in [True,False]:
    offset=0 if front else NX*NR
    original=[vs[offset+j] for j in range(NR)]
    previous=[offset+j for j in range(NR)]
    for ring in range(1,25):
        t=ring/25;new=[]
        for pt in original:
            y=pt[1]*(1-t);z=lerp(pt[2],.47 if front else .56,t)
            xx=frontx(y,z) if front else rearx(y,z)
            # The first rows blend into the hood and quarter panels smoothly.
            xx=lerp(pt[0],xx,smooth(t/.16))
            new.append(len(vs));vs.append((xx,y,z))
        for j in range(NR-1):fs.append((previous[j],new[j],new[j+1],previous[j+1]))
        previous=new
    ci=len(vs);vs.append((-2.4985 if front else 2.4985,0,.47 if front else .56))
    for j in range(NR-1):fs.append((previous[j],ci,previous[j+1]))
body=mesh('Unified aluminum body | welded hood, quarters and bumpers',vs,fs,paint)
import bmesh
bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=.0001);bm.to_mesh(body.data);bm.free()
sub=body.modifiers.new('Continuous body surface refinement','SUBSURF');sub.levels=1;sub.render_levels=1

collection('SU7 | GLASS AND ROOF')
ROOF=[(-1.05,.95),(-.88,1.037),(-.6,1.23),(-.3,1.376),(0,1.436),(.38,1.44),(.7,1.405),(1.0,1.318),(1.3,1.198),(1.62,1.075),(1.95,1.009)]
CW=[(-1.05,.814),(-.5,.849),(0,.865),(.75,.873),(1.4,.843),(1.95,.76)]
def canopy(x,y,offset=0):
    z0=hood(x)-.006;top=sample(ROOF,x);h=max(.003,top-z0);w=sample(CW,x)
    ratio=min(.99999,abs(y)/w)
    if ratio<=.73:
        z=top-min(.050,h*.16)*(ratio/.73)**2
    else:
        t=(ratio-.73)/.27
        shoulder=top-min(.050,h*.16)
        z=lerp(shoulder,z0,t**.90)
    return (x,y,z+offset)
WINDOW=[(-.886,.990),(-.660,1.145),(-.29,1.309),(-.035,1.357),(.35,1.356),(.69,1.299),(1.11,1.143),(1.58,1.027),(1.64,1.006),(1.41,.984),(.5,.970),(-.47,.958)]
def inside(x,z,poly):
    b=False;j=len(poly)-1
    for i in range(len(poly)):
        xi,zi=poly[i];xj,zj=poly[j]
        if ((zi>z)!=(zj>z)) and x<(xj-xi)*(z-zi)/(zj-zi)+xi:b=not b
        j=i
    return b
vs=[];fs=[];ids=[];nx=180;ny=96
for i in range(nx+1):
    x=lerp(-1.05,1.95,i/nx);w=sample(CW,x)
    for j in range(ny+1):vs.append(canopy(x,w*lerp(-1,1,j/ny)))
for i in range(nx):
    for j in range(ny):
        a=i*(ny+1)+j;f=(a,a+ny+1,a+ny+2,a+1);fs.append(f)
        center=sum((Vector(vs[k]) for k in f),Vector())/4;x,y,z=center;s=abs(y)/sample(CW,x)
        glass_limit=lerp(.955,.76,smooth((x+.974)/.744)) if x<-.23 else (lerp(.76,.935,smooth((x-.86)/.97)) if x>.86 else .76)
        glazing=(s<glass_limit and -.974<x<1.83) or (s>=.72 and inside(x,z,WINDOW))
        ids.append(0 if (x>1.53 and s>.76) else 1)
roof=mesh('Compound curved greenhouse | panoramic glazing',vs,fs,paint);roof.data.materials.append(glass)
for f,m in zip(roof.data.polygons,ids):f.material_index=m

def winpoint(x,z,s,offset=.003):
    w=sample(CW,x);lo=0;hi=w
    z=max(hood(x)-.005,min(sample(ROOF,x)-.007,z))
    for _ in range(24):
        mid=(lo+hi)/2
        if canopy(x,mid)[2]>z:lo=mid
        else:hi=mid
    return (x,s*((lo+hi)/2+offset),z)
def path_smooth(points,passes=3):
    for _ in range(passes):
        out=[]
        for i in range(len(points)):
            a=Vector(points[i]);b=Vector(points[(i+1)%len(points)])
            out.extend([tuple(a*.75+b*.25),tuple(a*.25+b*.75)])
        points=out
    return points
for s in [-1,1]:
    outline=[winpoint(x,z,s,.008) for x,z in path_smooth(WINDOW,4)]
    curve('Window perimeter | satin black surround',outline,black,.006,True)
    # Overlay an exactly bounded opaque tinted side window over the greenhouse.
    poly=path_smooth(WINDOW,4);xc=sum(p[0] for p in poly)/len(poly);zc=sum(p[1] for p in poly)/len(poly)
    vv=[winpoint(xc,zc,s,.004)];ff=[];n=len(poly)
    for ring in range(1,49):
        vv.extend(winpoint(lerp(xc,x,ring/48),lerp(zc,z,ring/48),s,.009) for x,z in poly)
        if ring==1:
            ff.extend((0,1+k,1+(k+1)%n) for k in range(n))
        else:
            a=1+(ring-2)*n;b=1+(ring-1)*n
            ff.extend((a+k,b+k,b+(k+1)%n,a+(k+1)%n) for k in range(n))
    mesh('Smooth continuous side glass',vv,ff,glass)
    for dx in [-.010,0,.010]:
        curve('B pillar black trim',[winpoint(.20+dx+(.974-z)*.13,z,s,.013) for z in [lerp(.973,1.352,k/36) for k in range(37)]],black,.012)
    curve('Rear quarter glass division',[winpoint(lerp(1.27,1.12,k/30),lerp(.984,1.126,k/30),s,.013) for k in range(31)],black,.003)
    curve('Painted continuous A pillar and roof rail',outline,paint,.013,True)
    curve('Roof drip molding',[canopy(lerp(-.96,1.87,k/160),s*sample(CW,lerp(-.96,1.87,k/160))*.805,.007) for k in range(161)],black,.0025)
for x in []:
    curve('Panoramic roof transverse joint',[canopy(x,lerp(-.67,.67,k/60),.006) for k in range(61)],gap,.004)

collection('SU7 | PANEL LINES AND TRIM')
for s in [-1,1]:
    # Hood shut line follows the curvature of the upper body.
    hoodpath=[(-.997,.77),(-1.38,.77),(-1.88,.705),(-2.18,.57),(-2.29,.29),(-2.30,0)]
    curve('Hood precision shut line',[topsurf(x,s*y,.003) for x,y in smooth_open_path(hoodpath)],gap,.0015)
    for name,path in [('Front door leading gap',[(-.94,.943),(-.925,.77),(-.92,.46),(-.89,.23)]),('B pillar door gap',[(.19,.942),(.15,.80),(.13,.49),(.17,.225)]),('Rear door trailing gap',[(1.43,.974),(1.30,.84),(1.10,.62),(.95,.23)])]:
        curve(name,[sidepoint(lerp(path[i][0],path[i+1][0],k/20),lerp(path[i][1],path[i+1][1],k/20),s,.004) for i in range(len(path)-1) for k in range(21)],gap,.002)
    curve('Rocker sill',[sidepoint(x,.205,s,.008) for x in [lerp(-1.17,.973,k/60) for k in range(61)]],black,.022)
    curve('Rocker silver edge',[sidepoint(x,.197,s,.026) for x in [lerp(-1.13,.94,k/60) for k in range(61)]],silver,.0025)
    for x in [-.025,1.02]:
        ob=cube('Flush door handle recess',sidepoint(x,.833,s,.004),(.173,.013,.032),gap,.014)
        ob=cube('Flush door handle | Aqua Blue',sidepoint(x,.839,s,.014),(.155,.016,.022),paint,.010)
        curve('Handle finger undercut',[sidepoint(x-.066,.828,s,.025),sidepoint(x+.058,.828,s,.025)],black,.002)
    # Charging flap on left rear quarter, as in supplied profile.
    if s==-1:
        path=[(1.83,.947),(2.015,.932),(2.037,.855),(1.993,.819),(1.819,.834),(1.80,.914)]
        curve('Charging door',[sidepoint(x,z,s,.004) for x,z in path_smooth(path,3)],gap,.0018,True)
    # Front fender camera/air outlet behind wheel.
    path=[(-1.285,.776),(-.963,.790),(-.963,.724),(-1.205,.727)]
    pp=[sidepoint(x,z,s,.007) for x,z in path]
    mesh('Front fender black air blade',pp,[(0,1,2,3)],black)
    curve('Fender blade polished edge',pp[:3],silver,.003)
    uv('Side camera lens',sidepoint(-1.015,.753,s,.018),(.016,.008,.013),lampglass)
    # Mirror stem and two-tone aero mirror.
    curve('Mirror stalk',[(-.805,s*.84,.954),(-.77,s*1.02,1.004)],black,.014)
    uv('Mirror black lower housing',(-.80,s*1.038,1.04),(.14,.091,.050),black)
    uv('Mirror painted upper cap',(-.812,s*1.043,1.064),(.145,.093,.059),paint)
    uv('Mirror reflective glass',(-.695,s*1.047,1.062),(.013,.073,.044),silver)
    curve('Mirror LED indicator',[(-.927,s*1.075,1.049),(-.86,s*1.127,1.049),(-.78,s*1.135,1.049)],white,.0025,False,True)
    # Shaped lips and dark inner liners around open arches.
    for axle in AXLES:
        pts=[];inner=[]
        for k in range(97):
            a=lerp(-.36,pi+.36,k/96);x=axle+.399*cos(a);z=WZ+.399*sin(a)
            if z<.205:continue
            y=width(x)*.976
            pts.append((x,s*(y+.001),z));inner.append((x,s*(y-.012),z-.006))
        curve('Rolled painted wheel arch lip',pts,paint,.004)
        curve('Wheelhouse dark reveal',inner,gap,.010)
        vs=[];fs=[]
        for k in range(101):
            a=pi*k/100
            for yy in [.70,.947]:vs.append((axle+.385*cos(a),s*yy,WZ+.385*sin(a)))
        for k in range(100):a=k*2;fs.append((a,a+1,a+3,a+2))
        mesh('Wheelhouse liner',vs,fs,gap)

collection('SU7 | FRONT OPTICS AND AERO')
def chaikin(poly,iterations=2):
    for _ in range(iterations):
        out=[]
        for i in range(len(poly)):
            a=Vector(poly[i]);b=Vector(poly[(i+1)%len(poly)])
            out.extend([tuple(a*.90+b*.10),tuple(a*.10+b*.90)])
        poly=out
    return poly
def patch(name,poly,project,material):
    border=chaikin(poly,2);center=tuple(sum(p[j] for p in border)/len(border) for j in range(len(border[0])))
    # Concentric ring topology keeps the lens on a compound surface.
    verts=[project(*center)];faces=[];n=len(border);nr=24
    for ring in range(1,nr+1):
        t=ring/nr
        verts.extend(project(*[lerp(center[j],p[j],t) for j in range(len(center))]) for p in border)
        if ring==1:
            for k in range(n):faces.append((0,1+k,1+(k+1)%n))
        else:
            a=1+(ring-2)*n;b=1+(ring-1)*n
            for k in range(n):faces.append((a+k,b+k,b+(k+1)%n,a+(k+1)%n))
    return mesh(name,verts,faces,material),[project(*p) for p in border]
from mathutils.bvhtree import BVHTree
bpy.context.view_layer.update()
BODY_TREE=BVHTree.FromObject(body,bpy.context.evaluated_depsgraph_get())
def front_surface(y,z,offset=.006):
    hit,normal,index,dist=BODY_TREE.ray_cast(Vector((-3.2,y,z)),Vector((1,0,0)),2.0)
    if hit is None:return (frontx(y,z)-offset,y,z)
    return (hit.x-offset,y,z)
def back_surface(y,z,offset=.006):
    hit,normal,index,dist=BODY_TREE.ray_cast(Vector((3.2,y,z)),Vector((-1,0,0)),2.0)
    if hit is None:return (rearx(y,z)+offset,y,z)
    return (hit.x+offset,y,z)
def lamp_surface(y,z,offset=.006):
    yy=(1 if y>=0 else -1)*(.542+(abs(y)-.542)*.92)
    return front_surface(yy,z,offset+.004)
LAMP=[(.542,.649),(.602,.703),(.799,.824),(.909,.848),(.947,.803),(.941,.675),(.878,.624),(.694,.613),(.566,.627)]
for side in [-1,1]:
    s=side
    proj=lambda y,z:lamp_surface(s*y,z,.006)
    ob,border=patch('Waterdrop headlight | dark compound-curved optical housing',LAMP,proj,lampglass)
    curve('Headlight rubber gasket',border,gap,.004,True)
    curve('Headlight polished rim',[lamp_surface(s*y,z,.009) for y,z in chaikin(LAMP,2)],silver,.0014,True)
    guide=[(.561,.646),(.661,.665),(.795,.701),(.931,.737)]
    curve('Signature sweeping diagonal DRL',[lamp_surface(s*lerp(guide[i][0],guide[i+1][0],k/16),lerp(guide[i][1],guide[i+1][1],k/16),.014) for i in range(len(guide)-1) for k in range(17)],white,.005)
    guide=[(.615,.632),(.740,.634),(.851,.649),(.918,.678)]
    curve('Lower segmented optical return',[lamp_surface(s*lerp(guide[i][0],guide[i+1][0],k/16),lerp(guide[i][1],guide[i+1][1],k/16),.014) for i in range(len(guide)-1) for k in range(17)],white,.003)
    guide=[(.712,.724),(.766,.775),(.819,.791)]
    curve('Upper arrow DRL accent',[lamp_surface(s*lerp(guide[i][0],guide[i+1][0],k/16),lerp(guide[i][1],guide[i+1][1],k/16),.014) for i in range(len(guide)-1) for k in range(17)],white,.0034)
    for y,z in [(.848,.780),(.899,.790),(.811,.669),(.868,.687)]:
        q=Vector(lamp_surface(s*y,z,.011))
        cube('Rectangular LED projector surround',q,(.013,.039,.032),silver,.008)
        cube('Deep projector optic',q+Vector((-.008,0,0)),(.008,.027,.022),lampglass,.006)
    # Corner air curtain, on the curved front fascia.
    poly=[(.824,.533),(.908,.566),(.912,.468),(.872,.279),(.842,.314)]
    proj2=lambda y,z:front_surface(s*y,z,.022)
    ob,border=patch('Vertical corner air curtain',poly,proj2,gap);curve('Corner intake rim',border,black,.006,True)
    curve('Air curtain inner fin',[proj2(.882,.339),proj2(.902,.515)],black,.009)

proj=lambda y,z:front_surface(y,z,.009)
poly=[(-.755,.228),(-.57,.444),(-.42,.456),(.42,.456),(.57,.444),(.755,.228)]
ob,border=patch('Wide trapezoidal front lower intake',poly,proj,gap)
curve('Satin front intake frame',border,black,.014,True)
for s in [-1,1]:
    poly=[(s*.36,.249),(s*.381,.421),(s*.505,.430),(s*.719,.248)]
    ob,border=patch('Sculpted Aqua Blue intake side surround',poly,lambda y,z:front_surface(y,z,.025),black)
    curve('Painted intake ring',border,paint,.005,True)
for z in [.271,.318,.366,.409]:
    curve('Horizontal grille louver',[(frontx(y,z)-.018,y,z) for y in [lerp(-.38,.38,k/30) for k in range(31)]],black,.006)
for y in [lerp(-.35,.35,k/10) for k in range(11)]:
    curve('Grille vertical reinforcement',[(frontx(y,z)-.014,y,z) for z in [.26,.43]],black,.003)
curve('Front splitter blade',[(frontx(y,.205)-.025,y,.205-.012*cos(y*pi/1.85)) for y in [lerp(-.9,.9,k/100) for k in range(101)]],black,.014)
cube('Front license plate bracket',(-2.507,0,.513),(.031,.536,.164),black,.012)
cube('Front license plate',(-2.523,0,.516),(.008,.516,.149),plate,.009)
textobj('Front plate lettering','xiaomi SU7',(-2.529,0,.516),.056,black,(-1,0,0),(0,-1,0))
for s in [-1,1]:
    y=s*.70;z=.493;cyl('Ultrasonic parking sensor',(frontx(y,z)-.003,y,z),.009,.002,paint,'X',32)
    for yy in [s*.211]:cyl('License plate screw',(-2.54,yy,.570),.004,.002,silver,'X',16)
badgepos=topsurf(-2.256,0,.020)
uv('Xiaomi hood emblem',badgepos,(.032,.024,.004),silver)
textobj('Hood mi insignia','mi',(badgepos[0]-.001,0,badgepos[2]+.005),.027,black,(0,0,1),(0,-1,0))
uv('Front perception camera',(-2.527,0,.432),(.008,.015,.011),lampglass)

collection('SU7 | REAR LIGHTS AND DIFFUSER')
def rearproj(y,z):return back_surface(y*.968,z,.012)
poly=[(-.91,.773),(-.80,.866),(-.55,.870),(-.46,.827),(.46,.827),(.55,.870),(.80,.866),(.91,.773),(.71,.757),(-.71,.757)]
ob,border=patch('Full-width smoked rear lamp housing',poly,rearproj,lampglass)
curve('Rear lamp outer seal',border,gap,.005,True)
poly=[(-.866,.785),(-.775,.841),(-.551,.847),(-.505,.813),(.505,.813),(.551,.847),(.775,.841),(.866,.785),(.70,.778),(-.7,.778)]
ob,border=patch('Halo rear red optical bed',poly,lambda y,z:back_surface(y*.968,z,.018),red_dark)
curve('Continuous halo rear LED',border,red,.0053,True)
curve('Lower full-width LED filament',[rearproj(y,.778) for y in [lerp(-.79,.79,k/160) for k in range(161)]],red,.0033)
for s in [-1,1]:
    curve('Inner taillight return',[rearproj(s*y,z) for y,z in [(.52,.819),(.64,.817),(.78,.804)]],red,.003)
    poly=[(s*.864,.635),(s*.896,.605),(s*.889,.527),(s*.830,.43),(s*.839,.535)]
    ob,border=patch('Rear bumper side air outlet',poly,rearproj,gap);curve('Rear vent rim',border,black,.005,True)
    # Trunk perimeter lines and quarter lamp separation.
    path=[(s*.62,.945),(s*.64,.85),(s*.635,.729),(s*.593,.671),(s*.46,.661)]
    curve('Trunk panel shut line',[rearproj(y,z) for y,z in path],gap,.0023,False,True)
    cube('Rear lower reflector',(2.471,s*.584,.312),(.012,.228,.028),red_dark,.012)
poly=[(-.825,.233),(-.785,.389),(-.60,.477),(-.35,.485),(.35,.485),(.60,.477),(.785,.389),(.825,.233)]
ob,border=patch('Rear diffuser black valance',poly,lambda y,z:back_surface(y,z,.013),black)
for s in [-1,1]:
    curve('Rear diffuser painted buttress',[rearproj(s*y,z) for y,z in [(.39,.234),(.39,.413),(.55,.433),(.73,.387),(.76,.243)]],paint,.012,False,True)
curve('Rear diffuser lower lip',[(rearx(y,.214)+.016,y,.214) for y in [lerp(-.87,.87,k/100) for k in range(101)]],black,.016)
for y in [-.67,-.37,0,.37,.67]:cube('Underfloor diffuser strake',(2.21,y,.183),(.43,.016,.067),black,.003)
cube('Rear plate bracket',(2.505,0,.378),(.028,.562,.176),gap,.008)
cube('Rear license plate',(2.524,0,.38),(.008,.510,.146),plate,.005)
textobj('Rear plate SU7','SU7',(2.531,0,.38),.073,black,(1,0,0),(0,1,0))
for i,ch in enumerate('xiaomi'):
    y=(i-2.5)*.091
    textobj('Rear spaced Xiaomi lettering | '+ch,ch,back_surface(y,.906,.015),.041,silver,(1,0,0),(0,1,0))
textobj('Rear model badge','SU7',back_surface(.458,.695,.014),.025,silver,(1,0,0),(0,1,0))
textobj('Rear Max badge','Max',back_surface(.526,.695,.014),.017,red_dark,(1,0,0),(0,1,0))
textobj('Rear manufacturer badge','XIAOMI',back_surface(-.479,.695,.014),.016,silver,(1,0,0),(0,1,0))
curve('Integrated rear deck ducktail',[topsurf(2.284,y,.015) for y in [lerp(-.81,.81,k/120) for k in range(121)]],paint,.010)
curve('Retractable spoiler shut line',[topsurf(2.21,y,.003) for y in [lerp(-.75,.75,k/80) for k in range(81)]],gap,.002)
uv('Rear parking camera',(2.503,0,.47),(.009,.011,.011),lampglass)

collection('SU7 | WHEELS AND BRAKES')
def lathe(name,axle,side,profile,material,n=128):
    # Profile is axial offset from wheel center / radial distance.
    yc=side*.844;vs=[];fs=[]
    for yy,r in profile:
        for k in range(n):
            a=2*pi*k/n;vs.append((axle+r*cos(a),yc+side*yy,WZ+r*sin(a)))
    for j in range(len(profile)-1):
        for k in range(n):a=j*n+k;b=j*n+(k+1)%n;fs.append((a,b,b+n,a+n))
    return mesh(name,vs,fs,material)
def spoke_poly(name,axle,s,points,angle,y,material,depth=.008):
    vs=[]
    for dy in [0,depth]:
        for tang,r in points:
            xx=r*cos(angle)-tang*sin(angle);zz=r*sin(angle)+tang*cos(angle)
            vs.append((axle+xx,s*(y+dy),WZ+zz))
    n=len(points);fs=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    for k in range(n):fs.append((k,(k+1)%n,(k+1)%n+n,k+n))
    return bevel(mesh(name,vs,fs,material,False),.002,3)
for axle in AXLES:
    for s in [-1,1]:
        label=('Front' if axle<0 else 'Rear')+(' left' if s<0 else ' right')
        profile=[(-.139,.263),(-.143,.292),(-.130,.335),(-.103,.352),(-.069,.357),(.069,.357),(.103,.352),(.126,.334),(.137,.294),(.128,.263),(-.139,.263)]
        lathe(label+' | tire carcass',axle,s,profile,rubber)
        for rr in [.278,.326,.340]:torus(label+' tire molded sidewall ring',(axle,s*.975,WZ),rr,.0016,rubber)
        # Tread blocks form real circumferential and diagonal relief, not a texture.
        vs=[];fs=[]
        for k in range(132):
            for lane in range(6):
                a=2*pi*(k+(.4 if lane%2 else 0))/132;y0=-.098+lane*.0328
                start=len(vs)
                for radial in [.3545,.3590]:
                    for da,dy in [(-.018,0),(.017,0),(.021,.028),(-.014,.028)]:
                        aa=a+da;vs.append((axle+radial*cos(aa),s*(.844+y0+dy),WZ+radial*sin(aa)))
                fs.extend(tuple(start+q for q in f) for f in [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)])
        mesh(label+' directional tread | 792 blocks',vs,fs,rubber,False)
        lathe(label+' cast rim barrel',axle,s,[(-.107,.256),(-.103,.265),(.108,.265),(.129,.255),(.126,.241),(.110,.239),(-.095,.243)],black)
        torus(label+' diamond-cut outer flange',(axle,s*.974,WZ),.251,.005,silver)
        torus(label+' inner rim accent',(axle,s*.976,WZ),.239,.0028,silver)
        cyl(label+' brake rotor',(axle,s*.938,WZ),.216,.012,rotor)
        torus(label+' rotor outer scoring',(axle,s*.945,WZ),.202,.001, silver)
        for ring,count in [(.186,40),(.164,32)]:
            for k in range(count):
                a=2*pi*k/count;cyl(label+' drilled rotor perforation',(axle+ring*cos(a),s*.946,WZ+ring*sin(a)),.0032,.001,gap,vertices=10)
        cyl(label+' brake disc bell',(axle,s*.949,WZ),.092,.014,black)
        # Yellow fixed multi-piston caliper, visible between the paired spokes.
        cx=axle+(.158 if axle<0 else -.158)
        cal=cube(label+' yellow six-piston caliper',(cx,s*.953,WZ+.012),(.071,.062,.191),yellow,.019)
        textobj(label+' caliper marking','xiaomi',(cx,s*.987,WZ+.016),.016,black,(0,s,0),(0,0,1))
        for k in range(5):
            angle=pi/2+2*pi*k/5+.13
            # Wide forged Y-spoke with dark pockets and bright machined perimeters.
            for flip in [-1,1]:
                shape=[(-.018,.054),(.016,.059),(.030,.136),(.080,.224),(.072,.244),(.044,.239),(.003,.156)]
                shape=[(t*flip,r) for t,r in shape]
                spoke_poly(label+' machined split spoke',axle,s,shape,angle,.969,silver)
                small=[(-.008,.077),(.009,.084),(.021,.142),(.066,.226),(.055,.230),(.012,.153)]
                small=[(t*flip,r) for t,r in small]
                spoke_poly(label+' black spoke pocket',axle,s,small,angle,.979,black,.002)
        cyl(label+' center hub',(axle,s*.990,WZ),.049,.018,black)
        torus(label+' center cap ring',(axle,s*1.001,WZ),.035,.002,silver)
        textobj(label+' center mi logo','mi',(axle,s*1.002,WZ),.023,silver,(0,s,0),(1,0,0))
        for k in range(5):
            a=2*pi*k/5+pi/2;cyl(label+' titanium lug nut',(axle+.064*cos(a),s*.988,WZ+.064*sin(a)),.008,.012,silver,vertices=6)
        cyl(label+' tire valve',(axle+.228*cos(.34),s*.983,WZ+.228*sin(.34)),.006,.019,black,vertices=16)
        # Embossed tire lettering, individually oriented around the sidewall.
        for word,angle0,size in [('MICHELIN',pi*.67,.021),('PILOT SPORT EV',pi*1.5,.014)]:
            step=size*.67/.307
            for k,char in enumerate(word):
                a=angle0+(k-(len(word)-1)/2)*step
                o=textobj(label+' sidewall lettering',char,(axle+.309*cos(a),s*.978,WZ+.309*sin(a)),size,rubber,(0,s,0),(-sin(a),0,cos(a)),.00045)

collection('SU7 | INTERIOR AND SENSORS')
cube('Dark cabin tub',(.26,0,.70),(2.20,1.47,.21),gap,.06)
for x in [-.03,.80]:
    for s in [-1,1]:
        cube('Seat cushion',(x,s*.38,.715),(.46,.43,.12),leather,.08)
        ob=cube('Contoured seat back',(x+.17,s*.38,.986),(.13,.40,.49),leather,.065);ob.rotation_euler[1]=-.14
        cube('Integrated head restraint',(x+.19,s*.38,1.14 if x>0 else 1.213),(.13,.23,.21),leather,.07)
        for yy in [-.145,.145]:curve('Seat piping',[(x+.085,s*.38+yy,z) for z in [.82,1.03,1.15]],black,.002)
cube('Dashboard',(-.69,0,.918),(.31,1.41,.115),black,.05)
cube('Dashboard center screen',(-.54,0,1.002),(.024,.335,.204),black,.009)
cube('Screen glass',(-.524,0,1.01),(.004,.309,.175),lampglass,.005)
torus('Steering wheel',(-.48,-.384,.993),.142,.016,black)
curve('Steering wheel spokes',[(-.48,-.518,.993),(-.48,-.384,.943),(-.48,-.25,.993)],black,.017)
cube('Steering center',(-.48,-.384,.975),(.06,.13,.074),black,.015)
cube('Center tunnel',(.05,0,.758),(1.01,.19,.15),black,.035)
for y in [-.035,.045]:cyl('Cup holder',(.19,y,.84),.033,.01,gap,'Z')
for s in [-1,1]:
    curve('Windshield wiper arm',[canopy(-.937,s*.66,.013),canopy(-.885,s*.45,.017),canopy(-.878,s*.12,.019)],black,.005)
    curve('Wiper rubber blade',[canopy(-.885,s*y,.022) for y in [.15,.25,.35,.45,.55,.62]],black,.004)
lidar=cube('Roof lidar painted pod',(-.25,0,1.423),(.208,.222,.061),black,.027)
uv('Lidar forward optical aperture',(-.357,0,1.429),(.017,.092,.019),lampglass)
uv('Roof rear camera blister',(1.23,0,1.221),(.027,.033,.022),black)
cube('Flat aerodynamic underfloor',(0,0,.177),(4.10,1.58,.036),gap,.03)

# Store image references inside the native blend, disabled in final renders.
collection('REFERENCE | supplied photos (viewport only)')
refdir=os.path.join(os.path.dirname(ROOT),'Xiaomi-su7-images')
for i in range(1,6):
    path=os.path.join(refdir,'Xiaomi-Su7-%02d.png'%i)
    if os.path.isfile(path):
        im=bpy.data.images.load(path);im.pack()
        ob=bpy.data.objects.new('REFERENCE %02d'%i,None);COL.objects.link(ob);ob.empty_display_type='IMAGE';ob.data=im;ob.empty_display_size=5;ob.location=(0,5+i*2,2);ob.hide_render=True;ob.hide_viewport=True

collection('STUDIO | cameras and softboxes')
floor=mat('Studio | blue gray',(.115,.143,.177),.10,.43)
mesh('Infinite studio floor',[(-200,-200,-.003),(200,-200,-.003),(200,200,-.003),(-200,200,-.003)],[(0,1,2,3)],floor)
# Curved cyclorama for every review camera.
vs=[];fs=[]
for i in range(129):
    a=2*pi*i/128
    for r,z in [(35,-.004),(39,.1),(42,1),(44,3),(45,6),(45,30)]:vs.append((r*cos(a),r*sin(a),z))
for i in range(128):
    for j in range(5):
        a=i*6+j;fs.append((a,a+6,a+7,a+1))
mesh('Seamless curved studio cyclorama',vs,fs,floor)
scene=bpy.context.scene
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.23,.29,.36,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.26
def aim(ob,point):ob.rotation_euler=(Vector(point)-ob.location).to_track_quat('-Z','Y').to_euler()
def area(name,loc,power,size,color,target,shape='DISK',size_y=None):
    d=bpy.data.lights.new(name,'AREA');d.energy=power*.48;d.shape=shape;d.size=size;d.color=color
    if size_y and shape=='RECTANGLE':d.size_y=size_y
    o=bpy.data.objects.new(name,d);COL.objects.link(o);o.location=loc;aim(o,target)
    if name.startswith('Key') or name.startswith('Front fill') or name.startswith('Side highlight'):o.visible_glossy=False
area('Key | giant overhead strip',(-.3,-3.5,6.8),1700,5.5,(.84,.93,1),(0,0,.5),'RECTANGLE',2.6)
area('Rim | long roof reflection',(1.7,4.2,5.8),2100,5.0,(.77,.88,1),(0,0,.7),'RECTANGLE',2.0)
area('Front fill',(-5.0,1.2,2.8),900,3.4,(1,.94,.85),(-1,0,.65),'RECTANGLE',3)
area('Side highlight',(1,-4.5,3.8),350,4.0,(.85,.95,1),(0,0,.6),'RECTANGLE',1.2)
area('Rear softbox',(5,1,3.7),1100,3.0,(1,.96,.92),(1,0,.7))
def camera(name,loc,target,lens=57,ortho=None):
    d=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,d);COL.objects.link(o);o.location=loc;aim(o,target);d.lens=lens
    if ortho:d.type='ORTHO';d.ortho_scale=ortho
    d.clip_end=300;return o
cams={
 'front_hero':camera('01 | Front three-quarter',(-6.9,-8.0,2.55),(0,0,.73),68),
 'rear_hero':camera('02 | Rear three-quarter',(7.7,-6.2,2.45),(.1,0,.74),66),
 'side':camera('03 | Side orthographic',(0,-10,1.44),(0,0,.85),ortho=5.6),
 'front':camera('04 | Front orthographic',(-9,0,.83),(0,0,.83),ortho=2.7),
 'rear':camera('05 | Rear orthographic',(9,0,.83),(0,0,.83),ortho=2.7),
 'wheel':camera('06 | Wheel detail',(-2.4,-3.0,1.12),(-1.55,-.85,.45),68),
}
scene.camera=cams['front_hero']
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24 if DRAFT else 96
scene.cycles.use_denoising=True;scene.cycles.max_bounces=7;scene.cycles.transparent_max_bounces=4
scene.render.resolution_x=1120 if DRAFT else 1920;scene.render.resolution_y=560 if DRAFT else 960;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.view_settings.view_transform='Filmic';scene.view_settings.look='Medium High Contrast';scene.view_settings.exposure=-.10;scene.view_settings.gamma=1
scene.unit_settings.system='METRIC';scene.unit_settings.length_unit='METERS'
scene['Model']='Xiaomi SU7 Max | first generation | Aqua Blue'
scene['Reference']='Five user-supplied official press photographs, packed into blend'
scene['Dimensions']='4997 x 1963 x 1440 mm body; wheelbase 3000 mm; mirrors excluded'
scene['Accuracy note']='Photo-based reconstruction, not factory CAD. No quantified 99 percent accuracy claim.'
scene['Blender version']=bpy.app.version_string
# Recalculate outward mesh normals once after assembly.
import bmesh
for ob in bpy.data.objects:
    if ob.type=='MESH' and len(ob.data.polygons)>0:
        bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(ob.data);bm.free()
for ob in bpy.context.selected_objects:ob.select_set(False)
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':
            a.spaces.active.region_3d.view_perspective='CAMERA';a.spaces.active.clip_end=500
scene.render.filepath=os.path.join(RENDERS,'front_hero.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'Xiaomi_SU7_Max.blend'))
stats={'blender':bpy.app.version_string,'objects':len(bpy.data.objects),'mesh_vertices':sum(len(o.data.vertices) for o in bpy.data.objects if o.type=='MESH'),'body_length_m':4.997,'wheelbase_m':3.0,'iteration':VERSION}
with open(os.path.join(ROOT,'scene_stats.json'),'w') as f:json.dump(stats,f,indent=2)
views=['front_hero','rear_hero'] if DRAFT else ['front_hero','rear_hero','side','front','rear','wheel']
if '--no-render' not in ARGS:
    for view in views:
        scene.camera=cams[view];scene.render.filepath=os.path.join(RENDERS,('draft_'+VERSION+'_' if DRAFT else '')+view+'.png')
        bpy.ops.render.render(write_still=True)
scene.camera=cams['front_hero'];scene.render.filepath=os.path.join(RENDERS,'front_hero.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'Xiaomi_SU7_Max.blend'))
print('SU7_BUILD_COMPLETE',stats,flush=True)
