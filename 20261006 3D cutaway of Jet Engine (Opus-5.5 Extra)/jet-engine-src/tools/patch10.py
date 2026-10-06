def sub(path, a, b, count=1):
    s = open(path, encoding='utf8').read()
    if a not in s: raise SystemExit('missing in %s: %s' % (path, a[:70]))
    open(path, 'w', encoding='utf8').write(s.replace(a, b, count))
sub('src/parts/stand.js', "const arcA = Math.PI - 1.3, arcB = Math.PI + 1.3;", "const arcA = Math.PI - 0.62, arcB = Math.PI + 0.62;")
sub('template.html', '\n          <button class="tgl" id="tSway" aria-pressed="true">Gentle sway</button>', '')
sub('src/ui.js', "  toggle('tSway', (on) => { state.swayOn = on; });\n", "")
sub('template.html', '<div class="toggles">', '<div class="toggles" role="group" aria-label="Display options">')
print('ok')
