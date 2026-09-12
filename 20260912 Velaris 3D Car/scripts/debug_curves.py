import bpy
import sys
import os

sys.path.append(os.path.join(os.path.dirname(os.path.abspath(bpy.data.filepath)), "..", "scripts"))
sys.path.append(r"C:\MyProjects\TempProject (OpenCode)\velaris\scripts")
import velaris_body as vb

h = vb.HULL
x = 2.45
while x >= -2.45:
    p = h.params(x)
    print("x=%6.3f wm=%.3f zs=%.3f zb=%.3f zt=%.3f nlow=%.2f nup=%.2f tum=%.2f"
          % (x, p["wm"], p["zs"], p["zb"], p["zt"], p["nlow"], p["nup"], p["tum"]))
    x -= 0.1
