import bpy, numpy as np, os, sys, json
ROOT = r"C:\MyProjects\TempProject (OpenCode)"
A = os.path.join(ROOT, "analysis"); IMG = os.path.join(ROOT, "Xiaomi-su7-images"); REN = os.path.join(ROOT, "renders")
def load(path):
    img = bpy.data.images.load(path); w,h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h,w,4)[::-1]
    bpy.data.images.remove(img); return a
def shift(a, dy, dx):
    out = np.zeros_like(a)
    src_y = slice(max(0,-dy), a.shape[0]-max(0,dy)); dst_y = slice(max(0,dy), a.shape[0]-max(0,-dy))
    src_x = slice(max(0,-dx), a.shape[1]-max(0,dx)); dst_x = slice(max(0,dx), a.shape[1]-max(0,-dx))
    out[dst_y,dst_x] = a[src_y,src_x]; return out
def mask(img, gnd, thr):
    lum = 0.2126*img[...,0]+0.7152*img[...,1]+0.0722*img[...,2]
    bg = np.median(lum, axis=0)
    diff = np.abs(lum - bg[None,:])
    maxc = img[...,:3].max(axis=2); minc = img[...,:3].min(axis=2)
    sat = np.where(maxc>1e-5,(maxc-minc)/np.maximum(maxc,1e-5),0)
    m = (diff > thr) | (sat > 0.22)
    m[gnd+4:,:] = False
    return m
ref = load(os.path.join(IMG,"Xiaomi-Su7-03.png"))
ren = load(os.path.join(REN,"r4_side.png"))
print("ref shape", ref.shape, "ren shape", ren.shape)
mref = mask(ref, 332, 0.10); mren = mask(ren, 401, 0.085)
print("mref px", mref.sum(), "mren px", mren.sum())
print("mref rowsum max", mref.sum(axis=1).max(), "at", mref.sum(axis=1).argmax())
print("mren rowsum max", mren.sum(axis=1).max(), "at", mren.sum(axis=1).argmax())
print("DBG_DONE")
