import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const $ = id => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stats = window.__viewerStats = { ready:false, offline:true, threeRevision:THREE.REVISION, originalMeshes:0, mergedMeshes:0, error:null };
let renderer, scene, camera, controls, car, frameBox, originalBytes, dirty=true, transition=null, activeView='hero';
let lastTime=0, toastTimer, shadowLight, ground;
let frameBudget=1000/60;
const allMaterials=[], paintMaterials=[], originalPaint=new Map();
const directions={hero:new THREE.Vector3(-6.9,2.7,8),front:new THREE.Vector3(-9,.65,0),rear:new THREE.Vector3(9,.7,0),side:new THREE.Vector3(0,.28,9),top:new THREE.Vector3(0,9,.001),wheel:new THREE.Vector3(-.65,.3,1.7)};

function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2400);}
function fail(error){console.error(error);stats.error=String(error?.message||error);document.body.classList.add('failed');$('loading').hidden=false;$('loadTitle').textContent='The 3D view could not start';$('loadText').textContent='Try opening this file in Chrome, Edge, or Firefox with graphics acceleration enabled. Your model is still embedded in the file.';}
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function setView(name,animate=true){
  if(!car)return;
  activeView=name;
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));
  let target=new THREE.Vector3(0,.69,0),box=frameBox;
  if(name==='wheel'){target.set(-1.60,.43,.86);box=new THREE.Box3(new THREE.Vector3(-2.04,0,.58),new THREE.Vector3(-1.16,.88,1.04));}
  const dir=directions[name].clone().normalize();
  const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),dir).normalize();
  const up=new THREE.Vector3().crossVectors(dir,right).normalize();
  const tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  const yMargin=innerHeight<560?.58:.72, xMargin=.84;
  let distance=1;
  for(let ix=0;ix<2;ix++)for(let iy=0;iy<2;iy++)for(let iz=0;iz<2;iz++){
    const p=new THREE.Vector3(ix?box.max.x:box.min.x,iy?box.max.y:box.min.y,iz?box.max.z:box.min.z).sub(target);
    distance=Math.max(distance,p.dot(dir)+Math.abs(p.dot(right))/(tan*camera.aspect*xMargin),p.dot(dir)+Math.abs(p.dot(up))/(tan*yMargin));
  }
  const position=target.clone().addScaledVector(dir,distance);
  transition=animate&&!reducedMotion?{start:performance.now(),from:camera.position.clone(),to:position,oldTarget:controls.target.clone(),target}:null;
  if(!transition){camera.position.copy(position);controls.target.copy(target);controls.update();}
  dirty=true;stats.view=name;
}

function optimize(gltf){
  gltf.scene.updateMatrixWorld(true);
  const groups=new Map();
  gltf.scene.traverse(o=>{
    if(!o.isMesh)return;
    stats.originalMeshes++;
    if(Array.isArray(o.material))throw new Error('Unexpected multi-material mesh.');
    const g=o.geometry.clone().applyMatrix4(o.matrixWorld);
    for(const name of Object.keys(g.attributes))if(name!=='position'&&name!=='normal')g.deleteAttribute(name);
    if(!g.attributes.normal)g.computeVertexNormals();
    if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
    const m=o.material;
    if(!groups.has(m.uuid))groups.set(m.uuid,{material:m,geometries:[]});
    groups.get(m.uuid).geometries.push(g);
  });
  const group=new THREE.Group();
  for(const {material,geometries} of groups.values()){
    const geometry=mergeGeometries(geometries,false);
    if(!geometry)throw new Error('Mesh optimization failed.');
    geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,material);mesh.name=material.name;
    mesh.castShadow=true;mesh.receiveShadow=false;group.add(mesh);
    geometries.forEach(g=>g.dispose());allMaterials.push(material);
    material.envMapIntensity=.9;
    if(/AQUA BLUE/i.test(material.name)){paintMaterials.push(material);originalPaint.set(material,material.color.clone());material.roughness=.27;material.metalness=.70;if(material.isMeshPhysicalMaterial)material.clearcoat=.25;}
    if(/tinted|automotive.*glass/i.test(material.name)){material.envMapIntensity=.42;material.metalness=.12;if(material.isMeshPhysicalMaterial)material.clearcoat=.12;}
    material.userData.studioEnv=material.envMapIntensity;
  }
  gltf.scene.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
  stats.mergedMeshes=group.children.length;
  return group;
}

async function initialize(){
  try{
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
    const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
    stats.softwareRenderer=!!(debug&&/SwiftShader|llvmpipe|software/i.test(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)));
    frameBudget=stats.softwareRenderer?1000/15:1000/60;
    renderer.setPixelRatio(Math.min(devicePixelRatio,stats.softwareRenderer?1:1.6));renderer.setSize(innerWidth,innerHeight);
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.90;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
    renderer.domElement.setAttribute('aria-label','Drag to rotate the Xiaomi SU7 Max 3D model');renderer.domElement.tabIndex=0;
    $('stage').appendChild(renderer.domElement);
    renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();fail(new Error('Graphics context lost.'));});
    scene=new THREE.Scene();scene.background=new THREE.Color('#121b25');scene.fog=new THREE.Fog('#121b25',17,40);
    camera=new THREE.PerspectiveCamera(32,innerWidth/innerHeight,.03,100);camera.position.set(-7,3,8);
    controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=.65;controls.maxDistance=24;controls.minPolarAngle=.012;controls.maxPolarAngle=Math.PI*.494;controls.autoRotateSpeed=.75;controls.target.set(0,.69,0);
    controls.addEventListener('change',()=>{dirty=true;});
    controls.addEventListener('start',()=>{transition=null;activeView=null;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed','false'));});
    const room=new RoomEnvironment();const pmrem=new THREE.PMREMGenerator(renderer);
    const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xc3e3ff,0x243a45,.7));
    shadowLight=new THREE.DirectionalLight(0xf0f7ff,2.0);shadowLight.position.set(-3,7,5);shadowLight.castShadow=true;
    shadowLight.shadow.mapSize.set(2048,2048);Object.assign(shadowLight.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.5,far:18});shadowLight.shadow.bias=-.00015;shadowLight.shadow.normalBias=.004;scene.add(shadowLight);
    const rim=new THREE.DirectionalLight(0x92cde8,1.25);rim.position.set(4,3,-4);scene.add(rim);
    ground=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({color:0x101b24,roughness:.9,metalness:0}));ground.rotation.x=-Math.PI/2;ground.position.y=-.006;ground.receiveShadow=true;scene.add(ground);
    $('loadText').textContent='Decoding the embedded model…';
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const modelTag=$('model-data'),binary=atob(modelTag.textContent.trim());
    originalBytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)originalBytes[i]=binary.charCodeAt(i);
    modelTag.remove();stats.modelBytes=originalBytes.byteLength;
    $('loadText').textContent='Preparing the bodywork and studio lighting…';
    const gltf=await new Promise((resolve,reject)=>new GLTFLoader().parse(originalBytes.buffer,'',resolve,reject));
    car=optimize(gltf);scene.add(car);
    const bounds=new THREE.Box3().setFromObject(car),center=bounds.getCenter(new THREE.Vector3());
    car.position.set(-center.x,-bounds.min.y,-center.z);car.updateMatrixWorld(true);
    frameBox=new THREE.Box3().setFromObject(car);stats.bounds=frameBox.getSize(new THREE.Vector3()).toArray();
    if(stats.bounds[0]<4||stats.bounds[1]>2)throw new Error('Unexpected model orientation.');
    setView('hero',false);renderer.shadowMap.needsUpdate=true;
    drawScene();stats.drawCalls=renderer.info.render.calls;stats.triangles=renderer.info.render.triangles;
    stats.ready=true;document.body.classList.add('ready');$('statusText').textContent='3D STUDIO';
    $('snapshot').disabled=false;$('download').disabled=false;
    setTimeout(()=>{$('loading').hidden=true;$('poster').remove();},650);
    if(matchMedia('(pointer: coarse)').matches)$('hint').textContent='Drag to orbit · Pinch to zoom · Two-finger drag to pan';
    requestAnimationFrame(tick);
  }catch(error){fail(error);}
}

function drawScene(){const start=performance.now();renderer.render(scene,camera);if(stats.softwareRenderer)renderer.getContext().finish();stats.lastFrameMs=Math.round(performance.now()-start);}

function tick(now){
  requestAnimationFrame(tick);
  if(document.hidden||now-lastTime<frameBudget)return;
  const delta=Math.min((now-lastTime)/1000,.2);lastTime=now;
  if(transition){const t=Math.min((now-transition.start)/650,1),e=t*t*(3-2*t);camera.position.lerpVectors(transition.from,transition.to,e);controls.target.lerpVectors(transition.oldTarget,transition.target,e);dirty=true;if(t===1)transition=null;}
  const changed=controls.update(delta);
  if(dirty||changed||controls.autoRotate){drawScene();dirty=false;stats.drawCalls=renderer.info.render.calls;}
}

document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
document.querySelectorAll('[data-paint]').forEach(b=>b.addEventListener('click',()=>{
  if(!car)return;
  const value=b.dataset.paint;
  for(const m of paintMaterials){if(value==='aqua')m.color.copy(originalPaint.get(m));else m.color.set(value==='silver'?'#adb6bd':'#202a33');}
  document.querySelectorAll('[data-paint]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
  $('finishName').textContent=value==='aqua'?'AQUA BLUE':value==='silver'?'SILVER PREVIEW':'BLACK PREVIEW';dirty=true;stats.paint=value;
}));
$('rotate').addEventListener('click',()=>{if(!controls)return;controls.autoRotate=!controls.autoRotate;$('rotate').setAttribute('aria-pressed',String(controls.autoRotate));dirty=true;stats.rotating=controls.autoRotate;});
$('wireframe').addEventListener('click',()=>{if(!car)return;const enabled=$('wireframe').getAttribute('aria-pressed')!=='true';allMaterials.forEach(m=>{m.wireframe=enabled;});$('wireframe').setAttribute('aria-pressed',String(enabled));dirty=true;stats.wireframe=enabled;});
$('lighting').addEventListener('change',()=>{if(!scene)return;const day=$('lighting').value==='daylight';scene.background.set(day?'#73848e':'#121b25');scene.fog.color.copy(scene.background);ground.material.color.set(day?'#697c84':'#101b24');renderer.toneMappingExposure=day?1.08:.90;allMaterials.forEach(m=>m.envMapIntensity=m.userData.studioEnv*(day?1.3:1));dirty=true;stats.lighting=day?'daylight':'studio';});
$('snapshot').addEventListener('click',()=>{if(!stats.ready)return;drawScene();renderer.domElement.toBlob(blob=>{if(blob){download(blob,'Xiaomi_SU7_'+(activeView||'custom')+'.png');toast('Image saved.');}else toast('Image export was unavailable.');},'image/png');});
$('download').addEventListener('click',()=>{if(originalBytes)download(new Blob([originalBytes],{type:'model/gltf-binary'}),'Xiaomi_SU7_Max.glb');});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Use your browser’s fullscreen command.');}});
$('about').addEventListener('click',()=>$('info').showModal());$('closeInfo').addEventListener('click',()=>$('info').close());
$('info').addEventListener('click',e=>{if(e.target===$('info')){const r=$('info').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('info').close();}});
$('retry').addEventListener('click',()=>location.reload());
document.addEventListener('keydown',e=>{if(/INPUT|SELECT|BUTTON|TEXTAREA/.test(e.target.tagName)||$('info').open)return;if(e.key.toLowerCase()==='r')setView('hero');if(e.code==='Space'){e.preventDefault();$('rotate').click();}});
window.addEventListener('resize',()=>{if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);if(activeView)setView(activeView,false);dirty=true;});
initialize();
