"""Fresh-process import validation of the SU7 portable deliverable."""
import bpy, os, json, math
from mathutils import Vector
root=os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(root,'Xiaomi_SU7_Max.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
assert len(meshes)>100,'Expected a fully populated vehicle mesh export'
bounds=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box]
assert all(math.isfinite(c) for v in bounds for c in v)
dims=[max(v[i] for v in bounds)-min(v[i] for v in bounds) for i in range(3)]
assert 4.9<dims[0]<5.25,dims
assert 2.0<dims[1]<2.6,dims
assert 1.3<dims[2]<1.65,dims
report={'fresh_blender_glb_import':'passed','blender_version':bpy.app.version_string,
        'mesh_objects':len(meshes),'mesh_vertices':sum(len(o.data.vertices) for o in meshes),
        'whole_vehicle_dimensions_m':dims,'materials':len(bpy.data.materials)}
with open(os.path.join(root,'import_validation.json'),'w') as f:json.dump(report,f,indent=2)
print('DELIVERY_IMPORT_VALIDATED',json.dumps(report),flush=True)
