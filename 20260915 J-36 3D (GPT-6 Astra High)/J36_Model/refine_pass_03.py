from pathlib import Path
p=Path(r'C:\MyProjects\TempProject (OpenAI)\J36_Model\build_j36.py')
s=p.read_text(encoding='utf-8')
a=s.index('# Forward-facing dorsal scoop.')
b=s.index('# Side intake shells',a)
s=s[:a]+'''# Smooth conformal dorsal scoop, open at its forward arch.
vv=[];ff=[];NW=48;NL=80
for i in range(NL+1):
    t=i/NL;y=-2.25+8.05*t;w=.82+.18*sin(pi*t)
    h=.61*(1-t)**1.45
    for j in range(NW+1):
        u=-1+2*j/NW;x=w*u
        z=surf(x,y)+.007+h*max(0,cos(pi*u/2))**.70
        vv.append((x,y+.12*abs(u)*(1-t),z))
for i in range(NL):
    for j in range(NW):
        a=i*(NW+1)+j;ff.append((a,a+1,a+NW+2,a+NW+1))
mesh('Dorsal intake | blended curved shroud',vv,ff,skin,True)
arch=vv[:NW+1]
curve('Dorsal intake | rolled leading lip',arch,edge,.028)
inner=[(x*.92,y+.045,surf(x*.92,y+.045)+max(.018,(z-surf(x,y))*.86)) for x,y,z in arch]
deep=[(x*.86,y+.38,z-.018) for x,y,z in inner]
duct('Dorsal intake | recessed arch walls',[inner,deep],metalDark)
mesh('Dorsal intake | shadowed throat',deep,[tuple(range(len(deep)))],black)
''' + s[b:]
s=s.replace("ring=[(s*1.52,-5.50,.10),(s*2.15,-5.07,.28),(s*2.87,-4.22,.0),(s*2.50,-4.47,-.54),(s*1.74,-5.18,-.60)]", "ring=[(s*1.52,-5.95,-.36),(s*2.15,-5.75,-.30),(s*2.90,-4.68,-.37),(s*2.55,-4.90,-1.00),(s*1.75,-5.78,-.99)]")
s=s.replace("aft=[(s*1.54,-2.00,.38),(s*2.35,-1.9,.39),(s*3.00,-1.75,.02),(s*2.65,-1.75,-.44),(s*1.7,-1.90,-.53)]", "aft=[(s*1.54,-2.00,-.39),(s*2.35,-1.9,-.40),(s*3.00,-1.75,-.17),(s*2.65,-1.75,-.54),(s*1.7,-1.90,-.61)]")
s=s.replace("(11.6,8.2)","(11.6,7.95)").replace("(11.6,8.3)","(11.6,8.12)")
# Keep the narrow coating and tiny lights on the refined tips.
s=s.replace("(s*11.52,8.1)","(s*11.52,7.94)").replace("(s*11.29,8.15)","(s*11.29,8.00)")
s=s.replace("(s*11.34,8.17,.115)","(s*11.34,8.02,.115)")
s=s.replace("camera('02 | Top plan',(0,-1,45),(0,-1,0),30)", "camera('02 | Top plan',(0,-1,45),(0,-1,0),38)\nCAM['02 | Top plan'].rotation_euler[2]=pi")
s=s.replace("(-25,-34,-35)","(23,-34,-42)")
p.write_text(s,encoding='utf-8')
