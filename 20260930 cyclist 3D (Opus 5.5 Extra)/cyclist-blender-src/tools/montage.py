"""Contact sheet: python tools/montage.py out.png a.png b.png ... [--cols N] [--w 800]"""
import sys
from PIL import Image, ImageDraw

args = sys.argv[1:]
cols, width = 2, 800
if "--cols" in args:
    i = args.index("--cols"); cols = int(args[i + 1]); del args[i:i + 2]
if "--w" in args:
    i = args.index("--w"); width = int(args[i + 1]); del args[i:i + 2]
out, files = args[0], args[1:]
ims = []
for f in files:
    im = Image.open(f).convert("RGB")
    h = int(im.height * width / im.width)
    ims.append((f, im.resize((width, h), Image.LANCZOS)))
rows = (len(ims) + cols - 1) // cols
rh = max(im.height for _, im in ims)
sheet = Image.new("RGB", (cols * width, rows * rh), (30, 30, 30))
d = ImageDraw.Draw(sheet)
for k, (f, im) in enumerate(ims):
    x, y = (k % cols) * width, (k // cols) * rh
    sheet.paste(im, (x, y))
    d.text((x + 6, y + 4), f.replace("\\", "/").split("/")[-1], fill=(255, 255, 0))
sheet.save(out)
print(out, sheet.size)
