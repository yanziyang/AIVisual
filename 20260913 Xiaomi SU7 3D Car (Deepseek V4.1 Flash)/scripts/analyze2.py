import bpy, numpy as np, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "Xiaomi-su7-images")
OUT_DIR = os.path.join(ROOT, "analysis")

FILES = {
    "f34": "Xiaomi-Su7-01.png",
    "front": "Xiaomi-Su7-02.png",
    "side": "Xiaomi-Su7-03.png",
    "rear": "Xiaomi-Su7-04.png",
    "f34b": "Xiaomi-Su7-05.png",
}


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


def box_mean(g, r):
    c = np.cumsum(np.cumsum(g, axis=0), axis=1)
    c = np.pad(c, ((1, 0), (1, 0)))
    H, W = g.shape
    y0 = np.clip(np.arange(H) - r, 0, H)
    y1 = np.clip(np.arange(H) + r + 1, 0, H)
    x0 = np.clip(np.arange(W) - r, 0, W)
    x1 = np.clip(np.arange(W) + r + 1, 0, W)
    S = c[np.ix_(y1, x1)] - c[np.ix_(y0, x1)] - c[np.ix_(y1, x0)] + c[np.ix_(y0, x0)]
    N = (y1 - y0)[:, None] * (x1 - x0)[None, :]
    return S / N


def contrast_mask(arr, r=50, thr=0.095):
    rgb = arr[..., :3]
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    bg = box_mean(lum, r)
    diff = lum - bg
    maxc = rgb.max(axis=2)
    minc = rgb.min(axis=2)
    sat = np.where(maxc > 1e-5, (maxc - minc) / np.maximum(maxc, 1e-5), 0)
    m = (np.abs(diff) > thr) | (sat > 0.33)
    return m, sat, lum


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
        m = (m | shift(m, 1, 0) | shift(m, -1, 0) | shift(m, 0, 1) | shift(m, 0, -1))
    return m


def erode(m, n=1):
    for _ in range(n):
        m = (m & shift(m, 1, 0) & shift(m, -1, 0) & shift(m, 0, 1) & shift(m, 0, -1))
    return m


def largest_component_lowres(mask, scale=4):
    from collections import deque
    H, W = mask.shape
    hs, ws = H // scale, W // scale
    small = mask[:hs * scale, :ws * scale].reshape(hs, scale, ws, scale).mean(axis=(1, 3)) > 0.4
    lab = np.zeros((hs, ws), dtype=np.int32)
    best, best_size = 0, 0
    cur = 0
    for sy in range(hs):
        for sx in range(ws):
            if small[sy, sx] and lab[sy, sx] == 0:
                cur += 1
                size = 0
                dq = deque([(sy, sx)])
                lab[sy, sx] = cur
                while dq:
                    y, x = dq.popleft()
                    size += 1
                    for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                        if 0 <= ny < hs and 0 <= nx < ws and small[ny, nx] and lab[ny, nx] == 0:
                            lab[ny, nx] = cur
                            dq.append((ny, nx))
                if size > best_size:
                    best, best_size = cur, size
    keep = lab == best
    up = np.zeros((H, W), dtype=bool)
    up[:hs * scale, :ws * scale] = keep.repeat(scale, axis=0).repeat(scale, axis=1)
    return up


for key, fname in FILES.items():
    arr = load_pixels(os.path.join(IMG_DIR, fname))
    H, W, _ = arr.shape
    m, sat, lum = contrast_mask(arr)
    m = dilate(erode(dilate(m, 2), 2), 1)
    m = largest_component_lowres(m)
    m = (dilate(m, 2) & (m | (np.abs(lum - box_mean(lum, 30)) > 0.03) | (sat > 0.2)))
    for _ in range(3):
        m = m | (erode(dilate(m, 6), 6) & (np.abs(lum - box_mean(lum, 60)) > 0.05))
    m = largest_component_lowres(m)
    np.save(os.path.join(OUT_DIR, f"m2_{key}.npy"), m)

    dbg = arr[..., :3] * 0.35
    dbg[m] = arr[..., :3][m] * 0.65 + 0.35 * np.array([0.0, 0.3, 0.0])
    edge = m & ~shift(m, 1, 0)
    dbg[edge] = [1.0, 0.0, 0.0]
    save_rgb(dbg, os.path.join(OUT_DIR, f"seg2_{key}.png"))
    print(f"{key} done, mask px={int(m.sum())}")

print("ANALYSIS2_DONE")
