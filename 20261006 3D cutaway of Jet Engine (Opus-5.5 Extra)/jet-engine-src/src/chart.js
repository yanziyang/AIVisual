// Gas-path chart: temperature and pressure along the engine as two small panels on a shared axis
// (never a dual-axis chart), with module bands underneath, a crosshair readout and band hover/click.
import { BANDS } from './content.js';
import { gas } from './flow.js';
import { clamp } from './util.js';

const NS = 'http://www.w3.org/2000/svg';
const fmt = (n, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const H = 124, X0 = 0.7, X1 = 6.0, T_MIN = 250, T_MAX = 1900, P_MAX = 40;
const TP = { y0: 22, y1: 62 }, PP = { y0: 76, y1: 110 };
const ty = (T) => TP.y1 - (T - T_MIN) / (T_MAX - T_MIN) * (TP.y1 - TP.y0);
const py = (P) => PP.y1 - P / P_MAX * (PP.y1 - PP.y0);

export function createChart({ host, getLoad, onHover, onLeave, onPick }) {
  let station = null, hoverX = null, lastLoad = -1, built = 0, I = null;

  function make(W) {
    host.textContent = '';
    const PX0 = 4, PX1 = W - 4;
    const xp = (x) => PX0 + (x - X0) / (X1 - X0) * (PX1 - PX0);
    const xm = (px) => X0 + (px - PX0) / (PX1 - PX0) * (X1 - X0);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W); svg.setAttribute('height', H);
    const mk = (tag, attrs, parent = svg) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
    const bandEls = BANDS.map((b, i) => {
      const r = mk('rect', { class: 'band' + (i % 2 ? ' alt' : ''), x: xp(b.x0), y: 14, width: xp(b.x1) - xp(b.x0), height: 98 });
      const t = mk('text', { class: 'bname', x: (xp(b.x0) + xp(b.x1)) / 2, y: 122, 'text-anchor': 'middle' }); t.textContent = b.name;
      return { b, r, t };
    });
    mk('rect', { x: 6, y: 3, width: 10, height: 3, rx: 1.5, fill: '#e0702a' });
    mk('text', { class: 'ttl', x: 21, y: 8 }).textContent = 'Gas temperature';
    mk('rect', { x: 6, y: 65, width: 10, height: 3, rx: 1.5, fill: '#3d9be3' });
    mk('text', { class: 'ttl', x: 21, y: 70 }).textContent = 'Pressure, × atmosphere';
    mk('line', { class: 'grid', x1: PX0, x2: PX1, y1: TP.y1, y2: TP.y1 });
    mk('line', { class: 'grid', x1: PX0, x2: PX1, y1: PP.y1, y2: PP.y1 });
    const areaT = mk('path', { fill: 'rgba(224,112,42,.16)', stroke: 'none' });
    const lineT = mk('path', { fill: 'none', stroke: '#e0702a', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
    const areaP = mk('path', { fill: 'rgba(61,155,227,.16)', stroke: 'none' });
    const lineP = mk('path', { fill: 'none', stroke: '#3d9be3', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
    const peakT = mk('text', { class: 'val', 'text-anchor': 'middle' });
    const peakP = mk('text', { class: 'val', 'text-anchor': 'end' });
    const cur = mk('line', { class: 'cursor', y1: 14, y2: 112, visibility: 'hidden' });
    const dotT = mk('circle', { r: 4, fill: '#e0702a', stroke: '#0f151d', 'stroke-width': 2, visibility: 'hidden' });
    const dotP = mk('circle', { r: 4, fill: '#3d9be3', stroke: '#0f151d', 'stroke-width': 2, visibility: 'hidden' });
    const readout = mk('text', { class: 'readout', x: PX1, y: 8, 'text-anchor': 'end' });
    const hit = mk('rect', { x: PX0, y: 0, width: PX1 - PX0, height: H, fill: 'transparent', style: 'cursor: crosshair' });
    host.appendChild(svg);
    const tbl = document.createElement('table'); tbl.className = 'sr-only';
    tbl.innerHTML = '<caption>Gas temperature and pressure along the engine</caption><thead><tr><th>Station</th><th>Temperature K</th><th>Pressure ratio</th></tr></thead><tbody></tbody>';
    host.appendChild(tbl);

    const N = Math.max(40, Math.round(W / 4));
    const curves = (load) => {
      let dT = '', dP = '', peakTx = 0, peakTv = 0;
      for (let i = 0; i <= N; i++) {
        const x = X0 + (X1 - X0) * i / N;
        const T = gas.T(x, load), P = gas.P(x, load);
        dT += (i ? 'L' : 'M') + xp(x).toFixed(1) + ' ' + ty(T).toFixed(1);
        dP += (i ? 'L' : 'M') + xp(x).toFixed(1) + ' ' + py(P).toFixed(1);
        if (T > peakTv) { peakTv = T; peakTx = x; }
      }
      lineT.setAttribute('d', dT); lineP.setAttribute('d', dP);
      areaT.setAttribute('d', dT + `L${PX1} ${TP.y1}L${PX0} ${TP.y1}Z`);
      areaP.setAttribute('d', dP + `L${PX1} ${PP.y1}L${PX0} ${PP.y1}Z`);
      peakT.setAttribute('x', xp(peakTx)); peakT.setAttribute('y', ty(peakTv) - 6); peakT.textContent = fmt(Math.round(peakTv / 10) * 10) + ' K';
      const pk = gas.P(3.1, load);
      peakP.setAttribute('x', xp(3.1) - 8); peakP.setAttribute('y', py(pk) + 4); peakP.textContent = fmt(pk, pk < 10 ? 1 : 0) + ' : 1';
    };
    const cursor = (x) => {
      if (x == null) { [cur, dotT, dotP].forEach((e) => e.setAttribute('visibility', 'hidden')); readout.textContent = ''; return; }
      const load = getLoad(), T = gas.T(x, load), P = gas.P(x, load);
      cur.setAttribute('x1', xp(x)); cur.setAttribute('x2', xp(x));
      dotT.setAttribute('cx', xp(x)); dotT.setAttribute('cy', ty(T)); dotP.setAttribute('cx', xp(x)); dotP.setAttribute('cy', py(P));
      [cur, dotT, dotP].forEach((e) => e.setAttribute('visibility', 'visible'));
      const band = BANDS.find((b) => x >= b.x0 && x < b.x1);
      readout.textContent = `${band ? band.name : 'Exhaust'} · ${fmt(Math.round(T / 10) * 10)} K · ${fmt(P, P < 10 ? 1 : 0)} : 1`;
    };
    const table = (load) => {
      tbl.querySelector('tbody').innerHTML = [0.8, 1.2, 2.0, 3.1, 3.5, 3.85, 4.3, 5.3, 5.9]
        .map((x) => `<tr><td>${x} m</td><td>${Math.round(gas.T(x, load))}</td><td>${gas.P(x, load).toFixed(1)}</td></tr>`).join('');
    };
    const toX = (e) => { const r = svg.getBoundingClientRect(); return xm(clamp((e.clientX - r.left) / r.width * W, PX0, PX1)); };
    const bandAt = (x) => BANDS.find((b) => x >= b.x0 && x < b.x1);
    hit.addEventListener('pointermove', (e) => { hoverX = toX(e); const b = bandAt(hoverX); if (b) onHover(b); update(false); });
    hit.addEventListener('pointerleave', () => { hoverX = null; onLeave(); update(false); });
    hit.addEventListener('click', (e) => { const b = bandAt(toX(e)); if (b) onPick(b); });
    return { bandEls, curves, cursor, table };
  }

  function highlight(mods) {
    if (!I) return;
    I.bandEls.forEach(({ b, r, t }) => { const on = mods && b.mods.some((m) => mods.includes(m)); r.classList.toggle('on', !!on); t.classList.toggle('on', !!on); });
  }
  function update(force) {
    if (!I) return;
    const load = getLoad();
    if (force || Math.abs(load - lastLoad) > 0.004) { lastLoad = load; I.curves(load); I.table(load); }
    I.cursor(hoverX != null ? hoverX : station);
  }
  // (re)build at the container's real pixel width so the type stays 1:1
  function fitWidth() {
    const w = Math.round(host.clientWidth);
    if (w < 160 || w === built) return;
    built = w; I = make(w); update(true);
  }
  return { update, fitWidth, highlight, setStation(x) { station = x; update(true); } };
}
