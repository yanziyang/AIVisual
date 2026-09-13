import base64
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
glb = (ROOT / "su7.glb").read_bytes()
assert glb[:4] == b"glTF", "su7.glb is not a valid GLB"
b64 = base64.b64encode(glb).decode("ascii")
tpl = (ROOT / "scripts" / "su7_viewer_template.html").read_text(encoding="utf-8")
assert "__GLB_BASE64__" in tpl
out = tpl.replace("__GLB_BASE64__", b64)
(ROOT / "su7_viewer.html").write_text(out, encoding="utf-8")
print(f"VIEWER_WRITTEN glb={len(glb)} bytes html={len(out)} bytes b64={len(b64)}")
