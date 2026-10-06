p = 'src/materials.js'
s = open(p, encoding='utf8').read()
s = s.replace("""      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_COLOR);""", """      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_COLOR)
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + FRAG_DIM);""", 1)
s = s.replace('per-module "ghost" dithering (used to dim everything but the focused module)', 'per-module "ghost" dimming (used to spotlight the focused module)')
open(p, 'w', encoding='utf8').write(s)
