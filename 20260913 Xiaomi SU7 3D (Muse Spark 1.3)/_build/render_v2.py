import bpy, os
base=r"C:\MyProjects\TempProject (OpenCode)"
scene=bpy.context.scene
scene.render.resolution_percentage=70
scene.cycles.samples=40
for cn in ["Cam_34Front","Cam_Front","Cam_Side","Cam_Rear"]:
    scene.camera=bpy.data.objects[cn]
    scene.render.filepath=os.path.join(base,f"v2_{cn}.png")
    bpy.ops.render.render(write_still=True)
    print("Rendered "+cn, flush=True)
