const http=require('http'),fs=require('fs'),path=require('path');
const root=__dirname,mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.mp4':'video/mp4','.png':'image/png','.vtt':'text/vtt','.srt':'text/plain','.md':'text/plain'};
http.createServer((req,res)=>{
 let rel;try{rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);res.end();return}
 let isRootFile=rel==='/'||['/What-Is-a-Transformer.mp4','/what-is-a-transformer-video.html','/README.md'].includes(rel);
 let supportRel=rel.startsWith('/transformer-video/')?rel.slice('/transformer-video'.length):rel;
 let file=isRootFile?path.resolve(root,'..',rel==='/'?'what-is-a-transformer-video.html':rel.slice(1)):path.resolve(root,'.'+(supportRel==='/'?'/index.html':supportRel));
 if(!isRootFile&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404);res.end('Not found');return}let start=0,end=stat.size-1,status=200;
 if(req.headers.range){let m=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!m){res.writeHead(416);res.end();return}start=+m[1];if(m[2])end=Math.min(+m[2],end);if(start>end||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return}status=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${stat.size}`)}
 res.writeHead(status,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':end-start+1,'Accept-Ranges':'bytes'});if(req.method==='HEAD')res.end();else fs.createReadStream(file,{start,end}).pipe(res);
 });
}).listen(4173,'127.0.0.1',()=>console.log('Video player: http://127.0.0.1:4173'));
