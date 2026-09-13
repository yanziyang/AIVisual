import bpy, numpy as np
bpy.ops.wm.open_mainfile(filepath=r"C:\MyProjects\TempProject (OpenCode)\su7_build.blend")
ob = bpy.data.objects["Body"]
me = ob.data
co = np.array([v.co[:] for v in me.vertices])
sel = np.abs(co[:,1] - 1.5) < 0.06
print("max z at front axle region:", co[sel][:,2].max(), " (design ~0.912)")
sel2 = np.abs(co[:,1] - 0.0) < 0.06
print("max z at y=0:", co[sel2][:,2].max(), " top keys 1.452")
sel3 = np.abs(co[:,1] - (-0.4)) < 0.06
print("max z at y=-0.4:", co[sel3][:,2].max(), " top keys 1.447")
sel4 = np.abs(co[:,1] - 2.3) < 0.06
print("max z at y=2.3:", co[sel4][:,2].max(), " top keys 0.64")
print("max |x|:", np.abs(co[:,0]).max())
print("y range:", co[:,1].min(), co[:,1].max())
# width at z=0.6, y=0
selw = (np.abs(co[:,1]-0.0)<0.06) & (np.abs(co[:,2]-0.6)<0.03)
print("half width @ y0 z0.6:", np.abs(co[selw][:,0]).max())
selw2 = (np.abs(co[:,1]-1.5)<0.06) & (np.abs(co[:,2]-0.6)<0.03)
print("half width @ y1.5 z0.6:", np.abs(co[selw2][:,0]).max())
print("DBG_DONE")
