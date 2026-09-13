import bpy
from pathlib import Path
ROOT=Path(__file__).resolve().parent
p=ROOT/'build_su7.py';src=p.read_text()
start=src.index('    rail=[]');end=src.index("    curve('Roof drip molding'",start)
src=src[:start]+"    curve('Painted continuous A pillar and roof rail',outline,paint,.013,True)\n"+src[end:]
src=src.replace("VERSION = '07'","VERSION = '08'");p.write_text(src)
blacks=[o for o in bpy.data.objects if o.name.startswith('Window perimeter | satin black surround')]
for blue in [o for o in bpy.data.objects if o.name.startswith('Painted continuous A pillar and roof rail')]:
    sign=sum(p.co.y for p in blue.data.splines[0].points)
    black=next(o for o in blacks if sign*sum(p.co.y for p in o.data.splines[0].points)>0)
    coords=[tuple(p.co) for p in black.data.splines[0].points]
    blue.data.splines.clear();sp=blue.data.splines.new('POLY');sp.points.add(len(coords)-1)
    for pt,co in zip(sp.points,coords):pt.co=co
    sp.use_cyclic_u=True;blue.data.bevel_depth=.013
fp=ROOT/'finalize_su7.py';fp.write_text(fp.read_text().replace("'visual_iterations':7","'visual_iterations':8"))
np=ROOT/'MODEL_NOTES.md';np.write_text(np.read_text().replace('## Rebuild','8. Registered the painted window frame directly to the smooth window seal to remove the remaining A-pillar alignment difference.\n\n## Rebuild'))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'Xiaomi_SU7_Max.blend'))
scene=bpy.context.scene;scene.render.resolution_x=1120;scene.render.resolution_y=560
scene.cycles.samples=16;scene.cycles.adaptive_threshold=.08;scene.cycles.adaptive_min_samples=8
scene.render.filepath=str(ROOT/'renders'/'review_08_front_hero.png')
bpy.ops.render.render(write_still=True)
print('WINDOW_FRAME_ALIGNED',flush=True)
