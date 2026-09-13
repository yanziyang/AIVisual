import numpy as np, os
ROOT = r"C:\MyProjects\TempProject (OpenCode)"
A = os.path.join(ROOT, "analysis")
for key, rows in (("front", (358, 402, 446)), ("rear", (369, 406, 440))):
    m = np.load(os.path.join(A, f"refmask_{key}.npy"))
    for r in rows:
        idx = np.flatnonzero(m[r])
        if len(idx):
            print(key, "row", r, "x", idx[0], "-", idx[-1], "w_mm", (idx[-1]-idx[0])*3.14)
print("DBG_DONE")
