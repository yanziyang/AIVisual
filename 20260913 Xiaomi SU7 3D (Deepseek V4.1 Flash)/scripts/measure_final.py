import bpy, numpy as np, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "analysis")
IMG = os.path.join(ROOT, "Xiaomi-su7-images")


def load_pixels(path):
    img = bpy.data.images.load(path)
    w, h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1]
    bpy.data.images.remove(img)
    return a


def edges_from(m):
    H, W = m.shape
    any_c = m.any(axis=0)
    tops = np.where(any_c, m.argmax(axis=0), -1).astype(np.int32)
    bots = np.where(any_c, H - 1 - m[::-1].argmax(axis=0), -1).astype(np.int32)
    any_r = m.any(axis=1)
    lefts = np.where(any_r, m.argmax(axis=1), -1).astype(np.int32)
    rights = np.where(any_r, W - 1 - m[:, ::-1].argmax(axis=1), -1).astype(np.int32)
    return tops, bots, lefts, rights


# ---- SIDE ----
arr = load_pixels(os.path.join(IMG, "Xiaomi-Su7-03.png"))
m2 = np.load(os.path.join(A, "m2_side.npy"))
car = np.load(os.path.join(A, "side_car.npy"))
H, W = m2.shape

FRONT_CX, REAR_CX = 262.5, 883.0
X_MM = 3000.0 / (REAR_CX - FRONT_CX)     # 4.8387
FLOOD_GROUND = 332

# clean flood mask
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

tops_f, bots_f, _, _ = edges_from(cc)
tops_m, bots_m, _, _ = edges_from(m2)

# ground row from tires
rgb = arr[..., :3]
lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
maxc = rgb.max(axis=2)
minc = rgb.min(axis=2)
sat = np.where(maxc > 1e-5, (maxc - minc) / np.maximum(maxc, 1e-5), 0)
dark = m2 & (lum < 0.05)
gnd = 0
for (a_, b_) in ((170, 355), (790, 975)):
    rows = np.flatnonzero(dark[:, a_:b_].sum(axis=1) > 3)
    gnd = max(gnd, int(rows[-1])) if len(rows) else gnd
print("ground row (tires):", gnd)

valid = tops_f >= 0
x0, x1 = int(np.flatnonzero(valid)[0]), int(np.flatnonzero(valid)[-1])

# roof top from m2 in cabin range (exclude LiDAR pod x-window ~470-540 if it pokes)
cabin_cols = np.arange(320, 850)
roof_rows = [tops_m[c] for c in cabin_cols if tops_m[c] >= 0]
roof_row = int(np.percentile(roof_rows, 2))
top_row_global = int(min(roof_rows))
print("roof row:", roof_row, "top(min incl pod):", top_row_global)

Z_MM = 1455.0 / (gnd - roof_row)
print(f"X_MM={X_MM:.4f} Z_MM={Z_MM:.4f}  tire_d_px={ (gnd-roof_row)} roof_px")

def to_y(px):
    return (FRONT_CX - px) * X_MM + 1500.0

def to_z(row):
    return (gnd - row) * Z_MM

# body side top from flood mask (paint silhouette ~ true roofline incl glass top edge is dark; use m2 where better)
top_edge = np.where(tops_m >= 0, tops_m, tops_f)
bot_edge = tops_f  # bottom from flood mask (sill/arch, no tires/shadow)
prof = []
for x in range(0, W):
    if tops_f[x] < 0:
        continue
    prof.append({
        "y": round(to_y(x), 1),
        "top": round(to_z(top_edge[x]), 1),
        "bot": round(to_z(bots_f[x]), 1),
        "top_flood": round(to_z(tops_f[x]), 1),
    })

# beltline from teal boundary
teal = (sat > 0.35) & (lum > 0.28) & m2
belt = []
for x in range(0, W):
    if tops_f[x] < 0 or to_z(tops_f[x]) < 1150:
        continue
    idx = np.flatnonzero(teal[:, x])
    if len(idx) and idx[0] - tops_f[x] < 300:
        belt.append({"y": round(to_y(x), 1), "z": round(to_z(idx[0]), 1)})

# front/rear tips from m2 (includes black bumpers), limited to body rows
body_rows = m2[:gnd + 6, :]
xs_m = np.flatnonzero(body_rows.sum(axis=0) >= 8)
tip_front_px, tip_rear_px = int(xs_m[0]), int(xs_m[-1])
print("tips px:", tip_front_px, tip_rear_px, "-> y:", round(to_y(tip_front_px), 1), round(to_y(tip_rear_px), 1))

out = {
    "X_MM": X_MM, "Z_MM": Z_MM, "ground_row": gnd, "roof_row": roof_row,
    "front_axle_px": FRONT_CX, "rear_axle_px": REAR_CX,
    "profile": prof, "beltline": belt,
}
with open(os.path.join(A, "car_shape_side.json"), "w") as f:
    json.dump(out, f, indent=1)

print("\nTOP (y:z):", " ".join(f"{p['y']:.0f}:{p['top']:.0f}" for p in prof[::10]))
print("\nBOT (y:z):", " ".join(f"{p['y']:.0f}:{p['bot']:.0f}" for p in prof[::10]))
print("\nBELT (y:z):", " ".join(f"{p['y']:.0f}:{p['z']:.0f}" for p in belt[::6]))

# ---- FRONT / REAR width profiles ----
for key, fname in (("front", "Xiaomi-Su7-02.png"), ("rear", "Xiaomi-Su7-04.png")):
    a2 = load_pixels(os.path.join(IMG, fname))
    m = np.load(os.path.join(A, f"m2_{key}.npy"))
    l2 = 0.2126 * a2[..., 0] + 0.7152 * a2[..., 1] + 0.0722 * a2[..., 2]
    d2 = m & (l2 < 0.05)
    H2, W2 = m.shape
    gnd2 = 0
    for (aa, bb) in ((np.array([0]), np.array([W2]))):
        pass
    # tire windows: leftmost/rightmost dark clusters in bottom half
    band = np.zeros_like(d2)
    band[H2 // 2:, :] = True
    cnt = (d2 & band).sum(axis=0)
    inc = cnt > 5
    cl = []
    i = 0
    while i < W2:
        if inc[i]:
            j = i
            while j < W2 and inc[j]:
                j += 1
            if j - i > 15:
                sub = d2[:, i:j]
                rows = np.flatnonzero(sub.sum(axis=1) > 2)
                cl.append({"x0": i, "x1": j, "cx": (i + j) / 2, "bot": int(rows[-1])})
            i = j
        else:
            i += 1
    t2, b2, lft2, rgt2 = edges_from(m)
    if len(cl) >= 2:
        lw, rw = cl[0], cl[-1]
        gnd2 = max(lw["bot"], rw["bot"])
        cx2 = 0.5 * (lw["cx"] + rw["cx"])
    else:
        wrow = int(np.argmax(np.where(rgt2 >= 0, rgt2 - lft2, 0)))
        cx2 = 0.5 * (lft2[wrow] + rgt2[wrow])
        gnd2 = int(b2[b2 >= 0].max())
    # width scale: max full width = 1963 (exclude mirror rows via z>1050 filter later)
    widths = np.where((lft2 >= 0) & (rgt2 >= 0), rgt2 - lft2, 0)
    zrow = np.array([(gnd2 - r) * 1.0 for r in range(H2)])
    widths_f = np.where((zrow > 150) & (zrow < H2), widths, 0)  # below mirrors
    wmax = widths_f.max()
    sk = 1963.0 / wmax
    rows = []
    for r in range(0, H2, 3):
        if lft2[r] < 0:
            continue
        z = (gnd2 - r) * sk
        if z < -50 or z > 1600:
            continue
        rows.append({"z": round(z, 0), "hl": round((cx2 - lft2[r]) * sk, 0), "hr": round((rgt2[r] - cx2) * sk, 0)})
    roof2 = max(r["z"] for r in rows) if rows else 0
    print(f"\n{key}: gnd2={gnd2} cx2={cx2:.1f} wmax={wmax}px sk={sk:.3f} roof={roof2:.0f} clusters={len(cl)}")
    print(f"{key} widths (z:hl/hr):", " ".join(f"{r['z']:.0f}:{r['hl']:.0f}/{r['hr']:.0f}" for r in rows[::6]))
    with open(os.path.join(A, f"car_shape_{key}.json"), "w") as f:
        json.dump({"sk": sk, "gnd_row": int(gnd2), "cx": cx2, "rows": rows}, f, indent=1)

print("MEASURE_FINAL_DONE")
