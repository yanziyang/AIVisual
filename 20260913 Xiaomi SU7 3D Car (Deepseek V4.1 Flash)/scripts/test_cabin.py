import bpy
bpy.ops.wm.open_mainfile(filepath=r"C:\MyProjects\TempProject (OpenCode)\su7_build.blend")
m = bpy.data.materials.get("interior")
b = m.node_tree.nodes.get("Principled BSDF")
for nm in ("Specular IOR Level", "Specular"):
    if nm in b.inputs:
        b.inputs[nm].default_value = 0.0
b.inputs["Base Color"].default_value = (0.010, 0.011, 0.012, 1)
b.inputs["Roughness"].default_value = 0.95
sc = bpy.context.scene
cam = bpy.data.objects.get("side")
sc.camera = cam
sc.render.resolution_x, sc.render.resolution_y = 1165, 404
sc.render.filepath = r"C:\MyProjects\TempProject (OpenCode)\renders\test_cabin.png"
bpy.ops.render.render(write_still=True)
print("TEST_DONE")
