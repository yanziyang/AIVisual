import { chromium } from 'file:///C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const root='C:/MyProjects/TempProject (OpenAI)/J36_Web';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1480,height:960},deviceScaleFactor:1});
const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
await page.route(/^https?:/,route=>route.abort());
const report={};
function assert(value,message){if(!value)throw new Error(message);}
try{
 await page.goto('file:///'+root+'/J36_Explorer.html');
 await page.waitForFunction(()=>window.j36Viewer?.ready,{},{timeout:90000});
 await page.waitForTimeout(1400);
 report.initial=await page.evaluate(()=>window.j36Viewer.getState());
 assert(report.initial.meshCount>400,'Expected all aircraft meshes');assert(report.initial.gearCount>20,'Missing landing gear component labels');
 await page.screenshot({path:root+'/qa/desktop.png'});
 for(const view of ['top','rear','under','front','hero']){
  await page.locator('[data-view="'+view+'"]').click();await page.waitForTimeout(850);
  const state=await page.evaluate(()=>window.j36Viewer.getState());
  assert(await page.locator('[data-view="'+view+'"]').getAttribute('aria-pressed')==='true','Preset button inactive: '+view);
  if(view==='under'){assert(state.groundVisible===false,'Ground obscures underside');await page.screenshot({path:root+'/qa/underside.png'});}
 }
 await page.locator('#wireframe').click();assert((await page.evaluate(()=>window.j36Viewer.getState())).wireframe,'Wireframe toggle failed');
 await page.locator('#gear').uncheck();assert(!(await page.evaluate(()=>window.j36Viewer.getState())).gearVisible,'Gear toggle failed');
 assert(await page.evaluate(()=>{let visible=0;window.j36Viewer.model.traverse(o=>{if(o.isMesh&&o.userData.component==='Landing gear'&&o.visible)visible++;});return visible===0;}),'Gear meshes not hidden');
 await page.locator('#ground').uncheck();assert(!(await page.evaluate(()=>window.j36Viewer.getState())).groundVisible,'Ground toggle failed');
 await page.locator('#exposure').fill('1.45');assert((await page.evaluate(()=>window.j36Viewer.getState())).exposure===1.45,'Exposure failed');
 await page.locator('#rotate').click();assert((await page.evaluate(()=>window.j36Viewer.getState())).autoRotate,'Auto rotate failed');
 const before=await page.evaluate(()=>window.j36Viewer.camera.position.toArray());await page.waitForTimeout(1200);const after=await page.evaluate(()=>window.j36Viewer.camera.position.toArray());assert(JSON.stringify(before)!==JSON.stringify(after),'Auto rotation camera did not move');
 await page.locator('#reset').click();await page.waitForTimeout(900);report.reset=await page.evaluate(()=>window.j36Viewer.getState());assert(report.reset.gearVisible&&!report.reset.wireframe&&report.reset.exposure===1&&!report.reset.autoRotate,'Reset incomplete');
 const glbDownload=page.waitForEvent('download');await page.locator('#download').click();const glb=await glbDownload;await glb.saveAs(root+'/qa/download.glb');const glbData=await fs.readFile(root+'/qa/download.glb');assert(glbData.subarray(0,4).toString()==='glTF','Invalid GLB download');
 const pngDownload=page.waitForEvent('download');await page.locator('#snapshot').click();const png=await pngDownload;await png.saveAs(root+'/qa/snapshot.png');const pngData=await fs.readFile(root+'/qa/snapshot.png');assert(pngData.subarray(1,4).toString()==='PNG','Invalid image download');
 await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForFunction(()=>window.j36Viewer?.ready,{},{timeout:90000});await page.waitForTimeout(1200);
 assert(await page.locator('#controls-panel').evaluate(e=>!e.open),'Mobile controls should begin collapsed');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile horizontal overflow');
 await page.screenshot({path:root+'/qa/mobile.png',fullPage:true});
 await page.locator('summary').click();await page.locator('[data-view="under"]').click();await page.waitForTimeout(900);assert((await page.evaluate(()=>window.j36Viewer.getState())).view.includes('UNDERSIDE'),'Mobile preset failed');
 await page.screenshot({path:root+'/qa/mobile-controls.png',fullPage:true});
 report.externalRequests=requests.filter(r=>/^https?:/.test(r));assert(report.externalRequests.length===0,'Standalone page requested a network resource');assert(errors.length===0,'Browser errors: '+errors.join(';'));
 report.result='PASS';report.checks=['Offline file:// load','434 model meshes','Five camera presets','Underside ground handling','Wireframe','Gear visibility','Ground grid','Lighting','Auto rotate camera movement','Reset','GLB download','PNG snapshot','Mobile layout','Mobile controls','Zero external network requests','Zero JavaScript errors'];
}catch(error){report.result='FAIL';report.error=String(error);await page.screenshot({path:root+'/qa/failure.png'}).catch(()=>{});}
report.errors=errors;await fs.writeFile(root+'/qa/test-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();if(report.result==='FAIL')process.exitCode=1;

