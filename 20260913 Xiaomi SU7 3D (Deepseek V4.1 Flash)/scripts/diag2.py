import bpy, numpy as np, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "analysis"); IMG = os.path.join(ROOT, "Xiaomi-su7-images")
def load(path):
    img = bpy.data.images.load(path); w,h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h,w,4)[::-1]
    bpy.data.images.remove(img); return a
arr = load(os.path.join(IMG, "Xiaomi-Su7-03.png")); H,W,_ = arr.shape
m2 = np.load(os.path.join(A, "m2_side.npy")); f = np.load(os.path.join(A, "side_car.npy"))
rgb = arr[...,:3]; lum = 0.2126*rgb[...,0]+0.7152*rgb[...,1]+0.0722*rgb[...,2]
maxc = rgb.max(axis=2); minc = rgb.min(axis=2)
sat = np.where(maxc>1e-5,(maxc-minc)/np.maximum(maxc,1e-5),0)
bright = m2 & (sat<0.25) & (lum>0.5)
band = np.zeros_like(bright); band[int(H*0.55):] = True
cnt = (bright&band).sum(axis=0)
inc = cnt > 6
i=0; cl=[]
while i<W:
    if inc[i]:
        j=i
        while j<W and inc[j]: j+=1
        if j-i>30:
            sub = bright[:,i:j]; rows=np.flatnonzero(sub.sum(axis=1)>4)
            cl.append((i,j,int(cnt[i:j].max()),int(rows[0]),int(rows[-1])))
        i=j
    else: i+=1
print("rim clusters (x0,x1,maxcnt,ytop,ybot):", cl)
for name, m in (("flood", f), ("m2", m2)):
    colc = m.sum(axis=0); xs=np.flatnonzero(colc>=10)
    print(name, "bbox_x", int(xs[0]), int(xs[-1]), "len_px", int(xs[-1]-xs[0]))
    anyr = m.any(axis=1); rows = np.flatnonzero(anyr)
    print(name, "rows", int(rows[0]), int(rows[-1]))
# front
arr2 = load(os.path.join(IMG, "Xiaomi-Su7-02.png")); H2,W2,_ = arr2.shape
m = np.load(os.path.join(A,"m2_front.npy"))
colc = m.sum(axis=0); xs=np.flatnonzero(colc>=10)
anyr = m.any(axis=1); rows=np.flatnonzero(anyr)
print("front m2 bbox_x", int(xs[0]), int(xs[-1]), "width_px", int(xs[-1]-xs[0]), "rows", int(rows[0]), int(rows[-1]))
print("DIAG2_DONE")
