"""Preview renders for checking the model while building it.

    blender -b <file.blend> -P blender/preview.py -- out/previews/name [engine] [views...]
Views: side, side_r, front, q34, rear34, top, cockpit, drive, face, crank
"""
import bpy
import sys
import math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
prefix = argv[0] if argv else "//preview"
engine = argv[1] if len(argv) > 1 else "WORKBENCH"
views = argv[2:] or ["side", "q34", "front", "drive"]

VIEWS = {
    #  name: (camera location, target, lens mm)
    "side": ((0.1, -4.2, 0.85), (0.1, 0, 0.75), 50),
    "side_l": ((0.1, 4.2, 0.85), (0.1, 0, 0.75), 50),
    "q34": ((2.4, -2.6, 1.55), (0.05, 0, 0.75), 50),
    "front": ((3.6, -0.15, 1.05), (0.1, 0, 0.8), 50),
    "rear34": ((-2.5, -2.0, 1.4), (0.0, 0, 0.75), 50),
    "top": ((0.1, -0.01, 4.5), (0.1, 0, 0.6), 40),
    "cockpit": ((0.95, -0.55, 1.25), (0.45, 0, 0.9), 50),
    "drive": ((-0.15, -1.0, 0.42), (-0.15, 0, 0.32), 50),
    "face": ((0.95, -0.42, 1.56), (0.29, 0, 1.50), 85),
    "face_front": ((1.3, -0.05, 1.50), (0.29, 0, 1.50), 85),
    "hands": ((0.95, -0.62, 1.12), (0.57, -0.19, 0.93), 60),
    "legs_front": ((2.2, -0.4, 0.75), (0.0, 0, 0.7), 50),
    "crank": ((0.15, -0.9, 0.55), (0.0, 0, 0.35), 45),
    "waist": ((0.75, -0.25, 1.05), (-0.05, 0.0, 1.0), 40),
    "upper": ((0.5, -1.6, 1.5), (0.1, 0, 1.2), 50),
    "back": ((-1.6, -0.9, 1.9), (0.0, 0, 1.2), 50),
}

sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH' if engine == "WORKBENCH" else 'BLENDER_EEVEE'
sc.render.resolution_x = 1200
sc.render.resolution_y = 800
sc.render.film_transparent = False
if engine == "WORKBENCH":
    sh = sc.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'MATERIAL'
    sh.show_cavity = True
    sh.cavity_type = 'WORLD'
    sh.show_specular_highlight = True
    sh.background_type = 'VIEWPORT'
    sh.background_color = (0.82, 0.84, 0.87)
else:
    sc.eevee.use_gtao = True
    sc.eevee.use_soft_shadows = True
    sc.eevee.taa_render_samples = 32
    w = bpy.data.worlds.new("PreviewWorld") if not sc.world else sc.world
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.6, 0.68, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.8
    if "PreviewSun" not in bpy.data.objects:
        ld = bpy.data.lights.new("PreviewSun", 'SUN')
        ld.energy = 3.5
        ld.angle = math.radians(3)
        lo = bpy.data.objects.new("PreviewSun", ld)
        sc.collection.objects.link(lo)
        lo.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))

cam_data = bpy.data.cameras.new("PreviewCam")
cam = bpy.data.objects.new("PreviewCam", cam_data)
sc.collection.objects.link(cam)
sc.camera = cam
for v in views:
    loc, tgt, lens = VIEWS[v]
    cam.location = loc
    d = Vector(tgt) - Vector(loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam_data.lens = lens
    sc.render.filepath = "%s_%s.png" % (prefix, v)
    bpy.ops.render.render(write_still=True)
    print("rendered", sc.render.filepath)
