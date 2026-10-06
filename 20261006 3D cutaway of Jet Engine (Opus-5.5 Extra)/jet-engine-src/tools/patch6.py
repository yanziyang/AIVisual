def sub(path, a, b, count=1):
    s = open(path, encoding='utf8').read()
    if a not in s: raise SystemExit('missing in %s: %s' % (path, a[:60]))
    open(path, 'w', encoding='utf8').write(s.replace(a, b, count))
sub('template.html', ".card h2 { margin: 0 0 9px;", "@media (min-width: 981px) { #dock .card { min-height: 252px; } }\n.card h2 { margin: 0 0 9px;")
sub('src/engine.js', "r.ring.material.opacity = 0.42 * b;", "r.ring.material.opacity = 0.34 * b;")
sub('src/ui.js', "    applyFocus();\n    chart.setStation(STEPS[i].station);", "    applyFocus();\n    measure();\n    chart.setStation(STEPS[i].station);")
print('ok')
