def sub(path, a, b, count=1):
    s = open(path, encoding='utf8').read()
    if a not in s: raise SystemExit('missing in %s: %s' % (path, a[:60]))
    open(path, 'w', encoding='utf8').write(s.replace(a, b, count))
sub('template.html', "  #dock { display: block; padding: 0; }", "  #dock { display: block; position: static; padding: 0; }")
sub('src/ui.js', "return clamp(Math.max(dw, dh), 1.2, 25);", "return clamp(Math.max(dw, dh), 1.2, 46);")
sub('src/orbit.js', "maxDist: 26,", "maxDist: 50,")
print('ok')
