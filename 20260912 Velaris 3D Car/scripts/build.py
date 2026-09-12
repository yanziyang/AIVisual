"""VELARIS build orchestrator. Run: blender -b -P build.py -- [options]"""

import bpy
import sys
import os
import time

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.append(HERE)

import velaris_lib as vl
import velaris_body as vb
import velaris_wheels as vw
import velaris_interior as vi
import velaris_scene as vs

ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "output")
RENDERS = os.path.join(ROOT, "renders")


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    opts = {"render": "", "samples": 32, "res": "1280x720", "glb": True}
    for i, a in enumerate(argv):
        if a == "--render" and i + 1 < len(argv):
            opts["render"] = argv[i + 1]
        elif a == "--samples" and i + 1 < len(argv):
            opts["samples"] = int(argv[i + 1])
        elif a == "--res" and i + 1 < len(argv):
            opts["res"] = argv[i + 1]
        elif a == "--no-glb":
            opts["glb"] = False
    return opts


def main():
    t0 = time.time()
    opts = parse_args()
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(RENDERS, exist_ok=True)

    vl.reset_scene()
    mats = vs.build_materials()

    body_col = vl.get_collection("VELARIS_Body")
    wheels_col = vl.get_collection("VELARIS_Wheels")
    interior_col = vl.get_collection("VELARIS_Interior")

    print("== body ==")
    vb.build(body_col, mats)
    print("   body done %.1fs" % (time.time() - t0))
    print("== wheels ==")
    vw.build(wheels_col, mats)
    print("   wheels done %.1fs" % (time.time() - t0))
    print("== interior ==")
    vi.build(interior_col, mats)
    print("   interior done %.1fs" % (time.time() - t0))

    ground = vs.build_studio()
    vl.assign_material(ground, mats["ground"], 0)
    vs.build_world()
    vs.build_lights()
    vs.build_cameras()
    vs.configure_render(samples=opts["samples"],
                        res=tuple(int(v) for v in opts["res"].split("x")))

    blend_path = os.path.join(OUT, "velaris_supercar.blend")
    vs.save_blend(blend_path)
    print("SAVED", blend_path, "%.1fs" % (time.time() - t0))

    if opts["glb"]:
        vs.export_glb(os.path.join(OUT, "velaris_supercar.glb"))

    if opts["render"]:
        names = [n.strip() for n in opts["render"].split(",") if n.strip()]
        vs.render_views(names, RENDERS, samples=opts["samples"],
                        res=tuple(int(v) for v in opts["res"].split("x")))
    print("TOTAL %.1fs" % (time.time() - t0))


main()
