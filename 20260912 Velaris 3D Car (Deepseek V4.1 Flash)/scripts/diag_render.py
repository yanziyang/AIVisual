import bpy
import sys

argv = sys.argv
argv = argv[argv.index("--") + 1:] if "--" in argv else []
hide_prefix = argv[0] if argv else "_none_"
out = argv[1] if len(argv) > 1 else "diag.png"
cam_name = argv[2] if len(argv) > 2 else "CAM_DetailWheel"

for o in bpy.data.objects:
    if o.name.startswith(hide_prefix):
        o.hide_render = True

sc = bpy.context.scene
sc.camera = bpy.data.objects[cam_name]
sc.render.filepath = out
sc.render.resolution_x = 960
sc.render.resolution_y = 540
bpy.ops.render.render(write_still=True)
print("DIAG DONE", out)
