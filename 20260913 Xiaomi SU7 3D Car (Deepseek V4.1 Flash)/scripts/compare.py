"""Compare renders vs references: warped overlay + silhouette IoU + edge metrics."""
import bpy, numpy as np, os, sys, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "analysis")
IMG = os.path.join(ROOT, "Xiaomi-su7-images")
REN = os.path.join(ROOT, "renders")


def load(path):
    img = bpy.data.images.load(path)
    w, h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1]
    bpy.data.images.remove(img)
    return a


def save_rgb(a, path):
    h, w, _ = a.shape
    img = bpy.data.images.new("cmp", width=w, height=h, alpha=False)
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[..., :3] = np.clip(a, 0, 1)[::-1]
    img.pixels = rgba.ravel()
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


def sample(img, x, y):
    h, w = img.shape[:2]
    xi = np.clip(np.round(x).astype(int), 0, w - 1)
    yi = np.clip(np.round(y).astype(int), 0, h - 1)
    return img[yi, xi]


# per view: ref landmarks: (cx_ref, ground_ref, sx_ref_mm, sy_ref_mm, pod_z_mm)
VIEWS = {
    "side": dict(ref_file="Xiaomi-Su7-03.png", cx=262.5, gnd=332.0, sx=4.8348, sy=4.869,
                 axles=(262.5, 883.0), pod=1485),
    "front": dict(ref_file="Xiaomi-Su7-02.png", cx=554.0, gnd=491.0, sx=3.1413, sy=3.425, pod=1485),
    "rear": dict(ref_file="Xiaomi-Su7-04.png", cx=484.0, gnd=517.0, sx=3.2286, sy=3.410, pod=1485),
}

with open(os.path.join(REN, "cam_meta.json")) as f:
    CAM = json.load(f)

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
round_name = "r4"
views = ["side", "front", "rear"]
for a in argv:
    if a.startswith("round="):
        round_name = a.split("=")[1]
    elif a in VIEWS:
        views = [a]

report = {}
for view in views:
    v = VIEWS[view]
    ref = load(os.path.join(IMG, v["ref_file"]))
    ren = load(os.path.join(REN, f"{round_name}_{view}.png"))
    mren_img = load(os.path.join(REN, f"{round_name}_{view}_mask.png"))
    m_ren0 = mren_img[..., 3] > 0.5
    Hr, Wr, _ = ref.shape
    cm = CAM[view]
    ren_sx = cm["mm_px"] * 1000.0
    ren_sy = ren_sx
    ren_gy = cm["ground_py"]

    yy, xx = np.mgrid[0:Hr, 0:Wr]
    if view == "side":
        x_ren = cm["axle_f_px"] + (xx - v["axles"][0]) * v["sx"] / ren_sx
    else:
        x_ren = cm["center_px"] + (xx - v["cx"]) * v["sx"] / ren_sx
    y_ren = ren_gy - (v["gnd"] - yy) * v["sy"] / ren_sy

    r = sample(ren, x_ren, y_ren)
    blend = 0.55 * ref[..., :3] + 0.45 * r[..., :3]
    save_rgb(blend, os.path.join(A, f"cmp_{view}.png"))

    m_ref = np.load(os.path.join(A, f"refmask_{view}.npy"))
    m_ren = sample(m_ren0.astype(np.float32), x_ren, y_ren) > 0.5

    inter = (m_ref & m_ren).sum()
    union = (m_ref | m_ren).sum()
    iou = inter / max(union, 1)
    report[view] = round(float(iou), 4)

    dbg = np.zeros((Hr, Wr, 3), dtype=np.float32)
    dbg[..., 1] = np.where(m_ref & m_ren, 0.85, 0)
    dbg[..., 0] = np.where(m_ref & ~m_ren, 1.0, 0)
    dbg[..., 2] = np.where(~m_ref & m_ren, 1.0, 0)
    save_rgb(dbg, os.path.join(A, f"diff_{view}.png"))

    extra = ""
    if view == "side":
        topr = np.full(Wr, -1.0)
        toprn = np.full(Wr, -1.0)
        for xcol in range(Wr):
            i1 = np.flatnonzero(m_ref[:, xcol])
            i2 = np.flatnonzero(m_ren[:, xcol])
            if len(i1):
                topr[xcol] = i1[0]
            if len(i2):
                toprn[xcol] = i2[0]
        ok = (topr >= 0) & (toprn >= 0)
        err = (toprn[ok] - topr[ok]) * v["sy"]
        extra = f" top-edge err mean={err.mean():.1f}mm p90={np.percentile(np.abs(err),90):.1f}mm"
        # per-station top error in model y coords (mm)
        lines = []
        for y_mm in (-2400, -2200, -2000, -1800, -1600, -1400, -1200, -1000, -800, -600, -400, -200,
                     0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400):
            xcol = int(round(v["axles"][0] + (1500.0 - y_mm) / v["sx"]))
            if 0 <= xcol < Wr and topr[xcol] >= 0 and toprn[xcol] >= 0:
                lines.append(f"{y_mm}:{(toprn[xcol]-topr[xcol])*v['sy']:+.0f}")
        extra += "\n  top err by y: " + " ".join(lines)
    else:
        lines = []
        zr_px = v["sy"]
        for z_mm in (150, 300, 450, 600, 750, 900, 1050, 1200, 1350):
            row = int(round(v["gnd"] - z_mm / zr_px))
            if 0 <= row < Hr:
                i1 = np.flatnonzero(m_ref[row])
                i2 = np.flatnonzero(m_ren[row])
                if len(i1) and len(i2):
                    wr = (i1[-1] - i1[0]) * v["sx"]
                    wn = (i2[-1] - i2[0]) * v["sx"]
                    lines.append(f"z{z_mm}:{wn-wr:+.0f}")
        extra = "\n  width diff by z (mm): " + " ".join(lines)
    print(f"{view}: IoU={iou:.3f}{extra}")

print("IOU_REPORT", json.dumps(report))
print("COMPARE_DONE")
