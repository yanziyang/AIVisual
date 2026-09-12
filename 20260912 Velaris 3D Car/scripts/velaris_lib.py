"""VELARIS supercar build - shared helpers for mesh, material and scene authoring."""

import bpy
import bmesh
from math import sin, cos, pi, radians
from mathutils import Vector, Matrix


class CR:
    """Non-uniform Catmull-Rom interpolation over sorted (x, value) knots."""

    def __init__(self, knots):
        self.knots = sorted(knots)

    def __call__(self, x):
        ks = self.knots
        if x <= ks[0][0]:
            return ks[0][1]
        if x >= ks[-1][0]:
            return ks[-1][1]
        i = 0
        while ks[i + 1][0] < x:
            i += 1
        x0, v0 = ks[i]
        x1, v1 = ks[i + 1]
        xm, vm = ks[i - 1] if i > 0 else ks[i]
        xp, vp = ks[i + 2] if i + 2 < len(ks) else ks[i + 1]
        h = x1 - x0
        t = (x - x0) / h
        m0 = ((v1 - vm) / (x1 - xm)) * h if x1 > xm else 0.0
        m1 = ((vp - v0) / (xp - x0)) * h if xp > x0 else 0.0
        t2 = t * t
        t3 = t2 * t
        return ((2 * t3 - 3 * t2 + 1) * v0 + (t3 - 2 * t2 + t) * m0
                + (-2 * t3 + 3 * t2) * v1 + (t3 - t2) * m1)


def smoothstep(a, b, x):
    if b == a:
        return 0.0
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def lerp3(a, b, t):
    return a + (b - a) * t


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.objects):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def get_collection(name):
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
    return col


def make_mesh_object(name, verts, faces, collection=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.validate(verbose=False)
    ob = bpy.data.objects.new(name, me)
    (collection or bpy.context.scene.collection).objects.link(ob)
    recalc_normals(ob)
    return ob


def recalc_normals(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def apply_modifiers(obj):
    for o in list(bpy.context.selected_objects):
        o.select_set(False)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    with bpy.context.temp_override(object=obj, active_object=obj,
                                   selected_objects=[obj],
                                   selected_editable_objects=[obj]):
        for m in list(obj.modifiers):
            try:
                bpy.ops.object.modifier_apply(modifier=m.name)
            except Exception as exc:
                print("WARN modifier apply failed:", obj.name, m.name, exc)


def add_subsurf(obj, levels=2, render_levels=None):
    m = obj.modifiers.new("Subsurf", "SUBSURF")
    m.levels = levels
    m.render_levels = render_levels if render_levels is not None else levels
    return m


def add_bevel(obj, width=0.008, segments=2, angle=None):
    m = obj.modifiers.new("Bevel", "BEVEL")
    m.width = width
    m.segments = segments
    if angle is not None:
        m.limit_method = "ANGLE"
        m.angle_limit = radians(angle)
    return m


def add_solidify(obj, thickness=0.004, offset=0.0):
    m = obj.modifiers.new("Solidify", "SOLIDIFY")
    m.thickness = thickness
    m.offset = offset
    return m


def boolean_cut(target, cutter):
    m = target.modifiers.new("Bool", "BOOLEAN")
    m.operation = "DIFFERENCE"
    m.solver = "EXACT"
    m.object = cutter
    apply_modifiers(target)
    bpy.data.objects.remove(cutter, do_unlink=True)


def shade_smooth(obj, angle=40.0):
    for p in obj.data.polygons:
        p.use_smooth = True
    if hasattr(obj.data, "use_auto_smooth"):
        obj.data.use_auto_smooth = True
        obj.data.auto_smooth_angle = radians(angle)


def join_objects(objects, name):
    for o in list(bpy.context.selected_objects):
        o.select_set(False)
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    with bpy.context.temp_override(active_object=objects[0],
                                   selected_objects=objects,
                                   selected_editable_objects=objects):
        bpy.ops.object.join()
    ob = objects[0]
    ob.name = name
    ob.data.name = name
    return ob


INPUT_ALIASES = {
    "Transmission Weight": ("Transmission Weight", "Transmission"),
    "Transmission Roughness": ("Transmission Roughness",),
    "Coat Weight": ("Coat Weight", "Clearcoat"),
    "Coat Roughness": ("Coat Roughness", "Clearcoat Roughness"),
    "Sheen Weight": ("Sheen Weight", "Sheen"),
    "Emission Color": ("Emission Color", "Emission"),
    "Specular IOR Level": ("Specular IOR Level", "Specular"),
}


def set_input(node, name, value):
    for alias in INPUT_ALIASES.get(name, (name,)):
        try:
            node.inputs[alias].default_value = value
            return True
        except Exception:
            continue
    return False


def new_material(name):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    return mat, mat.node_tree, mat.node_tree.nodes.get("Principled BSDF")


def principled(name, base=(0.5, 0.5, 0.5, 1.0), metallic=0.0, roughness=0.5,
               coat=0.0, coat_rough=0.03, transmission=0.0, ior=1.45,
               emission=None, emission_strength=0.0, sheen=0.0,
               sheen_rough=0.3, sheen_tint=(1, 1, 1, 1), anisotropic=0.0,
               specular=0.5, alpha=1.0, tangent=None):
    mat, nt, bsdf = new_material(name)
    set_input(bsdf, "Base Color", base)
    set_input(bsdf, "Metallic", metallic)
    set_input(bsdf, "Roughness", roughness)
    set_input(bsdf, "IOR", ior)
    set_input(bsdf, "Alpha", alpha)
    set_input(bsdf, "Coat Weight", coat)
    set_input(bsdf, "Coat Roughness", coat_rough)
    set_input(bsdf, "Transmission Weight", transmission)
    set_input(bsdf, "Sheen Weight", sheen)
    set_input(bsdf, "Sheen Roughness", sheen_rough)
    set_input(bsdf, "Sheen Tint", sheen_tint)
    set_input(bsdf, "Anisotropic", anisotropic)
    set_input(bsdf, "Specular IOR Level", specular)
    if emission is not None:
        set_input(bsdf, "Emission Color", emission)
        set_input(bsdf, "Emission Strength", emission_strength)
    if tangent is not None:
        set_input(bsdf, "Tangent", tangent)
    return mat


def emission_material(name, color=(1, 1, 1, 1), strength=10.0):
    mat, nt, bsdf = new_material(name)
    set_input(bsdf, "Base Color", (0.02, 0.02, 0.02, 1))
    set_input(bsdf, "Roughness", 0.4)
    set_input(bsdf, "Emission Color", color)
    set_input(bsdf, "Emission Strength", strength)
    return mat


def assign_material(obj, mat, index=None):
    if index is None:
        obj.data.materials.append(mat)
        index = len(obj.data.materials) - 1
    else:
        while len(obj.data.materials) <= index:
            obj.data.materials.append(None)
        obj.data.materials[index] = mat
    return index


def make_text(body, size, matrix=None, extrude=0.004, bevel=0.0007, name="Text",
              collection=None):
    bpy.ops.object.text_add(location=(0, 0, 0))
    ob = bpy.context.active_object
    ob.name = name
    ob.data.body = body
    ob.data.size = size
    ob.data.extrude = extrude
    ob.data.bevel_depth = bevel
    ob.data.bevel_resolution = 2
    ob.data.align_x = "CENTER"
    ob.data.align_y = "CENTER"
    with bpy.context.temp_override(active_object=ob, object=ob,
                                   selected_objects=[ob],
                                   selected_editable_objects=[ob]):
        bpy.ops.object.convert(target="MESH")
    ob = bpy.context.active_object
    if matrix is not None:
        ob.matrix_world = matrix
    if collection is not None:
        for c in list(ob.users_collection):
            c.objects.unlink(ob)
        collection.objects.link(ob)
    return ob


def matrix_from_axes(location, x_dir, y_dir, z_dir):
    z = Vector(z_dir).normalized()
    y = (Vector(y_dir) - z * Vector(y_dir).dot(z))
    if y.length < 1e-8:
        y = Vector((0.0, 1.0, 0.0))
    y.normalize()
    x = y.cross(z)
    rot = Matrix((
        (x.x, y.x, z.x, 0.0),
        (x.y, y.y, z.y, 0.0),
        (x.z, y.z, z.z, 0.0),
        (0.0, 0.0, 0.0, 1.0),
    ))
    return Matrix.Translation(Vector(location)) @ rot


def cylinder_mesh(name, radius, depth, segments=48, ax="Z", collection=None, fill="NGON"):
    bpy.ops.mesh.primitive_cylinder_add(vertices=segments, radius=radius,
                                        depth=depth, end_fill_type=fill,
                                        location=(0, 0, 0))
    ob = bpy.context.active_object
    ob.name = name
    if ax == "Y":
        ob.rotation_euler = (radians(90), 0, 0)
    elif ax == "X":
        ob.rotation_euler = (0, radians(90), 0)
    if collection is not None:
        for c in list(ob.users_collection):
            c.objects.unlink(ob)
        collection.objects.link(ob)
    return ob


def box_mesh(name, size, location=(0, 0, 0), rotation=(0, 0, 0), collection=None):
    hx, hy, hz = size[0] / 2.0, size[1] / 2.0, size[2] / 2.0
    verts = [(-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
             (-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)]
    faces = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1),
             (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    ob = make_mesh_object(name, verts, faces, collection)
    ob.location = location
    ob.rotation_euler = rotation
    return ob


def apply_scale(obj):
    for o in list(bpy.context.selected_objects):
        o.select_set(False)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    with bpy.context.temp_override(object=obj, active_object=obj,
                                   selected_objects=[obj],
                                   selected_editable_objects=[obj]):
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
