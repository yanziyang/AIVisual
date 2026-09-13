import bpy, os
base=r"C:\MyProjects\TempProject (OpenCode)"
scene=bpy.context.scene
scene.render.resolution_x=1920
scene.render.resolution_y=1080
scene.render.resolution_percentage=100
scene.cycles.samples=150
scene.cycles.use_denoising=True
# hero angles matching refs
for cn in ["Cam_34Front","Cam_Front","Cam_Side","Cam_Rear","Cam_34Front2"]:
    try:
        scene.camera=bpy.data.objects[cn]
    except: continue
    scene.render.filepath=os.path.join(base,f"FINAL_{cn}.png")
    bpy.ops.render.render(write_still=True)
    print("Rendered "+cn, flush=True)
