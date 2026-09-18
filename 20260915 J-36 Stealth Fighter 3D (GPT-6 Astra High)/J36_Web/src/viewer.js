import * as THREE from '../vendor/three/package/build/three.module.js';
import { OrbitControls } from '../vendor/three/package/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from '../vendor/three/package/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from '../vendor/three/package/examples/jsm/environments/RoomEnvironment.js';
const $=id=>document.getElementById(id);
const canvas=$('canvas'), stage=canvas.parentElement;
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
if(matchMedia('(max-width:700px)').matches) $('controls-panel').open=false;
let renderer,scene,camera,controls,model,glbBytes,ground,grid,baseDistance=44,tween=null,lastTime=0,toastTimer;
let meshes=[],gearMeshes=[],materials=[],size,center,ready=false,fitRadius=18;
const views={hero:{direction:[1,.73,1.25],label:'01 / PERSPECTIVE'},top:{direction:[0,1,-.0001],label:'02 / TOP PLAN'},rear:{direction:[-1,.58,-1.25],label:'03 / REAR'},under:{direction:[.70,-1,1.0],label:'04 / UNDERSIDE'},front:{direction:[0,.055,1],label:'05 / FRONT ELEVATION'}};
const viewer=window.j36Viewer={ready:false,setView:key=>setView(key),getState:()=>({ready,view:$('view-name').textContent,meshCount:meshes.length,gearCount:gearMeshes.length,gearVisible:$('gear').checked,wireframe:$('wireframe').getAttribute('aria-pressed')==='true',groundVisible:ground?.visible,autoRotate:controls?.autoRotate,exposure:renderer?.toneMappingExposure,triangles:renderer?.info.render.triangles})};
function fail(error){console.error(error);$('loader').classList.add('error');$('loader').classList.remove('loaded');$('load-title').textContent='The 3D viewer could not start';$('load-message').textContent='Try opening this file in an up-to-date Chrome, Edge, Firefox or Safari with graphics acceleration enabled.';viewer.error=String(error);}
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2200);}
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function resize(){if(!renderer)return;const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();const fov=THREE.MathUtils.degToRad(camera.fov);const angle=Math.min(fov/2,Math.atan(Math.tan(fov/2)*camera.aspect));const previous=baseDistance;baseDistance=fitRadius/Math.sin(angle)*1.05;if(ready&&previous){const offset=camera.position.clone().sub(controls.target);offset.multiplyScalar(baseDistance/previous);camera.position.copy(controls.target).add(offset);tween=null;}controls?.update();}
function updateGround(){if(ground){const visible=$('ground').checked&&camera.position.y>ground.position.y+.05;ground.visible=visible;grid.visible=visible;}}
function setRotation(enabled){if(!controls)return;controls.autoRotate=enabled;$('rotate').setAttribute('aria-pressed',String(enabled));$('rotate').textContent=enabled?'Ⅱ  Pause rotation':'↻  Auto rotate';}
function setView(key,instant=false){if(!ready||!views[key])return;setRotation(false);const v=views[key];const offset=camera.position.clone().sub(controls.target);const from=new THREE.Spherical().setFromVector3(offset);let radius=baseDistance*(key==='front'?.86:key==='hero'?.88:key==='rear'?.95:1);const to=new THREE.Spherical().setFromVector3(new THREE.Vector3(...v.direction).normalize().multiplyScalar(radius));let delta=to.theta-from.theta;delta=THREE.MathUtils.euclideanModulo(delta+Math.PI,Math.PI*2)-Math.PI;to.theta=from.theta+delta;
 tween={from,to,targetFrom:controls.target.clone(),start:performance.now(),duration:instant||reduceMotion?0:650};
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===key)));$('view-name').textContent=v.label;
}
function wireframe(on){materials.forEach(m=>{m.wireframe=on});$('coated').setAttribute('aria-pressed',String(!on));$('wireframe').setAttribute('aria-pressed',String(on));}
function frame(time){requestAnimationFrame(frame);if(!renderer)return;const dt=Math.min(.05,(time-lastTime)/1000||.016);lastTime=time;
 if(tween){const p=tween.duration?Math.min(1,(time-tween.start)/tween.duration):1;const ease=p*p*(3-2*p);const s=new THREE.Spherical(THREE.MathUtils.lerp(tween.from.radius,tween.to.radius,ease),THREE.MathUtils.lerp(tween.from.phi,tween.to.phi,ease),THREE.MathUtils.lerp(tween.from.theta,tween.to.theta,ease));s.makeSafe();controls.target.copy(tween.targetFrom).multiplyScalar(1-ease);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));if(p===1)tween=null;}
 controls.update(dt);updateGround();renderer.render(scene,camera);
}
async function init(){
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 scene=new THREE.Scene();scene.background=new THREE.Color('#101b24');scene.fog=new THREE.Fog('#101b24',95,190);
 camera=new THREE.PerspectiveCamera(38,1,.1,300);camera.position.set(30,23,37);
 controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.07;controls.minDistance=7;controls.maxDistance=100;controls.maxPolarAngle=Math.PI-.001;controls.minPolarAngle=.001;controls.autoRotateSpeed=.65;controls.screenSpacePanning=true;controls.addEventListener('start',()=>{tween=null;setRotation(false);$('view-name').textContent='FREE ORBIT';document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed','false'));});
 const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.04).texture;room.dispose();pmrem.dispose();scene.environmentIntensity=.8;
 scene.add(new THREE.HemisphereLight(0xc8e2ff,0x30404b,1.0));
 function directional(color,power,pos,shadow=false){const l=new THREE.DirectionalLight(color,power);l.position.set(...pos);l.castShadow=shadow;if(shadow){l.shadow.mapSize.set(2048,2048);l.shadow.camera.left=-24;l.shadow.camera.right=24;l.shadow.camera.top=24;l.shadow.camera.bottom=-24;l.shadow.camera.near=1;l.shadow.camera.far=95;l.shadow.normalBias=.025;l.shadow.bias=-.00012;}scene.add(l);return l;}
 directional(0xf1f6ff,3.1,[-22,35,20],true);directional(0xa5c9e4,1.9,[25,12,-8]);directional(0xc5e2df,3.0,[-4,14,-30]);directional(0xaacbde,1.5,[0,-15,15]);
 resize();requestAnimationFrame(frame);
 $('load-message').textContent='Restoring materials and surface details…';
 const encoded=$('model-data').textContent.trim();const binary=atob(encoded);glbBytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)glbBytes[i]=binary.charCodeAt(i);$('model-data').remove();
 const gltf=await new GLTFLoader().parseAsync(glbBytes.buffer,'');model=gltf.scene;const box=new THREE.Box3().setFromObject(model);size=box.getSize(new THREE.Vector3());center=box.getCenter(new THREE.Vector3());model.position.sub(center);scene.add(model);fitRadius=size.length()/2*.90;
 const materialSet=new Set();model.traverse(o=>{if(o.isMesh){meshes.push(o);o.castShadow=true;o.receiveShadow=true;if(o.userData.component==='Landing gear')gearMeshes.push(o);for(const m of Array.isArray(o.material)?o.material:[o.material])materialSet.add(m);}});materials=[...materialSet];
 ground=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),new THREE.MeshStandardMaterial({color:0x080f15,roughness:.94,metalness:.12}));ground.rotation.x=-Math.PI/2;ground.position.y=-size.y/2-.055;ground.receiveShadow=true;scene.add(ground);
 grid=new THREE.GridHelper(180,90,0x527177,0x334a55);grid.position.y=ground.position.y+.008;grid.material.transparent=true;grid.material.opacity=.21;grid.material.depthWrite=false;scene.add(grid);
 ready=true;viewer.ready=true;viewer.renderer=renderer;viewer.scene=scene;viewer.model=model;viewer.camera=camera;resize();setView('hero',true);$('loader').classList.add('loaded');$('download').disabled=false;$('snapshot').disabled=false;
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
 $('wireframe').addEventListener('click',()=>wireframe(true));$('coated').addEventListener('click',()=>wireframe(false));
 $('gear').addEventListener('change',()=>{gearMeshes.forEach(o=>o.visible=$('gear').checked);document.querySelector('.hero-label p').textContent=$('gear').checked?'Reference-based model · Landing gear deployed':'Reference-based model · Landing gear hidden';});
 $('ground').addEventListener('change',updateGround);$('exposure').addEventListener('input',()=>{renderer.toneMappingExposure=Number($('exposure').value);$('exposure-value').value=renderer.toneMappingExposure.toFixed(2)+'×';});
 $('rotate').addEventListener('click',()=>{tween=null;setRotation(!controls.autoRotate);});
 $('reset').addEventListener('click',()=>{wireframe(false);$('gear').checked=true;gearMeshes.forEach(o=>o.visible=true);document.querySelector('.hero-label p').textContent='Reference-based model · Landing gear deployed';$('ground').checked=true;$('exposure').value='1';$('exposure-value').value='1.00×';renderer.toneMappingExposure=1;setView('hero');toast('View reset');});
 $('download').addEventListener('click',()=>download(new Blob([glbBytes],{type:'model/gltf-binary'}),'J36_Reference_Model.glb'));
 $('snapshot').addEventListener('click',()=>{renderer.render(scene,camera);canvas.toBlob(blob=>{if(blob){download(blob,'J36_view.png');toast('Image saved');}},'image/png');});
 document.addEventListener('keydown',event=>{if(event.target.matches('input,button,summary,a')||!ready)return;const keys={1:'hero',2:'top',3:'rear',4:'under',5:'front'};if(keys[event.key])setView(keys[event.key]);if(event.key.toLowerCase()==='r')$('reset').click();if(event.code==='Space'){event.preventDefault();$('rotate').click();}});
 new ResizeObserver(resize).observe(stage);
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fail('WebGL context lost. Reload this page.');$('load-message').textContent='The graphics context was interrupted. Reload the page to restore the model.';});
}
init().catch(fail);
