import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\MyProjects\TempProject (OpenCode)\su7.glb")
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
tris = sum(len(o.data.polygons) for o in meshes)
mats = set()
for o in meshes:
    for m in o.data.materials:
        if m: mats.add(m.name)
print("GLB meshes:", len(meshes), "faces:", tris)
print("materials:", sorted(mats))
print("GLB_OK")
