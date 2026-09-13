import bpy
for o in bpy.data.objects:
    if "Plate" in o.name or "Text" in o.name or "DRL" in o.name or "Front" in o.name or o.type in ('FONT','LIGHT','CAMERA'):
        try:
            print(f"{o.name} type={o.type} loc={tuple(round(v,3) for v in o.location)} scale={tuple(round(v,3) for v in o.scale)} dims={tuple(round(v,3) for v in o.dimensions)} rot={tuple(round(v,3) for v in o.rotation_euler)}")
        except Exception as e:
            print(o.name, e)
print("---ALL MESH COUNT---", len([o for o in bpy.data.objects if o.type=='MESH']))
for o in bpy.data.objects:
    if o.type=='MESH':
        d=o.dimensions
        if d[0]>0.6 and d[1]>0.6 and d[2]>0.3:
            print(f"BIG {o.name} dims={tuple(round(v,3) for v in d)} loc={tuple(round(v,3) for v in o.location)}")
