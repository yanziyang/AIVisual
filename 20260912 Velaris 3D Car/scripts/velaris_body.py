"""VELARIS body: procedural lofted hull, glazing, panel seams, lamps, fascia."""

import bpy
import bmesh
import velaris_lib as vl
from math import sin, cos, pi, radians, asin, acos
from mathutils import Vector, Matrix

PAINT, GLASS, DARK = 0, 1, 2

STATIONS = [
    dict(x=2.450, wm=0.100, zs=0.380, zb=0.240, zt=0.420, nlow=3.0, nup=2.4, tum=0.00),
    dict(x=2.425, wm=0.300, zs=0.430, zb=0.160, zt=0.465, nlow=3.0, nup=2.4, tum=0.00),
    dict(x=2.365, wm=0.530, zs=0.485, zb=0.120, zt=0.520, nlow=3.2, nup=2.4, tum=0.02),
    dict(x=2.280, wm=0.720, zs=0.535, zb=0.108, zt=0.560, nlow=3.4, nup=2.5, tum=0.03),
    dict(x=2.160, wm=0.870, zs=0.585, zb=0.102, zt=0.605, nlow=3.6, nup=2.6, tum=0.04),
    dict(x=2.020, wm=0.935, zs=0.625, zb=0.100, zt=0.650, nlow=3.8, nup=2.6, tum=0.05),
    dict(x=1.860, wm=0.968, zs=0.670, zb=0.100, zt=0.705, nlow=4.0, nup=2.7, tum=0.05),
    dict(x=1.660, wm=0.982, zs=0.715, zb=0.102, zt=0.770, nlow=4.2, nup=2.7, tum=0.05),
    dict(x=1.450, wm=0.990, zs=0.750, zb=0.105, zt=0.858, nlow=4.2, nup=2.7, tum=0.06),
    dict(x=1.200, wm=0.982, zs=0.765, zb=0.110, zt=0.875, nlow=4.2, nup=2.8, tum=0.07),
    dict(x=0.950, wm=0.972, zs=0.775, zb=0.115, zt=0.905, nlow=4.2, nup=2.9, tum=0.09),
    dict(x=0.700, wm=0.964, zs=0.785, zb=0.120, zt=1.020, nlow=4.2, nup=3.4, tum=0.16),
    dict(x=0.420, wm=0.958, zs=0.795, zb=0.125, zt=1.150, nlow=4.2, nup=3.8, tum=0.24),
    dict(x=0.080, wm=0.956, zs=0.800, zb=0.125, zt=1.213, nlow=4.2, nup=4.0, tum=0.28),
    dict(x=-0.260, wm=0.962, zs=0.810, zb=0.125, zt=1.210, nlow=4.2, nup=4.0, tum=0.28),
    dict(x=-0.560, wm=0.974, zs=0.820, zb=0.127, zt=1.140, nlow=4.2, nup=3.6, tum=0.24),
    dict(x=-0.850, wm=0.984, zs=0.828, zb=0.129, zt=1.020, nlow=4.2, nup=3.1, tum=0.15),
    dict(x=-1.120, wm=0.991, zs=0.834, zb=0.131, zt=0.968, nlow=4.2, nup=2.9, tum=0.08),
    dict(x=-1.450, wm=0.995, zs=0.838, zb=0.135, zt=0.952, nlow=4.2, nup=2.8, tum=0.05),
    dict(x=-1.800, wm=0.988, zs=0.830, zb=0.142, zt=0.942, nlow=4.1, nup=2.8, tum=0.04),
    dict(x=-2.080, wm=0.972, zs=0.812, zb=0.152, zt=0.930, nlow=4.0, nup=2.7, tum=0.04),
    dict(x=-2.320, wm=0.908, zs=0.782, zb=0.168, zt=0.902, nlow=3.8, nup=2.6, tum=0.03),
    dict(x=-2.425, wm=0.780, zs=0.742, zb=0.192, zt=0.862, nlow=3.6, nup=2.6, tum=0.03),
    dict(x=-2.450, wm=0.560, zs=0.700, zb=0.235, zt=0.805, nlow=3.2, nup=2.6, tum=0.03),
]

KEYS = ("wm", "zs", "zb", "zt", "nlow", "nup", "tum")
WELLS = ((1.45, 0.355, 0.405), (-1.45, 0.360, 0.425))


class Hull:
    def __init__(self, stations):
        self.cr = {k: vl.CR([(s["x"], s[k]) for s in stations]) for k in KEYS}
        xs = [s["x"] for s in stations]
        self.xmin, self.xmax = min(xs), max(xs)

    def params(self, x):
        x = max(self.xmin, min(self.xmax, x))
        return {k: self.cr[k](x) for k in KEYS}

    def point(self, x, t):
        p = self.params(x)
        wm, zs, zb, zt = p["wm"], p["zs"], p["zb"], p["zt"]
        nlow, nup, tum = p["nlow"], p["nup"], p["tum"]
        t = t % 1.0
        if t <= 0.25:
            phi = (t / 0.25) * (pi / 2)
            y = -wm * (sin(phi) ** (2.0 / nlow))
            z = zb + (zs - zb) * (1.0 - cos(phi) ** (2.0 / nlow))
        elif t <= 0.5:
            u = ((t - 0.25) / 0.25) * (pi / 2)
            zf = sin(u) ** (2.0 / nup)
            z = zs + (zt - zs) * zf
            y = -wm * (cos(u) ** (2.0 / nup)) * (1.0 - tum * zf)
        elif t <= 0.75:
            u = ((0.75 - t) / 0.25) * (pi / 2)
            zf = sin(u) ** (2.0 / nup)
            z = zs + (zt - zs) * zf
            y = wm * (cos(u) ** (2.0 / nup)) * (1.0 - tum * zf)
        else:
            phi = ((1.0 - t) / 0.25) * (pi / 2)
            y = wm * (sin(phi) ** (2.0 / nlow))
            z = zb + (zs - zb) * (1.0 - cos(phi) ** (2.0 / nlow))
        return Vector((x, y, z))

    def normal(self, x, t):
        e = 0.0015
        x0 = max(self.xmin, x - e)
        x1 = min(self.xmax, x + e)
        dx = self.point(x1, t) - self.point(x0, t)
        dt = self.point(x, t + 0.004) - self.point(x, t - 0.004)
        n = dt.cross(dx)
        if n.length < 1e-12:
            return Vector((0, 0, 1))
        n.normalize()
        p = self.point(x, t)
        c = self.params(x)
        axis = Vector((x, 0.0, (c["zb"] + c["zt"]) * 0.5))
        if (p - axis).dot(n) < 0:
            n = -n
        return n

    def offset_point(self, x, t, off):
        return self.point(x, t) + self.normal(x, t) * off

    def t_at_z(self, x, z):
        p = self.params(x)
        zs, zt, nup, nlow = p["zs"], p["zt"], p["nup"], p["nlow"]
        if z >= zs:
            zf = min(1.0, (z - zs) / (zt - zs))
            s = min(1.0, zf ** (nup / 2.0))
            u = asin(s)
            return 0.25 + (u / (pi / 2)) * 0.25
        zf = min(1.0, (zs - z) / (zs - p["zb"]))
        c = min(1.0, zf ** (nlow / 2.0))
        phi = acos(c)
        return (phi / (pi / 2)) * 0.25


HULL = Hull(STATIONS)


def ribbon_from_points(name, pts, nrms, width, offset, collection=None):
    verts, faces = [], []
    for i in range(len(pts)):
        if i == 0:
            d = pts[1] - pts[0]
        elif i == len(pts) - 1:
            d = pts[-1] - pts[-2]
        else:
            d = pts[i + 1] - pts[i - 1]
        d.normalize()
        c = nrms[i].cross(d)
        if c.length < 1e-9:
            c = Vector((1, 0, 0))
        c.normalize()
        base = pts[i] + nrms[i] * offset
        verts.append(base - c * (width * 0.5))
        verts.append(base + c * (width * 0.5))
    for i in range(len(pts) - 1):
        a0, b0, a1, b1 = 2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 3
        faces.append((a0, b0, b1, a1))
    return vl.make_mesh_object(name, verts, faces, collection)


def make_ribbon(name, path_xt, width, offset, collection=None):
    pts = [HULL.point(x, t) for x, t in path_xt]
    nrms = [HULL.normal(x, t) for x, t in path_xt]
    return ribbon_from_points(name, pts, nrms, width, offset, collection)


def mirror_path(path_xt):
    return [(x, 1.0 - t) for x, t in path_xt]


def crease_arch_edges(body):
    bm = bmesh.new()
    bm.from_mesh(body.data)
    try:
        layer = bm.edges.layers.crease.verify()
    except AttributeError:
        layer = bm.edges.layers.float.new("crease_edge")
    for e in bm.edges:
        m = (e.verts[0].co + e.verts[1].co) * 0.5
        for wx, wz, wr in WELLS:
            d = ((m.x - wx) ** 2 + (m.z - wz) ** 2) ** 0.5
            if abs(d - wr) < 0.02 and abs(m.y) < 1.05:
                e[layer] = 0.18
                break
    bm.to_mesh(body.data)
    bm.free()


def build_body(collection):
    step = 0.04
    npts = 24
    xs = []
    x = HULL.xmax
    while x > HULL.xmin - 1e-6:
        xs.append(x)
        x -= step
    xs.append(HULL.xmin)
    verts, faces = [], []
    for x in xs:
        for k in range(npts):
            verts.append(HULL.point(x, k / npts))
    for xi in range(len(xs) - 1):
        for k in range(npts):
            a = xi * npts + k
            b = xi * npts + (k + 1) % npts
            c = (xi + 1) * npts + (k + 1) % npts
            d = (xi + 1) * npts + k
            faces.append((a, b, c, d))
    faces.append(tuple(range(npts - 1, -1, -1)))
    last = (len(xs) - 1) * npts
    faces.append(tuple(range(last, last + npts)))
    body = vl.make_mesh_object("VELARIS_Body", verts, faces, collection)

    vl.add_subsurf(body, 3)
    vl.apply_modifiers(body)

    cutters = []
    for ax_x, arch_r, wz in WELLS:
        c = vl.cylinder_mesh("cut_wheel", arch_r, 2.4, 512, ax="Y")
        c.location = (ax_x, 0, wz)
        cutters.append(c)
    boxes = [
        ("cut_front_intake", (0.45, 1.35, 0.155), (2.55, 0.0, 0.185), (0.0, radians(-14), 0.0)),
        ("cut_rear_notch", (0.45, 1.70, 0.26), (-2.52, 0.0, 0.17), (0.0, 0.0, 0.0)),
    ]
    for name, size, loc, rot in boxes:
        cutters.append(vl.box_mesh(name, size, loc, rot))
    for c in cutters:
        vl.boolean_cut(body, c)

    vl.assign_material(body, MATS["paint"], PAINT)
    vl.assign_material(body, MATS["glass"], GLASS)
    vl.assign_material(body, MATS["dark_trim"], DARK)
    apply_body_materials(body)
    vl.shade_smooth(body, 42)
    return body


def apply_body_materials(body):
    for poly in body.data.polygons:
        c = poly.center
        n = poly.normal
        idx = PAINT
        in_well = False
        for wx, wz, wr in WELLS:
            dx = c.x - wx
            dz = c.z - wz
            r = (dx * dx + dz * dz) ** 0.5
            if r < wr + 0.010 and abs(c.y) < 1.05:
                radial_dot = (n.x * dx + n.z * dz) / max(r, 1e-6)
                if radial_dot < -0.2:
                    in_well = True
                    break
        if in_well:
            idx = DARK
        else:
            p = HULL.params(c.x)
            zs, zt = p["zs"], p["zt"]
            ay = abs(c.y)
            x = c.x
            if x > 0.955 or x < -1.06:
                idx = PAINT
            elif x > 0.42:
                idx = GLASS if (c.z > zs + 0.075 and ay < 0.56) else PAINT
            elif x > -0.47:
                if n.z > 0.72 and c.z > zt - 0.055:
                    idx = PAINT
                elif c.z > zs + 0.035:
                    idx = GLASS
            else:
                idx = GLASS if (c.z > zs + 0.045 and ay < 0.40) else PAINT
        poly.material_index = idx
    body.data.update()


def add_seams(collection):
    seams = [
        ([(0.93, 0.335), (1.10, 0.345), (1.35, 0.353), (1.65, 0.360),
          (1.95, 0.370), (2.20, 0.388), (2.33, 0.425)], 0.012, True),
        ([(0.52, 0.300), (0.20, 0.300), (-0.20, 0.300), (-0.55, 0.302),
          (-0.72, 0.306)], 0.012, True),
        ([(0.62, 0.255), (0.66, 0.225), (0.72, 0.185), (0.78, 0.140),
          (0.82, 0.100)], 0.011, True),
        ([(-0.50, 0.255), (-0.56, 0.220), (-0.64, 0.175), (-0.71, 0.130),
          (-0.76, 0.090)], 0.011, True),
        ([(0.62, 0.245), (0.20, 0.243), (-0.20, 0.243), (-0.50, 0.245)], 0.010, True),
        ([(2.28, 0.30), (2.33, 0.36), (2.36, 0.43), (2.37, 0.50), (2.36, 0.57),
          (2.33, 0.64), (2.28, 0.70)], 0.012, False),
        ([(-2.20, 0.32), (-2.27, 0.40), (-2.30, 0.50), (-2.27, 0.60),
          (-2.20, 0.68)], 0.012, False),
    ]
    made = []
    for i, (path, w, mirrored) in enumerate(seams):
        variants = [(1, "L"), (-1, "R")] if mirrored else [(1, "")]
        for sgn, tag in variants:
            p = path if sgn > 0 else mirror_path(path)
            r = make_ribbon("Seam_%d%s" % (i, "_" + tag if tag else ""), p, w, 0.0015, collection)
            vl.add_solidify(r, 0.0018, 0.0)
            vl.assign_material(r, MATS["dark_trim"], 0)
            made.append(r)
    for r in made:
        vl.apply_modifiers(r)
        vl.shade_smooth(r, 60)
    return made


def build_headlights(collection):
    out = []
    path = [(2.21, 0.255), (2.26, 0.290), (2.31, 0.360), (2.36, 0.400), (2.40, 0.425)]
    for sgn, tag in ((1, "L"), (-1, "R")):
        p = path if sgn > 0 else mirror_path(path)
        housing = make_ribbon("HeadlightHousing_" + tag, p, 0.068, 0.003, collection)
        vl.add_solidify(housing, 0.024, 1.0)
        vl.assign_material(housing, MATS["dark_trim"], 0)
        vl.apply_modifiers(housing)
        vl.shade_smooth(housing, 50)
        lens = make_ribbon("HeadlightLens_" + tag, p, 0.060, 0.024, collection)
        vl.add_solidify(lens, 0.006, 1.0)
        vl.assign_material(lens, MATS["lamp_lens"], 0)
        vl.apply_modifiers(lens)
        vl.shade_smooth(lens, 50)
        led = make_ribbon("HeadlightLED_" + tag, [(x, t + 0.003) for x, t in p],
                          0.018, 0.016, collection)
        vl.assign_material(led, MATS["led_white"], 0)
        out += [housing, lens, led]
        for k, (px, pt) in enumerate(((2.335, 0.384), (2.255, 0.285))):
            n = HULL.normal(px, pt)
            pos = HULL.point(px, pt) + n * 0.020
            proj = vl.cylinder_mesh("Proj_%s_%d" % (tag, k), 0.020, 0.014, 24, ax="Z",
                                    collection=collection)
            proj.rotation_euler = n.to_track_quat("Z", "Y").to_euler()
            proj.location = pos
            vl.assign_material(proj, MATS["led_white"])
            out.append(proj)
    return out


def build_taillights(collection):
    out = []
    left_xz = [(-2.20, 0.700), (-2.30, 0.690), (-2.38, 0.685)]
    lpts, lnrms = [], []
    for x, z in left_xz:
        t = HULL.t_at_z(x, z)
        lpts.append(HULL.point(x, t))
        lnrms.append(HULL.normal(x, t))
    ctr_p = Vector((-2.443, 0.0, 0.682))
    ctr_n = Vector((-1.0, 0.0, 0.06)).normalized()
    pts = lpts + [ctr_p] + [Vector((p.x, -p.y, p.z)) for p in reversed(lpts)]
    nrms = lnrms + [ctr_n] + [Vector((n.x, -n.y, n.z)) for n in reversed(lnrms)]
    housing = ribbon_from_points("TaillightHousing", pts, nrms, 0.056, 0.002, collection)
    vl.add_solidify(housing, 0.018, 1.0)
    vl.assign_material(housing, MATS["dark_trim"], 0)
    vl.apply_modifiers(housing)
    vl.shade_smooth(housing, 50)
    led = ribbon_from_points("TaillightLED", pts, nrms, 0.044, 0.0215, collection)
    vl.assign_material(led, MATS["led_red"], 0)
    out += [housing, led]
    mt = vl.matrix_from_axes((-2.452, 0.0, 0.575), (0, 0, 1), (0, 0, 1), (-1, 0, 0))
    txt = vl.make_text("VELARIS", 0.060, matrix=mt, extrude=0.004,
                       name="TailWordmark", collection=collection)
    vl.assign_material(txt, MATS["led_white_soft"])
    out.append(txt)
    return out


def build_fascia(collection):
    out = []
    splitter = vl.box_mesh("FrontSplitter", (0.26, 1.10, 0.020), (2.175, 0.0, 0.094),
                           (0.0, radians(-4), 0.0), collection)
    vl.assign_material(splitter, MATS["dark_trim"])
    out.append(splitter)
    intake = vl.box_mesh("FrontIntakeMesh", (0.50, 1.30, 0.16), (2.16, 0.0, 0.19),
                         (0.0, radians(-14), 0.0), collection)
    vl.assign_material(intake, MATS["mesh_dark"])
    out.append(intake)
    for sgn, tag in ((1, "L"), (-1, "R")):
        skirt = make_ribbon("SideSkirt_" + tag,
                            [(-1.05, 0.055), (-0.6, 0.055), (0.0, 0.055), (0.6, 0.055), (1.05, 0.055)]
                            if sgn > 0 else
                            [(-1.05, 0.945), (-0.6, 0.945), (0.0, 0.945), (0.6, 0.945), (1.05, 0.945)],
                            0.085, 0.003, collection)
        vl.add_solidify(skirt, 0.016, 1.0)
        vl.assign_material(skirt, MATS["carbon"], 0)
        vl.apply_modifiers(skirt)
        vl.shade_smooth(skirt, 50)
        out.append(skirt)
    diffuser = vl.box_mesh("RearDiffuser", (0.22, 1.16, 0.20), (-2.37, 0.0, 0.175),
                           (0.0, radians(10), 0.0), collection)
    vl.assign_material(diffuser, MATS["carbon"])
    out.append(diffuser)
    for i in range(5):
        y = -0.44 + i * 0.22
        fin = vl.box_mesh("DiffuserFin_%d" % i, (0.22, 0.014, 0.22), (-2.35, y, 0.175),
                          (0.0, radians(10), 0.0), collection)
        vl.assign_material(fin, MATS["carbon"])
        out.append(fin)
    return out


def build_mirrors(collection):
    out = []
    for sgn, tag in ((1, "L"), (-1, "R")):
        base = HULL.offset_point(0.60, 0.25 if sgn > 0 else 0.75, 0.0)
        tip = base + Vector((-0.02, 0.115 * sgn, 0.065))
        stalk = vl.box_mesh("MirrorStalk_" + tag, (0.075, 0.045, 0.045),
                            ((base.x + tip.x) / 2, (base.y + tip.y) / 2, (base.z + tip.z) / 2),
                            (0.0, radians(-22), radians(28) * sgn), collection)
        vl.add_subsurf(stalk, 2)
        vl.assign_material(stalk, MATS["dark_chrome"])
        out.append(stalk)
        hx, hy, hz = tip.x - 0.015, tip.y + 0.02 * sgn, tip.z + 0.045
        housing = vl.box_mesh("MirrorHousing_" + tag, (0.155, 0.055, 0.085),
                              (hx, hy, hz), (0.0, radians(-6), radians(6) * sgn), collection)
        vl.apply_scale(housing)
        vl.add_subsurf(housing, 2)
        vl.add_bevel(housing, 0.006, 2, angle=30)
        vl.assign_material(housing, MATS["paint"])
        out.append(housing)
    return out


def build_badges(collection):
    out = []
    p = HULL.offset_point(2.27, 0.5, 0.002)
    n = HULL.normal(2.27, 0.5)
    mt = vl.matrix_from_axes(p, (0, 0, 1), (1, 0, 0), n)
    for i in range(2):
        b = vl.box_mesh("EmblemBar_%d" % i, (0.030, 0.115, 0.014),
                        (-0.030 + 0.060 * i, 0.0, 0.0),
                        (0.0, 0.0, radians(24 - 48 * i)), collection)
        b.matrix_world = mt @ b.matrix_world
        vl.assign_material(b, MATS["chrome"])
        out.append(b)
    p2 = HULL.offset_point(-1.10, 0.235, -0.002)
    n2 = HULL.normal(-1.10, 0.235)
    port = vl.cylinder_mesh("ChargePort", 0.052, 0.030, 32, ax="Z", collection=collection)
    port.rotation_euler = n2.to_track_quat("Z", "Y").to_euler()
    port.location = p2
    vl.assign_material(port, MATS["dark_trim"])
    out.append(port)
    ring = vl.cylinder_mesh("ChargePortRing", 0.058, 0.006, 32, ax="Z", collection=collection)
    ring.rotation_euler = n2.to_track_quat("Z", "Y").to_euler()
    ring.location = HULL.offset_point(-1.10, 0.235, 0.0005)
    vl.assign_material(ring, MATS["chrome"])
    out.append(ring)
    return out


def patch_slab(name, x0, x1, t0, t1, nx, nt, out_off, in_off, collection):
    xs = [x0 + (x1 - x0) * i / (nx - 1) for i in range(nx)]
    ts = [t0 + (t1 - t0) * j / (nt - 1) for j in range(nt)]
    verts = []
    for x in xs:
        for t in ts:
            verts.append(HULL.offset_point(x, t, out_off))
    base = len(verts)
    for x in xs:
        for t in ts:
            verts.append(HULL.offset_point(x, t, in_off))

    def O(i, j):
        return i * nt + j

    def I(i, j):
        return base + i * nt + j

    faces = []
    for i in range(nx - 1):
        for j in range(nt - 1):
            faces.append((O(i, j), O(i, j + 1), O(i + 1, j + 1), O(i + 1, j)))
            faces.append((I(i, j), I(i + 1, j), I(i + 1, j + 1), I(i, j + 1)))
    for j in range(nt - 1):
        faces.append((O(0, j), O(0, j + 1), I(0, j + 1), I(0, j)))
        faces.append((O(nx - 1, j + 1), O(nx - 1, j), I(nx - 1, j), I(nx - 1, j + 1)))
    for i in range(nx - 1):
        faces.append((O(i, 0), I(i, 0), I(i + 1, 0), O(i + 1, 0)))
        faces.append((O(i + 1, nt - 1), I(i + 1, nt - 1), I(i, nt - 1), O(i, nt - 1)))
    return vl.make_mesh_object(name, verts, faces, collection)


def curve_path(x_a, x_b, t, n):
    return [(x_a + (x_b - x_a) * i / (n - 1), t) for i in range(n)]


def curtain(name, path_xt, depth, collection, mat):
    verts, faces = [], []
    for x, t in path_xt:
        verts.append(HULL.offset_point(x, t, -0.0015))
    n = len(path_xt)
    for x, t in path_xt:
        verts.append(HULL.offset_point(x, t, -depth))
    for i in range(n - 1):
        faces.append((i, i + 1, n + i + 1, n + i))
    ob = vl.make_mesh_object(name, verts, faces, collection)
    vl.assign_material(ob, mat, 0)
    return ob


def loop_ribbon(name, segs, width, offset, collection, mat):
    pts, nrms = [], []
    for path, rev in segs:
        pts_list = list(reversed(path)) if rev else list(path)
        for x, t in pts_list:
            pts.append(HULL.point(x, t))
            nrms.append(HULL.normal(x, t))
    ob = ribbon_from_points(name, pts, nrms, width, offset, collection)
    vl.assign_material(ob, mat, 0)
    return ob


def tub(name, x0, x1, y0, y1, z0, z1, collection, mat, floor_thick=0.02):
    verts = [(x0, y0, z0 + floor_thick), (x1, y0, z0 + floor_thick),
             (x1, y1, z0 + floor_thick), (x0, y1, z0 + floor_thick),
             (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    faces = [(0, 1, 2, 3),
             (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7),
             (4, 5, 6, 7)]
    ob = vl.make_mesh_object(name, verts, faces, collection)
    vl.assign_material(ob, mat, 0)
    return ob


def build_openings(body, collection):
    specs = [
        dict(name="Door_L", x0=0.62, x1=-0.50, top=0.555, bot=0.868, kind="door",
             frac=0.60, hinge=(0.62, 0.960, 0.62), thick=0.045, liner_off=-0.048,
             jamb_depth=0.100,
             liner_mat="leather"),
        dict(name="Door_R", x0=0.62, x1=-0.50, top=0.445, bot=0.132, kind="door",
             frac=0.60, hinge=(0.62, -0.960, 0.62), thick=0.045, liner_off=-0.048,
             jamb_depth=0.100,
             liner_mat="leather"),
        dict(name="Hatch", x0=-0.78, x1=-1.86, top=0.585, bot=0.415, kind="top",
             frac=0.04, hinge=(-0.78, 0.0, 1.055), thick=0.030, liner_off=-0.034,
             jamb_depth=0.085,
             liner_mat="suede"),
        dict(name="FrunkLid", x0=1.06, x1=2.06, top=0.64, bot=0.36, kind="top",
             frac=0.04, hinge=(1.06, 0.0, 0.885), thick=0.030, liner_off=-0.034,
             jamb_depth=0.075,
             liner_mat="suede"),
    ]
    made = {}
    for sp in specs:
        name = sp["name"]
        x0, x1 = sp["x0"], sp["x1"]
        tlo, thi = min(sp["top"], sp["bot"]), max(sp["top"], sp["bot"])
        m = 0.008
        slab = patch_slab(name + "_cut", x0, x1, tlo, thi, 40, 22, 0.020, -0.170, collection)
        panel = body.copy()
        panel.data = body.data.copy()
        collection.objects.link(panel)
        panel.name = name
        panel.data.name = name
        small = patch_slab(name + "_fit", x0 - m, x1 + m, tlo + m, thi - m, 36, 20,
                           0.020, -0.140, collection)
        m2 = panel.modifiers.new("BoolCut", "BOOLEAN")
        m2.operation = "INTERSECT"
        m2.solver = "EXACT"
        m2.object = small
        vl.apply_modifiers(panel)
        bpy.data.objects.remove(small, do_unlink=True)
        m3 = body.modifiers.new("BoolOpening", "BOOLEAN")
        m3.operation = "DIFFERENCE"
        m3.solver = "EXACT"
        m3.object = slab
        vl.apply_modifiers(body)
        bpy.data.objects.remove(slab, do_unlink=True)
        vl.add_solidify(panel, sp["thick"], -1.0)
        vl.apply_modifiers(panel)
        vl.shade_smooth(panel, 40)

        hinge = bpy.data.objects.new("Hinge_" + name, None)
        hinge.empty_display_size = 0.10
        hinge.location = sp["hinge"]
        collection.objects.link(hinge)
        bpy.context.view_layer.update()
        panel.parent = hinge
        panel.matrix_parent_inverse = hinge.matrix_world.inverted()

        if sp["kind"] == "door":
            if sp["top"] < sp["bot"]:
                lt = sp["top"] + sp["frac"] * (sp["bot"] - sp["top"])
                lt2 = sp["bot"] - 0.02 * (sp["bot"] - sp["top"])
            else:
                lt = sp["top"] - sp["frac"] * (sp["top"] - sp["bot"])
                lt2 = sp["bot"] + 0.02 * (sp["top"] - sp["bot"])
        else:
            lt = tlo + sp["frac"] * (thi - tlo)
            lt2 = thi - 0.02 * (thi - tlo)
        liner = patch_slab(name + "_Liner", x0 - 0.030, x1 + 0.030, lt, lt2, 30, 16,
                           sp["liner_off"] - 0.010, sp["liner_off"], collection)
        vl.assign_material(liner, MATS[sp["liner_mat"]], 0)
        vl.shade_smooth(liner, 45)
        liner.parent = hinge
        liner.matrix_parent_inverse = hinge.matrix_world.inverted()

        c = sp["jamb_depth"]
        jamb_eps = 0.010
        parts = [
            (name + "_JambTop", curve_path(x0 - jamb_eps, x1 + jamb_eps, sp["top"], 26)),
            (name + "_JambBot", curve_path(x0 - jamb_eps, x1 + jamb_eps, sp["bot"], 26)),
            (name + "_JambF", [(x0 - jamb_eps, sp["top"] + (sp["bot"] - sp["top"]) * k / 11.0)
                               for k in range(12)]),
            (name + "_JambR", [(x1 + jamb_eps, sp["top"] + (sp["bot"] - sp["top"]) * k / 11.0)
                               for k in range(12)]),
        ]
        jambs = []
        for jn, path in parts:
            jb = curtain(jn, path, c, collection, MATS["dark_trim"])
            jambs.append(jb)
        segs = [
            (curve_path(x0 - jamb_eps, x1 + jamb_eps, sp["top"], 24), False),
            ([(x1 + jamb_eps, sp["top"] + (sp["bot"] - sp["top"]) * k / 9.0) for k in range(10)], False),
            (curve_path(x1 + jamb_eps, x0 - jamb_eps, sp["bot"], 24), False),
            ([(x0 - jamb_eps, sp["bot"] + (sp["top"] - sp["bot"]) * k / 9.0) for k in range(10)], False),
        ]
        seal = loop_ribbon(name + "_Seal", segs, 0.011, -0.0035, collection, MATS["dark_trim"])

        if sp["kind"] == "door":
            sill_path = curve_path(x0 - 0.02, x1 + 0.02, sp["bot"], 20)
            sill = make_ribbon(name + "_Sill", sill_path, 0.055, 0.0045, collection)
            vl.assign_material(sill, MATS["machined"], 0)
            led = make_ribbon(name + "_SillLED", sill_path, 0.012, 0.0085, collection)
            vl.assign_material(led, MATS["led_white_soft"], 0)
            made[name + "_Sill"] = sill
            made[name + "_SillLED"] = led
        made[name] = panel
        made[name + "_Liner"] = liner
        made[name + "_Hinge"] = hinge
        made[name + "_Jambs"] = jambs
        made[name + "_Seal"] = seal
    return made


def build_compartments(collection):
    out = []
    trunk = tub("TrunkTub", -1.84, -0.90, -0.60, 0.60, 0.44, 0.86, collection,
                MATS["suede"])
    out.append(trunk)
    for tag, y in (("L", 0.585), ("R", -0.585)):
        rim = ribbon_from_points("TrunkRim_" + tag,
                                 [Vector((-0.90, y, 0.86)), Vector((-1.84, y, 0.86))],
                                 [Vector((0, 0, 1))] * 2, 0.035, 0.0, collection)
        vl.assign_material(rim, MATS["dark_trim"], 0)
        out.append(rim)
    for xr in (-0.95, -1.80):
        rim = ribbon_from_points("TrunkRim_x%+.2f" % xr,
                                 [Vector((xr, -0.60, 0.86)), Vector((xr, 0.60, 0.86))],
                                 [Vector((0, 0, 1))] * 2, 0.035, 0.0, collection)
        vl.assign_material(rim, MATS["dark_trim"], 0)
        out.append(rim)
    for tag, y in (("A", 0.30), ("B", -0.30)):
        rail = vl.box_mesh("TrunkRail_" + tag, (0.86, 0.020, 0.014), (-1.37, y, 0.505),
                           collection=collection)
        vl.assign_material(rail, MATS["machined"], 0)
        vl.add_bevel(rail, 0.003, 2, angle=30)
        vl.apply_modifiers(rail)
        out.append(rail)
    frunk = tub("FrunkTub", 1.26, 2.00, -0.58, 0.58, 0.30, 0.58, collection,
                MATS["dark_trim"])
    out.append(frunk)
    for tag, y in (("L", 0.565), ("R", -0.565)):
        rim = ribbon_from_points("FrunkRim_" + tag,
                                 [Vector((1.26, y, 0.58)), Vector((2.00, y, 0.58))],
                                 [Vector((0, 0, 1))] * 2, 0.030, 0.0, collection)
        vl.assign_material(rim, MATS["dark_trim"], 0)
        out.append(rim)
    for xr in (1.26, 2.00):
        rim = ribbon_from_points("FrunkRim_x%+.2f" % xr,
                                 [Vector((xr, -0.58, 0.58)), Vector((xr, 0.58, 0.58))],
                                 [Vector((0, 0, 1))] * 2, 0.030, 0.0, collection)
        vl.assign_material(rim, MATS["dark_trim"], 0)
        out.append(rim)
    bag = vl.box_mesh("FrunkBag", (0.34, 0.26, 0.17), (1.62, 0.20, 0.42), collection=collection)
    vl.add_subsurf(bag, 2)
    vl.add_bevel(bag, 0.02, 2, angle=40)
    vl.assign_material(bag, MATS["leather"], 0)
    vl.apply_modifiers(bag)
    vl.shade_smooth(bag, 45)
    out.append(bag)
    return out


MATS = {}


def build(collection, mats):
    global MATS
    MATS = mats
    body = build_body(collection)
    seams = add_seams(collection)
    lamps = build_headlights(collection) + build_taillights(collection)
    fascia = build_fascia(collection)
    mirrors = build_mirrors(collection)
    badges = build_badges(collection)
    openings = build_openings(body, collection)
    compartments = build_compartments(collection)
    for ob in mirrors:
        vl.apply_modifiers(ob)
        vl.shade_smooth(ob, 40)
    for ob in fascia:
        vl.shade_smooth(ob, 50)
    return {
        "body": body, "seams": seams, "lamps": lamps, "fascia": fascia,
        "mirrors": mirrors, "badges": badges, "openings": openings,
        "compartments": compartments,
    }
