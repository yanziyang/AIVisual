import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require=createRequire('C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium}=require('playwright');
console.log('Launching test browser');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const page=await context.newPage();
const errors=[];const requests=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('request',r=>requests.push(r.url()));
console.log('Opening viewer');
await page.goto('http://127.0.0.1:4178',{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForFunction(()=>window.__viewer?.ready,{},{timeout:45000});
console.log('Model loaded');
await page.screenshot({path:path.join(root,'qa/desktop.png')});
assert.equal(await page.locator('#loading').isVisible(),false);
await page.locator('.notes-jump').click();assert.equal(await page.locator('#notes-title').isVisible(),true);assert.match(await page.locator('.project-notes blockquote').textContent(),/Build the 3D model using Blender/);await page.locator('.notes-top a').click();
const towers=await page.evaluate(()=>Array.from(new Set(__viewer.towerMeshes.map(o=>o.userData.tower))));
assert.equal(towers.length,12);
// Drag and wheel must move the actual camera.
const before=await page.evaluate(()=>__viewer.camera.position.toArray());
await page.mouse.move(740,520);await page.mouse.down();await page.mouse.move(825,550,{steps:10});await page.mouse.up();
await page.waitForTimeout(300);
assert.notDeepEqual(await page.evaluate(()=>__viewer.camera.position.toArray()),before);
const distance=await page.evaluate(()=>__viewer.camera.position.distanceTo(__viewer.controls.target));
await page.mouse.wheel(0,-300);await page.waitForTimeout(300);
assert.ok(await page.evaluate(()=>__viewer.camera.position.distanceTo(__viewer.controls.target))<distance);
await page.locator('#reset').click();await page.waitForTimeout(1200);
// Clicking visible tower surfaces must expose a tower selection.
let picked=false;
for(const pos of [[780,450],[660,460],[860,430],[720,390],[630,430],[850,520]]){
  await page.mouse.click(...pos);if(await page.locator('#selection').isVisible()){picked=true;break;}
}
assert.ok(picked,'A visible tower must be selectable');
await page.locator('#clear-selection').click();assert.equal(await page.locator('#selection').isVisible(),false);
await page.locator('[data-view="atrium"]').click();await page.waitForTimeout(1200);
assert.equal(await page.locator('#cutaway').isChecked(),true);
assert.ok(await page.evaluate(()=>__viewer.towerMeshes.every(o=>o.material.clippingPlanes.length===2)));
await page.screenshot({path:path.join(root,'qa/atrium.png')});
await page.locator('#section').fill('48');
assert.ok(await page.evaluate(()=>__viewer.section>13&&__viewer.section<15));
assert.match(await page.locator('#section-value').textContent(),/m/);
await page.locator('[data-view="plan"]').click();await page.waitForTimeout(1200);
assert.equal(await page.locator('#cutaway').isChecked(),false);
await page.screenshot({path:path.join(root,'qa/plan.png')});
await page.locator('#dusk').click();assert.equal(await page.locator('#dusk').getAttribute('aria-pressed'),'true');
await page.locator('#orbit').check();assert.ok(await page.evaluate(()=>__viewer.controls.autoRotate));
await page.locator('#reset').click();await page.waitForTimeout(1200);
assert.equal(await page.locator('#orbit').isChecked(),false);
assert.equal(await page.locator('#section').inputValue(),'100');
await page.locator('#info').click();assert.equal(await page.locator('#about').isVisible(),true);await page.keyboard.press('Escape');
await page.locator('canvas').focus();const keyBefore=await page.evaluate(()=>__viewer.camera.position.toArray());await page.keyboard.press('ArrowLeft');assert.notDeepEqual(await page.evaluate(()=>__viewer.camera.position.toArray()),keyBefore);
const renderStats=await page.evaluate(()=>({calls:__viewer.renderer.info.render.calls,triangles:__viewer.renderer.info.render.triangles}));
// Open the same HTML using file:// and block all network requests: standalone means offline.
await context.close();
const offline=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
await offline.setOffline(true);
const mobile=await offline.newPage();
mobile.on('pageerror',e=>errors.push(e.message));
await mobile.goto(pathToFileURL(path.join(path.dirname(root),'uob-innovation-hub.html')).href,{waitUntil:'domcontentloaded',timeout:60000});
await mobile.waitForFunction(()=>window.__viewer?.ready,{},{timeout:45000});
assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
await mobile.screenshot({path:path.join(root,'qa/mobile.png')});
await mobile.locator('[data-view="atrium"]').click();await mobile.waitForTimeout(1200);assert.equal(await mobile.locator('#cutaway').isChecked(),true);
await mobile.setViewportSize({width:320,height:720});await mobile.screenshot({path:path.join(root,'qa/mobile-small.png')});
assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
await mobile.locator('#info').click();assert.equal(await mobile.locator('#about').isVisible(),true);
const result={passed:true,towers:towers.length,renderStats,networkRequests:requests.filter(u=>!u.startsWith('http://127.0.0.1:4178')),offlineFileLoad:true,controls:['orbit drag','wheel zoom','tower selection','atrium cutaway','height clipping','plan view','day/evening','auto orbit','reset','information dialog','keyboard navigation'],viewports:['1440x1000','390x844','320x720'],errors};
assert.deepEqual(errors,[]);assert.equal(result.networkRequests.length,0);
await fs.writeFile(path.join(root,'qa/results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
} finally { await browser.close(); }
