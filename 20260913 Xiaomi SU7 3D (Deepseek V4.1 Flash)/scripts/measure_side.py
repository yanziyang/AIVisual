import numpy as np, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "analysis")

car = np.load(os.path.join(A, "side_car.npy"))
tops = np.load(os.path.join(A, "side_tops.npy")).astype(np.int32)
bots = np.load(os.path.join(A, "side_bots.npy")).astype(np.int32)
H, W = car.shape

# clean: per-column keep only runs >= 4px
cc = car.copy()
for x in range(W):
    idx = np.flatnonzero(car[:, x])
    if len(idx) == 0:
        continue
    d = np.diff(idx)
    splits = np.flatnonzero(d > 1)
    starts = np.concatenate(([0], splits + 1))
    ends = np.concatenate((splits, [len(idx) - 1]))
    keep = np.zeros(len(idx), dtype=bool)
    for s0, e0 in zip(starts, ends):
        if e0 - s0 + 1 >= 4:
            keep[s0:e0 + 1] = True
    cc[idx[~keep], x] = False

colcount = cc.sum(axis=0)
xs = np.flatnonzero(colcount >= 12)
x0, x1 = int(xs[0]), int(xs[-1])
colcount[:x0] = 0
colcount[x1 + 1:] = 0
cc[:, :x0] = False
cc[:, x1 + 1:] = False

tops2 = np.where(cc.any(axis=0), cc.argmax(axis=0), -1)
bots2 = np.where(cc.any(axis=0), H - 1 - cc[::-1].argmax(axis=0), -1)
valid = tops2 >= 0
gy_body = int(bots2[valid].max())

# image colors for beltline
import bpy
img = bpy.data.images.load(os.path.join(ROOT, "Xiaomi-su7-images", "Xiaomi-Su7-03.png"))
w, h = img.size
arr = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1]
bpy.data.images.remove(img)
rgb = arr[..., :3]
maxc = rgb.max(axis=2)
minc = rgb.min(axis=2)
sat = np.where(maxc > 1e-5, (maxc - minc) / np.maximum(maxc, 1e-5), 0)
val = maxc
teal = (sat > 0.35) & (val > 0.30) & cc

# bottom edge profile
bx = np.flatnonzero(valid)
top_prof = np.full(W, -1, dtype=np.int32)
bot_prof = np.full(W, -1, dtype=np.int32)
top_prof[bx] = tops2[bx]
bot_prof[bx] = bots2[bx]

# sill line = median bottom edge in mid region between wheels
mid = (x0 + x1) // 2
sill_vals = bot_prof[mid - 60:mid + 60]
sill_vals = sill_vals[sill_vals > 0]
sill_row = int(np.median(sill_vals))

# arch detection: columns where bottom edge rises > 6px above sill
arch_cols = np.flatnonzero((bot_prof > 0) & (bot_prof < sill_row - 6))
clusters = []
if len(arch_cols):
    start = arch_cols[0]
    prev = arch_cols[0]
    for c in arch_cols[1:]:
        if c - prev > 12:
            clusters.append((start, prev))
            start = c
        prev = c
    clusters.append((start, prev))
clusters = [c for c in clusters if c[1] - c[0] > 60]
print("arch clusters:", clusters)

def fit_circle(pts):
    x = pts[:, 0].astype(np.float64)
    y = pts[:, 1].astype(np.float64)
    A_ = np.c_[2 * x, 2 * y, np.ones(len(x))]
    b_ = x ** 2 + y ** 2
    sol, *_ = np.linalg.lstsq(A_, b_, rcond=None)
    cx, cy = sol[0], sol[1]
    r = np.sqrt(sol[2] + cx ** 2 + cy ** 2)
    return cx, cy, r

arches = []
for (ca, cb) in clusters:
    pts = np.array([[x, bot_prof[x]] for x in range(ca, cb + 1) if bot_prof[x] > 0])
    if len(pts) < 20:
        continue
    # sample inner 70% to avoid transition tails
    m = int(len(pts) * 0.15)
    cx, cy, r = fit_circle(pts[m:-m])
    arches.append({"x0": int(ca), "x1": int(cb), "cx": float(cx), "cy": float(cy), "r": float(r)})
    print(f"arch x[{ca},{cb}] center=({cx:.1f},{cy:.1f}) r={r:.1f}")

if len(arches) == 2:
    wb_px = abs(arches[1]["cx"] - arches[0]["cx"])
    mm_px = 3000.0 / wb_px
    cx_mid = 0.5 * (arches[0]["cx"] + arches[1]["cx"])
    ground_row = 0.5 * (arches[0]["cy"] + arches[1]["cy"]) + 351.5 / mm_px
elif len(arches) == 1:
    mm_px = 703.0 / (2 * arches[0]["r"])
    cx_mid = arches[0]["cx"]
    ground_row = arches[0]["cy"] + 351.5 / mm_px
else:
    raise SystemExit("no arches found")

print(f"mm_per_px={mm_px:.3f}  car_len={ (x1-x0)*mm_px:.0f}mm  body_height={(ground_row - tops2[valid].min())*mm_px:.0f}mm")

def to_mm_x(px):
    return (px - cx_mid) * mm_px

def to_mm_z(row):
    return (ground_row - row) * mm_px

# sample profiles every 4 px
step = 4
prof = []
for x in range(x0, x1 + 1, step):
    if top_prof[x] > 0:
        prof.append({
            "y": round(to_mm_x(x), 1),
            "top": round(to_mm_z(top_prof[x]), 1),
            "bot": round(to_mm_z(bot_prof[x]), 1),
        })

# beltline: for cabin columns find first bright teal row from top
belt = []
for x in range(x0, x1 + 1, step):
    if top_prof[x] < 0:
        continue
    z0 = top_prof[x]
    if to_mm_z(z0) > 1150:  # only cabin region columns (top high)
        col_teal = teal[:, x]
        idx = np.flatnonzero(col_teal)
        if len(idx):
            first = idx[0]
            if first - z0 < 260:  # glass region reasonably thick
                belt.append({"y": round(to_mm_x(x), 1), "belt_z": round(to_mm_z(first), 1)})

out = {
    "mm_per_px": mm_px,
    "cx_mid_px": cx_mid,
    "ground_row": ground_row,
    "x0_px": x0, "x1_px": x1,
    "car_len_mm": (x1 - x0) * mm_px,
    "body_height_mm": (ground_row - tops2[valid].min()) * mm_px,
    "sill_row": sill_row,
    "sill_z_mm": to_mm_z(sill_row),
    "arches": arches,
    "profile": prof,
    "beltline": belt,
}
# arch in mm
for a in arches:
    a["cx_mm"] = (a["cx"] - cx_mid) * mm_px
    a["cy_mm"] = to_mm_z(a["cy"])
    a["r_mm"] = a["r"] * mm_px
with open(os.path.join(A, "side_measure.json"), "w") as f:
    json.dump(out, f, indent=1)

print("TOP profile (y_mm: z_mm):")
print("  " + "  ".join(f"{p['y']:.0f}:{p['top']:.0f}" for p in prof[::6]))
print("BOT profile (y_mm: z_mm):")
print("  " + "  ".join(f"{p['y']:.0f}:{p['bot']:.0f}" for p in prof[::6]))
print("BELTLINE (y_mm: z_mm):")
print("  " + "  ".join(f"{p['y']:.0f}:{p['belt_z']:.0f}" for p in belt[::3]))
for a in arches:
    print(f"ARCH mm: center=({a['cx_mm']:.0f},{a['cy_mm']:.0f}) r={a['r_mm']:.0f}")
print("MEASURE_DONE")
