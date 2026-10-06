import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
const result=await build({entryPoints:['viewer.js'],bundle:true,minify:true,format:'iife',target:['es2020'],write:false,legalComments:'inline'});
const model=await readFile('model/landscape.glb');
const script=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const page=(await readFile('page.html','utf8')).replace('__MODEL_DATA__',model.toString('base64')).replace('__VIEWER_SCRIPT__',()=>script);
await mkdir('dist',{recursive:true});await writeFile('dist/index.html',page);
console.log(JSON.stringify({htmlBytes:Buffer.byteLength(page),glbBytes:model.length,fullyOffline:true}));
