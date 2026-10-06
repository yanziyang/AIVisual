p = 'src/materials.js'
s = open(p, encoding='utf8').read()
s = s.replace("""#ifdef GHOSTABLE
  if (uGhost < 0.995 && bayer4_(gl_FragCoord.xy) >= uGhost) discard;
#endif
""", "")
s = s.replace("""      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_COLOR);
  };
  mat.customProgramCacheKey""", """      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_COLOR)
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + FRAG_DIM);
  };
  mat.customProgramCacheKey""")
s = s.replace("const FRAG_COLOR = `", """// focus mode: modules outside the focus fall back to a dark, slightly blue silhouette
const FRAG_DIM = `
  { float gk_ = clamp(uGhost, 0.0, 1.0);
    vec3 dim_ = gl_FragColor.rgb * 0.17 + vec3(0.004, 0.007, 0.011);
    gl_FragColor.rgb = mix(dim_, gl_FragColor.rgb, gk_); }
`;
const FRAG_COLOR = `""")
open(p, 'w', encoding='utf8').write(s)

p = 'src/engine.js'
s = open(p, encoding='utf8').read()
s = s.replace("m.setGhost(!ids.length || ids.includes(m.id) ? 1 : 0.08)", "m.setGhost(!ids.length || ids.includes(m.id) ? 1 : 0)")
s = s.replace("fu.uAlpha.value = cm.ghost.value;", "fu.uAlpha.value = 0.3 + 0.7 * cm.ghost.value;")
open(p, 'w', encoding='utf8').write(s)
print('ok')
