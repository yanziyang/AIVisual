from pathlib import Path
p=Path(__file__).with_name('build_su7.py')
s=p.read_text()
s=s.replace("VERSION = '01'", "VERSION = '02'")
s=s.replace("(.008,.46,.56),.72,.245,.55", "(.004,.32,.40),.58,.26,.42")
s=s.replace("(.009,.014,.019),.45,.23,.35", "(.006,.009,.012),.10,.29,.22")
s=s.replace("(.026,.047,.066),.16,.115,.4,transmission=.30", "(.009,.019,.030),.05,.19,.20,transmission=.0")
s=s.replace("(.009,.019,.028),.4,.12,.6", "(.006,.013,.020),.12,.18,.35")
s=s.replace("(.56,.63,.68),.92,.21", "(.49,.55,.60),.88,.25")
s=s.replace("(.20,.23,.25),.86,.36", "(.13,.15,.17),.75,.43")
s=s.replace("f=.082+.024*", "f=.060+.018*")
s=s.replace("-.12*s**8", "-.095*s**8")
s=s.replace("y-=.027*sin(pi*v)**2*middle", "y-=.045*sin(pi*v)**2*middle")
s=s.replace("sin(1.35);top=h+f*s**4-.12*s**8", "sin(1.35);top=h+f*s**4-.095*s**8")
start=s.index('NX=360;NT=48')
end=s.index("collection('SU7 | GLASS AND ROOF')")
s=s[:start]+'''NX=360;NT=48
# One welded body mesh. End caps share the longitudinal boundary vertices.
vs=[];fs=[];rings=[]
for i in range(NX+1):
    x=lerp(-2.4985,2.4985,i/NX)
    ring=[bodypoint(x,j/NT,1) for j in range(NT+1)]
    ring += [bodypoint(x,j/NT,-1) for j in range(NT,-1,-1)]
    rings.append(len(vs));vs.extend(ring)
NR=2*(NT+1)
for i in range(NX):
    for j in range(NR-1):
        a=i*NR+j;fs.append((a,a+NR,a+NR+1,a+1))
def frontx(y,z):return -2.4985+.215*(abs(y)/width(-2.4985))**3+.035*(1-smooth((z-.22)/.42))
def rearx(y,z):return 2.4985-.11*(abs(y)/width(2.4985))**3-.060*(1-smooth((z-.21)/.58))
for front in [True,False]:
    offset=0 if front else NX*NR
    original=[vs[offset+j] for j in range(NR)]
    previous=[offset+j for j in range(NR)]
    for ring in range(1,25):
        t=ring/25;new=[]
        for pt in original:
            y=pt[1]*(1-t);z=lerp(pt[2],.47 if front else .56,t)
            xx=frontx(y,z) if front else rearx(y,z)
            # The first rows blend into the hood and quarter panels smoothly.
            xx=lerp(pt[0],xx,smooth(t/.16))
            new.append(len(vs));vs.append((xx,y,z))
        for j in range(NR-1):fs.append((previous[j],new[j],new[j+1],previous[j+1]))
        previous=new
    ci=len(vs);vs.append((-2.4985 if front else 2.4985,0,.47 if front else .56))
    for j in range(NR-1):fs.append((previous[j],ci,previous[j+1]))
body=mesh('Unified aluminum body | welded hood, quarters and bumpers',vs,fs,paint)
import bmesh
bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=.0001);bm.to_mesh(body.data);bm.free()
sub=body.modifiers.new('Continuous body surface refinement','SUBSURF');sub.levels=1;sub.render_levels=1

''' +s[end:]
start=s.index('def canopy(');end=s.index('WINDOW=')
s=s[:start]+'''def canopy(x,y,offset=0):
    z0=hood(x)-.006;top=sample(ROOF,x);h=max(.003,top-z0);w=sample(CW,x)
    ratio=min(.99999,abs(y)/w)
    if ratio<=.73:
        z=top-min(.050,h*.16)*(ratio/.73)**2
    else:
        t=(ratio-.73)/.27
        shoulder=top-min(.050,h*.16)
        z=lerp(shoulder,z0,t**.90)
    return (x,y,z+offset)
''' +s[end:]
s=s.replace("WINDOW=[(-.86,1.010),(-.62,1.174),(-.28,1.329),(-.02,1.369),(.39,1.365),(.77,1.295),(1.19,1.139),(1.58,1.028),(1.57,1.001),(.7,.986),(-.45,.967)]", "WINDOW=[(-.886,.990),(-.660,1.145),(-.29,1.309),(-.035,1.357),(.35,1.356),(.69,1.299),(1.11,1.143),(1.58,1.027),(1.64,1.006),(1.41,.984),(.5,.970),(-.47,.958)]")
s=s.replace('s<.82 and -.974<x<1.83','s<.76 and -.974<x<1.83')
s=s.replace('(s>=.70 and inside(x,z,WINDOW))','(s>=.72 and inside(x,z,WINDOW))')
start=s.index('def winpoint(');end=s.index('for s in [-1,1]:',start)
s=s[:start]+'''def winpoint(x,z,s,offset=.003):
    w=sample(CW,x);lo=0;hi=w
    z=max(hood(x)-.005,min(sample(ROOF,x)-.007,z))
    for _ in range(24):
        mid=(lo+hi)/2
        if canopy(x,mid)[2]>z:lo=mid
        else:hi=mid
    return (x,s*((lo+hi)/2+offset),z)
def path_smooth(points,passes=3):
    for _ in range(passes):
        out=[]
        for i in range(len(points)):
            a=Vector(points[i]);b=Vector(points[(i+1)%len(points)])
            out.extend([tuple(a*.75+b*.25),tuple(a*.25+b*.75)])
        points=out
    return points
''' +s[end:]
start=s.index('    outline=[]',s.index('def winpoint'));end=s.index('for x in [-.23,.86]:',start)
s=s[:start]+'''    outline=[winpoint(x,z,s,.008) for x,z in path_smooth(WINDOW,4)]
    curve('Window perimeter | satin black surround',outline,black,.006,True)
    # Overlay an exactly bounded opaque tinted side window over the greenhouse.
    poly=path_smooth(WINDOW,4);xc=sum(p[0] for p in poly)/len(poly);zc=sum(p[1] for p in poly)/len(poly)
    vv=[winpoint(xc,zc,s,.004)];ff=[];n=len(poly)
    for ring in range(1,13):
        vv.extend(winpoint(lerp(xc,x,ring/12),lerp(zc,z,ring/12),s,.005) for x,z in poly)
        if ring==1:
            ff.extend((0,1+k,1+(k+1)%n) for k in range(n))
        else:
            a=1+(ring-2)*n;b=1+(ring-1)*n
            ff.extend((a+k,b+k,b+(k+1)%n,a+(k+1)%n) for k in range(n))
    mesh('Smooth continuous side glass',vv,ff,glass)
    for dx in [-.010,0,.010]:
        curve('B pillar black trim',[winpoint(.20+dx+(.974-z)*.13,z,s,.013) for z in [lerp(.973,1.352,k/36) for k in range(37)]],black,.012)
    curve('Rear quarter glass division',[winpoint(lerp(1.27,1.12,k/30),lerp(.984,1.126,k/30),s,.013) for k in range(31)],black,.003)
    curve('Roof drip molding',[canopy(lerp(-.94,1.86,k/100),s*sample(CW,lerp(-.94,1.86,k/100))*.761,.004) for k in range(101)],black,.003)
''' +s[end:]
# Panel seams: resample on the actual body rather than letting splines leave it.
s=s.replace("curve('Hood precision shut line',pts,gap,.0022,False,True)", "curve('Hood precision shut line',[topsurf(lerp(pts[i][0],pts[i+1][0],k/20),lerp(pts[i][1],pts[i+1][1],k/20),.0028) for i in range(len(pts)-1) for k in range(20)],gap,.0016)")
s=s.replace("curve(name,[sidepoint(x,z,s) for x,z in path],gap,.0023,False,True)", "curve(name,[sidepoint(lerp(path[i][0],path[i+1][0],k/20),lerp(path[i][1],path[i+1][1],k/20),s,.004) for i in range(len(path)-1) for k in range(21)],gap,.002)")
s=s.replace("(-.94,.956)","(-.94,.943)").replace("(.19,.978)","(.19,.942)").replace("(1.53,.994)","(1.53,.974)")
s=s.replace("curve('Charging door',[sidepoint(x,z,s,.003) for x,z in path],gap,.0022,True,True)", "curve('Charging door',[sidepoint(x,z,s,.004) for x,z in path_smooth(path,3)],gap,.0018,True)")
s=s.replace("curve('Rolled painted wheel arch lip',pts,paint,.007)", "curve('Rolled painted wheel arch lip',pts,paint,.004)")
# Enlarge headlamp projected footprint and move its outer edge down around the shoulder.
s=s.replace("LAMP=[(-2.474,.558),(-2.399,.643),(-2.160,.858),(-2.039,.907),(-2.035,.944),(-2.187,.947),(-2.386,.802),(-2.468,.629)]", "LAMP=[(-2.485,.551),(-2.423,.613),(-2.145,.796),(-1.974,.862),(-1.989,.947),(-2.208,.954),(-2.415,.797),(-2.486,.614)]")
s=s.replace("guide=[(-2.462,.593),(-2.359,.700),(-2.22,.819),(-2.10,.914)]", "guide=[(-2.468,.588),(-2.359,.690),(-2.20,.815),(-2.030,.921)]")
s=s.replace("guide=[(-2.418,.665),(-2.339,.762),(-2.211,.884),(-2.157,.925)]", "guide=[(-2.423,.661),(-2.324,.761),(-2.174,.888),(-2.059,.931)]")
s=s.replace("for x,y in [(-2.17,.859),(-2.106,.891),(-2.29,.822),(-2.348,.769)]", "for x,y in [(-2.10,.823),(-2.014,.862),(-2.22,.858),(-2.302,.788)]")
s=s.replace("white,.006,False,True", "white,.0045,False,True")
s=s.replace("(s*.38,.249),(s*.405,.411),(s*.511,.420),(s*.683,.248)","(s*.36,.249),(s*.381,.421),(s*.505,.430),(s*.719,.248)")
s=s.replace("paint,.009,True", "paint,.005,True")
s=s.replace("black,.020,True", "black,.014,True")
s=s.replace("silver,.0021,True", "silver,.0015,True")
s=s.replace("black,.009)\nfor y", "black,.006)\nfor y")
s=s.replace("(-2.515,0,.513)","(-2.507,0,.513)").replace("(-2.533,0,.516)","(-2.523,0,.516)").replace("(-2.539,0,.516)","(-2.529,0,.516)")
s=s.replace("paint,.021,False,True", "paint,.012,False,True")
s=s.replace("paint,.019)","paint,.010)")
# Rear seats must clear the sloping fastback glass.
s=s.replace("for x in [-.03,.98]:\n    for s", "for x in [-.03,.80]:\n    for s")
s=s.replace("(x+.19,s*.38,1.213)","(x+.19,s*.38,1.14 if x>0 else 1.213)")
s=s.replace("(1.23,0,1.232)","(1.23,0,1.220)")
# Studio: balanced reflections and low camera angle matching press photographs.
s=s.replace("cube('Infinite studio floor',(0,0,-.051),(200,200,.09),floor,.01)", "mesh('Infinite studio floor',[(-200,-200,-.003),(200,-200,-.003),(200,200,-.003),(-200,200,-.003)],[(0,1,2,3)],floor)")
s=s.replace("d.energy=power;", "d.energy=power*.48;")
s=s.replace("default_value=.38", "default_value=.26")
s=s.replace("scene.view_settings.exposure=.15", "scene.view_settings.exposure=-.10")
s=s.replace("(-7.15,-6.3,3.05)", "(-7.8,-6.4,2.53)")
s=s.replace("(7.1,-6.1,2.7)", "(7.7,-6.2,2.45)")
s=s.replace("(0,-9,1.02),(0,0,1.02)", "(0,-10,1.44),(0,0,.85)")
s=s.replace("(1.7,3.5,4.5)","(1.7,4.2,5.8)")
s=s.replace("(-2.4,-3.2,6.2)","(-.3,-3.5,6.8)")
s=s.replace("(1,-4.5,2.5),700", "(1,-4.5,3.8),350")
p.write_text(s)
print('Applied revision 02: surface topology, windows, optics, materials, studio.')
