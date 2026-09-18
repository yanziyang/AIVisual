import bpy,os,json
ROOT=os.path.dirname(os.path.abspath(__file__))
model=[]
for c in bpy.data.collections:
 if c.name[:2] in ['01','02','03','04','05']:
  for o in c.objects:
   if o.type in {'MESH','CURVE','FONT'}:
    o.hide_set(False);o.hide_viewport=False;o['component']=c.name.split('|')[-1].strip();model.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in model:o.select_set(True)
bpy.context.view_layer.objects.active=model[0]
bpy.ops.object.convert(target='MESH')
selected=list(bpy.context.selected_objects)
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'j36.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,export_animations=False)
report={'objects':len(selected),'vertices':sum(len(o.data.vertices) for o in selected),'polygons':sum(len(o.data.polygons) for o in selected),'bytes':os.path.getsize(os.path.join(ROOT,'j36.glb'))}
with open(os.path.join(ROOT,'export-report.json'),'w') as f:json.dump(report,f,indent=2)
print('EXPORT_COMPLETE',report)
