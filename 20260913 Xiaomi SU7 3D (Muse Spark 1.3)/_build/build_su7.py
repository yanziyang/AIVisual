import bpy, math, os

# ==== CLEAN ====
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for coll in [bpy.data.meshes, bpy.data.materials, bpy.data.curves]:
    for x in list(coll):
        try: coll.remove(x)
        except: pass

scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0
scene.render.engine = 'CYCLES'
scene.cycles.samples = 128
scene.cycles.use_denoising = True
scene.cycles.denoiser = 'OPENIMAGEDENOISE'
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
world = bpy.context.scene.world
world.use_nodes = True
wn = world.node_tree.nodes
wl = world.node_tree.links
wn.clear()
out = wn.new(type='ShaderNodeOutputWorld')
bg = wn.new(type='ShaderNodeBackground')
bg.inputs['Color'].default_value = (0.32, 0.34, 0.38, 1.0)
bg.inputs['Strength'].default_value = 1.0
world.node_tree.links.new(bg.outputs['Background'], out.inputs['Surface'])

def mat_car_paint():
    m = bpy.data.materials.new("SU7_AquaBlue")
    m.use_nodes = True
    n = m.node_tree.nodes
    l = m.node_tree.links
    n.clear()
    out = n.new('ShaderNodeOutputMaterial')
    bsdf = n.new('ShaderNodeBsdfPrincipled')
    # Aqua Blue ~ #11B3C3 teal
    bsdf.inputs['Base Color'].default_value = (0.02, 0.55, 0.62, 1.0)
    bsdf.inputs['Metallic'].default_value = 0.25
    bsdf.inputs['Specular'].default_value = 0.6
    bsdf.inputs['Roughness'].default_value = 0.32
    try: bsdf.inputs['Clearcoat'].default_value = 1.0
    except: pass
    try: bsdf.inputs['Clearcoat Roughness'].default_value = 0.06
    except: pass
    try: bsdf.inputs['IOR'].default_value = 1.45
    except: pass
    m.node_tree.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return m

def mat_simple(name, color, metallic=0.0, rough=0.5, emission_color=None, emission_strength=0.0, transmission=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    n = m.node_tree.nodes
    l = m.node_tree.links
    n.clear()
    out = n.new('ShaderNodeOutputMaterial')
    bsdf = n.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = rough
    if transmission > 0:
        try: bsdf.inputs['Transmission'].default_value = transmission
        except: pass
    if emission_color is not None:
        try:
            bsdf.inputs['Emission'].default_value = (*emission_color, 1.0)
            bsdf.inputs['Emission Strength'].default_value = emission_strength
        except:
            pass
    m.node_tree.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return m

MAT_PAINT = mat_car_paint()
MAT_GLASS = mat_simple("GlassDark", (0.015,0.02,0.025), metallic=0.0, rough=0.05, transmission=0.15)
MAT_GLASS.inputs if False else None
# Make glass glossy dark: tweak
MAT_GLASS.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value = 0.1
MAT_BLACK_TRIM = mat_simple("BlackTrim", (0.02,0.02,0.022), rough=0.55)
MAT_BLACK_GLOSS = mat_simple("BlackGloss", (0.01,0.01,0.012), rough=0.25)
MAT_CHROME = mat_simple("Chrome", (0.9,0.9,0.92), metallic=1.0, rough=0.12)
MAT_TIRE = mat_simple("Tire", (0.02,0.02,0.02), rough=0.9)
MAT_RIM_SILVER = mat_simple("RimSilver", (0.85,0.86,0.88), metallic=1.0, rough=0.25)
MAT_RIM_DARK = mat_simple("RimDark", (0.08,0.08,0.09), metallic=0.8, rough=0.35)
MAT_BRAKE = mat_simple("BrakeDisc", (0.5,0.5,0.52), metallic=1.0, rough=0.35)
MAT_CALIPER = mat_simple("BremboYellow", (0.95,0.65,0.02), rough=0.4)
MAT_HEAD_DARK = mat_simple("HeadDark", (0.02,0.025,0.03), rough=0.2, metallic=0.3)
MAT_DRL = mat_simple("DRL", (1,1,1), emission_color=(1,1,1), emission_strength=12.0)
MAT_LED = mat_simple("LED", (1,1,1), emission_color=(0.9,0.95,1.0), emission_strength=8.0)
MAT_TAIL_RED = mat_simple("TailRed", (0.6,0.02,0.03), emission_color=(1.0,0.05,0.08), emission_strength=6.0)
MAT_TAIL_DARK = mat_simple("TailDark", (0.05,0.01,0.015), rough=0.3)
MAT_PLATE = mat_simple("Plate", (0.95,0.95,0.95), rough=0.5)
MAT_GRILLE = mat_simple("Grille", (0.01,0.01,0.01), rough=0.7)

def assign_mat(obj, mat):
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)

# ============ BODY LOFT ============
# Stations front (+X) to rear (-X): x, half_width, z_bottom, z_top
stations = [
    ( 2.50, 0.82, 0.22, 0.58),
    ( 2.42, 0.90, 0.14, 0.64),
    ( 2.25, 0.94, 0.10, 0.70),
    ( 2.00, 0.96, 0.10, 0.78),
    ( 1.70, 0.975,0.11, 0.84),
    ( 1.20, 0.98, 0.12, 0.88),
    ( 0.70, 0.975,0.12, 0.92),
    ( 0.20, 0.97, 0.12, 0.93),
    (-0.40, 0.97, 0.12, 0.94),
    (-1.00, 0.965,0.12, 0.94),
    (-1.60, 0.955,0.13, 0.93),
    (-2.00, 0.94, 0.14, 0.90),
    (-2.30, 0.92, 0.16, 0.87),
    (-2.50, 0.86, 0.22, 0.82),
]
N = 20
verts = []
faces = []
for si, (x, hw, zb, zt) in enumerate(stations):
    zc = (zb+zt)/2.0
    hz = (zt-zb)/2.0
    base = len(verts)
    for j in range(N):
        th = 2*math.pi*j/N
        c = math.cos(th); s = math.sin(th)
        # superellipse shaping: flatten top/bottom
        y = hw * c
        z = zc + hz * s
        # bottom narrower (tumblehome inverted)
        if s < 0:
            y *= (0.82 + 0.18*(1+ s))  # pinch bottom: at s=-1 ->0.82
            # flatten bottom
            if s < -0.7:
                z = zb + (z-zb)*0.5
        else:
            # top slightly narrower + flatter for hood/deck
            y *= (0.96)
            if s > 0.6:
                # flatten top centre
                z = zc + hz*(0.6 + 0.4*((s-0.6)/0.4)**0.7)*1.0
                # crown: centre higher? keep
        # nose/tail taper rounding in Z
        verts.append((x, y, z))
    # faces to next station
    if si < len(stations)-1:
        nxt = base + N
        for j in range(N):
            a = base+j
            b = base+(j+1)%N
            c = nxt+(j+1)%N
            d = nxt+j
            faces.append((a,b,c,d))

# caps: front fan + rear fan
front_center_idx = len(verts)
xc = stations[0][0]
# approx center
verts.append((xc, 0, (stations[0][2]+stations[0][3])/2))
rear_center_idx = len(verts)
xr = stations[-1][0]
verts.append((xr, 0, (stations[-1][2]+stations[-1][3])/2))
for j in range(N):
    faces.append((front_center_idx, j+1 if j+1<N else 0, j))  # front ring 0..N-1
off = (len(stations)-1)*N
for j in range(N):
    faces.append((rear_center_idx, off+j, off+(j+1)%N))

mesh = bpy.data.meshes.new("SU7_Body_Mesh")
mesh.from_pydata(verts, [], faces)
mesh.update()
body = bpy.data.objects.new("SU7_Body", mesh)
bpy.context.collection.objects.link(body)
bpy.context.view_layer.objects.active = body
body.select_set(True)
assign_mat(body, MAT_PAINT)
# smooth + subdivision later after booleans

# --- Wheel arch cutters ---
import mathutils
cutter_objs = []
wheel_positions = [(1.5, 0.82),(1.5,-0.82),(-1.5,0.82),(-1.5,-0.82)]
for (wx, wy) in wheel_positions:
    bpy.ops.mesh.primitive_cylinder_add(radius=0.405, depth=0.35, location=(wx, wy, 0.355), rotation=(0, math.radians(90), 0))
    cut = bpy.context.active_object
    cut.name = f"ArchCut_{wx}_{wy}"
    cut.display_type = 'WIRE'
    cutter_objs.append(cut)
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    bpy.context.view_layer.objects.active = body

for cut in cutter_objs:
    mod = body.modifiers.new(name=f"Bool_{cut.name}", type='BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.object = cut
    mod.solver = 'EXACT'

# subdivision + shade smooth
sub = body.modifiers.new("Subdiv", type='SUBSURF')
sub.levels = 2
sub.render_levels = 3
sub.subdivision_type = 'CATMULL_CLARK'
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.shade_smooth()

# Hide cutters from render
for cut in cutter_objs:
    cut.hide_render = True
    cut.hide_viewport = True

# ============ CABIN / GREENHOUSE ============
# cabin loft from windshield base to rear glass base
cabin_stations = [
    ( 1.10, 0.78, 0.88, 0.97),   # cowl
    ( 0.70, 0.82, 0.88, 1.28),   # windshield mid
    ( 0.30, 0.84, 0.88, 1.42),   # windshield top / roof front
    (-0.30, 0.845,0.88, 1.445),  # roof peak
    (-0.90, 0.83, 0.88, 1.36),   # roof rear / glass mid
    (-1.40, 0.80, 0.88, 1.12),   # rear glass base
    (-1.70, 0.78, 0.88, 0.96),   # deck
]
CN = 16
cverts=[]; cfaces=[]
for si,(x,hw,zb,zt) in enumerate(cabin_stations):
    zc=(zb+zt)/2; hz=(zt-zb)/2
    base=len(cverts)
    for j in range(CN):
        th=2*math.pi*j/CN
        c=math.cos(th); s=math.sin(th)
        y=hw*c
        z=zc+hz*s
        if s<0:
            y*=0.95
        else:
            y*=0.92
            if abs(c)<0.25:
                # flatten roof centre
                pass
        cverts.append((x,y,z))
    if si < len(cabin_stations)-1:
        nxt=base+CN
        for j in range(CN):
            a=base+j; b=base+(j+1)%CN; c=nxt+(j+1)%CN; d=nxt+j
            cfaces.append((a,b,c,d))
# caps
cverts.append((cabin_stations[0][0],0,(cabin_stations[0][2]+cabin_stations[0][3])/2))
cverts.append((cabin_stations[-1][0],0,(cabin_stations[-1][2]+cabin_stations[-1][3])/2))
fcc=len(cverts)-2; rcc=len(cverts)-1
for j in range(CN):
    cfaces.append((fcc, j+1 if j+1<CN else 0, j))
off=(len(cabin_stations)-1)*CN
for j in range(CN):
    cfaces.append((rcc, off+j, off+(j+1)%CN))

cmesh=bpy.data.meshes.new("CabinMesh")
cmesh.from_pydata(cverts,[],cfaces)
cmesh.update()
cabin=bpy.data.objects.new("SU7_Cabin",cmesh)
bpy.context.collection.objects.link(cabin)
assign_mat(cabin, MAT_GLASS)
bpy.context.view_layer.objects.active=cabin
cabin.select_set(True)
bpy.ops.object.shade_smooth()
sub2=cabin.modifiers.new("Subdiv",type='SUBSURF')
sub2.levels=2; sub2.render_levels=3
bpy.ops.object.select_all(action='DESELECT')

# Roof panel (body-color frame around glass? Keep glass as full, add black roof overlay + pillars)
# Add thin roof rails / black panoramic roof inset on top
bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.25, 0, 1.435))
roof=bpy.context.active_object
roof.name="PanoramicRoof"
roof.scale=(1.15, 0.72, 0.02)
assign_mat(roof, MAT_BLACK_GLOSS)
bpy.ops.object.select_all(action='DESELECT')

# LiDAR hump on windshield top
bpy.ops.mesh.primitive_cube_add(size=1, location=(0.35, 0, 1.46))
lidar=bpy.context.active_object
lidar.name="LiDAR"
lidar.scale=(0.18,0.12,0.05)
assign_mat(lidar, MAT_BLACK_GLOSS)
# bevel
mod=lidar.modifiers.new("Bevel",type='BEVEL')
mod.width=0.02; mod.segments=2
bpy.ops.object.select_all(action='DESELECT')

# ============ WHEELS (detailed) ============
def build_wheel(x, y, name):
    z=0.355
    # Tire
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.355, depth=0.245, location=(x,y,z), rotation=(0, math.radians(90),0))
    tire=bpy.context.active_object
    tire.name=name+"_Tire"
    assign_mat(tire, MAT_TIRE)
    # sidewall bevel via modifier
    bv=tire.modifiers.new("Bevel",type='BEVEL')
    bv.width=0.03; bv.segments=2; bv.limit_method='ANGLE'
    # Rim barrel
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.26, depth=0.20, location=(x, y+(0.02 if y>0 else -0.02), z), rotation=(0, math.radians(90),0))
    barrel=bpy.context.active_object
    barrel.name=name+"_Barrel"
    assign_mat(barrel, MAT_RIM_DARK)
    # Brake disc
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.19, depth=0.03, location=(x, y, z), rotation=(0, math.radians(90),0))
    disc=bpy.context.active_object
    disc.name=name+"_Disc"
    assign_mat(disc, MAT_BRAKE)
    # Caliper (yellow)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x-0.08, y, z+0.05))
    cal=bpy.context.active_object
    cal.name=name+"_Caliper"
    cal.scale=(0.12,0.07,0.16)
    cal.rotation_euler=(0,0,math.radians(20))
    assign_mat(cal, MAT_CALIPER)
    # Rim lip (torus)
    out_y = y + (0.105 if y>0 else -0.105)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.245, minor_radius=0.015, major_segments=48, minor_segments=12, location=(x,out_y,z), rotation=(0,math.radians(90),0))
    lip=bpy.context.active_object
    lip.name=name+"_Lip"
    assign_mat(lip, MAT_RIM_SILVER)
    # 5 double spokes = 10 spokes
    for k in range(5):
        ang = k*2*math.pi/5
        for off_ang in [-0.18, 0.18]:
            a = ang+off_ang
            dy = math.cos(a); dz = math.sin(a)
            # spoke box from center to rim
            sx = x
            sy = out_y - (0.01 if y>0 else -0.01)
            sz = z
            bpy.ops.mesh.primitive_cube_add(size=1, location=(sx, sy, sz))
            sp=bpy.context.active_object
            sp.name=f"{name}_Spoke_{k}_{off_ang}"
            sp.scale=(0.05, 0.02, 0.23)
            # orient: rotate around X axis by -a, then offset
            sp.rotation_euler=(math.radians(90)-0, 0, 0)  # placeholder
            # move centre outward half length
            # Use rotation around X
            sp.rotation_euler = (a, 0, 0)
            # offset position
            sp.location = (sx, sy + dy*0.13*(1 if y>0 else 1), sz + dz*0.13)
            # alternate silver/dark two-tone: outer face silver
            assign_mat(sp, MAT_RIM_SILVER if off_ang>0 else MAT_RIM_DARK)
    # hub cap
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.04, depth=0.22, location=(x, y, z), rotation=(0, math.radians(90),0))
    hub=bpy.context.active_object
    hub.name=name+"_Hub"
    assign_mat(hub, MAT_RIM_SILVER)
    bpy.ops.object.select_all(action='DESELECT')
    return tire

for (wx,wy) in wheel_positions:
    s = "FL" if wx>0 and wy>0 else "FR" if wx>0 else "RL" if wy>0 else "RR"
    build_wheel(wx,wy,f"Wheel_{s}")

# ============ LIGHTS ============
# Headlights: teardrop housings
for side in [1,-1]:
    # housing
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=1, location=(2.18, side*0.62, 0.68))
    h=bpy.context.active_object
    h.name=f"Headlight_{side}"
    h.scale=(0.28, 0.18, 0.09)
    h.rotation_euler=(0,0,math.radians(-18*side))
    assign_mat(h, MAT_HEAD_DARK)
    # lens cover slightly larger glass
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=1, location=(2.20, side*0.62, 0.685))
    lens=bpy.context.active_object
    lens.name=f"HeadLens_{side}"
    lens.scale=(0.26,0.17,0.085)
    lens.rotation_euler=(0,0,math.radians(-18*side))
    assign_mat(lens, MAT_GLASS)
    # DRL strip: thin box emissive
    bpy.ops.mesh.primitive_cube_add(size=1, location=(2.30, side*0.60, 0.66))
    drl=bpy.context.active_object
    drl.name=f"DRL_{side}"
    drl.scale=(0.06,0.28,0.015)
    drl.rotation_euler=(0,0,math.radians(-12*side))
    assign_mat(drl, MAT_DRL)
    # 4 LED projectors
    for i in range(4):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=0.025, location=(2.22, side*(0.52+i*0.06), 0.70))
        led=bpy.context.active_object
        led.name=f"LED_{side}_{i}"
        assign_mat(led, MAT_LED)
    bpy.ops.object.select_all(action='DESELECT')

# Taillight full-width bar
bpy.ops.mesh.primitive_cube_add(size=1, location=(-2.48, 0, 0.82))
tail=bpy.context.active_object
tail.name="TaillightBar"
tail.scale=(0.06, 0.85, 0.09)
assign_mat(tail, MAT_TAIL_RED)
bev=tail.modifiers.new("Bevel",type='BEVEL')
bev.width=0.02; bev.segments=3
# tail housing dark surround
bpy.ops.mesh.primitive_cube_add(size=1, location=(-2.47, 0, 0.82))
th=bpy.context.active_object
th.name="TailHousing"
th.scale=(0.04,0.88,0.12)
assign_mat(th, MAT_TAIL_DARK)
bpy.ops.object.select_all(action='DESELECT')

# XIAOMI letters on trunk (use text)
bpy.ops.object.text_add(location=(-2.52, 0, 0.95), rotation=(0,0,math.radians(90)))
txt=bpy.context.active_object
txt.name="XiaomiLetters"
txt.data.body = "X I A O M I"
txt.scale=(0.06,0.06,0.06)
# center: offset?
txt.location=(-2.53, -0.35, 0.96)
assign_mat(txt, MAT_CHROME)
bpy.ops.object.select_all(action='DESELECT')

# ============ BUMPERS / TRIM ============
# Front lower intake
bpy.ops.mesh.primitive_cube_add(size=1, location=(2.42, 0, 0.28))
fi=bpy.context.active_object
fi.name="FrontIntake"
fi.scale=(0.12,0.70,0.12)
assign_mat(fi, MAT_BLACK_TRIM)
# front grille slats
for i in range(3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(2.48, 0, 0.24+i*0.05))
    sl=bpy.context.active_object
    sl.name=f"GrilleSlat_{i}"
    sl.scale=(0.02,0.60,0.015)
    assign_mat(sl, MAT_GRILLE)
# teal accents on intake sides (body color trim)
for side in [1,-1]:
    bpy.ops.mesh.primitive_cube_add(size=1, location=(2.43, side*0.62, 0.28))
    acc=bpy.context.active_object
    acc.name=f"FrontAccent_{side}"
    acc.scale=(0.10,0.18,0.03)
    assign_mat(acc, MAT_PAINT)
    # side air curtain vertical
    bpy.ops.mesh.primitive_cube_add(size=1, location=(2.30, side*0.88, 0.45))
    cur=bpy.context.active_object
    cur.name=f"AirCurtain_{side}"
    cur.scale=(0.08,0.05,0.22)
    cur.rotation_euler=(0,0,math.radians(10*side))
    assign_mat(cur, MAT_BLACK_TRIM)
bpy.ops.object.select_all(action='DESELECT')

# Side skirts black
for side in [1,-1]:
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.05, side*0.92, 0.14))
    sk=bpy.context.active_object
    sk.name=f"SideSkirt_{side}"
    sk.scale=(1.65,0.08,0.08)
    assign_mat(sk, MAT_BLACK_TRIM)
# Door handles flush
for side in [1,-1]:
    for dx in [0.25, -0.85]:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(dx, side*0.975, 0.88))
        hd=bpy.context.active_object
        hd.name=f"Handle_{side}_{dx}"
        hd.scale=(0.14,0.015,0.025)
        assign_mat(hd, MAT_PAINT)
# Side vent behind front wheel
for side in [1,-1]:
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.95, side*0.97, 0.75))
    vt=bpy.context.active_object
    vt.name=f"SideVent_{side}"
    vt.scale=(0.18,0.02,0.05)
    assign_mat(vt, MAT_BLACK_GLOSS)
bpy.ops.object.select_all(action='DESELECT')

# Mirrors
for side in [1,-1]:
    bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=0.12, location=(0.85, side*0.98, 1.0), rotation=(0,math.radians(90),0))
    stem=bpy.context.active_object
    stem.name=f"MirrorStem_{side}"
    assign_mat(stem, MAT_BLACK_GLOSS)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=14, radius=1, location=(0.85, side*1.06, 1.05))
    hous=bpy.context.active_object
    hous.name=f"Mirror_{side}"
    hous.scale=(0.10,0.08,0.06)
    assign_mat(hous, MAT_PAINT)
bpy.ops.object.select_all(action='DESELECT')

# Rear diffuser
bpy.ops.mesh.primitive_cube_add(size=1, location=(-2.42, 0, 0.22))
rd=bpy.context.active_object
rd.name="RearDiffuser"
rd.scale=(0.18,0.85,0.15)
assign_mat(rd, MAT_BLACK_TRIM)
# body-color inserts rear
for side in [1,-1]:
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-2.50, side*0.60, 0.25))
    ins=bpy.context.active_object
    ins.name=f"RearInsert_{side}"
    ins.scale=(0.06,0.25,0.18)
    assign_mat(ins, MAT_PAINT)
    # red reflector
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-2.53, side*0.60, 0.20))
    ref=bpy.context.active_object
    ref.name=f"Reflector_{side}"
    ref.scale=(0.02,0.20,0.03)
    assign_mat(ref, MAT_TAIL_RED)
# rear side vents
for side in [1,-1]:
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-2.40, side*0.90, 0.55))
    rv=bpy.context.active_object
    rv.name=f"RearVent_{side}"
    rv.scale=(0.08,0.05,0.20)
    assign_mat(rv, MAT_BLACK_TRIM)
bpy.ops.object.select_all(action='DESELECT')

# Ducktail spoiler lip
bpy.ops.mesh.primitive_cube_add(size=1, location=(-2.20, 0, 0.94))
sp=bpy.context.active_object
sp.name="SpoilerLip"
sp.scale=(0.18,0.85,0.03)
sp.rotation_euler=(0,math.radians(-8),0)
assign_mat(sp, MAT_PAINT)
bpy.ops.object.select_all(action='DESELECT')

# License plates + text
bpy.ops.mesh.primitive_plane_add(size=1, location=(2.52, 0, 0.48), rotation=(0,math.radians(90-12),0))
pl=bpy.context.active_object
pl.name="FrontPlate"
pl.scale=(0.35,0.11,1)
assign_mat(pl, MAT_PLATE)
bpy.ops.object.text_add(location=(2.53, -0.13, 0.45), rotation=(0,math.radians(90),math.radians(90)))
t1=bpy.context.active_object
t1.data.body="xiaomi SU7"
t1.scale=(0.035,0.035,0.035)
t1.rotation_euler=(math.radians(90),0,math.radians(90))
assign_mat(t1, MAT_BLACK_TRIM)

bpy.ops.mesh.primitive_plane_add(size=1, location=(-2.53, 0, 0.42), rotation=(0,math.radians(-90),0))
pl2=bpy.context.active_object
pl2.name="RearPlate"
pl2.scale=(0.35,0.11,1)
assign_mat(pl2, MAT_PLATE)
bpy.ops.object.text_add(location=(-2.54, 0.10, 0.39), rotation=(0,math.radians(90),math.radians(-90)))
t2=bpy.context.active_object
t2.data.body="SU7"
t2.scale=(0.05,0.05,0.05)
assign_mat(t2, MAT_BLACK_TRIM)
bpy.ops.object.select_all(action='DESELECT')

# Front logo small
bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=0.01, location=(1.95, 0, 0.86), rotation=(math.radians(70),0,0))
logo=bpy.context.active_object
logo.name="FrontLogo"
assign_mat(logo, MAT_CHROME)
bpy.ops.object.select_all(action='DESELECT')

# ============ GROUND + LIGHTING ============
bpy.ops.mesh.primitive_plane_add(size=30, location=(0,0,0))
gnd=bpy.context.active_object
gnd.name="Ground"
mat_gnd = mat_simple("GroundMat",(0.55,0.57,0.60),rough=0.6)
assign_mat(gnd, mat_gnd)

# Area lights: key, fill, rim, top
def area_light(name, loc, energy, size, color=(1,1,1,1)):
    bpy.ops.object.light_add(type='AREA', location=loc)
    li=bpy.context.active_object
    li.name=name
    li.data.energy=energy
    li.data.size=size
    li.data.color=color[:3]
    return li

area_light("Key", (4,4,5), 8000, 4)
area_light("Fill", (-3,5,4), 3000, 3)
area_light("Rim", (-5,-4,4), 5000, 3)
area_light("Top", (0,0,6), 2000, 5)
# sun for reflections
bpy.ops.object.light_add(type='SUN', location=(2,2,5))
sun=bpy.context.active_object
sun.data.energy=2.0
bpy.ops.object.select_all(action='DESELECT')

# ============ CAMERAS ============
def make_cam(name, loc, rot_euler_deg):
    bpy.ops.object.camera_add(location=loc, rotation=[math.radians(a) for a in rot_euler_deg])
    c=bpy.context.active_object
    c.name=name
    c.data.lens=50
    return c

# Match refs: 3/4 front, front, side, rear, 3/4 front2
cam1 = make_cam("Cam_34Front", (5.2, 3.2, 1.6), (78, 0, 125))  # approx look at origin
cam2 = make_cam("Cam_Front", (6.0, 0, 1.1), (82, 0, 90))
cam3 = make_cam("Cam_Side", (0, 6.2, 1.0), (86, 0, 180))
cam4 = make_cam("Cam_Rear", (-5.8, 0, 1.2), (82, 0, -90))
cam5 = make_cam("Cam_34Front2", (5.0, -3.4, 1.5), (78, 0, -125+180))

# Track to empty at car center
bpy.ops.object.empty_add(location=(0,0,0.7))
tgt=bpy.context.active_object
tgt.name="CamTarget"
for c in [cam1,cam2,cam3,cam4,cam5]:
    con=c.constraints.new(type='TRACK_TO')
    con.target=tgt
    con.track_axis='TRACK_NEGATIVE_Z'
    con.up_axis='UP_Y'

scene.camera = cam1

bpy.ops.wm.save_as_mainfile(filepath=r"C:\MyProjects\TempProject (OpenCode)\su7_v1.blend")
print("BUILD COMPLETE")
