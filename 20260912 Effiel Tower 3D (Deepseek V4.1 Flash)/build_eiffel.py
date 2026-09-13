"""
Procedural Eiffel Tower for Blender 3.6 LTS (headless).

Usage:
  blender -b --factory-startup --python build_eiffel.py -- --mode workbench --cam classic --out out/classic.png

Modes: none | workbench | cycles
Cams:  classic | hero | top | leg | mid
"""

import bpy
import bmesh
import math
import sys
import os
import bisect
import random
from mathutils import Vector

# ----------------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------------
def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    o = dict(mode="workbench", cam="classic", res="960x1599", samples="48",
             out="", blend="", exposure="0.0", film="1", ground="1",
             shift="0.2047", shiftx="0.0", parts="all")
    for a in argv:
        if a.startswith("--") and "=" in a:
            k, v = a[2:].split("=", 1)
            o[k] = v
    return o


ARGS = parse_args()
PROJ = r"C:\MyProjects\TempProject\eiffel"

# ----------------------------------------------------------------------------
# Profiles (meters, axis center)
# ----------------------------------------------------------------------------
Z1 = 57.63      # 1st floor
Z2 = 115.73     # 2nd floor
Z3 = 276.13     # top platform
ZS = 300.65     # top of structure
ZTIP = 330.0    # antenna tip

# Leg outer profile below the 1st floor (photo-calibrated), half width in m.
O_LEG = None


def o_leg(z):
    return O_LEG(min(max(z, 0.0), Z1))


def i_leg(z):
    return 0.6 * o_leg(z)


def pchip(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    n = len(xs)
    h = [xs[i + 1] - xs[i] for i in range(n - 1)]
    d = [(ys[i + 1] - ys[i]) / h[i] for i in range(n - 1)]
    m = [0.0] * n
    m[0] = d[0]
    m[-1] = d[-1]
    for i in range(1, n - 1):
        if d[i - 1] * d[i] <= 0.0:
            m[i] = 0.0
        else:
            w1 = 2 * h[i] + h[i - 1]
            w2 = h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])

    def f(x):
        if x <= xs[0]:
            return ys[0]
        if x >= xs[-1]:
            return ys[-1]
        i = bisect.bisect_right(xs, x) - 1
        t = (x - xs[i]) / h[i]
        h00 = 2 * t ** 3 - 3 * t ** 2 + 1
        h10 = t ** 3 - 2 * t ** 2 + t
        h01 = -2 * t ** 3 + 3 * t ** 2
        h11 = t ** 3 - t ** 2
        return h00 * ys[i] + h10 * h[i] * m[i] + h01 * ys[i + 1] + h11 * h[i] * m[i + 1]

    return f


O_LEG = pchip([
    (0.0, 61.5), (6.0, 58.6), (12.0, 55.3), (18.0, 52.0), (24.0, 48.6),
    (27.2, 45.1), (33.0, 42.1), (38.2, 39.5), (43.6, 36.8), (49.0, 35.2),
    (52.0, 35.0), (Z1, 34.9),
])

# outer half width of the structure above the 1st floor (from photo calibration)
O_MID = pchip([(z, v - 0.45) for (z, v) in [
    (Z1, 30.6), (64.57, 28.55), (70.41, 26.80), (80.66, 23.93), (91.22, 21.23),
    (102.05, 18.77), (Z2, 15.3),
]])
# outer half width of the shaft above the 2nd floor (from photo calibration)
O_SHAFT = pchip([(z, v - 0.33) for (z, v) in [
    (Z2, 15.3), (123.46, 14.87), (129.13, 14.13), (134.85, 13.44), (139.67, 12.88),
    (146.44, 12.22), (152.32, 11.66), (158.25, 11.14), (164.21, 10.71), (169.24, 10.33),
    (174.29, 10.00), (179.43, 9.61), (184.49, 9.43), (188.60, 9.24), (193.81, 8.95),
    (200.09, 8.66), (205.38, 8.42), (209.64, 8.23), (216.14, 7.88), (220.50, 7.68),
    (225.94, 7.49), (231.52, 7.18), (238.24, 6.87), (242.76, 6.66), (248.47, 6.40),
    (255.38, 6.08), (260.04, 5.87), (266.0, 5.70), (270.0, 5.62), (Z3, 5.4),
]])


def o_mid(z):
    return O_MID(min(max(z, Z1), Z2))


def o_shaft(z):
    return O_SHAFT(min(max(z, Z2), Z3))


# ----------------------------------------------------------------------------
# Geometry accumulator
# ----------------------------------------------------------------------------
class Accum:
    __slots__ = ("v", "f")

    def __init__(self):
        self.v = []
        self.f = []

    def _frame(self, p0, p1, up):
        p0 = Vector(p0)
        p1 = Vector(p1)
        d = p1 - p0
        L = d.length
        if L < 1e-6:
            return None
        d = d / L
        upv = Vector(up)
        if abs(d.dot(upv)) > 0.999:
            upv = Vector((0.0, 0.0, 1.0)) if abs(d.z) < 0.9 else Vector((1.0, 0.0, 0.0))
        side = d.cross(upv)
        if side.length < 1e-6:
            return None
        side.normalize()
        upv = side.cross(d).normalized()
        return p0, p1, side, upv

    def add_box(self, p0, p1, w, t, up):
        fr = self._frame(p0, p1, up)
        if fr is None:
            return
        p0, p1, side, upv = fr
        b = len(self.v)
        for p in (p0, p1):
            for sx, sy in ((-1, -1), (-1, 1), (1, 1), (1, -1)):
                self.v.append((p.x + side.x * w * 0.5 * sx + upv.x * t * 0.5 * sy,
                               p.y + side.y * w * 0.5 * sx + upv.y * t * 0.5 * sy,
                               p.z + side.z * w * 0.5 * sx + upv.z * t * 0.5 * sy))
        self.f += [(b, b + 1, b + 2, b + 3), (b + 4, b + 7, b + 6, b + 5),
                   (b + 0, b + 4, b + 5, b + 1), (b + 1, b + 5, b + 6, b + 2),
                   (b + 2, b + 6, b + 7, b + 3), (b + 3, b + 7, b + 4, b + 0)]

    def add_poly(self, pts, sizes, up):
        for i in range(len(pts) - 1):
            s = 0.5 * (sizes[i] + sizes[i + 1])
            self.add_box(pts[i], pts[i + 1], s, s, up)

    def add_frustum(self, x0, y0, x1, y1, zb, X0, Y0, X1, Y1, zt):
        b = len(self.v)
        for (x, y, z) in ((x0, y0, zb), (x1, y0, zb), (x1, y1, zb), (x0, y1, zb),
                          (X0, Y0, zt), (X1, Y0, zt), (X1, Y1, zt), (X0, Y1, zt)):
            self.v.append((x, y, z))
        self.f += [(b, b + 1, b + 2, b + 3), (b + 4, b + 7, b + 6, b + 5),
                   (b + 0, b + 4, b + 5, b + 1), (b + 1, b + 5, b + 6, b + 2),
                   (b + 2, b + 6, b + 7, b + 3), (b + 3, b + 7, b + 4, b + 0)]

    def add_cyl(self, p0, p1, r0, r1, seg=10, caps=True):
        fr = self._frame(p0, p1, Vector((0, 0, 1)))
        if fr is None:
            return
        p0, p1, side, upv = fr
        b = len(self.v)
        for p, r in ((p0, r0), (p1, r1)):
            for k in range(seg):
                a = 2 * math.pi * k / seg
                self.v.append((p.x + side.x * r * math.cos(a) + upv.x * r * math.sin(a),
                               p.y + side.y * r * math.cos(a) + upv.y * r * math.sin(a),
                               p.z + side.z * r * math.cos(a) + upv.z * r * math.sin(a)))
        for k in range(seg):
            k2 = (k + 1) % seg
            self.f.append((b + k, b + k2, b + seg + k2, b + seg + k))
        if caps:
            self.f.append(tuple(range(b + seg - 1, b - 1, -1)))
            self.f.append(tuple(range(b + seg, b + 2 * seg)))

    def add_torus(self, center, axis, R, r, seg=14, tube=6):
        c = Vector(center)
        n = Vector(axis).normalized()
        u = n.cross(Vector((0, 0, 1)))
        if u.length < 1e-6:
            u = n.cross(Vector((1, 0, 0)))
        u.normalize()
        w = n.cross(u)
        b = len(self.v)
        for i in range(seg):
            a = 2 * math.pi * i / seg
            ring_c = c + (u * math.cos(a) + w * math.sin(a)) * R
            out = (u * math.cos(a) + w * math.sin(a))
            for j in range(tube):
                h = 2 * math.pi * j / tube
                p = ring_c + out * (r * math.cos(h)) + n * (r * math.sin(h))
                self.v.append((p.x, p.y, p.z))
        for i in range(seg):
            i2 = (i + 1) % seg
            for j in range(tube):
                j2 = (j + 1) % tube
                self.f.append((b + i * tube + j, b + i2 * tube + j,
                               b + i2 * tube + j2, b + i * tube + j2))

    def add_sphere(self, center, rx, ry, rz, lat=8, lon=12):
        c = Vector(center)
        b = len(self.v)
        for i in range(lat + 1):
            phi = math.pi * i / lat
            for j in range(lon):
                th = 2 * math.pi * j / lon
                self.v.append((c.x + rx * math.sin(phi) * math.cos(th),
                               c.y + ry * math.sin(phi) * math.sin(th),
                               c.z + rz * math.cos(phi)))
        for i in range(lat):
            for j in range(lon):
                j2 = (j + 1) % lon
                a = b + i * lon + j
                bb = b + i * lon + j2
                cc = b + (i + 1) * lon + j2
                dd = b + (i + 1) * lon + j
                self.f.append((a, bb, cc, dd))

    def add_ring(self, o, i, z, th):
        # square ring slab (picture frame), 4 touching boxes
        self.add_frustum(-o, -o, o, -i, z - th, -o, -o, o, -i, z)
        self.add_frustum(-o, i, o, o, z - th, -o, i, o, o, z)
        self.add_frustum(-o, -i, -i, i, z - th, -o, -i, -i, i, z)
        self.add_frustum(i, -i, o, i, z - th, i, -i, o, i, z)


def lerp2(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def lattice_face(acc, railA, railB, zs, up, ch, cv, cd, target=6.0, top_h=True,
                 double_diag=False):
    """Build a vertical lattice wall between two rail functions z->(x,y)."""
    for k in range(len(zs) - 1):
        z0, z1 = zs[k], zs[k + 1]
        A0, B0 = railA(z0), railB(z0)
        A1, B1 = railA(z1), railB(z1)
        acc.add_box((A0[0], A0[1], z0), (B0[0], B0[1], z0), ch[0], ch[1], up)
        width = math.hypot(B0[0] - A0[0], B0[1] - A0[1])
        n = max(1, int(round(width / target)))
        for i in range(1, n):
            t = i / float(n)
            P0 = lerp2(A0, B0, t)
            P1 = lerp2(A1, B1, t)
            acc.add_box((P0[0], P0[1], z0), (P1[0], P1[1], z1), cv[0], cv[1], up)
        for i in range(n):
            t0, t1 = i / float(n), (i + 1) / float(n)
            a0 = lerp2(A0, B0, t0)
            b0 = lerp2(A0, B0, t1)
            a1 = lerp2(A1, B1, t0)
            b1 = lerp2(A1, B1, t1)
            if double_diag:
                for s in (-1.0, 1.0):
                    off = perpendicular_offset(a0, b0, s * 0.45)
                    acc.add_box((a0[0] + off[0], a0[1] + off[1], z0),
                                (b1[0] + off[0], b1[1] + off[1], z1), cd[0], cd[1], up)
                    acc.add_box((b0[0] + off[0], b0[1] + off[1], z0),
                                (a1[0] + off[0], a1[1] + off[1], z1), cd[0], cd[1], up)
            else:
                acc.add_box((a0[0], a0[1], z0), (b1[0], b1[1], z1), cd[0], cd[1], up)
                acc.add_box((b0[0], b0[1], z0), (a1[0], a1[1], z1), cd[0], cd[1], up)
    if top_h:
        zl = zs[-1]
        Al, Bl = railA(zl), railB(zl)
        acc.add_box((Al[0], Al[1], zl), (Bl[0], Bl[1], zl), ch[0], ch[1], up)


def perpendicular_offset(a, b, amount):
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy)
    if L < 1e-6:
        return (0.0, 0.0)
    return (-dy / L * amount, dx / L * amount)


# ----------------------------------------------------------------------------
# Build: legs below 1st floor
# ----------------------------------------------------------------------------
def build_leg_section(acc, z_start=10.5):
    zs = [z_start + (Z1 - z_start) * k / 16.0 for k in range(17)]
    OA = lambda z: (o_leg(z), o_leg(z))
    OB = lambda z: (i_leg(z), o_leg(z))
    OC = lambda z: (i_leg(z), i_leg(z))
    OD = lambda z: (o_leg(z), i_leg(z))
    # chords
    for fn, up in ((OA, (0.7, 0.7, 0)), (OB, (0.7, 0.7, 0)), (OC, (0.7, 0.7, 0)), (OD, (0.7, 0.7, 0))):
        pts = [(fn(z)[0], fn(z)[1], z) for z in zs]
        sizes = [1.85 - 1.0 * (k / 16.0) for k in range(17)]
        acc.add_poly(pts, sizes, up)
    # faces
    ch = (0.42, 0.26)
    cv = (0.30, 0.20)
    cd = (0.28, 0.18)
    lattice_face(acc, OA, OB, zs, (0, 1, 0), ch, cv, cd, target=3.0)
    lattice_face(acc, OB, OC, zs, (-1, 0, 0), ch, cv, cd, target=3.0)
    lattice_face(acc, OC, OD, zs, (0, -1, 0), ch, cv, cd, target=3.0)
    lattice_face(acc, OD, OA, zs, (1, 0, 0), ch, cv, cd, target=3.0)
    # inclined elevator track inside the leg
    rail_pts_l = []
    rail_pts_r = []
    for k in range(13):
        z = 12.0 + (55.0 - 12.0) * k / 12.0
        c = 0.5 * (i_leg(z) + o_leg(z))
        rail_pts_l.append((c - 0.95, c + 0.95, z))
        rail_pts_r.append((c + 0.95, c - 0.95, z))
    acc.add_poly(rail_pts_l, [0.22] * len(rail_pts_l), (1, 1, 0))
    acc.add_poly(rail_pts_r, [0.22] * len(rail_pts_r), (1, -1, 0))
    for k in range(1, len(rail_pts_l) - 1, 2):
        acc.add_box(rail_pts_l[k], rail_pts_r[k], 0.18, 0.14, (1, 1, 0))
    # internal cross bracing across the leg (visible through the lattice)
    bz = [z_start + (Z1 - z_start) * k / 8.0 for k in range(9)]
    for k in range(len(bz) - 1):
        z0, z1 = bz[k], bz[k + 1]
        B0 = (i_leg(z0), o_leg(z0), z0)
        D0 = (o_leg(z0), i_leg(z0), z0)
        B1 = (i_leg(z1), o_leg(z1), z1)
        D1 = (o_leg(z1), i_leg(z1), z1)
        acc.add_box(B0, D1, 0.2, 0.16, (1, 1, 0))
        acc.add_box(D0, B1, 0.2, 0.16, (1, -1, 0))
    # stair ribbon
    for k in range(20):
        z = 13.0 + k * 2.2
        s = 1 if k % 2 == 0 else -1
        c = 0.5 * (i_leg(z) + o_leg(z))
        acc.add_box((c - 1.4 * s, c + 1.4 * s, z), (c + 1.4 * s, c - 1.4 * s, z + 2.4),
                    1.1, 0.07, (1, 1, 0))


def build_masonry(acc):
    frac = [0.0, 1.6, 5.2, 9.4, 10.5]
    for k in range(len(frac) - 1):
        zb, zt = frac[k], frac[k + 1]
        inset_b = 2.2 - 1.8 * (zb / 10.5)
        inset_t = 2.2 - 1.8 * (zt / 10.5)
        outset_b = 2.3 - 1.9 * (zb / 10.5)
        outset_t = 2.3 - 1.9 * (zt / 10.5)
        if k == 0:      # plinth
            inset_b -= 0.6
            outset_b += 0.6
        if k == 2:      # cornice
            inset_b -= 0.45
            outset_b += 0.4
            inset_t -= 0.15
            outset_t += 0.12
        x0b, y0b = i_leg(zb) - inset_b, i_leg(zb) - inset_b
        x1b, y1b = o_leg(zb) + outset_b, o_leg(zb) + outset_b
        x0t, y0t = i_leg(zt) - inset_t, i_leg(zt) - inset_t
        x1t, y1t = o_leg(zt) + outset_t, o_leg(zt) + outset_t
        acc.add_frustum(x0b, y0b, x1b, y1b, zb, x0t, y0t, x1t, y1t, zt)


# ----------------------------------------------------------------------------
# Arches
# ----------------------------------------------------------------------------
ARCH_ZC = 9.3
ARCH_R = 34.1
ARCH_BAND = 3.0
ARCH_Y = 43.0
ARCH_HALFD = 2.2


def arch_depth(z):
    """Arch plane offset from the axis: follows the legs' inward lean."""
    t = max(0.0, min(1.0, (z - ARCH_ZC) / ARCH_R))
    return ARCH_Y - 13.0 * t


def build_arch(acc):
    N = 26
    phis = [math.radians(2.0 + (93.0 - 2.0) * k / (N - 1)) for k in range(N)]
    intrados = [(ARCH_R * math.sin(p), ARCH_ZC + ARCH_R * math.cos(p)) for p in phis]
    extrados = [((ARCH_R + ARCH_BAND) * math.sin(p), ARCH_ZC + (ARCH_R + ARCH_BAND) * math.cos(p)) for p in phis]

    def ydepth(z, off):
        return -(arch_depth(z) + off)

    # chords (front/back planes)
    for off in (-ARCH_HALFD, ARCH_HALFD):
        pts_i = [(x, ydepth(z, off), z) for (x, z) in intrados]
        pts_e = [(x, ydepth(z, off), z) for (x, z) in extrados]
        acc.add_poly(pts_i, [0.62] * N, (0, 1, 0))
        acc.add_poly(pts_e, [0.55] * N, (0, 1, 0))
        Rb = ARCH_R + 1.9
        pts_b = [(Rb * math.sin(p), ydepth(ARCH_ZC + Rb * math.cos(p), off), ARCH_ZC + Rb * math.cos(p)) for p in phis]
        acc.add_poly(pts_b, [0.28] * N, (0, 1, 0))
        # radial rungs between intrados and extrados
        for (xi, zi), (xe, ze) in zip(intrados, extrados):
            acc.add_box((xi, ydepth(zi, off), zi), (xe, ydepth(ze, off), ze), 0.34, 0.26, (0, 1, 0))
    # cross ties and bracing between the two planes
    for k in range(0, N - 1, 1):
        xi, zi = intrados[k]
        xe, ze = extrados[k]
        acc.add_box((xi, ydepth(zi, -ARCH_HALFD), zi), (xi, ydepth(zi, ARCH_HALFD), zi), 0.28, 0.22, (0, 1, 0))
        if k % 2 == 0:
            acc.add_box((xe, ydepth(ze, -ARCH_HALFD), ze), (xe, ydepth(ze, ARCH_HALFD), ze), 0.28, 0.22, (0, 1, 0))
            acc.add_box((xi, ydepth(zi, -ARCH_HALFD), zi), (xe, ydepth(ze, ARCH_HALFD), ze), 0.18, 0.14, (0, 1, 0))
            acc.add_box((xe, ydepth(ze, -ARCH_HALFD), ze), (xi, ydepth(zi, ARCH_HALFD), zi), 0.18, 0.14, (0, 1, 0))
    # decorative rings along the outer band
    for k in range(0, N, 1):
        p = phis[k]
        Rm = ARCH_R + 0.95
        zm = ARCH_ZC + Rm * math.cos(p)
        for off in (-ARCH_HALFD, ARCH_HALFD):
            acc.add_torus((Rm * math.sin(p), ydepth(zm, off), zm), (0, 1, 0), 0.5, 0.1, 12, 6)
    # spandrel between extrados and the under-deck girder (z=51.9),
    # only in the centre where it is not hidden inside the legs
    zg = 51.9
    Re = ARCH_R + ARCH_BAND
    xs_sp = [(Re * math.sin(p), ARCH_ZC + Re * math.cos(p)) for p in phis]
    for k in range(len(xs_sp) - 1):
        x0, z0 = xs_sp[k]
        x1, z1 = xs_sp[k + 1]
        if abs(x0) > 21.2 or abs(x1) > 21.2:
            continue
        y0 = ydepth((z0 + zg) * 0.5, 0.0)
        acc.add_box((x0, y0 - ARCH_HALFD, z0), (x0, y0 - ARCH_HALFD, zg), 0.28, 0.22, (0, 1, 0))
        acc.add_box((x0, y0 + ARCH_HALFD, z0), (x0, y0 + ARCH_HALFD, zg), 0.28, 0.22, (0, 1, 0))
        for off in (-ARCH_HALFD, ARCH_HALFD):
            acc.add_box((x0, y0 + off, z0), (x1, y0 + off, zg), 0.24, 0.18, (0, 1, 0))
            acc.add_box((x1, y0 + off, z1), (x0, y0 + off, zg), 0.24, 0.18, (0, 1, 0))


def build_underdeck_girder(acc, half, zb, zt, step=3.4, frieze=True):
    """Lattice girder around a square platform edge."""
    for side in range(4):
        # side 0: y=-half, 1: x=+half, 2: y=+half, 3: x=-half
        def pt(t, z, ins=1.0):
            if side == 0:
                return (-half + 2 * half * t, -half + ins, z)
            if side == 1:
                return (half - ins, -half + 2 * half * t, z)
            if side == 2:
                return (half - 2 * half * t, half - ins, z)
            return (-half + ins, half - 2 * half * t, z)
        n = max(4, int(round(2 * half / step)))
        up = ((0, 1, 0), (1, 0, 0), (0, 1, 0), (1, 0, 0))[side]
        top_ch = zt - 0.5
        acc.add_box(pt(0.0, top_ch), pt(1.0, top_ch), 0.5, 0.4, up)
        acc.add_box(pt(0.0, zb), pt(1.0, zb), 0.5, 0.4, up)
        for k in range(n + 1):
            t = k / float(n)
            acc.add_box(pt(t, zb), pt(t, top_ch), 0.34, 0.26, up)
        for k in range(n):
            t0, t1 = k / float(n), (k + 1) / float(n)
            acc.add_box(pt(t0, zb), pt(t1, top_ch), 0.3, 0.22, up)
            acc.add_box(pt(t1, zb), pt(t0, top_ch), 0.3, 0.22, up)
        if frieze:
            for k in range(int(2 * half / 1.6)):
                t = (k + 0.5) / int(2 * half / 1.6)
                acc.add_box(pt(t, zb - 1.1), pt(t, zb - 0.1), 0.5, 0.45, up)


def build_railing(acc, half, z, h=1.05, step=2.7, skip_inner=0.0):
    sides = ((0, -half, 1), (half, 0, 0), (0, half, 1), (-half, 0, 0))
    for axis, c, flip in sides:
        start = -half + skip_inner
        end = half - skip_inner
        n = max(2, int(round((end - start) / step)))
        for k in range(n + 1):
            t = start + (end - start) * k / n
            if axis == 0:
                acc.add_box((t, c, z), (t, c, z + h), 0.09, 0.09, (0, 1, 0))
            else:
                acc.add_box((c, t, z), (c, t, z + h), 0.09, 0.09, (1, 0, 0))
        for hz in (0.38, 0.72, 1.0):
            if axis == 0:
                acc.add_box((start, c, z + hz), (end, c, z + hz), 0.07, 0.07, (0, 1, 0))
            else:
                acc.add_box((c, start, z + hz), (c, end, z + hz), 0.07, 0.07, (1, 0, 0))


# ----------------------------------------------------------------------------
# 1st -> 2nd floor box section
# ----------------------------------------------------------------------------
def build_mid_section(acc):
    S0, S1 = 8.0, 6.0

    def col_s(z):
        t = (z - Z1) / (Z2 - Z1)
        return S0 + (S1 - S0) * t

    zs = [Z1 + (Z2 - Z1) * k / 20.0 for k in range(21)]
    # corner columns (one quadrant, mirrored later)
    for sx, sy in ((1, 1),):
        def O(z):
            return (o_mid(z), o_mid(z))
        def OI(z):
            return (o_mid(z) - col_s(z), o_mid(z))
        def II(z):
            return (o_mid(z) - col_s(z), o_mid(z) - col_s(z))
        def IO(z):
            return (o_mid(z), o_mid(z) - col_s(z))
        for fn in (O, OI, II, IO):
            pts = [(fn(z)[0], fn(z)[1], z) for z in zs]
            sizes = [0.85 - 0.35 * (k / 20.0) for k in range(21)]
            acc.add_poly(pts, sizes, (0.7, 0.7, 0))
        ch = (0.42, 0.28)
        cv = (0.3, 0.2)
        cd = (0.3, 0.2)
        lattice_face(acc, O, OI, zs, (0, 1, 0), ch, cv, cd, target=2.6)
        lattice_face(acc, OI, II, zs, (-1, 0, 0), ch, cv, cd, target=2.6)
        lattice_face(acc, II, IO, zs, (0, -1, 0), ch, cv, cd, target=2.6)
        lattice_face(acc, IO, O, zs, (1, 0, 0), ch, cv, cd, target=2.6)
    # face walls with dense lattice + band tiers between columns
    bands = [(78.5, 81.5), (104.5, 107.5)]
    for side in range(4):
        def rail(t, z):
            o = o_mid(z)
            w = o - col_s(z)
            x = -w + 2 * w * t
            if side == 0:
                return (x, -o + 1.1, z)
            if side == 1:
                return (o - 1.1, x, z)
            if side == 2:
                return (-x, o - 1.1, z)
            return (-o + 1.1, -x, z)
        up = ((0, 1, 0), (1, 0, 0), (0, 1, 0), (1, 0, 0))[side]
        zsf = [Z1 + (Z2 - Z1) * k / 15.0 for k in range(16)]
        A = lambda z, rr=rail: rr(0.0, z)
        B = lambda z, rr=rail: rr(1.0, z)
        lattice_face(acc, A, B, zsf, up, (0.40, 0.26), (0.28, 0.18), (0.26, 0.17),
                     target=3.2)
        for z0, z1 in bands:
            a0, b0 = A(z0), B(z0)
            a1, b1 = A(z1), B(z1)
            acc.add_box(a0, b0, 0.5, 0.34, up)
            acc.add_box(a1, b1, 0.5, 0.34, up)
            width = math.hypot(b0[0] - a0[0], b0[1] - a0[1])
            nb = max(4, int(round(width / 2.6)))
            for kk in range(nb):
                t0, t1 = kk / float(nb), (kk + 1) / float(nb)
                acc.add_box(rail(t0, z0), rail(t1, z1), 0.26, 0.18, up)
                acc.add_box(rail(t1, z0), rail(t0, z1), 0.26, 0.18, up)
    # interior: central machinery column + inclined elevator tracks
    for k in range(12):
        z0 = 58.5 + (113.0 - 58.5) * k / 11.0
        z1 = 58.5 + (113.0 - 58.5) * (k + 1) / 11.0
        for px, py in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
            acc.add_box((px * 2.4, py * 2.4, z0), (px * 2.4, py * 2.4, z1), 0.24, 0.24, (px, py, 0))
        acc.add_box((-2.4, -2.4, z0), (2.4, 2.4, z0), 0.2, 0.16, (1, -1, 0))
        acc.add_box((2.4, -2.4, z0), (-2.4, 2.4, z0), 0.2, 0.16, (1, 1, 0))
    for k in range(8):
        z0 = 60.0 + (112.0 - 60.0) * k / 7.0
        z1 = 60.0 + (112.0 - 60.0) * (k + 1) / 7.0
        for sx in (-1, 1):
            acc.add_box((sx * 1.6, -9.0 + 11.0 * k / 7.0, z0), (sx * 1.6, -9.0 + 11.0 * (k + 1) / 7.0, z1), 0.22, 0.2, (1, 0, 0))
    # green glass cab boxes inside
    acc.add_frustum(-1.6, -9.0, 1.6, -6.0, 62.0, -1.6, -9.0, 1.6, -6.0, 66.5)
    acc.add_frustum(-1.6, -6.0, 1.6, -3.0, 84.0, -1.6, -6.0, 1.6, -3.0, 88.5)


# ----------------------------------------------------------------------------
# Shaft above 2nd floor
# ----------------------------------------------------------------------------
def build_shaft(acc):
    zs = [Z2]
    z = Z2
    while z < 196.0 - 0.1:
        z += (196.0 - Z2) / 9.0
        zs.append(z)
    z = 196.0
    while z < Z3 - 0.1:
        z += (Z3 - 196.0) / 8.0
        zs.append(z)
    zs[-1] = Z3

    def rail_corner(px, py):
        return lambda z: (px * o_shaft(z), py * o_shaft(z))

    corners = [(1, 1), (-1, 1), (-1, -1), (1, -1)]
    for px, py in corners:
        fn = rail_corner(px, py)
        pts = [(fn(z)[0], fn(z)[1], z) for z in zs]
        sizes = [0.82 - 0.42 * (k / (len(zs) - 1)) for k in range(len(zs))]
        acc.add_poly(pts, sizes, (px, py, 0))
    ch = (0.45, 0.3)
    cv = (0.30, 0.2)
    cd = (0.28, 0.19)
    for i in range(4):
        p0 = corners[i]
        p1 = corners[(i + 1) % 4]
        A = rail_corner(*p0)
        B = rail_corner(*p1)
        up = ((0, 1, 0), (1, 0, 0), (0, 1, 0), (1, 0, 0))[i]
        lattice_face(acc, A, B, zs, up, ch, cv, cd, target=4.5, double_diag=False)
        # doubled diagonals (built-up members)
        for k in range(len(zs) - 1):
            z0, z1 = zs[k], zs[k + 1]
            a0, b0 = A(z0), B(z0)
            a1, b1 = A(z1), B(z1)
            for s in (-0.35, 0.35):
                off = perpendicular_offset(a0, b0, s)
                acc.add_box((a0[0] + off[0], a0[1] + off[1], z0),
                            (b1[0] + off[0], b1[1] + off[1], z1), 0.26, 0.2, up)
                off = perpendicular_offset(b0, a0, s)
                acc.add_box((b0[0] + off[0], b0[1] + off[1], z0),
                            (a1[0] + off[0], a1[1] + off[1], z1), 0.26, 0.2, up)
    # interior cross bracing (visible through the lattice)
    for k in range(0, len(zs) - 1, 3):
        z0, z1 = zs[k], zs[k + 1]
        d0 = o_shaft(z0) - 2.6
        d1 = o_shaft(z1) - 2.6
        acc.add_box((d0, d0, z0), (-d1, -d1, z1), 0.17, 0.13, (1, -1, 0))
        acc.add_box((-d0, d0, z0), (d1, -d1, z1), 0.17, 0.13, (1, 1, 0))
    # intermediate platform at 196 m
    op = o_shaft(196.0)
    acc.add_ring(op + 0.75, op - 1.2, 196.0, 0.45)
    for side in range(4):
        up = ((0, 1, 0), (1, 0, 0), (0, 1, 0), (1, 0, 0))[side]
        def pt(t, z, half=op + 0.75, ins=0.0):
            if side == 0:
                return (-half + 2 * half * t, -half + ins, z)
            if side == 1:
                return (half - ins, -half + 2 * half * t, z)
            if side == 2:
                return (half - 2 * half * t, half - ins, z)
            return (-half + ins, half - 2 * half * t, z)
        for hz in (0.4, 1.0):
            acc.add_box(pt(0, 196.0 + hz), pt(1, 196.0 + hz), 0.07, 0.07, up)
        n = max(2, int(round(2 * op / 2.5)))
        for k in range(n + 1):
            t = k / float(n)
            acc.add_box(pt(t, 196.0), pt(t, 196.0 + 1.0), 0.08, 0.08, up)
    # elevator cage
    for k in range(0, 24):
        z0 = Z2 + (Z3 - Z2) * k / 24.0
        z1 = Z2 + (Z3 - Z2) * (k + 1) / 24.0
        for px, py in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
            acc.add_box((px * 2.3, py * 2.3, z0), (px * 2.3, py * 2.3, z1), 0.22, 0.22, (px, py, 0))
        for kk in (0, 1):
            for s in (-1, 1):
                if kk == 0:
                    acc.add_box((-2.3, 2.3 * s, z0), (2.3, 2.3 * s, z1), 0.16, 0.12, (0, 1, 0))
                else:
                    acc.add_box((2.3 * s, -2.3, z0), (2.3 * s, 2.3, z1), 0.16, 0.12, (1, 0, 0))
        if k % 2 == 0:
            acc.add_box((-2.3, -2.3, z0), (2.3, 2.3, z0), 0.18, 0.14, (1, -1, 0))
            acc.add_box((2.3, -2.3, z0), (-2.3, 2.3, z0), 0.18, 0.14, (1, 1, 0))
    # support frames cage -> shaft
    for k in range(0, len(zs) - 1, 2):
        z = zs[k]
        d = o_shaft(z) - 1.4
        acc.add_box((-2.3, 0, z), (-d, 0, z), 0.2, 0.16, (0, 1, 0))
        acc.add_box((2.3, 0, z), (d, 0, z), 0.2, 0.16, (0, 1, 0))
        acc.add_box((0, -2.3, z), (0, -d, z), 0.2, 0.16, (1, 0, 0))
        acc.add_box((0, 2.3, z), (0, d, z), 0.2, 0.16, (1, 0, 0))


# ----------------------------------------------------------------------------
# Platforms
# ----------------------------------------------------------------------------
def build_platforms(acc):
    # ---- 1st floor
    o, i = 35.85, 20.6
    build_underdeck_girder(acc, o - 0.85, 51.9, Z1)
    acc.add_ring(o, i, Z1, 0.95)
    build_railing(acc, o - 0.15, Z1, 1.05, 2.7)
    build_railing(acc, i, Z1, 1.0, 3.0)
    # ---- 2nd floor
    o2, i2 = 18.75, 12.2
    build_underdeck_girder(acc, o2 - 0.8, 110.4, Z2)
    acc.add_ring(o2, i2, Z2, 0.8)
    build_railing(acc, o2 - 0.15, Z2, 1.05, 2.7)
    # ---- top platform
    o3, i3 = 8.6, 4.8
    op = o_shaft(Z3)
    for side in range(4):
        for k in range(6):
            t = k / 5.0
            if side == 0:
                p0 = (-op + 2 * op * t, -op, Z3 - 5.5)
                p1 = (-o3 + 0.3 + 2 * (o3 - 0.3) * t, -o3 + 0.3, Z3 - 0.4)
            elif side == 1:
                p0 = (op, -op + 2 * op * t, Z3 - 5.5)
                p1 = (o3 - 0.3, -o3 + 0.3 + 2 * (o3 - 0.3) * t, Z3 - 0.4)
            elif side == 2:
                p0 = (op - 2 * op * t, op, Z3 - 5.5)
                p1 = (o3 - 0.3 - 2 * (o3 - 0.3) * t, o3 - 0.3, Z3 - 0.4)
            else:
                p0 = (-op, op - 2 * op * t, Z3 - 5.5)
                p1 = (-o3 + 0.3, o3 - 0.3 - 2 * (o3 - 0.3) * t, Z3 - 0.4)
            acc.add_box(p0, p1, 0.3, 0.24, (0, 0, 1))
    acc.add_ring(o3, i3, Z3, 0.6)
    build_railing(acc, o3 - 0.12, Z3, 1.0, 2.2)
    # small antennas on the top railing
    for k in range(10):
        a = 2 * math.pi * k / 10.0
        x, y = (o3 - 0.12) * math.cos(a), (o3 - 0.12) * math.sin(a)
        acc.add_cyl((x, y, Z3 + 1.0), (x, y, Z3 + 2.6), 0.045, 0.03, 6)


# ----------------------------------------------------------------------------
# Campanile and antennas
# ----------------------------------------------------------------------------
def build_top(acc):
    camp_pts = [(276.5, 7.3), (280.0, 6.7), (283.0, 5.9), (287.0, 4.7),
                (291.0, 3.3), (294.5, 2.2), (Z3 - 0.1, 1.7)]
    camp = pchip(camp_pts)
    zs = [camp_pts[k][0] for k in range(len(camp_pts))]
    zs_fine = []
    for k in range(len(zs) - 1):
        zs_fine.append(zs[k])
        zs_fine.append(0.5 * (zs[k] + zs[k + 1]))
    zs_fine.append(zs[-1])
    corners = [(1, 1), (-1, 1), (-1, -1), (1, -1)]
    for px, py in corners:
        pts = [(px * camp(z), py * camp(z), z) for z in zs_fine]
        acc.add_poly(pts, [0.34 - 0.18 * k / (len(zs_fine) - 1) for k in range(len(zs_fine))],
                     (px, py, 0))
    for i4 in range(4):
        A = lambda z, p=corners[i4]: (p[0] * camp(z), p[1] * camp(z))
        B = lambda z, p=corners[(i4 + 1) % 4]: (p[0] * camp(z), p[1] * camp(z))
        up = ((0, 1, 0), (1, 0, 0), (0, 1, 0), (1, 0, 0))[i4]
        lattice_face(acc, A, B, zs_fine, up, (0.3, 0.2), (0.2, 0.14), (0.2, 0.14), target=1.4)
    # elevated gallery at the top of the campanile
    gt = 2.15
    acc.add_ring(gt + 0.55, gt - 0.75, ZS - 0.4, 0.3)
    build_railing(acc, gt + 0.45, ZS + 0.2, 0.85, 1.3)
    for k in range(8):
        a = 2 * math.pi * (k + 0.5) / 8.0
        x, y = (gt - 0.1) * math.cos(a), (gt - 0.1) * math.sin(a)
        acc.add_cyl((x, y, ZS + 0.2), (x, y, ZS + 2.2 + 0.7 * (k % 3)), 0.05, 0.035, 6)
    # dome
    acc.add_sphere((0, 0, ZS - 3.65), 1.75, 1.75, 1.55, 8, 14)
    acc.add_cyl((0, 0, ZS - 3.7), (0, 0, ZS - 5.2), 1.7, 1.75, 12)
    # main mast
    acc.add_cyl((0, 0, ZS - 3.6), (0, 0, 318.0), 0.95, 0.5, 10)
    for zc, w in ((302.5, 3.4), (309.5, 3.4), (315.5, 2.8), (320.0, 2.2)):
        acc.add_box((-w / 2, 0, zc), (w / 2, 0, zc), 0.12, 0.12, (1, 0, 0))
        acc.add_box((0, -w / 2, zc), (0, w / 2, zc), 0.12, 0.12, (0, 1, 0))
        for s in (-1, 1):
            acc.add_cyl((-s * w / 2, 0, zc - 0.5), (-s * w / 2, 0, zc + 0.5), 0.05, 0.04, 6)
            acc.add_cyl((0, -s * w / 2, zc - 0.5), (0, s * w / 2, zc + 0.5), 0.05, 0.04, 6)
    acc.add_cyl((0, 0, 318.0), (0, 0, 324.5), 0.3, 0.2, 10)
    # antenna cluster on the mast
    for zc, ang, ln in ((301.5, 0.0, 2.0), (303.5, 1.2, 1.5), (305.5, 2.4, 2.2),
                        (307.0, 3.6, 1.4), (311.0, 0.8, 1.8), (313.0, 2.0, 1.3),
                        (316.0, 3.1, 1.6), (318.5, 1.6, 1.2)):
        x1, y1 = ln * math.cos(ang), ln * math.sin(ang)
        acc.add_cyl((0, 0, zc), (x1, y1, zc), 0.07, 0.045, 6)
        acc.add_cyl((x1, y1, zc - 0.45), (x1, y1, zc + 0.45), 0.04, 0.03, 6)
    # top whip antennas
    random.seed(3)
    for k in range(6):
        a = 2 * math.pi * k / 6.0
        r0 = 0.42
        x0, y0 = r0 * math.cos(a), r0 * math.sin(a)
        x1, y1 = (0.9 * r0) * math.cos(a), (0.9 * r0) * math.sin(a)
        acc.add_cyl((x0, y0, 323.0), (x1, y1, 330.3), 0.07, 0.035, 6)
    acc.add_cyl((0, 0, 324.5), (0, 0, 330.0), 0.09, 0.03, 8)
    # antenna cluster
    for k in range(4):
        a = 2 * math.pi * (k + 0.5) / 4.0
        x0, y0 = 0.85 * math.cos(a), 0.85 * math.sin(a)
        acc.add_cyl((x0, y0, 316.0), (x0, y0, 322.5), 0.12, 0.09, 6)


# ----------------------------------------------------------------------------
# Transform helpers
# ----------------------------------------------------------------------------
def transform_accum(dst, src, sx, sy, rot90=0):
    """Append src into dst with mirror signs and optional 90deg rotations."""
    base = len(dst.v)
    for (x, y, z) in src.v:
        if rot90 == 1:
            x, y = -y, x
        elif rot90 == 2:
            x, y = -x, -y
        elif rot90 == 3:
            x, y = y, -x
        dst.v.append((x * sx, y * sy, z))
    for f in src.f:
        dst.f.append(tuple(base + idx for idx in f))


# ----------------------------------------------------------------------------
# Materials
# ----------------------------------------------------------------------------
def srgb2lin(c):
    return tuple((v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c)


def mat_paint():
    m = bpy.data.materials.new("EiffelPaint")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    attr = nt.nodes.new("ShaderNodeAttribute")
    attr.attribute_name = "Col"
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 9.0
    noise.inputs["Detail"].default_value = 6.0
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = 0.25
    mr.inputs["From Max"].default_value = 0.75
    mr.inputs["To Min"].default_value = 0.44
    mr.inputs["To Max"].default_value = 0.62
    nt.links.new(noise.outputs["Fac"], mr.inputs["Value"])
    nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(mr.outputs["Result"], bsdf.inputs["Roughness"])
    bsdf.inputs["Metallic"].default_value = 0.22
    bsdf.inputs["Specular"].default_value = 0.35
    m.diffuse_color = (0.35, 0.27, 0.19, 1.0)
    return m


def mat_simple(name, color, rough=0.8, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (color[0], color[1], color[2], 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    m.diffuse_color = (color[0], color[1], color[2], 1.0)
    return m


def mat_grass():
    m = bpy.data.materials.new("Grass")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 0.9
    noise.inputs["Detail"].default_value = 3.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.040, 0.058, 0.013, 1.0)
    ramp.color_ramp.elements[1].color = (0.105, 0.130, 0.028, 1.0)
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.95
    m.diffuse_color = (0.10, 0.19, 0.05, 1.0)
    return m


def paint_vertex_colors(ob):
    me = ob.data
    ca = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
    dark = srgb2lin((0.30, 0.225, 0.145))
    light = srgb2lin((0.55, 0.49, 0.36))
    rnd = random.Random(11)
    for i, v in enumerate(me.vertices):
        t = max(0.0, min(1.0, v.co.z / 300.0)) ** 1.05
        n = 1.0 + (rnd.random() - 0.5) * 0.13
        k = 1.0 - 0.22 * max(0.0, min(1.0, (v.co.z - 220.0) / 80.0))
        col = [dark[j] + (light[j] - dark[j]) * t for j in range(3)]
        ca.data[i].color = (col[0] * n * k, col[1] * n * k, col[2] * n * k, 1.0)
    me.color_attributes.active_color = ca


def mesh_from_accum(name, acc, mat, paint=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata(acc.v, [], acc.f)
    me.validate()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    if paint:
        paint_vertex_colors(ob)
    return ob


# ----------------------------------------------------------------------------
# Scene
# ----------------------------------------------------------------------------
def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


def setup_world(scene):
    w = bpy.data.worlds.new("World")
    scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes["Background"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = 0.0
    mr.inputs["From Max"].default_value = 0.75
    mr.inputs["To Min"].default_value = 0.0
    mr.inputs["To Max"].default_value = 1.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.elements[0].position = 0.0
    cr.elements[0].color = srgb2lin((0.62, 0.72, 0.82)) + (1.0,)
    cr.elements[1].position = 1.0
    cr.elements[1].color = srgb2lin((0.11, 0.20, 0.35)) + (1.0,)
    e = cr.elements.new(0.25)
    e.color = srgb2lin((0.36, 0.54, 0.71)) + (1.0,)
    e = cr.elements.new(0.55)
    e.color = srgb2lin((0.17, 0.30, 0.46)) + (1.0,)
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs[0])
    bg.inputs["Strength"].default_value = 0.90


def setup_sun(scene):
    d = Vector((-0.394, -0.657, 0.643)).normalized()
    lamp = bpy.data.lights.new("Sun", "SUN")
    lamp.energy = 5.4
    lamp.angle = math.radians(0.5)
    lamp.color = (1.0, 0.955, 0.875)
    ob = bpy.data.objects.new("Sun", lamp)
    bpy.context.collection.objects.link(ob)
    ob.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    # subtle bounce fill from the camera side (lifts dark lattice interiors)
    df = Vector((0.18, -0.88, 0.44)).normalized()
    fill = bpy.data.lights.new("Fill", "SUN")
    fill.energy = 0.55
    fill.angle = math.radians(12.0)
    fill.color = (1.0, 0.93, 0.84)
    obf = bpy.data.objects.new("Fill", fill)
    bpy.context.collection.objects.link(obf)
    obf.rotation_euler = df.to_track_quat("Z", "Y").to_euler()
    return ob


def add_atmosphere():
    m = bpy.data.materials.new("Atmo")
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    vol = nt.nodes.new("ShaderNodeVolumeScatter")
    vol.inputs["Color"].default_value = (0.55, 0.65, 0.78, 1.0)
    vol.inputs["Density"].default_value = 0.00012
    vol.inputs["Anisotropy"].default_value = 0.35
    nt.links.new(vol.outputs[0], out.inputs["Volume"])
    me = bpy.data.meshes.new("Atmo")
    s = 6000.0
    z0, z1 = -5.0, 45.0
    me.from_pydata([(-s, -s, z0), (s, -s, z0), (s, s, z0), (-s, s, z0),
                    (-s, -s, z1), (s, -s, z1), (s, s, z1), (-s, s, z1)], [],
                   [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4),
                    (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)])
    ob = bpy.data.objects.new("Atmosphere", me)
    ob.data.materials.append(m)
    bpy.context.collection.objects.link(ob)


def add_people():
    cols = [(0.20, 0.22, 0.28), (0.35, 0.16, 0.14), (0.16, 0.17, 0.19),
            (0.30, 0.30, 0.34), (0.45, 0.42, 0.38)]
    mats = [mat_simple("Ppl%d" % i, srgb2lin(c), rough=0.95) for i, c in enumerate(cols)]
    accs = [Accum() for _ in cols]
    rnd = random.Random(21)

    def person(x, y, m):
        h = 1.55 + rnd.uniform(-0.12, 0.18)
        accs[m % len(cols)].add_cyl((x, y, 0), (x, y, h), 0.22, 0.19, 6)

    for k in range(90):
        a = rnd.uniform(0, 2 * math.pi)
        rr = rnd.uniform(40, 75)
        person(rr * math.cos(a), rr * math.sin(a), rnd.randrange(len(cols)))
    for k in range(60):
        y = rnd.uniform(-310, -80)
        x = rnd.choice((-1, 1)) * rnd.uniform(33, 56)
        person(x, y, rnd.randrange(len(cols)))
    for k in range(25):
        person(rnd.uniform(-40, 40), rnd.uniform(-58, 30), rnd.randrange(len(cols)))
    for i, a in enumerate(accs):
        if a.v:
            ob = mesh_from_accum("People%d" % i, a, mats[i])
            for p in ob.data.polygons:
                p.use_smooth = True


def add_ground():
    grass = mat_grass()
    plaza = mat_simple("Plaza", srgb2lin((0.585, 0.55, 0.465)), rough=0.85)
    acc = Accum()
    acc.add_frustum(-6000, -6000, 6000, 6000, -1.0, -6000, -6000, 6000, 6000, 0.0)
    mesh_from_accum("Grass", acc, grass)
    acc = Accum()
    # paved parvis around the tower
    acc.add_frustum(-62, -62, 62, 62, 0.0, -62, -62, 62, 62, 0.10)
    # gravel alleys of the Champ de Mars
    for sx in (-1, 1):
        acc.add_frustum(sx * 31, -1600, sx * 58, 800, 0.0, sx * 31, -1600, sx * 58, 800, 0.07)
    # cross alley through the tower axis
    acc.add_frustum(-58, -58, 58, 58, 0.0, -58, -58, 58, 58, 0.08)
    mesh_from_accum("Plaza", acc, plaza)
    # trees framing the view (dense canopy walls like the Champ de Mars rows)
    tr = mat_simple("Trunk", srgb2lin((0.23, 0.18, 0.13)), rough=0.9)
    fol = bpy.data.materials.new("Foliage")
    fol.use_nodes = True
    nt = fol.node_tree
    b = nt.nodes["Principled BSDF"]
    fn = nt.nodes.new("ShaderNodeTexNoise")
    fn.inputs["Scale"].default_value = 0.05
    fn.inputs["Detail"].default_value = 4.0
    fr = nt.nodes.new("ShaderNodeValToRGB")
    fr.color_ramp.elements[0].color = srgb2lin((0.025, 0.050, 0.016)) + (1.0,)
    fr.color_ramp.elements[1].color = srgb2lin((0.085, 0.130, 0.042)) + (1.0,)
    nt.links.new(fn.outputs["Fac"], fr.inputs["Fac"])
    nt.links.new(fr.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.92
    rnd = random.Random(5)
    trunk = Accum()
    leaves = Accum()

    def tree(x, y, h, r):
        trunk.add_cyl((x, y, 0), (x, y, h * 0.62), 0.62, 0.40, 6)
        for _ in range(14):
            dx = rnd.uniform(-r * 0.8, r * 0.8)
            dy = rnd.uniform(-r * 0.8, r * 0.8)
            dz = rnd.uniform(-r * 0.55, r * 0.45)
            rr = r * rnd.uniform(0.28, 0.42)
            leaves.add_sphere((x + dx, y + dy, h * 0.80 + dz),
                              rr, rr * rnd.uniform(0.85, 1.1), rr * 0.85, 4, 7)

    # near tree walls lining the walkways on both sides of the axis
    for side in (-1, 1):
        y = -55.0
        while y > -640.0:
            tree(side * (58 + rnd.uniform(-4, 10)), y + rnd.uniform(-5, 5),
                 18.5 + rnd.uniform(-3.0, 5.0), 8.6 + rnd.uniform(-1.2, 2.4))
            y -= rnd.uniform(17, 24)
        y = -90.0
        while y > -660.0:
            tree(side * (92 + rnd.uniform(-10, 14)), y + rnd.uniform(-8, 8),
                 19.0 + rnd.uniform(-3.5, 5.0), 8.2 + rnd.uniform(-1.4, 2.4))
            y -= rnd.uniform(22, 32)
    # rows continuing beyond the tower along the Champ de Mars
    for k in range(10):
        y = 130 + k * 62 + rnd.uniform(-8, 8)
        for sx in (-1, 1):
            tree(sx * (60 + rnd.uniform(-6, 12)), y, 19.5 + rnd.uniform(-3, 5),
                 8.0 + rnd.uniform(-1.2, 2.4))
    # large crowns entering the frame edges like the reference photo
    tree(62, -150, 21.0, 9.5)
    tree(68, -195, 20.0, 9.0)
    tree(60, -238, 19.5, 8.8)
    tree(-64, -132, 20.5, 9.2)
    tree(-70, -235, 19.5, 9.0)
    trunk_ob = mesh_from_accum("Trunks", trunk, tr)
    fol_ob = mesh_from_accum("Foliage", leaves, fol)
    for p in fol_ob.data.polygons:
        p.use_smooth = True
    for p in trunk_ob.data.polygons:
        p.use_smooth = True
    # distant context: Ecole Militaire + dome + treeline
    ctx = mat_simple("Context", srgb2lin((0.63, 0.585, 0.49)), rough=0.9)
    acc = Accum()
    acc.add_frustum(-96, 656, -22, 700, 0.0, -96, 656, -22, 700, 19.5)
    acc.add_frustum(22, 656, 96, 700, 0.0, 22, 656, 96, 700, 19.5)
    acc.add_frustum(-22, 652, 22, 704, 0.0, -22, 652, 22, 704, 29.0)
    mesh_from_accum("Context", acc, ctx)
    roof = mat_simple("Roof", srgb2lin((0.28, 0.30, 0.33)), rough=0.85)
    acc = Accum()
    acc.add_frustum(-96, 656, 96, 700, 19.5, -96, 656, 96, 700, 23.0)
    acc.add_frustum(-22, 652, 22, 704, 29.0, -22, 652, 22, 704, 32.5)
    acc.add_sphere((0.0, 678, 31.0), 14.0, 14.0, 13.0, 8, 14)
    acc.add_cyl((0.0, 678, 42.0), (0.0, 678, 50.0), 1.8, 0.9, 8)
    mesh_from_accum("Roof", acc, roof)
    fol2 = mat_simple("Foliage2", srgb2lin((0.10, 0.185, 0.055)), rough=0.9)
    acc = Accum()
    rnd2 = random.Random(9)
    for sx in (-1, 1):
        for k in range(18):
            x = sx * (26 + k * 5.2 + rnd2.uniform(-2, 2))
            y = 310 + rnd2.uniform(-12, 12)
            h = 17 + rnd2.uniform(-2, 3)
            acc.add_sphere((x, y, h * 0.8), 6.0, 5.4, 5.0, 5, 8)
    for k in range(14):
        x = -450 + k * 68 + rnd2.uniform(-10, 10)
        y = 275 + rnd2.uniform(-6, 6)
        acc.add_sphere((x, y, 15), 5.5, 5.0, 4.6, 4, 7)
    ob2 = mesh_from_accum("Foliage2", acc, fol2)
    for p in ob2.data.polygons:
        p.use_smooth = True


def make_cam(name, loc, look=None, rot=None, lens=60.0, shift_y=0.0, shift_x=0.0):
    cam = bpy.data.cameras.new(name)
    cam.lens = lens
    cam.sensor_fit = "HORIZONTAL"
    cam.clip_end = 20000.0
    cam.shift_y = shift_y
    cam.shift_x = shift_x
    ob = bpy.data.objects.new(name, cam)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    if rot is not None:
        ob.rotation_euler = rot
    else:
        d = Vector(look) - Vector(loc)
        ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return ob


def setup_render(scene, mode):
    res = ARGS["res"].split("x")
    scene.render.resolution_x = int(res[0])
    scene.render.resolution_y = int(res[1])
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    if ARGS["film"] == "1":
        scene.render.film_transparent = True
    if mode == "workbench":
        scene.render.engine = "BLENDER_WORKBENCH"
        sh = scene.display.shading
        sh.light = "STUDIO"
        sh.color_type = "MATERIAL"
        sh.show_shadows = True
        sh.show_cavity = True
        sh.cavity_type = "BOTH"
        scene.display.render_aa = "8"
    else:
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.samples = int(ARGS["samples"])
        scene.cycles.use_denoising = True
        try:
            scene.cycles.denoiser = "OPENIMAGEDENOISE"
        except Exception:
            pass
        scene.cycles.max_bounces = 6
        scene.cycles.diffuse_bounces = 3
        scene.cycles.glossy_bounces = 3
        scene.cycles.transmission_bounces = 4
        scene.cycles.use_adaptive_sampling = True
        scene.cycles.adaptive_threshold = 0.02
        scene.view_settings.view_transform = "Filmic"
        try:
            scene.view_settings.look = "Medium High Contrast"
        except Exception:
            pass
        scene.view_settings.exposure = float(ARGS["exposure"])
        try:
            scene.view_layers[0].use_pass_mist = True
            scene.world.mist_settings.start = 220.0
            scene.world.mist_settings.depth = 3500.0
            scene.world.mist_settings.falloff = "QUADRATIC"
        except Exception:
            pass
        try:
            scene.use_nodes = True
            nt = scene.node_tree
            for n in list(nt.nodes):
                nt.nodes.remove(n)
            rl = nt.nodes.new("CompositorNodeRLayers")
            glare = nt.nodes.new("CompositorNodeGlare")
            glare.glare_type = "FOG_GLOW"
            glare.quality = "HIGH"
            glare.threshold = 1.0
            glare.size = 7
            glare.mix = -0.9
            comp = nt.nodes.new("CompositorNodeComposite")
            nt.links.new(rl.outputs["Image"], glare.inputs["Image"])
            nt.links.new(glare.outputs["Image"], comp.inputs["Image"])
        except Exception as e:
            print("compositor skipped:", e)


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def build_tower():
    steel = mat_paint()
    stone = mat_simple("Stone", srgb2lin((0.56, 0.51, 0.44)), rough=0.85)

    sel = ARGS["parts"].split(",")
    use = lambda p: (ARGS["parts"] == "all" or p in sel)

    acc = Accum()

    # legs (one quadrant, mirrored x4)
    leg = Accum()
    if use("legs"):
        build_leg_section(leg)
        for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
            transform_accum(acc, leg, sx, sy)

    # masonry
    mas = Accum()
    if use("mas"):
        build_masonry(mas)
        for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
            transform_accum(acc, mas, sx, sy)

    # arches (one, rotated x4)
    arch = Accum()
    if use("arch"):
        build_arch(arch)
        for r in range(4):
            transform_accum(acc, arch, 1, 1, r)

    # 1st-2nd section (one quadrant mirrored)
    mid = Accum()
    if use("mid"):
        build_mid_section(mid)
        for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
            transform_accum(acc, mid, sx, sy)

    if use("shaft"):
        build_shaft(acc)
    if use("decks"):
        build_platforms(acc)
    if use("top"):
        build_top(acc)

    ob = mesh_from_accum("EiffelTower_Steel", acc, steel, paint=True)
    if ARGS.get("debugpts") == "1":
        hits = [v for v in acc.v if abs(v[0]) > 35.0 and 40.0 < v[2] < 58.0]
        hits.sort(key=lambda v: -abs(v[0]))
        print("DBG acc verts_in_region=%d" % len(hits))
        for v in hits[:24]:
            print("    ", tuple(round(c, 2) for c in v))
    return ob


def main():
    scene = clear_scene()
    setup_world(scene)
    setup_sun(scene)
    add_atmosphere()
    if ARGS["ground"] == "1":
        add_people()
        add_ground()
    ob = build_tower()
    print("TOWER verts=%d faces=%d" % (len(ob.data.vertices), len(ob.data.polygons)))

    # cameras
    p = math.radians(90.0 + 16.18)
    classic = make_cam("CamClassic", (0, -324.24, 1.6), rot=(p, 0, 0), lens=59.711,
                       shift_y=float(ARGS["shift"]), shift_x=float(ARGS["shiftx"]))
    hero = make_cam("CamHero", (-320, -460, 60), look=(0, 0, 150), lens=40.0)
    topc = make_cam("CamTop", (-70, -120, 235), look=(0, 0, 282), lens=135.0)
    legc = make_cam("CamLeg", (-150, -170, 6), look=(-20, -20, 62), lens=85.0)
    midc = make_cam("CamMid", (-90, -160, 90), look=(0, 0, 118), lens=110.0)
    cams = dict(classic=classic, hero=hero, top=topc, leg=legc, mid=midc)

    if ARGS["blend"]:
        bpy.ops.wm.save_as_mainfile(filepath=ARGS["blend"])

    mode = ARGS["mode"]
    if mode == "none":
        return
    setup_render(scene, mode)
    scene.camera = cams[ARGS["cam"]]
    out = ARGS["out"] or os.path.join(PROJ, "out", "render.png")
    scene.render.filepath = out
    print("RENDER ->", out)
    bpy.ops.render.render(write_still=True)
    print("DONE")


if __name__ == "__main__":
    main()
