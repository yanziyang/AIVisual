import bpy, numpy as np, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "analysis"); IMG = os.path.join(ROOT, "Xiaomi-su7-images")
def load(path):
    img = bpy.data.images.load(path); w,h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h,w,4)[::-1]
    bpy.data.images.remove(img); return a
def save_rgb(a, path):
    h,w,_ = a.shape
    img = bpy.data.images.new("dbg", width=w, height=h, alpha=False)
    rgba = np.ones((h,w,4), dtype=np.float32); rgba[...,:3] = np.clip(a,0,1)[::-1]
    img.pixels = rgba.ravel(); img.filepath_raw = path; img.file_format='PNG'; img.save()
    bpy.data.images.remove(img)
def gmag(l):
    gy = np.zeros_like(l); gx = np.zeros_like(l)
    gy[1:-1,:] = l[2:,:]-l[:-2,:]; gx[:,1:-1] = l[:,2:]-l[:,:-2]
    return np.sqrt(gx*gx+gy*gy)

def fit_wheel(arr, cx_rng, cy_rng, r_rng):
    lum = 0.2126*arr[...,0]+0.7152*arr[...,1]+0.0722*arr[...,2]
    g = gmag(lum); g = np.clip(g, 0, 0.25)
    H,W = lum.shape
    best = None
    ang = np.linspace(0, 2*np.pi, 180, endpoint=False)
    ca, sa = np.cos(ang), np.sin(ang)
    for cx in range(*cx_rng):
        for cy in range(*cy_rng):
            for r in range(*r_rng, 2):
                xs = (cx + r*ca).astype(int); ys = (cy + r*sa).astype(int)
                ok = (xs>=0)&(xs<W)&(ys>=0)&(ys<H)
                if ok.sum() < 120: continue
                s = g[ys[ok], xs[ok]].mean()
                if best is None or s > best[0]:
                    best = (s, cx, cy, r)
    return best

arr = load(os.path.join(IMG, "Xiaomi-Su7-03.png"))
f = fit_wheel(arr, (200,330,2), (250,330), (70,110))
r_ = fit_wheel(arr, (820,950,2), (250,330), (70,110))
print("front wheel fit (score,cx,cy,r):", f)
print("rear wheel fit (score,cx,cy,r):", r_)
mm_px = 3000.0/abs(r_[1]-f[1]); mm_px_tire = 703.0/(2*((f[3]+r_[3])/2))
print(f"mm_px(wheelbase)={mm_px:.3f} mm_px(tire)={mm_px_tire:.3f}")
print("implied car length:", (1073-80)*mm_px, (1080-76)*mm_px)
dbg = arr[...,:3].copy()
for (s,cx,cy,rr), col in ((f,[0,1,0]), (r_,[1,0,0])):
    ang = np.linspace(0,2*np.pi,720)
    xs = np.clip((cx+rr*np.cos(ang)).astype(int),0,dbg.shape[1]-1)
    ys = np.clip((cy+rr*np.sin(ang)).astype(int),0,dbg.shape[0]-1)
    dbg[ys,xs] = col
crop = dbg[200:360, 150:1050]
save_rgb(crop, os.path.join(A,"wheels_fit.png"))
print("DIAG3_DONE")
