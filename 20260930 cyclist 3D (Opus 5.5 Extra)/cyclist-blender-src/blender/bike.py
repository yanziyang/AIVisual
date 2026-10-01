"""Road bike: carbon frame + fork (metaball fillets), deep-section wheels, 2x11 drivetrain,
drop bars, hoods, saddle, pedals, bottle. Built procedurally with bpy."""
import bpy
import bmesh
import math
from mathutils import Vector, Matrix, Quaternion
from util import *
import geom as G

COL = "Bike"


def materials(kit):
    return dict(
        paint=mat("FramePaint", kit["frame"], metallic=0.55, roughness=0.32, clearcoat=1.0, clearcoat_rough=0.04),
        accent=mat("FrameAccent", kit["frame_accent"], metallic=0.2, roughness=0.35, clearcoat=1.0),
        logo=mat("FrameLogo", (0.95, 0.95, 0.94), roughness=0.3, clearcoat=1.0),
        carbon=mat("Carbon", (0.045, 0.047, 0.05), metallic=0.0, roughness=0.28, clearcoat=0.8),
        rimdecal=mat("RimDecal", (0.92, 0.92, 0.9), roughness=0.35, clearcoat=0.6),
        tyre=mat("Tyre", (0.035, 0.035, 0.036), roughness=0.82),
        tyrewall=mat("TyreWall", (0.62, 0.50, 0.33), roughness=0.85),
        alu=mat("Alloy", (0.72, 0.73, 0.75), metallic=1.0, roughness=0.28),
        darkalu=mat("DarkAlloy", (0.13, 0.135, 0.14), metallic=0.9, roughness=0.35),
        steel=mat("Steel", (0.80, 0.80, 0.80), metallic=1.0, roughness=0.18),
        chain=mat("ChainSteel", (0.55, 0.55, 0.56), metallic=1.0, roughness=0.32),
        spokes=mat("Spokes", (0.06, 0.06, 0.065), metallic=0.6, roughness=0.35),
        rubber=mat("Rubber", (0.04, 0.04, 0.042), roughness=0.7),
        tape=mat("BarTape", kit["tape"], roughness=0.75),
        saddle=mat("Saddle", (0.03, 0.03, 0.032), roughness=0.55),
        saddle_acc=mat("SaddleAccent", kit["frame_accent"], roughness=0.4),
        bottle=mat("Bottle", kit["bottle"], roughness=0.45),
        bottlecap=mat("BottleCap", (0.08, 0.08, 0.09), roughness=0.5),
        rotor=mat("Rotor", (0.78, 0.78, 0.8), metallic=1.0, roughness=0.22),
    )


# --------------------------------------------------------------------- frame + fork

def build_frame(M):
    mb = Meta("FrameMB", resolution=0.0016, col=COL)
    BB, RA, HT_TOP, HT_BOT = G.BB, G.RA, G.HT_TOP, G.HT_BOT
    Y = Vector((0, 1, 0))
    # bottom bracket shell (press-fit, wide)
    mb.tube([BB + Vector((0, 0.044, 0)), BB - Vector((0, 0.044, 0))], [0.022, 0.022], stiff=4, up=Vector((1, 0, 0)))
    # head tube, tapered 1-1/8 -> 1.5, slightly hour-glass
    ht = [HT_TOP + G.STEER_DOWN * -0.006, HT_TOP.lerp(HT_BOT, 0.5), HT_BOT + G.STEER_DOWN * 0.006]
    mb.tube(ht, [0.0205, 0.0198, 0.0245], stiff=4, up=Y, aspect=[(1, 1.12), (1, 1.15), (1, 1.18)])
    # down tube: big oval, wide at the BB
    dt = [BB + Vector((0.020, 0, 0.018)), BB.lerp(G.DT_FRONT, 0.5), G.DT_FRONT]
    mb.tube(dt, [0.0235, 0.0225, 0.022], stiff=4, up=Y, aspect=[(1.20, 0.92), (1.05, 1.0), (1.0, 1.08)])
    # top tube, flattened near the seat cluster
    tt = [G.TT_REAR, G.TT_REAR.lerp(G.TT_FRONT, 0.5), G.TT_FRONT]
    mb.tube(tt, [0.0158, 0.0162, 0.0172], stiff=4, up=Y, aspect=[(1.15, 0.85), (1.05, 0.98), (1, 1.05)])
    # seat tube: truncated aero, long fore-aft
    st = [BB + G.SEAT_DIR * 0.02, BB + G.SEAT_DIR * 0.25, G.ST_TOP]
    mb.tube(st, [0.0175, 0.0155, 0.0150], stiff=4, up=Y, aspect=[(1.05, 1.25), (1.0, 1.32), (1.0, 1.25)])
    # chainstays (asymmetric: drive side taller), splaying out to 130 mm OLD
    for side in (1, -1):
        p = [BB + Vector((-0.035, side * 0.034, -0.002)),
             BB + Vector((-0.16, side * 0.054, 0.016)),
             RA + Vector((0.075, side * 0.062, -0.004)),
             RA + Vector((0.004, side * 0.064, 0.0))]
        big = 1.0 if side > 0 else 1.15
        mb.tube(p, [0.0125, 0.0108, 0.0088, 0.0075], stiff=4, up=Y,
                aspect=[(0.95, 1.25 * big), (0.9, 1.2 * big), (0.9, 1.1), (0.9, 1.0)])
        # dropped seat stays
        q = [RA + Vector((0.004, side * 0.064, 0.010)),
             RA + Vector((0.09, side * 0.055, 0.135)),
             G.SS_TOP + Vector((-0.035, side * 0.028, 0.0)),
             G.SS_TOP + Vector((-0.010, side * 0.012, 0.0))]
        mb.tube(q, [0.0068, 0.0075, 0.0088, 0.0102], stiff=4, up=Y,
                aspect=[(0.9, 1.0), (0.85, 1.1), (0.9, 1.15), (1, 1.15)])
        # dropouts
        mb.ellipsoid(RA + Vector((0.003, side * 0.064, 0.003)), (0.017, 0.0042, 0.016), stiff=6)
    me = mb.to_mesh("Frame")
    mb.remove()
    me = cleanup_mesh(me, merge=0.0001, smooth_iters=2, target_tris=30000)
    # cut clean straight paint lines before colouring (no jagged triangle edges)
    cs_dir = (Vector((G.RA.x, 0, G.RA.z)) - Vector((G.BB.x, 0, G.BB.z))).normalized()
    cs_cut = G.BB + cs_dir * 0.075
    ss_dir = (G.SS_TOP - G.RA).normalized()
    ss_cut = G.SS_TOP - ss_dir * 0.075
    bm = bmesh.new()
    bm.from_mesh(me)
    for co, no, sel in ((cs_cut, cs_dir, lambda c: c.z < G.BB.z + 0.12 and c.x < G.BB.x),
                        (ss_cut, ss_dir, lambda c: c.z > G.RA.z + 0.05 and c.x < G.BB.x - 0.08)):
        geom = [f for f in bm.faces if sel(f.calc_center_median())]
        geom = list({e for f in geom for e in f.edges}) + list({v for f in geom for v in f.verts}) + geom
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no, dist=0.00005)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    bm.to_mesh(me)
    bm.free()
    ob = new_obj("Frame", me, COL, [M["paint"], M["accent"], M["carbon"]], auto_smooth=None)
    ra2 = Vector((G.RA.x, 0, G.RA.z))
    for p in me.polygons:
        c = p.center
        c2 = Vector((c.x, 0, c.z))
        if (c2 - ra2).length < 0.026 and abs(c.y) > 0.056:
            p.material_index = 2
        elif c.z < G.BB.z + 0.12 and c.x < G.BB.x and (c - cs_cut).dot(cs_dir) > 0 and abs(c.y) > 0.015:
            p.material_index = 1          # chainstays
        elif c.z > G.RA.z + 0.0 and c.x < G.BB.x - 0.08 and (c - ss_cut).dot(ss_dir) < 0 and abs(c.y) > 0.02:
            p.material_index = 1          # seat stays
    add_frame_decals(M)
    return ob


def add_frame_decals(M):
    """White word-mark on both sides of the down tube, projected onto the tube."""
    a, b = G.BB + Vector((0.025, 0, 0.022)), G.DT_FRONT
    d = (b - a)
    mid = a.lerp(b, 0.52)
    ang = math.atan2(d.z, d.x)
    for side in (1, -1):
        me = text_mesh("CADENCE", size=0.040)
        bm = bmesh.new()
        bm.from_mesh(me)
        # text lies in its XY plane, facing +Z: rotate to face sideways and follow the tube
        R = Matrix.Rotation(ang, 4, 'Y').inverted() if False else None
        for v in bm.verts:
            x, y = v.co.x, v.co.y
            if side > 0:
                x = -x
            p = mid + Vector((math.cos(ang), 0, math.sin(ang))) * x + Vector((-math.sin(ang), 0, math.cos(ang))) * y
            # wrap onto the oval tube (half-width ~0.0235, half-height ~0.0245)
            tube_hw = 0.0242
            yy = y / 0.0245
            yy = max(-0.98, min(0.98, yy))
            p = p - Vector((-math.sin(ang), 0, math.cos(ang))) * y   # back to centre line
            th = math.asin(yy)
            p = p + Vector((-math.sin(ang), 0, math.cos(ang))) * (0.0256 * math.sin(th))
            p.y = side * (tube_hw + 0.0007) * math.cos(th)
            v.co = p
        bm.to_mesh(me)
        bm.free()
        new_obj("Decal_DT_%s" % ("L" if side > 0 else "R"), me, COL, [M["logo"]], smooth=False, auto_smooth=None)


def build_fork(M):
    mb = Meta("ForkMB", resolution=0.0016, col=COL)
    crown = G.CROWN
    Y = Vector((0, 1, 0))
    # steerer stub inside the head tube keeps the crown blended
    mb.tube([G.HT_BOT + G.STEER_DOWN * -0.05, crown], [0.0175, 0.019], stiff=4, up=Y)
    # crown: wide, aero
    mb.tube([crown + Vector((0, 0.047, 0)), crown + Vector((0, -0.047, 0))], [0.0145, 0.0145], stiff=4,
            up=Vector((1, 0, 0)), aspect=[(1.25, 0.75), (1.25, 0.75)])
    for side in (1, -1):
        top = crown + G.STEER_DOWN * 0.012 + Vector((0, side * 0.046, 0))
        bot = G.FA + Vector((0, side * 0.051, 0))
        mid = top.lerp(bot, 0.5) + G.STEER_FWD * 0.010 + Vector((0, side * 0.002, 0))
        p = [crown + Vector((0, side * 0.03, 0)), top, mid, bot + Vector((-0.003, 0, 0.025)), bot]
        mb.tube(p, [0.0125, 0.0128, 0.0100, 0.0078, 0.0068], stiff=4, up=Y,
                aspect=[(0.9, 1.3), (0.85, 1.45), (0.75, 1.5), (0.7, 1.35), (0.7, 1.2)])
        mb.ellipsoid(bot + Vector((0, 0, 0.003)), (0.015, 0.0042, 0.0155), stiff=6)
    me = mb.to_mesh("Fork")
    mb.remove()
    me = cleanup_mesh(me, merge=0.0001, smooth_iters=2, target_tris=9000)
    for p in me.polygons:
        if (Vector((p.center.x, 0, p.center.z)) - Vector((G.FA.x, 0, G.FA.z))).length < 0.028:
            p.material_index = 1
    return new_obj("Fork", me, COL, [M["paint"], M["carbon"]], auto_smooth=None)


# --------------------------------------------------------------------- wheels

def wheel_mesh(front, M):
    mb = MeshBuilder()
    c = Vector((0, 0, 0))
    R = G.RIM_BSD_R
    depth = G.RIM_DEPTH
    # rim profile (r, y): blunt toroidal deep section, 28 mm wide
    prof = []
    w = 0.0142
    for i in range(15):
        t = i / 14
        ang = -math.pi / 2 + math.pi * t
        prof.append((R - depth + 0.012 - 0.012 * math.cos(ang) * 1.0 + depth * 0, w * 0.75 * math.sin(ang)))
    rim_prof = [(R - 0.002, -w * 0.88), (R - 0.006, -w), (R - depth * 0.5, -w * 0.98)]
    # build a proper profile: from bead hook down the sidewall to the spoke bed and back up
    rim_prof = []
    for i in range(9):          # side A: hook -> spoke bed
        t = i / 8
        r = lerp(R + 0.002, R - depth + 0.010, t)
        y = -w * (1.0 - 0.10 * t * t)
        rim_prof.append((r, y))
    for i in range(1, 10):       # rounded spoke bed
        a = math.pi * i / 10
        rim_prof.append((R - depth + 0.010 - 0.010 * math.sin(a), -w * 0.9 * math.cos(a)))
    for i in range(9):
        t = i / 8
        r = lerp(R - depth + 0.010, R + 0.002, t)
        y = w * (1.0 - 0.10 * (1 - t) * (1 - t))
        rim_prof.append((r, y))
    # inner bed (tyre side), closing the loop
    rim_prof.append((R - 0.003, w * 0.65))
    rim_prof.append((R - 0.003, -w * 0.65))
    v, f = revolve(rim_prof, 96, 'Y', c, closed_profile=True)
    mb.add(v, f, 0)
    # rim decals: two bands of white on each side
    for side in (1, -1):
        for k in range(4):
            a0 = k * TAU / 4 + 0.25
            ring = []
            pts = []
            n = 16
            for i in range(n + 1):
                a = a0 + 0.62 * i / n
                for (rr, yy) in ((R - 0.012, side * (w * 1.002 - 0.0002)), (R - 0.026, side * (w * 0.99 - 0.0002))):
                    pts.append(Vector((rr * math.cos(a), yy + side * 0.0004, rr * math.sin(a))))
            faces = []
            for i in range(n):
                a_, b_, c_, d_ = 2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2
                faces.append((a_, b_, c_, d_) if side > 0 else (a_, d_, c_, b_))
            mb.add(pts, faces, 4)
    # tyre: elliptical profile seated inside the rim hooks, tan sidewalls
    c_r, ar, ay = R + 0.0095, 0.0140, 0.0138
    a_end = math.acos((0.001 - 0.0095) / ar)
    angs = [-a_end + 2 * a_end * i / 26 for i in range(27)]
    tyre = [(R - 0.0012, -0.0122)] + [(c_r + ar * math.cos(a), ay * math.sin(a)) for a in angs] + [(R - 0.0012, 0.0122)]
    v, f = revolve(tyre, 96, 'Y', c, closed_profile=False)
    f0 = len(mb.m)
    mb.add(v, f, 1)
    nring = 96
    for fi in range(len(f)):
        k = fi // nring           # profile segment index
        if k == 0 or k >= len(angs):
            mb.m[f0 + fi] = 6
            continue
        a = (angs[k - 1] + angs[k]) / 2
        if math.cos(a) < 0.05:
            mb.m[f0 + fi] = 6
    # hub shell + flanges
    hub = [(0.0, -0.05), (0.008, -0.05), (0.012, -0.046), (0.012, -0.040), (0.026 if not front else 0.021, -0.037),
           (0.026 if not front else 0.021, -0.033), (0.014, -0.030), (0.017, 0.0), (0.014, 0.030),
           (0.024 if not front else 0.021, 0.033), (0.024 if not front else 0.021, 0.037), (0.012, 0.040),
           (0.012, 0.046), (0.008, 0.05), (0.0, 0.05)]
    if front:
        hub = [(r, y) for (r, y) in hub]
    v, f = revolve(hub, 24, 'Y', c)
    mb.add(v, f, 3)
    # spokes: bladed, front radial 20, rear 24 two-cross
    n_sp = 20 if front else 24
    for i in range(n_sp):
        a = TAU * i / n_sp
        side = 1 if i % 2 == 0 else -1
        fl_r = 0.024 if not front else 0.020
        fl_y = side * 0.035
        if front:
            ha = a
        else:
            ha = a + side * 0.42 * (1 if (i // 2) % 2 == 0 else -1)
        p0 = Vector((fl_r * math.cos(ha), fl_y, fl_r * math.sin(ha)))
        p1 = Vector(((R - depth + 0.002) * math.cos(a), side * 0.004, (R - depth + 0.002) * math.sin(a)))
        d = (p1 - p0).normalized()
        side_v = d.cross(Vector((0, 1, 0))).normalized()
        if side_v.length < 0.1:
            side_v = Vector((1, 0, 0))
        up_v = d.cross(side_v)
        prof = [(0.0011 * math.cos(TAU * k / 6) * 1.0, 0.0011 * math.sin(TAU * k / 6) * 2.2) for k in range(6)]
        ring0 = [p0 + up_v * x + side_v * y for (x, y) in prof]
        ring1 = [p1 + up_v * x + side_v * y for (x, y) in prof]
        v, f = loft([ring0, ring1])
        mb.add(v, f, 2)
    # valve
    a = TAU * 0.5 / n_sp
    v, f = cylinder(Vector(((R - depth - 0.005) * math.cos(a), 0, (R - depth - 0.005) * math.sin(a))),
                    Vector(((R - depth + 0.006) * math.cos(a), 0, (R - depth + 0.006) * math.sin(a))), 0.0025, 8)
    mb.add(v, f, 5)
    # disc rotor (160 front / 140 rear) on the left (+Y) side
    rr = 0.080 if front else 0.070
    rotor = []
    for i in range(48):
        a = TAU * i / 48
        rotor.append((a,))
    ry = 0.0425
    ring_o = [Vector((rr * math.cos(TAU * i / 48), ry, rr * math.sin(TAU * i / 48))) for i in range(48)]
    ring_i = [Vector(((rr - 0.017) * math.cos(TAU * i / 48), ry, (rr - 0.017) * math.sin(TAU * i / 48))) for i in range(48)]
    ring_o2 = [p + Vector((0, 0.0018, 0)) for p in ring_o]
    ring_i2 = [p + Vector((0, 0.0018, 0)) for p in ring_i]
    v, f = loft([ring_i, ring_o, ring_o2, ring_i2], closed=True)
    # close the loop (i2 -> i)
    n = 48
    for i in range(n):
        j = (i + 1) % n
        f.append((3 * n + i, 3 * n + j, j, i))
    mb.add(v, f, 7)
    # rotor spider arms
    for k in range(6):
        a = TAU * k / 6 + 0.2
        b_ = a + 0.55
        p0 = Vector((0.022 * math.cos(a), ry + 0.0009, 0.022 * math.sin(a)))
        p1 = Vector(((rr - 0.012) * math.cos(b_), ry + 0.0009, (rr - 0.012) * math.sin(b_)))
        v, f = box(1, 1, 1)
        d = p1 - p0
        xf = Matrix.Translation((p0 + p1) / 2) @ Matrix.Rotation(-math.atan2(d.z, d.x), 4, 'Y') @ Matrix.Diagonal((d.length, 0.0022, 0.007, 1))
        mb.add(v, f, 7, xf)
    return mb


def build_wheels(M):
    mats = [M["carbon"], M["tyre"], M["spokes"], M["darkalu"], M["rimdecal"], M["alu"], M["tyrewall"], M["rotor"]]
    out = {}
    for front in (True, False):
        mb = wheel_mesh(front, M)
        name = "Wheel_F" if front else "Wheel_R"
        ob = mb.obj(name, mats, COL, auto_smooth=40)
        ob.location = G.FA if front else G.RA
        out[name] = ob
    return out


# --------------------------------------------------------------------- drivetrain

def build_cassette(M):
    mb = MeshBuilder()
    for n in G.COG_T:
        y = G.cog_y(n) - G.RA.y
        r = G.sprocket_r(n)
        v, f = toothed_ring(n, r - 0.0045, r + 0.0042, max(0.017, r - 0.016), y - 0.0009, y + 0.0009, samples=6)
        mb.add(v, f, 0)
    # freehub body / spider
    v, f = revolve([(0.016, -0.064), (0.017, -0.062), (0.017, -0.018), (0.016, -0.016)], 20, 'Y')
    mb.add(v, f, 1)
    ob = mb.obj("Cassette", [M["steel"], M["darkalu"]], COL, auto_smooth=30)
    ob.location = G.RA
    return ob


def build_crankset(M):
    """Chainrings + spider + both crank arms + spindle, at crank angle 0 (right arm up)."""
    mb = MeshBuilder()
    big, small = G.CHAINRING_T
    for (n, y, mat_) in ((big, G.CHAINLINE_Y, 0), (small, G.CHAINLINE_Y + 0.0075, 0)):
        r = G.sprocket_r(n)
        v, f = toothed_ring(n, r - 0.0045, r + 0.0045, r - (0.030 if n == big else 0.016), y - 0.0011, y + 0.0011, samples=5)
        mb.add(v, f, mat_)
    # 4-arm spider (hollow look) on the drive side
    for k in range(4):
        a = math.radians(45 + 90 * k) + (0.15 if k % 2 else 0)
        p0 = Vector((0.03 * math.sin(a), G.CHAINLINE_Y - 0.004, 0.03 * math.cos(a)))
        p1 = Vector((0.080 * math.sin(a), G.CHAINLINE_Y - 0.0016, 0.080 * math.cos(a)))
        prof = superellipse(0.0035, 0.008, 12, 3)
        pts = [p0.lerp(p1, t / 4) for t in range(5)]
        v, f = sweep(pts, lambda i, s: [(x * (1.3 - 0.4 * s), y * (1.2 - 0.35 * s)) for (x, y) in prof],
                     up=Vector((0, 1, 0)))
        mb.add(v, f, 1)
    # crank arms: hollow forged look, slightly bowed outward
    L = G.CRANK
    for side in (-1, 1):
        sign_up = 1 if side < 0 else -1     # right arm points up at phi=0, left down
        y0 = side * 0.058
        y1 = side * 0.074
        pts = []
        for i in range(13):
            t = i / 12
            z = sign_up * (0.006 + (L - 0.006) * t)
            y = y0 + (y1 - y0) * (t ** 0.6)
            pts.append(Vector((0, y, z)))
        def prof(i, s, side=side):
            w = lerp(0.0215, 0.0125, s ** 0.8)       # fore-aft width
            t = lerp(0.0125, 0.0085, s)              # thickness
            if s > 0.92:
                w *= 1.25
            return superellipse(t, w, 16, 3.2)
        v, f = sweep(pts, prof, up=Vector((0, 1, 0)))
        mb.add(v, f, 1)
        # pedal eye + bolt
        eye = Vector((0, y1, sign_up * L))
        v, f = cylinder(eye - Vector((0, side * 0.006, 0)), eye + Vector((0, side * 0.009, 0)), 0.0118, 16)
        mb.add(v, f, 1)
        # crank bolt boss at the spindle
        v, f = cylinder(Vector((0, side * 0.050, 0)), Vector((0, side * 0.064, 0)), 0.019, 20)
        mb.add(v, f, 1)
    # spindle
    v, f = cylinder(Vector((0, -0.062, 0)), Vector((0, 0.062, 0)), 0.012, 16)
    mb.add(v, f, 2)
    ob = mb.obj("Crankset", [M["steel"], M["darkalu"], M["alu"]], COL, auto_smooth=35)
    ob.location = G.BB
    return ob


def pedal_mesh(side):
    """Road clipless pedal body centred on the spindle axis, at the origin, sole horizontal."""
    mb = MeshBuilder()
    # spindle from the crank to the body
    v, f = cylinder(Vector((0, -side * 0.032, 0)), Vector((0, side * 0.012, 0)), 0.0065, 12)
    mb.add(v, f, 1)
    # body: wedge, longer to the front, flat platform
    rings = []
    for i in range(9):
        t = i / 8
        y = side * lerp(-0.026, 0.036, t)
        w_front = lerp(0.044, 0.050, math.sin(math.pi * t))
        w_back = lerp(0.034, 0.040, math.sin(math.pi * t))
        prof = []
        for k in range(20):
            a = TAU * k / 20
            x = (w_front if math.cos(a) > 0 else w_back) * math.cos(a)
            z = 0.0105 * math.sin(a) * (1 if math.sin(a) > 0 else 1.0)
            prof.append(Vector((x, y, z - 0.002)))
        rings.append(prof)
    v, f = loft(rings, cap_start=True, cap_end=True, flip=side > 0)
    mb.add(v, f, 0)
    # steel wear plate on top
    v, f = box(0.064, 0.050, 0.002, Vector((0.006, side * 0.006, 0.009)))
    mb.add(v, f, 1)
    return mb


def build_pedals(M):
    out = {}
    for side, name in ((1, "Pedal_L"), (-1, "Pedal_R")):
        mb = pedal_mesh(side)
        ob = mb.obj(name, [M["rubber"], M["steel"]], COL, auto_smooth=40)
        ob.location = G.pedal_pos(G.REST_PHI, side)
        out[name] = ob
    return out


def chain_path(samples_per_m=900):
    """Closed chain path through chainring, cog and both jockey wheels.
    Returns a list of 3-D points (x, y, z) and the loop length."""
    big = G.CHAINRING_T[0]
    cr = (Vector((G.BB.x, G.BB.z, 0)), G.sprocket_r(big), -1, G.CHAINLINE_Y)        # clockwise
    cog = (Vector((G.RA.x, G.RA.z, 0)), G.sprocket_r(G.COG_IN_USE), -1, G.cog_y(G.COG_IN_USE))
    up = (Vector((G.RD_UPPER.x, G.RD_UPPER.z, 0)), G.JOCKEY_R, 1, G.cog_y(G.COG_IN_USE) - 0.001)
    lo = (Vector((G.RD_LOWER.x, G.RD_LOWER.z, 0)), G.JOCKEY_R, -1, G.cog_y(G.COG_IN_USE) - 0.002)
    # travel order (chain moves): chainring -> lower jockey -> upper jockey -> cog -> chainring
    loop = [cr, lo, up, cog]

    def tangent(c1, c2):
        """Tangent segment leaving circle c1 and arriving on c2 for the given wrap senses
        (sense -1 = clockwise seen from the drive side, +x right, +z up)."""
        p1, r1, s1, _ = c1
        p2, r2, s2, _ = c2
        d = p2 - p1
        L = d.length
        base = math.atan2(d.y, d.x)
        best = None
        for ra in (r1, -r1):
            for rb in (r2, -r2):
                k = (ra - rb) / L
                if abs(k) > 1:
                    continue
                for sgn in (1, -1):
                    ang = base + sgn * math.acos(k)
                    n = Vector((math.cos(ang), math.sin(ang), 0))
                    a = p1 + n * ra
                    b = p2 + n * rb
                    t = (b - a).normalized()
                    va = a - p1
                    vb = b - p2
                    vel1 = Vector((-va.y, va.x, 0)).normalized() * s1
                    vel2 = Vector((-vb.y, vb.x, 0)).normalized() * s2
                    if vel1.dot(t) > 0.999 and vel2.dot(t) > 0.999:
                        best = (a, b)
        assert best, "no tangent"
        return best

    segs = []
    for i in range(4):
        segs.append(tangent(loop[i], loop[(i + 1) % 4]))
    pts = []
    for i in range(4):
        c = loop[i]
        p, r, s, y = c
        arrive = segs[i - 1][1]
        leave = segs[i][0]
        a0 = math.atan2(arrive.y - p.y, arrive.x - p.x)
        a1 = math.atan2(leave.y - p.y, leave.x - p.x)
        if s > 0:   # ccw: angle increases
            while a1 <= a0:
                a1 += TAU
        else:
            while a1 >= a0:
                a1 -= TAU
        n = max(2, int(abs(a1 - a0) * r * samples_per_m))
        for k in range(n):
            a = a0 + (a1 - a0) * k / n
            pts.append(Vector((p.x + r * math.cos(a), y, p.y + r * math.sin(a))))
        # straight run to the next circle
        a, b = segs[i]
        ny = loop[(i + 1) % 4][3]
        n = max(2, int((b - a).length * samples_per_m))
        for k in range(n):
            t = k / n
            q = a.lerp(b, t)
            pts.append(Vector((q.x, lerp(y, ny, t), q.y)))
    length = sum((pts[i] - pts[i - 1]).length for i in range(len(pts)))
    return pts, length


def chain_link_meshes():
    """Outer and inner link plates (one link pitch, centred on its first pin at the origin,
    pointing along +X)."""
    out = []
    for kind in ("outer", "inner"):
        mb = MeshBuilder()
        gap = 0.0058 if kind == "outer" else 0.0040      # half distance between plates
        th = 0.0008
        p = G.PITCH
        prof = []
        for k in range(28):
            a = TAU * k / 28
            # figure-8 plate: two circles joined with a waist
            x = p / 2 + (p / 2 + 0.0042) * math.cos(a)
            z = (0.0042 + 0.0006 * math.cos(2 * a) - 0.0012 * (math.sin(a) ** 2) * (abs(math.cos(a)) < 0.6)) * math.sin(a)
            prof.append((x, z))
        for side in (1, -1):
            y0 = side * gap
            ring0 = [Vector((x, y0, z)) for (x, z) in prof]
            ring1 = [Vector((x, y0 + side * th, z)) for (x, z) in prof]
            v, f = loft([ring0, ring1], cap_start=True, cap_end=True, flip=side < 0)
            mb.add(v, f, 0)
        if kind == "outer":
            for px in (0.0, p):
                v, f = cylinder(Vector((px, -gap - 0.0012, 0)), Vector((px, gap + 0.0012, 0)), 0.0018, 8)
                mb.add(v, f, 0)
        else:
            for px in (0.0, p):
                v, f = cylinder(Vector((px, -gap, 0)), Vector((px, gap, 0)), 0.0038, 10)
                mb.add(v, f, 0)
        out.append(mb)
    return out


def build_chain(M):
    pts, length = chain_path()
    n_links = int(round(length / G.PITCH))
    if n_links % 2:
        n_links += 1
    step = length / n_links
    # cumulative distances
    cum = [0.0]
    for i in range(1, len(pts)):
        cum.append(cum[-1] + (pts[i] - pts[i - 1]).length)

    def at(s):
        s = s % length
        lo, hi = 0, len(cum) - 1
        while lo < hi - 1:
            mid = (lo + hi) // 2
            if cum[mid] <= s:
                lo = mid
            else:
                hi = mid
        t = (s - cum[lo]) / max(1e-9, cum[hi] - cum[lo])
        return pts[lo].lerp(pts[hi], t)

    outer, inner = chain_link_meshes()
    mb = MeshBuilder()
    for i in range(n_links):
        a = at(i * step)
        b = at((i + 1) * step)
        d = (b - a)
        ang = math.atan2(d.z, d.x)
        xf = Matrix.Translation(a) @ Matrix.Rotation(-ang, 4, 'Y')
        mb.extend(outer if i % 2 == 0 else inner, xf=xf)
    ob = mb.obj("Chain", [M["chain"]], COL, auto_smooth=40)
    # keep prototypes + path for the web page (chain links animated in three.js)
    for kind, proto in (("ChainLinkOuter", outer), ("ChainLinkInner", inner)):
        pob = proto.obj(kind, [M["chain"]], "WebOnly", auto_smooth=40)
    path = bpy.data.objects.new("ChainPath", None)
    collection("WebOnly").objects.link(path)
    flat = []
    k = max(1, len(pts) // 360)
    for p in pts[::k]:
        flat.extend([round(p.x, 5), round(p.y, 5), round(p.z, 5)])
    path["chain_points"] = flat
    path["chain_length"] = length
    path["chain_links"] = n_links
    path["chainring_teeth"] = G.CHAINRING_T[0]
    path["cog_teeth"] = G.COG_IN_USE
    return ob, length, n_links


def build_derailleurs(M):
    mb = MeshBuilder()
    side_y = G.cog_y(G.COG_IN_USE) - 0.0015
    # hanger + knuckle + parallelogram (simplified but recognisable)
    hanger = G.RA + Vector((0.0, -0.068, -0.006))
    knuckle = G.RA + Vector((-0.012, -0.075, -0.030))
    v, f = cylinder(hanger, knuckle, 0.008, 12)
    mb.add(v, f, 0)
    body0 = knuckle + Vector((0.002, -0.006, -0.002))
    body1 = Vector((G.RD_UPPER.x - 0.004, -0.088, G.RD_UPPER.z + 0.008))
    pts = [body0.lerp(body1, t / 5) for t in range(6)]
    v, f = sweep(pts, lambda i, s: superellipse(lerp(0.016, 0.013, s), 0.012, 16, 3), up=Vector((0, 1, 0)))
    mb.add(v, f, 0)
    v, f = cylinder(body1, Vector((G.RD_UPPER.x, side_y - 0.012, G.RD_UPPER.z)), 0.011, 14)
    mb.add(v, f, 0)
    # cage plates (outer and inner)
    for y in (side_y - 0.0085, side_y + 0.0065):
        a = Vector((G.RD_UPPER.x, y, G.RD_UPPER.z))
        b = Vector((G.RD_LOWER.x, y, G.RD_LOWER.z))
        d = b - a
        ang = math.atan2(d.z, d.x)
        prof = []
        for k in range(24):
            t = TAU * k / 24
            x = (d.length / 2 + 0.017) * math.cos(t)
            z = 0.0165 * math.sin(t) * (1 - 0.25 * abs(math.cos(t)))
            prof.append((x, z))
        mid = (a + b) / 2
        r0 = [mid + Vector((x * math.cos(ang) - z * math.sin(ang), 0, x * math.sin(ang) + z * math.cos(ang))) for (x, z) in prof]
        r1 = [p + Vector((0, 0.0016, 0)) for p in r0]
        v, f = loft([r0, r1], cap_start=True, cap_end=True)
        mb.add(v, f, 1 if y < side_y else 0)
    rd = mb.obj("RearDerailleur", [M["darkalu"], M["carbon"]], COL, auto_smooth=40)
    # jockey wheels (rotate in the page)
    for name, c in (("Jockey_U", G.RD_UPPER), ("Jockey_L", G.RD_LOWER)):
        jm = MeshBuilder()
        r = G.JOCKEY_R
        v, f = toothed_ring(G.JOCKEY_T, r - 0.004, r + 0.0032, 0.004, -0.0013, 0.0013, samples=6)
        jm.add(v, f, 0)
        v, f = cylinder(Vector((0, -0.006, 0)), Vector((0, 0.006, 0)), 0.0045, 10)
        jm.add(v, f, 1)
        ob = jm.obj(name, [M["rubber"], M["steel"]], COL, auto_smooth=40)
        ob.location = Vector((c.x, side_y, c.z))
    # front derailleur: cage arc over the top-rear of the big ring + clamp on the seat tube
    fd = MeshBuilder()
    big_r = G.sprocket_r(G.CHAINRING_T[0])
    pts = []
    for i in range(10):
        th = math.radians(-52 + 40 * i / 9)       # clockwise from 12 o'clock
        rr = big_r + 0.010
        pts.append(Vector((G.BB.x + rr * math.sin(th), G.CHAINLINE_Y, G.BB.z + rr * math.cos(th))))
    for y_off in (-0.0085, 0.0085):
        rings = []
        for p in pts:
            rad = (Vector((p.x, 0, p.z)) - Vector((G.BB.x, 0, G.BB.z))).normalized()
            q = p + Vector((0, y_off, 0))
            o = Vector((0, 0.0016 * (1 if y_off > 0 else -1), 0))
            rings.append([q, q + o, q + o + rad * 0.016, q + rad * 0.016])
        v, f = loft(rings, cap_start=True, cap_end=True)
        fd.add(v, f, 0)
    clamp_c = G.BB + G.SEAT_DIR * 0.195
    v, f = cylinder(clamp_c + Vector((0.0, -0.004, 0)), pts[1] + Vector((0, -0.006, 0.016)), 0.0065, 10)
    fd.add(v, f, 0)
    fd.obj("FrontDerailleur", [M["darkalu"]], COL, auto_smooth=40)
    return rd


# --------------------------------------------------------------------- cockpit

def bar_path(side, n=None):
    """Handlebar centre-line for one side (side = +1 left, -1 right) from the clamp outwards."""
    c = G.BAR_C
    pts = []
    # tops
    for i in range(10):
        y = G.BAR_HALF_TOP * i / 9
        pts.append(Vector((c.x - 0.004 * (y / G.BAR_HALF_TOP) ** 2, side * y, c.z)))
    x0 = pts[-1].x
    # forward bend (in the horizontal plane), slight downward slope
    rb = G.BAR_BEND_R
    for i in range(1, 13):
        a = (math.pi / 2) * i / 12
        pts.append(Vector((x0 + rb * math.sin(a), side * (G.BAR_HALF_TOP + rb * (1 - math.cos(a))),
                           c.z - 0.006 * (i / 12))))
    # ramp
    p = pts[-1]
    for i in range(1, 4):
        pts.append(p + Vector((G.BAR_RAMP * i / 3, side * 0.0015 * i / 3, -0.004 * i / 3)))
    # drop: semicircle going down and back
    p = pts[-1]
    rd = G.BAR_DROP_R
    centre = p + Vector((0, 0, -rd))
    for i in range(1, 19):
        a = math.pi * i / 18
        pts.append(centre + Vector((rd * math.sin(a) * 1.08, side * G.BAR_FLARE * (i / 18), rd * math.cos(a))))
    # drop ends, heading back
    p = pts[-1]
    for i in range(1, 7):
        pts.append(p + Vector((-G.BAR_DROP_END * i / 6, side * 0.003 * i / 6, -0.006 * i / 6)))
    return pts


def hood_frame(side):
    """Position + orientation of the hood: at the start of the drop curve."""
    pts = bar_path(side)
    i0 = 10 + 12 + 3       # tops(10) + bend(12) + ramp(3) -> start of drop curve
    p = pts[i0 - 1]
    return p


def build_cockpit(M):
    mb = MeshBuilder()
    for side in (1, -1):
        pts = bar_path(side)
        n_tops = 10
        # bare bar (carbon) everywhere, tape over bend + drops
        v, f = sweep(pts, circle(G.BAR_R, 16), caps=True, up=Vector((0, 0, 1)))
        mb.add(v, f, 0)
        taped = pts[n_tops - 3:]
        L = [0.0]
        for i in range(1, len(taped)):
            L.append(L[-1] + (taped[i] - taped[i - 1]).length)
        # resample densely so the wrap ridges show
        dense = []
        total = L[-1]
        k = 0
        steps = int(total / 0.004)
        for s_i in range(steps + 1):
            s = total * s_i / steps
            while k < len(L) - 2 and L[k + 1] < s:
                k += 1
            t = (s - L[k]) / max(1e-9, L[k + 1] - L[k])
            dense.append(taped[k].lerp(taped[k + 1], t))

        def tape_prof(i, s, total=total):
            out = []
            for j in range(18):
                a = TAU * j / 18
                ph = (s * total / 0.032 + a / TAU) % 1.0       # helical wrap, 32 mm pitch
                ridge = 0.00045 * (1 - abs(2 * ph - 1)) ** 2
                r = G.BAR_R + 0.0026 + ridge
                out.append((r * math.cos(a), r * math.sin(a)))
            return out
        v, f = sweep(dense, tape_prof, caps=True, up=Vector((0, 0, 1)))
        mb.add(v, f, 1)
        # hood body: sits on top of the bar where the drop curve starts, runs forward ~75 mm
        # and rises into a rounded horn; lever blade hangs in front of the drop curve
        p = hood_frame(side)
        base = p + Vector((-0.010, 0, 0.006))
        hp = []
        for i in range(16):
            t = i / 15
            x = 0.084 * t
            z = 0.010 * math.sin(t * math.pi) + 0.016 * t ** 3
            hp.append(base + Vector((x, side * 0.003 * t, z)))

        def hood_prof(i, s):
            w = 0.0142 - 0.0022 * s
            h = 0.0200 - 0.0030 * s + 0.004 * smoothstep(0.75, 0.95, s)
            k = 1.0
            if s > 0.86:
                k = math.sqrt(max(0.0, 1 - ((s - 0.86) / 0.14) ** 2)) * 0.85 + 0.15
            elif s < 0.08:
                k = 0.55 + 0.45 * math.sqrt(1 - ((0.08 - s) / 0.08) ** 2)
            return [(x * k, y * k) for (x, y) in superellipse(h, w, 20, 2.6, offset=(0.0, 0.0))]
        v, f = sweep(hp, hood_prof, caps=True, up=Vector((0, 0, 1)))
        mb.add(v, f, 2)
        # lever blade: arc concentric with the drop curve, ~24 mm in front of it
        rd = G.BAR_DROP_R
        centre = p + Vector((0, 0, -rd))
        lp = []
        for i in range(14):
            a = lerp(0.42, 2.35, i / 13)
            rr = rd + 0.026 - 0.006 * (i / 13)
            lp.append(centre + Vector((rr * math.sin(a) * 1.08, side * (G.BAR_FLARE * 0.5 + 0.002), rr * math.cos(a))))

        def lever_prof(i, s):
            return superellipse(lerp(0.0048, 0.0036, s), lerp(0.0105, 0.0065, s), 14, 3.0)
        v, f = sweep(lp, lever_prof, caps=True, up=Vector((0, 1, 0)))
        mb.add(v, f, 3)
    # stem: rounded box from steerer clamp to bar clamp
    a, b = G.STEM_CLAMP_C, G.BAR_C
    pts = [a.lerp(b, t / 8) for t in range(9)]
    v, f = sweep(pts, lambda i, s: superellipse(lerp(0.019, 0.016, s), lerp(0.021, 0.0175, s), 20, 3.2),
                 caps=True, up=Vector((0, 1, 0)))
    mb.add(v, f, 4)
    # bar clamp face plate + steerer clamp
    v, f = cylinder(b + Vector((0, -0.027, 0)), b + Vector((0, 0.027, 0)), 0.0185, 20)
    mb.add(v, f, 4)
    v, f = cylinder(a + G.STEER_DOWN * 0.021, a - G.STEER_DOWN * 0.021, 0.0205, 20)
    mb.add(v, f, 4)
    # spacers + top cap + headset cover
    s0 = G.HT_TOP - G.STEER_DOWN * 0.002
    v, f = cylinder(s0, s0 - G.STEER_DOWN * (0.012 + G.SPACERS), 0.0185, 20)
    mb.add(v, f, 5)
    v, f = cylinder(a - G.STEER_DOWN * 0.021, a - G.STEER_DOWN * 0.026, 0.0165, 20)
    mb.add(v, f, 4)
    # computer mount + head unit ahead of the bars
    mount0 = b + Vector((0.01, 0, -0.012))
    mount1 = b + Vector((0.075, 0, -0.008))
    v, f = sweep([mount0.lerp(mount1, t / 4) for t in range(5)], superellipse(0.006, 0.012, 12, 3), caps=True)
    mb.add(v, f, 4)
    unit_c = mount1 + Vector((0.012, 0, 0.012))
    rot = Matrix.Rotation(math.radians(-14), 4, 'Y')
    v, f = box(0.082, 0.050, 0.018)
    xf = Matrix.Translation(unit_c) @ rot
    mb.add(v, f, 6, xf)
    v, f = box(0.066, 0.040, 0.002)
    mb.add(v, f, 7, xf @ Matrix.Translation((0.0, 0, 0.0095)))
    ob = mb.obj("Cockpit", [M["carbon"], M["tape"], M["rubber"], M["carbon"], M["carbon"], M["darkalu"],
                            mat("HeadUnit", (0.07, 0.07, 0.08), roughness=0.4),
                            mat("Screen", (0.05, 0.08, 0.06), roughness=0.1,
                                emission=(0.55, 0.85, 0.6, 0.35))], COL, auto_smooth=35)
    return ob


def hood_grip(side):
    """World point where the rider's palm sits on the hood + palm orientation (for the rig)."""
    p = hood_frame(side)
    return p + Vector((0.032, side * 0.003, 0.016))


# --------------------------------------------------------------------- saddle, seatpost

def build_saddle(M):
    mb = MeshBuilder()
    top = G.SADDLE_TOP + Vector((G.SADDLE_SETBACK_X, 0, 0))
    # saddle length 0.27, nose at +0.14 from the reference point
    rings = []
    n = 26
    for i in range(n + 1):
        t = i / n
        x = lerp(-0.125, 0.145, t)
        # plan-view half width
        w = 0.0705 * (1 - smoothstep(0.30, 0.86, t)) + 0.0175 * smoothstep(0.30, 0.86, t)
        w *= (0.93 + 0.07 * math.sin(min(1, t * 3) * math.pi / 2))
        # side-view: flat with slightly raised tail and dropped nose
        ztop = 0.004 * (1 - t) ** 3 * 2 - 0.006 * smoothstep(0.85, 1.0, t)
        thick = lerp(0.034, 0.024, t)
        prof = []
        m = 28
        for k in range(m):
            a = TAU * k / m
            ca, sa = math.cos(a), math.sin(a)
            y = w * math.copysign(abs(ca) ** 0.55, ca)
            if sa >= 0:
                z = ztop - 0.006 * (y / max(w, 1e-4)) ** 2 + 0.004 * sa * (1 - abs(ca))
            else:
                z = ztop - thick * (abs(sa) ** 1.6) * 0.65 - 0.009 * (y / max(w, 1e-4)) ** 4
            prof.append(Vector((top.x + x, y, top.z + z)))
        rings.append(prof)
    # round off the ends
    v, f = loft(rings, cap_start=True, cap_end=True)
    mb.add(v, f, 0)
    # accent stripe on the tail top (separate thin strip)
    # rails
    for side in (1, -1):
        rp = [top + Vector((-0.10, side * 0.035, -0.022)), top + Vector((-0.08, side * 0.034, -0.048)),
              top + Vector((0.02, side * 0.034, -0.050)), top + Vector((0.10, side * 0.020, -0.034)),
              top + Vector((0.135, side * 0.008, -0.020))]
        v, f = sweep(rp, circle(0.0035, 8), caps=True)
        mb.add(v, f, 1)
    saddle = mb.obj("Saddle", [M["saddle"], M["darkalu"], M["saddle_acc"]], COL, auto_smooth=None)
    # seatpost (aero D-shape) from inside the frame to the clamp under the saddle
    sp = MeshBuilder()
    p0 = G.BB + G.SEAT_DIR * 0.42
    p1 = top + Vector((0.0, 0, -0.050)) - Vector((G.SADDLE_SETBACK_X, 0, 0))
    p1 = G.BB + G.SEAT_DIR * (G.SADDLE_H - 0.058)
    pts = [p0.lerp(p1, t / 6) for t in range(7)]
    v, f = sweep(pts, superellipse(0.016, 0.0125, 18, 2.8), caps=True, up=Vector((0, 1, 0)))
    sp.add(v, f, 0)
    clamp = p1 + G.SEAT_DIR * 0.008
    v, f = box(0.05, 0.034, 0.016)
    sp.add(v, f, 1, Matrix.Translation(clamp + Vector((0.006, 0, 0.002))))
    sp.obj("Seatpost", [M["carbon"], M["darkalu"]], COL, auto_smooth=40)
    return saddle


def build_bottles(M):
    out = []
    specs = [("Bottle_DT", G.BB + Vector((0.020, 0, 0.018)), G.DT_FRONT, 0.33, 0.0255 + 0.004 + 0.0368, 1),
             ("Bottle_ST", G.BB + G.SEAT_DIR * 0.02, G.ST_TOP, 0.25, 0.0205 + 0.004 + 0.0368, -1)]
    for name, a, b, centre, off, nsign in specs:
        d = (b - a).normalized()
        n = Vector((-d.z, 0, d.x)) * nsign      # into the main triangle
        base = a + d * (centre - 0.114) + n * off
        prof = [(0.0, 0.0), (0.030, 0.0), (0.0365, 0.004), (0.0368, 0.05), (0.0335, 0.075), (0.0368, 0.10),
                (0.0368, 0.16), (0.034, 0.18), (0.026, 0.19), (0.018, 0.192)]
        v, f = revolve(prof, 28, 'Z')
        mb = MeshBuilder()
        mb.add(v, f, 0)
        cap = [(0.018, 0.192), (0.0185, 0.205), (0.012, 0.212), (0.0055, 0.214), (0.005, 0.226), (0.0035, 0.228), (0.0, 0.228)]
        v, f = revolve(cap, 20, 'Z')
        mb.add(v, f, 1)
        # cage: two wire hoops + spines toward the tube (-X)
        for z in (0.035, 0.125):
            ring = [Vector((0.0385 * math.cos(a_), 0.0385 * math.sin(a_), z))
                    for a_ in [math.pi * 0.25 + math.pi * 1.5 * i / 20 for i in range(21)]]
            v, f = sweep(ring, circle(0.0021, 6), caps=True)
            mb.add(v, f, 2)
        for y in (0.012, -0.012):
            spine = [Vector((-0.0385, y, 0.0)), Vector((-0.0405, y, 0.07)), Vector((-0.0385, y, 0.15))]
            v, f = sweep(spine, circle(0.0021, 6), caps=True)
            mb.add(v, f, 2)
        z_ax = d
        x_ax = -n
        y_ax = z_ax.cross(x_ax)
        R = Matrix((x_ax, y_ax, z_ax)).transposed().to_4x4()
        mb2 = MeshBuilder()
        mb2.extend(mb, xf=Matrix.Translation(base) @ R)
        out.append(mb2.obj(name, [M["bottle"], M["bottlecap"], M["carbon"]], COL, auto_smooth=40))
    return out


def build_brakes(M):
    mb = MeshBuilder()
    # flat-mount calipers on the left (+Y) side
    for (axle, up_dir, r) in ((G.FA, (G.CROWN - G.FA).normalized(), 0.080), (G.RA, Vector((0.35, 0, -0.94)).normalized(), 0.070)):
        if axle is G.RA:
            pos = G.RA + Vector((0.035, 0.052, -0.055))
        else:
            pos = G.FA + Vector((-0.045, 0.058, 0.055))
        to_axle = (Vector((axle.x, pos.y, axle.z)) - pos)
        ang = math.atan2(to_axle.z, to_axle.x)
        v, f = box(0.055, 0.022, 0.028)
        xf = Matrix.Translation(pos) @ Matrix.Rotation(-ang + math.pi / 2, 4, 'Y')
        mb.add(v, f, 0, xf)
    return mb.obj("BrakeCalipers", [M["darkalu"]], COL, auto_smooth=40)


def build(kit):
    M = materials(kit)
    parts = {}
    parts["Frame"] = build_frame(M)
    parts["Fork"] = build_fork(M)
    parts.update(build_wheels(M))
    parts["Cassette"] = build_cassette(M)
    parts["Crankset"] = build_crankset(M)
    parts.update(build_pedals(M))
    parts["Chain"], chain_len, links = build_chain(M)
    build_derailleurs(M)
    parts["Cockpit"] = build_cockpit(M)
    parts["Saddle"] = build_saddle(M)
    build_bottles(M)
    build_brakes(M)
    print("chain length %.3f m, %d links" % (chain_len, links))
    return parts
