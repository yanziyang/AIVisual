"""VELARIS studio: materials, lighting rig, cameras, render config, export."""

import bpy
import velaris_lib as vl
from math import radians
from mathutils import Vector


def build_materials():
    m = {}

    mat, nt, bsdf = vl.new_material("Velaris_LiquidSilver")
    nodes, links = nt.nodes, nt.links
    lw = nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.55
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.25
    ramp.color_ramp.elements[1].position = 0.90
    mix = nodes.new("ShaderNodeMixRGB")
    mix.inputs["Color1"].default_value = (0.74, 0.76, 0.80, 1.0)
    mix.inputs["Color2"].default_value = (0.34, 0.44, 0.62, 1.0)
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 1400.0
    noise.inputs["Detail"].default_value = 2.0
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.008
    links.new(lw.outputs["Facing"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], mix.inputs["Fac"])
    links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    vl.set_input(bsdf, "Metallic", 1.0)
    vl.set_input(bsdf, "Roughness", 0.22)
    vl.set_input(bsdf, "Coat Weight", 1.0)
    vl.set_input(bsdf, "Coat Roughness", 0.05)
    vl.set_input(bsdf, "Coat IOR", 1.5)
    m["paint"] = mat

    m["glass"] = vl.principled("Velaris_Glass", base=(0.78, 0.82, 0.84, 1.0),
                               transmission=1.0, roughness=0.025, ior=1.46,
                               coat=0.6, coat_rough=0.02)
    m["lamp_lens"] = vl.principled("Velaris_LampLens", base=(0.85, 0.88, 0.90, 1.0),
                                   transmission=1.0, roughness=0.04, ior=1.52,
                                   coat=0.6, coat_rough=0.02)
    m["dark_trim"] = vl.principled("Velaris_DarkTrim", base=(0.013, 0.014, 0.016, 1.0),
                                   roughness=0.48)
    m["dark_chrome"] = vl.principled("Velaris_DarkChrome", base=(0.075, 0.08, 0.09, 1.0),
                                     metallic=1.0, roughness=0.16)
    m["chrome"] = vl.principled("Velaris_Chrome", base=(0.92, 0.94, 0.97, 1.0),
                                metallic=1.0, roughness=0.045)
    m["rubber"] = vl.principled("Velaris_Rubber", base=(0.013, 0.013, 0.014, 1.0),
                                roughness=0.88, sheen=0.25, sheen_rough=0.4)
    m["rim"] = vl.principled("Velaris_ForgedRim", base=(0.19, 0.196, 0.215, 1.0),
                             metallic=1.0, roughness=0.24)
    m["machined"] = vl.principled("Velaris_Machined", base=(0.62, 0.64, 0.68, 1.0),
                                  metallic=1.0, roughness=0.16)
    m["disc"] = vl.principled("Velaris_BrakeDisc", base=(0.30, 0.30, 0.32, 1.0),
                              metallic=1.0, roughness=0.42, anisotropic=0.4)
    m["disc_hat"] = vl.principled("Velaris_DiscHat", base=(0.16, 0.16, 0.17, 1.0),
                                  metallic=1.0, roughness=0.5)
    m["caliper"] = vl.principled("Velaris_Caliper", base=(0.015, 0.09, 0.28, 1.0),
                                 metallic=0.85, roughness=0.32)
    m["leather"] = vl.principled("Velaris_Leather", base=(0.045, 0.040, 0.038, 1.0),
                                 roughness=0.55, sheen=0.15, sheen_rough=0.4)
    m["suede"] = vl.principled("Velaris_Suede", base=(0.058, 0.060, 0.064, 1.0),
                               roughness=0.78, sheen=0.9, sheen_rough=0.25,
                               sheen_tint=(0.5, 0.5, 0.5, 1.0))
    m["screen"] = vl.principled("Velaris_Screen", base=(0.02, 0.024, 0.032, 1.0),
                                roughness=0.08, emission=(0.10, 0.15, 0.22, 1.0),
                                emission_strength=1.5, coat=1.0, coat_rough=0.02)
    m["led_white"] = vl.emission_material("Velaris_LED_White", (1.0, 0.975, 0.94, 1.0), 55.0)
    m["led_white_soft"] = vl.emission_material("Velaris_LED_Soft", (1.0, 0.97, 0.93, 1.0), 8.0)
    m["led_red"] = vl.emission_material("Velaris_LED_Red", (1.0, 0.02, 0.015, 1.0), 40.0)
    m["ground"] = vl.principled("Velaris_Ground", base=(0.018, 0.019, 0.021, 1.0),
                                roughness=0.34)

    mat, nt, bsdf = vl.new_material("Velaris_Carbon")
    nodes, links = nt.nodes, nt.links
    tc = nodes.new("ShaderNodeTexCoord")
    mp = nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (60.0, 60.0, 60.0)
    links.new(tc.outputs["Object"], mp.inputs["Vector"])
    w1 = nodes.new("ShaderNodeTexWave")
    w1.wave_type = "BANDS"
    w1.bands_direction = "X"
    w1.inputs["Scale"].default_value = 1.0
    w2 = nodes.new("ShaderNodeTexWave")
    w2.wave_type = "BANDS"
    w2.bands_direction = "Z"
    w2.inputs["Scale"].default_value = 1.0
    links.new(mp.outputs["Vector"], w1.inputs["Vector"])
    links.new(mp.outputs["Vector"], w2.inputs["Vector"])
    mm = nodes.new("ShaderNodeMixRGB")
    mm.blend_type = "MULTIPLY"
    links.new(w1.outputs["Color"], mm.inputs["Color1"])
    links.new(w2.outputs["Color"], mm.inputs["Color2"])
    rb = nodes.new("ShaderNodeValToRGB")
    rb.color_ramp.elements[0].position = 0.15
    rb.color_ramp.elements[0].color = (0.006, 0.006, 0.008, 1.0)
    rb.color_ramp.elements[1].position = 0.85
    rb.color_ramp.elements[1].color = (0.030, 0.031, 0.036, 1.0)
    links.new(mm.outputs["Color"], rb.inputs["Fac"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.35
    links.new(mm.outputs["Color"], bump.inputs["Height"])
    links.new(rb.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    vl.set_input(bsdf, "Roughness", 0.34)
    vl.set_input(bsdf, "Metallic", 0.15)
    vl.set_input(bsdf, "Anisotropic", 0.5)
    vl.set_input(bsdf, "Coat Weight", 0.35)
    vl.set_input(bsdf, "Coat Roughness", 0.06)
    m["carbon"] = mat

    mat, nt, bsdf = vl.new_material("Velaris_Mesh")
    nodes, links = nt.nodes, nt.links
    chk = nodes.new("ShaderNodeTexChecker")
    chk.inputs["Scale"].default_value = 220.0
    chk.inputs["Color1"].default_value = (0.006, 0.006, 0.007, 1.0)
    chk.inputs["Color2"].default_value = (0.03, 0.03, 0.033, 1.0)
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    links.new(chk.outputs["Fac"], bump.inputs["Height"])
    links.new(chk.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    vl.set_input(bsdf, "Roughness", 0.6)
    vl.set_input(bsdf, "Metallic", 0.4)
    m["mesh_dark"] = mat
    return m


def add_area(name, loc, target, size_x, size_y, energy, color=(1.0, 0.98, 0.95), collection=None):
    data = bpy.data.lights.new(name, "AREA")
    data.shape = "RECTANGLE"
    data.size = size_x
    data.size_y = size_y
    data.energy = energy
    data.color = color
    ob = bpy.data.objects.new(name, data)
    (collection or bpy.context.scene.collection).objects.link(ob)
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return ob


def add_softbox(name, loc, target, size_x, size_y, strength, color=(1.0, 0.985, 0.96), collection=None):
    mat = vl.emission_material(name + "_mat", color + (1.0,), strength)
    me = bpy.data.meshes.new(name)
    sx, sy = size_x * 0.5, size_y * 0.5
    verts = [(-sx, -sy, 0), (sx, -sy, 0), (sx, sy, 0), (-sx, sy, 0)]
    me.from_pydata(verts, [], [(0, 1, 2, 3)])
    me.update()
    ob = bpy.data.objects.new(name, me)
    (collection or bpy.context.scene.collection).objects.link(ob)
    vl.assign_material(ob, mat, 0)
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    ob.visible_camera = False
    return ob


def build_studio():
    col = vl.get_collection("Studio")
    bpy.ops.mesh.primitive_plane_add(size=80.0, location=(0, 0, 0))
    ground = bpy.context.active_object
    ground.name = "Studio_Ground"
    for c in list(ground.users_collection):
        c.objects.unlink(ground)
    col.objects.link(ground)
    return ground


def build_lights():
    col = vl.get_collection("Studio_Lights")
    add_softbox("Softbox_Top", (0.6, 0.0, 6.4), (0.4, 0.0, 0.0), 9.0, 4.0, 5.0, collection=col)
    add_softbox("Softbox_Left", (0.0, -5.6, 2.7), (0, 0, 0.8), 8.0, 1.3, 4.0,
                color=(0.95, 0.97, 1.0), collection=col)
    add_softbox("Softbox_Right", (0.0, 5.6, 2.7), (0, 0, 0.8), 8.0, 1.3, 3.2,
                color=(1.0, 0.97, 0.93), collection=col)
    add_softbox("Softbox_Front", (7.2, 0.0, 2.6), (0, 0, 0.6), 5.0, 2.6, 2.6, collection=col)
    add_softbox("Softbox_Rear", (-7.0, 0.0, 2.4), (0, 0, 0.6), 5.0, 2.4, 2.4, collection=col)
    add_area("Key", (4.6, -4.0, 4.4), (0.1, 0, 0.7), 6.0, 2.6, 1300.0, collection=col)
    add_area("Fill", (-3.2, 4.6, 3.6), (0.0, 0, 0.8), 5.5, 2.6, 520.0,
             color=(0.90, 0.94, 1.0), collection=col)
    add_area("Rim", (-5.2, -2.2, 3.2), (-0.8, 0, 0.8), 4.0, 1.4, 950.0, collection=col)
    add_area("Top", (0.6, 0.0, 6.2), (0.4, 0, 0.0), 8.0, 3.5, 900.0, collection=col)
    add_area("Hood", (6.6, 1.4, 1.6), (1.6, 0, 0.6), 3.0, 1.1, 320.0, collection=col)
    add_area("Cabin", (0.15, 0.0, 1.08), (0.2, 0, 0.70), 0.5, 0.4, 4.0,
             color=(1.0, 0.96, 0.90), collection=col)
    add_area("InteriorFill", (-0.55, 0.0, 0.98), (1.2, 0.0, 0.72), 1.2, 0.7, 80.0,
             color=(1.0, 0.96, 0.90), collection=col)
    add_area("InteriorFill_Side", (0.3, 0.0, 1.02), (-0.4, 0.35, 0.72), 0.8, 0.5, 30.0,
             color=(1.0, 0.97, 0.93), collection=col)
    for sgn, tag in ((1, "L"), (-1, "R")):
        add_area("HeadlightSpill_" + tag, (2.62, 0.80 * sgn, 0.64), (2.15, 0.42 * sgn, 0.48),
                 0.16, 0.10, 6.0, color=(0.95, 0.97, 1.0), collection=col)


def add_camera(name, loc, target, lens):
    col = vl.get_collection("Studio_Cameras")
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.clip_end = 500.0
    ob = bpy.data.objects.new(name, data)
    col.objects.link(ob)
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return ob


def build_cameras():
    cams = {}
    cams["front_3q"] = add_camera("CAM_Front3Q", (7.0, -5.2, 2.10), (0.10, 0, 0.55), 50)
    cams["side"] = add_camera("CAM_Side", (0.15, -15.0, 0.85), (0.0, 0, 0.62), 80)
    cams["front"] = add_camera("CAM_Front", (10.5, 0.0, 0.80), (0.3, 0, 0.60), 60)
    cams["rear_3q"] = add_camera("CAM_Rear3Q", (-6.8, -5.0, 2.00), (-0.10, 0, 0.60), 50)
    cams["rear"] = add_camera("CAM_Rear", (-10.5, 0.0, 0.90), (-0.3, 0, 0.65), 60)
    cams["hero"] = add_camera("CAM_Hero", (5.4, -4.1, 3.10), (0.0, 0, 0.50), 42)
    cams["detail_front"] = add_camera("CAM_DetailFront", (3.3, -2.3, 0.95), (1.85, -0.35, 0.55), 85)
    cams["detail_wheel"] = add_camera("CAM_DetailWheel", (2.55, -1.75, 0.60), (1.45, -0.65, 0.35), 100)
    cams["interior"] = add_camera("CAM_Interior", (-0.18, 0.34, 1.00), (2.8, 0.05, 0.70), 24)
    cams["rear_3q_L"] = add_camera("CAM_Rear3QL", (-4.8, 4.4, 1.65), (-0.35, 0, 0.68), 55)
    return cams


def build_world():
    world = bpy.data.worlds.new("Velaris_World")
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.010, 0.012, 0.016, 1.0)
    bg.inputs["Strength"].default_value = 1.0


def configure_render(samples=32, res=(1280, 720)):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.02
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        pass
    sc.cycles.max_bounces = 10
    sc.cycles.diffuse_bounces = 4
    sc.cycles.glossy_bounces = 6
    sc.cycles.transmission_bounces = 10
    sc.cycles.transparent_max_bounces = 8
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.render.resolution_x = res[0]
    sc.render.resolution_y = res[1]
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.render.use_persistent_data = True
    try:
        sc.view_settings.view_transform = "AgX"
        try:
            sc.view_settings.look = "AgX - Medium High Contrast"
        except Exception:
            pass
    except Exception:
        sc.view_settings.view_transform = "Filmic"
        try:
            sc.view_settings.look = "Medium High Contrast"
        except Exception:
            pass
    sc.view_settings.exposure = 0.35


VIEW_CAMS = {
    "front_3q": "CAM_Front3Q", "side": "CAM_Side", "front": "CAM_Front",
    "rear_3q": "CAM_Rear3Q", "rear": "CAM_Rear", "hero": "CAM_Hero",
    "detail_front": "CAM_DetailFront", "detail_wheel": "CAM_DetailWheel",
    "interior": "CAM_Interior", "rear_3q_L": "CAM_Rear3QL",
}


def render_views(names, out_dir, samples=32, res=(1280, 720)):
    sc = bpy.context.scene
    cams = {o.name: o for o in bpy.data.objects if o.type == "CAMERA"}
    fills = [o for o in bpy.data.objects
             if o.type == "LIGHT" and o.name.startswith("InteriorFill")]
    for name in names:
        cam = cams.get(VIEW_CAMS.get(name, name))
        if cam is None:
            print("WARN camera missing:", name)
            continue
        for o in fills:
            o.hide_render = (name != "interior")
        sc.camera = cam
        sc.render.filepath = out_dir + "\\" + name
        bpy.ops.render.render(write_still=True)
        print("RENDERED", name)
    for o in fills:
        o.hide_render = False


def save_blend(path):
    bpy.ops.wm.save_as_mainfile(filepath=path)


def export_glb(path):
    car_cols = ("VELARIS_Body", "VELARIS_Wheels", "VELARIS_Interior")
    objs = []
    for col_name in car_cols:
        col = bpy.data.collections.get(col_name)
        if col:
            objs += list(col.all_objects)
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0] if objs else None
    try:
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB",
                                  use_selection=True, export_apply=True)
        print("EXPORTED GLB", path)
    except Exception as exc:
        print("WARN GLB export failed:", exc)
