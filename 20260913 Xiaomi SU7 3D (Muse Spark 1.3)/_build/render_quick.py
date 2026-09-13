import bpy, os
base = r"C:\MyProjects\TempProject (OpenCode)"
scene = bpy.context.scene
scene.render.resolution_percentage = 60
scene.cycles.samples = 32
scene.cycles.use_denoising = True
cams = ["Cam_34Front","Cam_Front","Cam_Side","Cam_Rear"]
for cam_name in cams:
    scene.camera = bpy.data.objects[cam_name]
    scene.render.filepath = os.path.join(base, f"render_{cam_name}.png")
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {cam_name}", flush=True)
