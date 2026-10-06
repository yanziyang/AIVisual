def sub(path, a, b, count=1):
    s = open(path, encoding='utf8').read()
    if a not in s: raise SystemExit('missing in %s: %s' % (path, a[:70]))
    open(path, 'w', encoding='utf8').write(s.replace(a, b, count))
E = 'src/engine.js'
sub(E, "import { buildExhaust, buildCowl } from './parts/exhaust.js';", "import { buildExhaust, buildCowl } from './parts/exhaust.js';\nimport { buildStand } from './parts/stand.js';")
sub(E, "    this.add(buildCowl());\n    this.flame", "    this.add(buildCowl());\n    this.add(buildStand());\n    this.flame")
sub(E, "    for (const m of registry.modules) {\n      m.n1.rotation.x = this.ang.n1;", "    this.mods.stand.group.visible = this.explode < 0.03;\n    for (const m of registry.modules) {\n      m.n1.rotation.x = this.ang.n1;")
# stage: hemisphere fill
S = 'src/stage.js'
sub(S, "  // warm glow inside the combustor", "  const hemi = new THREE.HemisphereLight(0xdde7ff, 0x1a1e25, 0.45);\n  scene.add(hemi);\n\n  // warm glow inside the combustor")
sub(S, "0.28, 0.5, 1.5)", "0.24, 0.5, 1.6)")
# ui: sound toggle
U = 'src/ui.js'
sub(U, "import { createChart } from './chart.js';", "import { createChart } from './chart.js';\nimport { EngineAudio } from './audio.js';")
sub(U, "  toggle('tSway', (on) => { state.swayOn = on; });", "  toggle('tSway', (on) => { state.swayOn = on; });\n  const audio = new EngineAudio();\n  toggle('tSound', (on) => audio.set(on));")
sub(U, "    updateGauges(dt);\n    labelsLayout(dt);", "    updateGauges(dt);\n    labelsLayout(dt);\n    audio.update(engine.state);")
sub('template.html', '<button class="tgl" id="tSway" aria-pressed="true">Gentle sway</button>', '<button class="tgl" id="tSway" aria-pressed="true">Gentle sway</button>\n          <button class="tgl" id="tSound" aria-pressed="false">Sound</button>')
print('ok')
