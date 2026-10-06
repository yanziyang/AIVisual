def sub(path, a, b, count=1):
    s = open(path, encoding='utf8').read()
    if a not in s: raise SystemExit('missing in %s: %s' % (path, a[:70]))
    open(path, 'w', encoding='utf8').write(s.replace(a, b, count))
sub('src/engine.js', "const b = this.spinOn ? smoothstep(0.30, 0.85, q) : 0;", "const b = this.spinOn ? smoothstep(0.40, 0.95, q) : 0;")
sub('template.html', "/* ------------------------------------------------ top bar */", """#boot { position: absolute; inset: 0; z-index: 40; display: grid; place-content: center; justify-items: center; gap: 16px; background: var(--bg); color: var(--ink2); font-size: 13px; letter-spacing: .04em; transition: opacity .6s; }
#boot.done { opacity: 0; pointer-events: none; }
#boot .spin { width: 34px; height: 34px; border-radius: 50%; border: 3px solid rgba(255, 255, 255, .1); border-top-color: var(--hot); animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
/* ------------------------------------------------ top bar */""")
sub('template.html', '<div id="app">\n', '<div id="app">\n  <div id="boot"><div class="spin"></div><div>Assembling the engine…</div></div>\n')
print('ok')
