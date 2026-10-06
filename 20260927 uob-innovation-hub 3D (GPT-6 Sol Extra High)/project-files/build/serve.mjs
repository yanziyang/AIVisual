import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..','dist');
http.createServer(async(req,res)=>{
  if(!['/','/index.html','/favicon.ico','/uob-innovation-hub.blend','/uob-innovation-hub.glb','/build/build_model.py'].includes(req.url)){res.writeHead(404);res.end('Not found');return;}
  if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
  const filename=req.url==='/'?'index.html':req.url.slice(1);
  try{res.writeHead(200,{'Content-Type':filename.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'});res.end(await fs.readFile(path.join(root,filename)));}catch{res.writeHead(500);res.end('Build the viewer first.');}
}).listen(4178,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4178'));
