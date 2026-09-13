import bpy, numpy as np, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "Xiaomi-su7-images")
OUT_DIR = os.path.join(ROOT, "analysis")
os.makedirs(OUT_DIR, exist_ok=True)

FILES = {
    "f34": "Xiaomi-Su7-01.png",
    "front": "Xiaomi-Su7-02.png",
    "side": "Xiaomi-Su7-03.png",
    "rear": "Xiaomi-Su7-04.png",
    "f34b": "Xiaomi-Su7-05.png",
}

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
only = set(argv) if argv else None


def load_pixels(path):
    img = bpy.data.images.load(path)
    w, h = img.size
    arr = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1]
    bpy.data.images.remove(img)
    return arr


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


def shift(a, dy, dx):
    out = np.empty_like(a)
    src_y = slice(max(0, -dy), a.shape[0] - max(0, dy))
    dst_y = slice(max(0, dy), a.shape[0] - max(0, -dy))
    src_x = slice(max(0, -dx), a.shape[1] - max(0, dx))
    dst_x = slice(max(0, dx), a.shape[1] - max(0, -dx))
    out[dst_y, dst_x] = a[src_y, src_x]
    return out


def dilate(m, n=1):
    for _ in range(n):
        m = (m | shift(m, 1, 0) | shift(m, -1, 0) | shift(m, 0, 1) | shift(m, 0, -1)
             | shift(m, 1, 1) | shift(m, 1, -1) | shift(m, -1, 1) | shift(m, -1, -1))
    return m


def erode(m, n=1):
    for _ in range(n):
        m = (m & shift(m, 1, 0) & shift(m, -1, 0) & shift(m, 0, 1) & shift(m, 0, -1)
             & shift(m, 1, 1) & shift(m, 1, -1) & shift(m, -1, 1) & shift(m, -1, -1))
    return m


def saturation(arr):
    rgb = arr[..., :3]
    maxc = rgb.max(axis=2)
    minc = rgb.min(axis=2)
    return np.where(maxc > 1e-5, (maxc - minc) / np.maximum(maxc, 1e-5), 0)


def bg_flood(arr, scale=4, iters_lo=800, iters_hi=60):
    H, W, _ = arr.shape
    hs, ws = H // scale, W // scale
    small = arr[:hs * scale, :ws * scale, :3].reshape(hs, scale, ws, scale, 3).mean(axis=(1, 3))
    sat_s = saturation(small[..., :3])
    visited = np.zeros((hs, ws), dtype=bool)
    visited[0, :] = visited[-1, :] = visited[:, 0] = visited[:, -1] = True
    for _ in range(iters_lo):
        grow = np.zeros_like(visited)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nb = shift(visited, dy, dx)
            diff = np.abs(small - shift(small, dy, dx)).max(axis=2)
            lowsat = (sat_s < 0.16) & (shift(sat_s, dy, dx) < 0.16)
            eps = np.where(lowsat, 0.075, 0.02)
            grow |= nb & (diff < eps)
        new = grow & ~visited
        if not new.any():
            break
        visited |= new
    up = np.zeros((H, W), dtype=bool)
    up[:hs * scale, :ws * scale] = visited.repeat(scale, axis=0).repeat(scale, axis=1)
    up[0, :] = up[-1, :] = up[:, 0] = up[:, -1] = True
    rgb = arr[..., :3]
    sat = saturation(arr)
    for _ in range(iters_hi):
        grow = np.zeros_like(up)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nb = shift(up, dy, dx)
            diff = np.abs(rgb - shift(rgb, dy, dx)).max(axis=2)
            lowsat = (sat < 0.20) & (shift(sat, dy, dx) < 0.20)
            eps = np.where(lowsat, 0.09, 0.025)
            grow |= nb & (diff < eps)
        new = grow & ~up
        if not new.any():
            break
        up |= new
    return up


def col_edges(mask):
    H, W = mask.shape
    any_c = mask.any(axis=0)
    tops = np.where(any_c, mask.argmax(axis=0), -1).astype(np.int32)
    bots = np.where(any_c, H - 1 - mask[::-1].argmax(axis=0), -1).astype(np.int32)
    return tops, bots


def row_edges(mask):
    H, W = mask.shape
    any_r = mask.any(axis=1)
    lefts = np.where(any_r, mask.argmax(axis=1), -1).astype(np.int32)
    rights = np.where(any_r, W - 1 - mask[:, ::-1].argmax(axis=1), -1).astype(np.int32)
    return lefts, rights


report = {}
for key, fname in FILES.items():
    if only and key not in only:
        continue
    arr = load_pixels(os.path.join(IMG_DIR, fname))
    H, W, _ = arr.shape
    bg = bg_flood(arr)
    car = ~bg
    car = erode(car, 1) | (car & dilate(car, 1))  # knock speckles
    car = dilate(erode(car, 1), 1)
    car = car | (erode(dilate(car, 3), 3))        # close small holes

    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    maxc = np.maximum(np.maximum(r, g), b)
    minc = np.minimum(np.minimum(r, g), b)
    sat = np.where(maxc > 1e-5, (maxc - minc) / np.maximum(maxc, 1e-5), 0)
    val = maxc

    tops, bots = col_edges(car)
    lefts, rights = row_edges(car)
    valid = tops >= 0
    info = {"file": fname, "w": W, "h": H}
    if valid.sum() > 10:
        x0, x1 = int(np.flatnonzero(valid)[0]), int(np.flatnonzero(valid)[-1])
        gy = int(bots[valid].max())
        info.update(bbox_x=[x0, x1], ground_row=gy, length_px=x1 - x0,
                    height_px=gy - int(tops[valid].min()))
    report[key] = info

    dbg = arr[..., :3] * 0.30
    dbg[car] = arr[..., :3][car] * 0.6
    edge = car & ~shift(car, 1, 0)
    dbg[edge] = [1.0, 0.0, 0.0]
    save_rgb(dbg, os.path.join(OUT_DIR, f"seg_{key}.png"))

    teal = car & (sat > 0.35) & (val > 0.45)
    if teal.sum() > 50:
        px = arr[teal][:, :3]
        info["paint_mean"] = [round(float(c), 3) for c in px.mean(axis=0)]
        info["paint_med"] = [round(float(c), 3) for c in np.median(px, axis=0)]

    if key == "side" and valid.sum() > 10:
        x0, x1 = info["bbox_x"]
        gy = info["ground_row"]
        dark = car & (val < 0.22)
        np.save(os.path.join(OUT_DIR, "side_tops.npy"), tops)
        np.save(os.path.join(OUT_DIR, "side_bots.npy"), bots)
        np.save(os.path.join(OUT_DIR, "side_car.npy"), car)
        np.save(os.path.join(OUT_DIR, "side_dark.npy"), dark)
        print(f"side: bbox=({x0},{x1}) ground={gy} len={x1-x0} height={info['height_px']}")
    if key in ("front", "rear") and (lefts >= 0).sum() > 10:
        np.save(os.path.join(OUT_DIR, f"{key}_lefts.npy"), lefts)
        np.save(os.path.join(OUT_DIR, f"{key}_rights.npy"), rights)
        np.save(os.path.join(OUT_DIR, f"{key}_car.npy"), car)
        rc = np.where(maxc > 1e-5, (maxc - r) / np.maximum(maxc - minc, 1e-5), 0)
        gc = np.where(maxc > 1e-5, (maxc - g) / np.maximum(maxc - minc, 1e-5), 0)
        bc = np.where(maxc > 1e-5, (maxc - b) / np.maximum(maxc - minc, 1e-5), 0)
        hh = np.where(r == maxc, bc - gc, np.where(g == maxc, 2 + rc - bc, 4 + gc - rc))
        hue = (hh / 6.0) % 1.0
        yellow = car & (sat > 0.45) & (val > 0.4) & (hue > 0.08) & (hue < 0.18)
        if yellow.sum() > 20:
            info["caliper"] = [round(float(c), 3) for c in arr[yellow][:, :3].mean(axis=0)]
        print(f"{key}: bbox_x={info['bbox_x']} ground={info['ground_row']} len={info['length_px']} height={info['height_px']} caliper_n={int(yellow.sum())}")

    print(f"{key} done")

with open(os.path.join(OUT_DIR, "report.json"), "w") as f:
    json.dump(report, f, indent=1)
print("ANALYSIS_DONE")
