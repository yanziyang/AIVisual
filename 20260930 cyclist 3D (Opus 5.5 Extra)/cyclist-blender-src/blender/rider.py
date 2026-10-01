"""Rider: one metaball body (skin + kit as material regions), cycling shoes, helmet, glasses.

The rider is modelled directly in the riding pose (hands on the hoods, right crank at 3 o'clock).
Every metaball element carries a bone tag; skin weights come from each element's share of the
field at the vertex, so the weights follow the same volumes that made the surface.
"""
import bpy
import bmesh
import math
import numpy as np
from mathutils import Vector, Matrix, Quaternion
from util import *
import geom as G
import bike as BK

COL = "Rider"
Y = Vector((0, 1, 0))
SIDES = ((1, "L"), (-1, "R"))

KIT = dict(
    skin=hexcol("#c58a66"),
    jersey=hexcol("#eef0f2"),
    jersey_accent=hexcol("#e8552d"),
    jersey_dark=hexcol("#16314f"),
    bib=hexcol("#131417"),
    bib_band=hexcol("#2a2c31"),
    sock=hexcol("#f3f3f1"),
    sock_band=hexcol("#e8552d"),
    glove=hexcol("#17181b"),
    hair=hexcol("#3a2a20"),
    helmet=hexcol("#f4f5f6"),
    helmet_accent=hexcol("#16314f"),
    shoe=hexcol("#f2f2f0"),
    lens=hexcol("#e0682f"),
)


# ============================================================== skeleton (riding pose)

class Skel:
    """Joint positions for the modelling pose; shared with rig.py."""

    def __init__(self):
        self.u = (G.SHOULDER_C - G.HIP_C).normalized()
        self.b = self.u.cross(Y)                 # dorsal (towards the back)
        j = {}
        j["hip_c"] = G.HIP_C.copy()
        j["S0"] = self.T(0.035, 0.050)
        j["S1"] = self.T(0.165, 0.080)
        j["S2"] = self.T(0.300, 0.088)
        j["C7"] = self.T(0.525, 0.068)
        neck_dir = Vector((math.cos(math.radians(36)), 0, math.sin(math.radians(36))))
        j["skull"] = j["C7"] + neck_dir * 0.098
        gaze = math.radians(9)                   # looking slightly down the road
        self.hf = Vector((math.cos(gaze), 0, -math.sin(gaze)))
        self.hu = Vector((math.sin(gaze), 0, math.cos(gaze)))
        j["head"] = j["skull"] + self.hu * 0.046 + self.hf * 0.022     # head centre
        j["head_top"] = j["head"] + self.hu * 0.13
        for s, n in SIDES:
            j["hip." + n] = G.hip_pos(s)
            h, k, a = G.leg_chain(G.REST_PHI, s)
            j["knee." + n] = k
            j["ankle." + n] = a
            al = G.foot_angle(G.REST_PHI, s)
            self.__dict__["foot_rot." + n] = G.rot_y(al)
            j["toe." + n] = a + G.rot_y(al) @ Vector((0.140, 0, -0.062))
            j["spindle." + n] = G.pedal_pos(G.REST_PHI, s)
            j["shoulder." + n] = G.SHOULDER_C + Y * (s * G.SHOULDER_HALF)
            j["clav." + n] = self.T(0.50, 0.035, s * 0.028)
            grip = BK.hood_grip(s)
            j["grip." + n] = grip
            wrist = grip + Vector((-0.055, s * 0.006, 0.048))
            j["wrist." + n] = wrist
            j["elbow." + n] = G.two_bone_ik(j["shoulder." + n], wrist, G.L_UPPERARM, G.L_FOREARM,
                                            Vector((-0.25, s * 0.75, -0.6)))
            hand_dir = (grip + Vector((0.012, 0, 0.034)) - wrist).normalized()
            j["hand_dir." + n] = hand_dir
            j["knuckle." + n] = wrist + hand_dir * 0.090
        self.j = j

    def T(self, u, b, y=0.0):
        return G.HIP_C + self.u * u + self.b * b + Y * y

    def foot_rot(self, n):
        return self.__dict__["foot_rot." + n]

    def head_xf(self, p):
        """Head-frame point (x fwd, y left, z up) -> world."""
        return self.j["head"] + self.hf * p[0] + Y * p[1] + self.hu * p[2]

    def bones(self):
        """(name, head, tail, parent, deform)"""
        j = self.j
        out = [("Hips", j["S0"], j["S1"], "Root"),
               ("Spine", j["S1"], j["S2"], "Hips"),
               ("Chest", j["S2"], j["C7"], "Spine"),
               ("Neck", j["C7"], j["skull"], "Chest"),
               ("Head", j["skull"], j["head_top"], "Neck")]
        for s, n in SIDES:
            out += [("Shoulder." + n, j["clav." + n], j["shoulder." + n], "Chest"),
                    ("UpperArm." + n, j["shoulder." + n], j["elbow." + n], "Shoulder." + n),
                    ("Forearm." + n, j["elbow." + n], j["wrist." + n], "UpperArm." + n),
                    ("Hand." + n, j["wrist." + n], j["knuckle." + n], "Forearm." + n),
                    ("Thigh." + n, j["hip." + n], j["knee." + n], "Hips"),
                    ("Shin." + n, j["knee." + n], j["ankle." + n], "Thigh." + n),
                    ("Foot." + n, j["ankle." + n], j["toe." + n], "Shin." + n)]
        return out


# ============================================================== body metaballs

def seg_frame(a, b, up):
    T = (b - a).normalized()
    N = (up - T * up.dot(T)).normalized()
    B = T.cross(N)
    return T, N, B


def quat_from_axes(T, N, B):
    return Matrix((T, N, B)).transposed().to_quaternion()


def build_body_meta(S):
    j = S.j
    mb = Meta("RiderMB", resolution=0.0030, col=COL)
    u, b = S.u, S.b

    # ---------------------------------------------------------------- trunk
    # stacked cross-sections along u: (u, b-centre, half-width, half-depth, tag)
    secs = [(-0.02, 0.020, 0.134, 0.092, "Hips"),
            (0.07, 0.030, 0.134, 0.094, "Hips"),
            (0.17, 0.036, 0.134, 0.092, "Spine"),
            (0.27, 0.032, 0.138, 0.100, "Spine"),
            (0.36, 0.026, 0.146, 0.106, "Chest"),
            (0.44, 0.024, 0.150, 0.100, "Chest"),
            (0.505, 0.032, 0.120, 0.078, "Chest")]
    pts = [S.T(s[0], s[1]) for s in secs]
    rho = [min(s[2], s[3]) for s in secs]
    aspect = [(s[2] / r, s[3] / r) for s, r in zip(secs, rho)]
    mb.tube(pts, rho, stiff=3.0, up=Y, aspect=aspect, tags=[s[4] for s in secs], k=0.22)
    # pecs, lats, traps, belly, lower back muscles
    rotT = quat_from_axes(u, Y, u.cross(Y))
    for s, n in SIDES:
        mb.ellipsoid(S.T(0.36, 0.050, s * 0.088), (0.13, 0.052, 0.042), rotT, stiff=3, tag="Chest")
        mb.ellipsoid(S.T(0.15, 0.085, s * 0.040), (0.10, 0.030, 0.028), rotT, stiff=3, tag="Spine")
        # glutes, resting on the saddle
        mb.ellipsoid(S.T(-0.004, 0.062, s * 0.066), (0.072, 0.060, 0.050), rotT, stiff=3, tag="Hips")
    mb.ellipsoid(S.T(0.505, 0.075, 0), (0.050, 0.120, 0.040), rotT, stiff=3, tag="Chest")   # trapezius
    mb.ellipsoid(S.T(0.20, -0.050, 0), (0.12, 0.10, 0.026), rotT, stiff=3, tag="Spine")     # belly wall

    # ---------------------------------------------------------------- neck + head
    neck_pts = [j["C7"] + S.b * -0.010 + S.u * -0.01, j["skull"] + S.hf * 0.005, j["head"] + S.hu * -0.02]
    mb.tube(neck_pts, [0.058, 0.053, 0.049], stiff=3.0, up=Y, aspect=[(1.15, 1.0), (1.05, 1.0), (1.0, 1.0)],
            tags=["Neck", "Neck", "Head"], k=0.22)
    H = S.head_xf
    hrot = quat_from_axes(S.hf, Y, S.hu)
    E = lambda p, ax, st=3.0, neg=False: mb.ellipsoid(H(p), ax, hrot, stiff=st, tag="Head", neg=neg)
    E((-0.008, 0, 0.028), (0.096, 0.073, 0.094))          # cranium
    E((0.040, 0, -0.022), (0.060, 0.062, 0.062))          # mid face
    E((0.050, 0, -0.068), (0.048, 0.048, 0.030))          # jaw
    E((0.088, 0, -0.088), (0.022, 0.026, 0.020), 4)       # chin
    for s in (1, -1):
        E((0.022, s * 0.046, -0.072), (0.040, 0.016, 0.026))           # jaw angle
        E((0.064, s * 0.046, -0.006), (0.020, 0.018, 0.016), 4)        # cheekbone
        E((-0.012, s * 0.074, 0.000), (0.026, 0.008, 0.032), 5)        # ear
        E((-0.006, s * 0.080, 0.002), (0.015, 0.006, 0.020), 5, True)  # ear bowl
        E((0.092, s * 0.032, 0.012), (0.012, 0.016, 0.012), 4, True)   # eye socket
        E((0.106, s * 0.011, -0.037), (0.009, 0.0075, 0.0075), 5)        # nostril wing
    E((0.094, 0, 0.032), (0.012, 0.060, 0.011), 4)        # brow ridge
    mb.tube([H((0.098, 0, 0.010)), H((0.108, 0, -0.012)), H((0.117, 0, -0.031))], [0.0080, 0.0095, 0.0105],
            stiff=4.0, up=S.hu, tag="Head", k=0.25)                                   # nose
    E((0.101, 0, -0.054), (0.008, 0.023, 0.0065), 5)       # upper lip
    E((0.098, 0, -0.0655), (0.008, 0.020, 0.0070), 5)       # lower lip
    E((0.108, 0, -0.0600), (0.006, 0.021, 0.0015), 6, True)   # mouth line

    # ---------------------------------------------------------------- arms + gloved hands
    for s, n in SIDES:
        sh, el, wr = j["shoulder." + n], j["elbow." + n], j["wrist." + n]
        up = Vector((0, 0, 1))
        mb.tube([sh + Y * (-s * 0.012), sh.lerp(el, 0.45), el], [0.039, 0.036, 0.033], stiff=3.0, up=up,
                tags=["UpperArm." + n] * 3, k=0.22)
        T, N, B = seg_frame(sh, el, Vector((0, 0, 1)))
        q = quat_from_axes(T, N, B)
        # deltoid cap, biceps (front/below), triceps (back/above)
        mb.ellipsoid(sh + T * 0.045 + N * 0.006, (0.060, 0.034, 0.032), q, stiff=3, tag="UpperArm." + n)
        mb.ellipsoid(sh.lerp(el, 0.55) - N * 0.016, (0.090, 0.028, 0.030), q, stiff=3, tag="UpperArm." + n)
        mb.ellipsoid(sh.lerp(el, 0.45) + N * 0.018, (0.105, 0.030, 0.032), q, stiff=3, tag="UpperArm." + n)
        mb.ball(el, 0.034, stiff=3, tag="Forearm." + n)
        T2, N2, B2 = seg_frame(el, wr, Vector((0, 0, 1)))
        mb.tube([el, el.lerp(wr, 0.35), wr], [0.041, 0.037, 0.026], stiff=3.0, up=Vector((0, 0, 1)),
                aspect=[(1.0, 1.0), (0.95, 1.12), (0.72, 1.25)], tags=["Forearm." + n] * 3, k=0.22)
        q2 = quat_from_axes(T2, N2, B2)
        mb.ellipsoid(el.lerp(wr, 0.25) + N2 * 0.008, (0.075, 0.032, 0.036), q2, stiff=3, tag="Forearm." + n)
        build_hand(mb, S, s, n)

    # ---------------------------------------------------------------- legs
    for s, n in SIDES:
        hp, kn, an, toe = j["hip." + n], j["knee." + n], j["ankle." + n], j["toe." + n]
        T, N, B = seg_frame(hp, kn, Vector((1, 0, 0.3)))     # N ~ front of thigh
        q = quat_from_axes(T, N, B)
        thigh_axis = [hp + Y * (-s * 0.018), hp.lerp(kn, 0.45) + Y * (-s * 0.008), kn]
        mb.tube(thigh_axis, [0.074, 0.067, 0.048], stiff=3.0, up=Vector((0, 0, 1)),
                tags=["Thigh." + n] * 3, k=0.22)
        mb.ellipsoid(hp.lerp(kn, 0.42) + N * 0.030 + Y * (s * 0.012), (0.17, 0.046, 0.048), q, stiff=3, tag="Thigh." + n)  # rectus / vastus lat
        mb.ellipsoid(hp.lerp(kn, 0.80) + N * 0.016 - Y * (s * 0.030), (0.070, 0.030, 0.026), q, stiff=3, tag="Thigh." + n)  # vastus medialis
        mb.ellipsoid(hp.lerp(kn, 0.48) - N * 0.032, (0.17, 0.045, 0.040), q, stiff=3, tag="Thigh." + n)   # hamstrings
        mb.ball(kn + N * 0.036, 0.020, stiff=4, tag="Shin." + n)                   # patella
        mb.ball(kn, 0.040, stiff=3, tag="Thigh." + n)
        T2, N2, B2 = seg_frame(kn, an, Vector((1, 0, 0)))    # N2 ~ shin front
        q2 = quat_from_axes(T2, N2, B2)
        mb.tube([kn, kn.lerp(an, 0.35), an + T2 * 0.01], [0.042, 0.037, 0.0255], stiff=3.0, up=Vector((1, 0, 0)),
                tags=["Shin." + n] * 3, k=0.22)
        mb.ellipsoid(kn.lerp(an, 0.30) - N2 * 0.030 - Y * (s * 0.008), (0.115, 0.040, 0.036), q2, stiff=3, tag="Shin." + n)  # gastrocnemius
        mb.ellipsoid(kn.lerp(an, 0.32) - N2 * 0.026 + Y * (s * 0.010), (0.085, 0.030, 0.030), q2, stiff=3, tag="Shin." + n)
        mb.ellipsoid(kn.lerp(an, 0.25) + N2 * 0.012 + Y * (s * 0.014), (0.11, 0.018, 0.020), q2, stiff=3, tag="Shin." + n)  # tibialis
        # foot (inside the shoe, keeps the ankle closed)
        fr = S.foot_rot(n)
        mb.tube([an, an + fr @ Vector((0.06, 0, -0.045)), an + fr @ Vector((0.15, 0, -0.055))],
                [0.030, 0.032, 0.028], stiff=3.0, up=Vector((0, 0, 1)), aspect=[(1, 1), (1.2, 0.8), (1.35, 0.6)],
                tags=["Foot." + n] * 3, k=0.25)
    return mb


def build_hand(mb, S, s, n):
    """Gloved hand gripping the hood: palm on top, fingers wrapped down the outside,
    thumb along the inside."""
    j = S.j
    wr, grip, hd = j["wrist." + n], j["grip." + n], j["hand_dir." + n]
    side_v = Y * s                                     # outward (lateral)
    up = (Vector((0, 0, 1)) - hd * hd.z).normalized()
    tag = "Hand." + n
    q = quat_from_axes(hd, side_v, hd.cross(side_v))
    palm_c = wr + hd * 0.050 + up * -0.004
    mb.ellipsoid(palm_c, (0.048, 0.040, 0.015), q, stiff=3, tag=tag)
    mb.ellipsoid(wr + hd * 0.012, (0.024, 0.030, 0.016), q, stiff=3, tag=tag)
    hood_c = grip
    # four fingers: from the knuckle line, over the outer side of the hood and under it
    for i, w in enumerate((-0.026, -0.009, 0.008, 0.024)):
        k0 = wr + hd * 0.088 + side_v * (w * 0.9 + 0.004) + up * 0.002
        rad = [0.0094, 0.0089, 0.0082, 0.0074]
        L = 0.050 - abs(w + 0.004) * 0.35
        p1 = k0 + hd * 0.020 + side_v * 0.012 - up * 0.008
        p2 = p1 + side_v * 0.010 - up * 0.026 - hd * 0.004
        p3 = p2 - side_v * 0.010 - up * 0.016 - hd * 0.004
        pts = [k0, p1, p2, p3]
        mb.tube(pts, rad, stiff=3.5, up=Vector((0, 0, 1)), tag=tag, k=0.25)
    # thumb: from the base of the palm, forwards along the inside of the hood
    t0 = wr + hd * 0.030 - side_v * 0.030 - up * 0.006
    t1 = t0 + hd * 0.035 - side_v * 0.010 - up * 0.016
    t2 = t1 + hd * 0.028 - up * 0.012
    mb.tube([t0, t1, t2], [0.014, 0.0115, 0.010], stiff=3.5, up=Vector((0, 0, 1)), tag=tag, k=0.25)


# ============================================================== weights + kit regions

def element_arrays(mb):
    """numpy-friendly element data."""
    tags = sorted({e[7] for e in mb.elems if e[7]})
    tag_idx = {t: i for i, t in enumerate(tags)}
    data = []
    for (typ, co, rot, rad, s, size, neg, tag) in mb.elems:
        Rinv = np.array(rot.to_matrix().inverted())
        data.append((typ, np.array(co), Rinv, rad, s, np.array(size), neg, tag_idx.get(tag, -1)))
    return tags, data


def field_by_tag(verts, tags, data):
    W = np.zeros((len(tags), len(verts)))
    for (typ, co, Rinv, rad, s, size, neg, ti) in data:
        if neg or ti < 0:
            continue
        d = (verts - co) @ Rinv.T
        if typ == 'CAPSULE':
            x = d[:, 0]
            d[:, 0] = np.where(x > size[0], x - size[0], np.where(x < -size[0], x + size[0], 0.0))
        elif typ == 'ELLIPSOID':
            d = d / size
        q = 1.0 - (d * d).sum(1) / (rad * rad)
        f = np.where(q > 0, s * q ** 3, 0.0)
        W[ti] += f
    return W


def skin_weights(me, mb):
    verts = np.array([v.co[:] for v in me.vertices])
    tags, data = element_arrays(mb)
    W = field_by_tag(verts, tags, data)
    W = W ** 1.6                                   # sharpen joint transitions a little
    W /= np.maximum(W.sum(0), 1e-9)
    # Laplacian smoothing over the mesh graph
    ed = np.array([e.vertices[:] for e in me.edges])
    n = len(verts)
    for _ in range(3):
        acc = np.zeros_like(W)
        cnt = np.zeros(n)
        np.add.at(acc.T, ed[:, 0], W.T[ed[:, 1]])
        np.add.at(acc.T, ed[:, 1], W.T[ed[:, 0]])
        np.add.at(cnt, ed[:, 0], 1)
        np.add.at(cnt, ed[:, 1], 1)
        W = 0.5 * W + 0.5 * acc / np.maximum(cnt, 1)
    # keep the 4 strongest
    idx = np.argsort(-W, axis=0)[:4]
    out = np.zeros_like(W)
    for k in range(4):
        out[idx[k], np.arange(n)] = W[idx[k], np.arange(n)]
    out /= np.maximum(out.sum(0), 1e-9)
    return tags, out


def dominant(tags, W, me):
    vdom = np.argmax(W, axis=0)
    return vdom


def bone_t(p, a, b):
    d = b - a
    return (p - a).dot(d) / d.length_squared


COLLAR_W = 0.009


def collar_plane(S):
    a, b = S.j["C7"], S.j["skull"]
    return a + (b - a) * 0.20 + S.b * -0.004, (b - a).normalized()


def kit_regions(me, S, tags, W):
    """Cut clean hem lines with planes, then assign kit materials per face."""
    j = S.j
    tagi = {t: i for i, t in enumerate(tags)}
    vdom = np.argmax(W, axis=0)
    # planes: (point, normal, allowed tags, max distance from point)
    planes = []
    seg = {}
    for s, n in SIDES:
        seg["UpperArm." + n] = (j["shoulder." + n], j["elbow." + n])
        seg["Forearm." + n] = (j["elbow." + n], j["wrist." + n])
        seg["Thigh." + n] = (j["hip." + n], j["knee." + n])
        seg["Shin." + n] = (j["knee." + n], j["ankle." + n])
    cuts = {"UpperArm": (0.46, 0.50), "Forearm": (0.93,), "Thigh": (0.585, 0.625), "Shin": (0.70, 0.735)}
    for s, n in SIDES:
        for bone, ts in cuts.items():
            a, b = seg[bone + "." + n]
            d = (b - a).normalized()
            allowed = {bone + "." + n}
            if bone == "Forearm":
                allowed.add("Hand." + n)
            for t in ts:
                planes.append((a.lerp(b, t), d, allowed, 0.12))
    torso = {"Hips", "Spine", "Chest"}
    for t in (0.315, 0.375):
        planes.append((S.T(t, 0.0), S.u, torso, 0.35))
    cp, cn = collar_plane(S)
    for off in (0.0, -COLLAR_W):
        planes.append((cp + cn * off, cn, {"Neck", "Chest", "Shoulder.L", "Shoulder.R"}, 0.16))
    # zipper strip on the chest
    for yy in (-0.0045, 0.0045):
        planes.append((S.T(0.3, -0.1, yy), Y, torso | {"Neck"}, 0.6))

    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    dom_tag = [tags[i] for i in vdom]
    for (co, no, allowed, rmax) in planes:
        faces = []
        for f in bm.faces:
            c = f.calc_center_median()
            if (c - co).length > rmax:
                continue
            if any(dom_tag[v.index] in allowed for v in f.verts if v.index < len(dom_tag)):
                faces.append(f)
        if not faces:
            continue
        geom = list({e for f in faces for e in f.edges}) + list({v for f in faces for v in f.verts}) + faces
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no, dist=0.00002)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    bm.to_mesh(me)
    bm.free()
    return seg


def smooth_scalar(me, s, iters=12):
    """Graph-Laplacian smoothing of a per-vertex scalar so its iso-line is a clean curve."""
    ed = np.array([e.vertices[:] for e in me.edges])
    n = len(me.vertices)
    s = np.asarray(s, dtype=float).copy()
    for _ in range(iters):
        acc = np.zeros(n)
        cnt = np.zeros(n)
        np.add.at(acc, ed[:, 0], s[ed[:, 1]])
        np.add.at(acc, ed[:, 1], s[ed[:, 0]])
        np.add.at(cnt, ed[:, 0], 1)
        np.add.at(cnt, ed[:, 1], 1)
        s = 0.5 * s + 0.5 * acc / np.maximum(cnt, 1)
    return s


def hem_cut(me, S, mb):
    tags, W = skin_weights(me, mb)
    iso_cut(me, smooth_scalar(me, hem_scalar(me, S, tags, W), 60), "hem")
    tags, W = skin_weights(me, mb)
    iso_cut(me, smooth_scalar(me, hair_scalar(me, S, tags, W), 6), "hair")


def hair_scalar(me, S, tags, W):
    """> 0 where short hair shows below the helmet (back of the head + above the ears)."""
    ti = {t: i for i, t in enumerate(tags)}
    head_w = W[ti["Head"]] if "Head" in ti else np.zeros(len(me.vertices))
    co = np.array([v.co[:] for v in me.vertices]) - np.array(S.j["head"])
    x = co @ np.array(S.hf)
    z = co @ np.array(S.hu)
    yy = np.abs(co[:, 1])
    back = -(x + 0.028) / 0.02
    top = (z - 0.040) / 0.02
    side = np.minimum(np.minimum(-(x - 0.012) / 0.02, (yy - 0.062) / 0.01), (z + 0.004) / 0.02)
    s = np.maximum(np.maximum(back, top), side)
    s = np.minimum(s, (z + 0.068) / 0.02)          # hairline at the nape
    return np.where(head_w > 0.5, s, -1.0)


def iso_cut(me, svals, layer):
    """Split the mesh along the zero iso-line of a per-vertex scalar (clean curved seams).
    The scalar is stored in a float vertex layer so the faces can be classified exactly."""
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    lay = bm.verts.layers.float.get(layer) or bm.verts.layers.float.new(layer)
    sv = {}
    for v in bm.verts:
        x = float(svals[v.index])
        sv[v] = x if abs(x) > 1e-7 else 1e-7
        v[lay] = sv[v]
    new = set()
    for e in [e for e in bm.edges if (sv[e.verts[0]] > 0) != (sv[e.verts[1]] > 0)]:
        v0, v1 = e.verts
        fac = sv[v0] / (sv[v0] - sv[v1])
        ne, nv = bmesh.utils.edge_split(e, v0, fac)
        sv[nv] = 0.0
        nv[lay] = 0.0
        new.add(nv)
    for f in list(bm.faces):
        nvs = [v for v in f.verts if v in new]
        if len(nvs) == 2:
            try:
                bmesh.utils.face_split(f, nvs[0], nvs[1])
            except ValueError:
                pass
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    bm.to_mesh(me)
    bm.free()


HEM_U = 0.055


def hem_scalar(me, S, tags, W):
    """> 0 on the jersey side of the waist hem: above the waist plane AND torso-dominant."""
    ti = {t: i for i, t in enumerate(tags)}
    torso = sum(W[ti[t]] for t in ("Hips", "Spine", "Chest") if t in ti)
    thigh = sum(W[ti[t]] for t in ("Thigh.L", "Thigh.R") if t in ti)
    tn = np.where(torso + thigh > 1e-6, torso / np.maximum(torso + thigh, 1e-9), 1.0)
    co = np.array([v.co[:] for v in me.vertices])
    u_ = (co - np.array(G.HIP_C)) @ np.array(S.u)
    return np.minimum((u_ - HEM_U) / 0.05, (tn - 0.74) / 0.25)


MATS = ["Skin", "Jersey", "JerseyAccent", "JerseyDark", "Bib", "BibBand", "Sock", "SockBand", "Glove", "Hair"]


def rider_materials(kit):
    return [
        mat("Skin", kit["skin"], roughness=0.52, sheen=0.1),
        mat("Jersey", kit["jersey"], roughness=0.62, sheen=0.4),
        mat("JerseyAccent", kit["jersey_accent"], roughness=0.6, sheen=0.4),
        mat("JerseyDark", kit["jersey_dark"], roughness=0.6, sheen=0.4),
        mat("Bib", kit["bib"], roughness=0.48, sheen=0.3),
        mat("BibBand", kit["bib_band"], roughness=0.35),
        mat("Sock", kit["sock"], roughness=0.85, sheen=0.5),
        mat("SockBand", kit["sock_band"], roughness=0.85, sheen=0.5),
        mat("Glove", kit["glove"], roughness=0.6),
        mat("Hair", kit["hair"], roughness=0.75),
    ]


def assign_kit(me, S, tags, W_new, seg):
    j = S.j
    vdom = np.argmax(W_new, axis=0)
    hem = [d.value for d in me.attributes["hem"].data]
    hair = [d.value for d in me.attributes["hair"].data]
    cp, cn = collar_plane(S)
    mi = {m: i for i, m in enumerate(MATS)}
    out = []
    for p in me.polygons:
        c = p.center
        doms = [tags[vdom[v]] for v in p.vertices]
        d = max(set(doms), key=doms.count)
        base, _, n = d.partition(".")
        m = "Skin"
        h = sum(hem[v] for v in p.vertices) / len(p.vertices)
        beyond_collar = (c - cp).dot(cn) > 0
        if base in ("Hips", "Spine", "Chest", "Shoulder", "Neck"):
            u_ = (c - G.HIP_C).dot(S.u)
            if beyond_collar:
                m = "Skin"
            elif (c - cp).dot(cn) > -COLLAR_W:
                m = "JerseyDark"         # collar
            elif h < 0 and base != "Shoulder":
                m = "Bib"
            elif 0.315 < u_ < 0.375:
                m = "JerseyAccent"
            else:
                m = "Jersey"
            if m in ("Jersey", "JerseyAccent") and abs(c.y) < 0.0045 and (c - G.HIP_C).dot(S.b) < -0.02:
                m = "JerseyDark"         # zipper
        elif base == "Head":
            m = "Skin"
            hp = c - j["head"]
            x, z = hp.dot(S.hf), hp.dot(S.hu)
            if sum(hair[v] for v in p.vertices) / len(p.vertices) > 0:
                m = "Hair"
        elif base == "UpperArm":
            t = bone_t(c, *seg[d])
            m = "Jersey" if t < 0.46 else ("JerseyAccent" if t < 0.50 else "Skin")
        elif base == "Forearm":
            t = bone_t(c, *seg[d])
            m = "Glove" if t > 0.93 else "Skin"
        elif base == "Hand":
            m = "Glove"
        elif base == "Thigh":
            t = bone_t(c, *seg[d])
            m = "Bib" if t < 0.585 else ("BibBand" if t < 0.625 else "Skin")
            if h > 0:
                m = "Jersey"
        elif base == "Shin":
            t = bone_t(c, *seg[d])
            m = "Skin" if t < 0.70 else ("SockBand" if t < 0.735 else "Sock")
        elif base == "Foot":
            m = "Sock"
        out.append(mi[m])
    me.polygons.foreach_set("material_index", out)


# ============================================================== accessories

def shoe_mesh(kit_mats):
    """Cycling shoe in the foot frame: origin = ankle, x forward along the sole, z up."""
    mb = MeshBuilder()
    sole_z = -0.087
    rings = []
    n = 24
    xs = [-0.075, -0.068, -0.05, -0.02, 0.02, 0.06, 0.10, 0.14, 0.17, 0.19, 0.205, 0.214]
    for x in xs:
        t = (x + 0.075) / 0.29
        # plan half width
        w = 0.033 + 0.020 * math.sin(min(1.0, t * 1.45) * math.pi * 0.62) - 0.022 * smoothstep(0.72, 1.0, t) ** 1.5
        if x < -0.06:
            w *= 0.85
        top = lerp(0.006, -0.044, smoothstep(0.25, 0.95, t)) - 0.008 * smoothstep(0.92, 1.0, t)
        if x < -0.05:
            top = 0.012
        top = max(top, sole_z + 0.022)
        ring = []
        for k in range(n):
            a = TAU * k / n
            ca, sa = math.cos(a), math.sin(a)
            yy = w * math.copysign(abs(ca) ** 0.7, ca)
            zz_mid = (top + sole_z + 0.008) / 2
            hh = (top - sole_z - 0.008) / 2
            zz = zz_mid + hh * math.copysign(abs(sa) ** 0.8, sa)
            ring.append(Vector((x, yy, zz)))
        rings.append(ring)
    # close the toe and heel ends by shrinking
    first = [Vector((xs[0] - 0.006, p.y * 0.4, p.z)) for p in rings[0]]
    last = [Vector((xs[-1] + 0.006, p.y * 0.35, p.z * 0.9 + sole_z * 0.1 + 0.004)) for p in rings[-1]]
    v, f = loft([first] + rings + [last], cap_start=True, cap_end=True)
    mb.add(v, f, 0)
    # carbon sole
    sole = []
    for x in [-0.074 + 0.29 * i / 14 for i in range(15)]:
        t = (x + 0.075) / 0.29
        w = 0.032 + 0.021 * math.sin(min(1.0, t * 1.45) * math.pi * 0.62) - 0.022 * smoothstep(0.72, 1.0, t) ** 1.5
        sole.append([Vector((x, w * math.cos(TAU * k / 16), sole_z + 0.004 + 0.0045 * math.sin(TAU * k / 16))) for k in range(16)])
    v, f = loft(sole, cap_start=True, cap_end=True)
    mb.add(v, f, 1)
    # cleat (under the ball, sits on the pedal)
    v, f = box(0.070, 0.050, 0.008, Vector((0.118, 0, sole_z - 0.003)))
    mb.add(v, f, 2)
    # BOA dial + strap band
    v, f = cylinder(Vector((0.055, 0, -0.030)) + Vector((0, 0, 0.006)), Vector((0.058, 0, -0.012)), 0.014, 20)
    mb.add(v, f, 2)
    return mb


def build_shoes(S, mats):
    out = {}
    for s, n in SIDES:
        mb = shoe_mesh(mats)
        fr = S.foot_rot(n).to_4x4()
        xf = Matrix.Translation(S.j["ankle." + n]) @ fr @ Matrix.Translation((0.118, 0, 0)) @ \
            Matrix.Diagonal((0.95, 0.97, 1.0, 1.0)) @ Matrix.Translation((-0.118, 0, 0))
        if s < 0:
            pass
        mb2 = MeshBuilder()
        mb2.extend(mb, xf=xf)
        # BOA dial on the outside of each shoe
        out[n] = mb2.obj("Shoe." + n, mats, COL, auto_smooth=50)
    return out


def build_helmet(S, mats):
    """Road helmet shell with vents (solidified), straps; in the head frame."""
    H = S.head_xf
    nu, nv = 56, 18
    verts, faces, keep, fmat = [], [], [], []
    c = Vector((-0.012, 0, 0.022))
    ax = Vector((0.142, 0.106, 0.118))
    grid = {}
    for jv in range(nv + 1):
        for iu in range(nu):
            th = TAU * iu / nu                  # 0 = front
            # rim elevation: higher at the front, low tail at the back
            ct = math.cos(th)
            el_rim = math.radians(-4 + 26 * max(0, ct) ** 1.2 - 24 * max(0, -ct) ** 2)
            el = lerp(el_rim, math.radians(89), (jv / nv) ** 0.95)
            x = ax.x * math.cos(el) * math.cos(th)
            y = ax.y * math.cos(el) * math.sin(th)
            z = ax.z * math.sin(el)
            # pointed tail at the back
            tail = max(0, -ct) ** 6 * 0.035 * (1 - jv / nv)
            x -= tail
            grid[(iu, jv)] = len(verts)
            verts.append(H(c + Vector((x, y, z))))
    vent = []
    for jv in range(nv):
        for iu in range(nu):
            a = grid[(iu, jv)]
            b = grid[((iu + 1) % nu, jv)]
            cc = grid[((iu + 1) % nu, jv + 1)]
            d = grid[(iu, jv + 1)]
            th = TAU * (iu + 0.5) / nu
            el_t = (jv + 0.5) / nv
            ct = math.cos(th)
            # longitudinal vent slots: front-to-back channels
            slot = int(round((math.sin(th)) * 4.5))
            frac = (math.sin(th) * 4.5) % 1.0
            is_vent = (0.18 < el_t < 0.80 and abs(frac - 0.5) < 0.22 and abs(math.sin(th)) < 0.92
                       and (ct > 0.25 or ct < -0.35))
            if is_vent and not (0.30 < el_t < 0.42 and ct > 0) and not (0.55 < el_t < 0.62):
                continue
            faces.append((a, b, cc, d))
            fmat.append(2 if jv < 3 else 0)
    me = make_mesh("Helmet", verts, faces, fmat)
    ob = new_obj("Helmet", me, COL, mats, auto_smooth=None)
    mod = ob.modifiers.new("solid", 'SOLIDIFY')
    mod.thickness = 0.022
    mod.offset = 1.0
    mod.use_rim = True
    mod.material_offset = 1
    mod.material_offset_rim = 1      # inner shell + rim = foam (index 1 / 3 -> remapped below)
    sub = ob.modifiers.new("sub", 'SUBSURF')
    sub.levels = 1
    apply_modifiers(ob)
    for p in ob.data.polygons:          # solidify offsets: 0 shell, 2 accent, 1/3 -> foam
        if p.material_index == 3:
            p.material_index = 1
    shade(ob.data, True, 40)
    # straps
    sm = MeshBuilder()
    for s in (1, -1):
        fa = H(Vector((0.025, s * 0.085, -0.004)))
        ba = H(Vector((-0.085, s * 0.080, -0.020)))
        meet = H(Vector((0.005, s * 0.068, -0.075)))
        chin = H(Vector((0.055, s * 0.020, -0.112)))
        for p0 in (fa, ba):
            pts = [p0.lerp(meet, t / 6) for t in range(7)]
            v, f = sweep(pts, [(-0.0045, 0.0007), (0.0045, 0.0007), (0.0045, -0.0007), (-0.0045, -0.0007)], up=Y)
            sm.add(v, f, 0)
        pts = [meet.lerp(chin, t / 6) for t in range(7)]
        v, f = sweep(pts, [(-0.0055, 0.0008), (0.0055, 0.0008), (0.0055, -0.0008), (-0.0055, -0.0008)], up=Y)
        sm.add(v, f, 0)
        v, f = box(0.012, 0.004, 0.018, meet)
        sm.add(v, f, 0)
    sm.obj("HelmetStraps", [mats[3]], COL, auto_smooth=40)
    return ob


def build_glasses(S, lens_mat, frame_mat):
    H = S.head_xf
    mb = MeshBuilder()
    # wrap-around single lens: patch of a vertical cylinder-ish surface in front of the eyes
    nu, nv = 28, 8
    rings = []
    for jv in range(nv + 1):
        t = jv / nv
        z = lerp(-0.022, 0.036, t)
        row = []
        for iu in range(nu + 1):
            a = lerp(-1.0, 1.0, iu / nu)            # -1..1 across
            ang = a * math.radians(72)
            r = 0.117 + 0.004 * (1 - t)
            x = r * math.cos(ang) - 0.002
            y = r * math.sin(ang) * 0.80
            # lower edge with a nose cut-out
            zz = z
            if t == 0:
                zz = z + 0.014 * math.exp(-(a / 0.12) ** 2)
            row.append(H(Vector((x - 0.004 * abs(a) ** 2, y, zz + 0.006 * abs(a) ** 2))))
        rings.append(row)
    verts = [p for r in rings for p in r]
    faces = []
    w = nu + 1
    for jv in range(nv):
        for iu in range(nu):
            a = jv * w + iu
            faces.append((a, a + 1, a + 1 + w, a + w))
    mb.add(verts, faces, 0)
    lens = mb.obj("Glasses", [lens_mat], COL, auto_smooth=None)
    mod = lens.modifiers.new("solid", 'SOLIDIFY')
    mod.thickness = 0.0022
    apply_modifiers(lens)
    shade(lens.data, True, 50)
    # frame top bar + temples
    fm = MeshBuilder()
    top = rings[-1]
    v, f = sweep(top, circle(0.0028, 6), caps=True)
    fm.add(v, f, 0)
    for s in (1, -1):
        e = top[-1] if s > 0 else top[0]
        pts = [e, H(Vector((0.030, s * 0.088, 0.030))), H(Vector((-0.045, s * 0.086, 0.014))), H(Vector((-0.070, s * 0.081, -0.008)))]
        v, f = sweep(pts, [(-0.0045, 0.0015), (0.0045, 0.0015), (0.0045, -0.0015), (-0.0045, -0.0015)], up=Y)
        fm.add(v, f, 0)
    fm.obj("GlassesFrame", [frame_mat], COL, auto_smooth=40)
    return lens


# ============================================================== main

def build():
    S = Skel()
    mats = rider_materials(KIT)
    mb = build_body_meta(S)
    me = mb.to_mesh("Body")
    print("  body metaball elements:", len(mb.elems), "raw verts", len(me.vertices))
    me = cleanup_mesh(me, merge=0.0002, smooth_iters=1, target_tris=56000)
    tags, W = skin_weights(me, mb)
    seg = kit_regions(me, S, tags, W)
    hem_cut(me, S, mb)
    tags, W2 = skin_weights(me, mb)         # recompute on the cut mesh
    ob = new_obj("Body", me, COL, mats, auto_smooth=None)
    assign_kit(me, S, tags, W2, seg)
    # vertex groups
    for ti, t in enumerate(tags):
        vg = ob.vertex_groups.new(name=t)
        nz = np.nonzero(W2[ti] > 1e-4)[0]
        for vi in nz:
            vg.add([int(vi)], float(W2[ti, vi]), 'REPLACE')
    mb.remove()
    shoe_mats = [mat("Shoe", KIT["shoe"], roughness=0.35, clearcoat=0.5),
                 mat("ShoeSole", (0.05, 0.05, 0.055), roughness=0.3, clearcoat=0.8),
                 mat("ShoeDetail", KIT["jersey_dark"], roughness=0.45)]
    shoes = build_shoes(S, shoe_mats)
    helmet_mats = [mat("Helmet", KIT["helmet"], roughness=0.25, clearcoat=1.0),
                   mat("HelmetFoam", (0.12, 0.12, 0.13), roughness=0.85),
                   mat("HelmetAccent", KIT["helmet_accent"], roughness=0.25, clearcoat=1.0),
                   mat("Strap", (0.08, 0.08, 0.09), roughness=0.7)]
    build_helmet(S, helmet_mats)
    build_glasses(S, mat("Lens", KIT["lens"], metallic=0.85, roughness=0.06, clearcoat=1.0),
                  mat("GlassesFrame", (0.06, 0.06, 0.065), roughness=0.3))
    return S, ob
