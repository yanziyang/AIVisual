"""Small mesh / material toolkit shared by the Blender build scripts.

Everything is built with plain bpy + mathutils so the scripts run headless:
    blender -b --factory-startup --python-exit-code 1 -P blender/build.py
Coordinates: metres, X = forward (direction of travel), Y = rider's left, Z = up.
"""
import bpy
import bmesh
import math
from mathutils import Vector, Matrix, Quaternion

TAU = math.pi * 2.0


def V(x, y=None, z=None):
    if y is None:
        return Vector(x)
    return Vector((x, y, z))


def lerp(a, b, t):
    return a + (b - a) * t


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# --------------------------------------------------------------------------- scene

def clear_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.metaballs, bpy.data.curves,
                 bpy.data.armatures, bpy.data.actions, bpy.data.cameras, bpy.data.lights,
                 bpy.data.images):
        for d in list(coll):
            coll.remove(d)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)


def collection(name, parent=None):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(c)
    return c


def link(ob, col):
    for c in ob.users_collection:
        c.objects.unlink(ob)
    collection(col).objects.link(ob)
    return ob


# --------------------------------------------------------------------------- materials

_MATS = {}


def mat(name, color=(0.8, 0.8, 0.8), metallic=0.0, roughness=0.5, clearcoat=0.0,
        clearcoat_rough=0.03, specular=0.5, sheen=0.0, emission=None, alpha=1.0,
        transmission=0.0, ior=1.45):
    """Principled BSDF material; colours are given in sRGB and converted to linear."""
    if name in _MATS:
        return _MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    lin = [srgb_to_lin(c) for c in color[:3]]
    b.inputs["Base Color"].default_value = (*lin, 1.0)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = roughness
    b.inputs["Specular"].default_value = specular
    b.inputs["Clearcoat"].default_value = clearcoat
    b.inputs["Clearcoat Roughness"].default_value = clearcoat_rough
    b.inputs["Sheen"].default_value = sheen
    b.inputs["Transmission"].default_value = transmission
    b.inputs["IOR"].default_value = ior
    if emission:
        b.inputs["Emission"].default_value = (*[srgb_to_lin(c) for c in emission[:3]], 1)
        b.inputs["Emission Strength"].default_value = emission[3] if len(emission) > 3 else 1.0
    if alpha < 1.0:
        b.inputs["Alpha"].default_value = alpha
        m.blend_method = 'BLEND'
    m.diffuse_color = (*lin, 1.0)          # viewport / workbench colour
    m.roughness = roughness
    m.metallic = metallic
    _MATS[name] = m
    return m


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexcol(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


# --------------------------------------------------------------------------- objects

def make_mesh(name, verts, faces, mat_index=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.validate(clean_customdata=False)
    me.update(calc_edges=True)
    if mat_index is not None:
        me.polygons.foreach_set("material_index", mat_index)
    return me


def new_obj(name, me, col="Bike", mats=(), smooth=True, auto_smooth=35.0):
    ob = bpy.data.objects.new(name, me)
    collection(col).objects.link(ob)
    if me is not None and isinstance(me, bpy.types.Mesh):
        for m in mats:
            me.materials.append(m)
        shade(me, smooth, auto_smooth)
    return ob


def shade(me, smooth=True, auto_smooth=35.0):
    vals = [smooth] * len(me.polygons)
    me.polygons.foreach_set("use_smooth", vals)
    if auto_smooth:
        me.use_auto_smooth = True
        me.auto_smooth_angle = math.radians(auto_smooth)
    else:
        me.use_auto_smooth = False


class MeshBuilder:
    """Accumulates verts/faces/material indices; parts can be appended with a transform."""

    def __init__(self):
        self.v = []
        self.f = []
        self.m = []

    def add(self, verts, faces, mat=0, xf=None):
        base = len(self.v)
        if xf is not None:
            verts = [xf @ Vector(p) for p in verts]
        self.v.extend(Vector(p) for p in verts)
        self.f.extend(tuple(i + base for i in f) for f in faces)
        self.m.extend([mat] * len(faces))
        return base

    def extend(self, other, mat=None, xf=None):
        base = len(self.v)
        for p in other.v:
            self.v.append(xf @ p if xf is not None else p.copy())
        self.f.extend(tuple(i + base for i in f) for f in other.f)
        self.m.extend(other.m if mat is None else [mat] * len(other.f))

    def mesh(self, name):
        return make_mesh(name, self.v, self.f, self.m)

    def obj(self, name, mats, col="Bike", smooth=True, auto_smooth=35.0, recalc=True):
        me = self.mesh(name)
        if recalc:
            bm = bmesh.new()
            bm.from_mesh(me)
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            bm.to_mesh(me)
            bm.free()
        ob = new_obj(name, me, col, mats, smooth, auto_smooth)
        return ob


# --------------------------------------------------------------------------- primitives

def grid_faces(rings, n, closed=True, caps=False, base=0, flip=False):
    """Quads between `rings` consecutive loops of `n` vertices."""
    faces = []
    m = n if closed else n - 1
    for r in range(rings - 1):
        for i in range(m):
            a = base + r * n + i
            b = base + r * n + (i + 1) % n
            c = base + (r + 1) * n + (i + 1) % n
            d = base + (r + 1) * n + i
            faces.append((a, d, c, b) if flip else (a, b, c, d))
    return faces


def loft(rings, closed=True, cap_start=False, cap_end=False, flip=False):
    """rings: list of equal-length point lists. Returns verts, faces."""
    n = len(rings[0])
    verts = [Vector(p) for r in rings for p in r]
    faces = grid_faces(len(rings), n, closed, flip=flip)
    if cap_start:
        c = sum((Vector(p) for p in rings[0]), Vector()) / n
        ci = len(verts)
        verts.append(c)
        for i in range(n):
            j = (i + 1) % n
            faces.append((ci, j, i) if not flip else (ci, i, j))
    if cap_end:
        c = sum((Vector(p) for p in rings[-1]), Vector()) / n
        ci = len(verts)
        verts.append(c)
        o = (len(rings) - 1) * n
        for i in range(n):
            j = (i + 1) % n
            faces.append((ci, o + i, o + j) if not flip else (ci, o + j, o + i))
    return verts, faces


def rmf_frames(pts, up=Vector((0, 0, 1))):
    """Rotation-minimising frames (double reflection). Returns list of (T, N, B)."""
    n = len(pts)
    T = []
    for i in range(n):
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, n - 1)]
        T.append((b - a).normalized())
    N0 = up - T[0] * up.dot(T[0])
    if N0.length < 1e-5:
        N0 = Vector((1, 0, 0)) - T[0] * T[0].x
    N0.normalize()
    frames = [(T[0], N0, T[0].cross(N0))]
    for i in range(n - 1):
        Ti, Ni, _ = frames[-1]
        v1 = pts[i + 1] - pts[i]
        c1 = v1.dot(v1)
        if c1 < 1e-14:
            frames.append((T[i + 1], Ni, T[i + 1].cross(Ni)))
            continue
        rL = Ni - (2 / c1) * v1.dot(Ni) * v1
        tL = Ti - (2 / c1) * v1.dot(Ti) * v1
        v2 = T[i + 1] - tL
        c2 = v2.dot(v2)
        Nn = rL - (2 / c2) * v2.dot(rL) * v2 if c2 > 1e-14 else rL
        Nn = (Nn - T[i + 1] * Nn.dot(T[i + 1])).normalized()
        frames.append((T[i + 1], Nn, T[i + 1].cross(Nn)))
    return frames


def sweep(pts, profile, closed_profile=True, caps=True, up=Vector((0, 0, 1)), frames=None):
    """Sweep a 2-D profile along a polyline.

    profile: either a list of (x, y) used for every ring, or a callable
             f(i, s) -> list of (x, y) with s in 0..1 along the path.
             x runs along the frame normal N, y along the binormal B.
    """
    pts = [Vector(p) for p in pts]
    frames = frames or rmf_frames(pts, up)
    L = [0.0]
    for i in range(1, len(pts)):
        L.append(L[-1] + (pts[i] - pts[i - 1]).length)
    total = L[-1] or 1.0
    rings = []
    for i, p in enumerate(pts):
        T, N, B = frames[i]
        prof = profile(i, L[i] / total) if callable(profile) else profile
        rings.append([p + N * x + B * y for (x, y) in prof])
    return loft(rings, closed=closed_profile, cap_start=caps, cap_end=caps)


def circle(r, n, rx=None):
    rx = r if rx is None else rx
    return [(rx * math.cos(TAU * i / n), r * math.sin(TAU * i / n)) for i in range(n)]


def superellipse(a, b, n, e=2.5, offset=(0.0, 0.0)):
    out = []
    for i in range(n):
        t = TAU * i / n
        c, s = math.cos(t), math.sin(t)
        x = a * math.copysign(abs(c) ** (2 / e), c)
        y = b * math.copysign(abs(s) ** (2 / e), s)
        out.append((x + offset[0], y + offset[1]))
    return out


def revolve(profile, n, axis='Y', center=Vector((0, 0, 0)), closed_profile=False, phase=0.0):
    """Lathe a profile of (radius, axial) points around an axis. Returns verts, faces."""
    rings = []
    for (r, a) in profile:
        ring = []
        for i in range(n):
            t = TAU * i / n + phase
            c, s = math.cos(t) * r, math.sin(t) * r
            if axis == 'Y':
                ring.append(center + Vector((c, a, s)))
            elif axis == 'Z':
                ring.append(center + Vector((c, s, a)))
            else:
                ring.append(center + Vector((a, c, s)))
        rings.append(ring)
    # rings are along the profile; faces connect ring k to k+1 around the circle
    verts = [p for ring in rings for p in ring]
    faces = []
    m = len(profile) if closed_profile else len(profile) - 1
    for k in range(m):
        k2 = (k + 1) % len(profile)
        for i in range(n):
            j = (i + 1) % n
            faces.append((k * n + i, k * n + j, k2 * n + j, k2 * n + i))
    return verts, faces


def box(sx, sy, sz, center=Vector((0, 0, 0))):
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    v = [center + Vector((x, y, z)) for x in (-hx, hx) for y in (-hy, hy) for z in (-hz, hz)]
    f = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    return v, f


def cylinder(p0, p1, r, n=8, caps=True, r1=None):
    p0, p1 = Vector(p0), Vector(p1)
    r1 = r if r1 is None else r1
    d = (p1 - p0)
    T = d.normalized()
    up = Vector((0, 0, 1)) if abs(T.z) < 0.9 else Vector((1, 0, 0))
    N = (up - T * up.dot(T)).normalized()
    B = T.cross(N)
    rings = []
    for (p, rr) in ((p0, r), (p1, r1)):
        rings.append([p + N * (rr * math.cos(TAU * i / n)) + B * (rr * math.sin(TAU * i / n)) for i in range(n)])
    return loft(rings, cap_start=caps, cap_end=caps)


def uv_sphere(r, nu=16, nv=10, center=Vector((0, 0, 0)), scale=(1, 1, 1)):
    verts = [center + Vector((0, 0, -r * scale[2]))]
    for j in range(1, nv):
        ph = -math.pi / 2 + math.pi * j / nv
        for i in range(nu):
            th = TAU * i / nu
            verts.append(center + Vector((r * scale[0] * math.cos(ph) * math.cos(th),
                                           r * scale[1] * math.cos(ph) * math.sin(th),
                                           r * scale[2] * math.sin(ph))))
    verts.append(center + Vector((0, 0, r * scale[2])))
    faces = []
    for i in range(nu):
        faces.append((0, 1 + (i + 1) % nu, 1 + i))
    for j in range(nv - 2):
        for i in range(nu):
            a = 1 + j * nu + i
            b = 1 + j * nu + (i + 1) % nu
            faces.append((a, b, b + nu, a + nu))
    top = len(verts) - 1
    o = 1 + (nv - 2) * nu
    for i in range(nu):
        faces.append((o + i, o + (i + 1) % nu, top))
    return verts, faces


def toothed_ring(teeth, r_root, r_tip, r_in, y0, y1, samples=6, bevel=0.0, center=Vector((0, 0, 0))):
    """Sprocket / chainring: annulus with a toothed outer edge, axis = Y."""
    outer = []
    n = teeth * samples
    for i in range(n):
        u = (i % samples) / samples          # 0..1 inside one tooth pitch
        # tooth shape: valley at u=0, tip around u=0.5 (rounded)
        k = 0.5 - 0.5 * math.cos(TAU * u)
        k = k ** 0.8
        r = r_root + (r_tip - r_root) * k
        t = TAU * i / n
        outer.append((r, t))
    rings_y = [y0, y1]
    verts = []
    for y in rings_y:
        for (r, t) in outer:
            verts.append(center + Vector((r * math.cos(t), y, r * math.sin(t))))
    for y in rings_y:
        for (r, t) in outer:
            verts.append(center + Vector((r_in * math.cos(t), y, r_in * math.sin(t))))
    faces = []
    # outer wall
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, n + j, n + i))
    # inner wall
    o = 2 * n
    for i in range(n):
        j = (i + 1) % n
        faces.append((o + n + i, o + n + j, o + j, o + i))
    # faces y0 and y1
    for i in range(n):
        j = (i + 1) % n
        faces.append((o + i, o + j, j, i))
        faces.append((n + i, n + j, o + n + j, o + n + i))
    return verts, faces


def text_mesh(body, size=0.03, extrude=0.0, font_bold=False, align='CENTER'):
    cu = bpy.data.curves.new("txt_" + body, type='FONT')
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.align_x = align
    cu.align_y = 'CENTER'
    cu.fill_mode = 'BOTH'
    ob = bpy.data.objects.new("txt", cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
    return me


# --------------------------------------------------------------------------- metaballs

MB_THRESH = 0.6


def mb_radius_for(visible, stiffness):
    """Element radius whose lone-element iso-surface sits at `visible` distance."""
    return visible / math.sqrt(1.0 - (MB_THRESH / stiffness) ** (1.0 / 3.0))


class Meta:
    """Collects metaball elements and remembers which bone each belongs to."""

    def __init__(self, name, resolution=0.004, col="Bike"):
        self.mb = bpy.data.metaballs.new(name)
        self.mb.resolution = resolution
        self.mb.render_resolution = resolution
        self.mb.threshold = MB_THRESH
        self.mb.update_method = 'NEVER'
        self.ob = bpy.data.objects.new(name, self.mb)
        collection(col).objects.link(self.ob)
        self.elems = []   # (type, co, quat, radius, stiff, size, neg, tag)

    def _add(self, typ, co, rot, vis, stiff, size, neg, tag):
        e = self.mb.elements.new()
        e.type = typ
        e.co = Vector(co)
        e.rotation = rot
        e.radius = mb_radius_for(vis, stiff)
        e.stiffness = stiff
        e.use_negative = neg
        if typ in ('ELLIPSOID', 'CAPSULE', 'CUBE', 'PLANE'):
            e.size_x, e.size_y, e.size_z = size
        self.elems.append((typ, Vector(co), rot.copy(), e.radius, stiff, tuple(size), neg, tag))
        return e

    def ball(self, co, vis, stiff=3.0, tag=None, neg=False):
        return self._add('BALL', co, Quaternion(), vis, stiff, (1, 1, 1), neg, tag)

    def ellipsoid(self, co, axes, rot=None, stiff=3.0, tag=None, neg=False):
        """axes = visible semi-axes (x, y, z) in the element frame."""
        m = max(axes)
        size = tuple(a / m for a in axes)
        return self._add('ELLIPSOID', co, rot or Quaternion(), m, stiff, size, neg, tag)

    def capsule(self, p0, p1, vis, stiff=3.0, tag=None, neg=False):
        p0, p1 = Vector(p0), Vector(p1)
        d = p1 - p0
        rot = Vector((1, 0, 0)).rotation_difference(d.normalized()) if d.length > 1e-6 else Quaternion()
        e = self._add('CAPSULE', (p0 + p1) / 2, rot, vis, stiff, (d.length / 2, 1, 1), neg, tag)
        return e

    def tube(self, pts, radii, stiff=3.0, tag=None, k=0.25, aspect=None, up=Vector((0, 0, 1)), tags=None):
        """Smooth tapered tube along a polyline: a dense chain of ellipsoid elements.

        radii: visible radius at each control point (lerped between them).
        aspect: optional list of (sy, sz) cross-section scales per control point
                (sy along the frame normal N - derived from `up` - and sz along the binormal).
        With spacing k*R the summed field of the chain is ~ s/(kR) * 32/35 * (R^2-rho^2)^3.5 / R^6,
        so the element radius for a visible radius rho is rho / sqrt(1 - c^(2/7)), c = 35 t k / 32 s.
        """
        pts = [Vector(p) for p in pts]
        c = 35.0 * MB_THRESH * k / (32.0 * stiff)
        fac = 1.0 / math.sqrt(1.0 - c ** (2.0 / 7.0))
        seglen = [(pts[i + 1] - pts[i]).length for i in range(len(pts) - 1)]
        total = sum(seglen)
        frames = rmf_frames(pts, up)
        s = 0.0
        while s <= total + 1e-9:
            # locate segment
            acc = 0.0
            for i, L in enumerate(seglen):
                if acc + L >= s or i == len(seglen) - 1:
                    t = 0.0 if L == 0 else min(1.0, (s - acc) / L)
                    break
                acc += L
            p = pts[i].lerp(pts[i + 1], t)
            rho = lerp(radii[i], radii[i + 1], t)
            R = rho * fac
            T = (pts[i + 1] - pts[i]).normalized()
            N = frames[i][1].lerp(frames[i + 1][1], t)
            N = (N - T * N.dot(T)).normalized()
            B = T.cross(N)
            rot = Matrix((T, N, B)).transposed().to_quaternion()
            sy, sz = (1.0, 1.0)
            if aspect:
                sy = lerp(aspect[i][0], aspect[i + 1][0], t)
                sz = lerp(aspect[i][1], aspect[i + 1][1], t)
            tg = tag
            if tags:
                tg = tags[i] if t < 0.5 or i + 1 >= len(tags) else tags[i + 1]
            e = self.mb.elements.new()
            e.type = 'ELLIPSOID'
            e.co = p
            e.rotation = rot
            e.radius = R
            e.stiffness = stiff
            e.size_x, e.size_y, e.size_z = 1.0, sy, sz
            self.elems.append(('ELLIPSOID', p.copy(), rot.copy(), R, stiff, (1.0, sy, sz), False, tg))
            s += max(k * R, 0.0008)

    def field(self, p):
        """Evaluate each element's density at p (Blender's exact formula). Returns list."""
        out = []
        for (typ, co, rot, rad, s, size, neg, tag) in self.elems:
            d = rot.inverted() @ (Vector(p) - co)
            if typ == 'CAPSULE':
                x = d.x
                d.x = x - size[0] if x > size[0] else (x + size[0] if x < -size[0] else 0.0)
            elif typ == 'ELLIPSOID':
                d = Vector((d.x / size[0], d.y / size[1], d.z / size[2]))
            q = 1.0 - d.length_squared / (rad * rad)
            v = 0.0 if q <= 0 else s * q * q * q
            out.append(-v if neg else v)
        return out

    def to_mesh(self, name):
        dg = bpy.context.evaluated_depsgraph_get()
        self.mb.update_method = 'UPDATE_ALWAYS'
        dg.update()
        me = bpy.data.meshes.new_from_object(self.ob.evaluated_get(dg))
        me.name = name
        return me

    def remove(self):
        bpy.data.objects.remove(self.ob)
        bpy.data.metaballs.remove(self.mb)


def cleanup_mesh(me, merge=0.0004, decimate=None, smooth_iters=0, target_tris=None):
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=merge)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if smooth_iters:
        for _ in range(smooth_iters):
            bmesh.ops.smooth_vert(bm, verts=bm.verts, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    tris = sum(len(f.verts) - 2 for f in bm.faces)
    bm.to_mesh(me)
    bm.free()
    if target_tris:
        decimate = min(1.0, target_tris / max(1, tris))
    if decimate and decimate < 0.999:
        tmp = bpy.data.objects.new("dec_tmp", me)
        bpy.context.scene.collection.objects.link(tmp)
        mod = tmp.modifiers.new("dec", 'DECIMATE')
        mod.ratio = decimate
        mod.use_collapse_triangulate = True
        dg = bpy.context.evaluated_depsgraph_get()
        new = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
        bpy.data.objects.remove(tmp)
        me2 = new
        me2.name = me.name
        return me2
    return me


def apply_modifiers(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    if old.users == 0:
        bpy.data.meshes.remove(old)
    return ob


def parent_to_bone(ob, arm, bone_name):
    """Parent keeping the current world transform."""
    mw = ob.matrix_world.copy()
    ob.parent = arm
    ob.parent_type = 'BONE'
    ob.parent_bone = bone_name
    bpy.context.view_layer.update()
    pb = arm.pose.bones[bone_name]
    # bone parenting is relative to the bone tail
    tail_mat = arm.matrix_world @ pb.matrix @ Matrix.Translation((0, pb.length, 0))
    ob.matrix_parent_inverse = tail_mat.inverted()
    ob.matrix_world = mw
    return ob
