import bpy
import sys
from mathutils import Vector

rows = []
deps = bpy.context.evaluated_depsgraph_get()
for o in bpy.data.objects:
    if o.type != "MESH":
        continue
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    mn = Vector((min(v.x for v in bb), min(v.y for v in bb), min(v.z for v in bb)))
    mx = Vector((max(v.x for v in bb), max(v.y for v in bb), max(v.z for v in bb)))
    vol = (mx.x - mn.x) * (mx.y - mn.y) * (mx.z - mn.z)
    rows.append((vol, o.name, tuple(round(v, 2) for v in (mx - mn)), tuple(round(v, 2) for v in mn), tuple(round(v, 2) for v in mx), len(o.data.vertices)))
rows.sort(reverse=True)
for r in rows[:45]:
    print("VOL %.4f  %-24s dim=%-22s min=%-24s max=%-24s verts=%d" % r)
