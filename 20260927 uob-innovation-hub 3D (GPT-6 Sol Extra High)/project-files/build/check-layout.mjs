import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require=createRequire('C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium}=require('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  for(const size of [{width:390,height:844},{width:320,height:720},{width:1440,height:1000}]){
    const context=await browser.newContext({viewport:size,deviceScaleFactor:1,isMobile:size.width<500,hasTouch:size.width<500});
    const page=await context.newPage();
    await page.goto(pathToFileURL(path.join(path.dirname(root),'uob-innovation-hub.html')).href,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>window.__viewer?.ready,{},{timeout:45000});
    await page.waitForTimeout(300);
    const check=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelectorAll('.controls button,.controls input')].map(b=>({id:b.id||b.textContent.trim(),left:b.getBoundingClientRect().left,right:b.getBoundingClientRect().right}))}));
    assert.equal(check.overflow,false);
    for(const c of check.controls){assert.ok(c.left>=0&&c.right<=check.width,`Control ${c.id} must fit`);}
    await page.screenshot({path:path.join(root,`qa/final-${size.width}.png`)});
    if(size.width===1440){
      await page.locator('[data-view="plan"]').click();await page.waitForTimeout(1200);await page.screenshot({path:path.join(root,'qa/final-plan.png')});
      await page.locator('[data-view="atrium"]').click();await page.waitForTimeout(1200);await page.screenshot({path:path.join(root,'qa/final-atrium.png')});
      await page.locator('.notes-jump').click();await page.screenshot({path:path.join(root,'qa/implementation.png'),fullPage:true});
    }
    console.log(JSON.stringify({viewport:size,passed:true,controls:check.controls.length}));
    await context.close();
  }
} finally {await browser.close();}
