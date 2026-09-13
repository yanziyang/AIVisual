import math

SPANS = r"C:\MyProjects\TempProject\eiffel\out\spans.tsv"
REF_SIL = r"C:\MyProjects\TempProject\eiffel\refs\silhouette.tsv"

F = 3184.57
D = 324.24
TH = 0.2824
CY = 1992.52
CX = 960.0
HC = 1.6


def project(Z, o, y_off=0.0):
    rx, ry, rz = o, D - o, Z - HC
    ct, st = math.cos(TH), math.sin(TH)
    depth = ry * ct + rz * st
    vert = -ry * st + rz * ct
    return CX + F * rx / depth, CY - F * vert / depth, depth


def solve_z(v_target, o):
    lo, hi = -5.0, 340.0
    for _ in range(60):
        mid = 0.5 * (lo + hi)
        _, v, _ = project(mid, o)
        if v > v_target:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


def invert(row, half_px):
    # returns (Z, o)
    z = solve_z(row, 0.0)
    o = 0.0
    for _ in range(5):
        z = solve_z(row, o)
        ct, st = math.cos(TH), math.sin(TH)
        base = D * ct + (z - HC) * st
        o = half_px * base / (F + half_px * ct)
    return z, o


def load_spans(path, col):
    rows = {}
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            p = line.strip().split("\t")
            if len(p) < 3 or not p[0].isdigit():
                continue
            if int(p[col]) <= 0:
                continue
            rows[int(p[0])] = int(p[col])
    return rows


def clean_ref(path):
    # use the more careful ref scan (symmetric filter)
    rows = {}
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            p = line.strip().split("\t")
            if len(p) != 5 or not p[0].isdigit():
                continue
            y, xmin, xmax, w, cnt = (int(x) for x in p)
            if w <= 0 or cnt <= 0:
                continue
            c = 0.5 * (xmin + xmax)
            if abs(c - 945.5) > 10:
                continue
            rows[y] = w
    return rows


span_rows = {}
with open(SPANS, "r", encoding="utf-8") as fh:
    for line in fh:
        p = line.strip().split("\t")
        if len(p) < 3 or not p[0].isdigit():
            continue
        span_rows[int(p[0])] = (int(p[1]), int(p[2]))

ref_rows = clean_ref(REF_SIL)
# build z -> ref o curve
ref_curve = []
for y, w in sorted(ref_rows.items()):
    if w <= 0:
        continue
    z, o = invert(y, 0.5 * w)
    if 0 <= z <= 305:
        ref_curve.append((z, o))
ref_curve.sort(key=lambda t: t[0])

ren_curve = []
for y, (rs, ns) in sorted(span_rows.items()):
    if ns > 0:
        z, o = invert(y, 0.5 * ns)
        if 0 <= z <= 340:
            ren_curve.append((z, o))
ren_curve.sort(key=lambda t: t[0])


def interp(curve, z):
    lo = None
    for (zz, oo) in curve:
        if zz >= z:
            hi = (zz, oo)
            if lo is None:
                return hi[1]
            t = (z - lo[0]) / (hi[0] - lo[0] + 1e-9)
            return lo[1] + (hi[1] - lo[1]) * t
        lo = (zz, oo)
    return None


print("Z(m)\tref_o\tren_o\tdiff")
for z in [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 57.6, 60, 65, 70, 75, 80, 85,
          90, 95, 100, 105, 110, 115, 120, 130, 140, 150, 160, 170, 180, 190, 200,
          210, 220, 230, 240, 250, 260, 270, 276]:
    ro = interp(ref_curve, z)
    no = interp(ren_curve, z)
    if ro is None or no is None:
        continue
    print("%6.1f\t%6.2f\t%6.2f\t%+6.2f" % (z, ro, no, no - ro))
