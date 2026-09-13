import bpy, numpy as np, json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "analysis"); IMG = os.path.join(ROOT, "Xiaomi-su7-images")
def load_pixels(path):
    img = bpy.data.images.load(path); w,h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h,w,4)[::-1]
    bpy.data.images.remove(img); return a
for key, fname in (("front","Xiaomi-Su7-02.png"),("rear","Xiaomi-Su7-04.png")):
    a2 = load_pixels(os.path.join(IMG, fname))
    rgb = a2[...,:3]
    lum = 0.2126*rgb[...,0]+0.7152*rgb[...,1]+0.0722*rgb[...,2]
    maxc = rgb.max(axis=2); minc = rgb.min(axis=2)
    sat = np.where(maxc>1e-5,(maxc-minc)/np.maximum(maxc,1e-5),0)
    m2 = np.load(os.path.join(A, f"m2_{key}.npy"))
    paint = m2 & (sat>0.3) & (lum>0.22)
    H2,W2 = paint.shape
    gnd2 = {"front":491,"rear":517}[key]
    widths=[]; lrows=[]; rrows=[]
    for r in range(H2):
        idx = np.flatnonzero(paint[r])
        if len(idx) > 3:
            widths.append(idx[-1]-idx[0]); lrows.append(idx[0]); rrows.append(idx[-1])
        else:
            widths.append(0); lrows.append(-1); rrows.append(-1)
    widths=np.array(widths); lrows=np.array(lrows); rrows=np.array(rrows)
    wmax = widths.max(); wrow = int(np.argmax(widths))
    cx2 = 0.5*(lrows[wrow]+rrows[wrow])
    sk = 1963.0/wmax
    wmax_z = (gnd2-wrow)*sk
    print(f"{key}: wmax={wmax}px at row {wrow} z={wmax_z:.0f}  cx2={cx2:.0f} sk={sk:.3f}")
    rows=[]
    for z in range(0, 1501, 25):
        r = int(round(gnd2 - z/sk))
        if 0 <= r < H2 and lrows[r] >= 0:
            rows.append((z, round((cx2-lrows[r])*sk), round((rrows[r]-cx2)*sk)))
    print(f"{key} z:hl/hr:", " ".join(f"{z}:{l}/{rr}" for z,l,rr in rows))
    with open(os.path.join(A, f"paint_{key}.json"),"w") as f:
        json.dump({"sk":sk,"gnd":gnd2,"cx":cx2,"rows":rows}, f, indent=1)
print("PAINT_DONE")
