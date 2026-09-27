/* ---------------- Pond camera, fish behavior & interaction ---------------- */
const TAU=Math.PI*2;
const pondState={tool:'ripple',paused:Q.has('paused')||matchMedia('(prefers-reduced-motion: reduce)').matches,wind:.35,light:'afternoon',count:8};
const lights={morning:{el:48,az:-35,warm:.05,brightness:.94,label:'Morning light'},afternoon:{el:56,az:55,warm:.16,brightness:1.08,label:'Afternoon light'},golden:{el:24,az:36,warm:.9,brightness:.86,label:'Golden hour'}};
let SUNV=[0,1,0],warm=.16,brightness=1.08;
const cam={yaw:.04,pitch:-1.06,distance:8.5,zoom:1,vy:0,vp:0};
const VFOV=48*Math.PI/180;
let drag=null,lastTap=null,pinch=null,currentBasis=null,simTime=0,toastTimer=0;
const $hint=document.getElementById('hint');
function notify(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2800);}
function applyLight(){const l=lights[pondState.light],el=l.el*Math.PI/180,az=l.az*Math.PI/180;SUNV=[Math.sin(az)*Math.cos(el),Math.sin(el),-Math.cos(az)*Math.cos(el)];warm=l.warm;brightness=l.brightness;document.getElementById('light-badge').textContent=l.label;document.querySelectorAll('[data-light]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.light===pondState.light)));}
applyLight();
function selectTool(tool){pondState.tool=tool;document.body.dataset.tool=tool;document.getElementById('ripple').setAttribute('aria-pressed',String(tool==='ripple'));document.getElementById('feed').setAttribute('aria-pressed',String(tool==='feed'));$hint.textContent=tool==='feed'?'Tap inside the pond to offer a few pellets':'Tap for ripples · Drag to orbit · Scroll to zoom';if(tool==='feed')notify('Tap the water to feed the koi');}
function togglePause(){pondState.paused=!pondState.paused;syncPause();notify(pondState.paused?'A moment, held still':'The pond is moving again');}
function syncPause(){const b=document.getElementById('pause');b.setAttribute('aria-pressed',String(pondState.paused));b.setAttribute('aria-label',pondState.paused?'Resume pond':'Pause pond');document.getElementById('pause-icon').innerHTML=pondState.paused?'<path d="M8 4l11 8-11 8V4Z"/>':'<path d="M8 5v14M16 5v14"/>';}
syncPause();
const aboutDialog=document.getElementById('about-dialog');
document.getElementById('ripple').onclick=()=>selectTool('ripple');
document.getElementById('feed').onclick=()=>selectTool('feed');
document.getElementById('pause').onclick=togglePause;
document.getElementById('reset-view').onclick=()=>{Object.assign(cam,{yaw:.04,pitch:-1.06,zoom:1,vy:0,vp:0});notify('Back to the pond');};
const settings=document.getElementById('settings'),settingsButton=document.getElementById('settings-toggle');
function showSettings(open){settings.hidden=!open;settingsButton.setAttribute('aria-expanded',String(open));if(open)document.getElementById('close-settings').focus();else settingsButton.focus();}
settingsButton.onclick=()=>showSettings(settings.hidden);
document.getElementById('close-settings').onclick=()=>showSettings(false);
document.getElementById('breeze').oninput=e=>{pondState.wind=+e.target.value/100;document.getElementById('breeze-value').value=pondState.wind<.10?'Still':pondState.wind<.55?'Gentle':'Lively';};
document.getElementById('population').oninput=e=>{pondState.count=+e.target.value;document.getElementById('population-value').value=pondState.count;document.getElementById('fish-count').textContent=`${pondState.count} koi`;};
const lightPicker=document.getElementById('light-picker'),lightToggle=document.getElementById('light-toggle');
function showLightPicker(open,restoreFocus=false){if(open&&!settings.hidden)showSettings(false);lightPicker.hidden=!open;lightToggle.setAttribute('aria-expanded',String(open));if(open)lightPicker.querySelector('[aria-pressed="true"]').focus();else if(restoreFocus)lightToggle.focus();}
lightToggle.onclick=()=>showLightPicker(lightPicker.hidden);
document.addEventListener('pointerdown',e=>{if(!lightPicker.hidden&&!lightPicker.contains(e.target)&&!lightToggle.contains(e.target))showLightPicker(false);});
document.addEventListener('focusin',e=>{if(!lightPicker.hidden&&!lightPicker.contains(e.target)&&!lightToggle.contains(e.target))showLightPicker(false);});
lightPicker.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();showLightPicker(false,true);}});
document.querySelectorAll('[data-light]').forEach(b=>b.onclick=()=>{pondState.light=b.dataset.light;applyLight();if(!lightPicker.hidden)showLightPicker(false,true);notify(lights[pondState.light].label);});
window.addEventListener('keydown',e=>{if(aboutDialog.open)return;if(e.key==='Escape'&&!settings.hidden){showSettings(false);return;}if(/^(INPUT|BUTTON|A|SELECT|TEXTAREA)$/.test(document.activeElement.tagName))return;let handled=true;if(e.code==='Space'||e.key===' ')togglePause();else if(e.key==='Enter'&&document.activeElement===canvas)lastTap=[innerWidth/2,innerHeight/2];else if(e.key==='ArrowLeft')cam.yaw-=.12;else if(e.key==='ArrowRight')cam.yaw+=.12;else if(e.key==='ArrowUp')cam.pitch=Math.max(-1.50,cam.pitch-.08);else if(e.key==='ArrowDown')cam.pitch=Math.min(-.78,cam.pitch+.08);else if(e.key==='+'||e.key==='=')cam.zoom=Math.max(.72,cam.zoom-.10);else if(e.key==='-')cam.zoom=Math.min(1.6,cam.zoom+.10);else if(e.key.toLowerCase()==='r')document.getElementById('reset-view').click();else if(e.key.toLowerCase()==='f')selectTool('feed');else handled=false;if(handled)e.preventDefault();});
const pointers=new Map();
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);cam.vy=cam.vp=0;drag={x:e.clientX,y:e.clientY,x0:e.clientX,y0:e.clientY,moved:false,t:performance.now()};if(pointers.size===2){const a=[...pointers.values()];pinch={distance:Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]),zoom:cam.zoom};drag.moved=true;}});
canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pinch&&pointers.size===2){const a=[...pointers.values()],d=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);cam.zoom=Math.max(.72,Math.min(1.6,pinch.zoom*pinch.distance/Math.max(20,d)));return;}if(!drag)return;const k=3/Math.min(innerWidth,innerHeight),dx=(e.clientX-drag.x)*k,dy=(e.clientY-drag.y)*k;cam.yaw-=dx;cam.pitch=Math.max(-1.5,Math.min(-.78,cam.pitch+dy*.5));cam.vy=-dx;cam.vp=dy*.5;drag.moved=drag.moved||Math.hypot(e.clientX-drag.x0,e.clientY-drag.y0)>8;drag.x=e.clientX;drag.y=e.clientY;});
canvas.addEventListener('pointerup',e=>{if(drag&&!drag.moved&&!pinch)lastTap=[e.clientX,e.clientY];pointers.delete(e.pointerId);drag=null;pinch=null;});
canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);drag=null;pinch=null;});
canvas.addEventListener('wheel',e=>{e.preventDefault();cam.zoom=Math.max(.72,Math.min(1.6,cam.zoom+e.deltaY*.0006));},{passive:false});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('The graphics connection was interrupted. Reload this file to return to the pond.');});
canvas.addEventListener('webglcontextrestored',()=>location.reload());
function camBasis(){const aspect=innerWidth/innerHeight,dist=cam.distance*cam.zoom*Math.max(1,1.08/aspect);const yaw=cam.yaw,pit=cam.pitch;const f=[Math.sin(yaw)*Math.cos(pit),Math.sin(pit),-Math.cos(yaw)*Math.cos(pit)],r=[Math.cos(yaw),0,Math.sin(yaw)],u=[-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]];return{f,r,u,pos:f.map(v=>-v*dist)};}
function pointOnWater(sx,sy,B){const nx=sx/innerWidth*2-1,ny=1-sy/innerHeight*2,tf=Math.tan(VFOV/2),asp=innerWidth/innerHeight,d=B.f.map((v,i)=>v+nx*asp*tf*B.r[i]+ny*tf*B.u[i]);if(d[1]>=-.01)return null;const t=-B.pos[1]/d[1];return[B.pos[0]+d[0]*t,B.pos[2]+d[2]*t];}
function radiusAt(a){return 2.48+.13*Math.sin(3*a+.5)+.12*Math.sin(5*a-1)+.065*Math.sin(8*a);}
function insidePond(x,z,margin=0){const xx=x/1.12,a=Math.atan2(z,xx);return Math.hypot(xx,z)<radiusAt(a)-margin;}
function makeRipple(x,z,strength=.045,radius=.018){if(!insidePond(x,z))return;const u=x/RSIZE+.5,v=z/RSIZE+.5;if(drops.length<24)drops.push([u,v,radius,strength]);ripActive=0;}
const fishRandom=mulberry(818),foodRandom=mulberry(281);
const fish=Array.from({length:10},(_,i)=>{const a=i*2.39996,r=.38+Math.sqrt(fishRandom())*1.40;return{x:Math.cos(a)*r,z:Math.sin(a)*r,heading:a+Math.PI/2,length:.47+fishRandom()*.22,depth:.18+fishRandom()*.20,pattern:[0,2,1,0,3,4,0,2,1,0][i],phase:fishRandom()*10,turn:0,target:[0,0],wander:0};});
const food=[];
const fishData=new Float32Array(40),fishInfo=new Float32Array(40),foodData=new Float32Array(96);
const rockCenters=new Float32Array(84),rockSizes=new Float32Array(84),rockRandom=mulberry(73);
for(let i=0;i<28;i++){const a=i*TAU/28,r=radiusAt(a)+.28;rockCenters.set([Math.cos(a)*r*1.12,.08+rockRandom()*.14,Math.sin(a)*r],i*3);rockSizes.set([.29+rockRandom()*.19,.24+rockRandom()*.20,.30+rockRandom()*.16],i*3);}
gl.useProgram(pMain.p);gl.uniform3fv(pMain.u.uRockCenter,rockCenters);gl.uniform3fv(pMain.u.uRockSize,rockSizes);
let feedings=0,eaten=0,rippleCount=0;
function feedAt(x,z){if(pondState.paused){notify('Resume the pond to feed the koi');return;}if(food.length>15){notify('Let the koi finish these first');return;}for(let i=0;i<8;i++){const a=foodRandom()*TAU,r=.05+foodRandom()*.15,px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;if(insidePond(px,pz,.07))food.push({x:px,z:pz,age:0});}feedings++;makeRipple(x,z,.025,.013);notify('A few pellets. Here they come.');}
function tapToDrop(sx,sy,B){const p=pointOnWater(sx,sy,B);if(!p||!insidePond(p[0],p[1],.06)){notify('Tap inside the water');return;}if(pondState.tool==='feed')feedAt(...p);else{if(pondState.paused){notify('Resume the pond to make ripples');return;}makeRipple(...p,.065,.021);rippleCount++;}}
function angleDelta(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
function updateFish(dt,t){
 for(let j=food.length-1;j>=0;j--){const f=food[j];f.age+=dt;f.x+=Math.sin(t*.5+j)*dt*.004;f.z+=Math.cos(t*.4+j)*dt*.004;if(f.age>24)food.splice(j,1);}
 for(let i=0;i<pondState.count;i++){
  const f=fish[i];let closest=null,min=Infinity;for(const p of food){const d=Math.hypot(p.x-f.x,p.z-f.z);if(d<min){min=d;closest=p;}}
  f.wander-=dt;if(f.wander<=0){const a=fishRandom()*TAU,r=Math.sqrt(fishRandom())*1.9;f.target=[Math.cos(a)*r,Math.sin(a)*r];f.wander=3+fishRandom()*7;}
  let tx=closest?closest.x:f.target[0],tz=closest?closest.z:f.target[1];let dx=tx-f.x,dz=tz-f.z;
  // Repel nearby bodies and turn early at the irregular rock boundary.
  for(let j=0;j<pondState.count;j++){if(j===i)continue;const other=fish[j],ex=f.x-other.x,ez=f.z-other.z,d=Math.hypot(ex,ez);if(d<.40){dx+=ex/(d+.01)*(.40-d)*1.8;dz+=ez/(d+.01)*(.40-d)*1.8;}}
  const edge=radiusAt(Math.atan2(f.z,f.x/1.12))-.45,r=Math.hypot(f.x/1.12,f.z);if(r>edge){dx-=f.x*3*(r-edge+.25);dz-=f.z*3*(r-edge+.25);}
  let desired=Math.atan2(dx,dz);let turn=angleDelta(desired,f.heading);f.heading+=Math.max(-1.5*dt,Math.min(1.5*dt,turn));f.turn=turn;
  const speed=(closest?.42:.17+.025*Math.sin(t*.6+f.phase))*Math.max(.36,1-Math.abs(turn)*.22);
  f.x+=Math.sin(f.heading)*speed*dt;f.z+=Math.cos(f.heading)*speed*dt;
  if(!insidePond(f.x,f.z,.36)){const rr=Math.hypot(f.x/1.12,f.z),limit=radiusAt(Math.atan2(f.z,f.x/1.12))-.4;f.x*=limit/rr;f.z*=limit/rr;f.target=[0,0];}
  const depthTarget=closest?.105:.24+.08*Math.sin(t*.3+f.phase);f.depth+=(depthTarget-f.depth)*Math.min(1,dt*1.2);
  if(closest&&min<.14){const index=food.indexOf(closest);if(index>=0){food.splice(index,1);eaten++;makeRipple(f.x,f.z,.012,.007);}}
 }
}
function uploadPond(){for(let i=0;i<10;i++){const f=fish[i];fishData.set([f.x,f.z,f.heading,f.length],i*4);fishInfo.set([f.depth,f.pattern,f.phase,0],i*4);}foodData.fill(0);for(let i=0;i<food.length;i++)foodData.set([food[i].x,food[i].z,food[i].age,0],i*4);const u=pMain.u;gl.uniform4fv(u.uFish,fishData);gl.uniform4fv(u.uFishInfo,fishInfo);gl.uniform1i(u.uFishCount,pondState.count);gl.uniform4fv(u.uFood,foodData);gl.uniform1i(u.uFoodCount,food.length);gl.uniform1f(u.uWind,.06+pondState.wind*1.2);gl.uniform1f(u.uWarm,warm);gl.uniform1f(u.uBrightness,brightness);}
// An inspectable, read-only snapshot is useful for verifying the simulation.
window.pond={get state(){return{...pondState,feedings,eaten,ripples:rippleCount,pellets:food.length,time:simTime,fish:fish.slice(0,pondState.count).map(f=>({x:f.x,z:f.z,depth:f.depth})),camera:{...cam},renderedFrames:renderedFrames};},waterPoint:(x,y)=>currentBasis?pointOnWater(x,y,currentBasis):null};

/* ---------------- Loop: upstream FFT, ripple solver, caustics & post ---------------- */
alloc();
const $dbg=document.getElementById('dbg');if(DEBUG)$dbg.hidden=false;
let last=performance.now(),frames=0,ftAvg=16,renderedFrames=0,ready=false,wasPaused=pondState.paused,oneStep=0;
let snapshotAt=0,lastDraw=0,lastScene='',lastCausticLight=null;
function frame(now){
 requestAnimationFrame(frame);
 if(now-lastDraw<1000/30)return;
 lastDraw=now;
 if(gl.isContextLost())return;
 const elapsed=(now-last)/1000,dt=Math.min(.05,elapsed);last=now;
 if(document.hidden||aboutDialog.open)return;
 if(!pebReady)return;
 if(!pondState.paused)simTime+=dt;
 const t=FIXED_T!==null?FIXED_T:simTime;
 if(!drag){cam.yaw+=cam.vy*.84;cam.pitch=Math.max(-1.5,Math.min(-.78,cam.pitch+cam.vp*.84));cam.vy*=.84;cam.vp*=.84;}
 const B=camBasis();currentBasis=B;
 if(lastTap){tapToDrop(...lastTap,B);lastTap=null;}
 const sceneKey=[W,H,cam.yaw,cam.pitch,cam.zoom,pondState.light,pondState.wind,pondState.count].join(',');
 if(pondState.paused&&ready&&sceneKey===lastScene){if(now-snapshotAt>500){canvas.dataset.pondState=JSON.stringify(window.pond.state);snapshotAt=now;}return;}
 lastScene=sceneKey;
 const advance=!pondState.paused||!ready||FIXED_T!==null&&oneStep<4;
 if(advance){runFFT(t*.55);stepRipples([0,0]);ripActive++;if(!pondState.paused)updateFish(dt,t);oneStep++;}
 // Sunlight can change while the water and fish remain paused.
 if(advance||lastCausticLight!==pondState.light){renderCaustics(SUNV);lastCausticLight=pondState.light;}
 if(wasPaused!==pondState.paused){wasPaused=pondState.paused;}
 target(hdrRT);gl.disable(gl.BLEND);gl.useProgram(pMain.p);
 bindT(0,surfRT.t);bindT(1,causRT.t);bindT(2,pebTex);bindT(3,ripN.t);
 const u=pMain.u;
 gl.uniform1i(u.uSurf,0);gl.uniform1i(u.uCaus,1);gl.uniform1i(u.uPeb,2);gl.uniform1i(u.uRip,3);
 gl.uniform3fv(u.uCam,B.pos);gl.uniform3fv(u.uR,B.r);gl.uniform3fv(u.uU,B.u);gl.uniform3fv(u.uF,B.f);gl.uniform3fv(u.uSun,SUNV);
 gl.uniform1f(u.uTanF,Math.tan(VFOV/2));gl.uniform1f(u.uAspect,W/H);gl.uniform1f(u.uL,L);gl.uniform1f(u.uDepth,DEPTH);gl.uniform1f(u.uTime,t);
 gl.uniform1f(u.uRipSize,RSIZE);gl.uniform2fv(u.uRipCenter,ripCenter);gl.uniform2fv(u.uCausShift,causShift);uploadPond();fullscreen();post(t);
 renderedFrames++;if(!ready){ready=true;document.getElementById('loader').classList.add('ready');setTimeout(()=>document.getElementById('loader').hidden=true,650);}
 if(now-snapshotAt>500){canvas.dataset.pondState=JSON.stringify(window.pond.state);snapshotAt=now;}
 if(FIXED_T===null){ftAvg=ftAvg*.96+Math.min(100,elapsed*1000)*.04;frames++;if(frames>60){if(ftAvg>47&&quality>.40){quality=Math.max(.40,quality*.85);alloc();frames=0;}else if(ftAvg<38&&quality<.95){quality=Math.min(.95,quality*1.04);alloc();frames=0;}}if(DEBUG&&frames%15===0)$dbg.textContent=`${(1000/ftAvg).toFixed(0)} fps · ${W}×${H} · q ${quality.toFixed(2)}`;}
}
requestAnimationFrame(frame);

