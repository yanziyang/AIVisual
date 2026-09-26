import bpy, math, pathlib, json, wave
from mathutils import Vector
ROOT=pathlib.Path(__file__).parent.parent; OUT=ROOT/'liang_sicheng_dougong'; RENDER=OUT/'render_3d';RENDER.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.eevee.taa_render_samples=16
scene.eevee.use_gtao=True;scene.eevee.gtao_distance=3;scene.eevee.gtao_factor=1.3;scene.eevee.use_soft_shadows=True
scene.render.resolution_x=1280;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.fps=12
scene.world.color=(.14,.14,.14);scene.view_settings.view_transform='Filmic';scene.view_settings.look='Medium High Contrast';scene.view_settings.exposure=.35
groups={k:[] for k in ['base','column','ludou','hua','ang1','ang2','cross','roof','ties']}
def mat(name,col,wood=False):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;l=m.node_tree.links;bs=n.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*col,1);bs.inputs['Roughness'].default_value=.37
 if wood:
  tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=3;tex.inputs['Detail'].default_value=2
  coord=n.new('ShaderNodeTexCoord');mapping=n.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(2,45,3);l.new(coord.outputs['Generated'],mapping.inputs[0]);l.new(mapping.outputs[0],tex.inputs['Vector'])
  ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.2;ramp.color_ramp.elements[0].color=(*[x*.46 for x in col],1);ramp.color_ramp.elements[1].position=.8;ramp.color_ramp.elements[1].color=(*col,1);l.new(tex.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs[0],bs.inputs['Base Color'])
  bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.05;l.new(tex.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs[0],bs.inputs['Normal'])
 return m
wood=mat('Warm timber',(.53,.29,.11),True);lightwood=mat('Light timber',(.69,.44,.2),True);stone=mat('Stone',(.32,.34,.32));gold=mat('Highlight amber',(.9,.42,.06));blue=mat('Highlight jade',(.06,.58,.43));floor=mat('Backdrop',(.025,.065,.057))
def assign(o,name,group,material=wood):
 o.name=name;o.data.materials.append(material);groups[group].append(o);o['group']=group;o['rest']=list(o.location)
 if o.type=='MESH':
  mod=o.modifiers.new('Crafted edges','BEVEL');mod.width=.025;mod.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o
def cube(name,pos,sz,group,material=wood):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.dimensions=sz;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return assign(o,name,group,material)
def beam(name,a,b,width,height,group,material=wood):
 a,b=Vector(a),Vector(b);o=cube(name,(a+b)/2,(width,height,(b-a).length),group,material);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def block(name,pos,w=.52,h=.3,group='cross'):
 x,y,z=pos;verts=[(x+dx*s,y+dy*s,z+zz) for zz,s in [(-h/2,w*.65),(h/2,w)] for dx,dy in [(-.5,-.5),(.5,-.5),(.5,.5),(-.5,.5)]]
 faces=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)];me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);assign(o,name,group,lightwood)
 # Raised cheeks express a receiving seat rather than an undifferentiated cube.
 for dx,dy in [(-1,-1),(1,-1),(1,1),(-1,1)]:cube(name+'_cheek',(x+dx*w*.32,y+dy*w*.32,z+h*.6),(w*.25,w*.25,h*.35),group,lightwood)
 return o
def gong(name,pos,length,width=.28,height=.3,axis='y',group='cross'):
 pts=[(-.5,.35),(-.5,.9),(.5,.9),(.5,.35),(.4,.25),(.33,-.05),(.2,-.45),(0,-.5),(-.2,-.45),(-.33,-.05),(-.4,.25)]
 verts=[]
 for side in [-.5,.5]:
  for u,v in pts:verts.append((side*width,u*length,v*height) if axis=='y' else (u*length,side*width,v*height))
 N=len(pts);faces=[tuple(range(N-1,-1,-1)),tuple(range(N,2*N))]+[(k,(k+1)%N,(k+1)%N+N,k+N) for k in range(N)]
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.location=pos;return assign(o,name,group)
# A teaching model of the single column-headed bracket set shown on the supplied page.
for z,r,dep in [(.09,1.05,.18),(.23,.84,.16),(.39,.59,.16)]:
 bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=r,depth=dep,location=(0,0,z));assign(bpy.context.object,'Column stone base','base',stone)
bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=.43,depth=2.8,location=(0,0,1.9));assign(bpy.context.object,'24 Column','column')
cube('25 Ground-level tie',(0,1.3,.55),(.35,3.6,.3),'ties')
cube('23 Architrave',(0,0,2.97),(.38,4.0,.38),'ties')
block('20 Ludou',(0,0,3.4),.88,.44,'ludou')
gong('15 Nidaogong',(0,0,3.7),1.6,group='cross')
gong('19 Huagong',(-.35,0,3.84),2.25,.35,.42,'x','hua')
for y in [-.66,.66]:block('Lower cross-arm dou',(0,y,4.0),.42,.22)
block('Hua tip dou',(-1.22,0,4.08),.55,.25,'hua')
gong('13 Mangong first',(-1.22,0,4.26),2.25,.3,.37)
for y in [-.95,.95]:block('First projection cross-arm dou',(-1.22,y,4.53),.43,.24)
beam('17 First ang',(-1.96,0,4.43),(1.35,0,5.6),.32,.34,'ang1')
block('First ang tip seat',(-1.88,0,4.55),.53,.24,'ang1')
gong('13 Mangong second',(-1.88,0,4.8),2.85,.3,.37)
for y in [-1.26,1.26]:block('Second projection cross-arm dou',(-1.88,y,5.06),.45,.25)
beam('17 Second ang',(-2.67,0,5.09),(1.38,0,6.12),.33,.36,'ang2')
block('Second ang tip seat',(-2.61,0,5.22),.52,.24,'ang2')
gong('10 Linggong',(-2.61,0,5.49),3.35,.3,.4)
for y in [-1.52,1.52]:block('Top eave seats',(-2.61,y,5.76),.48,.26)
cube('3 Eave purlin',(-2.61,0,6.03),(.38,3.9,.4),'roof')
cube('Interior purlin',(1.34,0,6.8),(.38,3.9,.4),'roof')
for k in range(13):
 y=-1.85+k*3.7/12
 beam('2 Eave rafter',(-3.06,y,6.2),(1.7,y,7.04),.12,.12,'roof',lightwood)
 beam('1 Flying rafter',(-3.55,y,6.23),(-2.08,y,6.65),.11,.10,'roof',lightwood)
# Narrow boards imply the roof plane while retaining visibility of the bracket assembly.
for k in range(7):
 x=-2.95+k*.72;z=6.38+(x+2.95)*.176
 cube('Rafter hiding board',(x,0,z),(.68,3.9,.045),'roof',lightwood)
cube('Stage',(0,0,-.08),(200,200,.12),'base',floor)
def light(name,pos,power,size,color):
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((-.7,0,3.8))-o.location).to_track_quat('-Z','Y').to_euler()
light('Key',(-5,-5,10),1500,7,(1,.84,.64));light('Fill',(3,-2,7),1000,6,(.55,.77,1));light('Rim',(-1,6,9),2000,5,(1,.74,.39))
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.lens=48;cam.data.clip_end=300
ids=[0,1,2,4,5,6,7,8,12];timeline=[];cursor=1
for idx in ids:
 with wave.open(str(OUT/f'voice_{idx:02}.wav'),'rb') as w:seconds=w.getnframes()/w.getframerate()+1
 count=round(seconds*12);timeline.append(dict(id=idx,start=cursor,end=cursor+count-1,seconds=count/12));cursor+=count
scene.frame_start=1;scene.frame_end=cursor-1
def pose(frame,angle,radius,target):
 target=Vector(target);cam.location=target+Vector((math.cos(angle)*radius,math.sin(angle)*radius,radius*.28));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.keyframe_insert('location',frame=frame);cam.keyframe_insert('rotation_euler',frame=frame)
for chapter,t in enumerate(timeline):
 a,b=t['start'],t['end'];idx=t['id'];target=(-.85,0,3.6);radius=13.6
 if idx in [4,5,6,7]:target=(-1.1,0,4.65);radius=8.8
 if idx==8:target=(-1,0,4.15);radius=11.8
 startangle=math.radians(215+(chapter%3)*16);endangle=startangle+math.radians(38)
 pose(a,startangle,radius,target);pose(b,endangle,radius,target)
 for group,objs in groups.items():
  focus={4:['ludou'],5:['hua'],6:['ang1','ang2'],7:['hua','ang1','ang2'],8:['cross','hua','ang1','ang2']}.get(idx,[])
  for o in objs:
   rest=Vector(o['rest']);offset=Vector((0,0,0))
   if idx==1 and group not in ['base','column']:offset=Vector((0,0,{'ties':.12,'ludou':.3,'hua':.55,'cross':.9,'ang1':1.1,'ang2':1.5,'roof':2.0}.get(group,0)))
   for f,amount in [(a,0),(a+max(2,int((b-a)*.35)),1),(a+int((b-a)*.72),1),(b,0)]:
    o.location=rest+offset*amount;o.keyframe_insert('location',frame=f)
   basecol=o.data.materials[0].node_tree.nodes.get('Principled BSDF') if o.type=='MESH' else None
   # Material highlight is applied per group with animated emissive accent.
   if group in ['ludou','hua','ang1','ang2','cross']:
    if not o.get('highlight_mat'):
     original=o.data.materials[0];m=original.copy();m.name=o.name+'_animated';o.data.materials[0]=m;o['highlight_mat']=True
    bs=o.data.materials[0].node_tree.nodes.get('Principled BSDF');col=(.9,.35,.03,1) if group in ['ludou','hua'] else (.03,.64,.43,1)
    bs.inputs['Emission'].default_value=col
    for f,strength in [(a,0),(a+int((b-a)*.2),.6 if group in focus else 0),(a+int((b-a)*.8),.6 if group in focus else 0),(b,0)]:bs.inputs['Emission Strength'].default_value=strength;bs.inputs['Emission Strength'].keyframe_insert('default_value',frame=f)
# Linear camera motion; object animation remains gently eased.
for curve in cam.animation_data.action.fcurves:
 for key in curve.keyframe_points:key.interpolation='LINEAR'
scene.render.filepath=str(RENDER/'frame_')
(OUT/'timeline_3d.json').write_text(json.dumps(timeline,indent=2),encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'dougong_teaching_model.blend'))
scene.frame_set(timeline[4]['start']+24);scene.render.filepath=str(OUT/'3d_preview.png');bpy.ops.render.render(write_still=True)
