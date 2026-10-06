from pathlib import Path
import base64,re
project=Path(__file__).resolve().parent.parent
root=project/'j36_model'
p=root/'viewer_template.html';s=p.read_text(encoding='utf-8-sig')
s=s.replace('<span>Original reference</span>','<span>Reference images</span>')
s=s.replace('<figcaption>Supplied reference · Source: Janes, as credited in image</figcaption>','<figcaption><div class="buttons"><button class="control ref-choice" data-ref="0">Hangar</button><button class="control ref-choice" data-ref="1">In flight</button><button class="control ref-choice" data-ref="2">Original</button></div><div style="margin-top:10px">User-supplied references · Credits retained in images</div></figcaption>')
s=s.replace("const dialog=document.getElementById('reference-dialog');","""const dialog=document.getElementById('reference-dialog');
const referenceImages=['__REFERENCE__','__REFERENCE_FLIGHT__','__REFERENCE_ORIGINAL__'];
const referenceLabels=['Hangar reference with arched dorsal inlet and intakes beneath the wings','In-flight reference showing blended fuselage and blue-gray camouflage','Original annotated Chengdu aircraft reference'];
document.querySelectorAll('.ref-choice').forEach(button=>{button.onclick=()=>{const index=Number(button.dataset.ref);const img=document.querySelector('.reference img');img.src=referenceImages[index];img.alt=referenceLabels[index];document.querySelectorAll('.ref-choice').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));};});
document.querySelector('.ref-choice').setAttribute('aria-pressed','true');""")
p.write_text(s,encoding='utf-8')
def data(path):return 'data:image/png;base64,'+base64.b64encode(Path(path).read_bytes()).decode()
for token,filename in [('__THREE__','three.min.js'),('__CONTROLS__','OrbitControls.js'),('__LOADER__','GLTFLoader.js')]:s=s.replace(token,(root/'viewer_vendor'/filename).read_text(encoding='utf-8-sig'))
s=s.replace('__MODEL__',base64.b64encode((root/'J36_concept.glb').read_bytes()).decode())
assets=Path(__file__).resolve().parent/'source-assets'
s=s.replace('__REFERENCE__',data(assets/'reference_hangar.png'))
s=s.replace('__REFERENCE_FLIGHT__',data(assets/'reference_flight.png'))
s=s.replace('__REFERENCE_ORIGINAL__',data(assets/'reference_original.png'))
(project/'J36_viewer.html').write_text(s,encoding='utf-8')
print('Standalone viewer updated:',(project/'J36_viewer.html').stat().st_size)
