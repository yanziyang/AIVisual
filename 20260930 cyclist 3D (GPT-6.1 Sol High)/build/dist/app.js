import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const stage=document.querySelector('#stage');
const ui=Object.fromEntries(['play','play-label','pause-icon','play-icon','cadence','rpm','speed','orbit','loading','error','error-text'].map(id=>[id,document.getElementById(id)]));
const state={playing:!matchMedia('(prefers-reduced-motion: reduce)').matches,rpm:80,orbit:false,view:'perspective',ready:false};
let renderer,scene,camera,controls,mixer,model,clock,road,frame=0,elapsed=0,transition;
let mobileLayout=stage.clientWidth<600;
const gearRatio=3, wheelRadius=.363;
function decodeAsset(base64){const binary=atob(base64);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;}

function sync(){
  ui.play.setAttribute('aria-label',state.playing?'Pause cycling':'Play cycling');
  ui.play.setAttribute('aria-pressed',String(!state.playing));
  ui['play-label'].textContent=state.playing?'Pause':'Play';
  ui['pause-icon'].toggleAttribute('hidden',!state.playing);ui['play-icon'].toggleAttribute('hidden',state.playing);
  ui.cadence.value=state.rpm;
  ui.rpm.replaceChildren(document.createTextNode(state.rpm+' '),Object.assign(document.createElement('span'),{textContent:'rpm'}));
  ui.speed.textContent=(2*Math.PI*wheelRadius*gearRatio*state.rpm/60*3.6).toFixed(1);
  ui.orbit.setAttribute('aria-pressed',String(state.orbit));
  if(controls)controls.autoRotate=state.orbit;
  if(mixer)mixer.timeScale=state.playing?state.rpm/30:0;
}
function setPlaying(value){state.playing=value;sync();}
function setRPM(value){if(!Number.isFinite(value)||value<30||value>120)throw Error('Cadence must be between 30 and 120 rpm.');state.rpm=Math.round(value);sync();}
function cameraTarget(view){
  const mobile=stage.clientWidth<600;
  // Offset the subject to leave clear space for the typography on desktop.
  const target=new THREE.Vector3(mobile?0:-.35,mobile?1.02:1.05,0);
  const distance=mobile?5.8:4.4;
  const vectors={perspective:new THREE.Vector3(2.7,1.9,3.9),side:new THREE.Vector3(0,1.12,4.9),front:new THREE.Vector3(4.9,1.15,.01)};
  const pos=vectors[view].clone();pos.sub(new THREE.Vector3(0,1.05,0)).normalize().multiplyScalar(distance).add(target);
  return {pos,target};
}
function setView(view,immediate=false){
  if(!['perspective','side','front'].includes(view))throw Error('Unknown camera view.');
  state.view=view;
  const goal=cameraTarget(view);
  transition={from:camera.position.clone(),targetFrom:controls.target.clone(),...goal,progress:0};
  if(immediate){camera.position.copy(goal.pos);controls.target.copy(goal.target);transition=null;controls.update();}
  document.querySelectorAll('[data-view]').forEach(button=>{const active=button.dataset.view===view;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));});
}
function fail(error){
  console.error(error);ui.loading.hidden=true;ui.error.hidden=false;
  ui['error-text'].textContent=error?.message?.includes('WebGL')?'This browser couldn’t start 3D graphics. Try a browser with WebGL enabled.':'The rider could not load. Check your connection and try again.';
}

async function init(){
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.setSize(stage.clientWidth,stage.clientHeight);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  stage.appendChild(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();fail(Error('WebGL context lost'));});
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(35,stage.clientWidth/stage.clientHeight,.1,60);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;
  controls.enablePan=false;controls.minDistance=2.9;controls.maxDistance=7.5;
  controls.minPolarAngle=.25;controls.maxPolarAngle=Math.PI/2-.04;controls.autoRotateSpeed=.65;
  controls.addEventListener('start',()=>{transition=null;});
  const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();
  scene.environment=pmrem.fromScene(room,.04).texture;scene.environmentIntensity=.6;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe8f2ff,0xb4b2ab,.8));
  const key=new THREE.DirectionalLight(0xfff6e9,2.5);key.position.set(-2,6,4);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.1,far:15});
  key.shadow.normalBias=.035;key.shadow.bias=-.0001;key.shadow.radius=4;scene.add(key);
  const fill=new THREE.DirectionalLight(0xc3d8ff,.9);fill.position.set(3,2,-3);scene.add(fill);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({color:0x40516a,opacity:.15}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.007;ground.receiveShadow=true;scene.add(ground);
  road=new THREE.Group();scene.add(road);
  const markMat=new THREE.MeshBasicMaterial({color:0xd8dde5,transparent:true,opacity:.5});
  for(let j=0;j<11;j++){
    const mark=new THREE.Mesh(new THREE.PlaneGeometry(.30,.014),markMat);mark.rotation.x=-Math.PI/2;mark.position.set(j*.55-2.75,.002,.61);road.add(mark);
  }
  setView('perspective',true);sync();clock=new THREE.Clock();
  renderer.setAnimationLoop(()=>{
    const dt=Math.min(clock.getDelta(),.05);
    if(document.hidden)return;
    if(transition){
      transition.progress=Math.min(1,transition.progress+dt*2.3);const p=transition.progress;const ease=p*p*(3-2*p);
      camera.position.lerpVectors(transition.from,transition.pos,ease);controls.target.lerpVectors(transition.targetFrom,transition.target,ease);
      if(p===1)transition=null;
    }
    if(mixer)mixer.update(dt);
    if(state.playing&&state.ready){
      elapsed+=dt;const travel=2*Math.PI*wheelRadius*gearRatio*state.rpm/60;
      road.children.forEach(mark=>{mark.position.x-=travel*dt*.3;if(mark.position.x<-3)mark.position.x+=6.05;});
    }
    controls.update();renderer.render(scene,camera);frame++;
  });
  const embedded=window.__CADENCE_ASSETS__;
  const loader=new GLTFLoader();
  const gltf=embedded?await loader.parseAsync(decodeAsset(embedded.glb).buffer,''):await loader.loadAsync('./assets/cyclist.glb');
  model=gltf.scene;model.name='Cadence cyclist';
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(model);
  if(!gltf.animations.length)throw Error('The model has no riding animation.');
  mixer=new THREE.AnimationMixer(model);gltf.animations.forEach(clip=>mixer.clipAction(clip).play());
  state.ready=true;sync();ui.loading.hidden=true;
  if(embedded){
    const downloadURLs=[];
    document.querySelectorAll('[data-embedded-asset]').forEach(link=>{
      let url;
      link.addEventListener('click',event=>{
        if(url)return;
        event.preventDefault();
        const kind=link.dataset.embeddedAsset;
        url=URL.createObjectURL(new Blob([decodeAsset(embedded[kind])],{type:kind==='glb'?'model/gltf-binary':'application/octet-stream'}));
        downloadURLs.push(url);link.href=url;link.click();
      });
    });
    window.addEventListener('pagehide',()=>downloadURLs.forEach(url=>URL.revokeObjectURL(url)),{once:true});
  }
  // Read-only diagnostics also make it possible to verify the animation independently.
  window.cadenceStudio={getState:()=>({...state,animationTime:mixer.time,clips:gltf.animations.length,frame,modelBounds:new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).toArray()}),setPlaying,setRPM,setView};
  if(document.modelContext?.registerTool){
    const life=new AbortController();window.addEventListener('pagehide',()=>life.abort(),{once:true});
    Promise.resolve(document.modelContext.registerTool({name:'configure_cycling_studio',title:'Configure cycling studio',description:'Set playback, pedal cadence, or camera view in the cycling studio.',inputSchema:{type:'object',properties:{playing:{type:'boolean'},rpm:{type:'integer',minimum:30,maximum:120},view:{type:'string',enum:['perspective','side','front']}},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['playing','rpm','view'].includes(k)))throw Error('Invalid studio options.');if(input.rpm!==undefined&&(!Number.isInteger(input.rpm)||input.rpm<30||input.rpm>120))throw Error('Invalid cadence.');if(input.playing!==undefined&&typeof input.playing!=='boolean')throw Error('Invalid playback setting.');if(input.view!==undefined&&!['perspective','side','front'].includes(input.view))throw Error('Invalid view.');if(input.rpm!==undefined)setRPM(input.rpm);if(input.playing!==undefined)setPlaying(input.playing);if(input.view!==undefined)setView(input.view,true);return {playing:state.playing,rpm:state.rpm,view:state.view};}},{signal:life.signal})).catch(error=>console.warn('Studio tool unavailable',error));
  }
}

ui.play.addEventListener('click',()=>setPlaying(!state.playing));
ui.cadence.addEventListener('input',event=>setRPM(Number(event.target.value)));
ui.orbit.addEventListener('click',()=>{state.orbit=!state.orbit;sync();});
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{if(controls)setView(button.dataset.view);}));
document.querySelector('#reset').addEventListener('click',()=>{state.orbit=false;sync();if(controls)setView('perspective');});
document.addEventListener('keydown',event=>{if(event.code==='Space'&&!['INPUT','BUTTON','A'].includes(event.target.tagName)){event.preventDefault();setPlaying(!state.playing);}});
new ResizeObserver(()=>{if(!renderer)return;camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();renderer.setSize(stage.clientWidth,stage.clientHeight);const nextMobile=stage.clientWidth<600;if(nextMobile!==mobileLayout){mobileLayout=nextMobile;setView(state.view,true);}}).observe(stage);
sync();init().catch(fail);
