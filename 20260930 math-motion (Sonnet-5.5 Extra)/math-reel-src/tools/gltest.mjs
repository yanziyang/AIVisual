// Quick capability + speed probe for headless Chrome on this VM.
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const mode = process.argv[2] || 'd3d11';
const PAGE = `<!doctype html><meta charset=utf-8><body style="margin:0"><canvas id=c width=1920 height=1080></canvas><script>
(async()=>{
const out={};
const c=document.getElementById('c');
const gl=c.getContext('webgl2',{antialias:false,preserveDrawingBuffer:true});
out.gl=!!gl;
if(gl){
  const dbg=gl.getExtension('WEBGL_debug_renderer_info');
  out.renderer=dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):'?';
  out.floatRT=!!gl.getExtension('EXT_color_buffer_float');
  out.halfRT=!!gl.getExtension('EXT_color_buffer_half_float');
  out.maxTex=gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const vs='#version 300 es\\nin vec2 p;void main(){gl_Position=vec4(p,0,1);}';
  const fs='#version 300 es\\nprecision highp float;uniform float t;out vec4 o;void main(){vec2 z=vec2(0),c=(gl_FragCoord.xy/1080.-vec2(1.2,.5))*2.5;float n=0.;for(int i=0;i<200;i++){z=vec2(z.x*z.x-z.y*z.y,2.*z.x*z.y)+c;if(dot(z,z)>4.)break;n++;}o=vec4(vec3(n/200.),1);}';
  const mk=(t,s)=>{const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(sh);return sh};
  const pr=gl.createProgram();gl.attachShader(pr,mk(gl.VERTEX_SHADER,vs));gl.attachShader(pr,mk(gl.FRAGMENT_SHADER,fs));gl.linkProgram(pr);gl.useProgram(pr);
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  const px=new Uint8Array(1920*1080*4);
  let t0=performance.now();
  for(let i=0;i<3;i++){gl.drawArrays(gl.TRIANGLES,0,3);gl.readPixels(0,0,1920,1080,gl.RGBA,gl.UNSIGNED_BYTE,px);}
  out.mandel200_ms=(performance.now()-t0)/3;
}
// canvas2d speed
const c2=document.createElement('canvas');c2.width=1920;c2.height=1080;const x=c2.getContext('2d');
let t1=performance.now();
for(let f=0;f<10;f++){x.clearRect(0,0,1920,1080);x.globalCompositeOperation='lighter';x.lineWidth=2;for(let i=0;i<600;i++){x.strokeStyle='rgba(60,200,255,0.2)';x.beginPath();x.moveTo(960+Math.cos(i)*400,540+Math.sin(i)*400);x.lineTo(960+Math.cos(i*3.1+f)*400,540+Math.sin(i*3.1+f)*400);x.stroke();}}
out.c2d_600lines_ms=(performance.now()-t1)/10;
let t2=performance.now();for(let f=0;f<10;f++){x.getImageData(0,0,1920,1080);}
out.getImageData_ms=(performance.now()-t2)/10;
out.cores=navigator.hardwareConcurrency;
await fetch('/result',{method:'POST',body:JSON.stringify(out)});
})().catch(e=>fetch('/result',{method:'POST',body:'ERR '+e}));
</script>`;

const srv = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let b = ''; req.on('data', d => b += d); req.on('end', () => { console.log('RESULT', b); res.end('ok'); setTimeout(() => { ch.kill(); srv.close(); process.exit(0); }, 200); });
  } else { res.setHeader('content-type', 'text/html'); res.end(PAGE); }
});
srv.listen(8139);
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'gltest-'));
const flags = {
  d3d11: ['--enable-gpu', '--use-angle=d3d11', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  swift: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  default: [],
}[mode];
const ch = spawn(CHROME, ['--headless=new', '--no-first-run', `--user-data-dir=${prof}`, '--window-size=1920,1080', ...flags, 'http://localhost:8139/'], { stdio: 'ignore' });
setTimeout(() => { console.log('TIMEOUT'); ch.kill(); process.exit(1); }, 120000);
