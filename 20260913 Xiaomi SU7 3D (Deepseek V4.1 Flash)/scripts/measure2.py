import bpy, numpy as np, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "analysis")
IMG = os.path.join(ROOT, "Xiaomi-su7-images")


def load_pixels(path):
    img = bpy.data.images.load(path)
    w, h = img.size
    arr = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1]
    bpy.data.images.remove(img)
    return arr


def lum_of(arr):
    rgb = arr[..., :3]
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def sat_of(arr):
    rgb = arr[..., :3]
    maxc = rgb.max(axis=2)
    minc = rgb.min(axis=2)
    return np.where(maxc > 1e-5, (maxc - minc) / np.maximum(maxc, 1e-5), 0)


def tire_blobs(m2, lum, dark_thr=0.085, min_cols=25):
    H, W = m2.shape
    dark = m2 & (lum < dark_thr)
    colcnt = dark.sum(axis=0)
    clusters = []
    i = 0
    while i < W:
        if colcnt[i] > 3:
            j = i
            while j < W and colcnt[j] > 3:
                j += 1
            if j - i > min_cols:
                sub = dark[:, i:j]
                rows = np.flatnonzero(sub.sum(axis=1) > 3)
                cx = i + 0.5 * (j - i)
                cy = 0.5 * (rows[0] + rows[-1]) if len(rows) else 0
                clusters.append({"x0": i, "x1": j, "cx": cx, "top": int(rows[0]), "bot": int(rows[-1]), "cy": cy})
            i = j
        else:
            i += 1
    return clusters


def edges_from_mask(m):
    H, W = m.shape
    any_c = m.any(axis=0)
    tops = np.where(any_c, m.argmax(axis=0), -1).astype(np.int32)
    bots = np.where(any_c, H - 1 - m[::-1].argmax(axis=0), -1).astype(np.int32)
    any_r = m.any(axis=1)
    lefts = np.where(any_r, m.argmax(axis=1), -1).astype(np.int32)
    rights = np.where(any_r, W - 1 - m[:, ::-1].argmax(axis=1), -1).astype(np.int32)
    return tops, bots, lefts, rights


# ---------------- SIDE ----------------
arr = load_pixels(os.path.join(IMG, "Xiaomi-Su7-03.png"))
m2 = np.load(os.path.join(A, "m2_side.npy"))
car_flood = np.load(os.path.join(A, "side_car.npy"))
lum = lum_of(arr)
sat = sat_of(arr)

blobs = tire_blobs(m2, lum)
print("side tire blobs:", [(round(b["cx"], 1), b["top"], b["bot"]) for b in blobs])
front_b, rear_b = blobs[0], blobs[-1]
wb_px = abs(rear_b["cx"] - front_b["cx"])
mm_px = 3000.0 / wb_px
cx_mid = 0.5 * (front_b["cx"] + rear_b["cx"])
ground_row = max(front_b["bot"], rear_b["bot"])
print(f"wb_px={wb_px:.1f} mm_px={mm_px:.4f} ground_row={ground_row}")

# clean flood mask columns
H, W = car_flood.shape
cc = car_flood.copy()
for x in range(W):
    idx = np.flatnonzero(car_flood[:, x])
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

tops_f, bots_f, _, _ = edges_from_mask(cc)
valid = tops_f >= 0
x0, x1 = int(np.flatnonzero(valid)[0]), int(np.flatnonzero(valid)[-1])


def to_mm_x(px):
    return (px - cx_mid) * mm_px


def to_px_y(y_mm):
    return cx_mid + y_mm / mm_px


def to_mm_z(row):
    return (ground_row - row) * mm_px


body_top_min = int(tops_f[valid].min())

teal = (sat > 0.35) & (lum > 0.28) & m2

step = 4
prof, belt = [], []
for x in range(x0, x1 + 1, step):
    if tops_f[x] < 0:
        continue
    prof.append({"y": round(to_mm_x(x), 1), "top": round(to_mm_z(tops_f[x]), 1), "bot": round(to_mm_z(bots_f[x]), 1)})
    if to_mm_z(tops_f[x]) > 1150:
        idx = np.flatnonzero(teal[:, x])
        if len(idx) and idx[0] - tops_f[x] < 280:
            belt.append({"y": round(to_mm_x(x), 1), "belt_z": round(to_mm_z(idx[0]), 1)})

side = {
    "mm_px": mm_px, "cx_mid": cx_mid, "ground_row": ground_row,
    "car_front_y": round(to_mm_x(x0), 1), "car_rear_y": round(to_mm_x(x1), 1),
    "car_len_mm": round((x1 - x0) * mm_px, 1),
    "roof_top_mm": round(to_mm_z(body_top_min), 1),
    "wheels": [
        {"y": round(to_mm_x(front_b["cx"]), 1), "r": 351.5},
        {"y": round(to_mm_x(rear_b["cx"]), 1), "r": 351.5},
    ],
    "profile": prof, "beltline": belt,
}

# wheel crop for design reference
fx = int(front_b["cx"])
fy = int(front_b["cy"])
half = 130
crop = arr[max(0, fy - half):fy + half, max(0, fx - half):fx + half, :3]
def save_rgb(a, path):
    h, w, _ = a.shape
    img = bpy.data.images.new("dbg", width=w, height=h, alpha=False)
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[..., :3] = np.clip(a, 0, 1)[::-1]
    img.pixels = rgba.ravel()
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)
save_rgb(crop, os.path.join(A, "wheel_crop.png"))

# colors in wheel zone
from math import atan2
yy, xx = np.mgrid[0:H, 0:W]
dist = np.sqrt((xx - front_b["cx"]) ** 2 + (yy - front_b["cy"].astype(float)) ** 2)
zone = dist < 120
gold = zone & (sat > 0.45) & (lum > 0.30)
if gold.sum() > 10:
    side["caliper_rgb"] = [round(float(c), 3) for c in arr[gold][:, :3].mean(axis=0)]
    side["caliper_n"] = int(gold.sum())
rim = zone & (sat < 0.18) & (lum > 0.55)
if rim.sum() > 10:
    side["rim_rgb"] = [round(float(c), 3) for c in arr[rim][:, :3].mean(axis=0)]
tire = zone & (lum < 0.06)
if tire.sum() > 10:
    side["tire_rgb"] = [round(float(c), 3) for c in arr[tire][:, :3].mean(axis=0)]

with open(os.path.join(A, "side_measure.json"), "w") as f:
    json.dump(side, f, indent=1)
print("SIDE:", {k: side[k] for k in ("car_len_mm", "roof_top_mm", "car_front_y", "car_rear_y") if k in side})
print("wheels:", side["wheels"])
print("caliper:", side.get("caliper_rgb"), "rim:", side.get("rim_rgb"), "tire:", side.get("tire_rgb"))

# ---------------- FRONT / REAR ----------------
for key, fname, track in (("front", "Xiaomi-Su7-02.png", 1693.0), ("rear", "Xiaomi-Su7-04.png", 1699.0)):
    a2 = load_pixels(os.path.join(IMG, fname))
    m = np.load(os.path.join(A, f"m2_{key}.npy"))
    l2 = lum_of(a2)
    blobs2 = tire_blobs(m, l2, dark_thr=0.085, min_cols=18)
    if len(blobs2) < 2:
        blobs2 = tire_blobs(m, l2, dark_thr=0.11, min_cols=18)
    print(f"{key} blobs:", [(round(b["cx"], 1), b["top"], b["bot"]) for b in blobs2])
    if len(blobs2) >= 2:
        left_b, right_b = blobs2[0], blobs2[-1]
        track_px = right_b["cx"] - left_b["cx"]
        mm2 = track / track_px
        cx2 = 0.5 * (left_b["cx"] + right_b["cx"])
        gy = max(left_b["bot"], right_b["bot"])
    else:
        # fallback: widest row = fenders
        t2, b2, lft2, rgt2 = edges_from_mask(m)
        wrow = np.argmax(np.where(rgt2 >= 0, rgt2 - lft2, 0))
        mm2 = 1963.0 / (rgt2[wrow] - lft2[wrow])
        cx2 = 0.5 * (lft2[wrow] + rgt2[wrow])
        gy = int(b2[b2 >= 0].max())
    t2, b2, lft2, rgt2 = edges_from_mask(m)
    rowprof = []
    for row in range(0, m.shape[0], 3):
        if lft2[row] < 0:
            continue
        rowprof.append({
            "z": round((gy - row) * mm2, 0),
            "hl": round((cx2 - lft2[row]) * mm2, 0),
            "hr": round((rgt2[row] - cx2) * mm2, 0),
        })
    out = {"mm_px": mm2, "ground_row": int(gy), "track_px": round(track, 1), "rows": rowprof,
           "roof_top_mm": round(max((gy - t2[t2 >= 0].min()) * mm2, 0), 0)}
    with open(os.path.join(A, f"{key}_measure.json"), "w") as f:
        json.dump(out, f, indent=1)
    print(f"{key}: mm_px={mm2:.4f} track_px={track:.1f} gy={gy} roof={out['roof_top_mm']:.0f}")

print("MEASURE2_DONE")
