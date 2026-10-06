// Verify the standalone file itself, including startup and browsers without WebGL or JS.
const path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const url=pathToFileURL(path.join(__dirname,'..','fish-pond.html')).href;
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader']});
 try{
  const landing=await browser.newPage({viewport:{width:960,height:675}});
  await landing.addInitScript(()=>{window.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),8000);});
  await landing.goto(url,{waitUntil:'domcontentloaded'});
  assert(await landing.locator('#loader').isVisible());
  assert.equal(await landing.locator('#loader').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(20, 42, 32)');
  assert.equal(await landing.locator('#loader h1').textContent(),'Stillwater');
  assert.equal(await landing.locator('#pond-poster').count(),0);
  await landing.screenshot({path:path.join(__dirname,'pond-loading.png')});
  await landing.close();
  const page=await browser.newPage({viewport:{width:960,height:675}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'?paused&t=4');
  await page.waitForFunction(()=>document.body.dataset.startup==='ready',null,{timeout:90000});
  assert.equal(errors.length,0);
  assert(await page.locator('#c').evaluate(c=>getComputedStyle(c).opacity==='1'));
  assert(await page.locator('.header').isVisible());
  assert(await page.locator('.toolbar').isVisible());
  console.log(JSON.stringify({standaloneFile:true,loadingScreen:true,rendered:true,errors}));
  const noGL=await browser.newPage({viewport:{width:960,height:675}});
  await noGL.addInitScript(()=>{const getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:getContext.call(this,type,...args);};});
  await noGL.goto(url);
  await noGL.waitForFunction(()=>!document.getElementById('err').hidden);
  assert.equal(await noGL.locator('#pond-poster').count(),0);
  assert(await noGL.locator('#loader').evaluate(el=>el.hidden));
  await noGL.screenshot({path:path.join(__dirname,'pond-no-webgl.png')});
  await noGL.close();
  const noJS=await browser.newContext({javaScriptEnabled:false,viewport:{width:960,height:675}});
  const noJSPage=await noJS.newPage();await noJSPage.goto(url);
  assert.equal(await noJSPage.locator('#pond-poster').count(),0);
  assert(!await noJSPage.locator('#loader').isVisible());
  assert(await noJSPage.locator('#javascript-notice').isVisible());
  await noJSPage.screenshot({path:path.join(__dirname,'pond-no-javascript.png')});
  console.log(JSON.stringify({noWebGLFallback:true,noJavaScriptFallback:true}));
  await noJS.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
