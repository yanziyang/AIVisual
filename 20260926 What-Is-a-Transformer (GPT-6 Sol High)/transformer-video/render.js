const fs=require('fs'), path=require('path'), cp=require('child_process'),{once}=require('events');
const {createCanvas}=require('@napi-rs/canvas'),ffmpeg=require('ffmpeg-static'),{draw}=require('./visuals');
const data=require('./timeline.json'),dir=__dirname,FPS=24,canvas=createCanvas(1280,720),ctx=canvas.getContext('2d');
const stamp=t=>new Date(Math.round(t)*1000).toISOString().slice(11,19);
async function render(){
 const audio=path.join(dir,'narration.wav');
 cp.execFileSync(ffmpeg,['-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',path.join(dir,'audio','concat.txt'),'-c:a','pcm_s16le',audio]);
 const meta=';FFMETADATA1\ntitle=What Is a Transformer?\nartist=JavaScript Field Notes\n'+data.scenes.map(s=>`[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.round(s.start*1000)}\nEND=${Math.round(s.end*1000)}\ntitle=${s.title}\n`).join('');
 fs.writeFileSync(path.join(dir,'chapters.ffmeta'),meta);
 const args=['-y','-hide_banner','-loglevel','warning','-f','rawvideo','-pixel_format','rgba','-video_size','1280x720','-framerate',String(FPS),'-i','pipe:0','-i',audio,'-i',path.join(dir,'captions.srt'),'-f','ffmetadata','-i',path.join(dir,'chapters.ffmeta'),'-map','0:v','-map','1:a','-map','2:s','-map_metadata','3','-map_chapters','3','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-c:s','mov_text','-metadata:s:s:0','language=eng','-movflags','+faststart','-t',String(data.duration),path.join(dir,'..','What-Is-a-Transformer.mp4')];
 const enc=cp.spawn(ffmpeg,args,{stdio:['pipe','ignore','pipe']});let errors='';enc.stderr.on('data',b=>errors+=b);enc.stdin.on('error',()=>{});
 const frames=Math.ceil(data.duration*FPS);let si=0,li=0,start=Date.now();
 for(let f=0;f<frames;f++){
  let t=f/FPS;while(si<data.scenes.length-1&&t>=data.scenes[si].end)si++;while(li<data.segments.length-1&&t>=data.segments[li].end)li++;
  draw(ctx,data.scenes[si],t,data.segments[li].text,data.duration);
  if(f%Math.floor(FPS*30)===0)console.log(`Rendered ${stamp(t)} / ${stamp(data.duration)} (${Math.round(100*f/frames)}%) • ${Math.round((Date.now()-start)/1000)}s elapsed`);
  if(!enc.stdin.write(Buffer.from(ctx.getImageData(0,0,1280,720).data)))await once(enc.stdin,'drain');
 }
 enc.stdin.end();const [code]=await once(enc,'close');if(code!==0)throw Error(errors);console.log('Video complete.');
 for(const s of data.scenes){draw(ctx,s,s.start+Math.min(5,(s.end-s.start)/2),s.lines[0],data.duration);fs.mkdirSync(path.join(dir,'stills'),{recursive:true});fs.writeFileSync(path.join(dir,'stills',String(s.index).padStart(2,'0')+'.png'),canvas.toBuffer('image/png'));}
 draw(ctx,data.scenes[0],4,'',data.duration);fs.writeFileSync(path.join(dir,'poster.png'),canvas.toBuffer('image/png'));
}
render().catch(e=>{console.error(e);process.exitCode=1});
