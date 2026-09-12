"""VELARIS interior: seats, dash, steering, console - visible through the glass."""

import bpy
import velaris_lib as vl
import velaris_body as vb
from math import radians
from mathutils import Matrix, Vector

MATS = {}


def seat(collection, tag, x, y):
    out = []
    base = vl.box_mesh("SeatBase_" + tag, (0.52, 0.46, 0.11), (x, y, 0.50), collection=collection)
    out.append((base, "leather"))
    for sgn in (1, -1):
        bol = vl.box_mesh("SeatBolster_%s_%d" % (tag, sgn), (0.52, 0.09, 0.16),
                          (x, y + 0.185 * sgn, 0.51), collection=collection)
        out.append((bol, "suede"))
    back = vl.box_mesh("SeatBack_" + tag, (0.10, 0.46, 0.66), (x - 0.31, y, 0.79),
                       (0.0, radians(-16), 0.0), collection)
    out.append((back, "leather"))
    for sgn in (1, -1):
        bol = vl.box_mesh("SeatBackBolster_%s_%d" % (tag, sgn), (0.11, 0.08, 0.60),
                          (x - 0.29, y + 0.185 * sgn, 0.80), (0.0, radians(-16), 0.0), collection)
        out.append((bol, "suede"))
    head = vl.box_mesh("Headrest_" + tag, (0.10, 0.22, 0.15), (x - 0.40, y, 1.03),
                       (0.0, radians(-16), 0.0), collection)
    out.append((head, "leather"))
    return out


def build_steering(collection):
    out = []
    center = Vector((0.40, 0.355, 0.90))
    axis = Vector((0.906, 0.0, 0.423))
    M = Matrix.Translation(center) @ axis.to_track_quat("Z", "Y").to_matrix().to_4x4()

    bpy.ops.mesh.primitive_torus_add(major_radius=0.165, minor_radius=0.021,
                                     major_segments=40, minor_segments=12,
                                     location=(0, 0, 0))
    rim = bpy.context.active_object
    rim.name = "SteeringRim"
    rim.matrix_world = M
    vl.assign_material(rim, MATS["leather"], 0)
    vl.shade_smooth(rim, 60)
    out.append(rim)

    hub = vl.cylinder_mesh("SteeringHub", 0.048, 0.035, 24, ax="Z", collection=collection)
    hub.matrix_world = M
    vl.assign_material(hub, MATS["dark_trim"], 0)
    vl.shade_smooth(hub, 60)
    out.append(hub)

    for i, ang in enumerate((90.0, 210.0, 330.0)):
        sp = vl.box_mesh("SteerSpoke_%d" % i, (0.024, 0.125, 0.018), (0, 0, 0),
                         collection=collection)
        local = Matrix.Rotation(radians(ang), 4, "Z") @ Matrix.Translation((0, 0.082, 0.0))
        sp.matrix_world = M @ local
        vl.assign_material(sp, MATS["dark_chrome"], 0)
        vl.add_bevel(sp, 0.004, 2, angle=30)
        vl.apply_modifiers(sp)
        out.append(sp)

    col = vl.cylinder_mesh("SteerColumn", 0.045, 0.32, 24, ax="Z", collection=collection)
    col.matrix_world = M @ Matrix.Translation((0, 0, -0.18))
    vl.assign_material(col, MATS["dark_trim"], 0)
    vl.shade_smooth(col, 60)
    out.append(col)
    return out


def build(collection, mats):
    global MATS
    MATS = mats
    parts = []
    floor = vl.box_mesh("InteriorFloor", (2.30, 1.56, 0.05), (-0.10, 0.0, 0.42), collection=collection)
    parts.append((floor, "dark_trim"))
    bulk = vl.box_mesh("RearBulkhead", (0.10, 1.30, 0.54), (-0.80, 0.0, 0.68), collection=collection)
    parts.append((bulk, "suede"))
    for tag, y in (("L", 0.355), ("R", -0.355)):
        parts += seat(collection, tag, -0.02, y)
    dash = vl.box_mesh("Dashboard", (0.52, 1.52, 0.22), (0.64, 0.0, 0.83),
                       (0.0, radians(-12), 0.0), collection=collection)
    parts.append((dash, "leather"))
    screen = vl.box_mesh("DashScreen", (0.20, 0.44, 0.15), (0.53, 0.0, 0.90),
                         (0.0, radians(-14), 0.0), collection=collection)
    parts.append((screen, "screen"))
    console = vl.box_mesh("CenterConsole", (0.72, 0.30, 0.20), (0.16, 0.0, 0.585), collection=collection)
    parts.append((console, "leather"))
    arm = vl.box_mesh("ArmRest", (0.34, 0.24, 0.07), (0.02, 0.0, 0.70), collection=collection)
    parts.append((arm, "suede"))
    out = []
    for ob, key in parts:
        vl.assign_material(ob, MATS[key], 0)
        vl.add_subsurf(ob, 2)
        vl.apply_modifiers(ob)
        vl.shade_smooth(ob, 40)
        out.append(ob)
    head = vb.make_ribbon("Headliner", [(-0.72, 0.5), (-0.3, 0.5), (0.1, 0.5), (0.5, 0.5),
                                        (0.78, 0.5)], 1.30, -0.075, collection)
    vl.assign_material(head, MATS["suede"], 0)
    out.append(head)
    fire = vl.box_mesh("Firewall", (0.06, 1.52, 0.42), (1.18, 0.0, 0.62), collection=collection)
    parts2 = [(fire, "suede")]
    for tag, y in (("L", 0.33), ("R", -0.33)):
        mat = vl.box_mesh("Footwell_" + tag, (0.50, 0.36, 0.025), (1.02, y, 0.455),
                          collection=collection)
        parts2.append((mat, "suede"))
    for tag, y, w, h in (("Brake", 0.33, 0.085, 0.115), ("Throttle", 0.47, 0.075, 0.135),
                         ("Dead", 0.135, 0.060, 0.130)):
        ped = vl.box_mesh("Pedal_" + tag, (0.020, w, h), (0.98 - 0.03 * (tag == "Brake"),
                                                          y, 0.545 + (0.02 if tag == "Throttle" else 0.0)),
                          (0.0, radians(20), 0.0), collection=collection)
        pad = vl.box_mesh("PedalPad_" + tag, (0.008, w * 0.86, h * 0.80),
                          (0.955, y, 0.552), (0.0, radians(20), 0.0), collection=collection)
        parts2.append((ped, "dark_chrome"))
        parts2.append((pad, "rubber"))
    for ob, key in parts2:
        vl.assign_material(ob, MATS[key], 0)
        vl.add_bevel(ob, 0.004, 2, angle=40)
        vl.apply_modifiers(ob)
        vl.shade_smooth(ob, 40)
        out.append(ob)
    out += build_steering(collection)
    return out
