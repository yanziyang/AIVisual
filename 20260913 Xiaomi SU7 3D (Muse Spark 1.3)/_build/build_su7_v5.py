import bpy, math
# ===== CLEAN =====
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for coll in [bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.lights, bpy.data.cameras]:
    for x in list(coll):
        try: coll.remove(x)
        except: pass

scene = bpy.context.scene
scene.unit_settings.system='METRIC'
scene.render.engine='CYCLES'
scene.cycles.samples=64
scene.cycles.use_denoising=True
scene.cycles.denoiser='OPENIMAGEDENOISE'
scene.render.resolution_x=1280
scene.render.resolution_y=720
scene.render.resolution_percentage=100
scene.world.use_nodes=True
wn=scene.world.node_tree.nodes
wn.clear()
out=wn.new(type='ShaderNodeOutputWorld')
bg=wn.new(type='ShaderNodeBackground')
bg.inputs['Color'].default_value=(0.16,0.17,0.20,1.0)
bg.inputs['Strength'].default_value=0.9
scene.world.node_tree.links.new(bg.outputs['Background'], out.inputs['Surface'])

def make_mat(name, base, metallic=0, rough=0.5, emit=None, emit_s=0):
    m=bpy.data.materials.new(name)
    m.use_nodes=True
    nn=m.node_tree.nodes; nn.clear()
    o=nn.new('ShaderNodeOutputMaterial')
    b=nn.new('ShaderNodeBsdfPrincipled')
    b.inputs['Base Color'].default_value=(*base,1)
    b.inputs['Metallic'].default_value=metallic
    b.inputs['Roughness'].default_value=rough
    if emit:
        try:
            b.inputs['Emission'].default_value=(*emit,1)
            b.inputs['Emission Strength'].default_value=emit_s
        except: pass
    m.node_tree.links.new(b.outputs['BSDF'], o.inputs['Surface'])
    return m

def paint_mat():
    m=bpy.data.materials.new("AquaBlue")
    m.use_nodes=True
    nn=m.node_tree.nodes; nn.clear()
    o=nn.new('ShaderNodeOutputMaterial')
    b=nn.new('ShaderNodeBsdfPrincipled')
    # Xiaomi Aqua Blue Gulf - deeper teal
    b.inputs['Base Color'].default_value=(0.002, 0.22, 0.28, 1)
    b.inputs['Metallic'].default_value=0.35
    b.inputs['Specular'].default_value=0.6
    b.inputs['Roughness'].default_value=0.30
    try:
        b.inputs['Clearcoat'].default_value=1.0
        b.inputs['Clearcoat Roughness'].default_value=0.05
    except: pass
    m.node_tree.links.new(b.outputs['BSDF'], o.inputs['Surface'])
    return m

MAT_PAINT=paint_mat()
MAT_GLASS=make_mat("Glass",(0.01,0.015,0.02), metallic=0.0, rough=0.06)
# dark tint glossy
MAT_GLASS.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=0.2
MAT_TRIM=make_mat("Trim",(0.015,0.015,0.017), rough=0.6)
MAT_GLOSSB=make_mat("GlossB",(0.008,0.008,0.01), rough=0.22)
MAT_CHROME=make_mat("Chrome",(0.95,0.95,0.96), metallic=1.0, rough=0.08)
MAT_TIRE=make_mat("Tire",(0.008,0.008,0.009), rough=0.92)
MAT_RIM=make_mat("Rim",(0.82,0.83,0.85), metallic=1.0, rough=0.28)
MAT_RIMD=make_mat("RimD",(0.06,0.06,0.07), metallic=0.85, rough=0.4)
MAT_DISC=make_mat("Disc",(0.55,0.55,0.57), metallic=1.0, rough=0.3)
MAT_CAL=make_mat("Cal",(0.98,0.62,0.02), rough=0.45)
MAT_HEADH=make_mat("HeadH",(0.015,0.02,0.025), metallic=0.4, rough=0.25)
MAT_DRL=make_mat("DRL",(1,1,1), emit=(1,1,1), emit_s=15)
MAT_LED=make_mat("LED",(1,1,1), emit=(0.92,0.96,1.0), emit_s=10)
MAT_TAIL=make_mat("Tail",(0.45,0.01,0.02), emit=(1,0.05,0.08), emit_s=8)
MAT_PLATE=make_mat("Plate",(0.93,0.93,0.93), rough=0.5)
MAT_GROUND=make_mat("Ground",(0.42,0.43,0.45), rough=0.6)

def assign(o,m):
    if o.data.materials: o.data.materials[0]=m
    else: o.data.materials.append(m)

# ============ BODY: boxy loft with flat sides ============
# x, halfW, zBot, zTop - SU7: low sharp nose, flat sides
stations=[
 ( 2.498,0.84,0.20,0.58),
 ( 2.40,0.90,0.12,0.63),
 ( 2.20,0.945,0.10,0.69),
 ( 1.95,0.965,0.10,0.755),
 ( 1.60,0.98,0.10,0.815),
 ( 1.10,0.985,0.11,0.865),
 ( 0.60,0.985,0.11,0.90),
 ( 0.0, 0.98,0.11,0.92),
 (-0.60,0.98,0.11,0.925),
 (-1.20,0.97,0.11,0.92),
 (-1.70,0.96,0.12,0.905),
 (-2.10,0.945,0.14,0.88),
 (-2.38,0.91,0.17,0.845),
 (-2.50,0.84,0.23,0.79),
]
# cross-section template: 12 pts (y_frac, z_frac) 0..1
# order CCW starting bottom-center
profile=[
 (0.0, 0.0),
 (0.75, 0.0),
 (0.97, 0.12),
 (1.0, 0.35),
 (1.0, 0.60),
 (0.97, 0.85),
 (0.80, 1.0),
 (0.0, 1.02),  # slight crown
 (-0.80, 1.0),
 (-0.97, 0.85),
 (-1.0, 0.60),
 (-1.0, 0.35),
 (-0.97, 0.12),
 (-0.75, 0.0),
]
PN=len(profile)
verts=[]; faces=[]
for si,(x,hw,zb,zt) in enumerate(stations):
    base=len(verts)
    for (yf,zf) in profile:
        y=yf*hw
        z=zb+(zt-zb)*zf
        # hood crown flatten front, deck flatten rear
        verts.append((x,y,z))
    if si<len(stations)-1:
        nxt=base+PN
        for j in range(PN):
            a=base+j; b=base+(j+1)%PN; c=nxt+(j+1)%PN; d=nxt+j
            faces.append((a,b,c,d))
# caps
fc=len(verts); verts.append((stations[0][0],0,(stations[0][2]+stations[0][3])/2))
rc=len(verts); verts.append((stations[-1][0],0,(stations[-1][2]+stations[-1][3])/2))
for j in range(PN):
    faces.append((fc, (j+1)%PN, j))
off=(len(stations)-1)*PN
for j in range(PN):
    faces.append((rc, off+j, off+(j+1)%PN))

me=bpy.data.meshes.new("BodyM")
me.from_pydata(verts,[],faces); me.update()
body=bpy.data.objects.new("Body",me)
bpy.context.collection.objects.link(body)
assign(body,MAT_PAINT)
bpy.context.view_layer.objects.active=body
body.select_set(True)
bpy.ops.object.shade_smooth()
bpy.ops.object.select_all(action='DESELECT')

# wheel arch boolean cutters (FAST for speed)
cuts=[]
for (wx,wy) in [(1.5,0.83),(1.5,-0.83),(-1.5,0.83),(-1.5,-0.83)]:
    bpy.ops.mesh.primitive_cylinder_add(radius=0.395, depth=0.4, location=(wx,wy,0.36), rotation=(0,math.radians(90),0), vertices=32)
    c=bpy.context.active_object; c.name=f"Cut{wx}{wy}"; c.display_type='WIRE'
    cuts.append(c)
    bpy.ops.object.select_all(action='DESELECT')
bpy.context.view_layer.objects.active=body
body.select_set(True)
for c in cuts:
    md=body.modifiers.new(f"B{c.name}",type='BOOLEAN')
    md.operation='DIFFERENCE'; md.object=c; md.solver='FAST'
sub=body.modifiers.new("Subdiv",type='SUBSURF'); sub.levels=2; sub.render_levels=2
for c in cuts:
    c.hide_render=True; c.hide_viewport=True
bpy.ops.object.select_all(action='DESELECT')

# ============ CABIN ============
cstations=[
 ( 1.25,0.70,0.86,0.94),
 ( 0.75,0.785,0.86,1.20),
 ( 0.30,0.81,0.86,1.365),
 (-0.25,0.815,0.86,1.385),
 (-0.75,0.80,0.86,1.32),
 (-1.20,0.775,0.86,1.14),
 (-1.60,0.73,0.86,0.945),
]
cprof=[
 (0.0,0.0),(0.7,0.0),(0.95,0.15),(1.0,0.45),(0.96,0.75),(0.78,1.0),(0.0,1.03),
 (-0.78,1.0),(-0.96,0.75),(-1.0,0.45),(-0.95,0.15),(-0.7,0.0)
]
CP=len(cprof)
cv=[]; cf=[]
for si,(x,hw,zb,zt) in enumerate(cstations):
    b=len(cv)
    for (yf,zf) in cprof:
        cv.append((x, yf*hw, zb+(zt-zb)*zf))
    if si<len(cstations)-1:
        n=b+CP
        for j in range(CP):
            cf.append((b+j, b+(j+1)%CP, n+(j+1)%CP, n+j))
fc=len(cv); cv.append((cstations[0][0],0,0.93)); rc=len(cv); cv.append((cstations[-1][0],0,0.925))
for j in range(CP): cf.append((fc,(j+1)%CP,j))
off=(len(cstations)-1)*CP
for j in range(CP): cf.append((rc,off+j,off+(j+1)%CP))
cm=bpy.data.meshes.new("CabM"); cm.from_pydata(cv,[],cf); cm.update()
cab=bpy.data.objects.new("Cabin",cm)
bpy.context.collection.objects.link(cab)
assign(cab,MAT_GLASS)
cab.select_set(True); bpy.context.view_layer.objects.active=cab
bpy.ops.object.shade_smooth()
s2=cab.modifiers.new("S",type='SUBSURF'); s2.levels=2; s2.render_levels=2
bpy.ops.object.select_all(action='DESELECT')

# pillars/roof frame: thin body-color strips to suggest doors? Add black roof panel flush
bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.22,0,1.385))
roof=bpy.context.active_object; roof.scale=(0.92,0.60,0.012)
assign(roof,MAT_GLOSSB)
bpy.ops.object.select_all(action='DESELECT')
# windshield header LiDAR
bpy.ops.mesh.primitive_cube_add(size=1, location=(0.32,0,1.395))
ld=bpy.context.active_object; ld.scale=(0.15,0.09,0.035)
assign(ld,MAT_GLOSSB)
bv=ld.modifiers.new("B",type='BEVEL'); bv.width=0.015; bv.segments=2
bpy.ops.object.select_all(action='DESELECT')

# ============ WHEELS v2: visible spokes ============
def wheel(x,y,tag):
    z=0.352
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=0.35, depth=0.245, location=(x,y,z), rotation=(0,math.radians(90),0))
    tire=bpy.context.active_object; tire.name=tag+"_Tire"; assign(tire,MAT_TIRE)
    # rim assembly OUTSIDE tire cap to be visible (tire cap at y+-0.1225)
    out = y + (0.145 if y>0 else -0.145)
    out_rim = y + (0.125 if y>0 else -0.125)
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=0.25, depth=0.04, location=(x,out_rim,z), rotation=(0,math.radians(90),0))
    rim=bpy.context.active_object; rim.name=tag+"_RimBase"; assign(rim,MAT_RIMD)
    # brake disc + caliper (slightly inboard, visible through spokes)
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=0.18, depth=0.03, location=(x,out_rim-(0.03 if y>0 else -0.03),z), rotation=(0,math.radians(90),0))
    disc=bpy.context.active_object; disc.name=tag+"_Disc"; assign(disc,MAT_DISC)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x-0.10, out_rim, z+0.07))
    cal=bpy.context.active_object; cal.name=tag+"_Cal"; cal.scale=(0.10,0.055,0.14); cal.rotation_euler=(0,0,math.radians(15))
    assign(cal,MAT_CAL)
    # lip torus at outer face
    bpy.ops.mesh.primitive_torus_add(major_radius=0.245, minor_radius=0.014, major_segments=40, minor_segments=10, location=(x,out,z), rotation=(0,math.radians(90),0))
    lip=bpy.context.active_object; lip.name=tag+"_Lip"; assign(lip,MAT_RIM)
    # 5 split spokes - radiate in X-Z plane (axle Y), outside tire cap
    for k in range(5):
        base_ang=k*2*math.pi/5 + 0.35
        for off in [-0.17,0.17]:
            a=base_ang+off
            dx=math.cos(a); dz=math.sin(a)
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x, out, z))
            sp=bpy.context.active_object; sp.name=f"{tag}_S{k}_{off:.2f}"
            sp.scale=(0.055,0.028,0.225)
            # long axis Z -> rotate around Y to point radially in XZ
            sp.rotation_euler=(0,-a,0)
            sp.location[0] += dx*0.11
            sp.location[2] += dz*0.11
            assign(sp, MAT_RIM if off>0 else MAT_RIMD)
    # hub
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.032, depth=0.06, location=(x,out,z), rotation=(0,math.radians(90),0))
    hub=bpy.context.active_object; hub.name=tag+"_Hub"; assign(hub,MAT_RIM)
    bpy.ops.object.select_all(action='DESELECT')

for (wx,wy,t) in [(1.5,0.83,"FL"),(1.5,-0.83,"FR"),(-1.5,0.83,"RL"),(-1.5,-0.83,"RR")]:
    wheel(wx,wy,t)

# ============ FRONT/REAR DETAILS ============
for s in [1,-1]:
    # headlight housing embedded - low, forward, wrap-around like SU7 water-drop
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=1, location=(2.30, s*0.74, 0.625))
    h=bpy.context.active_object; h.name=f"HL{s}"
    h.scale=(0.18,0.20,0.06); h.rotation_euler=(0,math.radians(-3),math.radians(-28*s))
    assign(h,MAT_HEADH)
    # lens
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=1, location=(2.33, s*0.745, 0.63))
    le=bpy.context.active_object; le.name=f"HLlens{s}"
    le.scale=(0.16,0.19,0.052); le.rotation_euler=(0,math.radians(-3),math.radians(-28*s))
    assign(le,MAT_GLASS)
    # DRL blade
    bpy.ops.mesh.primitive_cube_add(size=1, location=(2.45, s*0.70, 0.615))
    d=bpy.context.active_object; d.name=f"DRL{s}"; d.scale=(0.035,0.28,0.014); d.rotation_euler=(0,0,math.radians(-18*s))
    assign(d,MAT_DRL)
    for i in range(4):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.018, location=(2.38, s*(0.63+i*0.055), 0.64))
        led=bpy.context.active_object; led.name=f"LED{s}{i}"; assign(led,MAT_LED)
    bpy.ops.object.select_all(action='DESELECT')

# lower intake - forward, SU7 wide mouth
bpy.ops.mesh.primitive_cube_add(size=1, location=(2.46,0,0.24))
fi=bpy.context.active_object; fi.scale=(0.10,0.72,0.12); assign(fi,MAT_TRIM)
for i in range(2):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(2.51,0,0.20+i*0.07))
    sl=bpy.context.active_object; sl.scale=(0.02,0.58,0.02); assign(sl,MAT_GLOSSB)
for s in [1,-1]:
    bpy.ops.mesh.primitive_cube_add(size=1, location=(2.46,s*0.64,0.24))
    a=bpy.context.active_object; a.scale=(0.08,0.16,0.035); assign(a,MAT_PAINT)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(2.30,s*0.92,0.42))
    c=bpy.context.active_object; c.scale=(0.09,0.035,0.19); c.rotation_euler=(0,0,math.radians(8*s)); assign(c,MAT_TRIM)
bpy.ops.object.select_all(action='DESELECT')

# skirts, handles, vents, mirrors - mirrors at beltline
for s in [1,-1]:
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.05,s*0.955,0.125))
    sk=bpy.context.active_object; sk.scale=(1.60,0.05,0.065); assign(sk,MAT_TRIM)
    for dx in [0.30,-0.78]:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(dx,s*0.988,0.865))
        hd=bpy.context.active_object; hd.scale=(0.13,0.012,0.020); assign(hd,MAT_GLOSSB)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.92,s*0.982,0.735))
    v=bpy.context.active_object; v.scale=(0.16,0.015,0.042); assign(v,MAT_GLOSSB)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.016, depth=0.12, location=(0.78,s*1.00,0.90), rotation=(0,math.radians(90),0))
    st=bpy.context.active_object; assign(st,MAT_GLOSSB)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=1, location=(0.78,s*1.07,0.925))
    mr=bpy.context.active_object; mr.scale=(0.09,0.065,0.05); assign(mr,MAT_PAINT)
bpy.ops.object.select_all(action='DESELECT')

# taillight
bpy.ops.mesh.primitive_cube_add(size=1, location=(-2.475,0,0.815))
tb=bpy.context.active_object; tb.scale=(0.05,0.82,0.075); assign(tb,MAT_TAIL)
bv=tb.modifiers.new("B",type='BEVEL'); bv.width=0.015; bv.segments=2
bpy.ops.mesh.primitive_cube_add(size=1, location=(-2.465,0,0.815))
hb=bpy.context.active_object; hb.scale=(0.03,0.86,0.11); assign(hb,MAT_GLOSSB)
# need taillight in front of housing: swap? Move tail slightly rear
tb.location=(-2.49,0,0.815)
bpy.ops.object.select_all(action='DESELECT')

bpy.ops.object.text_add(location=(-2.53,-0.32,0.94), rotation=(0,math.radians(90),math.radians(90)))
tx=bpy.context.active_object; tx.data.body="X I A O M I"; tx.scale=(0.055,0.055,0.055); assign(tx,MAT_CHROME)
bpy.ops.mesh.primitive_cube_add(size=1, location=(-2.40,0,0.22))
rd=bpy.context.active_object; rd.scale=(0.16,0.84,0.14); assign(rd,MAT_TRIM)
for s in [1,-1]:
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-2.48,s*0.58,0.26))
    ins=bpy.context.active_object; ins.scale=(0.05,0.24,0.16); assign(ins,MAT_PAINT)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-2.51,s*0.58,0.19))
    rf=bpy.context.active_object; rf.scale=(0.015,0.18,0.025); assign(rf,MAT_TAIL)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-2.38,s*0.90,0.54))
    rv=bpy.context.active_object; rv.scale=(0.07,0.04,0.18); assign(rv,MAT_TRIM)
bpy.ops.mesh.primitive_cube_add(size=1, location=(-2.18,0,0.935))
sp=bpy.context.active_object; sp.scale=(0.16,0.82,0.025); sp.rotation_euler=(0,math.radians(-7),0); assign(sp,MAT_PAINT)
bpy.ops.object.select_all(action='DESELECT')

# plates
bpy.ops.mesh.primitive_plane_add(size=1, location=(2.505,0,0.46), rotation=(0,math.radians(78),0))
pl=bpy.context.active_object; pl.scale=(0.34,0.105,1); assign(pl,MAT_PLATE)
bpy.ops.mesh.primitive_plane_add(size=1, location=(-2.525,0,0.40), rotation=(0,math.radians(-78),0))
pl2=bpy.context.active_object; pl2.scale=(0.34,0.105,1); assign(pl2,MAT_PLATE)
bpy.ops.object.text_add(location=(2.52,-0.12,0.435), rotation=(math.radians(90),0,math.radians(90)))
t1=bpy.context.active_object; t1.data.body="xiaomi SU7"; t1.scale=(0.032,0.032,0.032); assign(t1,MAT_TRIM)
bpy.ops.object.text_add(location=(-2.54,0.08,0.375), rotation=(math.radians(90),0,math.radians(-90)))
t2=bpy.context.active_object; t2.data.body="SU7"; t2.scale=(0.045,0.045,0.045); assign(t2,MAT_TRIM)
bpy.ops.mesh.primitive_cylinder_add(radius=0.028, depth=0.012, location=(1.92,0,0.855), rotation=(math.radians(68),0,0))
lg=bpy.context.active_object; assign(lg,MAT_CHROME)
bpy.ops.object.select_all(action='DESELECT')

# ground + lights (softer)
bpy.ops.mesh.primitive_plane_add(size=30, location=(0,0,-0.005))
g=bpy.context.active_object; assign(g,MAT_GROUND)
def al(n,loc,e,sz):
    bpy.ops.object.light_add(type='AREA', location=loc)
    o=bpy.context.active_object; o.name=n; o.data.energy=e; o.data.size=sz; return o
al("Key",(4,3.5,4.5),1200,5)
al("Fill",(-3,4,3.5),400,4)
al("Rim",(-4.5,-3.5,3.5),800,4)
al("Top",(0,0,5.5),400,6)
bpy.ops.object.light_add(type='SUN', location=(3,2,5))
su=bpy.context.active_object; su.data.energy=0.8
bpy.ops.object.select_all(action='DESELECT')

def cam(n,loc):
    bpy.ops.object.camera_add(location=loc)
    c=bpy.context.active_object; c.name=n; c.data.lens=40; return c
c1=cam("Cam_34Front",(5.6,3.4,1.5))
c2=cam("Cam_Front",(6.2,0,1.05))
c3=cam("Cam_Side",(0.1,6.4,0.95))
c4=cam("Cam_Rear",(-5.9,0.3,1.25))
c5=cam("Cam_34Front2",(5.4,-3.4,1.45))
bpy.ops.object.empty_add(location=(0,0,0.65))
tg=bpy.context.active_object; tg.name="Tgt"
for c in [c1,c2,c3,c4,c5]:
    co=c.constraints.new(type='TRACK_TO'); co.target=tg; co.track_axis='TRACK_NEGATIVE_Z'; co.up_axis='UP_Y'
scene.camera=c1
bpy.ops.wm.save_as_mainfile(filepath=r"C:\MyProjects\TempProject (OpenCode)\su7_v5.blend")
print("V5 DONE")
