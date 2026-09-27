"""Embed the MIT Clearwater engine and pond additions into one offline HTML file."""
from pathlib import Path
import re
import base64
import html

root = Path(__file__).resolve().parent
output_path = root.parent / 'fish-pond.html'
source = (root / 'clearwater-source/index.html').read_text(encoding='utf-8')
license_text = (root / 'clearwater-source/LICENSE').read_text(encoding='utf-8')
engine = re.search(r'<script>\s*(.*?)</script>', source, re.S).group(1)
texture = re.search(r'<script id="pebbles-texture" type="text/plain">(.*?)</script>', source, re.S).group(1)

def replace(old, new):
    global engine
    assert old in engine, f'Missing upstream anchor: {old[:100]}'
    engine = engine.replace(old, new, 1)

replace("function fail(msg){ $err.hidden=false;", "function fail(msg){ document.getElementById('loader').hidden=true; $err.hidden=false;")
replace('throw 0;', "throw new Error('WebGL2 is required.');")
replace('throw 0;', "throw new Error('Floating point render targets are required.');")
replace('const DEPTH = 1.6;', 'const DEPTH = 0.85;')
replace('const N = 256, LOGN = 8;', 'const N = 128, LOGN = 7;')
replace('const TARGET_SLOPE = 0.078;', 'const TARGET_SLOPE = 0.042;')
replace('const G = 256, C = 1024;', 'const G = 64, C = 512;')
replace("const GLARE_ON = !!extF32 && !Q.has('noglare');", "const GLARE_ON = false; // An overhead pond needs no lens diffraction; retain the upstream pipeline.")
replace('const DPR = Math.min(window.devicePixelRatio||1, 2);', 'const DPR = Math.min(window.devicePixelRatio||1, 1.5);')
replace('let quality = FIXED_T!==null ? 1.0 : (DPR > 1.5 ? 0.72 : 0.95);', 'let quality = FIXED_T!==null ? 1.0 : 0.85;')
replace('const vec3 SIG_A = vec3(0.40, 0.074, 0.088);', 'const vec3 SIG_A = vec3(0.26, 0.10, 0.22);')
replace('const vec3 SIG_S = vec3(0.028, 0.052, 0.068);', 'const vec3 SIG_S = vec3(0.018, 0.036, 0.025);')
start = engine.index('float floorDepth(vec2 xz){')
end = engine.index('vec3 pebbles(', start)
engine = engine[:start] + '''float floorDepth(vec2 xz){
  float r=length(xz/vec2(1.12,1.0));
  return 0.92 - .43*smoothstep(1.6,2.8,r) + .055*(vnoise(xz*2.0)-.5);
}
''' + engine[end:]
scene = (root / 'pond-scene.glsl').read_text(encoding='utf-8')
anchor = 'void main(){\n  vec2 ndc = vUv*2.0-1.0;'
replace(anchor, scene + '\n' + anchor)
replace('vec3 rd = normalize(uF + ndc.x*uAspect*uTanF*uR + ndc.y*uTanF*uU);', '''vec3 rd = normalize(uF + ndc.x*uAspect*uTanF*uR + ndc.y*uTanF*uU);
  int rockIndex; float rockT=rockHit(uCam,rd,rockIndex);
  float groundT=(.04-uCam.y)/rd.y;
  vec3 groundPoint=uCam+rd*groundT;
  bool groundVisible=groundT>0.0&&pondDistance(groundPoint.xz)>-.02;
  float terrainT=groundVisible?groundT:1e5;
  if(rockT<terrainT)terrainT=rockT;
  float planeT=-uCam.y/rd.y;
  // Above-water boulders occlude the same rays that otherwise reach the water.
  if(terrainT<planeT+.05){
    vec3 terrain=uCam+rd*terrainT;
    vec3 dry=rockT<groundT||!groundVisible?rockColor(terrain,rockIndex):dryGround(terrain);
    o=vec4(max(dry,0.0),1.0);return;
  }''')
replace('hsum = A.x + WB*SC*B.x + R.x;', 'hsum = (A.x + WB*SC*B.x)*uWind + R.x;')
replace('vec2 slope = A.yz + WB*(transpose(M)*B.yz) + R.yz;', 'vec2 slope = (A.yz + WB*(transpose(M)*B.yz))*uWind + R.yz;')
replace('slope += 0.13*exp(-t*0.18)*(transpose(M2)*Cm.yz);', 'slope += 0.09*uWind*exp(-t*0.18)*(transpose(M2)*Cm.yz);')
replace('vec3 refl = sky(rr) * 1.25;', '''vec3 refl=sky(rr)*.58;
  float foliage=fbm2(rr.xz*8.0+rr.y*5.0);
  refl=mix(refl,vec3(.055,.11,.031),smoothstep(.38,.60,foliage)*.62);''')
replace('vec3 alb = mix(pf, pc, coarse); hgt = mix(hgt, hgt2, coarse);', 'vec3 alb = mix(pf, pc, coarse)*vec3(.83,.91,.72); hgt = mix(hgt, hgt2, coarse);')
replace('vec3 Lfloor = alb/PI * (Esun + Esky);', '''float shoreShadow=stoneShadow(vec3(FP.x,FP.y,FP.z));
  float branches=fbm2(FP.xz*1.0+vec2(.013*uTime,.0));
  float leafShadow=mix(.65,1.0,smoothstep(.32,.60,branches));
  vec3 Lfloor = alb/PI * (Esun*shoreShadow*leafShadow + Esky)*koiShadow(FP.xz)*uBrightness*vec3(1.0+.3*uWarm,1.0,1.0-.22*uWarm);''')
replace('vec3 col = F*refl + (1.0-F)*under + spec;', '''under=addKoi(P,tr,under,s);
  vec3 col = F*refl + (1.0-F)*under + spec*.6;
  if(rockT<planeT+1.1&&rockT<groundT){vec3 rockPoint=uCam+rd*rockT;if(rockPoint.y<0.0)col=mix(col,rockColor(rockPoint,rockIndex)*vec3(.63,.78,.64),.76);}
  col=addFloating(uCam,rd,col,t);''')
replace('gl.uniform1f(pFinal.u.uExp, 0.63);', 'gl.uniform1f(pFinal.u.uExp, 1.10);')
start = engine.index('/* ---------------- Camera & input ---------------- */')
engine = engine[:start] + (root / 'pond-behavior.js').read_text(encoding='utf-8')
shell = (root / 'pond-shell.html').read_text(encoding='utf-8')
for source_name in ('pond-shell.html', 'pond-scene.glsl', 'pond-behavior.js', 'build_pond.py', 'clearwater-source/'):
    shell = shell.replace(f'<code>{source_name}</code>', f'<code>build/{source_name}</code>')
reference_path = root / 'clearwater-source/reference.png'
reference_uri = 'data:image/png;base64,' + base64.b64encode(reference_path.read_bytes()).decode('ascii')
shell = shell.replace('{{REFERENCE_IMAGE}}', reference_uri).replace('{{CLEARWATER_LICENSE}}', html.escape(license_text))
output = shell + '\n<script>\n' + engine + '\n</script>\n'
output += '<script id="pebbles-texture" type="text/plain">' + texture + '</script>\n'
output += '<!--\nClearwater upstream: https://github.com/Aureliengmz/clearwater\n' + license_text + '\n-->\n</body>\n</html>\n'
output_path.write_text(output, encoding='utf-8')
print(f'Created {output_path} ({len(output.encode()):,} bytes). All rendering assets embedded.')

