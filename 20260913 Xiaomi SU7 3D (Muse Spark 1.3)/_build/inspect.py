import bpy
for o in bpy.data.objects:
    try:
        dims = o.dimensions
        if max(dims) > 1.0:
            print(f"{o.name} loc={tuple(round(v,3) for v in o.location)} scale={tuple(round(v,3) for v in o.scale)} dims={tuple(round(v,3) for v in dims)}")
    except Exception as e:
        print(o.name, e)
