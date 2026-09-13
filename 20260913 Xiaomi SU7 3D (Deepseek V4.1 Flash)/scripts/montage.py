"""Side-by-side comparison sheets: reference | render (warped to reference framing)."""
import bpy, numpy as np, os, json, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "analysis")
CMP = os.path.join(ROOT, "comparisons")
IMG = os.path.join(ROOT, "Xiaomi-su7-images")
REN = os.path.join(ROOT, "renders")
os.makedirs(CMP, exist_ok=True)


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


VIEWS = {
    "side": dict(ref_file="Xiaomi-Su7-03.png", cx=262.5, gnd=332.0, sx=4.8348, sy=4.869,
                 axles=(262.5, 883.0)),
    "front": dict(ref_file="Xiaomi-Su7-02.png", cx=554.0, gnd=491.0, sx=3.1413, sy=3.425),
    "rear": dict(ref_file="Xiaomi-Su7-04.png", cx=484.0, gnd=517.0, sx=3.2286, sy=3.410),
}

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
RND = "final"
for a in argv:
    if a.startswith("round="):
        RND = a.split("=")[1]

with open(os.path.join(REN, "cam_meta.json")) as f:
    CAM = json.load(f)

for view, v in VIEWS.items():
    ref = load(os.path.join(IMG, v["ref_file"]))
    ren = load(os.path.join(REN, f"{RND}_{view}.png"))
    Hr, Wr, _ = ref.shape
    cm = CAM[view]
    ren_sx = cm["mm_px"] * 1000.0
    yy, xx = np.mgrid[0:Hr, 0:Wr]
    if view == "side":
        x_ren = cm["axle_f_px"] + (xx - v["axles"][0]) * v["sx"] / ren_sx
    else:
        x_ren = cm["center_px"] + (xx - v["cx"]) * v["sx"] / ren_sx
    y_ren = cm["ground_py"] - (v["gnd"] - yy) * v["sy"] / ren_sx
    r = sample(ren, x_ren, y_ren)[..., :3]
    both = np.concatenate([ref[..., :3], r], axis=1)
    save_rgb(both, os.path.join(CMP, f"compare_{view}.png"))
    print("saved", f"compare_{view}.png")

# 3/4 views: simple horizontal stack after scaling render to ref height
for key, reff, renf in (("f34", "Xiaomi-Su7-01.png", f"{RND}_f34.png"),
                        ("f34b", "Xiaomi-Su7-05.png", f"{RND}_f34b.png")):
    ref = load(os.path.join(IMG, reff))
    ren = load(os.path.join(REN, renf))
    Hr, Wr, _ = ref.shape
    Hir, Wir, _ = ren.shape
    scale = Hr / Hir
    yy2, xx2 = np.mgrid[0:Hr, 0:int(Wir * scale)]
    r = sample(ren, xx2 / scale, yy2 / scale)[..., :3]
    both = np.concatenate([ref[..., :3], r], axis=1)
    save_rgb(both, os.path.join(CMP, f"compare_{key}.png"))
    print("saved", f"compare_{key}.png")

print("MONTAGE_DONE")


