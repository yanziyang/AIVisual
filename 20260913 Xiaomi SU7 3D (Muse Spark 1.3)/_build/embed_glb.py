import base64, pathlib
base = pathlib.Path(r"C:\MyProjects\TempProject (OpenCode)")
html = (base / "su7_viewer.html").read_text(encoding="utf-8")
glb = (base / "su7.glb").read_bytes()
b64 = base64.b64encode(glb).decode("ascii")
print("glb bytes:", len(glb), "b64 chars:", len(b64))

# 1. Insert embedded payload before the loader declaration
marker = "const loader = new GLTFLoader();"
assert marker in html, "loader marker not found"
injection = (
    "const loader = new GLTFLoader();\n"
    "// ===== EMBEDDED su7.glb (base64, generated) — page runs as a single file =====\n"
    "const EMBEDDED_GLB_BASE64 = \"__GLB_B64__\";\n"
    "function base64ToArrayBuffer(b64){\n"
    "  const bin = atob(b64);\n"
    "  const len = bin.length;\n"
    "  const bytes = new Uint8Array(len);\n"
    "  for(let i=0;i<len;i++) bytes[i]=bin.charCodeAt(i);\n"
    "  return bytes.buffer;\n"
    "}\n"
    "async function loadEmbedded(){\n"
    "  setStatus('Loading embedded model (' + (EMBEDDED_GLB_BASE64.length/1048576).toFixed(2) + ' MB)…');\n"
    "  try{\n"
    "    const buf = base64ToArrayBuffer(EMBEDDED_GLB_BASE64);\n"
    "    const gltf = await loader.parseAsync(buf, '');\n"
    "    onCarLoaded(gltf, 'embedded su7.glb');\n"
    "  }catch(e){ console.error(e); setStatus('Embedded parse failed: ' + e.message); }\n"
    "}\n"
)
html = html.replace(marker, injection)

# 2. Extract per-load finalizing into onCarLoaded so both URL + embedded share it.
old_block = """    car = gltf.scene;
    car.traverse(o=>{
      if(o.isMesh){ o.castShadow = true; o.receiveShadow = false; }
      if(o.isMesh && o.material){
        const mats = Array.isArray(o.material)?o.material:[o.material];
        mats.forEach(m=>{
          if(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial){
            // collect likely paint mats (teal, high metalness/clearcoat or name match)
            const c = m.color ? '#'+m.color.getHexString() : '';
            if(o.name.toLowerCase().includes('body') || (m.name && m.name.toLowerCase().includes('aqua'))) paintMats.push(m);
          }
        });
      }
    });
    // Fallback: if name matching failed, detect teal paint by color proximity
    if(paintMats.length===0){
      car.traverse(o=>{
        if(o.isMesh){
          const mats = Array.isArray(o.material)?o.material:[o.material];
          mats.forEach(m=>{
            if(m.color && Math.abs(m.color.r-0.0)<0.08 && m.color.g>0.15 && m.color.g<0.5 && m.color.b>0.2 && m.color.b<0.55) paintMats.push(m);
          });
        }
      });
    }
    // De-dupe
    paintMats = [...new Set(paintMats)];
    // Ground the car: center XZ, sit min.y on floor (three Y-up). Old code
    // subtracted center.y which sank half the car below the ground plane,
    // hiding wheels/lower body so only the upper was visible.
    const box = new THREE.Box3().setFromObject(car);
    const center = box.getCenter(new THREE.Vector3());
    car.position.x -= center.x;
    car.position.z -= center.z;
    car.position.y -= box.min.y;
    controls.target.set(0, 0.55, 0);
    scene.add(car);
    setStatus('Loaded ' + url + ' · drag to orbit · ' + paintMats.length + ' paint material(s)');"""
new_block = """    onCarLoaded(gltf, url);"""
assert old_block in html, "loadURL body block not found"
html = html.replace(old_block, new_block)

helper = """
function onCarLoaded(gltf, label){
    if(car) { scene.remove(car); }
    paintMats = [];
    car = gltf.scene;
    car.traverse(o=>{
      if(o.isMesh){ o.castShadow = true; o.receiveShadow = false; }
      if(o.isMesh && o.material){
        const mats = Array.isArray(o.material)?o.material:[o.material];
        mats.forEach(m=>{
          if(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial){
            // collect likely paint mats (teal, high metalness/clearcoat or name match)
            if(o.name.toLowerCase().includes('body') || (m.name && m.name.toLowerCase().includes('aqua'))) paintMats.push(m);
          }
        });
      }
    });
    // Fallback: if name matching failed, detect teal paint by color proximity
    if(paintMats.length===0){
      car.traverse(o=>{
        if(o.isMesh){
          const mats = Array.isArray(o.material)?o.material:[o.material];
          mats.forEach(m=>{
            if(m.color && Math.abs(m.color.r-0.0)<0.08 && m.color.g>0.15 && m.color.g<0.5 && m.color.b>0.2 && m.color.b<0.55) paintMats.push(m);
          });
        }
      });
    }
    // De-dupe
    paintMats = [...new Set(paintMats)];
    // Ground the car: center XZ, sit min.y on floor (three Y-up).
    const box = new THREE.Box3().setFromObject(car);
    const center = box.getCenter(new THREE.Vector3());
    car.position.x -= center.x;
    car.position.z -= center.z;
    car.position.y -= box.min.y;
    controls.target.set(0, 0.55, 0);
    scene.add(car);
    setStatus('Loaded ' + label + ' · drag to orbit · ' + paintMats.length + ' paint material(s)');
}
"""
anchor = "async function loadURL(url){"
assert anchor in html
html = html.replace(anchor, helper + "\nasync function loadURL(url){")

# 3. Boot from embedded payload instead of fetching ./su7.glb
old_boot = "loadURL('./su7.glb');"
assert old_boot in html
html = html.replace(old_boot, "loadEmbedded();")

# 4. Update HUD copy: standalone note
html = html.replace("exported to <code>su7.glb</code>.", "with <code>su7.glb</code> embedded — single file, no local assets.")
html = html.replace(
  "If the model doesn't load via <code>file://</code>, run:<br/><code>python -m http.server</code> in this folder, then open <code>http://localhost:8000/su7_viewer.html</code>. You can also drag-drop <code>su7.glb</code> anywhere.",
  "Runs directly via <code>file://</code> double-click (needs internet for the three.js CDN). You can still drag-drop an external <code>.glb</code> to swap models."
)
html = html.replace("<title>Xiaomi SU7 — 3D Viewer (Blender 3.6.23 → three.js)</title>",
                    "<title>Xiaomi SU7 — 3D Viewer (standalone, model embedded)</title>")

# 5. Inject the actual payload
assert "__GLB_B64__" in html
html = html.replace("__GLB_B64__", b64)

out = base / "su7_standalone.html"
out.write_text(html, encoding="utf-8")
print("wrote", out, "bytes:", out.stat().st_size)
