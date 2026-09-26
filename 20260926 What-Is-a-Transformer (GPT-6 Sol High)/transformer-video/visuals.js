/* Deterministic Canvas animation. Shared by the renderer and editable browser preview. */
(function(scope){
const C={bg:'#091421',panel:'#122338',edge:'#294158',white:'#f1f5ee',muted:'#a4b5c6',mint:'#78f3c7',coral:'#ff9b83',purple:'#b5a3ff',yellow:'#f3d78c'};
function draw(ctx,scene,t,subtitle='',duration=1){
const W=1280,H=720,p=Math.max(0,t-scene.start),fade=Math.min(1,p/0.7),phase=Math.floor((p/Math.max(.1,scene.end-scene.start))*2);
ctx.fillStyle=C.bg;ctx.fillRect(0,0,W,H);
const glow=ctx.createRadialGradient(1050,200,0,1050,200,720);glow.addColorStop(0,'#173147');glow.addColorStop(1,C.bg);ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
ctx.strokeStyle='#ffffff08';ctx.lineWidth=1;for(let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
function text(s,x,y,size=26,color=C.white,font='Segoe UI',align='left'){ctx.font=`${size>=36?'600':'400'} ${size}px "${font}"`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(s,x,y);ctx.textAlign='left';}
function wrap(s,x,y,max=1120,size=25,color=C.white){ctx.font=`400 ${size}px "Segoe UI"`;let words=s.split(' '),line='',lines=[];for(let w of words){let a=line?line+' '+w:w;if(ctx.measureText(a).width>max&&line){lines.push(line);line=w;}else line=a;}if(line)lines.push(line);lines.forEach((l,i)=>text(l,x,y+i*(size+9),size,color));return lines.length;}
function box(x,y,w,h,label='',color=C.mint,size=25){ctx.fillStyle=C.panel;ctx.strokeStyle=color+'66';ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect(x,y,w,h,15);ctx.fill();ctx.stroke();if(label)text(label,x+w/2,y+h/2+size*.35,size,color,'Segoe UI','center');}
function line(x,y,a,b,color=C.mint,width=2,arrow=true){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(a,b);ctx.stroke();if(arrow){let q=Math.atan2(b-y,a-x);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(a-10*Math.cos(q-.5),b-10*Math.sin(q-.5));ctx.lineTo(a-10*Math.cos(q+.5),b-10*Math.sin(q+.5));ctx.fill();let travel=(p*.38)%1;ctx.fillStyle=C.white;ctx.beginPath();ctx.arc(x+(a-x)*travel,y+(b-y)*travel,3.5,0,Math.PI*2);ctx.fill();}}
function pill(s,x,y,color=C.mint,w=170){box(x,y,w,55,s,color,25);}
function mono(s,x,y,size=30,color=C.white,align='left'){const safe=s.replace(/ₖ/g,'_k').replace(/ᵥ/g,'_v').replace(/ᵢ/g,'_i').replace(/ⱼ/g,'_j').replace(/₁/g,'_1').replace(/₂/g,'_2');text(safe,x,y,size,color,'Consolas',align);}
function note(s,y=530){text(s,640,y,23,C.muted,'Segoe UI','center');}
function flow(items,y=310,width=180){let total=items.length*width+(items.length-1)*42,x=(1280-total)/2;items.forEach((s,i)=>{box(x+i*(width+42),y,width,80,s,i%2?C.purple:C.mint,22);if(i<items.length-1)line(x+(i+1)*width+i*42+6,y+40,x+(i+1)*(width+42)-6,y+40);});}
function bars(labels,values,x=540,y=230,w=510,colors=[C.mint,C.coral,C.purple],fmt=v=>(v*100).toFixed(1)+'%'){values.forEach((v,i)=>{text(labels[i],x-65,y+i*91+26,26,colors[i]);ctx.fillStyle=C.edge;ctx.beginPath();ctx.roundRect(x,y+i*91,w,36,8);ctx.fill();ctx.fillStyle=colors[i];ctx.beginPath();ctx.roundRect(x,y+i*91,Math.max(5,w*v*Math.min(1,p/2)),36,8);ctx.fill();text(fmt(v),x+w+22,y+i*91+28,25,colors[i]);});}
function grid(mask=false){const x=570,y=200,n=5,s=55;for(let i=0;i<n;i++){text(String(i+1),x-28,y+i*s+33,20,C.muted);text(String(i+1),x+i*s+26,y-15,20,C.muted,'Segoe UI','center');for(let j=0;j<n;j++){let a=mask&&j>i;ctx.fillStyle=a?'#293345':`rgba(120,243,199,${.15+.55*(.5+.5*Math.sin(i*3+j*5))})`;ctx.beginPath();ctx.roundRect(x+j*s,y+i*s,s-5,s-5,7);ctx.fill();if(a)text('×',x+j*s+25,y+i*s+32,23,C.coral,'Segoe UI','center');}}
text('keys →',x+130,y-50,21,C.muted,'Segoe UI','center');text('queries',x-135,y+130,21,C.muted);}
text('FIELD NOTES / AI EXPLAINED',64,35,17,C.mint);text(`${String(scene.index+1).padStart(2,'0')} / 26`,1216,35,17,C.muted,'Consolas','right');
ctx.save();ctx.globalAlpha=fade;ctx.translate(0,12*(1-fade));
text(scene.title,64,94,44);text(scene.tag,66,132,17,C.muted);
switch(scene.type){
case 'intro':{
 text('TRANS',76,285,96,C.white);text('FORMER',76,380,96,C.mint);text('How numbers learn to use context',80,452,26,C.muted);
 const nodes=Array.from({length:7},(_,i)=>({x:880+200*Math.cos(i/7*Math.PI*2+p*.12),y:340+160*Math.sin(i/7*Math.PI*2+p*.12)}));nodes.forEach((a,i)=>nodes.forEach((b,j)=>{if(j>i)line(a.x,a.y,b.x,b.y,'#78f3c733',1,false);}));nodes.forEach((a,i)=>{ctx.fillStyle=[C.mint,C.purple,C.coral][i%3];ctx.beginPath();ctx.arc(a.x,a.y,13+2*Math.sin(p+i),0,Math.PI*2);ctx.fill();});break;}
case 'context':
 box(90,215,500,220);box(690,215,500,220,'',C.coral);text('the river',135,280,36);pill('bank',340,239);text('water · shore · landscape',135,378,25,C.mint);text('the',735,280,36);pill('bank',815,239,C.coral);text('approved my loan',735,335,33);text('money · lending · finance',735,397,25,C.coral);note('Same token, different contextual representations.');break;
case 'tokens':
 text('“The transformer is learning.”',640,218,37,C.white,'Segoe UI','center');['The','transform','er','is','learning','.'].forEach((s,i)=>{box(65+i*194,265,178,62,s,i===2?C.coral:C.mint,24);mono(['101','202','303','404','505','606'][i],154+i*194,382,27,C.muted,'center');line(154+i*194,335,154+i*194,352);});note('Illustrative token split and IDs; real tokenizer outputs vary.');break;
case 'embedding':
 box(80,240,180,75,'token ID',C.coral);line(275,278,360,278);box(375,210,270,150,'embedding lookup',C.mint);line(660,278,745,278);box(765,232,415,95,'[0.2, −0.7, 1.1, …]',C.purple,31);text('learned numerical coordinates',970,373,24,C.muted,'Segoe UI','center');note('A vector is a list of numbers. Dimensions need not have tidy meanings.');break;
case 'position':
 flow(['dog','bites','person'],200,215);flow(['person','bites','dog'],320,215);mono('xᵢ = embedding(tokenᵢ) + positionᵢ',640,484,34,C.mint,'center');break;
case 'network':{
 const words=['The','river','bank','was','muddy'];words.forEach((w,i)=>{pill(w,95+i*226,360,i===2?C.coral:C.mint,185);let x=188+i*226;ctx.strokeStyle=i===1||i===4?C.mint:C.edge;ctx.lineWidth=i===1||i===4?5:2;ctx.beginPath();ctx.moveTo(640,270);ctx.quadraticCurveTo(x,280,x,350);ctx.stroke();let a=(p*.2+i*.17)%1;ctx.fillStyle=C.mint;ctx.beginPath();ctx.arc(640*(1-a)+x*a,270+80*a,5,0,Math.PI*2);ctx.fill();});box(540,195,200,70,'bank’s query',C.coral,24);note('Illustrative connections; actual attention patterns are learned.');break;}
case 'qkv':
 box(75,280,240,80,'input vector X',C.white);['Q = X W_Q','K = X W_K','V = X W_V'].forEach((s,i)=>{line(330,320,520,215+i*130,[C.mint,C.coral,C.purple][i]);box(540,180+i*130,260,72,s,[C.mint,C.coral,C.purple][i],29);text(['QUERY / request','KEY / match','VALUE / content'][i],850,225+i*130,28,[C.mint,C.coral,C.purple][i]);});break;
case 'projection':
 mono('[1, 2]',110,318,44,C.mint);text('×',385,318,44,C.muted);box(450,220,220,170,'',C.purple);mono('1    2',560,278,35,C.purple,'center');mono('0   −1',560,343,35,C.purple,'center');text('=',735,318,44,C.muted);mono('[1, 0]',860,318,44,C.coral);mono('1×1 + 2×0 = 1',640,441,28,C.white,'center');mono('1×2 + 2×(−1) = 0',640,486,28,C.white,'center');break;
case 'toy':
 box(75,230,240,180,'q = [1, 0]',C.yellow,31);['A','B','C'].forEach((s,i)=>{let x=370+i*280;box(x,200,245,260,'',[C.mint,C.coral,C.purple][i]);text(s,x+122,247,38,[C.mint,C.coral,C.purple][i],'Segoe UI','center');mono('k = '+['[2, 0]','[0, 2]','[1, 1]'][i],x+122,322,26,C.white,'center');mono('v = '+['[2, 0]','[0, 2]','[1, 1]'][i],x+122,402,26,C.white,'center');});note('Keys and values happen to match in this toy example; usually they differ.');break;
case 'dots':
 pill('q = [1, 0]',80,215,C.yellow,235);['A: 1×2 + 0×0 = 2','B: 1×0 + 0×2 = 0','C: 1×1 + 0×1 = 1'].forEach((s,i)=>{box(390,190+i*112,760,84,s,[C.mint,C.coral,C.purple][i],34);});break;
case 'scale':
 mono('score = (q · k) / √dₖ',640,229,42,C.mint,'center');['2 / √2 ≈ 1.414','0 / √2 = 0','1 / √2 ≈ 0.707'].forEach((s,i)=>box(95+i*375,280,345,100,s,[C.mint,C.coral,C.purple][i],29));text('dₖ = 2 coordinates',640,450,32,C.yellow,'Segoe UI','center');note('Scaling controls score magnitude as the key dimension grows.');break;
case 'softmax':
 mono('αⱼ = exp(sⱼ) / Σ exp(s)',80,219,31,C.yellow);mono('exp(s) ≈',80,298,26,C.muted);mono('[4.113, 1, 2.028]',80,348,25,C.white);mono('sum ≈ 7.141',80,415,27,C.white);bars(['A','B','C'],[.576,.140,.284],620,227,355);note('0.576 + 0.140 + 0.284 ≈ 1.000');break;
case 'blend':
 ['0.576 × [2, 0] = [1.152, 0]','0.140 × [0, 2] = [0, 0.280]','0.284 × [1, 1] = [0.284, 0.284]'].forEach((s,i)=>mono(s,640,230+i*68,31,[C.mint,C.coral,C.purple][i],'center'));line(280,397,1000,397,C.edge,2,false);box(325,425,630,82,'output ≈ [1.436, 0.564]',C.yellow,35);break;
case 'formula':
 mono('Attention(Q, K, V)',640,241,42,C.white,'center');mono('= softmax( QKᵀ / √dₖ ) V',640,328,49,C.mint,'center');flow(['COMPARE','SCALE','NORMALIZE','BLEND'],411,210);break;
case 'matrix':
 grid();mono('Q, K:  n × dₖ',90,233,30,C.mint);mono('V:     n × dᵥ',90,295,30,C.purple);mono('scores: n × n',90,357,30,C.yellow);mono('output: n × dᵥ',90,419,30,C.coral);text('row softmax',1060,264,26,C.mint,'Segoe UI','center');text('then × V',1060,333,29,C.purple,'Segoe UI','center');note('n = number of tokens • dₖ = key size • dᵥ = value size');break;
case 'heads':
 box(65,280,180,75,'input X',C.white);['head 1','head 2','head 3'].forEach((s,i)=>{line(260,317,400,222+i*108,[C.mint,C.coral,C.purple][i]);box(420,185+i*108,200,75,s,[C.mint,C.coral,C.purple][i]);line(635,222+i*108,780,317,[C.mint,C.coral,C.purple][i]);});box(795,280,210,75,'concatenate',C.yellow);line(1020,317,1055,317);box(1065,280,140,75,'× W_O',C.mint);note('Each head has its own Q, K, V projections. No fixed human-assigned roles.');break;
case 'block':
 flow(['attention','feed forward'],225,380);mono('FFN(x) = activation(xW₁ + b₁)W₂ + b₂',640,406,31,C.purple,'center');text('mix across positions',430,351,25,C.mint,'Segoe UI','center');text('transform each position',850,351,25,C.purple,'Segoe UI','center');note('The same feed forward network acts independently at every position.');break;
case 'residual':
 box(90,290,140,70,'x',C.white);line(245,325,385,325);box(400,280,260,90,'sublayer',C.mint);line(675,325,815,325);box(830,285,80,80,'+',C.yellow,44);line(925,325,1025,325);box(1040,285,155,80,'next',C.purple);line(160,278,160,205,C.coral,3,false);line(160,205,870,205,C.coral,3,false);line(870,205,870,273,C.coral,3);mono('x + update(x)',640,453,35,C.yellow,'center');note('Normalization placement varies; repeated blocks refine the representation.');break;
case 'family':
 ['ENCODER','DECODER','ENCODER + DECODER'].forEach((s,i)=>{let x=70+i*407;box(x,200,370,270,'',[C.mint,C.coral,C.purple][i]);text(s,x+185,251,i===2?25:32,[C.mint,C.coral,C.purple][i],'Segoe UI','center');wrap(['Full input context','Past + current positions','Decoder queries the encoder'][i],x+30,316,310,27);text(['understand input','generate next tokens','translate input → output'][i],x+185,416,23,C.muted,'Segoe UI','center');});break;
case 'mask':
 grid(true);mono('future score = −∞',90,258,29,C.coral);mono('exp(−∞) = 0',90,320,29,C.mint);text('future weight = 0',90,380,27,C.mint);text('allowed',1020,280,28,C.mint);text('blocked ×',1020,350,28,C.coral);note('At input position i: attend to positions ≤ i; predict token i + 1.');break;
case 'predict':
 box(70,265,315,90,'“The cat sat on the”',C.white,28);line(400,310,485,310);bars(['mat','floor','…'],[.60,.25,.15],585,205,390,[C.mint,C.purple,C.coral]);note('Illustrative vocabulary probabilities • choose → append → repeat');break;
case 'train':
 mono('L = −ln p(correct next token)',640,230,41,C.yellow,'center');box(110,290,480,110,'p = 0.2 → L ≈ 1.609',C.coral,31);box(690,290,480,110,'p = 0.8 → L ≈ 0.223',C.mint,31);flow(['predict','loss','gradients','update weights'],461,235);break;
case 'cost':
 box(90,205,500,270);box(690,205,500,270,'',C.coral);text('TRAIN',340,260,35,C.mint,'Segoe UI','center');text('known tokens, many positions',340,332,27,C.white,'Segoe UI','center');text('processed in parallel',340,383,27,C.white,'Segoe UI','center');text('GENERATE',940,260,35,C.coral,'Segoe UI','center');text('choose → append → repeat',940,355,29,C.white,'Segoe UI','center');mono('n² pairs:  100 → 10,000    200 → 40,000',640,540,30,C.yellow,'center');break;
case 'recap':
 flow(['tokens','vectors + position','Transformer blocks'],210,310);flow(['last representation','vocabulary softmax','next token'],350,310);note('Inside attention: compare → scale → normalize → blend',523);break;
case 'quiz':
 box(80,220,380,230,'',C.yellow);mono('q = [0, 1]',270,287,36,C.yellow,'center');text('Which candidate wins?',270,354,28,C.white,'Segoe UI','center');text('A, B, or C?',270,407,34,C.muted,'Segoe UI','center');if(phase===0){mono('k_A = [2, 0]',790,264,32,C.mint,'center');mono('k_B = [0, 2]',790,345,32,C.coral,'center');mono('k_C = [1, 1]',790,426,32,C.purple,'center');}else{bars(['A','B','C'],[.140,.576,.284],625,230,330);note('B wins • new output ≈ [0.564, 1.436]');}break;
case 'end':
 text('COMPARE.',80,240,58,C.mint);text('SCALE.',80,316,58,C.coral);text('NORMALIZE.',80,392,58,C.purple);text('BLEND.',80,468,58,C.yellow);box(700,225,470,240);text('YOU JUST COMPUTED',935,280,24,C.muted,'Segoe UI','center');text('ATTENTION',935,355,48,C.mint,'Segoe UI','center');text('Keep experimenting.',935,421,27,C.white,'Segoe UI','center');break;
}
ctx.restore();
ctx.fillStyle='#07101ce8';ctx.fillRect(0,578,1280,131);wrap(subtitle,64,612,1152,23,C.white);
ctx.fillStyle=C.edge;ctx.fillRect(0,714,W,6);ctx.fillStyle=C.mint;ctx.fillRect(0,714,W*Math.max(0,Math.min(1,t/duration)),6);
}
scope.TransformerVisuals={draw,C};if(typeof module!=='undefined')module.exports={draw,C};
})(typeof window!=='undefined'?window:globalThis);
