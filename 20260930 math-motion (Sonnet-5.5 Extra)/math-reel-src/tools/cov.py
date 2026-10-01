import sys, glob
from fontTools.ttLib import TTFont
chars = "ΣπθφΔ∞√≈→⇒×·−²³⁻⁵₀ₙᵢ●°ẋ∑∫∂ελ=+±≠≤≥∈ℝℂ⁺ⁿ"
base = "node_modules/@fontsource"
sets = {
 'inter-tight': ["node_modules/@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2","node_modules/@fontsource-variable/inter-tight/files/inter-tight-greek-wght-normal.woff2","node_modules/@fontsource-variable/inter-tight/files/inter-tight-latin-ext-wght-normal.woff2"],
 'jetbrains': [f"{base}/jetbrains-mono/files/jetbrains-mono-{s}-400-normal.woff2" for s in ('latin','greek','latin-ext')],
 'stix-it': [f"{base}/stix-two-text/files/stix-two-text-{s}-400-italic.woff2" for s in ('latin','greek','latin-ext')],
 'stix': [f"{base}/stix-two-text/files/stix-two-text-{s}-400-normal.woff2" for s in ('latin','greek','latin-ext')],
}
for name, files in sets.items():
    cm = {}
    for f in files:
        t = TTFont(f); cm.update(t.getBestCmap())
    have = ''.join(c for c in chars if ord(c) in cm)
    miss = ''.join(c for c in chars if ord(c) not in cm)
    print(name, 'HAVE:', have, ' MISSING:', miss)
