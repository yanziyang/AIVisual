import bpy, sys, time

engine = sys.argv[-1] if sys.argv[-1] in {"CYCLES", "BLENDER_EEVEE"} else "CYCLES"
out = sys.argv[-2] if sys.argv[-2].endswith(".png") else None

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(0, 0, 1))
sphere = bpy.context.object
mat = bpy.data.materials.new("M")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.02, 0.55, 0.6, 1)
bsdf.inputs["Metallic"].default_value = 0.9
bsdf.inputs["Roughness"].default_value = 0.25
sphere.data.materials.append(mat)

bpy.ops.mesh.primitive_plane_add(size=30)
plane = bpy.context.object
pmat = bpy.data.materials.new("P")
pmat.use_nodes = True
pmat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.25, 0.25, 0.27, 1)
plane.data.materials.append(pmat)

bpy.ops.object.light_add(type="AREA", location=(4, -5, 6))
key = bpy.context.object
key.data.energy = 2000
key.data.size = 5
key.rotation_euler = (0.7, 0.3, 0.5)

world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.35, 0.37, 0.4, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0

bpy.ops.object.camera_add(location=(4.5, -4.5, 2.5))
cam = bpy.context.object
import mathutils
direction = -cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
scene.camera = cam

scene.render.engine = engine
scene.render.resolution_x = 640
scene.render.resolution_y = 360
scene.render.filepath = out or "renders/test.png"
if engine == "CYCLES":
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.cycles.device = "CPU"

t0 = time.time()
bpy.ops.render.render(write_still=True)
print(f"RENDER_OK engine={engine} time={time.time()-t0:.1f}s out={scene.render.filepath}")
