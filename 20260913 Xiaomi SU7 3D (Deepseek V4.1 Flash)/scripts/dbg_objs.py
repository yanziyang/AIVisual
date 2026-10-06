import bpy, numpy as np, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT, "_build", "su7_build.blend"))
for ob in bpy.data.objects:
    if ob.type == "MESH":
        me = ob.data
        if len(me.vertices):
            co = np.array([v.co[:] for v in me.vertices])
            print(f"{ob.name}: verts={len(me.vertices)} min={co.min(axis=0).round(2)} max={co.max(axis=0).round(2)} loc={tuple(round(c,2) for c in ob.location)}")
        else:
            print(f"{ob.name}: EMPTY MESH")
print("DBG_DONE")
