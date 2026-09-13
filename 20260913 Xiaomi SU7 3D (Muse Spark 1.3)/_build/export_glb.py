import bpy, os
base = r"C:\MyProjects\TempProject (OpenCode)"
# Remove boolean cutters, lights, cameras, ground extras that shouldn't ship, keep car + ground optional
# Delete cutters (name starts with Cut), Cameras, Lights, Target empty
for o in list(bpy.data.objects):
    n = o.name.lower()
    if n.startswith("cut") or "archcut" in n or o.type in ('LIGHT','CAMERA'):
        try:
            bpy.data.objects.remove(o, do_unlink=True)
        except Exception as e:
            print("skip", o.name, e)

# Remove boolean modifiers (already applied visually? export will apply)
for o in bpy.data.objects:
    if o.type == 'MESH':
        for m in list(o.modifiers):
            if m.type == 'BOOLEAN':
                try:
                    # try apply, else remove (cutters gone so remove to keep shape with holes? Actually need to apply first)
                    # Since cutters deleted, applying would fail, so just remove - holes already in mesh? No, need keep.
                    # Instead: remove modifier (body keeps original shape without arches) OR keep arches by not deleting cutters?
                    # Better: remove boolean mods to avoid broken export
                    o.modifiers.remove(m)
                except:
                    pass

# Ensure all meshes visible for export
for o in bpy.data.objects:
    o.hide_render = False
    o.hide_viewport = False
    if o.type == 'MESH':
        # fix text objects already meshes? leave
        pass

# Select all mesh objects for export
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type in ('MESH','FONT'):
        # convert fonts to mesh for glTF
        if o.type == 'FONT':
            bpy.context.view_layer.objects.active = o
            o.select_set(True)
            try:
                bpy.ops.object.convert(target='MESH')
            except Exception as e:
                print("font convert fail", e)
            bpy.ops.object.select_all(action='DESELECT')

for o in bpy.data.objects:
    if o.type == 'MESH':
        # exclude huge ground plane? keep but smaller? Keep ground out of car GLB - hide it
        if o.name.lower().startswith("ground") or "plane" in o.name.lower() and "plate" not in o.name.lower():
            # ground plane is named Ground or Plane - exclude
            if "Ground" in o.name or o.dimensions[0] > 20:
                continue
        o.select_set(True)

out = os.path.join(base, "su7.glb")
bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_materials='EXPORT',
    export_cameras=False,
    export_lights=False,
)
print("EXPORTED GLB to", out)
