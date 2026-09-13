import bpy, os
base = r"C:\MyProjects\TempProject (OpenCode)"
cams = ["Cam_34Front","Cam_Front","Cam_Side","Cam_Rear","Cam_34Front2"]
for cam_name in cams:
    try:
        bpy.context.scene.camera = bpy.data.objects[cam_name]
    except:
        print(f"Missing {cam_name}")
        continue
    bpy.context.scene.render.filepath = os.path.join(base, f"render_{cam_name}.png")
    bpy.context.scene.cycles.samples = 128
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {cam_name}")
