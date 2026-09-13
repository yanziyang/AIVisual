from pathlib import Path
p=Path(__file__).with_name('build_su7.py');s=p.read_text()
s=s.replace("VERSION = '03'","VERSION = '04'")
s=s.replace("(.004,.32,.40),.58,.26,.42", "(.005,.42,.53),.70,.27,.25")
key="glass.node_tree.nodes.get('Principled BSDF').inputs['Specular'].default_value=.23"
s=s.replace(key,"""# Absorptive dark automotive tint; restrained, blue-tinted reflections.
gn=glass.node_tree.nodes;gl=glass.node_tree.links
gn.clear()
go=gn.new('ShaderNodeOutputMaterial');gd=gn.new('ShaderNodeBsdfDiffuse');gg=gn.new('ShaderNodeBsdfGlossy');gf=gn.new('ShaderNodeFresnel');gm=gn.new('ShaderNodeMixShader')
gd.inputs['Color'].default_value=(.008,.018,.031,1);gd.inputs['Roughness'].default_value=.25
gg.inputs['Color'].default_value=(.13,.20,.28,1);gg.inputs['Roughness'].default_value=.13;gf.inputs['IOR'].default_value=1.46
gl.new(gf.outputs[0],gm.inputs[0]);gl.new(gd.outputs[0],gm.inputs[1]);gl.new(gg.outputs[0],gm.inputs[2]);gl.new(gm.outputs[0],go.inputs['Surface'])""")
s=s.replace("glazing=(s<.76 and -.974<x<1.83)", "glass_limit=lerp(.955,.76,smooth((x+.974)/.744)) if x<-.23 else (lerp(.76,.935,smooth((x-.86)/.97)) if x>.86 else .76)\n        glazing=(s<glass_limit and -.974<x<1.83)")
s=s.replace("out.extend([tuple(a*.75+b*.25),tuple(a*.25+b*.75)])\n        poly=out", "out.extend([tuple(a*.90+b*.10),tuple(a*.10+b*.90)])\n        poly=out")
s=s.replace("uv('Rectangular LED projector surround',q,(.010,.022,.019),silver)", "cube('Rectangular LED projector surround',q,(.013,.039,.032),silver,.008)")
s=s.replace("uv('Deep projector optic',q+Vector((-.006,0,0)),(.008,.015,.013),lampglass)", "cube('Deep projector optic',q+Vector((-.008,0,0)),(.008,.027,.022),lampglass,.006)")
s=s.replace("badgepos=topsurf(-2.256,0,.009)", "badgepos=topsurf(-2.256,0,.020)")
s=s.replace("(.043,.030,.004),silver", "(.032,.024,.004),silver")
s=s.replace("(-6.9,-8.0,2.55),(0,0,.73),57", "(-6.9,-8.0,2.55),(0,0,.73),68")
s=s.replace("(7.7,-6.2,2.45),(.1,0,.74),57", "(7.7,-6.2,2.45),(.1,0,.74),66")
s=s.replace("ortho=5.9", "ortho=5.6")
s=s.replace("(-9,0,1.0),(0,0,1.0),ortho=3.2", "(-9,0,.83),(0,0,.83),ortho=2.7")
s=s.replace("(9,0,1.0),(0,0,1.0),ortho=3.2", "(9,0,.83),(0,0,.83),ortho=2.7")
s=s.replace("scene.render.resolution_y=700 if DRAFT else 1200", "scene.render.resolution_y=560 if DRAFT else 960")
s=s.replace("views=['front_hero','front','rear_hero','side'] if DRAFT", "views=['front_hero','rear_hero','side'] if DRAFT")
p.write_text(s)
print('Applied revision 04: absorptive glazing, aperture corners, paint and framing.')
