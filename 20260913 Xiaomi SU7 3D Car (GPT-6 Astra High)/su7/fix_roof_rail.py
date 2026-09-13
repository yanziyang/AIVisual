import bpy, ast, math, os
from pathlib import Path
from math import sin,cos,pi,sqrt
ROOT=Path(__file__).resolve().parent
p=ROOT/'build_su7.py';src=p.read_text()
start=src.index('    rail=[(-1.008,.95)');end=src.index("    curve('Roof drip molding'",start)
new="""    rail=[]
    for k in range(241):
        x=lerp(-1.008,1.89,k/240)
        ratio=lerp(.955,.735,smooth((x+1.008)/.72)) if x<-.288 else lerp(.735,.87,smooth((x-1.02)/.87))
        rail.append(canopy(x,s*sample(CW,x)*ratio,.006))
    curve('Painted continuous A pillar and roof rail',rail,paint,.014)
"""
src=src[:start]+new+src[end:];src=src.replace("VERSION = '06'","VERSION = '07'");p.write_text(src)
tree=ast.parse(src);nodes=[]
for node in tree.body:
    if isinstance(node,ast.FunctionDef) and node.name in {'lerp','clamp','smooth','sample','hood','canopy'}:nodes.append(node)
    if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id in {'HZ','CW','ROOF'} for t in node.targets):nodes.append(node)
exec(compile(ast.Module(body=nodes,type_ignores=[]),str(p),'exec'))
for ob in bpy.data.objects:
    if ob.name.startswith('Painted continuous A pillar and roof rail'):
        sign=1 if sum(pt.co.y for pt in ob.data.splines[0].points)>0 else -1
        ob.data.splines.clear();sp=ob.data.splines.new('POLY');sp.points.add(240)
        for k in range(241):
            x=lerp(-1.008,1.89,k/240)
            ratio=lerp(.955,.735,smooth((x+1.008)/.72)) if x<-.288 else lerp(.735,.87,smooth((x-1.02)/.87))
            sp.points[k].co=(*canopy(x,sign*sample(CW,x)*ratio,.006),1)
        ob.data.bevel_depth=.014
fp=ROOT/'finalize_su7.py';fp.write_text(fp.read_text().replace("'visual_iterations':6","'visual_iterations':7"))
np=ROOT/'MODEL_NOTES.md';np.write_text(np.read_text().replace('## Rebuild','7. Full-resolution inspection caught a wavy A-pillar trim projection; replaced it with a smooth surface-parameterized rail.\n\n## Rebuild'))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'Xiaomi_SU7_Max.blend'))
print('ROOF_RAIL_CORRECTED',flush=True)

scene=bpy.context.scene
scene.render.resolution_x=1120;scene.render.resolution_y=560
scene.cycles.samples=16;scene.cycles.adaptive_threshold=.08;scene.cycles.adaptive_min_samples=8
scene.render.filepath=str(ROOT/'renders'/'review_07_front_hero.png')
bpy.ops.render.render(write_still=True)