import bpy, numpy as np, os, json

ROOT = r"C:\MyProjects\TempProject (OpenCode)"
A = os.path.join(ROOT, "analysis")


def shift(a, dy, dx):
    out = np.zeros_like(a)
    src_y = slice(max(0, -dy), a.shape[0] - max(0, dy))
    dst_y = slice(max(0, dy), a.shape[0] - max(0, -dy))
    src_x = slice(max(0, -dx), a.shape[1] - max(0, dx))
    dst_x = slice(max(0, dx), a.shape[1] - max(0, -dx))
    out[dst_y, dst_x] = a[src_y, src_x]
    return out


def flood_from(mask, seed):
    cur = mask & seed
    for _ in range(1500):
        nxt = cur | (shift(cur, 1, 0) | shift(cur, -1, 0) | shift(cur, 0, 1) | shift(cur, 0, -1))
        nxt &= mask
        if (nxt == cur).all():
            break
        cur = nxt
    return cur


def largest_from_seed(mask, seed):
    return flood_from(mask, seed)


CFG = {
    "side": dict(win=(78, 1082), seed=(262, 300), sill_row=302,
                 arch_x=(163, 362, 785, 981), gnd=332),
    "front": dict(win=(218, 872), seed=(500, 400), sill_row=459,
                  arch_x=(238, 352, 518, 662), gnd=491),
    "rear": dict(win=(178, 790), seed=(430, 420), sill_row=470,
                 arch_x=(178, 302, 438, 622), gnd=517),
}

meta = {}
for key, cfg in CFG.items():
    m2 = np.load(os.path.join(A, f"m2_{key}.npy"))
    H, W = m2.shape
    m = m2.copy()
    m[:, :cfg["win"][0]] = False
    m[:, cfg["win"][1]:] = False
    sy, sx = cfg["seed"]
    seed = np.zeros_like(m)
    seed[sy, sx - 2:sx + 3] = True
    m = largest_from_seed(m, seed)
    # fill holes: background not connected to border
    bg = ~m
    border = np.zeros_like(bg)
    border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
    ext = flood_from(bg, bg & border)
    m = m | (bg & ~ext)
    # remove shadow band below sill except at wheel arches
    sr = cfg["sill_row"]
    band = np.zeros_like(m)
    band[sr:, :] = True
    keep = np.zeros_like(m)
    ax0, ax1, ax2, ax3 = cfg["arch_x"]
    keep[sr:sr + 40, ax0:ax1] = True
    keep[sr:sr + 40, ax2:ax3] = True
    m = m & (~band | keep)
    for _ in range(4):
        m = (m & shift(m, 1, 0) & shift(m, -1, 0) & shift(m, 0, 1) & shift(m, 0, -1))
    np.save(os.path.join(A, f"refmask_{key}.npy"), m)
    rows = np.flatnonzero(m.any(axis=1))
    cols = np.flatnonzero(m.any(axis=0))
    meta[key] = {"top_row": int(rows[0]), "bot_row": int(rows[-1]),
                 "x0": int(cols[0]), "x1": int(cols[-1]), "gnd": cfg["gnd"]}
    print(key, "px", int(m.sum()), "top", int(rows[0]), "cols", int(cols[0]), int(cols[-1]))

with open(os.path.join(A, "refmask_meta.json"), "w") as f:
    json.dump(meta, f, indent=1)
print("REFMASK_DONE")
