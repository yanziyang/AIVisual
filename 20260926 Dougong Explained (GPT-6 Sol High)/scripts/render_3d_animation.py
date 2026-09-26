import bpy,pathlib,json,math,time,sys
from mathutils import Vector
ROOT=pathlib.Path(__file__).parent.parent;OUT=ROOT/'liang_sicheng_dougong'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'dougong_teaching_model.blend'))
scene=bpy.context.scene;scene.view_settings.exposure=-.45
scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.008,.02,.016,1)
bpy.data.objects['Stage'].scale=(5,5,1)
for obj in bpy.data.objects:
 if obj.type=='MESH':obj.data.use_auto_smooth=True
timeline=json.loads((OUT/'timeline_3d.json').read_text())
cam=scene.camera
for chapter,t in enumerate(timeline):
 if t['id'] not in [0,1,2,12]:continue
 target=Vector((-.8,0,4.2 if t['id']==1 else 3.55));radius=23.5 if t['id']==1 else 19
 for f,ang in [(t['start'],215+(chapter%3)*16),(t['end'],253+(chapter%3)*16)]:
  angle=math.radians(ang);cam.location=target+Vector((math.cos(angle)*radius,math.sin(angle)*radius,radius*.22));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.keyframe_insert('location',frame=f);cam.keyframe_insert('rotation_euler',frame=f)
for curve in cam.animation_data.action.fcurves:
 for key in curve.keyframe_points:key.interpolation='LINEAR'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'dougong_teaching_model.blend'))
for chapter,t in enumerate(timeline):
 if '--fix-wide' in sys.argv and t['id'] not in [0,1,2,12]:continue
 folder=OUT/'render_3d'/(f'wide_chapter_{chapter:02}' if t['id'] in [0,1,2,12] else f'chapter_{chapter:02}');folder.mkdir(exist_ok=True)
 frames=list(range(t['start'],t['end']+1,4));t['render_count']=len(frames)
 for n,frame in enumerate(frames):
  output=folder/f'{n:04}.png'
  if output.exists():continue
  scene.frame_set(frame);scene.render.filepath=str(output);bpy.ops.render.render(write_still=True)
  print(f'PROGRESS chapter {chapter+1}/9 frame {n+1}/{len(frames)}',flush=True)
(OUT/'timeline_3d.json').write_text(json.dumps(timeline,indent=2),encoding='utf-8')
print('RENDER COMPLETE',flush=True)
