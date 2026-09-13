"""Production render and portable export of the saved Blender 3.6.23 SU7 scene."""
import bpy, os, sys, json, math, struct
from mathutils import Vector
ROOT=os.path.dirname(os.path.abspath(__file__))
RENDERS=os.path.join(ROOT,'renders')
scene=bpy.context.scene
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
vehicle=[o for o in scene.objects if any(c.name.startswith('SU7 |') for c in o.users_collection)]

# Store the editable source and modeling notes in the native project.
for filename in ['build_su7.py','MODEL_NOTES.md','finalize_su7.py']:
    t=bpy.data.texts.get(filename) or bpy.data.texts.new(filename)
    with open(os.path.join(ROOT,filename),encoding='utf-8') as f:t.clear();t.write(f.read())
root=bpy.data.objects.get('Xiaomi SU7 Max | vehicle root')
if root is None:
    root=bpy.data.objects.new('Xiaomi SU7 Max | vehicle root',None)
    bpy.data.collections['SU7 | BODY'].objects.link(root)
    for o in vehicle:o.parent=root
root['Variant']='First-generation SU7 Max, Aqua Blue'
root['Nominal dimensions mm']='4997 / 1963 / 1440; 3000 wheelbase'
root['Reconstruction']='Photo referenced; no certified percentage of similarity'
for c in bpy.data.collections:
    if c.name.startswith('REFERENCE'):c.hide_render=True;c.hide_viewport=True
scene.render.engine='CYCLES';scene.cycles.device='CPU'
scene.cycles.samples=48;scene.cycles.use_adaptive_sampling=True
scene.cycles.adaptive_threshold=.05;scene.cycles.adaptive_min_samples=8
scene.cycles.use_denoising=True;scene.cycles.max_bounces=7
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
scene.render.image_settings.color_depth='8';scene.render.image_settings.compression=20
scene.render.resolution_percentage=100
scene.camera=bpy.data.objects['01 | Front three-quarter']
scene.render.resolution_x=1920;scene.render.resolution_y=960
scene.render.filepath=os.path.join(RENDERS,'front_hero.png')
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':
            a.spaces.active.region_3d.view_perspective='CAMERA'
            a.spaces.active.shading.type='MATERIAL'
            a.spaces.active.shading.use_scene_world=False
            a.spaces.active.overlay.show_overlays=False
            a.spaces.active.lens=60

deps=bpy.context.evaluated_depsgraph_get()
body=bpy.data.objects['Unified aluminum body | welded hood, quarters and bumpers']
body_eval=body.evaluated_get(deps)
corners=[body_eval.matrix_world@Vector(v) for v in body_eval.bound_box]
body_dimensions=[max(v[i] for v in corners)-min(v[i] for v in corners) for i in range(3)]
native_meshes=[o for o in vehicle if o.type=='MESH']
bad=[]
for o in native_meshes:
    if not all(math.isfinite(c) for v in o.data.vertices for c in v.co):bad.append(o.name)
audit={
 'blender_version':bpy.app.version_string,
 'vehicle_objects':len(vehicle),
 'native_mesh_vertices':sum(len(o.data.vertices) for o in native_meshes),
 'native_mesh_faces':sum(len(o.data.polygons) for o in native_meshes),
 'body_shell_evaluated_dimensions_m':dict(zip(['length','width','shell_height'],body_dimensions)),
 'nominal_roof_height_m':1.440,
 'wheel_center_x_m':[-1.60,1.40],
 'wheelbase_m':3.0,
 'packed_reference_images':sum(1 for im in bpy.data.images if im.packed_file),
 'non_finite_meshes':bad,
 'cameras':[o.name for o in scene.objects if o.type=='CAMERA'],
 'visual_iterations':8,
 'accuracy_status':'Photo-based approximation; no objective 99% similarity claim',
 'validation':'Native scene saved; meshes checked for finite coordinates; GLB validated separately below',
}
assert bpy.app.version[:2]==(3,6)
assert not bad
assert audit['packed_reference_images']>=5
bpy.ops.object.select_all(action='DESELECT')
root.select_set(True);bpy.context.view_layer.objects.active=root
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'Xiaomi_SU7_Max.blend'))
print('NATIVE_SCENE_SAVED',flush=True)

if '--skip-export' not in args:
    # Bake copies for glTF while retaining the native model's curves and modifiers.
    expcol=bpy.data.collections.new('TEMP | portable export');scene.collection.children.link(expcol)
    copies=[]
    for o in vehicle:
        if o.type not in {'MESH','CURVE','FONT','SURFACE'}:continue
        cp=o.copy();cp.data=o.data.copy();cp.parent=None;cp.matrix_world=o.matrix_world.copy()
        expcol.objects.link(cp);copies.append(cp)
    bpy.ops.object.select_all(action='DESELECT')
    for o in copies:o.select_set(True)
    bpy.context.view_layer.objects.active=copies[0]
    bpy.ops.object.convert(target='MESH')
    copies=list(bpy.context.selected_objects)
    gm=bpy.data.materials.new('Automotive tinted glass | portable');gm.use_nodes=True
    gp=gm.node_tree.nodes.get('Principled BSDF')
    gp.inputs['Base Color'].default_value=(.010,.024,.040,1)
    gp.inputs['Metallic'].default_value=.22;gp.inputs['Roughness'].default_value=.17
    gp.inputs['Clearcoat'].default_value=.25
    for o in copies:
        for slot in o.material_slots:
            if slot.material and slot.material.name.startswith('Tinted laminated'):slot.material=gm
    dest=os.path.join(ROOT,'Xiaomi_SU7_Max.glb')
    bpy.ops.export_scene.gltf(filepath=dest,export_format='GLB',use_selection=True,
                             export_yup=True,export_apply=True,export_cameras=False,
                             export_lights=False,export_animations=False)
    for o in copies:bpy.data.objects.remove(o,do_unlink=True)
    bpy.data.collections.remove(expcol)
    with open(dest,'rb') as f:
        magic,version,total=struct.unpack('<4sII',f.read(12))
        length,kind=struct.unpack('<I4s',f.read(8));doc=json.loads(f.read(length).decode('utf-8'))
    assert magic==b'glTF' and version==2 and total==os.path.getsize(dest)
    assert doc.get('meshes') and doc.get('scenes')
    audit['glb']={'bytes':total,'meshes':len(doc['meshes']),'nodes':len(doc.get('nodes',[])),'version':version,'header_and_scene_valid':True}
    print('GLB_EXPORT_VALIDATED',audit['glb'],flush=True)

with open(os.path.join(ROOT,'scene_audit.json'),'w') as f:json.dump(audit,f,indent=2)
views=[('front_hero','01 | Front three-quarter',1920,960),
       ('rear_hero','02 | Rear three-quarter',1920,960),
       ('side','03 | Side orthographic',1920,760),
       ('front','04 | Front orthographic',1400,950),
       ('rear','05 | Rear orthographic',1400,950),
       ('wheel','06 | Wheel detail',1400,1050)]
if '--no-render' not in args:
    for name,cam,w,h in views:
        if '--resume' in args and os.path.isfile(os.path.join(RENDERS,name+'.png')):continue
        scene.cycles.samples=48 if 'hero' in name else 32
        scene.camera=bpy.data.objects[cam];scene.render.resolution_x=w;scene.render.resolution_y=h
        scene.render.filepath=os.path.join(RENDERS,name+'.png')
        print('PRODUCTION_RENDER_START',name,flush=True)
        bpy.ops.render.render(write_still=True)
        print('PRODUCTION_RENDER_COMPLETE',name,flush=True)
print('SU7_DELIVERY_COMPLETE',flush=True)
