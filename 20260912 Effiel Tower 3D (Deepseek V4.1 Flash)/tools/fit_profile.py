import math

TSV = r"C:\MyProjects\TempProject\eiffel\refs\silhouette.tsv"
OUT = r"C:\MyProjects\TempProject\eiffel\refs\profile_from_photo.tsv"

# Features identified in the photo (near-edge silhouette extremes):
# (Z m, o m half-width of feature, observed row y px, observed half-width px)
OBS = [
    (330.00, 0.0, 224.0, None),
    (276.13, 8.0, 508.0, 71.5),
    (115.73, 18.95, 1780.0, 204.0),
    (57.63, 35.85, 2258.0, 387.5),
]
HC = 1.6  # camera height


def project(Z, o, f, D, th, cy):
    rx, ry, rz = o, D - o, Z - HC
    ct, st = math.cos(th), math.sin(th)
    depth = ry * ct + rz * st
    vert = -ry * st + rz * ct
    u = f * rx / depth
    v = cy - f * vert / depth
    return u, v


def loss(p):
    f, D, th, cy = p
    L = 0.0
    for (Z, o, v_obs, hw_obs) in OBS:
        u, v = project(Z, o, f, D, th, cy)
        L += ((v - v_obs) / 8.0) ** 2
        if hw_obs is not None:
            L += 4.0 * ((u - hw_obs) / 8.0) ** 2
    return L


p = [5600.0, 600.0, 0.20, 2700.0]
step = [800.0, 300.0, 0.08, 150.0]
for it in range(4000):
    improved = False
    for i in range(4):
        for s in (1.0, -1.0):
            q = p[:]
            q[i] += s * step[i]
            if q[1] > 50.0 and loss(q) < loss(p):
                p = q
                improved = True
    if not improved:
        step = [s * 0.5 for s in step]
        if max(step) < 1e-7:
            break

f, D, th, cy = p
print("FIT f=%.2f D=%.2f pitch=%.4f rad (%.2f deg) cy=%.2f loss=%.4f"
      % (f, D, th, math.degrees(th), cy, loss(p)))
for (Z, o, v_obs, hw_obs) in OBS:
    u, v = project(Z, o, f, D, th, cy)
    print("  Z=%.1f o=%.1f  v: pred %.1f obs %.1f | hw: pred %.1f obs %s"
          % (Z, o, v, v_obs, u, str(hw_obs)))
# ground check
u, v = project(0.0, 62.5, f, D, th, cy)
print("ground near corner: row=%.1f hw=%.1f" % (v, u))
print("BLENDER lens=%.3f shift_y=%.5f  (res 1920x3198)"
      % (f / 1920.0 * 36.0, (cy - 1599.5) / 1920.0))


def solve_Z(v_target, o):
    lo, hi = -5.0, 340.0
    for _ in range(80):
        mid = 0.5 * (lo + hi)
        _, v = project(mid, o, f, D, th, cy)
        if v > v_target:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


rows = []
with open(TSV, "r", encoding="utf-8") as fh:
    for line in fh:
        parts = line.strip().split("\t")
        if len(parts) != 5 or not parts[0].isdigit():
            continue
        y, xmin, xmax, w, cnt = (int(x) for x in parts)
        if w <= 0 or cnt <= 0:
            continue
        if y < 230 or y > 2700:
            continue
        center = 0.5 * (xmin + xmax)
        if abs(center - 945.5) > 10:
            continue
        hw = 0.5 * w
        # iterate: Z from axis projection, then refine with near-edge depth
        Z = solve_Z(y, 0.0)
        o = 0.0
        for _ in range(4):
            Z = solve_Z(y, o)
            ct, st = math.cos(th), math.sin(th)
            base = D * ct + (Z - HC) * st
            o = hw * base / (f + hw * ct)
        rows.append((y, hw, Z, o))

rows.sort(key=lambda r: r[2])
print("clean rows:", len(rows))
with open(OUT, "w", encoding="utf-8") as fh:
    fh.write("y\thalf_px\tZ\to_halfwidth_m\n")
    for y, hw, Z, o in rows:
        fh.write("%d\t%.2f\t%.3f\t%.3f\n" % (y, hw, Z, o))

# print a decimated table with a running envelope (avoid noise)
print("Z(m)\to(m)  (envelope of nearby rows)")
last = -100.0
for y, hw, Z, o in rows:
    if Z - last >= 5.0 and Z >= 0:
        print("%7.1f\t%6.2f" % (Z, o))
        last = Z
