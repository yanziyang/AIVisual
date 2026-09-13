import bpy, numpy as np
bpy.ops.wm.open_mainfile(filepath=r"C:\MyProjects\TempProject (OpenCode)\su7_build.blend")
for ob in bpy.data.objects:
    if ob.type == "MESH":
        me = ob.data
        if len(me.vertices):
            co = np.array([(ob.matrix_world @ v.co)[:] for v in me.vertices])
            sz = co.max(axis=0) - co.min(axis=0)
            if max(sz) > 1.2 or (co[:,2].max() > 1.35 and co[:,2].min() < 1.4 and "Body" not in ob.name):
                print(f"{ob.name}: size={np.round(sz,2)} zmax={co[:,2].max():.2f} bbox_min={np.round(co.min(axis=0),2)}")
print("DBG_DONE")
