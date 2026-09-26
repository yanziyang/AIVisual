const fs=require('fs'), path=require('path'), cp=require('child_process');
const dir=__dirname, scenes=require('./scenes.json');
fs.mkdirSync(path.join(dir,'audio'),{recursive:true});
let script=`Add-Type -AssemblyName System.Speech\n$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer\n$voice.SelectVoice('Microsoft Zira Desktop')\n$voice.Rate = 0\n$voice.Volume = 100\n`;
for(let i=0;i<scenes.length;i++)for(let j=0;j<scenes[i].lines.length;j++){
 const file=path.join(dir,'audio',`${i}-${j}.wav`); const words=scenes[i].lines[j].replace(/'/g,"''");
 script+=`$voice.SetOutputToWaveFile('${file.replace(/'/g,"''")}')\n$voice.Speak('${words}')\n$voice.SetOutputToNull()\n`;
}
script+='$voice.Dispose()\n'; fs.writeFileSync(path.join(dir,'narrate.ps1'),'\ufeff'+script);
console.log('Generating local narration…');
cp.execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(dir,'narrate.ps1')],{stdio:'inherit'});
function wavSeconds(file){const b=fs.readFileSync(file);let rate=0,bytes=0;for(let p=12;p+8<=b.length;){let name=b.toString('ascii',p,p+4),n=b.readUInt32LE(p+4);if(name==='fmt ')rate=b.readUInt32LE(p+16);if(name==='data')bytes=n;p+=8+n+(n%2);}if(!rate||!bytes)throw Error('Invalid WAV');return bytes/rate;}
let t=0,segments=[],timeline=[];
for(let i=0;i<scenes.length;i++){let start=t;for(let j=0;j<scenes[i].lines.length;j++){let file=path.join(dir,'audio',`${i}-${j}.wav`);let duration=wavSeconds(file);segments.push({scene:i,line:j,start:t,end:t+duration,text:scenes[i].lines[j],file});t+=duration;}timeline.push({...scenes[i],start,end:t,index:i});}
fs.writeFileSync(path.join(dir,'timeline.json'),JSON.stringify({duration:t,scenes:timeline,segments},null,2));
fs.writeFileSync(path.join(dir,'audio','concat.txt'),segments.map(s=>`file '${s.file.replace(/\\/g,'/')}'`).join('\n'));
function stamp(t,sep=','){let ms=Math.round(t*1000),h=Math.floor(ms/3600000),m=Math.floor(ms/60000)%60,s=Math.floor(ms/1000)%60;return [h,m,s].map(x=>String(x).padStart(2,'0')).join(':')+sep+String(ms%1000).padStart(3,'0');}
let cues=[];for(const s of segments){const chunks=s.text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[s.text];const total=chunks.reduce((n,c)=>n+c.length,0);let p=s.start;for(let c of chunks){let end=p+(s.end-s.start)*c.length/total;cues.push({start:p,end,text:c.trim()});p=end;}}
fs.writeFileSync(path.join(dir,'captions.srt'),cues.map((s,i)=>`${i+1}\n${stamp(s.start)} --> ${stamp(s.end)}\n${s.text}\n`).join('\n'));
fs.writeFileSync(path.join(dir,'captions.vtt'),'WEBVTT\n\n'+cues.map(s=>`${stamp(s.start,'.')} --> ${stamp(s.end,'.')}\n${s.text}\n`).join('\n'));
fs.writeFileSync(path.join(dir,'transcript.md'),'# What Is a Transformer?\n\n'+timeline.map(s=>`## ${stamp(s.start,'.').slice(0,8)} — ${s.title}\n\n${s.lines.join('\n\n')}`).join('\n\n')+'\n\n## Sources\n\n- Vaswani et al., Attention Is All You Need (2017), sections 3–4: https://arxiv.org/abs/1706.03762\n- Dive into Deep Learning, Attention Scoring Functions: https://d2l.ai/chapter_attention-mechanisms-and-transformers/attention-scoring-functions.html\n- PyTorch, Scaled Dot Product Attention: https://docs.pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention.html\n- Dive into Deep Learning, Transformer: https://d2l.ai/chapter_attention-mechanisms-and-transformers/transformer.html\n- Dive into Deep Learning, Language Models: https://d2l.ai/chapter_recurrent-neural-networks/language-model.html\n\nAll diagrams are original. Numerical examples and illustrative probabilities are synthetic. Narration uses the installed Windows speech voice.\n');
console.log(`Narration ready: ${t.toFixed(1)} seconds, ${scenes.length} scenes.`);
