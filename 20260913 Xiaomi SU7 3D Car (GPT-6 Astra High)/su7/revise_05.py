from pathlib import Path
p=Path(__file__).with_name('build_su7.py');s=p.read_text()
s=s.replace("VERSION = '04'","VERSION = '05'")
s=s.replace("n=len(border);nr=8","n=len(border);nr=24")
s=s.replace("ids.append(1 if glazing else 0)", "ids.append(0 if (x>1.53 and s>.76) else 1)")
s=s.replace("for ring in range(1,13):\n        vv.extend(winpoint(lerp(xc,x,ring/12),lerp(zc,z,ring/12),s,.005)", "for ring in range(1,49):\n        vv.extend(winpoint(lerp(xc,x,ring/48),lerp(zc,z,ring/48),s,.009)")
# Smooth painted roof rails replace jagged material-assignment edges.
key="    curve('Roof drip molding',[canopy(lerp(-.94,1.86,k/100),s*sample(CW,lerp(-.94,1.86,k/100))*.761,.004) for k in range(101)],black,.003)"
new="""    curve('Painted continuous A pillar and roof rail',[canopy(lerp(-1.008,1.89,k/200),s*sample(CW,lerp(-1.008,1.89,k/200))*.775,.005) for k in range(201)],paint,.018)
    curve('Roof drip molding',[canopy(lerp(-.96,1.87,k/160),s*sample(CW,lerp(-.96,1.87,k/160))*.805,.007) for k in range(161)],black,.0025)"""
s=s.replace(key,new)
s=s.replace("for x in [-.25,.81]:", "for x in [-.025,1.02]:")
s=s.replace("[(1.53,.974),(1.42,.84),(1.21,.62),(.95,.23)]", "[(1.43,.974),(1.30,.84),(1.10,.62),(.95,.23)]")
s=s.replace("path=[(-1.20,.776),(-.963,.790),(-.963,.724),(-1.137,.727)]", "path=[(-1.285,.776),(-.963,.790),(-.963,.724),(-1.205,.727)]")
# Keep the outer lamp boundary inside the curved fender's silhouette.
start=s.index('LAMP=');end=s.index('    # Corner air curtain',start)
chunk=s[start:end]
chunk=chunk.replace('front_surface(', 'lamp_surface(')
s=s[:start]+'''def lamp_surface(y,z,offset=.006):
    yy=(1 if y>=0 else -1)*(.542+(abs(y)-.542)*.92)
    return front_surface(yy,z,offset+.004)
''' +chunk+s[end:]
s=s.replace("def rearproj(y,z):return back_surface(y,z,.009)","def rearproj(y,z):return back_surface(y*.968,z,.012)")
s=s.replace("lambda y,z:back_surface(y,z,.014)","lambda y,z:back_surface(y*.968,z,.018)")
# Hood shut line with smooth longitudinal transitions.
key="def lerp(a,b,t):return a+(b-a)*t"
s=s.replace(key,key+"""
def smooth_open_path(points,steps=24):
    out=[]
    for i in range(len(points)-1):
        p0=Vector(points[max(0,i-1)]);p1=Vector(points[i]);p2=Vector(points[i+1]);p3=Vector(points[min(len(points)-1,i+2)])
        for k in range(steps):
            t=k/steps
            out.append(tuple(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)))
    out.append(points[-1]);return out
""")
start=s.index("    curve('Hood precision shut line'");end=s.index('\n',start)
s=s[:start]+"    curve('Hood precision shut line',[topsurf(x,s*y,.003) for x,y in smooth_open_path(hoodpath)],gap,.0015)"+s[end:]
s=s.replace("views=['front_hero','rear_hero','side'] if DRAFT", "views=['front_hero','rear_hero'] if DRAFT")
p.write_text(s)
print('Applied revision 05: lens/vent intersections, roof rails, handle locations and shut lines.')
# Keep delivery documentation and audit aligned with this final visual pass.
fp=p.with_name('finalize_su7.py');t=fp.read_text().replace("'visual_iterations':4", "'visual_iterations':5");fp.write_text(t)
notes=p.with_name('MODEL_NOTES.md');t=notes.read_text().replace('## Rebuild','4. Refined absorptive glass tint, Aqua Blue paint, intake corner shapes, and camera framing.\n5. Increased curved lens and glazing topology to fix intersections, rebuilt smooth roof rails, and corrected handle and shut-line locations.\n\n## Rebuild');notes.write_text(t)
