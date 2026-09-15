import bpy,bmesh,json,os,math
from mathutils import Vector
ROOT=os.path.dirname(os.path.abspath(__file__))
a=bpy.data.objects['J-36 | continuous blended delta airframe']
bm=bmesh.new();bm.from_mesh(a.data)
report={
 'blender_version':bpy.app.version_string,
 'main_airframe_vertices':len(a.data.vertices),
 'main_airframe_faces':len(a.data.polygons),
 'main_airframe_nonmanifold_edges':sum(not e.is_manifold for e in bm.edges),
 'main_airframe_zero_area_faces':sum(f.calc_area()<1e-10 for f in bm.faces),
 'packed_reference_images':[i.name for i in bpy.data.images if i.packed_file],
 'scene_objects':len(bpy.data.objects),
 'cameras':[o.name for o in bpy.data.objects if o.type=='CAMERA'],
 'render_outputs':{},
 'accuracy_note':'Reference-based exterior study; no verified percentage of likeness.'
}
bm.free()
coords={tuple(round(c,5) for c in v.co) for v in a.data.vertices}
report['main_airframe_mirror_mismatches']=sum(tuple(round(c,5) for c in (-v.co.x,v.co.y,v.co.z)) not in coords for v in a.data.vertices)
for file in ['01_beauty.png','02_top.png','03_rear.png','04_underside.png']:
 p=os.path.join(ROOT,'renders',file);im=bpy.data.images.load(p,check_existing=False);report['render_outputs'][file]={'width':im.size[0],'height':im.size[1],'bytes':os.path.getsize(p)};bpy.data.images.remove(im)
assert bpy.app.version==(3,6,23)
assert report['main_airframe_nonmanifold_edges']==0
assert report['main_airframe_zero_area_faces']==0
assert report['main_airframe_mirror_mismatches']==0
assert len(report['packed_reference_images'])==2
report['validation']='PASS'
with open(os.path.join(ROOT,'validation.json'),'w') as f:json.dump(report,f,indent=2)
print(json.dumps(report,indent=2))
