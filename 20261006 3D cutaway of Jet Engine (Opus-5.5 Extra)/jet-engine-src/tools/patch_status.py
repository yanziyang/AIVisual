"""Add the renderer-status badge (GPU / CPU) to the page template.

The badge script is copied byte-for-byte from the reference page so the logic and wording stay identical:
  C:/MyProjects/AIVisual/20261002 car-factory-2 (Sonnet-5.5 Extra).html  (<script id="ai-visual-webgl-render-mode">)
"""
import re

REF = 'C:/MyProjects/AIVisual/20261002 car-factory-2 (Sonnet-5.5 Extra).html'
ref = open(REF, encoding='utf8').read()
k = ref.find('id="ai-visual-webgl-render-mode"')
a = ref.rfind('<script', 0, k)
b = ref.find('</script>', k) + len('</script>')
snippet = ref[a:b]
assert 'ai-visual-render-mode' in snippet and '__aiVisualModeWrapped' in snippet

p = 'template.html'
t = open(p, encoding='utf8').read()
if 'ai-visual-webgl-render-mode' in t:
    raise SystemExit('already patched')

def sub(text, old, new):
    if old not in text:
        raise SystemExit('missing: ' + old[:70])
    return text.replace(old, new, 1)

# 1) layout: a 40px strip at the very bottom for the status pill (the pill itself keeps the reference's
#    fixed bottom-right placement); the dock sits above it
t = sub(t, "  --gap: 12px;\n", "  --gap: 12px;\n  --statusH: 40px;\n")
t = sub(t, "#dock { position: absolute; left: 0; right: 0; bottom: 0; display: grid;", "#dock { position: absolute; left: 0; right: 0; bottom: var(--statusH); display: grid;")
t = sub(t, "padding: 0 var(--gap) calc(var(--gap) + env(safe-area-inset-bottom)); align-items: stretch;", "padding: 0 var(--gap); align-items: stretch;")
t = sub(t, "  #dock .card { display: none; border-radius: 18px 18px 0 0; border-bottom: 0; padding-bottom: calc(14px + env(safe-area-inset-bottom)); }", "  #dock .card { display: none; }")
t = sub(t, "  #dockwrap { position: absolute; left: 0; right: 0; bottom: 0; pointer-events: none; }", "  #dockwrap { position: absolute; left: 0; right: 0; bottom: var(--statusH); pointer-events: none; }")
t = sub(t, "  #dock { display: block; position: static; padding: 0; }", "  #dock { display: block; position: static; padding: 0 var(--gap); }")

# 2) the pill: one line, with a coloured dot for the mode (GPU / CPU / unknown / unavailable)
css = """/* ------------------------------------------------ renderer status pill (script in <head>) */
#ai-visual-render-mode { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; --m: #8393a6; border: 1px solid rgba(255, 255, 255, .09); }
#ai-visual-render-mode::before { content: ""; display: inline-block; margin-right: 7px; vertical-align: 0; width: 7px; height: 7px; border-radius: 50%; background: var(--m); box-shadow: 0 0 0 3px color-mix(in srgb, var(--m) 22%, transparent); }
#ai-visual-render-mode[data-mode="gpu"] { --m: #4ade80; }
#ai-visual-render-mode[data-mode="cpu"] { --m: #fbbf24; }
#ai-visual-render-mode[data-mode="unavailable"] { --m: #f87171; }
#ai-visual-render-mode[data-mode="pending"] { --m: #8393a6; }
"""
t = sub(t, "</style>\n</head>", css + "</style>\n" + snippet + "\n</head>")
open(p, 'w', encoding='utf8').write(t)

# 3) copy in the About drawer
c = 'src/content.js'
s = open(c, encoding='utf8').read()
old = "    ['Rendering', "
new = "    ['Graphics status', 'The pill at the bottom right reports where the 3D is being drawn, read from the renderer name the browser exposes: GPU active (a hardware adapter was reported), CPU only (a software renderer such as SwiftShader or llvmpipe), or renderer unknown (the browser did not say). Software rendering works but will be slow; the page lowers its resolution automatically to keep moving.'],\n    ['Rendering', "
assert old in s
s = s.replace(old, new, 1)
open(c, 'w', encoding='utf8').write(s)
print('patched; snippet bytes', len(snippet))
