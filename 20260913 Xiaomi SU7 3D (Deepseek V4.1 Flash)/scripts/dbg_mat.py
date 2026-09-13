import bpy
bpy.ops.wm.open_mainfile(filepath=r"C:\MyProjects\TempProject (OpenCode)\su7_build.blend")
for nm in ("cabin", "seat_-0.38", "dash", "wall"):
    ob = bpy.data.objects.get(nm)
    if ob:
        ms = [m.name if m else None for m in ob.data.materials]
        print(nm, "mats:", ms, "hide_render:", ob.hide_render)
m = bpy.data.materials.get("interior")
b = m.node_tree.nodes.get("Principled BSDF")
print("interior base:", b.inputs["Base Color"].default_value[:], "rough", b.inputs["Roughness"].default_value)
print("DBG_DONE")
