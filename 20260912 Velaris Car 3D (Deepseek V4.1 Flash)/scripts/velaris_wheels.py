"""VELARIS wheels: tires with tread, forged rims, brake discs and calipers."""

import bpy
import velaris_lib as vl
from math import sin, cos, pi, radians, atan2, sqrt, degrees
from mathutils import Vector

MATS = {}


def revolve(name, profile, seg, closed, collection):
    verts, faces = [], []
    m = len(profile)
    for j in range(seg):
        a = 2.0 * pi * j / seg
        ca, sa = cos(a), sin(a)
        for (r, y) in profile:
            verts.append((r * ca, y, r * sa))
    for j in range(seg):
        jn = (j + 1) % seg
        span = m if closed else m - 1
        for i in range(span):
            i2 = (i + 1) % m
            a = j * m + i
            b = j * m + i2
            c = jn * m + i2
            d = jn * m + i
            faces.append((a, d, c, b))
    return vl.make_mesh_object(name, verts, faces, collection)


def build_tire(name, radius, width, collection, seg=256):
    half = width * 0.5
    rim_r = radius - 0.090
    crown_rows = 24
    prof = [
        (rim_r, half),
        (rim_r + 0.010, half + 0.002),
        (radius - 0.060, half + 0.008),
        (radius - 0.030, half * 0.975),
        (radius - 0.008, half * 0.83),
        (radius, half * 0.60),
    ]
    for k in range(1, crown_rows):
        prof.append((radius, half * 0.60 - k * (half * 1.20 / crown_rows)))
    prof += [
        (radius, -half * 0.60),
        (radius - 0.008, -half * 0.83),
        (radius - 0.030, -half * 0.975),
        (radius - 0.060, -half - 0.008),
        (rim_r + 0.010, -half - 0.002),
        (rim_r, -half),
        (rim_r - 0.014, -half * 0.92),
        (rim_r - 0.014, 0.0),
        (rim_r - 0.014, half * 0.92),
    ]
    ob = revolve(name, prof, seg, True, collection)
    tread_lo = radius - 0.012
    tg = half * 0.60
    groove_centers = (-0.70 * tg, -0.235 * tg, 0.235 * tg, 0.70 * tg)
    groove_half = 0.0072
    groove_depth = 0.0105
    slot_period = 26.0
    me = ob.data
    for v in me.vertices:
        x, y, z = v.co
        r = sqrt(x * x + z * z)
        if r < tread_lo:
            continue
        push = 0.0
        for c in groove_centers:
            d = abs(y - c)
            if d < groove_half:
                push = max(push, groove_depth * (1.0 - (d / groove_half) ** 2) ** 0.5)
        if abs(y) < tg + 0.014:
            ay = min(abs(y), tg)
            side = 1.0 if y >= 0 else -1.0
            ang = degrees(atan2(z, x))
            if ay > 0.46 * tg:
                span = (ay - 0.46 * tg) / (0.54 * tg)
                ph = (ang - side * 18.0 * span) % slot_period
                if ph < 4.5:
                    push = max(push, 0.0105 * (1.0 - (ph / 4.5) ** 2) ** 0.5)
            elif ay > 0.30 * tg:
                span = (ay - 0.30 * tg) / (0.16 * tg)
                ph = (ang + side * 12.0 * span) % slot_period
                if ph < 2.8:
                    push = max(push, 0.0065 * (1.0 - (ph / 2.8) ** 2) ** 0.5)
        if push > 0.0:
            nr = r - push
            s = nr / r
            v.co.x = x * s
            v.co.z = z * s
    me.update()
    return ob


def build_rim(name, radius, width, collection, seg=128, mat_key="rim"):
    half = width * 0.5
    rim_r = radius - 0.090
    prof = [
        (rim_r - 0.014, -half * 0.90),
        (rim_r + 0.002, -half * 0.90),
        (rim_r + 0.010, -half * 0.84),
        (rim_r + 0.004, -half * 0.78),
        (rim_r - 0.010, -half * 0.72),
        (rim_r - 0.012, -half * 0.20),
        (rim_r - 0.012, half * 0.30),
        (rim_r - 0.004, half * 0.52),
        (rim_r - 0.030, half * 0.585),
        (rim_r - 0.055, half * 0.615),
        (rim_r - 0.078, half * 0.625),
    ]
    ob = revolve(name, prof, seg, False, collection)
    vl.assign_material(ob, MATS[mat_key], 0)
    vl.add_solidify(ob, 0.007, 0.0)
    lip_prof = [
        (rim_r + 0.010, half * 0.93),
        (rim_r + 0.013, half * 0.84),
        (rim_r + 0.006, half * 0.70),
        (rim_r - 0.004, half * 0.64),
        (rim_r - 0.012, half * 0.66),
        (rim_r - 0.008, half * 0.80),
    ]
    lip = revolve(name + "_Lip", lip_prof, seg, True, collection)
    vl.assign_material(lip, MATS["machined"], 0)
    vl.shade_smooth(lip, 60)
    return ob, lip


def build_spokes(name, radius, width, count, collection,
                 w_in=0.050, w_out=0.026, th_in=0.024, th_out=0.016):
    half = width * 0.5
    rim_r = radius - 0.090
    face_y = half * 0.625
    r0, r1 = 0.058, rim_r - 0.070
    verts, faces = [], []
    for i in range(count):
        a = 2.0 * pi * i / count
        ca, sa = cos(a), sin(a)
        verts += [
            (r0 * ca - w_in * sa * 0.5, face_y - th_in * 0.5, r0 * sa + w_in * ca * 0.5),
            (r0 * ca + w_in * sa * 0.5, face_y - th_in * 0.5, r0 * sa - w_in * ca * 0.5),
            (r1 * ca + w_out * sa * 0.5, face_y - th_out * 0.5, r1 * sa - w_out * ca * 0.5),
            (r1 * ca - w_out * sa * 0.5, face_y - th_out * 0.5, r1 * sa + w_out * ca * 0.5),
            (r0 * ca - w_in * sa * 0.5, face_y + th_in * 0.5, r0 * sa + w_in * ca * 0.5),
            (r0 * ca + w_in * sa * 0.5, face_y + th_in * 0.5, r0 * sa - w_in * ca * 0.5),
            (r1 * ca + w_out * sa * 0.5, face_y + th_out * 0.5, r1 * sa - w_out * ca * 0.5),
            (r1 * ca - w_out * sa * 0.5, face_y + th_out * 0.5, r1 * sa + w_out * ca * 0.5),
        ]
        b = i * 8
        faces += [
            (b + 0, b + 1, b + 2, b + 3),
            (b + 7, b + 6, b + 5, b + 4),
            (b + 0, b + 4, b + 5, b + 1),
            (b + 1, b + 5, b + 6, b + 2),
            (b + 2, b + 6, b + 7, b + 3),
            (b + 3, b + 7, b + 4, b + 0),
        ]
    ob = vl.make_mesh_object(name, verts, faces, collection)
    vl.assign_material(ob, MATS["rim"], 0)
    vl.add_bevel(ob, 0.0035, 2, angle=25)
    return ob


def build_hub(name, radius, width, collection):
    half = width * 0.5
    face_y = half * 0.625
    hub = vl.cylinder_mesh(name, 0.065, 0.055, 48, ax="Y", collection=collection)
    hub.location = (0.0, face_y + 0.004, 0.0)
    vl.assign_material(hub, MATS["rim"])
    cap = vl.cylinder_mesh(name + "_Cap", 0.044, 0.014, 48, ax="Y", collection=collection)
    cap.location = (0.0, face_y + 0.034, 0.0)
    vl.assign_material(cap, MATS["machined"])
    return hub, cap


def build_disc(name, collection):
    disc = vl.cylinder_mesh(name, 0.205, 0.028, 96, ax="Y", collection=collection)
    vl.assign_material(disc, MATS["disc"], 0)
    hat = vl.cylinder_mesh(name + "_Hat", 0.072, 0.052, 48, ax="Y", collection=collection)
    hat.location = (0.0, 0.012, 0.0)
    vl.assign_material(hat, MATS["disc_hat"], 0)
    cutters = []
    for ring_r in (0.145, 0.172):
        for i in range(24):
            a = 2.0 * pi * i / 24 + (0.13 if ring_r > 0.16 else 0.0)
            hole = vl.cylinder_mesh("hole", 0.0085, 0.3, 12, ax="Y", collection=collection)
            hole.location = (ring_r * cos(a), 0.0, ring_r * sin(a))
            cutters.append(hole)
    cutter = vl.join_objects(cutters, name + "_Cutter")
    vl.boolean_cut(disc, cutter)
    return disc, hat


def build_caliper(name, angle_deg, face_y, collection):
    a = radians(angle_deg)
    r = 0.183
    ob = vl.box_mesh(name, (0.115, 0.062, 0.078),
                     (r * cos(a), face_y, r * sin(a)),
                     (0.0, radians(angle_deg + 90.0), 0.0), collection)
    vl.apply_scale(ob)
    vl.assign_material(ob, MATS["caliper"], 0)
    vl.add_bevel(ob, 0.010, 3, angle=25)
    return ob


def build_variant_rims(prefix, radius, width, collection):
    out = []
    sets = [
        ("ST2", MATS["dark_chrome"], 5,
         dict(w_in=0.095, w_out=0.070, th_in=0.032, th_out=0.024)),
        ("ST3", MATS["machined"], 20,
         dict(w_in=0.030, w_out=0.017, th_in=0.019, th_out=0.013)),
    ]
    for tag, mat, count, kw in sets:
        rim, lip = build_rim(prefix + "_Rim_" + tag, radius, width, collection,
                             mat_key="rim")
        vl.assign_material(rim, mat, 0)
        spokes = build_spokes(prefix + "_Spokes_" + tag, radius, width, count,
                              collection, **kw)
        vl.assign_material(spokes, mat, 0)
        vl.apply_modifiers(rim)
        vl.apply_modifiers(spokes)
        vl.shade_smooth(rim, 45)
        vl.shade_smooth(spokes, 40)
        out += [rim, lip, spokes]
    return out


def build_wheel_pair(prefix, radius, width, spokes, collection):
    tire = build_tire(prefix + "_Tire", radius, width, collection)
    vl.assign_material(tire, MATS["rubber"], 0)
    vl.shade_smooth(tire, 45)
    rim, lip = build_rim(prefix + "_Rim", radius, width, collection, mat_key="rim")
    spokes_ob = build_spokes(prefix + "_Spokes", radius, width, spokes, collection)
    hub, cap = build_hub(prefix + "_Hub", radius, width, collection)
    vl.apply_modifiers(rim)
    vl.apply_modifiers(spokes_ob)
    vl.shade_smooth(rim, 45)
    vl.shade_smooth(spokes_ob, 40)
    variants = build_variant_rims(prefix, radius, width, collection)
    return {"base": [tire, rim, lip, spokes_ob, hub, cap], "variants": variants}


def place_corners(collection, front_wheels, rear_wheels):
    from mathutils import Euler
    corners = []
    steer = radians(8.0)
    specs = [
        ("FL", 1.45, 0.775, 0.355, front_wheels, steer, +1, 187.0),
        ("FR", 1.45, -0.775, 0.355, front_wheels, steer, -1, -6.0),
        ("RL", -1.45, 0.700, 0.365, rear_wheels, 0.0, +1, 187.0),
        ("RR", -1.45, -0.700, 0.365, rear_wheels, 0.0, -1, -6.0),
    ]
    for tag, x, y, z, parts, st, sgn, cal_angle in specs:
        rot_z = radians(180.0) if sgn < 0 else 0.0
        empty = bpy.data.objects.new("Axle_" + tag, None)
        empty.empty_display_size = 0.2
        empty.location = (x, y, z)
        empty.rotation_euler = Euler((0.0, 0.0, rot_z + st))
        (collection or bpy.context.scene.collection).objects.link(empty)
        width = 0.300 if x > 0 else 0.340
        half = width * 0.5
        face_y = half * 0.625
        clones = []
        base = parts["base"] if isinstance(parts, dict) else parts
        variants = parts["variants"] if isinstance(parts, dict) else []
        for src in list(base) + list(variants):
            ob = bpy.data.objects.new(src.name + "_" + tag, src.data)
            collection.objects.link(ob)
            ob.parent = empty
            clones.append(ob)
            if src in variants:
                ob.hide_render = True
        disc, hat = build_disc("Disc_" + tag, collection)
        disc.location = (0.0, face_y - 0.075, 0.0)
        hat.location = (0.0, face_y - 0.075 + 0.012, 0.0)
        cal = build_caliper("Caliper_" + tag, cal_angle, face_y - 0.070, collection)
        vl.apply_modifiers(cal)
        for ch in (disc, hat, cal):
            ch.parent = empty
        corners.append(empty)
    for pair in (front_wheels, rear_wheels):
        srcs = pair["base"] + pair["variants"] if isinstance(pair, dict) else pair
        for src in list(srcs):
            bpy.data.objects.remove(src, do_unlink=True)
    bpy.context.view_layer.update()
    return corners


def build(collection, mats):
    global MATS
    MATS = mats
    fw = build_wheel_pair("WheelF", 0.355, 0.300, 10, collection)
    rw = build_wheel_pair("WheelR", 0.365, 0.340, 10, collection)
    corners = place_corners(collection, fw, rw)
    return {"front": fw, "rear": rw, "corners": corners}
