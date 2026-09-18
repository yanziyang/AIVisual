from pathlib import Path
p=Path(r'C:\MyProjects\TempProject (OpenAI)\build_j36.py')
s=p.read_text(encoding='utf-8-sig')
s=s.replace(' def ring(xc,yy,lo,hi,lw,uw):\n',''' def ring(xc,yy,lo,hi,lw,uw):
  if dorsal:
   out=[]
   for j in range(8):
    u=j/8;out.append((xc-lw+2*lw*u,yy,lo))
   for j in range(24):
    a=math.pi*j/23;out.append((xc+lw*math.cos(a),yy,lo+(hi-lo)*math.sin(a)**.78))
   return out
''')
s=s.replace("[(2,.96,.45,.8),(4.6,.98,.43,.84),(7.7,.84,.34,.66),(8.65,.72,.3,.58)]","[(2,1.13,.40,.48),(4.6,1.10,.40,.54),(7.7,.86,.32,.57),(8.65,.72,.3,.58)]")
s=s.replace("mesh('Wing insignia',p,[(0,j+1,(j+1)%10+1) for j in range(10)],red)","# New reference uses camouflage rather than the earlier red wing insignia.")
insert='''
# Packed, planar-mapped angular camouflage, shared by Blender and the GLB export.
import numpy as np
size=1024
xx,yy=np.meshgrid(np.linspace(-14,14,size),np.linspace(-12,12,size))
pixels=np.ones((size,size,4),dtype=np.float32);pixels[:,:,:3]=(.27,.36,.43)
def patch(poly,color):
 mask=np.zeros((size,size),dtype=bool)
 for i,(ax,ay) in enumerate(poly):
  bx,by=poly[(i+1)%len(poly)]
  mask^=((ay>yy)!=(by>yy)) & (xx < (bx-ax)*(yy-ay)/(by-ay+1e-12)+ax)
 pixels[mask,:3]=color
polys=[([(-13,5.5),(-8,2),(-6,2.7),(-4,-1),(-2,-2),(-2,1),(-5,4),(-8,3.8),(-9,6.8)],(.52,.64,.70)),
 ([(2,-7),(4,-4),(6,0),(4,2),(2,.5),(1,-3)],(.52,.64,.70)),
 ([(-11,6.5),(-6,5),(-3,6),(0,4),(3,5),(5,4),(9,6),(8,8),(-9,8)],(.16,.24,.31)),
 ([(-4,-4),(-2,-5),(-1,-2),(1,-1),(0,2),(-3,1),(-5,2)],(.18,.27,.34)),
 ([(6,1),(8,2),(11,5),(8,5),(7,4),(4,3)],(.56,.66,.72)),
 ([(-3,3),(-1,2),(2,3),(4,2),(3,4),(0,5),(-4,5)],(.48,.60,.67)),
 ([(-2,-9),(-.4,-8),(0,-6),(-1,-4),(-3,-5)],(.38,.48,.55)),
 ([(1,6),(3,5),(5,6),(7,7),(6,8),(2,8)],(.48,.60,.67))]
for polygon,color in polys:patch(polygon,color)
tex=bpy.data.images.new('Reference blue-gray angular camouflage',width=size,height=size)
tex.pixels.foreach_set(pixels.ravel());tex.pack()
node=skin.node_tree.nodes.new('ShaderNodeTexImage');node.image=tex
bsdf=skin.node_tree.nodes.get('Principled BSDF');skin.node_tree.links.new(node.outputs['Color'],bsdf.inputs['Base Color'])
bsdf.inputs['Metallic'].default_value=.20;bsdf.inputs['Roughness'].default_value=.48
for ob in parts:
 if ob.type=='MESH' and any(m==skin for m in ob.data.materials):
  uv=ob.data.uv_layers.new(name='Camouflage projection')
  for face in ob.data.polygons:
   for li in face.loop_indices:
    co=ob.matrix_world @ ob.data.vertices[ob.data.loops[li].vertex_index].co
    uv.data[li].uv=((co.x+14)/28,(co.y+12)/24)
'''
s=s.replace("root=bpy.data.objects.new('J36 reference-inspired concept',None)",insert+"\nroot=bpy.data.objects.new('J36 reference-inspired concept',None)")
p.write_text(s,encoding='utf-8')
