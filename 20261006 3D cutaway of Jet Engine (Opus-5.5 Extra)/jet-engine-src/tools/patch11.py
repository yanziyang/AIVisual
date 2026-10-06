def sub(path, a, b, count=1):
    s = open(path, encoding='utf8').read()
    if a not in s: raise SystemExit('missing in %s: %s' % (path, a[:70]))
    open(path, 'w', encoding='utf8').write(s.replace(a, b, count))
sub('template.html', "@media (max-width: 1179px) and (min-height: 900px)", """@media (min-width: 981px) and (max-height: 840px) {
  #dock { grid-template-columns: minmax(250px, 300px) minmax(0, 1fr) minmax(240px, 280px); }
  #dock .card { min-height: 0; padding: 10px 13px 11px; }
  .card h2 { margin-bottom: 6px; }
  .gauges { grid-template-columns: repeat(4, 1fr); gap: 5px; margin-top: 7px; }
  .tile { padding: 6px 7px 7px; }
  .tile .k { font-size: 9.5px; gap: 4px; overflow: hidden; }
  .tile .v b { font-size: 16px; }
  .tile .v small { font-size: 10px; }
  .mini { display: none; }
  .facts { display: none; }
  .story-text p { font-size: 12.6px; line-height: 1.44; }
  .story-body { margin-top: 6px; }
  .legend { display: none; }
  .toggles { margin-top: 6px; }
  .tgl { height: 26px; }
  .row { font-size: 11.5px; }
}
@media (max-width: 1179px) and (min-height: 900px)""")
sub('template.html', '<div class="k">Exhaust gas</div>', '<div class="k">Exhaust</div>')
print('ok')
