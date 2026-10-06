"""Blender 3.6+: create a reference-based architectural study of NTU's Hive.
Run from the project root: blender --background --python build/build_model.py
No third-party Python dependencies. Dimensions and interior details are approximate.
"""
import bpy, math, os, json, random
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
random.seed(37)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.materials):
    bpy.data.materials.remove(block)

def material(name, color, roughness=.8, metallic=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Metallic'].default_value = metallic
    return m

concrete = [material('Hand-cast concrete %02d' % i, (.56+i*.008, .49+i*.007, .41+i*.006)) for i in range(7)]
edge = material('Concrete rib highlights', (.69,.61,.51))
floor = material('Warm limestone decks', (.55,.52,.46))
glass = material('Recessed smoked glazing', (.085,.12,.13), .27, .35)
bronze = material('Bronze frames and balustrades', (.24,.16,.095), .44, .62)
coremat = material('Terracotta circulation cores', (.36,.23,.16))
soil = material('Garden beds', (.16,.145,.10))
leaves = [material('Tropical planting %02d' % i, c) for i,c in enumerate([(.13,.23,.13),(.21,.34,.16),(.30,.40,.18)])]
paving = material('Campus paving', (.49,.51,.48))
base = material('Site plinth', (.22,.27,.26))
road = material('Campus asphalt', (.19,.23,.23))
line = material('Road marking', (.70,.72,.66))
wood = material('Timber seating', (.33,.23,.13))

def mesh(name, verts, faces, mat, group='Building', smooth=False, props=None):
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    o=bpy.data.objects.new(name,me)
    coll=bpy.data.collections.get(group)
    if not coll:
        coll=bpy.data.collections.new(group); bpy.context.scene.collection.children.link(coll)
    coll.objects.link(o); o.data.materials.append(mat)
    for p in me.polygons: p.use_smooth=smooth
    for k,v in (props or {}).items(): o[k]=v
    return o

def box(name, loc, dims, mat, group='Building', rot=0, props=None):
    x,y,z=[v/2 for v in dims]
    vs=[(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]
    o=mesh(name,vs,[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],mat,group,props=props)
    o.location=loc; o.rotation_euler.z=rot
    return o

def loft(name, center, a,b,angle, profile, mat, group='Building', segments=64, props=None, caps=True):
    vs=[]; ca=math.cos(angle); sa=math.sin(angle)
    for z,s in profile:
        for j in range(segments):
            t=j*math.tau/segments
            # Slightly irregular hand-cast outline; never sharp corners.
            wobble=1+.004*math.sin(7*t+angle)+.003*math.sin(13*t)
            x=a*s*math.cos(t)*wobble; y=b*s*math.sin(t)*wobble
            vs.append((center[0]+x*ca-y*sa,center[1]+x*sa+y*ca,z))
    faces=[]
    for k in range(len(profile)-1):
        for j in range(segments):
            q=(j+1)%segments
            faces.append((k*segments+j,k*segments+q,(k+1)*segments+q,(k+1)*segments+j))
    if caps:
        faces.extend([tuple(reversed(range(segments))),tuple((len(profile)-1)*segments+j for j in range(segments))])
    return mesh(name,vs,faces,mat,group,True,props)

def ring(name, cx,cy, a,b, ia,ib,z,thick,mat,group='Building',count=96,scallop=0,props=None):
    vs=[]
    for zz in (z,z+thick):
        for aa,bb in ((a,b),(ia,ib)):
            for j in range(count):
                t=math.tau*j/count
                r=1+scallop*math.cos(6*t+.35)
                vs.append((cx+aa*r*math.cos(t),cy+bb*r*math.sin(t),zz))
    faces=[]
    for j in range(count):
        q=(j+1)%count
        faces.extend([(j,q,count+q,count+j),(2*count+j,3*count+j,3*count+q,2*count+q),
                      (j,2*count+j,2*count+q,q),(count+j,count+q,3*count+q,3*count+j)])
    return mesh(name,vs,faces,mat,group,False,props)

def rod(name,p1,p2,r,mat,group='Building',props=None):
    v=Vector(p2)-Vector(p1); n=v.normalized()
    tangent=n.cross(Vector((0,0,1)))
    if tangent.length<.01: tangent=n.cross(Vector((0,1,0)))
    tangent.normalize(); other=n.cross(tangent)
    vs=[]; count=8
    for p in (Vector(p1),Vector(p2)):
        vs.extend([tuple(p+r*(tangent*math.cos(math.tau*j/count)+other*math.sin(math.tau*j/count))) for j in range(count)])
    faces=[tuple(reversed(range(count))),tuple(count+j for j in range(count))]
    faces.extend((j,(j+1)%count,(j+1)%count+count,j+count) for j in range(count))
    return mesh(name,vs,faces,mat,group,True,props)

def bush(name,x,y,z,scale=.5,group='Landscape',props=None):
    # Three crossed faceted crowns, consolidated in a single mesh.
    vs=[]; faces=[]
    for n in range(3):
        cx=x+random.uniform(-.2,.2)*scale; cy=y+random.uniform(-.2,.2)*scale
        b=len(vs); radius=scale*(.7+random.random()*.3); height=scale*1.25
        vs.extend([(cx,cy,z),(cx,cy,z+height*1.4)])
        vs.extend((cx+radius*math.cos(j*math.tau/7),cy+radius*math.sin(j*math.tau/7),z+height*.65) for j in range(7))
        for j in range(7):
            q=(j+1)%7
            faces.extend([(b,b+2+q,b+2+j),(b+1,b+2+j,b+2+q)])
    return mesh(name,vs,faces,random.choice(leaves),group,props=props)

# Layout derived visually from the architect's L04 plan. Metres are illustrative.
TOWERS=[(-22,16.3,136,7),(-11.4,17.5,112,8),(14.5,17.7,57,7),
        (22.3,12.9,34,6),(25,3.3,5,7),(22.6,-9.1,-35,8),
        (17.7,-17.2,-53,7),(7.8,-20.5,-77,6),(-4,-14.5,-108,7),
        (-11.1,-10.3,-131,8),(-20.8,-4.9,-145,7),(-25.6,6.5,165,6)]
metadata=[]
for i,(x,y,degrees,levels) in enumerate(TOWERS):
    angle=math.radians(degrees); group='Tower %02d'%(i+1)
    props={'tower':i+1,'category':'tower'}
    metadata.append({'id':i+1,'x':x,'y':y,'levels':levels,'height':round(3.45*levels+1.15,2)})
    for f in range(1,levels):
        z=f*3.45; s=.74+.26*f/7
        a=6.75*s; b=4.15*s
        # Recessed horizontal glass slot below each concrete classroom enclosure.
        loft('T%02d L%02d glazing'%(i+1,f), (x,y),a*.977,b*.977,angle,[(z+.07,1),(z+.57,1)],glass,group,props=props)
        # Convex concrete bowls with real mesh ribs (visible in the GLB, no texture dependency).
        prof=[]
        for k in range(38):
            t=k/37
            bulge=.965+.035*math.sin(math.pi*t)**.7
            rib=.004*math.cos(t*math.tau*13)+.0014*math.cos(t*math.tau*27)
            prof.append((z+.52+t*2.72,bulge+rib))
        loft('T%02d L%02d ribbed shell'%(i+1,f),(x,y),a,b,angle,prof,concrete[(i+f)%7],group,props=props)
        # Subtle dark seams between precast panels.
        for j in range(8):
            t=math.tau*j/8
            ca=math.cos(angle); sa=math.sin(angle)
            xx=x+a*math.cos(t)*ca-b*math.sin(t)*sa
            yy=y+a*math.cos(t)*sa+b*math.sin(t)*ca
            rod('Precast panel joint',(xx,yy,z+.68),(xx,yy,z+3.08),.012,coremat,group,props)
        loft('T%02d L%02d rim'%(i+1,f),(x,y),a,b,angle,[(z+3.22,1),(z+3.34,1)],edge,group,props=props)
    # Open, column-supported ground level and lower terrace.
    loft('T%02d ground terrace'%(i+1),(x,y),5.15,3.18,angle,[(.14,1),(.41,1)],floor,group,props=props)
    for sign in (-1,1):
        for sign2 in (-1,1):
            u=sign*3.6;v=sign2*1.95;ca=math.cos(angle);sa=math.sin(angle)
            xx=x+u*ca-v*sa; yy=y+u*sa+v*ca
            rod('Angled concrete support',(xx*.98,yy*.98,.4),(xx,yy,3.52),.22,concrete[2],group,props)
    z=levels*3.45
    loft('T%02d planted roof deck'%(i+1),(x,y),6.75,4.15,angle,[(z-.1,1),(z+.15,1)],floor,group,props=props)
    # Upper garden railing surrounds a genuinely open terrace.
    for dz in (.18,.97):
        loft('T%02d terrace rail'%(i+1),(x,y),6.76,4.16,angle,[(z+dz,1),(z+dz+.055,1)],bronze,group,caps=False,props=props)
    for j in range(28):
        t=j*math.tau/28;ca=math.cos(angle);sa=math.sin(angle)
        xx=x+6.76*math.cos(t)*ca-4.16*math.sin(t)*sa
        yy=y+6.76*math.cos(t)*sa+4.16*math.sin(t)*ca
        rod('Roof balustrade',(xx,yy,z+.16),(xx,yy,z+1),.027,bronze,group,props)
        if j%2==0:
            bush('Roof terrace planting',x+(xx-x)*.84,y+(yy-y)*.84,z+.2,.52,group,props)
    loft('T%02d roof planting bed'%(i+1),(x,y),5.25,2.65,angle,[(z+.17,1),(z+.31,1)],soil,group,props=props)
    # Ground-level palms and low planters.
    for j in range(4):
        t=j*math.tau/4
        bush('Understory planting',x+4.2*math.cos(t),y+2.4*math.sin(t),.42,.55,group,props)

# Open scalloped circulation galleries around the central courtyard.
for level in range(1,8):
    z=level*3.45
    props={'category':'atrium','level':level}
    ring('L%02d atrium gallery'%level,0,0,21.8,15.4,13.6,8.6,z,.25,floor,'Atrium galleries',scallop=.055,props=props)
    # Inner guardrail and vertical posts, following the atrium's organic outline.
    for dz in (.29,1.30):
        prev=None
        for j in range(97):
            t=j*math.tau/96;r=1+.055*math.cos(6*t+.35)
            p=(13.6*r*math.cos(t),8.6*r*math.sin(t),z+dz)
            if prev: rod('Atrium continuous handrail',prev,p,.025,bronze,'Atrium galleries',props)
            prev=p
    for j in range(48):
        t=j*math.tau/48;r=1+.055*math.cos(6*t+.35)
        xx=13.6*r*math.cos(t);yy=8.6*r*math.sin(t)
        rod('Atrium balustrade',(xx,yy,z+.27),(xx,yy,z+1.3),.019,bronze,'Atrium galleries',props)
    for j in range(12):
        t=j*math.tau/12
        xx=15.2*math.cos(t); yy=10.5*math.sin(t)
        rod('Atrium angled column',(xx*.94,yy*.94,z-3.45),(xx,yy,z+.24),.15,concrete[1],'Atrium structure',props)
        if level in (2,4,6) and j%2==0:
            bush('Garden gallery',xx,yy,z+.28,.65,'Atrium gardens',props)

# Four warm bronze/concrete stair and lift cores between the pods.
for k,(x,y,angle) in enumerate([(-23,1.0,.3),(24,-3.7,-.25),(1,-17.5,1.36),(1,17.3,1.65)]):
    props={'category':'core'}
    loft('Core %d textured concrete'%(k+1),(x,y),4.2,2,angle,[(.3,1),(26.4,1)],coremat,'Circulation cores',segments=32,props=props)
    for j in range(20):
        t=j*math.tau/20
        xx=x+4.25*math.cos(t)*math.cos(angle)-2.08*math.sin(t)*math.sin(angle)
        yy=y+4.25*math.cos(t)*math.sin(angle)+2.08*math.sin(t)*math.cos(angle)
        rod('Core bronze vertical fin',(xx,yy,.5),(xx,yy,26.5),.037,bronze,'Circulation cores',props)

# An unobtrusive isolated campus site, rather than invented surrounding buildings.
loft('Oval site plinth',(0,0),48,39,0,[(-1.35,1),(-.32,1)],base,'Site',segments=128,props={'category':'site'})
loft('Paved forecourt',(0,0),40,32,0,[(-.3,1),(0,1)],paving,'Site',segments=128,props={'category':'site'})
ring('Campus access road',0,0,47,38,40.4,32.4,-.23,.06,road,'Site',count=128,props={'category':'site'})
for j in range(60):
    t=j*math.tau/60
    box('Road dash',(43.5*math.cos(t),35.1*math.sin(t),-.15),(1.2,.15,.025),line,'Site',t+math.pi/2,{'category':'site'})
for j in range(15):
    t=j*math.tau/15+.1
    xx=36*math.cos(t);yy=28*math.sin(t)
    loft('Landscape bed',(xx,yy),2.4,1.55,t,[(.01,1),(.14,1)],soil,'Landscape',segments=24,props={'category':'landscape'})
    rod('Tree trunk',(xx,yy,.1),(xx,yy,3.2),.12,wood,'Landscape',{'category':'landscape'})
    bush('Tropical tree canopy',xx,yy,2.25,2.05,'Landscape',{'category':'landscape'})
    for s in range(3):bush('Campus shrubs',xx+random.uniform(-1.5,1.5),yy+random.uniform(-1,1),.15,.5,'Landscape',{'category':'landscape'})
for x,y in [(-9,-3),(7,3),(-7,4),(8,-4)]:
    box('Atrium seating',(x,y,.4),(3,.65,.5),wood,'Atrium furniture',props={'category':'atrium'})

# Consolidate by collection and material for a small number of browser draw calls.
# The twelve tower collections and their metadata remain individually selectable.
for coll in list(bpy.data.collections):
    buckets={}
    for obj in list(coll.objects):
        if obj.type=='MESH':
            buckets.setdefault(obj.data.materials[0].name,[]).append(obj)
    for matname,objects in buckets.items():
        if len(objects)<2: continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects: obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join()
        objects[0].name=coll.name+' / '+matname

scene=bpy.context.scene
scene.unit_settings.system='METRIC'
scene['Model purpose']='Reference-based architectural visualization; not an as-built survey.'
scene['Building']='UOB Innovation Hub / The Hive / Learning Hub South, NTU Singapore'
scene['References']='https://heatherwick.com/project/learning-hub-the-hive/ ; https://www.ntu.edu.sg/life-at-ntu/museum/campus-art-trail'
scene.render.engine='BLENDER_EEVEE'
scene.eevee.use_gtao=True;scene.eevee.gtao_distance=5;scene.eevee.gtao_factor=1.35
scene.eevee.use_soft_shadows=True
scene.world.color=(.45,.52,.58)
bpy.ops.object.light_add(type='AREA',location=(-35,-25,65))
bpy.context.object.name='Large soft daylight';bpy.context.object.data.energy=4200;bpy.context.object.data.size=45
bpy.context.object.rotation_euler=(Vector((0,0,9))-bpy.context.object.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.light_add(type='SUN',location=(0,0,60))
bpy.context.object.name='Afternoon sun';bpy.context.object.data.energy=2.1
bpy.context.object.rotation_euler=(.35,-.4,-.35)
bpy.ops.object.camera_add(location=(74,-89,61))
cam=bpy.context.object;cam.name='Architectural overview';cam.rotation_euler=(Vector((0,0,11))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=47;scene.camera=cam
scene.render.resolution_x=1600;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard';scene.view_settings.look='Medium High Contrast';scene.view_settings.exposure=0;scene.view_settings.gamma=1
# Useful interactive viewport state when opening the .blend.
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_distance=100
            area.spaces.active.region_3d.view_location=(0,0,12)
            area.spaces.active.region_3d.view_rotation=cam.rotation_euler.to_quaternion()
            area.spaces.active.shading.type='MATERIAL'
os.makedirs(os.path.join(ROOT,'dist'),exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'uob-innovation-hub.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'uob-innovation-hub.glb'),export_format='GLB',export_cameras=False,export_lights=False,export_extras=True)
with open(os.path.join(ROOT,'model-info.json'),'w') as f:
    json.dump({'towers':metadata,'objects':len(bpy.data.objects),'vertices':sum(len(o.data.vertices) for o in bpy.data.objects if o.type=='MESH'),'disclaimer':'Approximate architectural study, not a measured as-built model.'},f,indent=2)
print('MODEL_READY',len(bpy.data.objects),'objects')
