"""Build the cyclist + bike in Blender, rig and animate it, save .blend and export .glb.

    blender -b --factory-startup --python-exit-code 1 -P blender/build.py -- [stage]
stage: bike | rider | all (default all)
"""
import bpy
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
OUT = os.path.join(os.path.dirname(HERE), "out")
os.makedirs(OUT, exist_ok=True)

import importlib
import util
import geom
import bike
for m in (util, geom, bike):
    importlib.reload(m)

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
stage = argv[0] if argv else "all"

KIT = dict(
    frame=util.hexcol("#16314f"),          # deep navy metallic
    frame_accent=util.hexcol("#e8552d"),   # signal orange
    tape=util.hexcol("#1b1c1f"),
    bottle=util.hexcol("#e9ecef"),
)

t0 = time.time()
util.clear_scene()
sc = bpy.context.scene
sc.unit_settings.system = 'METRIC'
sc.render.fps = 60

parts = bike.build(KIT)
print("bike built in %.1fs" % (time.time() - t0))

if stage in ("rider", "all"):
    import rider
    importlib.reload(rider)
    rider.build()
    print("rider built in %.1fs" % (time.time() - t0))

if stage == "all":
    import rig
    importlib.reload(rig)
    rig.build()
    print("rig built in %.1fs" % (time.time() - t0))

blend = os.path.join(OUT, "cyclist_%s.blend" % stage)
bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
print("saved", blend, "%.1fs" % (time.time() - t0))

if stage == "all":
    # export pass: plain FK loops only (constraints off), no static chain (the page animates links)
    rig_ob = bpy.data.objects["CyclistRig"]
    for pb in rig_ob.pose.bones:
        for c in list(pb.constraints):
            pb.constraints.remove(c)
    for a in list(bpy.data.actions):
        if a.name.endswith("_ctrl"):
            bpy.data.actions.remove(a)
    for o in bpy.data.objects:
        o.select_set(o.type in ('MESH', 'ARMATURE', 'EMPTY') and o.name not in ("Chain",))
    glb = os.path.join(OUT, "cyclist.glb")
    bpy.ops.export_scene.gltf(
        filepath=glb, export_format='GLB', use_selection=True, export_apply=False, export_yup=True,
        export_texcoords=False, export_normals=True, export_tangents=False, export_colors=False,
        export_materials='EXPORT', export_cameras=False, export_lights=False, export_extras=True,
        export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
        export_frame_step=1, export_def_bones=True, export_skins=True, export_all_influences=False,
        export_morph=False, export_optimize_animation_size=False, export_anim_single_armature=True,
        export_current_frame=False)
    print("exported", glb, os.path.getsize(glb) // 1024, "KB")

tris = 0
for ob in bpy.data.objects:
    if ob.type == 'MESH':
        n = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        tris += n
        print("  %-22s %7d tris" % (ob.name, n))
print("TOTAL TRIS", tris)
