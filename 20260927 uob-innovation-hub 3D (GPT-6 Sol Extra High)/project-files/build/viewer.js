import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $=id=>document.getElementById(id);
let renderer,controls,model,camera,scene,selected=0,transition=null,evening=false,dirty=true;
const meshes=[],towerMeshes=[],sectionPlane=new THREE.Plane(new THREE.Vector3(0,-1,0),40),frontPlane=new THREE.Plane(new THREE.Vector3(0,0,-1),1);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse=matchMedia('(pointer: coarse)').matches;
let viewport={w:innerWidth,h:innerHeight};

function fail(message){$('loading').hidden=false;$('loading').querySelector('.spinner').hidden=true;$('loading-description').textContent=message;document.querySelectorAll('.controls button,.controls input').forEach(b=>b.disabled=true);}
function init(){
  if(location.protocol==='file:'){
    const insideProject=decodeURIComponent(location.pathname).endsWith('/uob-innovation-hub/uob-innovation-hub.html');
    const prefix=insideProject?'./':'./uob-innovation-hub/';
    document.querySelectorAll('.downloads a').forEach(a=>{const file=a.getAttribute('href');a.href=prefix+file;});
  }
  scene=new THREE.Scene();
  scene.fog=new THREE.FogExp2(0x183137,.0017);
  camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.1,450);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,coarse?1.5:2));renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.localClippingEnabled=true;
  const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','3D model. Drag to orbit, scroll to zoom. Arrow keys rotate; plus and minus zoom; H resets.');
  $('stage').appendChild(canvas);
  controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=15;controls.maxDistance=205;controls.minPolarAngle=.015;controls.maxPolarAngle=Math.PI*.49;controls.autoRotateSpeed=.32;controls.panSpeed=.65;
  const hemi=new THREE.HemisphereLight(0xdbedf0,0x747967,2.6);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffe8c8,4.1);sun.position.set(-35,65,34);sun.castShadow=true;sun.shadow.mapSize.set(coarse?1024:2048,coarse?1024:2048);sun.shadow.camera.left=-62;sun.shadow.camera.right=62;sun.shadow.camera.top=52;sun.shadow.camera.bottom=-52;sun.shadow.camera.near=1;sun.shadow.camera.far=170;sun.shadow.normalBias=.08;sun.shadow.bias=-.00015;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xb2ced4,1.5);fill.position.set(45,30,-45);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(800,800),new THREE.ShadowMaterial({color:0x000000,opacity:.24}));floor.rotation.x=-Math.PI/2;floor.position.y=-1.36;floor.receiveShadow=true;scene.add(floor);
  setView('overview',false);
  const encoded=$('model-data').textContent.trim();const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
  new GLTFLoader().parse(bytes.buffer,'',gltf=>{
    model=gltf.scene;scene.add(model);
    model.traverse(o=>{
      if(!o.isMesh)return;
      const m=o.material;
      m.clippingPlanes=[sectionPlane];m.clipShadows=true;m.side=THREE.DoubleSide;
      o.castShadow=true;o.receiveShadow=true;
      o.userData.baseColor=m.color.clone();o.material=m.clone();
      // A tiny material grain adds cast-concrete warmth without external textures.
      if(m.name.includes('concrete')){
        o.material.onBeforeCompile=shader=>{
          shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>','#include <dithering_fragment>\nfloat grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);\ngl_FragColor.rgb*=0.987+0.026*grain;');
        };
      }
      meshes.push(o);if(o.userData.tower)towerMeshes.push(o);
    });
    $('loading').hidden=true;dirty=true;
    window.__viewer={ready:true,model,meshes,towerMeshes,renderer,camera,controls,get selected(){return selected;},get cutaway(){return $('cutaway').checked;},get section(){return sectionPlane.constant;}};
    requestAnimationFrame(frame);
  },error=>{console.error(error);fail('The embedded model could not be opened. Please reopen the original HTML file in a current browser.');});
  $('day').onclick=()=>setLighting(false);$('dusk').onclick=()=>setLighting(true);
  function setLighting(isEvening){
    evening=isEvening;hemi.intensity=evening?1.35:2.6;hemi.color.setHex(evening?0x99b7d9:0xdbedf0);sun.intensity=evening?2.9:4.1;sun.color.setHex(evening?0xffb87b:0xffe8c8);sun.position.set(evening?-62:-35,evening?24:65,34);fill.intensity=evening?1.1:1.5;renderer.toneMappingExposure=evening?1.06:1.12;
    $('day').setAttribute('aria-pressed',!evening);$('dusk').setAttribute('aria-pressed',evening);
    $('stage').style.background=evening?'radial-gradient(ellipse at 58% 42%,#354453,#111b2b 78%)':'radial-gradient(ellipse at 58% 42%,#365158,#10262b 78%)';scene.fog.color.setHex(evening?0x172438:0x183137);dirty=true;renderer.shadowMap.needsUpdate=true;
  }
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
  $('section').oninput=()=>{const v=+$('section').value;sectionPlane.constant=v===100?40:v/100*29;$('section-value').value=v===100?'Full building':`${Math.round(sectionPlane.constant*10)/10} m`;dirty=true;renderer.shadowMap.needsUpdate=true;};
  $('cutaway').onchange=()=>{for(const o of meshes){const cat=o.userData.category;o.material.clippingPlanes=$('cutaway').checked&&cat!=='site'&&cat!=='landscape'?[sectionPlane,frontPlane]:[sectionPlane];}$('view-label').textContent=$('cutaway').checked?'Atrium cutaway':'Free exploration';dirty=true;renderer.shadowMap.needsUpdate=true;};
  $('orbit').onchange=()=>{controls.autoRotate=$('orbit').checked;transition=null;};
  $('reset').onclick=reset;
  $('clear-selection').onclick=()=>selectTower(0);
  $('info').onclick=()=>$('about').showModal();$('close-about').onclick=()=>$('about').close();$('about').onclick=e=>{if(e.target===$('about')){const r=$('about').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('about').close();}};
  $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{ $('fullscreen').setAttribute('aria-label','Fullscreen is unavailable in this browser');}};
  document.addEventListener('fullscreenchange',()=>$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Enter fullscreen'));
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('The browser paused 3D rendering. Reload this page to reopen the model.');});
  controls.addEventListener('start',()=>{transition=null;});
  let down=null;
  canvas.addEventListener('pointerdown',e=>{if(e.button===0)down={x:e.clientX,y:e.clientY};});
  canvas.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5){down=null;return;}down=null;const rect=canvas.getBoundingClientRect();const pointer=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);const ray=new THREE.Raycaster();ray.setFromCamera(pointer,camera);const hits=ray.intersectObjects(meshes,false);const hit=hits.find(h=>h.point.y<=sectionPlane.constant&&(!$('cutaway').checked||['site','landscape'].includes(h.object.userData.category)||h.point.z<=1));selectTower(hit?.object.userData.tower||0);});
  canvas.addEventListener('keydown',e=>{
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','h','H'].includes(e.key)){
      e.preventDefault();transition=null;dirty=true;const sph=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      if(e.key==='ArrowLeft')sph.theta-=.09;if(e.key==='ArrowRight')sph.theta+=.09;if(e.key==='ArrowUp')sph.phi=Math.max(.02,sph.phi-.07);if(e.key==='ArrowDown')sph.phi=Math.min(Math.PI*.49,sph.phi+.07);if(e.key==='+'||e.key==='=')sph.radius=Math.max(15,sph.radius*.92);if(e.key==='-')sph.radius=Math.min(205,sph.radius*1.08);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph));controls.update();if(e.key.toLowerCase()==='h')reset();
    }
  });
  addEventListener('resize',()=>{viewport={w:innerWidth,h:innerHeight};camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);dirty=true;});
}

function reset(){
  $('section').value=100;$('section').oninput();$('cutaway').checked=false;$('cutaway').onchange();$('orbit').checked=false;controls.autoRotate=false;selectTower(0);$('day').click();setView('overview');
}
function setView(name,animate=true){
  dirty=true;
  const mobile=innerWidth<=760;
  const presets={overview:{position:mobile?[150,105,160]:[84,61,95],target:mobile?[0,6,0]:[0,9,0]},atrium:{position:mobile?[128,104,158]:[80,61,95],target:[0,12,0]},plan:{position:mobile?[0,335,.1]:[0,185,.1],target:[0,3,0]}};
  const p=presets[name];if(!p)return;
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===name));
  if(animate&&model){
    $('orbit').checked=false;controls.autoRotate=false;
    $('cutaway').checked=name==='atrium';$('cutaway').onchange();
    $('section').value=100;$('section').oninput();
  }
  const toP=new THREE.Vector3(...p.position),toT=new THREE.Vector3(...p.target);
  if(animate&&!reduced)transition={start:performance.now(),fromP:camera.position.clone(),fromT:controls.target.clone(),toP,toT};else {camera.position.copy(toP);controls.target.copy(toT);controls.update();}
  $('view-label').textContent={overview:'Exterior overview',atrium:'Open central atrium',plan:'Roof plan'}[name];
}
function selectTower(id){
  selected=id;dirty=true;
  for(const o of towerMeshes){o.material.emissive.setHex(id&&o.userData.tower===id?0x466044:0);o.material.emissiveIntensity=.22;}
  $('selection').hidden=!id;$('tower-name').textContent=`Tower ${String(id).padStart(2,'0')}`;
}
function frame(now){
  if(transition){dirty=true;const t=Math.min(1,(now-transition.start)/1000);const ease=t*t*(3-2*t);camera.position.lerpVectors(transition.fromP,transition.toP,ease);controls.target.lerpVectors(transition.fromT,transition.toT,ease);if(t===1)transition=null;}
  const changed=controls.update();
  // Place the building in the open centre of the layout rather than under the title.
  if(dirty||changed){camera.setViewOffset(viewport.w,viewport.h,viewport.w<=760?0:-viewport.w*.035,viewport.w<=760?viewport.h*.045:0,viewport.w,viewport.h);
    $('compass-dial').style.setProperty('--angle',`${-controls.getAzimuthalAngle()*180/Math.PI}deg`);
    renderer.render(scene,camera);dirty=false;
  }
  requestAnimationFrame(frame);
}
try{init();}catch(error){console.error(error);fail('3D rendering is unavailable. Open this HTML in a current browser with WebGL and hardware acceleration enabled.');}
