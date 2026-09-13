import base64, re, struct, pathlib
t = pathlib.Path(r"C:\MyProjects\TempProject (OpenCode)\su7_standalone.html").read_text(encoding="utf-8")
for s in ["loadEmbedded();", "parseAsync", "onCarLoaded", "EMBEDDED_GLB_BASE64",
          "car.position.y -= box.min.y", "camera.position.set(4.8, 1.55, 3.1)"]:
    assert s in t, "missing: " + s
print("js structure OK")
assert "./su7.glb" not in t, "still references external glb"
m = re.search(r'EMBEDDED_GLB_BASE64 = "([^"]+)"', t)
assert m, "payload not found"
raw = base64.b64decode(m.group(1))
print("decoded bytes:", len(raw), "magic:", raw[:4], "version:", struct.unpack("<I", raw[4:8])[0])
orig = pathlib.Path(r"C:\MyProjects\TempProject (OpenCode)\su7.glb").read_bytes()
print("matches original:", raw == orig)
