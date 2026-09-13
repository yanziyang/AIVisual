import numpy as np, os, json, bpy
ROOT = r"C:\MyProjects\TempProject (OpenCode)"
REN = os.path.join(ROOT, "renders"); A = os.path.join(ROOT, "analysis")
meta = json.load(open(os.path.join(REN, "cam_meta.json")))
for view, mm_scale, gnd_ref in (("front", 3.1413, 491), ("rear", 3.2286, 517)):
    cm = meta[view]
    mmpx = cm["mm_px"]*1000
    img = bpy.data.images.load(os.path.join(REN, f"r7_{view}_mask.png"))
    w, h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1]
    m = a[..., 3] > 0.5
    bpy.data.images.remove(img)
    print("==", view, "ren_scale", round(mmpx,3))
    for z in (150, 300, 450, 600, 750, 900, 1050, 1200, 1350):
        row = int(round(cm["ground_py"] - z/mmpx))
        idx = np.flatnonzero(m[row]) if 0 <= row < h else []
        rr = int(round(gnd_ref - z/(mm_scale if view=="front" else 3.410)))
        ref = np.load(os.path.join(A, f"refmask_{view}.npy"))
        ridx = np.flatnonzero(ref[rr]) if 0 <= rr < ref.shape[0] else []
        ws = f"ren_w={(idx[-1]-idx[0])*mmpx:.0f}" if len(idx) else "ren_w=--"
        rs = f"ref_w={(ridx[-1]-ridx[0])*mm_scale:.0f}" if len(ridx) else "ref_w=--"
        print(f"  z{z}: {ws} {rs}")
print("DBG_DONE")
