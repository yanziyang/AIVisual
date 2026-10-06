import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const $ = id => document.getElementById(id);
const canvas = $('landscape');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#bdcccd');
scene.fog = new THREE.Fog('#bdcccd',140,310);
const camera = new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.1,600);
const overviewScale=()=>Math.max(1,Math.min(2.3,1/camera.aspect));
camera.position.set(87,76,100).multiplyScalar(overviewScale());
scene.fog.near=140*overviewScale();scene.fog.far=310*overviewScale();
let renderer;
try { renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true}); }
catch(error){$('loading-title').textContent='A 3D-capable browser is needed';$('loading-text').textContent='Please open this file in a browser with WebGL enabled.';throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.30;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;controls.dampingFactor=.065;controls.target.set(0,1,0);
controls.minDistance=9;controls.maxDistance=450;controls.maxPolarAngle=Math.PI*.475;controls.minPolarAngle=.10;controls.panSpeed=.6;
controls.autoRotateSpeed=.45;controls.enablePan=true;controls.screenSpacePanning=false;
const ambient=new THREE.HemisphereLight('#e6f3f5','#405b30',2.3);scene.add(ambient);
const sun=new THREE.DirectionalLight('#ffe6bd',3.2);sun.position.set(-38,65,35);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-66,right:66,top:66,bottom:-66,near:1,far:180});sun.shadow.normalBias=.13;sun.shadow.bias=-.00015;sun.shadow.radius=3;scene.add(sun);
const fill=new THREE.DirectionalLight('#c6e3ff',.5);fill.position.set(40,18,-45);scene.add(fill);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(600,600),new THREE.MeshStandardMaterial({color:'#bdcccd',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-3.53;ground.receiveShadow=true;scene.add(ground);

const views={
  panorama:{camera:[87,76,100],target:[0,1,0],title:'A world around the water',text:'Follow the shoreline through flower gardens, quiet lanes and a circle of woodland.',label:'Panorama'},
  house:{camera:[16,13,26],target:[0,3,0],title:'The forgotten maison',text:'At the heart of the lake, boarded windows, a broken roof and a moss-covered bridge tell a quieter story.',label:'Island house'},
  village:{camera:[27,19,52],target:[0,2,28],title:'La place des fleurs',text:'Shuttered cottages, climbing roses and café tables gather around the village fountain.',label:'Village square'},
  forest:{camera:[-57,24,34],target:[-34,3,8],title:'At the woodland edge',text:'Winding paths connect the village to the forest, through wildflowers and the shade of old trees.',label:'Forest trail'},
  chapel:{camera:[46,20,-6],target:[29,4,-29],title:'The little chapel',text:'Above the eastern shore, the chapel bell tower looks back across the lake toward the island.',label:'The chapel'}
};
let transition=null,activeView='panorama',tour=false,tourTimer=0,tourIndex=0,model=null,water=null;
const tourStops=['panorama','house','village','chapel','forest'];
const raycaster=new THREE.Raycaster();const mouse=new THREE.Vector2();
function stopTour(){tour=false;$('tour').setAttribute('aria-pressed','false');$('tour-text').textContent='Take a tour';clearTimeout(tourTimer);}
function goTo(key,fromTour=false){
  if(!views[key])return;if(!fromTour)stopTour();activeView=key;
  const v=views[key];controls.autoRotate=false;$('orbit').setAttribute('aria-pressed','false');
  const destination=new THREE.Vector3(...v.camera);if(key==='panorama')destination.multiplyScalar(overviewScale());
  transition={start:performance.now(),duration:reducedMotion?1:1800,from:camera.position.clone(),fromTarget:controls.target.clone(),to:destination,toTarget:new THREE.Vector3(...v.target)};
  $('location-title').textContent=v.title;$('location-text').textContent=v.text;
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===key)));
  $('view-name').textContent=v.label;
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>goTo(b.dataset.view)));
$('reset').addEventListener('click',()=>goTo('panorama'));
$('orbit').addEventListener('click',()=>{stopTour();transition=null;controls.autoRotate=!controls.autoRotate;$('orbit').setAttribute('aria-pressed',String(controls.autoRotate));});
function nextStop(){if(!tour)return;goTo(tourStops[tourIndex++%tourStops.length],true);tourTimer=setTimeout(nextStop,8500);}
$('tour').addEventListener('click',()=>{if(tour){stopTour();return;}tour=true;tourIndex=0;$('tour').setAttribute('aria-pressed','true');$('tour-text').textContent='Pause tour';nextStop();});
controls.addEventListener('start',()=>{transition=null;stopTour();controls.autoRotate=false;$('orbit').setAttribute('aria-pressed','false');});
const palettes={
  day:{bg:'#bdcccd',sky:'#e6f3f5',earth:'#405b30',sun:'#ffe6bd',sunPower:3.2,ambient:2.3,exposure:1.3,sunPos:[-38,65,35],water:'#2e9293'},
  golden:{bg:'#c5bbaa',sky:'#ffd6a8',earth:'#4b4739',sun:'#ffbc6a',sunPower:4,ambient:1.7,exposure:1.3,sunPos:[-60,24,24],water:'#467f79'},
  dusk:{bg:'#6b839b',sky:'#abc8ea',earth:'#263f40',sun:'#dbb5d9',sunPower:1.2,ambient:1.7,exposure:1.1,sunPos:[-34,18,-48],water:'#3f6b85'}
};
function lighting(key){const p=palettes[key];scene.background.set(p.bg);scene.fog.color.set(p.bg);ground.material.color.set(p.bg);ambient.color.set(p.sky);ambient.groundColor.set(p.earth);ambient.intensity=p.ambient;sun.color.set(p.sun);sun.intensity=p.sunPower;sun.position.set(...p.sunPos);renderer.toneMappingExposure=p.exposure;if(water)water.material.color.set(p.water);document.querySelectorAll('[data-light]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.light===key)));document.documentElement.dataset.light=key;}
document.querySelectorAll('[data-light]').forEach(b=>b.addEventListener('click',()=>lighting(b.dataset.light)));
$('full').addEventListener('click',async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{$('status').textContent='Fullscreen is unavailable in this preview.';}});
document.addEventListener('fullscreenchange',()=>{$('full').setAttribute('aria-pressed',String(!!document.fullscreenElement));});
$('markers').addEventListener('click',()=>{const hidden=$('hotspots').classList.toggle('hidden');$('markers').setAttribute('aria-pressed',String(!hidden));});
window.addEventListener('keydown',e=>{if(e.target instanceof HTMLButtonElement)return;if(e.key==='0'||e.key==='Home'){e.preventDefault();goTo('panorama');}if(['1','2','3','4'].includes(e.key)){e.preventDefault();goTo(['house','village','forest','chapel'][Number(e.key)-1]);}if(e.key==='Escape')stopTour();});

// The Blender GLB and the entire renderer are embedded into the final HTML.
const encoded=$('model-data').textContent.trim();
const binary=atob(encoded);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
new GLTFLoader().parse(bytes.buffer,'',gltf=>{
  model=gltf.scene;scene.add(model);
  model.traverse(obj=>{if(!obj.isMesh)return;obj.castShadow=true;obj.receiveShadow=true;
    if(obj.name==='Lake_surface'||obj.name==='Lake surface'||obj.material?.name==='water'){
      water=obj;obj.castShadow=false;obj.receiveShadow=true;
      obj.material=new THREE.MeshPhysicalMaterial({color:'#2e9293',roughness:.27,metalness:.15,clearcoat:1,clearcoatRoughness:.2});
      obj.material.onBeforeCompile=shader=>{
        shader.uniforms.uTime={value:0};obj.userData.shader=shader;
        shader.vertexShader='uniform float uTime;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\n objectNormal.x += .10*cos(position.x*1.5+uTime*.75); objectNormal.y += .07*sin(position.y*1.7+uTime*.65);');
      };
    }
  });
  $('loading').classList.add('loaded');setTimeout(()=>$('loading').remove(),650);
  $('status').textContent='Ready to explore';window.landscapeReady=true;
},error=>{$('loading-title').textContent='The landscape could not load';$('loading-text').textContent='Reload the page to try again.';console.error(error);});
const hotspots=[{id:'pin-house',pos:new THREE.Vector3(0,9,0)},{id:'pin-village',pos:new THREE.Vector3(0,2,29)},{id:'pin-chapel',pos:new THREE.Vector3(27,13,-31)}];
const projected=new THREE.Vector3();
function positionPins(){
  const w=innerWidth,h=innerHeight;
  for(const pin of hotspots){const el=$(pin.id);projected.copy(pin.pos).project(camera);const visible=projected.z<1&&projected.z>-1&&Math.abs(projected.x)<.93&&Math.abs(projected.y)<.91;el.style.display=visible?'flex':'none';el.style.transform=`translate(${(projected.x+1)*w/2}px,${(-projected.y+1)*h/2}px) translate(-50%,-100%)`;}
}
let lastTime=0;
function frame(now){requestAnimationFrame(frame);lastTime=now;
  if(transition){let t=Math.min(1,(now-transition.start)/transition.duration);t=t*t*(3-2*t);camera.position.lerpVectors(transition.from,transition.to,t);controls.target.lerpVectors(transition.fromTarget,transition.toTarget,t);if(t===1)transition=null;}
  controls.update();if(water?.userData.shader)water.userData.shader.uniforms.uTime.value=reducedMotion?0:now*.001;
  positionPins();renderer.render(scene,camera);
}
requestAnimationFrame(frame);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();scene.fog.near=140*overviewScale();scene.fog.far=310*overviewScale();renderer.setSize(innerWidth,innerHeight);});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
window.landscapeDebug={scene,camera,controls,renderer,goTo};
