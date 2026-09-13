"""Xiaomi SU7 parametric builder - Blender 3.6 headless.
Coordinate system: +Y = forward (nose), +X = right, +Z = up. Ground z=0, origin at wheelbase center.
Spec: L 4997, W 1963, H 1455, WB 3000, tire ~703mm.
"""
import bpy, bmesh, math, os, sys, json
import numpy as np
from mathutils import Vector, Matrix

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RENDERS = os.path.join(ROOT, "renders")

L2 = 2498.5
AXLE_F = 1500.0
AXLE_R = -1500.0
R_TIRE_F = 352.0
R_TIRE_R = 360.0
TRACK_F = 1693.0
TRACK_R = 1699.0
CAGE_GROW_X = 1.012
CAGE_RISE_Z = 4.0

TOP_KEYS = [
    (-2498, 935), (-2450, 948), (-2380, 972), (-2300, 996), (-2200, 1010),
    (-2100, 1030), (-2000, 1046), (-1900, 1082), (-1800, 1120), (-1700, 1152),
    (-1600, 1220), (-1500, 1272), (-1400, 1313), (-1300, 1358), (-1200, 1392),
    (-1100, 1412), (-1000, 1408), (-800, 1412), (-600, 1438), (-400, 1457),
    (-200, 1456), (0, 1442), (100, 1418), (200, 1378), (300, 1325),
    (400, 1275), (500, 1215), (560, 1180), (620, 1140), (700, 1096),
    (800, 1058), (900, 1016),     (1000, 960), (1100, 945), (1200, 920), (1300, 912), (1400, 903), (1500, 894),
    (1600, 886), (1700, 874), (1800, 860), (1900, 847), (2000, 793),
    (2100, 766), (2200, 694), (2300, 624), (2380, 594), (2450, 575),
    (2498, 568),
]
BELT_KEYS = [
    (-2498, 620), (-2400, 760), (-2300, 880), (-2200, 945), (-2100, 965),
    (-1900, 972), (-1700, 978), (-1500, 981), (-1200, 976), (-900, 972),
    (-600, 972), (-300, 972), (0, 972), (300, 972), (600, 968),
    (900, 965), (1200, 962), (1400, 962), (1500, 972), (1560, 979),
    (1700, 960), (1800, 940), (1900, 905), (2000, 858), (2100, 800),
    (2200, 735), (2300, 668), (2400, 620), (2498, 545),
]
ZBELT_KEYS = [
    (-2498, 520), (-2400, 520), (-2200, 540), (-2000, 570), (-1700, 590),
    (-1500, 590), (-1000, 640), (-500, 660), (0, 660), (500, 650),
    (1000, 630), (1400, 600), (1500, 600), (1700, 600), (2000, 585),
    (2200, 560), (2400, 530), (2498, 500),
]
EDGE_W_KEYS = [
    (-2498, 520), (-2400, 615), (-2200, 700), (-2000, 690), (-1800, 655),
    (-1600, 595), (-1400, 545), (-1200, 510), (-1000, 535), (-800, 552),
    (-600, 555), (-400, 558), (-200, 560), (100, 558), (300, 545),
    (500, 660), (620, 700), (700, 700), (900, 740), (1100, 745),
    (1300, 750), (1500, 758), (1600, 762), (1700, 758), (1900, 730),
    (2000, 700), (2150, 640), (2300, 575), (2400, 530), (2498, 480),
]
EDGE_Z_KEYS = [
    (-2498, 890), (-2400, 928), (-2200, 992), (-2000, 1010), (-1800, 1078),
    (-1600, 1170), (-1400, 1288), (-1300, 1335), (-1200, 1358), (-1000, 1382),
    (-800, 1388), (-600, 1385), (-400, 1388), (-200, 1390), (0, 1390),
    (100, 1385), (300, 1340), (500, 1247), (620, 1145), (700, 1095),
    (900, 1000), (1100, 935), (1300, 898), (1500, 890), (1600, 890),
    (1700, 880), (1900, 846), (2000, 820), (2150, 740), (2300, 620),
    (2400, 560), (2498, 520),
]
# cabin DLO base (shoulder of greenhouse) - only meaningful in cabin range
ZSH_CABIN_KEYS = [
    (-1750, 1062), (-1500, 1056), (-1200, 1048), (-800, 1042), (-400, 1038),
    (0, 1036), (300, 1042), (560, 1054),
]

ARCH_R_F = 400.0
ARCH_R_R = 408.0
ARCH_CZ = 358.0
SILL_Z = 170.0
LIP_Z = 102.0

# ---------------------------------------------------------------- helpers
_DENSE_CACHE = {}


def interp(keys, y):
    key = (len(keys), keys[0], keys[-1])
    if key not in _DENSE_CACHE:
        ys = np.array([k[0] for k in keys], dtype=float)
        vs = np.array([k[1] for k in keys], dtype=float)
        grid = np.arange(-2600, 2600.1, 20.0)
        dense = np.interp(grid, ys, vs)
        kernel = np.array([1, 4, 6, 4, 1], dtype=float)
        kernel /= kernel.sum()
        pad = np.pad(dense, 2, mode='edge')
        dense = np.convolve(pad, kernel, mode='valid')
        _DENSE_CACHE[key] = (grid, dense)
    grid, dense = _DENSE_CACHE[key]
    return float(np.interp(y, grid, dense))


def smoothstep(t):
    t = np.clip(t, 0.0, 1.0)
    return t * t * (3 - 2 * t)


def landmarks(y):
    z_top = interp(TOP_KEYS, y)
    w_edge = interp(EDGE_W_KEYS, y)
    z_edge = interp(EDGE_Z_KEYS, y)
    w_belt = interp(BELT_KEYS, y)
    z_belt = interp(ZBELT_KEYS, y)

    cabin = smoothstep((y + 1750) / 400.0) * (1.0 - smoothstep((y - 330) / 380.0))
    z_sh_cab = interp(ZSH_CABIN_KEYS, y)
    z_sh_fr = z_edge - 35.0
    z_sh = z_sh_fr + (z_sh_cab - z_sh_fr) * cabin
    w_sh_fr = w_belt - 55.0
    w_sh_cab = w_belt - 42.0
    w_sh = w_sh_fr + (w_sh_cab - w_sh_fr) * cabin
    inset = 5.0 + 50.0 * cabin
    w_gl = max(w_sh - inset, w_edge * 0.55)
    z_gl = min(z_sh + 18.0, z_edge - 12.0)

    wsf = smoothstep((y - 80.0) / 520.0) * (1.0 - smoothstep((y - 880.0) / 450.0))
    if wsf > 0:
        w_gl = w_gl + (w_edge - 25.0 - w_gl) * wsf
        z_gl = z_gl + (z_edge - 190.0 - z_gl) * wsf
        w_sh = w_sh + (max(w_belt - 20.0, w_edge + 85.0) - w_sh) * wsf
        z_sh = z_sh + (z_gl - 130.0 - z_sh) * wsf
    rpf = smoothstep((-850.0 - y) / 250.0)
    if rpf > 0:
        w_gl = w_gl + (w_edge + 250.0 - w_gl) * rpf
        z_gl = z_gl + (max(z_edge - 300.0, 930.0) - z_gl) * rpf
        w_sh = w_sh + (max(w_belt - 48.0, w_edge + 60.0) - w_sh) * rpf
        z_sh = z_sh + (z_gl - 100.0 - z_sh) * rpf

    z_edge = min(z_edge, z_top - 4.0)
    z_gl = min(z_gl, z_edge - 10.0)
    z_gl = max(z_gl, z_belt + 45.0)
    if z_sh > z_gl - 4.0:
        z_sh = z_gl - 4.0
    z_sh = max(z_sh, z_belt + 22.0)
    w_gl = min(w_gl, w_sh - 2.0)
    w_edge = min(w_edge, w_sh - 5.0)
    return dict(z_top=z_top, w_edge=w_edge, z_edge=z_edge, w_belt=w_belt, z_belt=z_belt,
                w_sh=w_sh, z_sh=z_sh, w_gl=w_gl, z_gl=z_gl, rpf=rpf, wsf=wsf)


def profile_points(y):
    lm = landmarks(y)
    z_top = lm["z_top"] + CAGE_RISE_Z
    w_edge = lm["w_edge"] * CAGE_GROW_X
    z_edge = lm["z_edge"] + CAGE_RISE_Z * 0.6
    w_belt = lm["w_belt"] * CAGE_GROW_X
    z_belt = lm["z_belt"]
    w_sh = lm["w_sh"] * CAGE_GROW_X
    z_sh = lm["z_sh"]
    w_gl = lm["w_gl"] * CAGE_GROW_X
    z_gl = lm["z_gl"]

    z_bot = SILL_Z
    dy = y - AXLE_F
    if abs(dy) < ARCH_R_F:
        z_bot = max(z_bot, ARCH_CZ + ARCH_R_F * (1 - (dy / ARCH_R_F) ** 2) ** 0.55)
    dy = y - AXLE_R
    if abs(dy) < ARCH_R_R:
        z_bot = max(z_bot, ARCH_CZ + ARCH_R_R * (1 - (dy / ARCH_R_R) ** 2) ** 0.55)
    if y > 2330:
        t = smoothstep((y - 2330) / (L2 - 2330))
        z_bot = min(z_bot, SILL_Z + t * (LIP_Z - SILL_Z))
    if y < -2330:
        t = smoothstep((-2330 - y) / (L2 - 2330))
        z_bot = max(z_bot, SILL_Z + t * (248 - SILL_Z))

    tuck = 22.0 + 40.0 * smoothstep((1050.0 - abs(y)) / 300.0)
    if abs(y) > 1950:
        tuck = 20.0
    w_bot = max(60.0, w_belt - tuck)
    z_floor = max(118.0, z_bot - 34.0)

    zones = []
    pts = []
    # crown: center -> edge
    for i in range(7):
        t = i / 6.0
        x = w_edge * math.sin(t * math.pi / 2) ** 0.85
        z = z_top + (z_edge - z_top) * (1 - math.cos(t * math.pi / 2)) ** 0.9
        pts.append((x, z))
        zones.append("crown")
    # tumblehome: edge -> glass base
    tumble_exp = 1.15 - 0.45 * lm.get("rpf", 0.0) + 0.35 * lm.get("wsf", 0.0)
    for i in range(1, 5):
        t = i / 4.0
        x = w_edge + (w_gl - w_edge) * (t ** tumble_exp)
        z = z_edge + (z_gl - z_edge) * (t ** 1.05)
        pts.append((x, z))
        zones.append("tumble")
    # crease kick-out (sharp DLO base)
    pts.append((w_gl + 3.5, z_gl - 3.0))
    zones.append("shoulder")
    # shoulder crease: glass base -> shoulder
    sx_exp = 1.0 + 1.1 * max(lm.get("wsf", 0.0), lm.get("rpf", 0.0))
    for i in range(1, 4):
        t = i / 3.0
        x = w_gl + (w_sh - w_gl) * (t ** sx_exp)
        z = z_gl + (z_sh - z_gl) * t
        pts.append((x, z))
        zones.append("shoulder")
    # undercut waist below the shoulder (strong on doors, fades on fenders/bumpers)
    doorf = smoothstep((950.0 - abs(y)) / 560.0)
    z_waist = z_sh - (95.0 * doorf + 8.0 * (1.0 - doorf))
    w_waist = w_sh - (38.0 * doorf + 14.0 * (1.0 - doorf))
    for i in range(1, 4):
        t = i / 3.0
        x = w_sh + (w_waist - w_sh) * math.sin(t * math.pi / 2) ** 0.8
        z = z_sh + (z_waist - z_sh) * t
        pts.append((x, z))
        zones.append("waist")
    # side: waist -> belt max
    for i in range(1, 4):
        t = i / 3.0
        x = w_waist + (w_belt - w_waist) * math.sin(t * math.pi / 2)
        z = z_waist + (z_belt - z_waist) * t
        pts.append((x, z))
        zones.append("side")
    # lower tuck: belt -> sill
    for i in range(1, 5):
        t = i / 4.0
        x = w_belt + (w_bot - w_belt) * (t ** 1.35)
        z = z_belt + (z_bot - z_belt) * (t ** 0.9)
        pts.append((x, z))
        zones.append("lower")
    # bottom: sill -> floor center
    for i in range(1, 5):
        t = i / 4.0
        x = w_bot * math.cos(t * math.pi / 2) ** 0.9
        z = z_bot + (z_floor - z_bot) * (1 - math.cos(t * math.pi / 2))
        pts.append((x, z))
        zones.append("bottom")
    pts.append((0.0, z_floor))
    zones.append("bottom")

    pts = [(x * 0.001, z * 0.001) for (x, z) in pts]
    return pts, zones


def build_body():
    ys = sorted(set(
        [round(y, 1) for y in np.arange(-2498, 2499, 100)] +
        [round(y, 1) for y in np.arange(80, 760, 40)] +
        [round(y, 1) for y in np.arange(-1500, -1000, 60)] +
        [round(y, 1) for y in np.arange(-2498, -1900, 35)] +
        [round(y, 1) for y in np.arange(1900, 2499, 35)] +
        [round(y, 1) for y in np.arange(-460, -140, 40)] +
        [round(y, 1) for y in np.arange(-1700, -1500, 60)] +
        [round(y, 1) for y in np.arange(760, 1910, 40)] +
        [round(y, 1) for y in np.arange(-1910, -1700, 60)]
    ))
    ys = sorted(set([y for y in ys if -2498 <= y <= 2498] + [-2498.5, 2498.5]))

    bm = bmesh.new()
    rings = []
    zones_ring = None
    P = None
    for y in ys:
        pts, zones = profile_points(y)
        if P is None:
            P = len(pts)
            zones_ring = zones + list(reversed(zones[1:-1]))
        y_m = y * 0.001
        ring = [bm.verts.new((x, y_m, z)) for (x, z) in pts]
        ring += [bm.verts.new((-x, y_m, z)) for (x, z) in reversed(pts[1:-1])]
        rings.append(ring)

    n = len(rings[0])
    face_zones = []
    face_ys = []
    for s in range(len(rings) - 1):
        r0, r1 = rings[s], rings[s + 1]
        ymid = 0.5 * (ys[s] + ys[s + 1])
        for i in range(n):
            a, b = r0[i], r0[(i + 1) % n]
            c, d = r1[(i + 1) % n], r1[i]
            bm.faces.new((a, b, c, d))
            face_zones.append(zones_ring[i])
            face_ys.append(ymid)

    # caps (rounded: two shrinking rings + tip)
    for ring, y_end, sgn in ((rings[0], ys[0] * 0.001, -1), (rings[-1], ys[-1] * 0.001, 1)):
        ctr = np.mean([[v.co.x, v.co.z] for v in ring], axis=0)
        c1s = 0.92 if ring is rings[-1] else 0.85
        c2s = 0.70 if ring is rings[-1] else 0.55
        c1 = [bm.verts.new((v.co.x * c1s, y_end + sgn * 0.0035, ctr[1] + (v.co.z - ctr[1]) * c1s)) for v in ring]
        c2 = [bm.verts.new((v.co.x * c2s, y_end + sgn * 0.0070, ctr[1] + (v.co.z - ctr[1]) * c2s)) for v in ring]
        tip = bm.verts.new((0.0, y_end + sgn * 0.0100, float(ctr[1])))
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((ring[i], ring[j], c1[j], c1[i]))
            bm.faces.new((c1[i], c1[j], c2[j], c2[i]))
            bm.faces.new((c2[i], c2[j], tip))
            face_zones.append("cap")
            face_zones.append("cap")
            face_zones.append("cap")
            face_ys.append(y_end * 1000.0 + sgn * 3.5)
            face_ys.append(y_end * 1000.0 + sgn * 7.0)
            face_ys.append(y_end * 1000.0 + sgn * 10.0)

    # longitudinal relaxation of mid-surface rows (removes station ripples, protects silhouette rows)
    nv = len(rings[0])
    Pz = len(zones_ring)
    protect = set(range(0, 8)) | set(range(nv - 8, nv)) | set(range(Pz - 5, Pz)) | set(range(Pz, Pz + 5))
    for _ in range(2):
        snap = [[v.co.copy() for v in ring] for ring in rings]
        for s in range(1, len(rings) - 1):
            if abs(ys[s]) > 1850:
                continue
            rp, rc, rn = snap[s - 1], snap[s], snap[s + 1]
            for i in range(Pz):
                if i in protect:
                    continue
                rings[s][i].co = rp[i] * 0.25 + rc[i] * 0.5 + rn[i] * 0.25

    # feature-line edge creases: keep DLO base / hood-roof edge crisp through subsurf
    cl = bm.edges.layers.crease.verify()
    vmap = {}
    for s, ring in enumerate(rings):
        for i, v in enumerate(ring):
            vmap[v] = (s, i)
    crease_rows = {}
    for i in range(len(zones_ring)):
        prev_z = zones_ring[i - 1] if i > 0 else None
        next_z = zones_ring[(i + 1) % len(zones_ring)]
        if zones_ring[i] == "shoulder" and prev_z == "tumble":
            crease_rows[i] = 0.75
        elif zones_ring[i] == "crown" and next_z == "tumble":
            crease_rows[i] = 0.5
        elif zones_ring[i] == "waist" and prev_z == "shoulder":
            crease_rows[i] = 0.3
    for e in bm.edges:
        v0, v1 = e.verts
        s0, i0 = vmap.get(v0, (-1, -1))
        s1, i1 = vmap.get(v1, (-1, -1))
        if i0 == i1 and i0 >= 0 and abs(s0 - s1) == 1 and i0 in crease_rows:
            e[cl] = crease_rows[i0]

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("body")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("Body", me)
    bpy.context.collection.objects.link(ob)
    return ob, face_zones, face_ys


def assign_body_materials(ob, face_zones, face_ys):
    me = ob.data
    mat_names = ["paint", "black_gloss", "black_matte", "glass", "liner", "glass_dark"]
    for nm in mat_names:
        me.materials.append(bpy.data.materials[nm])

    GLASS, PAINT, BGLOSS, BMATTE = 3, 0, 1, 2

    def front_cut(x, z):
        return z < (325.0 if x < 600.0 else max(150.0, 325.0 - (x - 600.0) * 0.75))

    def rear_cut(x, z):
        return z < (470.0 if x < 590.0 else max(200.0, 470.0 - (x - 590.0) * 0.62))

    for idx, poly in enumerate(me.polygons):
        zone = face_zones[idx]
        y = face_ys[idx]
        c = poly.center
        ym, zm = c.y * 1000.0, c.z * 1000.0
        xm = abs(c.x) * 1000.0
        lm = landmarks(y)
        edge_w_mm = lm["w_edge"] * CAGE_GROW_X
        rel_x = xm / max(edge_w_mm, 1.0)
        mat = PAINT
        if zone == "crown":
            if 40 < y < 680:
                mat = GLASS if rel_x < 0.875 else BGLOSS
            elif -1080 < y <= 40:
                mat = 5 if rel_x < 0.86 else BGLOSS
            elif -1660 < y <= -1080:
                mat = 5 if rel_x < 0.88 else PAINT
        elif zone == "tumble":
            if -1080 < y < 620:
                mat = GLASS
                if 210 < y < 680:
                    mat = BGLOSS
                if -230 < y < -140:
                    mat = BGLOSS
                if -1080 < y < -1010:
                    mat = BGLOSS
        elif zone == "shoulder":
            if -1080 < y < 620:
                mat = BGLOSS if xm < lm["w_gl"] + 18 else PAINT
        if zone == "bottom":
            mat = BMATTE
        if zone == "cap":
            mat = PAINT
            if ym > 2400 and zm < 330:
                mat = BMATTE
            if ym < -2400 and zm < 470:
                mat = BMATTE
        poly.material_index = mat


# ---------------------------------------------------------------- overlay shells
def build_overlay(name, y0, y1, cut_fn, mat_name, step=40.0, offset=0.0022, thickness=0.0025):
    """Thin shell that hugs the lower body surface, from the bottom up to a cut line."""
    ys = [y for y in np.arange(y0, y1 + 1, step)]
    if ys[-1] < y1:
        ys.append(y1)
    bm = bmesh.new()
    rows = []
    for y in ys:
        pts_mm, zones = profile_points(y)
        pts_mm = [(x * 1000.0, z * 1000.0) for (x, z) in pts_mm]
        # select contiguous run containing bottom-center that satisfies cut
        sel = [i for i in range(len(pts_mm)) if cut_fn(y, abs(pts_mm[i][0]), pts_mm[i][1])]
        if not sel:
            rows.append([])
            continue
        lo, hi = min(sel), max(sel)
        # 2D outward normal of polyline in xz
        row = []
        n = len(pts_mm)
        for i in range(lo, hi + 1):
            x, z = pts_mm[i]
            if i == hi and hi + 1 < n:
                x1, z1 = pts_mm[hi]
                x2, z2 = pts_mm[hi + 1]
                tbest = None
                for k in range(1, 40):
                    t = k / 40.0
                    xt = x1 + (x2 - x1) * t
                    zt = z1 + (z2 - z1) * t
                    if not cut_fn(y, abs(xt), zt):
                        tbest = (k - 1) / 40.0
                        break
                if tbest is not None:
                    x = x1 + (x2 - x1) * tbest
                    z = z1 + (z2 - z1) * tbest
            xp, zp = pts_mm[max(i - 1, 0)]
            xn, zn = pts_mm[min(i + 1, n - 1)]
            tx, tz = (xn - xp), (zn - zp)
            ln = math.hypot(tx, tz) or 1.0
            nx, nz = tz / ln, -tx / ln
            if nx < 0:
                nx, nz = -nx, -nz
            row.append(bm.verts.new(((x + nx * offset) * 0.001, y * 0.001, (z + nz * offset) * 0.001)))
        # mirror to full ring (right half only in profile)
        row = row + [bm.verts.new((-v.co.x, v.co.y, v.co.z)) for v in reversed(row[:-1])]
        rows.append(row)

    for r0, r1 in zip(rows[:-1], rows[1:]):
        m = min(len(r0), len(r1))
        for i in range(m - 1):
            bm.faces.new((r0[i], r0[i + 1], r1[i + 1], r1[i]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(bpy.data.materials[mat_name])
    for p in me.polygons:
        p.use_smooth = True
    sol = ob.modifiers.new("sol", 'SOLIDIFY')
    sol.thickness = thickness
    sol.offset = 0.0
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier="sol")
    return ob


def build_overlays():
    obs = []
    obs.append(build_overlay(
        "skirt_black", -1935, 1935,
        lambda y, x, z: z < 212.0, "black_matte", step=80, offset=0.002, thickness=0.002))
    obs.append(build_overlay(
        "front_lip", 2130, 2498,
        lambda y, x, z: z < (388.0 if x < 620.0 else max(190.0, 388.0 - (x - 620.0) * 0.90)),
        "black_matte", step=35, offset=0.0035, thickness=0.003))
    obs.append(build_overlay(
        "rear_lip", -2498, -2160,
        lambda y, x, z: z < (520.0 if x < 700.0 else max(260.0, 520.0 - (x - 700.0) * 0.50)),
        "black_matte", step=35, offset=0.0035, thickness=0.003))
    return obs


def make_materials():
    def set_in(b, names, value):
        for nm in names:
            if nm in b.inputs:
                b.inputs[nm].default_value = value
                return

    def base(name, color, metallic, rough, coat=0.0, transmission=0.0, emit=None, emit_str=0.0):
        m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        m.use_nodes = True
        b = m.node_tree.nodes.get("Principled BSDF")
        set_in(b, ["Base Color"], (*color, 1.0))
        set_in(b, ["Metallic"], metallic)
        set_in(b, ["Roughness"], rough)
        if coat:
            set_in(b, ["Coat Weight", "Clearcoat"], coat)
            set_in(b, ["Coat Roughness", "Clearcoat Roughness"], 0.06)
        if transmission > 0:
            set_in(b, ["Transmission Weight", "Transmission"], transmission)
            set_in(b, ["IOR"], 1.45)
        if emit:
            set_in(b, ["Emission Color", "Emission"], (*emit, 1.0))
            set_in(b, ["Emission Strength"], emit_str)
        m.use_backface_culling = False
        return m

    def srgb2lin(c):
        return tuple((v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c)

    base("paint", srgb2lin((0.016, 0.58, 0.66)), 0.85, 0.36, coat=1.0)
    base("black_gloss", (0.006, 0.008, 0.009), 0.4, 0.10, coat=0.8)
    base("black_matte", (0.012, 0.013, 0.014), 0.05, 0.72)
    base("glass", (0.010, 0.013, 0.015), 0.05, 0.06, transmission=0.30)
    base("glass_dark", (0.004, 0.005, 0.006), 0.15, 0.18, coat=0.5, transmission=0.05)
    base("liner", (0.006, 0.006, 0.007), 0.0, 0.92)
    base("tire", (0.007, 0.007, 0.008), 0.0, 0.9)
    base("rim_silver", (0.75, 0.75, 0.77), 1.0, 0.18)
    base("rim_dark", (0.025, 0.025, 0.028), 0.7, 0.32)
    base("caliper", (0.78, 0.55, 0.04), 0.5, 0.30)
    base("disc", (0.48, 0.48, 0.50), 0.95, 0.42)
    base("headlight_gloss", (0.008, 0.010, 0.012), 0.2, 0.04, coat=1.0)
    base("drl", (0.9, 0.95, 1.0), 0.0, 0.15, emit=(1.0, 1.0, 1.0), emit_str=4.5)
    base("tail_red", (0.32, 0.008, 0.008), 0.0, 0.15, emit=(1.0, 0.015, 0.015), emit_str=5.5)
    base("plate", (0.88, 0.88, 0.88), 0.0, 0.45)
    base("interior", (0.014, 0.015, 0.016), 0.0, 0.93)


def surface_y(body, x, z, from_rear=True):
    """Ray-cast the body from behind/front to find surface y at (x, z)."""
    if from_rear:
        origin = Vector((x, -4.0, z))
        direction = Vector((0, 1, 0))
    else:
        origin = Vector((x, 4.0, z))
        direction = Vector((0, -1, 0))
    hit, loc, normal, idx = body.ray_cast(origin, direction, distance=8.0)
    return (hit, loc.y, normal) if hit else (False, None, None)


# ---------------------------------------------------------------- wheels
def build_tire(name, r_out, width, rim_r):
    bm = bmesh.new()
    hw = width / 2
    sw = (r_out - rim_r)
    pts2d = [
        (hw, rim_r), (hw, rim_r + 0.5 * sw), (hw * 0.98, rim_r + 0.78 * sw),
        (hw * 0.85, r_out - 0.03 * sw), (hw * 0.62, r_out), (0.0, r_out + 0.002),
        (-hw * 0.62, r_out), (-hw * 0.85, r_out - 0.03 * sw),
        (-hw * 0.98, rim_r + 0.78 * sw), (-hw, rim_r + 0.5 * sw), (-hw, rim_r),
    ]
    verts = [bm.verts.new((x, 0, z)) for (x, z) in pts2d]
    for a, b in zip(verts[:-1], verts[1:]):
        bm.edges.new((a, b))
    bmesh.ops.spin(bm, geom=bm.verts[:] + bm.edges[:], cent=(0, 0, 0), axis=(1, 0, 0),
                   dvec=(0, 0, 0), angle=math.radians(360), steps=72, use_merge=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0006)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(bpy.data.materials["tire"])
    ob["is_tire"] = True
    return ob


def build_rim(name):
    bm = bmesh.new()
    R = 0.2565
    x_in, x_out = -0.102, 0.102
    N = 60
    angles = np.linspace(0, 2 * math.pi, N, endpoint=False)

    ring_in = [bm.verts.new((x_in, R * math.cos(a), R * math.sin(a))) for a in angles]
    ring_out = [bm.verts.new((x_out, R * math.cos(a), R * math.sin(a))) for a in angles]
    lip_r = R - 0.016
    lip_in = [bm.verts.new((x_out, lip_r * math.cos(a), lip_r * math.sin(a))) for a in angles]
    inner_r = 0.232
    bead = [bm.verts.new((x_out - 0.05, inner_r * math.cos(a), inner_r * math.sin(a))) for a in angles]
    for i in range(N):
        j = (i + 1) % N
        bm.faces.new((ring_in[i], ring_in[j], ring_out[j], ring_out[i]))
        bm.faces.new((ring_out[i], ring_out[j], lip_in[j], lip_in[i]))
        bm.faces.new((lip_in[i], lip_in[j], bead[j], bead[i]))

    back = [bm.verts.new((x_in, inner_r * math.cos(a), inner_r * math.sin(a))) for a in angles]
    for i in range(N):
        j = (i + 1) % N
        bm.faces.new((ring_in[i], ring_in[j], back[j], back[i]))

    hub_r = 0.063
    hub_ring = [bm.verts.new((0.055, hub_r * math.cos(a), hub_r * math.sin(a))) for a in angles]
    hub_f = [bm.verts.new((0.075, (hub_r * 0.92) * math.cos(a), (hub_r * 0.92) * math.sin(a))) for a in angles]
    hub_c = bm.verts.new((0.078, 0, 0))
    for i in range(N):
        j = (i + 1) % N
        bm.faces.new((hub_ring[i], hub_ring[j], hub_f[j], hub_f[i]))
        bm.faces.new((hub_f[i], hub_f[j], hub_c))

    # spokes: 5 Y-spokes (two arms merging at the rim), pentagon voids
    for k in range(5):
        base_ang = k * 2 * math.pi / 5 + math.pi / 2 + 0.12
        rib = R - 0.020
        merge = Vector((0.094, inner_r * math.cos(base_ang), inner_r * math.sin(base_ang)))
        tip = Vector((0.098, rib * math.cos(base_ang), rib * math.sin(base_ang)))
        rd = Vector((0, math.cos(base_ang), math.sin(base_ang)))
        nd = Vector((0, -math.sin(base_ang), math.cos(base_ang)))
        for sgn in (-1, 1):
            a0 = base_ang + sgn * 0.36
            p0 = Vector((0.058, hub_r * math.cos(a0), hub_r * math.sin(a0)))
            r0 = Vector((0, math.cos(a0), math.sin(a0)))
            n0 = Vector((0, -math.sin(a0), math.cos(a0)))
            w0, w1 = 0.010, 0.021
            t0, t1 = 0.012, 0.013
            a = [bm.verts.new(p0 + Vector((t0, 0, 0)) + n0 * w0),
                 bm.verts.new(p0 + Vector((t0, 0, 0)) - n0 * w0),
                 bm.verts.new(p0 - Vector((t0, 0, 0)) - n0 * w0),
                 bm.verts.new(p0 - Vector((t0, 0, 0)) + n0 * w0)]
            b = [bm.verts.new(merge + Vector((t1, 0, 0)) + nd * w1),
                 bm.verts.new(merge + Vector((t1, 0, 0)) - nd * w1),
                 bm.verts.new(merge - Vector((t1, 0, 0)) - nd * w1),
                 bm.verts.new(merge - Vector((t1, 0, 0)) + nd * w1)]
            bm.faces.new(a)
            bm.faces.new(list(reversed(b)))
            for i in range(4):
                bm.faces.new((a[i], b[i], b[(i + 1) % 4], a[(i + 1) % 4]))
        # Y tip to the rim
        wt, tt = 0.020, 0.013
        c0 = [bm.verts.new(merge + Vector((tt, 0, 0)) + nd * wt),
              bm.verts.new(merge + Vector((tt, 0, 0)) - nd * wt),
              bm.verts.new(merge - Vector((tt, 0, 0)) - nd * wt),
              bm.verts.new(merge - Vector((tt, 0, 0)) + nd * wt)]
        c1 = [bm.verts.new(tip + Vector((tt, 0, 0)) + nd * (wt * 0.8)),
              bm.verts.new(tip + Vector((tt, 0, 0)) - nd * (wt * 0.8)),
              bm.verts.new(tip - Vector((tt, 0, 0)) - nd * (wt * 0.8)),
              bm.verts.new(tip - Vector((tt, 0, 0)) + nd * (wt * 0.8))]
        bm.faces.new(c0)
        bm.faces.new(list(reversed(c1)))
        for i in range(4):
            bm.faces.new((c0[i], c1[i], c1[(i + 1) % 4], c0[(i + 1) % 4]))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(bpy.data.materials["rim_silver"])
    me.materials.append(bpy.data.materials["rim_dark"])
    for p in me.polygons:
        if abs(p.center.x - (-0.102)) < 0.002:
            p.material_index = 1
    return ob


def build_disc(name):
    bm = bmesh.new()
    R = 0.205
    N = 48
    angles = np.linspace(0, 2 * math.pi, N, endpoint=False)
    side1 = [bm.verts.new((-0.016, R * math.cos(a), R * math.sin(a))) for a in angles]
    side2 = [bm.verts.new((0.016, R * math.cos(a), R * math.sin(a))) for a in angles]
    c1 = bm.verts.new((-0.016, 0, 0))
    c2 = bm.verts.new((0.016, 0, 0))
    for i in range(N):
        j = (i + 1) % N
        bm.faces.new((side1[i], side1[j], side2[j], side2[i]))
        bm.faces.new((side1[j], side1[i], c1))
        bm.faces.new((side2[i], side2[j], c2))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(bpy.data.materials["disc"])
    return ob


def build_caliper(name):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= 0.06
        v.co.y *= 0.105
        v.co.z *= 0.20
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=0.012, segments=2, affect='EDGES')
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(bpy.data.materials["caliper"])
    return ob


def build_wheels():
    wheels = []
    for side, sx in (("L", 1), ("R", -1)):
        for axle, y, r_t, track in (("F", AXLE_F, R_TIRE_F, TRACK_F), ("R", AXLE_R, R_TIRE_R, TRACK_R)):
            r_m = r_t * 0.001
            tire = build_tire(f"tire_{axle}{side}", r_m, 0.245 if axle == "F" else 0.265, 0.2565)
            rim = build_rim(f"rim_{axle}{side}")
            disc = build_disc(f"disc_{axle}{side}")
            cal = build_caliper(f"cal_{axle}{side}")
            cx = sx * track / 2 * 0.001
            cy = y * 0.001
            tire.location = (cx, cy, r_m)
            rim.location = (cx, cy, r_m)
            if sx < 0:
                rim.rotation_euler[2] = math.pi
            disc.location = (cx - sx * 0.015, cy, r_m)
            cal.location = (cx - sx * 0.03, cy + sx * 0.135, r_m + 0.01)
            for ob in (tire, rim, disc, cal):
                wheels.append(ob)
    return wheels


# ---------------------------------------------------------------- details
def make_text(body, name, size, loc, rot, mat_name, extrude=0.002, spacing=1.0):
    bpy.ops.object.text_add(location=(0, 0, 0))
    t = bpy.context.object
    t.name = name
    t.data.body = body
    t.data.size = size
    t.data.extrude = extrude
    t.data.align_x = 'CENTER'
    t.data.align_y = 'CENTER'
    t.data.space_character = spacing
    bpy.ops.object.convert(target='MESH')
    t = bpy.context.object
    t.data.materials.append(bpy.data.materials[mat_name])
    t.location = loc
    t.rotation_euler = rot
    bpy.ops.object.shade_smooth()
    return t


def build_headlight(side):
    pts = [(-0.30, 0.008), (-0.23, 0.046), (-0.05, 0.058), (0.10, 0.044), (0.20, 0.018),
           (0.22, -0.010), (0.14, -0.036), (0.0, -0.046), (-0.18, -0.034)]

    def poly_obj(name, scale, depth, mat, y_off, rot, loc):
        bm = bmesh.new()
        v = [bm.verts.new((px * scale, 0, pz * scale)) for (px, pz) in pts]
        f = bm.faces.new(v)
        r = bmesh.ops.extrude_face_region(bm, geom=[f])
        for el in r["geom"]:
            if isinstance(el, bmesh.types.BMVert):
                el.co.y -= depth
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(name, me)
        bpy.context.collection.objects.link(ob)
        me.materials.append(bpy.data.materials[mat])
        ob.location = loc
        ob.rotation_euler = rot
        return ob

    hit, ysurf, n = surface_y(BODY, side * 0.655, 0.635, from_rear=False)
    if not hit:
        ysurf, n = 2.40, Vector((side * 0.3, 0.94, 0.1))
    loc = (side * 0.63, ysurf + 0.008, 0.630)
    rot = (math.atan2(n[2], n[1]), 0, -side * abs(math.atan2(n[0], n[1])) * 0.9)

    obs = []
    obs.append(poly_obj(f"hl_recess_{side}", 1.04, 0.035, "black_matte", 0, rot,
                        (loc[0], loc[1] + 0.010, loc[2])))
    lens = poly_obj(f"headlight_{side}", 0.98, 0.05, "headlight_gloss", 0, rot, loc)
    obs.append(lens)
    # four projector lenses deep behind the glass
    Rm = lens.rotation_euler.to_matrix()
    for i, (lx, lz) in enumerate(((-0.185, 0.012), (-0.085, 0.018), (0.015, 0.008), (0.115, -0.008))):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.015, depth=0.02, vertices=20,
                                            location=(0, 0, 0))
        cyl = bpy.context.object
        cyl.name = f"hl_lens_{side}_{i}"
        cyl.rotation_euler = (math.radians(90), 0, 0)
        cyl.data.materials.append(bpy.data.materials["rim_dark"])
        off = Vector((side * lx, -0.022, lz))
        cyl.location = Vector(loc) + Rm @ off
        cyl.rotation_euler = rot
        obs.append(cyl)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v2 in bm.verts:
        v2.co.x *= 0.235
        v2.co.y *= 0.008
        v2.co.z *= 0.009
    me = bpy.data.meshes.new(f"drl_{side}")
    bm.to_mesh(me)
    bm.free()
    d = bpy.data.objects.new(f"drl_{side}", me)
    bpy.context.collection.objects.link(d)
    me.materials.append(bpy.data.materials["drl"])
    d.location = (side * 0.63, ysurf - 0.002, 0.664)
    d.rotation_euler = rot
    obs.append(d)
    return obs


def build_front_details():
    obs = []
    # grille slats on the fascia (placed by ray cast)
    for i, z in enumerate((0.215, 0.262, 0.309)):
        hit, ysurf, n = surface_y(BODY, 0.0, z, from_rear=False)
        if not hit:
            ysurf = 2.45
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co.x *= 0.30 - i * 0.012
            v.co.y *= 0.012
            v.co.z *= 0.011
        me = bpy.data.meshes.new(f"slat_{i}")
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(f"slat_{i}", me)
        bpy.context.collection.objects.link(ob)
        me.materials.append(bpy.data.materials["rim_dark"])
        ob.location = (0, ysurf - 0.004, z)
        ob.rotation_euler = (-0.16, 0, 0)
        obs.append(ob)
    # air curtain vents
    for s in (-1, 1):
        hit, ysurf, n = surface_y(BODY, s * 0.615, 0.40, from_rear=False)
        if not hit:
            ysurf = 2.40
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co.x *= 0.038
            v.co.y *= 0.05
            v.co.z *= 0.115
        me = bpy.data.meshes.new(f"vent_{s}")
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(f"vent_{s}", me)
        bpy.context.collection.objects.link(ob)
        me.materials.append(bpy.data.materials["black_gloss"])
        ob.location = (s * 0.615, ysurf + 0.01, 0.40)
        ob.rotation_euler = (0, 0, s * 0.20)
        obs.append(ob)
    # fender blade vent behind front wheel
    for s in (-1, 1):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co.x *= 0.010
            v.co.y *= 0.075
            v.co.z *= 0.012
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=0.004, segments=1, affect='EDGES')
        me = bpy.data.meshes.new(f"blade_{s}")
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(f"blade_{s}", me)
        bpy.context.collection.objects.link(ob)
        me.materials.append(bpy.data.materials["black_gloss"])
        ob.location = (s * 0.968, 1.02, 0.615)
        ob.rotation_euler = (0, s * 0.12, s * -0.06)
        obs.append(ob)
    # chrome trim above lower intake (reference feature)
    bm = bmesh.new()
    r_top, r_bot = [], []
    for x in np.linspace(-0.60, 0.60, 25):
        hit, ysurf, n = surface_y(BODY, float(x), 0.345, from_rear=False)
        if not hit:
            ysurf = 2.44
        r_top.append(bm.verts.new((x, ysurf - 0.008, 0.356)))
        r_bot.append(bm.verts.new((x, ysurf - 0.002, 0.340)))
    for i in range(len(r_top) - 1):
        bm.faces.new((r_top[i], r_top[i + 1], r_bot[i + 1], r_bot[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("trim_front")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("trim_front", me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(bpy.data.materials["rim_silver"])
    me.materials.append(bpy.data.materials["rim_dark"])
    obs.append(ob)
    # front plate (ray cast)
    hit, ysurf, n = surface_y(BODY, 0.0, 0.415, from_rear=False)
    if not hit:
        ysurf = 2.44
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= 0.22
        v.co.y *= 0.006
        v.co.z *= 0.072
    me = bpy.data.meshes.new("plate_front")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("plate_front", me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(bpy.data.materials["plate"])
    ob.location = (0, ysurf + 0.008, 0.415)
    ob.rotation_euler = (-0.16, 0, 0)
    obs.append(ob)
    obs.append(make_text("XIAOMI SU7", "pltext_f", 0.052, (0, ysurf + 0.016, 0.415),
                         (-0.16, 0, math.pi), "black_matte", 0.0015, spacing=0.9))
    return obs


def build_edge_lines():
    """Thin dark shut lines along the crown/tumble junction (hood edge, deck edge)."""
    obs = []
    for name, y0, y1, mirror in (("edgeline_L", 720, 2430, False),
                                 ("deckline", -2450, -1520, False)):
        bm = bmesh.new()
        rows = []
        ysteps = np.arange(min(y0, y1), max(y0, y1) + 1, 40.0)
        for y in ysteps:
            pts, zones = profile_points(float(y))
            idx = None
            for i in range(len(zones) - 1):
                if zones[i] == "crown" and zones[i + 1] == "tumble":
                    idx = i
                    break
            if idx is None:
                rows.append([])
                continue
            x1, z1 = pts[idx]
            x2, z2 = pts[idx + 1]
            tx, tz = (x2 - x1), (z2 - z1)
            ln = math.hypot(tx, tz) or 1.0
            tx, tz = tx / ln, tz / ln
            nx, nz = tz, -tx
            if nx < 0:
                nx, nz = -nx, -nz
            pa = (x1 + nx * 0.0015 + tx * 0.0032, z1 + nz * 0.0015 + tz * 0.0032)
            pb = (x1 + nx * 0.0015 - tx * 0.0032, z1 + nz * 0.0015 - tz * 0.0032)
            rows.append([bm.verts.new((pa[0], float(y) * 0.001, pa[1])),
                         bm.verts.new((pb[0], float(y) * 0.001, pb[1]))])
        for r0, r1 in zip(rows[:-1], rows[1:]):
            if len(r0) == 2 and len(r1) == 2:
                bm.faces.new((r0[0], r1[0], r1[1], r0[1]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(name, me)
        bpy.context.collection.objects.link(ob)
        me.materials.append(bpy.data.materials["black_matte"])
        ob.scale.x = -1
        obs.append(ob)
        ob2 = ob.copy()
        ob2.data = ob.data.copy()
        ob2.name = name + "_R"
        ob2.scale.x = 1
        bpy.context.collection.objects.link(ob2)
        obs.append(ob2)
    return obs


def build_door_lines():
    obs = []
    for s in (-1, 1):
        for y_line in (0.60, -0.25, -1.06):
            lm = landmarks(y_line)
            zlim = lm["z_gl"] * 0.001 + 0.01
            zb = SILL_Z * 0.001 + 0.03
            bm = bmesh.new()
            pts, zones = profile_points(y_line * 1000.0)
            sel = [(x, z, i) for i, (x, z) in enumerate(pts) if zb <= z <= zlim]
            if len(sel) < 3:
                bm.free()
                continue
            n = len(pts)
            r1, r2 = [], []
            for (x, z, i) in sel:
                xp, zp = pts[max(i - 1, 0)]
                xn, zn = pts[min(i + 1, n - 1)]
                tx, tz = (xn - xp), (zn - zp)
                ln = math.hypot(tx, tz) or 1.0
                nx, nz = tz / ln, -tx / ln
                if nx < 0:
                    nx, nz = -nx, -nz
                px, pz = x + nx * 0.0015, z + nz * 0.0015
                r1.append(bm.verts.new((px, y_line - 0.0018, pz)))
                r2.append(bm.verts.new((px, y_line + 0.0018, pz)))
            for i in range(len(r1) - 1):
                bm.faces.new((r1[i], r1[i + 1], r2[i + 1], r2[i]))
            me = bpy.data.meshes.new(f"doorline_{s}_{y_line}")
            bm.to_mesh(me)
            bm.free()
            ob = bpy.data.objects.new(f"doorline_{s}_{y_line}", me)
            bpy.context.collection.objects.link(ob)
            me.materials.append(bpy.data.materials["black_matte"])
            if s < 0:
                ob.scale.x = -1
            obs.append(ob)
    return obs


def build_tail_details():
    obs = []
    # curved light bar following the tail (ray cast)
    bm = bmesh.new()
    xs = np.linspace(-0.615, 0.615, 49)
    rows = []
    n_pts = []
    for x in xs:
        hit, ysurf, n = surface_y(BODY, float(x), 0.905, from_rear=True)
        if not hit:
            ysurf = -2.45
        rows.append(ysurf)
    for i, x in enumerate(xs):
        y = rows[i]
        if y is None:
            continue
        z0, z1 = 0.868, 0.936
        y0, y1 = y - 0.018, y + 0.004
        bm.verts.new((x, y0, z0))
        bm.verts.new((x, y1, z0))
        bm.verts.new((x, y1, z1))
        bm.verts.new((x, y0, z1))
    vs = bm.verts[:]
    for i in range(len(vs) // 4 - 1):
        r0 = vs[i * 4:i * 4 + 4]
        r1 = vs[i * 4 + 4:i * 4 + 8]
        if len(r1) < 4:
            break
        for k in range(4):
            bm.faces.new((r0[k], r0[(k + 1) % 4], r1[(k + 1) % 4], r1[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("lightbar")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("lightbar", me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(bpy.data.materials["tail_red"])
    obs.append(ob)
    # light bar housing (dark strip under the bar)
    bm = bmesh.new()
    rows2 = []
    for i, x in enumerate(xs):
        y = rows[i] if i < len(rows) else None
        if y is None:
            continue
        rows2.append([bm.verts.new((x, y - 0.010, 0.842)), bm.verts.new((x, y - 0.010, 0.870)),
                      bm.verts.new((x, y + 0.004, 0.870)), bm.verts.new((x, y + 0.004, 0.842))])
    for r0, r1 in zip(rows2[:-1], rows2[1:]):
        for k in range(4):
            bm.faces.new((r0[k], r0[(k + 1) % 4], r1[(k + 1) % 4], r1[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("bar_housing")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("bar_housing", me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(bpy.data.materials["black_gloss"])
    obs.append(ob)
    # XIAOMI letters above bar
    hit, ysurf, n = surface_y(BODY, 0.0, 0.995, from_rear=True)
    if not hit:
        ysurf = -2.47
    obs.append(make_text("X I A O M I", "tail_brand", 0.058, (0, ysurf - 0.004, 0.995),
                         (math.radians(76), 0, 0), "rim_silver", 0.002, spacing=0.85))
    hit, ysurf, n = surface_y(BODY, 0.55, 0.80, from_rear=True)
    if not hit:
        ysurf = -2.44
    obs.append(make_text("SU7", "tail_su7", 0.052, (0.55, ysurf - 0.004, 0.80),
                         (math.radians(80), 0, 0), "rim_silver", 0.002, spacing=0.9))
    # rear plate
    hit, ysurf, n = surface_y(BODY, 0.0, 0.575, from_rear=True)
    if not hit:
        ysurf = -2.44
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= 0.22
        v.co.y *= 0.006
        v.co.z *= 0.072
    me = bpy.data.meshes.new("plate_rear")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("plate_rear", me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(bpy.data.materials["plate"])
    ob.location = (0, ysurf - 0.008, 0.575)
    ob.rotation_euler = (math.radians(14), 0, 0)
    obs.append(ob)
    obs.append(make_text("SU7", "pltext_r", 0.052, (0, ysurf - 0.016, 0.575),
                         (math.radians(14), 0, math.pi), "black_matte", 0.0015, spacing=0.9))
    # red reflectors on bumper
    for s in (-1, 1):
        hit, ys, n = surface_y(BODY, s * 0.38, 0.32, from_rear=True)
        if not hit:
            ys = -2.47
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co.x *= 0.055
            v.co.y *= 0.006
            v.co.z *= 0.011
        me = bpy.data.meshes.new(f"reflector_{s}")
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(f"reflector_{s}", me)
        bpy.context.collection.objects.link(ob)
        me.materials.append(bpy.data.materials["tail_red"])
        ob.location = (s * 0.38, ys - 0.004, 0.32)
        obs.append(ob)
    # diffuser fins
    for fx in (-0.24, 0.0, 0.24):
        hit, ys, n = surface_y(BODY, fx, 0.20, from_rear=True)
        if not hit:
            ys = -2.44
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co.x *= 0.006
            v.co.y *= 0.028
            v.co.z *= 0.052
        me = bpy.data.meshes.new(f"fin_{fx}")
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(f"fin_{fx}", me)
        bpy.context.collection.objects.link(ob)
        me.materials.append(bpy.data.materials["black_gloss"])
        ob.location = (fx, ys + 0.01, 0.15)
        obs.append(ob)
    return obs


def build_mirrors():
    obs = []
    for s in (-1, 1):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co.x *= 0.030
            v.co.y *= 0.105
            v.co.z *= 0.042
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=0.010, segments=2, affect='EDGES')
        me = bpy.data.meshes.new(f"mirror_{s}")
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(f"mirror_{s}", me)
        bpy.context.collection.objects.link(ob)
        me.materials.append(bpy.data.materials["paint"])
        me.materials.append(bpy.data.materials["black_gloss"])
        for p in me.polygons:
            if p.center.y < -0.06:
                p.material_index = 1
        ob.location = (s * 0.935, 0.33, 1.01)
        ob.rotation_euler = (math.radians(-8), 0, s * math.radians(-10))
        obs.append(ob)

        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co.x *= 0.055
            v.co.y *= 0.016
            v.co.z *= 0.011
        me = bpy.data.meshes.new(f"stalk_{s}")
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(f"stalk_{s}", me)
        bpy.context.collection.objects.link(ob)
        me.materials.append(bpy.data.materials["black_gloss"])
        ob.location = (s * 0.905, 0.33, 1.00)
        obs.append(ob)
    return obs


def build_handles():
    obs = []
    for s in (-1, 1):
        for y, z, rot in ((0.42, 0.99, -0.03), (-0.30, 0.99, 0.03)):
            bm = bmesh.new()
            bmesh.ops.create_cube(bm, size=1.0)
            for v in bm.verts:
                v.co.x *= 0.006
                v.co.y *= 0.052
                v.co.z *= 0.010
            bmesh.ops.bevel(bm, geom=bm.edges[:], offset=0.003, segments=1, affect='EDGES')
            me = bpy.data.meshes.new(f"handle_{s}_{y}")
            bm.to_mesh(me)
            bm.free()
            ob = bpy.data.objects.new(f"handle_{s}_{y}", me)
            bpy.context.collection.objects.link(ob)
            me.materials.append(bpy.data.materials["black_gloss"])
            ob.location = (s * 0.965, y, z)
            obs.append(ob)
    return obs


def build_lidar():
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= 0.105
        v.co.y *= 0.075
        v.co.z *= 0.034
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=0.02, segments=3, affect='EDGES')
    me = bpy.data.meshes.new("lidar")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("lidar", me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(bpy.data.materials["black_gloss"])
    ob.location = (0, 0.30, 1.398)
    return ob


def build_interior():
    bm = bmesh.new()
    # cabin floor + dash
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= 1.68
        v.co.y *= 2.30
        v.co.z *= 0.55
    bm.verts.ensure_lookup_table()
    for v in bm.verts:
        v.co.y += -0.55
        v.co.z += 1.02
        hit, loc, nrm, idx = BODY.ray_cast(Vector((v.co.x, v.co.y, 2.6)), Vector((0, 0, -1)), distance=4.0)
        if hit:
            v.co.z = min(v.co.z, loc.z - 0.055)
    me = bpy.data.meshes.new("cabin")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("cabin", me)
    bpy.context.collection.objects.link(ob)
    ob.scale = (1.0, 1.0, 1.0)
    me.materials.append(bpy.data.materials["interior"])

    # seats (2) with headrests
    seats = []
    for sx in (-0.38, 0.38):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co.x *= 0.28
            v.co.y *= 0.30
            v.co.z *= 0.24
        me = bpy.data.meshes.new(f"seat_{sx}")
        bm.to_mesh(me)
        bm.free()
        s = bpy.data.objects.new(f"seat_{sx}", me)
        bpy.context.collection.objects.link(s)
        me.materials.append(bpy.data.materials["interior"])
        s.location = (sx, -0.30, 1.02)
        seats.append(s)
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co.x *= 0.14
            v.co.y *= 0.055
            v.co.z *= 0.11
        me = bpy.data.meshes.new(f"headrest_{sx}")
        bm.to_mesh(me)
        bm.free()
        s = bpy.data.objects.new(f"headrest_{sx}", me)
        bpy.context.collection.objects.link(s)
        me.materials.append(bpy.data.materials["interior"])
        s.location = (sx, -0.44, 1.21)
        seats.append(s)
    # dashboard wedge
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= 0.78
        v.co.y *= 0.22
        v.co.z *= 0.13
        v.co.z += v.co.y * 0.5
    me = bpy.data.meshes.new("dash")
    bm.to_mesh(me)
    bm.free()
    d = bpy.data.objects.new("dash", me)
    bpy.context.collection.objects.link(d)
    me.materials.append(bpy.data.materials["interior"])
    d.location = (0, 0.42, 1.04)
    seats.append(d)
    return [ob] + seats


def build_liner():
    obs = []
    for cx, r in ((AXLE_F, ARCH_R_F), (AXLE_R, ARCH_R_R)):
        for s in (-1, 1):
            bm = bmesh.new()
            steps = 20
            ring1, ring2 = [], []
            for i in range(steps + 1):
                a = math.pi * i / steps
                pz = (ARCH_CZ + (r - 22) * math.sin(a)) * 0.001
                pyy = (cx + (r - 22) * math.cos(a)) * 0.001
                ring1.append(bm.verts.new((0.50, pyy, pz)))
                ring2.append(bm.verts.new((0.86, pyy, pz)))
            for i in range(steps):
                bm.faces.new((ring1[i], ring1[i + 1], ring2[i + 1], ring2[i]))
            me = bpy.data.meshes.new(f"liner_{cx}_{s}")
            bm.to_mesh(me)
            bm.free()
            ob = bpy.data.objects.new(f"liner_{cx}_{s}", me)
            bpy.context.collection.objects.link(ob)
            me.materials.append(bpy.data.materials["liner"])
            if s < 0:
                ob.scale.x = -1
            obs.append(ob)
    return obs


# ---------------------------------------------------------------- scene
def setup_scene():
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 96
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 8
    sc.view_settings.view_transform = "Filmic"
    sc.view_settings.look = "Medium High Contrast"

    world = bpy.data.worlds.new("W")
    sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.16, 0.17, 0.19, 1.0)
    bg.inputs[1].default_value = 1.0

    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0))
    floor = bpy.context.object
    floor.name = "floor"
    m = bpy.data.materials.new("floor")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.14, 0.145, 0.155, 1)
    b.inputs["Roughness"].default_value = 0.5
    floor.data.materials.append(m)

    for nm, loc, energy, size in (
        ("key", (-5.2, 4.5, 6.5), 6000, 8.0),
        ("fill", (6.5, 2.0, 3.4), 1400, 6.0),
        ("rim", (0.5, -8.5, 5.0), 2600, 6.0),
        ("top", (0.4, 0.6, 9.0), 1400, 10.0),
    ):
        bpy.ops.object.light_add(type="AREA", location=loc)
        lt = bpy.context.object
        lt.name = nm
        lt.data.energy = energy
        lt.data.size = size
        d = Vector((0, 0, 0.8)) - Vector(loc)
        lt.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

    # backdrop wall for structured reflections
    bpy.ops.mesh.primitive_plane_add(size=46, location=(0, -19, 5), rotation=(math.radians(90), 0, 0))
    wall = bpy.context.object
    wall.name = "wall"
    wm = bpy.data.materials.new("wall")
    wm.use_nodes = True
    wb = wm.node_tree.nodes["Principled BSDF"]
    wb.inputs["Base Color"].default_value = (0.13, 0.14, 0.155, 1)
    wb.inputs["Roughness"].default_value = 0.9
    wall.data.materials.append(wm)


def setup_cameras():
    cams = {}

    def add(name, loc, target, ortho=None, lens=85):
        d = Vector(target) - Vector(loc)
        rot = d.to_track_quat('-Z', 'Y').to_euler()
        bpy.ops.object.camera_add(location=loc)
        c = bpy.context.object
        c.name = name
        c.data.lens = lens
        if ortho:
            c.data.type = 'ORTHO'
            c.data.ortho_scale = ortho
        c.rotation_euler = rot
        cams[name] = c
        return c

    add("side", (-14.5, 0.0, 0.957), (0, 0.0, 0.957), ortho=5.63)
    add("front", (0, 13.5, 0.93), (0, 0, 0.93), ortho=3.64)
    add("rear", (0, -13.5, 0.93), (0, 0, 0.93), ortho=3.64)
    add("f34", (-8.4, 9.4, 2.30), (0, -0.35, 0.60), lens=100)
    add("f34b", (7.8, 9.6, 2.05), (0, -0.25, 0.62), lens=100)
    return cams


BODY = None


def main():
    global BODY
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = 'METRIC'
    make_materials()
    setup_scene()
    body, face_zones, face_ys = build_body()
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    assign_body_materials(body, face_zones, face_ys)
    mod = body.modifiers.new("subsurf", 'SUBSURF')
    mod.levels = 2
    mod.render_levels = 2
    bpy.ops.object.modifier_apply(modifier="subsurf")
    bpy.ops.object.shade_smooth()
    BODY = body

    build_wheels()
    for s in (-1, 1):
        build_headlight(s)
    build_front_details()
    build_tail_details()
    build_mirrors()
    build_handles()
    build_lidar()
    build_interior()
    build_liner()
    build_overlays()
    build_door_lines()
    build_edge_lines()

    cams = setup_cameras()
    sc = bpy.context.scene
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "su7_build.blend"))

    # ---- export GLB (car only) ----
    try:
        bpy.ops.object.select_all(action='DESELECT')
        skip = {"floor", "wall"}
        for ob in bpy.data.objects:
            if ob.type == 'MESH' and ob.name not in skip:
                ob.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=os.path.join(ROOT, "su7.glb"),
            export_format='GLB',
            use_selection=True,
            export_apply=True,
            export_yup=True,
        )
        print("GLB_EXPORTED")
    except Exception as e:
        print("GLB_EXPORT_FAILED", e)

    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    views = [a for a in args if a in cams]
    round_name = "r0"
    for a in args:
        if a.startswith("round="):
            round_name = a.split("=")[1]
    res = {"side": (1165, 404), "front": (1158, 598), "rear": (1036, 587),
           "f34": (1128, 457), "f34b": (1109, 472)}
    meta = {}
    for v, c in cams.items():
        if c.data.type != 'ORTHO':
            continue
        rx, ry = res[v]
        mm_px = c.data.ortho_scale / rx
        meta[v] = {
            "mm_px": mm_px,
            "axle_f_px": rx / 2.0 - (AXLE_F * 0.001) / mm_px,
            "axle_r_px": rx / 2.0 - (AXLE_R * 0.001) / mm_px,
            "ground_py": ry / 2.0 + c.location.z / mm_px,
            "center_px": rx / 2.0,
        }
    with open(os.path.join(RENDERS, "cam_meta.json"), "w") as f:
        json.dump(meta, f, indent=1)
    if views:
        for v in views:
            sc.camera = cams[v]
            sc.render.resolution_x, sc.render.resolution_y = res[v]
            sc.render.filepath = os.path.join(RENDERS, f"{round_name}_{v}.png")
            bpy.ops.render.render(write_still=True)
            print("RENDERED", v)
        # silhouette passes
        sc.render.film_transparent = True
        sc.cycles.samples = 4
        sc.cycles.use_denoising = False
        floor = bpy.data.objects.get("floor")
        wall = bpy.data.objects.get("wall")
        if floor:
            floor.hide_render = True
        if wall:
            wall.hide_render = True
        hidden = []
        for ob in bpy.data.objects:
            if ob.name.startswith(("mirror_", "stalk_", "blade_")):
                ob.hide_render = True
                hidden.append(ob)
        for v in views:
            sc.camera = cams[v]
            sc.render.resolution_x, sc.render.resolution_y = res[v]
            sc.render.filepath = os.path.join(RENDERS, f"{round_name}_{v}_mask.png")
            bpy.ops.render.render(write_still=True)
        if floor:
            floor.hide_render = False
        if wall:
            wall.hide_render = False
        for ob in hidden:
            ob.hide_render = False
        sc.render.film_transparent = False
    print("BUILD_DONE")


main()




















