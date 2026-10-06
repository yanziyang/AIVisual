def sub(path, a, b, count=1):
    s = open(path, encoding='utf8').read()
    if a not in s: raise SystemExit('missing in %s: %s' % (path, a[:60]))
    open(path, 'w', encoding='utf8').write(s.replace(a, b, count))
sub('src/ui.js', "    $('hint').style.top = (state.free.y + state.free.h - 4) + 'px';\n", "    $('hint').style.top = (top.bottom + 4) + 'px';\n")
sub('template.html', "#hint { position: absolute; left: 50%; transform: translateX(-50%);", "#hint { position: absolute; left: 16px;")
sub('template.html', "pointer-events: none; text-align: center; white-space: nowrap; transition: opacity .6s; }", "pointer-events: none; white-space: nowrap; transition: opacity .6s; }")
print('ok')
