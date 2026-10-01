"""Render frames of the baked loops: blender -b out/cyclist_all.blend -P blender/anim_preview.py -- outprefix view action:f1,f2,..."""
import bpy
import sys
import math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
prefix, view = argv[0], argv[1]
jobs = argv[2:]
VIEWS = {
    "side": ((0.15, -4.4, 0.95), (0.15, 0, 0.8), 50),
    "front": ((3.8, -0.1, 1.1), (0.1, 0, 0.8), 50),
    "q34": ((2.4, -2.7, 1.6), (0.05, 0, 0.8), 50),
    "rear": ((-3.6, -0.6, 1.3), (0.0, 0, 0.8), 50),
    "legs": ((0.0, -2.0, 0.7), (0.0, 0, 0.6), 50),
}
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.render.resolution_x, sc.render.resolution_y = 900, 700
sh = sc.display.shading
sh.light, sh.color_type = 'STUDIO', 'MATERIAL'
sh.show_cavity = True
sh.background_type = 'VIEWPORT'
sh.background_color = (0.82, 0.84, 0.87)
cd = bpy.data.cameras.new("C")
cam = bpy.data.objects.new("C", cd)
sc.collection.objects.link(cam)
sc.camera = cam
loc, tgt, lens = VIEWS[view]
cam.location = loc
cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
cd.lens = lens
rig = bpy.data.objects["CyclistRig"]
# play the plain baked FK (what the web page gets): drop constraints
for pb in rig.pose.bones:
    for c in list(pb.constraints):
        pb.constraints.remove(c)
for tr in rig.animation_data.nla_tracks:
    tr.mute = True
if "Chain" in bpy.data.objects:
    bpy.data.objects["Chain"].hide_render = True
for job in jobs:
    act, frames = job.split(":")
    rig.animation_data.action = bpy.data.actions[act]
    for f in frames.split(","):
        sc.frame_set(int(f))
        sc.render.filepath = "%s_%s_%s_%s.png" % (prefix, view, act, f)
        bpy.ops.render.render(write_still=True)
        print("rendered", sc.render.filepath)
