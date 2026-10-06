import re
p = 'src/ui.js'
s = open(p, encoding='utf8').read()
a = s.index("  // ------------------------------------------------------------------ chart")
b = s.index("  // ------------------------------------------------------------------ camera framing")
new = """  // ------------------------------------------------------------------ chart
  const chart = createChart({
    host: $('chart'),
    getLoad: () => engine.state.load,
    onHover: (b) => { chart.highlight(b.mods); engine.setFocus(b.mods); state.hover = b; },
    onLeave: () => { state.hover = null; applyFocus(); },
    onPick: (b) => { const map = { fan: 1, lpc: 3, hpc: 3, comb: 4, hpt: 5, lpt: 5, noz: 6 }; stopPlay(); goStep(map[b.id]); },
  });

"""
s = s[:a] + new + s[b:]
s = s.replace("import { gas, BYPASS_RATIO } from './flow.js';", "import { BYPASS_RATIO } from './flow.js';\nimport { createChart } from './chart.js';")
s = s.replace("    stage.setFree(state.free, state.W, state.H);\n", "    stage.setFree(state.free, state.W, state.H);\n    chart.fitWidth();\n", 1)
s = s.replace("  chart.update(true);\n  setTimeout", "  chart.fitWidth(); chart.update(true);\n  setTimeout")
open(p, 'w', encoding='utf8').write(s)

p = 'template.html'
t = open(p, encoding='utf8').read()
t = t.replace(".chart text { font-family: var(--font); fill: var(--muted); font-size: 9.5px; }", ".chart text { font-family: var(--font); fill: var(--muted); font-size: 10.5px; }")
t = t.replace(".chart .ttl { fill: var(--ink2); font-size: 10px; font-weight: 600; }", ".chart .ttl { fill: var(--ink2); font-size: 11px; font-weight: 600; }")
t = t.replace(".chart .val { fill: var(--ink); font-size: 10px;", ".chart .val { fill: var(--ink); font-size: 11px;")
t = t.replace(".chart .readout { fill: var(--ink); font-size: 10.5px;", ".chart .readout { fill: var(--ink); font-size: 11px;")
t = t.replace(".chart .bname { font-size: 9px;", ".chart .bname { font-size: 10px;")
t = t.replace(".chart svg { display: block; width: 100%; height: auto; overflow: visible; touch-action: none; }", ".chart svg { display: block; overflow: visible; touch-action: none; }")
open(p, 'w', encoding='utf8').write(t)
print('ok')
