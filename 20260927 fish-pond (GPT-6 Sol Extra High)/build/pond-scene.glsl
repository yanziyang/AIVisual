// Pond geometry and koi are integrated into Clearwater's refracted ray.
uniform vec4 uFish[10]; // world x,z,heading,length
uniform vec4 uFishInfo[10]; // depth,pattern,phase,unused
uniform int uFishCount, uFoodCount;
uniform vec4 uFood[24];
uniform float uWind, uWarm, uBrightness;
uniform vec3 uRockCenter[28],uRockSize[28];

float pondRadius(float a){ return 2.48 + .13*sin(3.0*a+.5)+.12*sin(5.0*a-1.0)+.065*sin(8.0*a); }
float pondDistance(vec2 p){ vec2 q=p/vec2(1.12,1.0); return length(q)-pondRadius(atan(q.y,q.x)); }
vec3 stoneCenter(int i){return uRockCenter[i];}
vec3 stoneSize(int i){return uRockSize[i];}
float ellipsoidHit(vec3 ro,vec3 rd,vec3 size){ vec3 p=ro/size,d=rd/size; float b=dot(p,d),a=dot(d,d),c=dot(p,p)-1.0; float h=b*b-a*c; if(h<0.0)return 1e5; float t=(-b-sqrt(h))/a; return t>0.0?t:1e5; }
int nearbyStone(vec2 p){float a=atan(p.y,p.x/1.12);return int(floor(mod(a+6.2831853,6.2831853)*28.0/6.2831853+.5))%28;}
float rockHit(vec3 ro,vec3 rd,out int index){float best=1e5;index=0;vec2 ground=(ro+rd*(-ro.y/rd.y)).xz;float r=length(ground);if(r<1.55||r>4.5)return best;int nearIndex=nearbyStone(ground);for(int k=-2;k<=2;k++){int i=(nearIndex+k+28)%28;float t=ellipsoidHit(ro-stoneCenter(i),rd,stoneSize(i));if(t<best){best=t;index=i;}}return best;}
float stoneShadow(vec3 p){float sh=1.0;vec2 projected=p.xz+uSun.xz/uSun.y*(.2-p.y);float r=length(projected);if(r<1.7||r>4.3)return sh;int nearIndex=nearbyStone(projected);for(int k=-2;k<=2;k++){int i=(nearIndex+k+28)%28;vec3 s=stoneSize(i)*.96;float t=ellipsoidHit(p-stoneCenter(i),uSun,s);if(t<3.0)sh=.36;}return sh;}
vec3 dryGround(vec3 p){
 float h,h2;vec3 gravel=pebbles(p.xz,.74,h);vec3 coarse=pebbles(p.zx+6.0,1.1,h2);gravel=mix(gravel,coarse,.25)*.85;
 float edge=pondDistance(p.xz);float grass=smoothstep(.84,1.1,edge+.07*fbm2(p.xz*4.0));
 float fine=vnoise(p.xz*170.0),grassPatch=fbm2(p.xz*2.4);vec3 turf=mix(vec3(.027,.048,.012),vec3(.085,.14,.026),grassPatch);
 vec2 blade=fract(p.xz*150.0);float blades=smoothstep(.17,0.0,abs(blade.x-.5+.20*sin(p.z*13.0+uTime*.35)))*smoothstep(.95,.1,blade.y);turf*=.66+.9*fine+.52*blades;
 vec3 alb=mix(gravel,turf,grass);float light=.35+1.18*max(uSun.y,0.0);return alb*light*stoneShadow(p+vec3(0,.025,0))*vec3(1.0+.35*uWarm,1.0,.95-.25*uWarm)*uBrightness;
}
vec3 rockColor(vec3 p,int index){
 vec3 center=stoneCenter(index),size=stoneSize(index);vec3 normal=normalize((p-center)/(size*size));
 vec3 bump=vec3(vnoise(p.xy*19.0),vnoise(p.yz*19.0+4.0),vnoise(p.zx*19.0+7.0))-.5;normal=normalize(normal+bump*.45);
 float texture_=fbm2(p.xz*9.0+p.y*5.0),grit=vnoise(p.xy*180.0+p.z*30.0);vec3 c=mix(vec3(.10,.11,.087),vec3(.30,.31,.25),texture_)*(.83+.3*grit);
 float vein=smoothstep(.94,1.0,vnoise(p.xz*22.0+p.y*7.0));c+=vein*.045;
 float moss=smoothstep(.44,.65,fbm2(p.xz*10.0+float(index)))*smoothstep(.22,.05,p.y)*.65;c=mix(c,c*vec3(.50,.73,.24),moss);
 float light=.29+1.25*max(dot(normal,uSun),0.0);float ao=.60+.4*smoothstep(-.08,.22,p.y);return c*light*ao*vec3(1.0+.28*uWarm,1.0,.97-.24*uWarm)*uBrightness;
}
vec2 localFish(vec2 p,vec4 f){vec2 d=p-f.xy;float c=cos(f.z),s=sin(f.z);return vec2(c*d.x-s*d.y,s*d.x+c*d.y);}
vec3 fishLocal3(vec3 p,vec4 f){vec2 q=localFish(p.xz,f);return vec3(q.x,p.y,q.y);}
float koiShadow(vec2 p){float sh=1.0;for(int i=0;i<10;i++){if(i>=uFishCount)break;vec4 f=uFish[i];vec2 q=localFish(p+uSun.xz*.30,f);float body=length(q/vec2(f.w*.19,f.w*.58));sh*=1.0-.27*exp(-body*body*2.0);}return sh;}
vec3 koiPaint(vec3 q,float len,float pattern,float seed,vec3 n){
 vec2 uv=q.xz/len;float patches=fbm2(uv*9.0+seed*13.0)+.13*sin(uv.y*22.0+seed);
 vec3 white=vec3(.78,.76,.65),red=vec3(.83,.13,.026),gold=vec3(.86,.46,.068),black=vec3(.018,.026,.023);
 vec3 c=white;
 if(pattern<.5){c=mix(white,red,smoothstep(.46,.50,patches));}
 else if(pattern<1.5){c=mix(white,red,smoothstep(.42,.47,patches));c=mix(c,black,smoothstep(.61,.65,fbm2(uv*17.0+seed)));}
 else if(pattern<2.5){c=gold*(.85+.26*patches);}
 else if(pattern<3.5){c=mix(white,black,smoothstep(.48,.53,patches));}
 else{c=mix(red,vec3(.98,.53,.09),.3);c=mix(c,white,smoothstep(.6,.64,patches));}
 // Curved scale rows and dorsal ridge follow the body, rather than a flat sprite.
 vec2 scaleUV=vec2(uv.x*37.0,uv.y*34.0);scaleUV.x+=mod(floor(scaleUV.y),2.0)*.5;float scales=length(fract(scaleUV)-vec2(.5,.3));c*=.91+.11*smoothstep(.34,.49,scales);
 float ridge=exp(-pow(uv.x*42.0,2.0))*smoothstep(-.35,-.10,uv.y)*smoothstep(.35,.13,uv.y);c=mix(c,c*1.15,ridge*.35);
 // Two small dark eyes at the shoulders of the head, plus an ivory glint.
 float eye=length(vec2(abs(uv.x)-.071,uv.y-.323)/vec2(.019,.028));c=mix(c,black,1.0-smoothstep(.7,1.15,eye));
 float eyeShine=length(vec2(abs(uv.x)-.069,uv.y-.329)/vec2(.006,.008));c=mix(c,vec3(.8),1.0-smoothstep(.5,1.2,eyeShine));
 float shade=.36+.7*max(n.y,0.0)+.34*max(dot(n,uSun),0.0);return c*shade*vec3(1.0+.19*uWarm,1.0,1.0-.17*uWarm)*uBrightness;
}
vec3 addKoi(vec3 P,vec3 tr,vec3 under,float bottomDistance){
 float nearest=bottomDistance;vec3 color=under;
 for(int i=0;i<10;i++){
  if(i>=uFishCount)break;vec4 f=uFish[i];vec4 info=uFishInfo[i];float len=f.w;
  vec3 ro=fishLocal3(P-vec3(0,-info.x,0),f);vec3 rd=fishLocal3(vec3(tr.x,0,tr.z)+vec3(f.x,0,f.y),f);rd.y=tr.y;
  // Slightly bend the whole body with the swimming cycle.
  float sw=sin(uTime*4.0+info.z);ro.x+=sw*.008;
  vec3 size=vec3(len*.143,len*.105,len*.465);float hit=ellipsoidHit(ro,rd,size);
  vec3 normal=vec3(0,1,0);vec3 q=ro+rd*hit;bool body=hit<nearest;
  if(body){normal=normalize(q/(size*size));}
  float plane=(-info.x-P.y)/tr.y;vec3 finq=ro+rd*plane;vec2 uv=finq.xz/len;
  float tailShift=sw*.070*smoothstep(-.36,-.76,uv.y);uv.x-=tailShift;
  float tailW=clamp((-uv.y-.37)*.65,0.0,.205);float tail=smoothstep(tailW+.008,tailW-.008,abs(uv.x))*smoothstep(-.80,-.70,uv.y)*smoothstep(-.35,-.43,uv.y);
  float fan=smoothstep(.027,.002,abs(abs(uv.x)-(.15+(.19-uv.y)*.43)))*smoothstep(-.18,-.05,uv.y)*smoothstep(.27,.17,uv.y);
  float sideFin=smoothstep(.01,-.008,abs(uv.x)-(.143+(.23-uv.y)*.28))*smoothstep(-.10,.02,uv.y)*smoothstep(.25,.16,uv.y);
  float fins=max(tail,max(fan,sideFin)*.78);
  bool fin=plane>0.0&&plane<nearest&&fins>.15&&(!body||plane<hit);
  if(!body&&!fin)continue;
  if(fin){hit=plane;q=finq;normal=vec3(0,1,0);}
  vec3 paint=koiPaint(q,len,info.y,info.z,normal);
  if(fin){float rays=.7+.3*sin(atan(uv.x,uv.y+.35)*45.0);paint=mix(paint,vec3(.75,.69,.48),.5)*rays;}
  vec3 trans=exp(-SIG_T*hit*.80);vec3 cau=texture(uCaus,(P.xz+tr.xz*hit-uCausShift)/uL).rgb;
  paint*=clamp(vec3(.78)+cau*.30,vec3(.75),vec3(1.75));paint=paint*trans+vec3(.03,.075,.045)*(1.0-trans);
  color=mix(under,paint,fin?fins:1.0);nearest=hit;
 }
 return color;
}
vec3 addFloating(vec3 ro,vec3 rd,vec3 col,float waterT){
 float level=.025;float tt=(level-ro.y)/rd.y;if(tt<=0.0||tt>waterT+.15)return col;vec2 p=(ro+rd*tt).xz;
 // Small cluster of lily pads at the quiet edge of the pond.
 for(int i=0;i<7;i++){float k=float(i);vec2 center=vec2(-1.48+.28*sin(k*2.1),.83+.23*cos(k*1.8));center+=vec2(.035*sin(uTime*.23+k),.018*cos(uTime*.31+k));float radius=.13+.035*hash12(vec2(k,9));vec2 q=p-center;float d=length(q),a=atan(q.y,q.x)+k*1.3;
  float wedge=abs(atan(sin(a),cos(a)));float mask=(1.0-smoothstep(radius-.003,radius+.003,d))*smoothstep(.11,.19,wedge);if(mask<.01)continue;
  float veins=pow(max(cos(a*11.0+d*20.0),0.0),18.0);vec3 pad=mix(vec3(.075,.15,.026),vec3(.18,.26,.055),1.0-d/radius);pad+=veins*.022;pad*=.65+uSun.y*.65;col=mix(col,pad*uBrightness,mask);
 }
 for(int i=0;i<24;i++){if(i>=uFoodCount)break;vec2 d=p-uFood[i].xy;float radius=.017;float pellet=1.0-smoothstep(radius-.002,radius+.003,length(d));col=mix(col,vec3(.48,.26,.075)*uBrightness,pellet);}
 return col;
}
