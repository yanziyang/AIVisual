def sub(path, a, b, count=1):
    s = open(path, encoding='utf8').read()
    if a not in s: raise SystemExit('missing in %s: %s' % (path, a[:60]))
    open(path, 'w', encoding='utf8').write(s.replace(a, b, count))
sub('template.html', '<option value="200">1 / 200 real speed</option></select>', '<option value="200">1 / 200 real speed</option><option value="600">1 / 600 · study the blades</option></select>')
sub('src/main.js', "let last = performance.now(), time = 0;", "let last = performance.now(), time = 0, frames = 0;")
sub('src/main.js', "  time += dt;\n  if (!paused)", "  time += dt;\n  if (++frames === 4) engine.warm = false; // shaders for every ring variant are compiled by now\n  if (!paused)")
print('ok')
