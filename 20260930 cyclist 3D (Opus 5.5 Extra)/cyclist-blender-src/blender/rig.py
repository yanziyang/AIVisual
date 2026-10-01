"""Armature for rider + bike, IK pedalling rig, and three baked loops: Seated, Standing, Coast.

Control layer (kept in the .blend):
  Crank (keyed rotation) -> Pedal.L/R (keyed ankling) -> FootIK.L/R  -> IK on Shin, Copy Rotation on Foot
  Bike  -> HandIK.L/R on the hoods                                    -> IK on Forearm, Copy Rotation on Hand
  Hips / Spine / Chest / Neck / Head keyed procedurally (rocking, breathing, head stabilisation).
Each loop is baked with visual keying into a plain FK action, which is what the glTF carries.
Clip time 0 = right crank at 12 o'clock; Seated/Standing = 2 crank revolutions in 120 frames.
"""
import bpy
import math
from mathutils import Vector, Matrix, Quaternion
from bpy_extras import anim_utils
from util import *
import geom as G
import bike as BK
import rider as RD

FPS = 60
REV_FRAMES = 60           # one crank revolution at the clip's native 60 rpm
SIDES = RD.SIDES
Y = Vector((0, 1, 0))
d2r = math.radians


def make_armature(S):
    arm = bpy.data.armatures.new("CyclistRig")
    arm.display_type = 'STICK'
    ob = bpy.data.objects.new("CyclistRig", arm)
    collection("Rig").objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.edit_bones
    j = S.j

    def add(name, head, tail, parent=None, deform=True, roll_up=None):
        b = eb.new(name)
        b.head = Vector(head)
        b.tail = Vector(tail)
        if roll_up is not None:
            b.align_roll(roll_up)
        if parent:
            b.parent = eb[parent]
        b.use_deform = deform
        return b

    add("Root", (0, 0, 0), (0, 0, 0.25), roll_up=Vector((0, 1, 0)))
    add("Bike", (0, 0, 0), (0.30, 0, 0), "Root", roll_up=Vector((0, 0, 1)))
    add("Crank", G.BB, G.BB + Vector((0, -0.08, 0)), "Bike", roll_up=Vector((0, 0, 1)))
    for s, n in SIDES:
        sp = G.pedal_pos(G.REST_PHI, s)
        a0 = G.foot_angle(G.REST_PHI, s)
        add("Pedal." + n, sp, sp + G.rot_y(a0) @ Vector((0.06, 0, 0)), "Crank", roll_up=Vector((0, 0, 1)))
    for (name, h, t, parent) in S.bones():
        up = Vector((0, 0, 1)) if any(k in name for k in ("Arm", "Hand", "Shoulder")) else Vector((0, 1, 0))
        if name.startswith(("Thigh", "Shin", "Foot")):
            up = Vector((0, 1, 0))
        add(name, h, t, parent, roll_up=up)
    for s, n in SIDES:
        # IK targets: duplicates of the end bones, owned by the bike side
        fb = eb["Foot." + n]
        add("FootIK." + n, fb.head, fb.tail, "Pedal." + n, deform=False, roll_up=Vector((0, 1, 0)))
        eb["FootIK." + n].roll = fb.roll
        hb = eb["Hand." + n]
        add("HandIK." + n, hb.head, hb.tail, "Bike", deform=False)
        eb["HandIK." + n].roll = hb.roll
        kn = j["knee." + n]
        add("KneePole." + n, kn + Vector((0.45, s * 0.06, 0.12)), kn + Vector((0.45, s * 0.06, 0.20)), "Hips", deform=False)
        el = j["elbow." + n]
        add("ElbowPole." + n, el + Vector((-0.15, s * 0.35, -0.30)), el + Vector((-0.15, s * 0.35, -0.22)), "Chest", deform=False)
    bpy.ops.object.mode_set(mode='POSE')
    for pb in ob.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob


def add_constraints(ob):
    for s, n in SIDES:
        c = ob.pose.bones["Shin." + n].constraints.new('IK')
        c.target, c.subtarget = ob, "FootIK." + n
        c.pole_target, c.pole_subtarget = ob, "KneePole." + n
        c.chain_count = 2
        c.use_stretch = False
        c = ob.pose.bones["Foot." + n].constraints.new('COPY_ROTATION')
        c.target, c.subtarget = ob, "FootIK." + n
        c = ob.pose.bones["Forearm." + n].constraints.new('IK')
        c.target, c.subtarget = ob, "HandIK." + n
        c.pole_target, c.pole_subtarget = ob, "ElbowPole." + n
        c.chain_count = 2
        c.use_stretch = False
        c = ob.pose.bones["Hand." + n].constraints.new('COPY_ROTATION')
        c.target, c.subtarget = ob, "HandIK." + n
    for pb in ob.pose.bones:
        pb.ik_stretch = 0.0
    tune_pole_angles(ob)


def tune_pole_angles(ob):
    """Pick each IK pole angle so the rest pose is reproduced exactly."""
    vl = bpy.context.view_layer
    for chain in ("Shin", "Forearm"):
        for s, n in SIDES:
            pb = ob.pose.bones[chain + "." + n]
            parent = pb.parent
            rest_mid = (ob.data.bones[chain + "." + n].head_local).copy()
            c = [c for c in pb.constraints if c.type == 'IK'][0]
            best = None
            for step in (10, 1, 0.1):
                centre = 0 if best is None else best[1]
                span = 180 if best is None else step * 10
                a = centre - span
                while a <= centre + span:
                    c.pole_angle = d2r(a)
                    vl.update()
                    err = (ob.pose.bones[chain + "." + n].head - rest_mid).length
                    if best is None or err < best[0]:
                        best = (err, a)
                    a += step
            c.pole_angle = d2r(best[1])
            vl.update()
            print("   pole %s.%s %.1f deg, rest error %.5f m" % (chain, n, best[1], best[0]))


# ------------------------------------------------------------------ parenting

def parent_parts(ob, S):
    vl = bpy.context.view_layer
    vl.update()
    body = bpy.data.objects["Body"]
    body.parent = ob
    body.parent_type = 'OBJECT'
    mod = body.modifiers.new("Armature", 'ARMATURE')
    mod.object = ob
    crank = bpy.data.objects["Crankset"]
    crank.rotation_euler = (0, G.REST_PHI, 0)
    for s, n in SIDES:
        p = bpy.data.objects["Pedal_" + n]
        p.rotation_euler = (0, G.foot_angle(G.REST_PHI, s), 0)
    vl.update()
    rules = {"Crankset": "Crank", "Pedal_L": "Pedal.L", "Pedal_R": "Pedal.R",
             "Shoe.L": "Foot.L", "Shoe.R": "Foot.R",
             "Helmet": "Head", "HelmetStraps": "Head", "Glasses": "Head", "GlassesFrame": "Head"}
    for o in list(bpy.data.objects):
        if o.type not in ('MESH', 'EMPTY') or o is body or o.parent is not None:
            continue
        if o.name in rules:
            parent_to_bone(o, ob, rules[o.name])
        elif o.users_collection and o.users_collection[0].name in ("Bike", "WebOnly"):
            if o.name.startswith("ChainLink"):
                continue
            parent_to_bone(o, ob, "Bike")


# ------------------------------------------------------------------ keying helpers

def rest_mat(ob, name):
    return ob.data.bones[name].matrix_local.copy()


def pivot(p, R3):
    return Matrix.Translation(p) @ R3.to_4x4() @ Matrix.Translation(-p)


def world_axis_rot(ob, name, axis, angle):
    """Local quaternion that rotates the bone about a world axis (relative to its rest)."""
    R = ob.data.bones[name].matrix_local.to_3x3()
    q = Quaternion(axis, angle)
    return (R.inverted() @ q.to_matrix() @ R).to_quaternion()


class Keyer:
    def __init__(self, ob):
        self.ob = ob
        self.vl = bpy.context.view_layer

    def set_matrix(self, name, M):
        pb = self.ob.pose.bones[name]
        pb.matrix = M
        self.vl.update()

    def key(self, names, frame, loc=True):
        for nme in names:
            pb = self.ob.pose.bones[nme]
            pb.keyframe_insert("rotation_quaternion", frame=frame, group=nme)
            if loc:
                pb.keyframe_insert("location", frame=frame, group=nme)


def reset_pose(ob):
    for pb in ob.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.scale = (1, 1, 1)


def ankling(phi, side, style):
    a = G.foot_angle(phi, side)
    if style == "standing":
        ph = phi if side < 0 else phi + math.pi
        a += d2r(9) * (0.5 - 0.5 * math.cos(ph - d2r(150)))       # extra toe-down through the bottom
    return a


def control_action(ob, name, style, frames):
    """Key the control layer for one loop. Returns the action."""
    ob.animation_data_create()
    act = bpy.data.actions.new(name + "_ctrl")
    act.use_fake_user = True
    ob.animation_data.action = act
    K = Keyer(ob)
    j = RD.Skel().j
    M_crank = rest_mat(ob, "Crank")
    M_ped = {n: rest_mat(ob, "Pedal." + n) for s, n in SIDES}
    M_hips = rest_mat(ob, "Hips")
    M_bike = rest_mat(ob, "Bike")
    a0 = {n: G.foot_angle(G.REST_PHI, s) for s, n in SIDES}
    sp0 = {n: G.pedal_pos(G.REST_PHI, s) for s, n in SIDES}
    for f in range(frames + 1):
        tt = f / frames                         # 0..1 over the clip
        bpy.context.scene.frame_set(f)
        reset_pose(ob)
        if style == "coast":
            phi = G.REST_PHI
        else:
            phi = TAU * f / REV_FRAMES          # 2 revolutions over 120 frames
        # ---- bike roll (standing: rocks away from the pushing leg)
        roll = -d2r(6.5) * math.sin(phi) if style == "standing" else 0.0
        Mb = pivot(Vector((0, 0, 0)), Matrix.Rotation(roll, 3, 'X')) @ M_bike
        K.set_matrix("Bike", Mb)
        # ---- crank and pedals (in the rolled bike frame)
        K.set_matrix("Crank", Mb @ M_bike.inverted() @ pivot(G.BB, Matrix.Rotation(phi - G.REST_PHI, 3, 'Y')) @ M_crank)
        for s, n in SIDES:
            sp = G.pedal_pos(phi, s)
            a = ankling(phi, s, style)
            M = Matrix.Translation(sp) @ Matrix.Rotation(a - a0[n], 4, 'Y') @ Matrix.Translation(-sp0[n]) @ M_ped[n]
            K.set_matrix("Pedal." + n, Mb @ M_bike.inverted() @ M)
        # ---- hips
        breath = math.sin(TAU * tt)               # one breath per clip
        if style == "seated":
            hroll = d2r(1.6) * math.sin(phi - d2r(90))
            hyaw = d2r(1.2) * math.sin(phi)
            dpos = Vector((0.003 * math.cos(2 * phi), 0.0, 0.002 * math.cos(2 * phi)))
            pitch = d2r(0.6) * breath
        elif style == "standing":
            hroll = d2r(2.5) * math.sin(phi - d2r(90))
            hyaw = d2r(3.0) * math.sin(phi)
            dpos = Vector((0.205 + 0.008 * math.cos(2 * phi), -0.018 * math.sin(phi), 0.045 + 0.010 * math.cos(2 * phi)))
            pitch = d2r(-1.0)
        else:
            hroll, hyaw = 0.0, 0.0
            dpos = Vector((-0.006, 0, -0.002 + 0.002 * breath))
            pitch = d2r(-2.5) + d2r(0.8) * breath
        R = Matrix.Rotation(hyaw, 3, 'Z') @ Matrix.Rotation(hroll, 3, 'X') @ Matrix.Rotation(pitch, 3, 'Y')
        K.set_matrix("Hips", Matrix.Translation(dpos) @ pivot(G.HIP_C, R) @ M_hips)
        # ---- spine / chest / neck / head (FK, about world axes)
        ob.pose.bones["Spine"].rotation_quaternion = world_axis_rot(ob, "Spine", Vector((1, 0, 0)), -hroll * 0.45) @ \
            world_axis_rot(ob, "Spine", Vector((0, 0, 1)), -hyaw * 0.4)
        chest_roll = -hroll * 0.35 + (roll * 0.35 if style == "standing" else 0.0)
        ob.pose.bones["Chest"].rotation_quaternion = world_axis_rot(ob, "Chest", Vector((1, 0, 0)), chest_roll) @ \
            world_axis_rot(ob, "Chest", Vector((0, 1, 0)), d2r(-0.8) * breath)
        look = 0.0
        if style == "coast":
            look = d2r(14) * math.sin(TAU * tt) * smoothstep(0.0, 0.25, abs(math.sin(TAU * tt)))
        ob.pose.bones["Neck"].rotation_quaternion = world_axis_rot(ob, "Neck", Vector((0, 0, 1)), look * 0.4)
        head_roll = -(hroll * 0.2 + chest_roll * 0.8 + roll * 0.0)
        ob.pose.bones["Head"].rotation_quaternion = world_axis_rot(ob, "Head", Vector((1, 0, 0)), head_roll) @ \
            world_axis_rot(ob, "Head", Vector((0, 0, 1)), look * 0.6 - hyaw * 0.5) @ \
            world_axis_rot(ob, "Head", Vector((0, 1, 0)), d2r(0.6) * math.sin(2 * phi))
        K.vl.update()
        K.key(["Bike", "Crank", "Pedal.L", "Pedal.R", "Hips"], f)
        K.key(["Spine", "Chest", "Neck", "Head"], f, loc=False)
    for fc in act.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
    return act


def bake(ob, ctrl, name, frames):
    ob.animation_data.action = ctrl
    bpy.context.scene.frame_set(0)
    baked = anim_utils.bake_action(
        ob, action=None, frames=range(0, frames + 1),
        only_selected=False, do_pose=True, do_object=False, do_visual_keying=True,
        do_constraint_clear=False, do_parents_clear=False, do_clean=False)
    baked.name = name
    baked.use_fake_user = True
    # drop control-only bones from the baked loop
    for fc in list(baked.fcurves):
        if any(k in fc.data_path for k in ('"FootIK', '"HandIK', '"KneePole', '"ElbowPole')):
            baked.fcurves.remove(fc)
    for fc in baked.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
    ob.animation_data.action = None
    return baked


def build():
    sc = bpy.context.scene
    sc.render.fps = FPS
    S = RD.Skel()
    ob = make_armature(S)
    parent_parts(ob, S)
    add_constraints(ob)
    clips = [("Seated", "seated", 2 * REV_FRAMES), ("Standing", "standing", 2 * REV_FRAMES),
             ("Coast", "coast", 4 * REV_FRAMES)]
    baked = []
    for name, style, frames in clips:
        ctrl = control_action(ob, name, style, frames)
        baked.append((bake(ob, ctrl, name, frames), frames))
        print("   baked", name, frames, "frames")
    # NLA: one muted track per baked loop so the glTF exporter picks each one up
    ob.animation_data.action = None
    for act, frames in baked:
        tr = ob.animation_data.nla_tracks.new()
        tr.name = act.name
        st = tr.strips.new(act.name, 0, act)
        tr.mute = True
    ob.animation_data.action = baked[0][0]
    sc.frame_start, sc.frame_end = 0, 2 * REV_FRAMES
    ob["clip_info"] = "t=0: right crank at 12 o'clock; Seated/Standing: 2 crank revolutions per 2 s at 60 rpm; Coast: 4 s, cranks level"
    reset_pose(ob)
    return ob
