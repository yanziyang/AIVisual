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
    any_r = m.any(axis=1)
    lefts = np.where(any_r, m.argmax(axis=1), -1).astype(np.int32)
    rights = np.where(any_r, W - 1 - m[:, ::-1].argmax(axis=1), -1).astype(np.int32)
    return lefts, rights


for key, fname in (("front", "Xiaomi-Su7-02.png"), ("rear", "Xiaomi-Su7-04.png")):
    a2 = load_pixels(os.path.join(IMG, fname))
    m = np.load(os.path.join(A, f"m2_{key}.npy"))
    l2 = 0.2126 * a2[..., 0] + 0.7152 * a2[..., 1] + 0.0722 * a2[..., 2]
    d2 = m & (l2 < 0.05)
    H2, W2 = m.shape
    lft2, rgt2 = edges_from(m)

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
                if len(rows):
                    cl.append({"x0": i, "x1": j, "cx": (i + j) / 2.0, "bot": int(rows[-1])})
            i = j
        else:
            i += 1
    print(f"{key} tire clusters:", [(round(c['cx'], 1), c['bot']) for c in cl])
    if len(cl) >= 2:
        lw, rw = cl[0], cl[-1]
        gnd2 = max(lw["bot"], rw["bot"])
        cx2 = 0.5 * (lw["cx"] + rw["cx"])
    else:
        widths = np.where((lft2 >= 0) & (rgt2 >= 0), rgt2 - lft2, 0)
        wrow = int(np.argmax(widths))
        cx2 = 0.5 * (lft2[wrow] + rgt2[wrow])
        gnd2 = int(m.any(axis=0).nonzero()[0][-1])

    zrow = (gnd2 - np.arange(H2)).astype(float)
    widths = np.where((lft2 >= 0) & (rgt2 >= 0), rgt2 - lft2, 0).astype(float)
    validw = (zrow > 150) & (zrow < H2)
    wmax = widths[validw].max()
    sk = 1963.0 / wmax
    rows = []
    for r in range(0, H2, 3):
        if lft2[r] < 0:
            continue
        z = (gnd2 - r) * sk
        if z < -40 or z > 1700:
            continue
        rows.append({"z": round(z, 0), "hl": round((cx2 - lft2[r]) * sk, 0),
                     "hr": round((rgt2[r] - cx2) * sk, 0), "row": r})
    roof2 = max(r["z"] for r in rows) if rows else 0
    print(f"{key}: gnd2={gnd2} cx2={cx2:.1f} wmax={wmax:.0f}px sk={sk:.3f} roof={roof2:.0f} nrows={len(rows)}")
    print(f"{key} widths (z:hl/hr):", " ".join(f"{r['z']:.0f}:{r['hl']:.0f}/{r['hr']:.0f}" for r in rows[::5]))
    with open(os.path.join(A, f"car_shape_{key}.json"), "w") as f:
        json.dump({"sk": sk, "gnd_row": int(gnd2), "cx": cx2, "rows": rows}, f, indent=1)

print("FRONTREAR_DONE")
