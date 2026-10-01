"""Create the original Cadence bicycle and rider in Blender, then export animated GLB.
Run: blender --background --python model/build_cyclist.py
Axes in Blender: X forward, Y across the bicycle, Z up. No external assets.
"""
import bpy, math, os
from mathutils import Vector
from math import sin, cos, pi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.fps = 30
scene.frame_start, scene.frame_end = 1, 61

def material(name, color, metallic=0, rough=.45):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color,1)
    m.use_nodes = True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metallic
    p.inputs['Roughness'].default_value=rough
    return m

blue=material('Cobalt enamel',(.018,.17,.66),.6,.27)
black=material('Tire rubber',(.015,.022,.031),0,.8)
navy=material('Midnight bib shorts',(.019,.036,.075),0,.65)
dark=material('Carbon and bar tape',(.028,.037,.048),.2,.42)
tan=material('Natural tire sidewalls',(.52,.34,.16),0,.85)
silver=material('Brushed aluminum',(.51,.58,.65),.9,.28)
orange=material('Vermilion jersey',(.96,.18,.045),0,.72)
skin=material('Skin',(.66,.37,.21),0,.67)
white=material('Ivory helmet and shoes',(.9,.92,.91),.05,.37)
lens=material('Sunglasses',(.009,.027,.04),.7,.13)

def finish(obj,name,mat):
    obj.name=name
    obj.data.materials.append(mat)
    for p in obj.data.polygons:p.use_smooth=True
    return obj

def sphere(name,p,scale,mat,segments=24,rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=p)
    o=finish(bpy.context.object,name,mat)
    for v in o.data.vertices:
        v.co.x*=scale[0];v.co.y*=scale[1];v.co.z*=scale[2]
    return o

def cylinder(name,a,b,r,mat,r2=None,vertices=16):
    a,b=Vector(a),Vector(b)
    length=(b-a).length
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=r if r2 is None else r2,depth=length)
    o=finish(bpy.context.object,name,mat)
    o.location=(a+b)/2
    o.rotation_mode='QUATERNION'
    o.rotation_quaternion=(b-a).to_track_quat('Z','Y')
    return o

def move_segment(obj,a,b,frame):
    a,b=Vector(a),Vector(b)
    obj.location=(a+b)/2
    obj.rotation_quaternion=(b-a).to_track_quat('Z','Y')
    obj.keyframe_insert(data_path='location',frame=frame)
    obj.keyframe_insert(data_path='rotation_quaternion',frame=frame)

def box(name,p,scale,mat,bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p)
    o=finish(bpy.context.object,name,mat)
    for v in o.data.vertices:
        v.co.x*=scale[0];v.co.y*=scale[1];v.co.z*=scale[2]
    mod=o.modifiers.new('Soft edges','BEVEL');mod.width=bevel;mod.segments=3
    bpy.context.view_layer.objects.active=o
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def torus(name,p,r,tube,mat):
    bpy.ops.mesh.primitive_torus_add(major_segments=64,minor_segments=10,location=p,major_radius=r,minor_radius=tube,rotation=(pi/2,0,0))
    return finish(bpy.context.object,name,mat)

def tube(name,points,r,mat):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D'
    curve.resolution_u=1;curve.bevel_depth=r;curve.bevel_resolution=3
    s=curve.splines.new('POLY');s.points.add(len(points)-1)
    for v,p in zip(s.points,points):v.co=(*p,1)
    o=bpy.data.objects.new(name,curve);scene.collection.objects.link(o)
    curve.materials.append(mat)
    bpy.context.view_layer.objects.active=o;o.select_set(True)
    bpy.ops.object.convert(target='MESH');o.select_set(False)
    return o

def parent_keep(obj,parent):
    world=obj.matrix_world.copy();obj.parent=parent;obj.matrix_world=world

# Bicycle: both wheels include hubs, rim nipples, spokes and natural sidewalls.
wheels=[]
for label,x in [('Rear',-.65),('Front',.69)]:
    group=bpy.data.objects.new(label+'_wheel',None);scene.collection.objects.link(group)
    group.location=(x,0,.363)
    parts=[]
    parts.append(torus(label+' tire',(x,0,.363),.341,.022,black))
    for side in [-1,1]:
        parts.append(torus(label+' sidewall '+str(side),(x,side*.014,.363),.337,.008,tan))
        parts.append(torus(label+' rim '+str(side),(x,side*.012,.363),.311,.008,dark))
    parts.append(cylinder(label+' hub',(x,-.065,.363),(x,.065,.363),.026,silver))
    for j in range(24):
        a=2*pi*j/24
        side=.024 if j%2 else -.024
        parts.append(cylinder(label+' spoke '+str(j),(x,side,.363),(x+.307*cos(a),side*.3,.363+.307*sin(a)),.0015,silver,vertices=6))
    for o in parts:parent_keep(o,group)
    wheels.append(group)

bb=Vector((-.08,0,.435));seat=Vector((-.36,0,.985));head=Vector((.43,0,1.00))
for name,a,b,r in [
    ('Down tube',bb,(.465,0,.87),.033),('Seat tube',bb,seat,.025),
    ('Top tube',(-.325,0,.91),head,.024),('Head tube',(.465,0,.87),head,.028)]:
    cylinder(name,a,b,r,blue)
for side in [-1,1]:
    y=side*.055
    cylinder('Chain stay',bb,(-.65,y,.363),.014,blue)
    cylinder('Seat stay',(-.325,0,.915),(-.65,y,.363),.011,blue)
    tube('Carbon fork',[(.46,y,.89),(.52,y,.69),(.59,y,.45),(.69,y,.363)],.016,dark)
cylinder('Seat post',seat,(-.385,0,1.085),.013,dark)
sphere('Saddle',(-.385,0,1.088),(.13,.075,.027),dark)
cylinder('Stem',(.43,0,1.015),(.56,0,1.063),.016,dark)
cylinder('Handlebar tops',(.56,-.215,1.063),(.56,.215,1.063),.013,dark)
for side in [-1,1]:
    y=side*.215
    points=[(.56,y,1.063),(.61,y,1.055),(.65,y,1.00),(.65,y,.93),(.59,y,.89),(.51,y,.895)]
    tube('Drop bar '+str(side),points,.014,dark)
    sphere('Brake hood '+str(side),(.601,y,1.065),(.041,.019,.045),dark)
    cylinder('Brake lever '+str(side),(.631,y,1.02),(.64,y,.97),.006,silver)
    cylinder('Brake caliper',(.535,0,.695),(.535,side*.035,.695),.017,dark)
cylinder('Bottom bracket',(-.08,-.075,.435),(-.08,.075,.435),.035,silver)
for r in [.085,.068]:torus('Chain ring',(-.08,-.09,.435),r,.005,silver)
for r in [.046,.035,.025]:torus('Cassette',(-.65,-.065,.363),r,.005,silver)
tube('Chain upper',[(-.65,-.091,.41),(-.08,-.091,.52),(.005,-.091,.435)],.0035,dark)
tube('Chain lower',[(.005,-.091,.435),(-.08,-.091,.35),(-.65,-.091,.317)],.0035,dark)
cylinder('Bottle',(.13,0,.63),(.25,0,.79),.029,white)
cylinder('Bottle cap',(.25,0,.79),(.26,0,.807),.02,dark)
sphere('Bottle cage',(.16,0,.63),(.037,.039,.026),dark)

# Contoured torso, short sleeves, bib and helmet. Geometry stays editable in .blend.
def torso_mesh():
    a,b=Vector((-.335,0,1.17)),Vector((.15,0,1.50))
    q=(b-a).to_track_quat('Z','Y')
    rings=[(0,.115,.095),(.08,.125,.09),(.25,.139,.105),(.43,.155,.105),(.58,.17,.092),(.64,.115,.075)]
    verts=[];faces=[];n=32
    for z,w,d in rings:
        for j in range(n):
            ang=2*pi*j/n;verts.append(tuple(a+q@Vector((d*cos(ang),w*sin(ang),z))))
    for k in range(len(rings)-1):
        for j in range(n):faces.append((k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j))
    faces.append(tuple(range(n-1,-1,-1)));faces.append(tuple((len(rings)-1)*n+j for j in range(n)))
    mesh=bpy.data.meshes.new('Tailored jersey');mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new('Jersey torso',mesh);scene.collection.objects.link(o);finish(o,o.name,orange)
torso_mesh()
sphere('Bib pelvis',(-.35,0,1.12),(.145,.145,.125),navy)
cylinder('Neck',(.19,0,1.52),(.28,0,1.655),.056,skin)
sphere('Head',(.33,0,1.725),(.125,.102,.151),skin)
sphere('Jaw',(.361,0,1.665),(.083,.084,.058),skin)
sphere('Nose',(.449,0,1.735),(.037,.023,.031),skin)
for side in [-1,1]:sphere('Ear',(.302,side*.102,1.717),(.025,.014,.036),skin)
sphere('Helmet',(.31,0,1.84),(.17,.13,.092),white)
for y in [-.08,-.04,0,.04,.08]:
    sphere('Helmet vent',(.305,y,1.915-abs(y)*.16),(.092,.009,.004),dark,16,8)
sphere('Visor glasses',(.445,0,1.766),(.018,.112,.034),lens)
for side in [-1,1]:
    cylinder('Glasses arm',(.444,side*.096,1.773),(.292,side*.109,1.775),.005,dark)
    tube('Helmet strap',[(.37,side*.105,1.815),(.29,side*.116,1.70),(.365,side*.08,1.625)],.004,dark)

for side in [-1,1]:
    sh=(.11,side*.155,1.50);el=(.295,side*.21,1.225);hand=(.596,side*.215,1.061)
    sleeve_end=Vector(sh).lerp(Vector(el),.46)
    cylinder('Short sleeve',sh,sleeve_end,.063,orange,r2=.05)
    cylinder('Upper arm',sleeve_end,el,.047,skin,r2=.037)
    sphere('Elbow',el,(.038,.038,.039),skin)
    cylinder('Forearm',el,hand,.039,skin,r2=.026)
    sphere('Gloved hand',hand,(.042,.028,.035),dark)

# Two-link inverse kinematics, baked as a seamless two-second animation.
legs=[]
for side in [-1,1]:
    hip=Vector((-.35,side*.115,1.14))
    thigh=cylinder('Thigh '+str(side),hip,hip+Vector((0,0,-.46)),.064,skin,r2=.043)
    shorts=cylinder('Bib leg '+str(side),hip,hip+Vector((0,0,-.46)),.083,navy,r2=.067)
    shin=cylinder('Shin '+str(side),(0,0,0),(0,0,.46),.039,skin,r2=.026)
    sock=cylinder('Sock '+str(side),(0,0,0),(0,0,.46),.03,white)
    knee=sphere('Knee '+str(side),(0,0,0),(.044,.044,.044),skin)
    shoe=sphere('Cycling shoe '+str(side),(0,0,0),(.105,.039,.038),white)
    sole=box('Shoe sole '+str(side),(0,0,0),(.17,.066,.011),dark,.005)
    strap=box('Shoe closure '+str(side),(0,0,0),(.018,.074,.008),dark,.002)
    crank=cylinder('Crank arm '+str(side),(0,0,0),(0,0,.17),.011,silver)
    pedal=box('Pedal '+str(side),(0,0,0),(.075,.085,.017),dark,.006)
    legs.append((side,hip,thigh,shorts,shin,sock,knee,shoe,sole,strap,crank,pedal))

for f in range(1,62):
    theta=2*pi*(f-1)/60
    for side,hip,thigh,shorts,shin,sock,knee,shoe,sole,strap,crank,pedal in legs:
        t=theta+(pi if side==1 else 0)
        p=Vector((-.08+.17*cos(t),side*.19,.435-.17*sin(t)))
        ankle=p+Vector((-.033,0,.057))
        d=ankle-hip;distance=d.length
        direction=d.normalized();perp=Vector((-direction.z,0,direction.x)).normalized()
        bend=hip+direction*(distance/2)+perp*math.sqrt(max(0,.46**2-(distance/2)**2))
        move_segment(thigh,hip,bend,f)
        move_segment(shorts,hip,hip.lerp(bend,.51),f)
        # Shorts were created at full length; scale keeps their hem at mid-thigh.
        shorts.scale.z=.51;shorts.keyframe_insert(data_path='scale',frame=f)
        move_segment(shin,bend,ankle,f)
        move_segment(sock,ankle.lerp(bend,.25),ankle,f)
        sock.scale.z=.25;sock.keyframe_insert(data_path='scale',frame=f)
        for o,pos in [(knee,bend),(shoe,p+Vector((.025,0,.047))),(sole,p+Vector((.025,0,.014))),(strap,p+Vector((.017,0,.082))),(pedal,p)]:
            o.location=pos;o.keyframe_insert(data_path='location',frame=f)
        move_segment(crank,(-.08,side*.10,.435),p,f)
    for o in wheels:
        o.rotation_euler.y=theta*3
        o.keyframe_insert(data_path='rotation_euler',frame=f)

for action in bpy.data.actions:
    action.name='Pedaling_'+action.name
    for fc in action.fcurves:
        for k in fc.keyframe_points:k.interpolation='LINEAR'
    # All actions share one NLA name, so glTF merges the object tracks into one clip.
for obj in list(scene.objects):
    if obj.animation_data and obj.animation_data.action:
        act=obj.animation_data.action
        track=obj.animation_data.nla_tracks.new();track.name='Ride'
        track.strips.new('Ride',1,act)
        obj.animation_data.action=None

scene.frame_set(1)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'model','cyclist.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'dist','assets','cyclist.glb'),export_format='GLB',export_animations=True,export_frame_range=True,export_force_sampling=True,export_nla_strips=True,export_cameras=False,export_lights=False,export_yup=True)
print('CADENCE_EXPORT_COMPLETE')
