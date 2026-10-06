def sub(path, a, b, count=1):
    s = open(path, encoding='utf8').read()
    if a not in s: raise SystemExit('missing in %s: %s' % (path, a[:70]))
    open(path, 'w', encoding='utf8').write(s.replace(a, b, count))
M = 'src/main.js'
sub(M, "const canvas = document.getElementById('gl');\nconst stage = createStage(canvas);", """const canvas = document.getElementById('gl');
function showFail(msg) {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;z-index:50;display:grid;place-items:center;background:#090d12;color:#e9eef4;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px';
  d.innerHTML = '<div style="max-width:30em"><h2 style="margin:0 0 8px;font-size:20px">The 3D view could not start</h2><p style="margin:0;color:#aebccb">' + msg + '</p></div>';
  document.body.appendChild(d);
}
let stage;
try { stage = createStage(canvas); } catch (e) {
  showFail('This page draws the engine with WebGL 2, and your browser or graphics driver did not provide it. Try a current version of Chrome, Edge, Firefox or Safari with hardware acceleration enabled.');
  throw e;
}
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); showFail('The graphics context was lost, usually because the GPU was reset. Reload the page to continue.'); });""")
print('ok')
