"""Build the Eiffel Tower scene and export it as a GLB for the web viewer.

Run with:
  blender -b --factory-startup --python tools/export_glb.py
"""

import bpy
import sys
import os

PROJ = r"C:\MyProjects\TempProject\eiffel"
sys.path.insert(0, PROJ)

import build_eiffel as be


def srgb2lin(c):
    return be.srgb2lin(c)


def export_mat(name, color, rough=0.8, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (color[0], color[1], color[2], 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return m


def main():
    scene = be.clear_scene()
    be.setup_world(scene)
    be.setup_sun(scene)
    be.add_people()
    be.add_ground()
    tower = be.build_tower()
    print("TOWER verts=%d faces=%d" % (len(tower.data.vertices), len(tower.data.polygons)))

    # Export-friendly tower material: white base *vertex colors (Col attribute).
    pm = export_mat("EiffelPaintExport", (1.0, 1.0, 1.0), rough=0.55, metal=0.25)
    tower.data.materials[0] = pm
    me = tower.data
    ca = me.color_attributes.get("Col")
    if ca:
        me.color_attributes.active_color = ca

    # Flatten procedural materials that cannot be exported as-is.
    grass = bpy.data.objects.get("Grass")
    if grass:
        grass.data.materials[0] = export_mat(
            "GrassFlat", srgb2lin((0.34, 0.42, 0.15)), rough=0.95)
    fol = bpy.data.objects.get("Foliage")
    if fol:
        fol.data.materials[0] = export_mat(
            "FoliageFlat", srgb2lin((0.16, 0.24, 0.085)), rough=0.92)

    out = os.path.join(PROJ, "out", "eiffel.glb")
    plain = "plain" in sys.argv
    if plain:
        out = os.path.join(PROJ, "out", "eiffel_plain.glb")
    kw = dict(
        filepath=out, export_format="GLB",
        export_cameras=False, export_lights=False,
        export_apply=True, export_yup=True,
        export_texcoords=False, export_normals=True,
        export_colors=True, export_materials="EXPORT",
        use_selection=False,
    )
    if plain:
        bpy.ops.export_scene.gltf(**kw)
        print("EXPORTED (plain) ->", out)
    else:
        try:
            bpy.ops.export_scene.gltf(
                export_draco_mesh_compression_enable=True,
                export_draco_mesh_compression_level=6, **kw)
            print("EXPORTED (draco) ->", out)
        except TypeError as e:
            print("draco export failed (%s), retrying plain" % e)
            bpy.ops.export_scene.gltf(**kw)
            print("EXPORTED (plain) ->", out)
    print("SIZE", os.path.getsize(out))


if __name__ == "__main__":
    main()
