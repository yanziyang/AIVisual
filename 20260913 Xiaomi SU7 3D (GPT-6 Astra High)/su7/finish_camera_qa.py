import bpy
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
p=ROOT/'build_su7.py';src=p.read_text().replace("(-9,0,.83),(0,0,.83)","(-9,0,1.36),(0,0,.83)").replace("(9,0,.83),(0,0,.83)","(9,0,1.36),(0,0,.83)");p.write_text(src)
for name in ['04 | Front orthographic','05 | Rear orthographic']:
    o=bpy.data.objects[name];o.location.z=1.36
    o.rotation_euler=(Vector((0,0,.83))-o.location).to_track_quat('-Z','Y').to_euler()
t=bpy.data.texts.get('build_su7.py');t.clear();t.write(src)
scene=bpy.context.scene
scene.camera=bpy.data.objects['01 | Front three-quarter']
scene.render.resolution_x=1920;scene.render.resolution_y=960
scene.render.filepath=str(ROOT/'renders'/'front_hero.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'Xiaomi_SU7_Max.blend'))
scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.05;scene.cycles.adaptive_min_samples=8
scene.render.resolution_x=1400;scene.render.resolution_y=950
for name,cam in [('front','04 | Front orthographic'),('rear','05 | Rear orthographic')]:
    scene.camera=bpy.data.objects[cam];scene.render.filepath=str(ROOT/'renders'/(name+'.png'))
    bpy.ops.render.render(write_still=True)
    print('CAMERA_QA_COMPLETE',name,flush=True)
