import json, os
p = r"C:\MyProjects\TempProject (OpenCode)\scripts\compare.py"
s = open(p, encoding="utf-8").read()
s = s.replace('cx=262.5, gnd=332.0, sx=4.8348, sy=4.774', 'cx=262.5, gnd=332.0, sx=4.8348, sy=4.869')
s = s.replace('cx=554.0, gnd=491.0, sx=3.1413, sy=3.383', 'cx=554.0, gnd=491.0, sx=3.1413, sy=3.425')
s = s.replace('cx=484.0, gnd=517.0, sx=3.2286, sy=3.360', 'cx=484.0, gnd=517.0, sx=3.2286, sy=3.410')
open(p, "w", encoding="utf-8").write(s)
print("patched")
