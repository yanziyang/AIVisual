// Verify the standalone file itself, including browsers without WebGL or JS.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const url=pathToFileURL(path.join(__dirname,'..','fish-pond.html')).href;
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:960,height:675}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'?paused&t=4');
  await page.waitForFunction(()=>window.pond?.state.renderedFrames>0,null,{timeout:90000});
  if(process.argv.includes('--poster')){
   const data=await page.locator('#c').evaluate(c=>c.toDataURL('image/jpeg',.78));
   fs.writeFileSync(path.join(__dirname,'pond-poster.jpg'),Buffer.from(data.split(',')[1],'base64'));
   console.log('Generated startup poster from the actual pond canvas.');return;
  }
  assert.equal(errors.length,0);
  assert(await page.locator('#c').evaluate(c=>getComputedStyle(c).opacity==='1'));
  console.log(JSON.stringify({standaloneFile:true,rendered:true,errors}));
  const noGL=await browser.newPage({viewport:{width:960,height:675}});
  await noGL.addInitScript(()=>{const getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:getContext.call(this,type,...args);};});
  await noGL.goto(url);
  await noGL.waitForFunction(()=>!document.getElementById('err').hidden);
  assert(await noGL.locator('#pond-poster').evaluate(img=>img.complete&&img.naturalWidth>0));
  assert(await noGL.locator('#loader').evaluate(el=>el.hidden));
  await noGL.screenshot({path:path.join(__dirname,'pond-no-webgl.png')});
  await noGL.close();
  const noJS=await browser.newContext({javaScriptEnabled:false,viewport:{width:960,height:675}});
  const noJSPage=await noJS.newPage();await noJSPage.goto(url);
  assert(await noJSPage.locator('#pond-poster').isVisible());
  assert(!await noJSPage.locator('#loader').isVisible());
  assert(await noJSPage.locator('#javascript-notice').isVisible());
  await noJSPage.screenshot({path:path.join(__dirname,'pond-no-javascript.png')});
  console.log(JSON.stringify({noWebGLFallback:true,noJavaScriptFallback:true}));
  await noJS.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
