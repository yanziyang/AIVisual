from pathlib import Path
p=Path(__file__).with_name('build_su7.py');s=p.read_text()
s=s.replace("VERSION = '02'","VERSION = '03'")
s=s.replace("(.016,.019,.021),.0,.66", "(.008,.010,.012),.0,.72")
s=s.replace("(.009,.019,.030),.05,.19,.20,transmission=.0", "(.007,.017,.029),.0,.16,.0,transmission=.0")
s=s.replace("lampglass=mat", "glass.node_tree.nodes.get('Principled BSDF').inputs['Specular'].default_value=.23\nlampglass=mat")
# Exact surface intersections avoid floating or buried optic components.
start=s.index('LAMP=');end=s.index('    # Corner air curtain',start)
s=s[:start]+'''from mathutils.bvhtree import BVHTree
bpy.context.view_layer.update()
BODY_TREE=BVHTree.FromObject(body,bpy.context.evaluated_depsgraph_get())
def front_surface(y,z,offset=.006):
    hit,normal,index,dist=BODY_TREE.ray_cast(Vector((-3.2,y,z)),Vector((1,0,0)),2.0)
    if hit is None:return (frontx(y,z)-offset,y,z)
    return (hit.x-offset,y,z)
def back_surface(y,z,offset=.006):
    hit,normal,index,dist=BODY_TREE.ray_cast(Vector((3.2,y,z)),Vector((-1,0,0)),2.0)
    if hit is None:return (rearx(y,z)+offset,y,z)
    return (hit.x+offset,y,z)
LAMP=[(.542,.649),(.602,.703),(.799,.824),(.909,.848),(.947,.803),(.941,.675),(.878,.624),(.694,.613),(.566,.627)]
for side in [-1,1]:
    s=side
    proj=lambda y,z:front_surface(s*y,z,.006)
    ob,border=patch('Waterdrop headlight | dark compound-curved optical housing',LAMP,proj,lampglass)
    curve('Headlight rubber gasket',border,gap,.004,True)
    curve('Headlight polished rim',[front_surface(s*y,z,.009) for y,z in chaikin(LAMP,2)],silver,.0014,True)
    guide=[(.561,.646),(.661,.665),(.795,.701),(.931,.737)]
    curve('Signature sweeping diagonal DRL',[front_surface(s*lerp(guide[i][0],guide[i+1][0],k/16),lerp(guide[i][1],guide[i+1][1],k/16),.014) for i in range(len(guide)-1) for k in range(17)],white,.005)
    guide=[(.615,.632),(.740,.634),(.851,.649),(.918,.678)]
    curve('Lower segmented optical return',[front_surface(s*lerp(guide[i][0],guide[i+1][0],k/16),lerp(guide[i][1],guide[i+1][1],k/16),.014) for i in range(len(guide)-1) for k in range(17)],white,.003)
    guide=[(.712,.724),(.766,.775),(.819,.791)]
    curve('Upper arrow DRL accent',[front_surface(s*lerp(guide[i][0],guide[i+1][0],k/16),lerp(guide[i][1],guide[i+1][1],k/16),.014) for i in range(len(guide)-1) for k in range(17)],white,.0034)
    for y,z in [(.848,.780),(.899,.790),(.811,.669),(.868,.687)]:
        q=Vector(front_surface(s*y,z,.011))
        uv('Rectangular LED projector surround',q,(.010,.022,.019),silver)
        uv('Deep projector optic',q+Vector((-.006,0,0)),(.008,.015,.013),lampglass)
''' +s[end:]
s=s.replace("proj2=lambda y,z:(frontx(s*y,z)-.006,s*y,z)", "proj2=lambda y,z:front_surface(s*y,z,.007)")
s=s.replace("proj=lambda y,z:(frontx(y,z)-.009,y,z)","proj=lambda y,z:front_surface(y,z,.009)")
s=s.replace("lambda y,z:(frontx(y,z)-.024,y,z)","lambda y,z:front_surface(y,z,.025)")
s=s.replace("def rearproj(y,z):return (rearx(y,z)+.009,y,z)","def rearproj(y,z):return back_surface(y,z,.009)")
s=s.replace("lambda y,z:(rearx(y,z)+.014,y,z)","lambda y,z:back_surface(y,z,.014)")
s=s.replace("lambda y,z:(rearx(y,z)+.013,y,z)","lambda y,z:back_surface(y,z,.013)")
# Hood seam sampled from unwarped longitudinal coordinates.
start=s.index("    pts=[topsurf(-.997");end=s.index("    for name,path",start)
s=s[:start]+'''    hoodpath=[(-.997,.77),(-1.38,.77),(-1.88,.705),(-2.18,.57),(-2.29,.29),(-2.30,0)]
    curve('Hood precision shut line',[topsurf(lerp(hoodpath[i][0],hoodpath[i+1][0],k/30),s*lerp(hoodpath[i][1],hoodpath[i+1][1],k/30),.003) for i in range(len(hoodpath)-1) for k in range(31)],gap,.0015)
''' +s[end:]
s=s.replace("for x in [-.23,.86]:", "for x in []:")
s=s.replace("black,.034)","black,.022)").replace("black,.026)","black,.014)").replace("black,.029)","black,.016)")
s=s.replace("curve('Retractable spoiler shut line'", "curve('Retractable spoiler shut line'")
# Apply the rear lettering directly to the convex tail surface, one character at a time.
old="textobj('Rear spaced Xiaomi lettering','x  i  a  o  m  i',(2.496,0,.905),.039,silver,(1,0,0),(0,1,0))"
new="""for i,ch in enumerate('xiaomi'):
    y=(i-2.5)*.091
    textobj('Rear spaced Xiaomi lettering | '+ch,ch,back_surface(y,.906,.015),.041,silver,(1,0,0),(0,1,0))"""
s=s.replace(old,new)
s=s.replace("(2.465,.458,.695)","back_surface(.458,.695,.014)").replace("(2.454,.526,.695)","back_surface(.526,.695,.014)")
s=s.replace("(2.46,-.479,.695)","back_surface(-.479,.695,.014)")
# Lidar cap must look like a low rectangular sensor rather than a roof ornament.
s=s.replace("lidar=uv('Roof lidar painted pod',(-.25,0,1.438),(.129,.133,.047),black)", "lidar=cube('Roof lidar painted pod',(-.25,0,1.423),(.208,.222,.061),black,.027)")
s=s.replace("(-.358,0,1.445)","(-.357,0,1.429)")
s=s.replace("(1.23,0,1.220)","(1.23,0,1.221)")
# The front softboxes illuminate the car but do not form blown white rectangles in its glazing.
s=s.replace("o.location=loc;aim(o,target)\ndef camera", "o.location=loc;aim(o,target)\ndef camera")
s=s.replace("o.location=loc;aim(o,target)\narea('Key", "o.location=loc;aim(o,target)\n    if name.startswith('Key') or name.startswith('Front fill') or name.startswith('Side highlight'):o.visible_glossy=False\narea('Key")
s=s.replace("(-7.8,-6.4,2.53)", "(-6.9,-8.0,2.55)")
s=s.replace("(200,200,-.003),(-200,200,-.003)","(200,200,-.003),(-200,200,-.003)")
# Large matching cyclorama behind the floor eliminates the horizon discontinuity.
s=s.replace("scene=bpy.context.scene", """# Curved cyclorama for every review camera.
vs=[];fs=[]
for i in range(129):
    a=2*pi*i/128
    for r,z in [(35,-.004),(39,.1),(42,1),(44,3),(45,6),(45,30)]:vs.append((r*cos(a),r*sin(a),z))
for i in range(128):
    for j in range(5):
        a=i*6+j;fs.append((a,a+6,a+7,a+1))
mesh('Seamless curved studio cyclorama',vs,fs,floor)
scene=bpy.context.scene""")
s=s.replace("views=['front_hero','side','rear_hero'] if DRAFT", "views=['front_hero','front','rear_hero','side'] if DRAFT")
p.write_text(s)
print('Applied revision 03: ray-projected waterdrop lights, seams, badges and studio.')
