// Pond geometry and koi are integrated into Clearwater's refracted ray.
uniform vec4 uFish[10]; // world x,z,heading,length
uniform vec4 uFishInfo[10]; // depth,pattern,phase,unused
uniform int uFishCount, uFoodCount;
uniform vec4 uFood[24];
uniform float uWind, uWarm, uBrightness;
uniform vec3 uRockCenter[18],uRockSize[18];
uniform vec3 uSmallCenter[90],uSmallSize[90];

float pondRadius(float a){ return 2.48 + .13*sin(3.0*a+.5)+.12*sin(5.0*a-1.0)+.065*sin(8.0*a); }
float pondDistance(vec2 p){ vec2 q=p/vec2(1.12,1.0); return length(q)-pondRadius(atan(q.y,q.x)); }
vec3 stoneCenter(int i){return uRockCenter[i];}
vec3 stoneSize(int i){return uRockSize[i];}
float ellipsoidHit(vec3 ro,vec3 rd,vec3 size){ vec3 p=ro/size,d=rd/size; float b=dot(p,d),a=dot(d,d),c=dot(p,p)-1.0; float h=b*b-a*c; if(h<0.0)return 1e5; float t=(-b-sqrt(h))/a; return t>0.0?t:1e5; }
int nearbyStone(vec2 p){float a=atan(p.y,p.x/1.12);return int(floor(mod(a+6.2831853,6.2831853)*18.0/6.2831853+.5))%18;}
mat3 stoneRotation(int i){float a=float(i)*2.719;float c=cos(a),s=sin(a);return mat3(c,0.,s,0.,1.,0.,-s,0.,c);}
vec3 rockPlane(int j,int i){float a=float(j)*2.39996+float(i)*.93;return normalize(vec3(cos(a),.32+.68*hash12(vec2(float(i),float(j))),sin(a)));}
float rockCut(int j,int i){return .74+.19*hash12(vec2(float(j)+18.,float(i)+2.));}
float stoneNoise(vec3 p){vec3 id=floor(p),f=fract(p);f=f*f*(3.-2.*f);vec2 a=id.xy+id.z*vec2(17.,59.);float low=mix(mix(hash12(a),hash12(a+vec2(1,0)),f.x),mix(hash12(a+vec2(0,1)),hash12(a+vec2(1,1)),f.x),f.y);a+=vec2(17.,59.);float high=mix(mix(hash12(a),hash12(a+vec2(1,0)),f.x),mix(hash12(a+vec2(0,1)),hash12(a+vec2(1,1)),f.x),f.y);return mix(low,high,f.z);}
float rockField(vec3 q,int i){float d=length(q)-1.+(stoneNoise(q*3.+float(i)*7.)-.5)*.16;for(int j=0;j<5;j++){float b=dot(q,rockPlane(j,i))-(rockCut(j,i)+.07);float h=clamp(.5+.5*(d-b)/.17,0.,1.);d=mix(b,d,h)+.17*h*(1.-h);}return d;}
// Rounded fracture planes and low-frequency displacement alter the silhouette.
// Ray marching is restricted to the analytic bounding volume of nearby stones.
float oneRockHit(vec3 ro,vec3 rd,int i){
 mat3 m=stoneRotation(i);vec3 size=stoneSize(i),p=(m*(ro-stoneCenter(i)))/size,d=(m*rd)/size;
 float aa=dot(d,d),bb=dot(p,d),cc=dot(p,p)-1.21,hh=bb*bb-aa*cc;if(hh<0.)return 1e5;
 float lo=(-bb-sqrt(hh))/aa,hi=(-bb+sqrt(hh))/aa;
 float t=max(lo,.001),speed=length(d);for(int j=0;j<23;j++){float dist=rockField(p+d*t,i);if(dist<.0018)return t;t+=max(.0008,dist*.72)/speed;if(t>hi)break;}return 1e5;
}
float smallRockHit(vec3 ro,vec3 rd,int i){mat3 m=stoneRotation(i+41);return ellipsoidHit(m*(ro-uSmallCenter[i]),m*rd,uSmallSize[i]);}
float rockHit(vec3 ro,vec3 rd,out int index){float best=1e5;index=0;vec2 ground=(ro+rd*(-ro.y/rd.y)).xz;float r=length(ground);if(r<1.5||r>4.9)return best;int nearIndex=nearbyStone(ground);for(int k=-2;k<=2;k++){int i=(nearIndex+k+18)%18;float t=oneRockHit(ro,rd,i);if(t<best){best=t;index=i;}for(int j=0;j<5;j++){int n=i*5+j;vec3 center=uSmallCenter[n];if(length(ground-center.xz)>.60)continue;float st=smallRockHit(ro,rd,n);if(st<best){best=st;index=18+n;}}}return best;}
float stoneShadow(vec3 p){float sh=1.;vec2 projected=p.xz+uSun.xz/uSun.y*(.30-p.y);float r=length(projected);if(r<1.5||r>4.6)return sh;int ni=nearbyStone(projected);for(int k=-2;k<=2;k++){int i=(ni+k+18)%18;float t=ellipsoidHit(p-stoneCenter(i),uSun,stoneSize(i)*.86);if(t<3.)sh=.24;float d=length((p-stoneCenter(i)).xz/stoneSize(i).xz);sh*=mix(.78,1.,smoothstep(.8,1.5,d));}return sh;}
float smallStoneShadow(vec3 p){float sh=1.;int ni=nearbyStone(p.xz);for(int k=-1;k<=1;k++){int group=(ni+k+18)%18;for(int j=0;j<5;j++){int i=group*5+j;vec3 c=uSmallCenter[i],sz=uSmallSize[i];float d=length((p.xz-c.xz)/sz.xz);if(d<2.){sh*=mix(.48,1.,smoothstep(.62,1.65,d));if(smallRockHit(p+vec3(0,.007,0),uSun,i)<1.)sh*=.50;}}}return max(.20,sh);}
float segmentDistance(vec2 p,vec2 a,vec2 b){vec2 v=b-a;return length(p-a-v*clamp(dot(p-a,v)/dot(v,v),0.,1.));}
float treeBranches(vec2 p){
 float d=segmentDistance(p,vec2(2.9,3.4),vec2(.5,-2.8))-.052;
 for(int j=0;j<9;j++){float k=float(j),h=hash12(vec2(k,17.));vec2 a=mix(vec2(2.9,3.4),vec2(.5,-2.8),.18+k*.085);vec2 b=a+vec2((mod(k,2.)<.5?-1.:1.)*(.60+h*.95),-.4-h*.8);d=min(d,segmentDistance(p,a,b)-(.026-k*.0018));vec2 c=mix(a,b,.62);d=min(d,segmentDistance(p,c,c+vec2((h-.55)*1.1,-.8))-.011);}
 return 1.-smoothstep(-.012,.022,d);
}
float gardenShade(vec2 p){float leaves=fbm2(p*1.35+vec2(.025*sin(uTime*.13),.012*cos(uTime*.1)));float canopy=smoothstep(.28,.62,leaves)*smoothstep(-1.6,2.0,p.x);return mix(1.,.26,max(canopy,treeBranches(p)*.78));}
vec3 gardenReflection(vec3 P,vec3 rr){vec2 q=P.xz+rr.xz/max(rr.y,.15)*2.6;float leaves=smoothstep(.34,.60,fbm2(q*1.4));float branch=treeBranches(q);vec3 c=mix(vec3(.13,.19,.14),vec3(.025,.045,.025),leaves);return mix(c,vec3(.008,.016,.011),branch);}
vec3 dryGround(vec3 p,vec3 rd){
 float h,h2;vec3 gravel=pebbles(p.xz,.58,h),coarse=pebbles(p.zx+6.,1.1,h2);gravel=mix(gravel,coarse,.18)*vec3(.88,.85,.79);
 float edge=pondDistance(p.xz);float grass=smoothstep(.95,1.27,edge+.20*(fbm2(p.xz*5.)-.5));
 float grassPatch=fbm2(p.xz*2.4),fine=vnoise(p.xz*180.);vec3 turf=mix(vec3(.019,.032,.009),vec3(.061,.082,.024),grassPatch)*(.55+.8*fine);
 if(grass>.01){
  vec2 cell=floor(p.xz*48.);float aa=max(length(dFdx(p.xz)),length(dFdy(p.xz)))*.65;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
   vec2 id=cell+vec2(x,y);float r=hash12(id),r2=hash12(id+37.);vec2 root=(id+vec2(r,r2))/48.;float ht=.033+r*.08;
   vec2 tip=root-rd.xz/rd.y*ht+vec2(sin(r2*6.28+uTime*.35)*.012,cos(r*6.28)*.009);
   vec2 v=tip-root;float along=clamp(dot(p.xz-root,v)/dot(v,v),0.,1.);float d=length(p.xz-root-v*along);
   float blade=1.-smoothstep(.0013*(1.-along)+.00025,.0028*(1.-along)+aa,d);
   vec3 green=mix(vec3(.026,.046,.012),vec3(.105,.139,.039),r2)*(.42+.75*along);
   turf=mix(turf,green,blade*.9);
  }
 }
 float damp=smoothstep(.24,-.06,edge);gravel*=1.-damp*.45;
 vec3 alb=mix(gravel,turf,grass);float light=.30+1.0*max(uSun.y,0.);return alb*light*stoneShadow(p+vec3(0,.012,0))*smallStoneShadow(p)*(.63+.37*gardenShade(p.xz))*vec3(1.+.26*uWarm,1.,1.-.20*uWarm)*uBrightness;
}
vec3 smallRockColor(vec3 p,int i){mat3 m=stoneRotation(i+41);vec3 q=m*(p-uSmallCenter[i]),sz=uSmallSize[i];vec3 n=normalize(transpose(m)*(q/(sz*sz)));vec3 b=vec3(stoneNoise(p*38.),stoneNoise(p*38.+17.),stoneNoise(p*38.+32.))-.5;n=normalize(n+b*.35);float seed=hash12(vec2(float(i),52.)),tex=stoneNoise(p*27.);vec3 c=mix(vec3(.077,.071,.057),vec3(.23,.22,.20),tex);c*=mix(vec3(.80,.89,1.),vec3(1.13,1.05,.84),seed);float light=.23+1.12*max(dot(n,uSun),0.);float ao=.46+.54*smoothstep(.025,.17,p.y);return c*light*ao*stoneShadow(p+n*.015)*(.72+.28*gardenShade(p.xz))*uBrightness*vec3(1.+.22*uWarm,1.,1.-.18*uWarm);}
vec3 rockColor(vec3 p,int index){
 if(index>=18)return smallRockColor(p,index-18);
 vec3 center=stoneCenter(index),size=stoneSize(index);mat3 m=stoneRotation(index);vec3 q=m*(p-center)/size,normal=normalize(transpose(m)*(q/size));
 float e=.003;vec3 gn=vec3(rockField(q+vec3(e,0,0),index)-rockField(q-vec3(e,0,0),index),rockField(q+vec3(0,e,0),index)-rockField(q-vec3(0,e,0),index),rockField(q+vec3(0,0,e),index)-rockField(q-vec3(0,0,e),index));normal=normalize(transpose(m)*(gn/size));
 vec3 pp=p*24.;float h=stoneNoise(pp),eps=.025;
 vec3 grad=vec3(stoneNoise(pp+vec3(eps,0,0))-h,stoneNoise(pp+vec3(0,eps,0))-h,stoneNoise(pp+vec3(0,0,eps))-h)/eps;normal=normalize(normal-grad*.20);
 float tex=stoneNoise(p*6.+float(index)),grit=stoneNoise(p*130.);float mineral=hash12(vec2(float(index),62.));
 vec3 c=mix(vec3(.077,.079,.071),vec3(.205,.212,.192),tex)*(.81+.32*grit);c*=mix(vec3(.86,.90,.97),vec3(1.12,1.02,.86),mineral);
 float veins=stoneNoise(p*38.+float(index)*2.);c*=.92+.15*veins;
 float moss=smoothstep(.42,.65,fbm2(p.xz*13.+float(index)))*smoothstep(.34,.01,p.y)*.55;c=mix(c,vec3(.050,.067,.024),moss);
 float wet=1.-smoothstep(-.02,.10,p.y);c*=1.-wet*.48;
 float light=.22+1.20*max(dot(normal,uSun),0.);float ao=.45+.55*smoothstep(-.09,.25,p.y);
 float shadow=stoneShadow(p+normal*.015);return c*light*ao*(.64+.36*shadow)*(.75+.25*gardenShade(p.xz))*vec3(1.+.28*uWarm,1.,.97-.24*uWarm)*uBrightness;
}
vec2 localFish(vec2 p,vec4 f){vec2 d=p-f.xy;float c=cos(f.z),s=sin(f.z);return vec2(c*d.x-s*d.y,s*d.x+c*d.y);}
vec3 fishLocal3(vec3 p,vec4 f){vec2 q=localFish(p.xz,f);return vec3(q.x,p.y,q.y);}
float koiShadow(vec2 p){float sh=1.0;for(int i=0;i<10;i++){if(i>=uFishCount)break;vec4 f=uFish[i];vec2 q=localFish(p+uSun.xz*.30,f);float body=length(q/vec2(f.w*.19,f.w*.58));sh*=1.0-.27*exp(-body*body*2.0);}return sh;}
vec3 koiPaint(vec3 q,float len,float pattern,float seed,vec3 n){
 vec2 uv=q.xz/len;float patches=fbm2(uv*9.0+seed*13.0)+.13*sin(uv.y*22.0+seed);
 vec3 white=vec3(.61,.62,.54),red=vec3(.72,.11,.024),gold=vec3(.65,.33,.038),black=vec3(.018,.026,.023);
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
 float shade=.22+.49*max(n.y,0.0)+.37*max(dot(n,uSun),0.0);float sheen=pow(max(n.y,0.),12.)*.05;return (c*shade+sheen)*vec3(1.0+.19*uWarm,1.0,1.0-.17*uWarm)*uBrightness;
}
float koiBodyField(vec3 q,float len,float phase){
 q/=len;float sway=sin(uTime*3.8+phase-q.z*5.);
 q.x-=sway*.026*smoothstep(.16,-.48,q.z);
 float width=.125*sqrt(max(.0001,1.-pow((q.z-.015)/.465,2.)))*(.32+.68*smoothstep(-.47,-.08,q.z));
 float side=length(vec2(q.x,q.y/.68))-width;
 return max(side,abs(q.z-.015)-.465)*len;
}
float koiBodyHit(vec3 ro,vec3 rd,float len,float phase){
 float entry=ellipsoidHit(ro,rd,vec3(len*.17,len*.12,len*.49));if(entry>1e4)return 1e5;
 float t=entry;for(int j=0;j<17;j++){float d=koiBodyField(ro+rd*t,len,phase);if(d<len*.0015)return t;t+=max(len*.0007,d*.72);if(t>entry+len)break;}return 1e5;
}
vec3 addKoi(vec3 P,vec3 tr,vec3 under,float bottomDistance){
 float nearest=bottomDistance;vec3 color=under;
 for(int i=0;i<10;i++){
  if(i>=uFishCount)break;vec4 f=uFish[i];vec4 info=uFishInfo[i];float len=f.w;
  vec3 ro=fishLocal3(P-vec3(0,-info.x,0),f);vec3 rd=fishLocal3(vec3(tr.x,0,tr.z)+vec3(f.x,0,f.y),f);rd.y=tr.y;
  // Slightly bend the whole body with the swimming cycle.
  float sw=sin(uTime*3.8+info.z);
  float hit=koiBodyHit(ro,rd,len,info.z);
  vec3 normal=vec3(0,1,0);vec3 q=ro+rd*hit;bool body=hit<nearest;
  if(body){float e=len*.002;normal=normalize(vec3(koiBodyField(q+vec3(e,0,0),len,info.z)-koiBodyField(q-vec3(e,0,0),len,info.z),koiBodyField(q+vec3(0,e,0),len,info.z)-koiBodyField(q-vec3(0,e,0),len,info.z),koiBodyField(q+vec3(0,0,e),len,info.z)-koiBodyField(q-vec3(0,0,e),len,info.z)));}
  float plane=(-info.x-P.y)/tr.y;vec3 finq=ro+rd*plane;vec2 uv=finq.xz/len;
  float tailShift=sw*.082*smoothstep(-.26,-.78,uv.y);uv.x-=tailShift;
  float tailW=clamp((-uv.y-.40)*.52,0.018,.165);float forkEnd=-.67-.12*smoothstep(.0,.13,abs(uv.x));
  float tail=smoothstep(tailW+.007,tailW-.006,abs(uv.x))*smoothstep(forkEnd-.012,forkEnd+.012,uv.y)*smoothstep(-.38,-.47,uv.y);
  vec2 sideUV=vec2((abs(uv.x)-.145)/.095,(uv.y-.10)/.125);sideUV.y+=sideUV.x*.65;
  float sideFin=(1.-smoothstep(.82,1.03,length(sideUV)))*smoothstep(.055,.105,abs(uv.x));
  float pelvic=(1.-smoothstep(.75,1.05,length(vec2((abs(uv.x)-.087)/.06,(uv.y+.25)/.09))));
  float fins=max(tail,max(sideFin,pelvic)*.64);
  bool fin=plane>0.0&&plane<nearest&&fins>.15&&(!body||plane<hit);
  if(!body&&!fin)continue;
  if(fin){hit=plane;q=finq;normal=vec3(0,1,0);}
  vec3 paint=koiPaint(q,len,info.y,info.z,normal);
  if(fin){float rays=.83+.17*sin(atan(uv.x,uv.y+.40)*54.0);paint=mix(paint,vec3(.39,.37,.26),.36)*rays;}
  vec3 trans=exp(-SIG_T*hit*.80);vec3 cau=texture(uCaus,(P.xz+tr.xz*hit-uCausShift)/uL).rgb;
  paint*=clamp(vec3(.78)+cau*.30,vec3(.75),vec3(1.75))*(.70+.30*gardenShade(P.xz+tr.xz*hit));paint=paint*trans+vec3(.03,.075,.045)*(1.0-trans);
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
