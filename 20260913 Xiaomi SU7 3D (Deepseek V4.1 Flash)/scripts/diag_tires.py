import bpy, numpy as np, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "analysis"); IMG = os.path.join(ROOT, "Xiaomi-su7-images")
def load(path):
    img = bpy.data.images.load(path); w,h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h,w,4)[::-1]
    bpy.data.images.remove(img); return a
for key, fn in (("side","Xiaomi-Su7-03.png"),("front","Xiaomi-Su7-02.png"),("rear","Xiaomi-Su7-04.png")):
    arr = load(os.path.join(IMG, fn)); H,W,_ = arr.shape
    m2 = np.load(os.path.join(A, f"m2_{key}.npy"))
    rgb = arr[...,:3]; lum = 0.2126*rgb[...,0]+0.7152*rgb[...,1]+0.0722*rgb[...,2]
    for thr in (0.04, 0.06, 0.09):
        dark = m2 & (lum < thr)
        band = np.zeros_like(dark); band[int(H*0.5):] = True
        cnt = (dark & band).sum(axis=0)
        inc = cnt > 5
        cl = []
        i = 0
        while i < W:
            if inc[i]:
                j = i
                while j < W and inc[j]: j += 1
                if j-i > 20: cl.append((i, j, int(cnt[i:j].max())))
                i = j
            else: i += 1
        print(key, "thr", thr, "clusters:", cl)
print("DIAG_DONE")
