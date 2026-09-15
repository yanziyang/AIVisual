from pathlib import Path
import base64
root=Path(r'C:\MyProjects\TempProject (OpenAI)\J36_Web')
template=(root/'src/viewer.template.html').read_text(encoding='utf-8-sig')
js=(root/'viewer.bundle.js').read_text(encoding='utf-8').replace('</script','<\\/script')
html=template.replace('__MODEL_BASE64__',base64.b64encode((root/'j36.glb').read_bytes()).decode()).replace('__VIEWER_BUNDLE__',js)
license=(root/'vendor/three/package/LICENSE').read_text(encoding='utf-8')
html=html.replace('<head>', '<!-- Three.js 0.186.0\n'+license+'-->\n<head>',1)
(root/'J36_Explorer.html').write_text(html,encoding='utf-8')
print('Standalone HTML:',(root/'J36_Explorer.html').stat().st_size,'bytes')
