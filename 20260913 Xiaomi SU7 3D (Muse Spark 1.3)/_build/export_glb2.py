import bpy, os
base = r"C:\MyProjects\TempProject (OpenCode)"
# Apply BOOLEAN mods on Body first (keep wheel arches), then delete cutters/lights/cams
bpy.ops.object.select_all(action='DESELECT')
body = bpy.data.objects.get("Body")
if body:
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    for m in list(body.modifiers):
        if m.type == 'BOOLEAN':
            try:
                bpy.ops.object.modifier_apply(modifier=m.name)
                print("Applied", m.name)
            except Exception as e:
                print("Apply fail", m.name, e)
    bpy.ops.object.select_all(action='DESELECT')

for o in list(bpy.data.objects):
    n = o.name.lower()
    if n.startswith("cut") or "archcut" in n or o.type in ('LIGHT','CAMERA'):
        try:
            bpy.data.objects.remove(o, do_unlink=True)
        except Exception as e:
            print("skip", o.name, e)
# remove target empty
for o in list(bpy.data.objects):
    if o.type == 'EMPTY' or o.name in ('Tgt','CamTarget','Target'):
        try: bpy.data.objects.remove(o, do_unlink=True)
        except: pass

for o in bpy.data.objects:
    o.hide_render = False
    o.hide_viewport = False

bpy.ops.object.select_all(action='DESELECT')
for o in list(bpy.data.objects):
    if o.type == 'FONT':
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        try: bpy.ops.object.convert(target='MESH')
        except Exception as e: print("font fail", e)
        bpy.ops.object.select_all(action='DESELECT')

for o in bpy.data.objects:
    if o.type == 'MESH':
        if o.name == "Ground" or (o.dimensions[0] > 20):
            continue
        # skip original ground plane 30m
        if "Ground" in o.name:
            continue
        o.select_set(True)

out = os.path.join(base, "su7.glb")
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=True, export_materials='EXPORT', export_cameras=False, export_lights=False)
print("EXPORTED GLB to", out)
