import bpy, math, os
from mathutils import Vector
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'j36_model')
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(n,c,m=.4,r=.4):
 a=bpy.data.materials.new(n); a.diffuse_color=(*c,1); a.use_nodes=True
 p=a.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*c,1); p.inputs['Metallic'].default_value=m; p.inputs['Roughness'].default_value=r
 return a
skin=mat('Graphite stealth coating',(.23,.27,.31)); dark=mat('Intake darkness',(.006,.009,.013),0,.9); glass=mat('Smoked canopy',(.025,.08,.12),.7,.16); frame=mat('Frame and seams',(.075,.09,.11)); metal=mat('Titanium exhaust',(.19,.17,.15),.85); red=mat('Red insignia',(.55,.025,.02))
parts=[]
def mesh(n,v,f,m,s=False):
 d=bpy.data.meshes.new(n); d.from_pydata(v,[],f); d.update(); o=bpy.data.objects.new(n,d); bpy.context.collection.objects.link(o); d.materials.append(m)
 for p in d.polygons:p.use_smooth=s
 parts.append(o); return o
def loft(n,st,m,cx=0):
 v=[]; N=32
 for y,w,z,h in st:
  for j in range(N):
   a=2*math.pi*j/N; v.append((cx+w*math.cos(a),y,z+h*math.sin(a)))
 f=[tuple(reversed(range(N)))]
 for i in range(len(st)-1):
  for j in range(N):f.append((i*N+j,i*N+(j+1)%N,(i+1)*N+(j+1)%N,(i+1)*N+j))
 f.append(tuple(range((len(st)-1)*N,len(st)*N)));return mesh(n,v,f,m,True)
def line(n,p,r=.022,m=frame):
 d=bpy.data.curves.new(n,'CURVE');d.dimensions='3D';d.bevel_depth=r;d.bevel_resolution=2;s=d.splines.new('POLY');s.points.add(len(p)-1)
 for a,b in zip(s.points,p):a.co=(*b,1)
 o=bpy.data.objects.new(n,d);bpy.context.collection.objects.link(o);d.materials.append(m);parts.append(o)
loft('01 Blended broad fuselage',[(-11,.035,.05,.035),(-9.4,1.25,.10,.32),(-7.2,2.05,.22,.65),(-5.2,2.65,.32,.9),(-3,3.15,.32,1.06),(0,3.7,.25,1.1),(3.2,3.8,.2,.95),(6,3.4,.18,.73),(8.1,2.9,.16,.49)],skin)
for sign in [-1,1]:
 v=[]
 for x,l,t,h in [(1.9,-7.4,8.1,.42),(4,-4.7,8.1,.32),(8.5,1,7.8,.19),(13,5.6,6.8,.04)]:
  for u,z in [(0,0),(.16,h),(.58,h*.8),(1,0),(.58,-h*.5),(.16,-h*.65)]:v.append((sign*x,l+(t-l)*u,.2+z))
 f=[tuple(reversed(range(6)))]
 for i in range(3):
  for j in range(6):f.append((i*6+j,i*6+(j+1)%6,(i+1)*6+(j+1)%6,(i+1)*6+j))
 f.append(tuple(range(18,24)))
 if sign<0:f=[tuple(reversed(a)) for a in f]
 mesh(('Port' if sign<0 else 'Starboard')+' cranked delta wing',v,f,skin)
st=[(-7.15,.1,.85,.02),(-6.65,1.05,1,.42),(-5.7,1.43,1.12,.84),(-4.5,1.40,1.22,.86),(-3.65,1,1.3,.30)]
v=[];N=20
for y,w,z,h in st:
 for j in range(N+1):
  a=math.pi*j/N;v.append((w*math.cos(a),y,z+h*math.sin(a)))
f=[]
for i in range(len(st)-1):
 for j in range(N):
  a=i*(N+1)+j;f.append((a,a+1,a+N+2,a+N+1))
mesh('02 Wide side-by-side canopy',v,f,glass,True)
line('Canopy center divider',[(0,y,z+h+.012) for y,w,z,h in st],.048)
for sign in [-1,1]:line('Canopy sill',[(sign*w,y,z+.01) for y,w,z,h in st],.045)
for idx in [1,4]:
 y,w,z,h=st[idx];line('Canopy cross frame',[(w*math.cos(math.pi*j/32),y,z+h*math.sin(math.pi*j/32)+.015) for j in range(33)],.035)
def intake(n,cx,y,b,t,wl,wu,depth):
 # Rounded trapezoid lips flow into multi-section fairings buried in the airframe.
 dorsal=n.startswith('03')
 def ring(xc,yy,lo,hi,lw,uw):
  if dorsal:
   out=[]
   for j in range(8):
    u=j/8;out.append((xc-lw+2*lw*u,yy,lo))
   for j in range(24):
    a=math.pi*j/23;out.append((xc+lw*math.cos(a),yy,lo+(hi-lo)*math.sin(a)**.78))
   return out
  corners=[Vector((xc-lw,yy,lo)),Vector((xc+lw,yy,lo)),Vector((xc+uw,yy,hi)),Vector((xc-uw,yy,hi))]; out=[]
  for i,p in enumerate(corners):
   a=p.lerp(corners[(i-1)%4],.20); c=p.lerp(corners[(i+1)%4],.20)
   for j in range(8):
    u=j/7; out.append(tuple((1-u)**2*a+2*(1-u)*u*p+u*u*c))
  return out
 def surface(name,rings,material,cap=False):
  count=len(rings[0]); v=[p for r in rings for p in r]; f=[]
  for k in range(len(rings)-1):
   for j in range(count):f.append((k*count+j,k*count+(j+1)%count,(k+1)*count+(j+1)%count,(k+1)*count+j))
  if cap:f.extend([tuple(reversed(range(count))),tuple(range((len(rings)-1)*count,len(rings)*count))])
  ob=mesh(name,v,f,material,True)
  bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
  bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
  return ob
 mid=(b+t)/2; half=(t-b)/2
 # The rolled leading lip replaces the flat rectangular rim.
 lip=[]
 for dy,scale in [(.16,.84),(.035,.87),(-.01,.94),(.07,1.0),(.23,1.025)]:
  lip.append(ring(cx,y+dy,mid-half*scale,mid+half*scale,wl*scale,wu*scale))
 surface(n+' rounded lip',lip,skin)
 fair=[lip[-1]]
 if dorsal:
  sections=[(.65,1.26,2.31,1.70,1.36),(1.5,1.14,2.22,1.98,1.58),(2.8,1.02,1.88,2.22,1.87),(4.2,.90,1.40,2.32,2.08),(5.5,.75,1.04,2.22,2.06)]
  for dy,lo,hi,lw,uw in sections:fair.append(ring(cx,y+dy,lo,hi,lw,uw))
 else:
  sign=1 if cx>0 else -1
  for dy,shift,lo,hi,lw,uw in [(.65,0,-1.00,.12,.77,1.03),(1.5,.08,-.90,.18,.80,1.03),(2.6,.25,-.70,.28,.73,.95),(3.7,.47,-.43,.37,.58,.77),(4.8,.68,-.15,.40,.40,.54)]:
   fair.append(ring(cx-sign*shift,y+dy,lo,hi,lw,uw))
 surface(n+' smoothly blended fairing',fair,skin)
 inner=lip[0]
 duct_mid=mid-.50 if dorsal else mid+.22
 throat=ring(cx,y+depth*.72,duct_mid-half*.48,duct_mid+half*.48,wl*.62,wu*.62)
 surface(n+' recessed dark duct',[inner,throat],dark)
 mesh(n+' deep throat',throat,[tuple(range(len(throat)))],dark)
 front=ring(cx,y-.15,mid-half*.82,mid+half*.82,wl*.82,wu*.82)
 back=ring(cx,y+depth*.73,duct_mid-half*.50,duct_mid+half*.50,wl*.64,wu*.64)
 cutter=surface('Temporary intake passage',[front,back],dark,True)
 for target in list(parts):
  if target.name=='01 Blended broad fuselage':
   bpy.context.view_layer.objects.active=target;mod=target.modifiers.new('Open intake passage','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter;bpy.ops.object.modifier_apply(modifier=mod.name)
 parts.remove(cutter);bpy.data.objects.remove(cutter,do_unlink=True)
intake('03 Dorsal intake',0,-3.3,1.29,2.38,1.57,1.22,3.15)
for s in [-1,1]:intake(('04 Port' if s<0 else '05 Starboard')+' intake',s*3.15,-3.6,-1.0,.08,.70,1.0,3.6)
for i,x in enumerate([-2.05,0,2.05]):
 loft('Engine %d shroud'%(i+1),[(2,1.13,.40,.48),(4.6,1.10,.40,.54),(7.7,.86,.32,.57),(8.65,.72,.3,.58)],skin,x)
 v=[];N=24
 for y,r in [(8.55,.73),(9.05,.67),(9.05,.55),(8.3,.49)]:
  for j in range(N):
   a=2*math.pi*j/N;v.append((x+r*math.cos(a),y,.3+r*.78*math.sin(a)))
 f=[]
 for k in range(3):
  for j in range(N):f.append((k*N+j,k*N+(j+1)%N,(k+1)*N+(j+1)%N,(k+1)*N+j))
 mesh('Engine %d exhaust'%(i+1),v,f,metal);mesh('Exhaust recess',v[-N:],[tuple(range(N))],dark)
 for j in range(N):
  a=2*math.pi*j/N;line('Exhaust petal',[(x+.737*math.cos(a),8.56,.3+.737*.78*math.sin(a)),(x+.677*math.cos(a),9.04,.3+.677*.78*math.sin(a))],.01)
for s in [-1,1]:
 line('Elevon hinge',[(s*4.6,6.53,.40),(s*8.5,6.48,.36),(s*11.7,6.08,.26)],.018)
 line('Elevon split',[(s*8.5,6.48,.36),(s*8.5,7.7,.215)],.018)
 line('Outer panel',[(s*6,-1.96,.38),(s*9.5,3.42,.36)],.012)
 p=[(s*8,4.65,.405)]
 for j in range(10):
  a=math.pi/2+j*math.pi/5;r=.48 if j%2==0 else .20;p.append((s*8+r*math.cos(a),4.65+r*math.sin(a),.405))
 # New reference uses camouflage rather than the earlier red wing insignia.

# Packed, planar-mapped angular camouflage, shared by Blender and the GLB export.
import numpy as np
size=1024
xx,yy=np.meshgrid(np.linspace(-14,14,size),np.linspace(-12,12,size))
pixels=np.ones((size,size,4),dtype=np.float32);pixels[:,:,:3]=(.27,.36,.43)
def patch(poly,color):
 mask=np.zeros((size,size),dtype=bool)
 for i,(ax,ay) in enumerate(poly):
  bx,by=poly[(i+1)%len(poly)]
  mask^=((ay>yy)!=(by>yy)) & (xx < (bx-ax)*(yy-ay)/(by-ay+1e-12)+ax)
 pixels[mask,:3]=color
polys=[([(-13,5.5),(-8,2),(-6,2.7),(-4,-1),(-2,-2),(-2,1),(-5,4),(-8,3.8),(-9,6.8)],(.52,.64,.70)),
 ([(2,-7),(4,-4),(6,0),(4,2),(2,.5),(1,-3)],(.52,.64,.70)),
 ([(-11,6.5),(-6,5),(-3,6),(0,4),(3,5),(5,4),(9,6),(8,8),(-9,8)],(.16,.24,.31)),
 ([(-4,-4),(-2,-5),(-1,-2),(1,-1),(0,2),(-3,1),(-5,2)],(.18,.27,.34)),
 ([(6,1),(8,2),(11,5),(8,5),(7,4),(4,3)],(.56,.66,.72)),
 ([(-3,3),(-1,2),(2,3),(4,2),(3,4),(0,5),(-4,5)],(.48,.60,.67)),
 ([(-2,-9),(-.4,-8),(0,-6),(-1,-4),(-3,-5)],(.38,.48,.55)),
 ([(1,6),(3,5),(5,6),(7,7),(6,8),(2,8)],(.48,.60,.67))]
for polygon,color in polys:patch(polygon,color)
tex=bpy.data.images.new('Reference blue-gray angular camouflage',width=size,height=size)
tex.pixels.foreach_set(pixels.ravel());tex.pack()
node=skin.node_tree.nodes.new('ShaderNodeTexImage');node.image=tex
bsdf=skin.node_tree.nodes.get('Principled BSDF');skin.node_tree.links.new(node.outputs['Color'],bsdf.inputs['Base Color'])
bsdf.inputs['Metallic'].default_value=.20;bsdf.inputs['Roughness'].default_value=.48
for ob in parts:
 if ob.type=='MESH' and any(m==skin for m in ob.data.materials):
  uv=ob.data.uv_layers.new(name='Camouflage projection')
  for face in ob.data.polygons:
   for li in face.loop_indices:
    co=ob.matrix_world @ ob.data.vertices[ob.data.loops[li].vertex_index].co
    uv.data[li].uv=((co.x+14)/28,(co.y+12)/24)

root=bpy.data.objects.new('J36 reference-inspired concept',None);bpy.context.collection.objects.link(root)
root['Note']='Artistic visual approximation from supplied reference; rear geometry inferred. Not engineering dimensions.'
for o in parts:o.parent=root
model=list(parts)
floor=mat('Studio floor',(.045,.055,.07),.12,.55)
mesh('Studio ground',[(-200,-200,-1.65),(200,-200,-1.65),(200,200,-1.65),(-200,200,-1.65)],[(0,1,2,3)],floor)
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
for name,loc,power,col,size in [('Key',(2,-10,18),5000,(.8,.88,1),13),('Fill',(-15,-1,9),3500,(.5,.68,1),12),('Rim',(5,13,14),6500,(1,.72,.43),10)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=col;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;aim(o,(0,0,0))
d=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',d);bpy.context.collection.objects.link(cam);cam.location=(23,-32,19);aim(cam,(0,-.2,.3));d.type='ORTHO';d.ortho_scale=33
sc=bpy.context.scene;sc.camera=cam;sc.render.engine='BLENDER_EEVEE';sc.eevee.use_gtao=True;sc.eevee.gtao_distance=3;sc.eevee.use_soft_shadows=True;sc.eevee.taa_render_samples=128;sc.world.color=(.22,.22,.22)
sc.render.resolution_x=1500;sc.render.resolution_y=1050;sc.render.resolution_percentage=100;sc.view_settings.view_transform='Filmic';sc.view_settings.look='Medium High Contrast';sc.view_settings.exposure=.6
bpy.ops.object.select_all(action='DESELECT')
for o in model:o.select_set(True)
bpy.context.view_layer.objects.active=model[0]
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'J36_concept.glb'),use_selection=True,export_format='GLB')
for screen in bpy.data.screens:
 for a in screen.areas:
  if a.type=='VIEW_3D':
   a.spaces.active.region_3d.view_distance=36;a.spaces.active.region_3d.view_rotation=cam.rotation_euler.to_quaternion();a.spaces.active.region_3d.view_location=(0,0,0)
sc.render.filepath=os.path.join(OUT,'J36_preview.png');bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'J36_concept.blend'));bpy.ops.render.render(write_still=True)
cam.location=(0,-36,8.5);aim(cam,(0,-1,.5));d.ortho_scale=30;sc.render.filepath=os.path.join(OUT,'J36_front.png');bpy.ops.render.render(write_still=True)
print('J36_COMPLETE',OUT)


