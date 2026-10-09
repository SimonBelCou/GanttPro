/* Charge des ressources (EF-87, RG-26) : une petite courbe en barres par ressource, avec un trait à
 * 100 %. Une surcharge est rouge ET marquée ▲ ; une absence est hachurée ET nommée dans l'infobulle
 * et le tableau ; jamais la couleur seule. Tableau des valeurs pour qui ne lit pas un graphique. */
const Load = { unit: 'week', res: null, showValues: false };

function loadPeriods() {
  const s = App.sched;
  let lo = Infinity, hi = -Infinity;
  for (const r of s.tasks.values()) if (!r.empty) { lo = Math.min(lo, r.startDn); hi = Math.max(hi, r.endDn); }
  if (lo === Infinity) return [];
  if (Load.unit === 'day') {
    const out = [];
    for (let dn = lo; dn <= hi; dn++) if (s.cal.isWork(dn)) out.push({ start: dn, end: dn });
    return out;
  }
  return Metrics.periods(lo, hi, Load.unit);
}
function periodLabel(p) {
  if (Load.unit === 'month') return I18n.monthLabel(p.start);
  if (Load.unit === 'week') return t('gantt.week', { date: I18n.shortDate(p.start) });
  return I18n.date(p.start);
}
function occText(o) {
  if (o.state === 'absent') return t('load.absent');
  return t('load.value', { pct: Math.round(o.ratio * 100), load: I18n.number(o.load, 1), avail: I18n.number(o.available, 1) }) + (o.state === 'overload' ? ' — ' + t('load.over') : '');
}

function loadChart(res, periods) {
  const occ = periods.map(p => Metrics.occupation(App.sched, res.id, p.start, p.end));
  const n = periods.length, bw = Load.unit === 'day' ? 10 : Load.unit === 'week' ? 18 : 40;
  const W = Math.max(600, 50 + n * (bw + 4) + 10), H = 150, m = { l: 44, t: 18, b: 26 };
  const maxPct = Math.max(150, ...occ.map(o => (o.ratio || 0) * 100 + 20));
  const py = v => m.t + (1 - v / maxPct) * (H - m.t - m.b);
  const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'loadchart', role: 'img', 'aria-label': t('load.chartLabel', { name: res.name }) },
    svg('defs', {}, svg('pattern', { id: 'hatch-' + res.id, width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
      svg('rect', { width: 6, height: 6, class: 'hatch-bg' }), svg('line', { x1: 0, y1: 0, x2: 0, y2: 6, class: 'hatch-line' }))));
  for (const v of [0, 100]) chart.append(svg('line', { x1: m.l, x2: W - 8, y1: py(v), y2: py(v), class: v ? 'cap' : 'grid' }),
    svg('text', { x: m.l - 6, y: py(v) + 4, class: 'axis', 'text-anchor': 'end', text: `${v} %` }));
  const step = Math.max(1, Math.ceil(n / 10));
  occ.forEach((o, i) => {
    const x = m.l + 4 + i * (bw + 4);
    const tip = `${periodLabel(periods[i])} : ${occText(o)}`;
    if (o.state === 'absent') {
      chart.append(svg('rect', { x, y: py(100), width: bw, height: py(0) - py(100), fill: `url(#hatch-${res.id})`, class: 'absent' }, svg('title', { text: tip })));
    } else {
      const v = Math.min(maxPct, (o.ratio || 0) * 100);
      const over = o.state === 'overload';
      chart.append(svg('rect', { x, y: py(v), width: bw, height: Math.max(0, py(0) - py(v)), rx: 2, class: over ? 'bar-over' : 'bar-ok' }, svg('title', { text: tip })));
      if (over) chart.append(svg('text', { x: x + bw / 2, y: py(v) - 3, class: 'over-mark', 'text-anchor': 'middle', text: '▲' }));
    }
    if (i % step === 0) chart.append(svg('text', { x: x + bw / 2, y: H - 8, class: 'axis', 'text-anchor': 'middle',
      text: Load.unit === 'month' ? I18n.monthLabel(periods[i].start) : I18n.shortDate(periods[i].start) }));
  });
  return { chart, occ };
}

function paintLoad(box) {
  const periods = loadPeriods();
  const all = App.project.resources;
  if (!Load.res) Load.res = new Set(all.map(r => r.id));
  box.append(h('div', { class: 'row' },
    h('fieldset', { class: 'inline' }, h('legend', { text: t('dash.unit') }),
      ['day', 'week', 'month'].map(u => h('span', {}, h('input', { type: 'radio', name: 'ld-unit', id: 'ld-' + u, value: u, checked: Load.unit === u, data: { change: 'loadUnit' } }),
        h('label', { for: 'ld-' + u, text: ' ' + t('load.' + u) })))),
    h('button', { type: 'button', data: { click: 'loadValues' }, aria: { expanded: String(Load.showValues), controls: 'ld-values' } }, t(Load.showValues ? 'dash.hideValues' : 'dash.showValues'))));
  box.append(h('fieldset', { class: 'inline' }, h('legend', { text: t('top.resources') }),
    all.map(r => h('span', { class: 'check' }, h('input', { type: 'checkbox', id: 'ld-r-' + r.id, checked: Load.res.has(r.id), data: { change: 'loadRes', arg: r.id } }),
      h('label', { for: 'ld-r-' + r.id, text: r.name })))));
  box.append(h('ul', { class: 'chart-legend' },
    h('li', {}, h('span', { class: 'key-box ok', aria: { hidden: 'true' } }), t('load.legendOk')),
    h('li', {}, h('span', { class: 'key-box over', aria: { hidden: 'true' } }), t('load.legendOver')),
    h('li', {}, h('span', { class: 'key-box absent', aria: { hidden: 'true' } }), t('load.legendAbsent')),
    h('li', {}, h('span', { class: 'key-line', aria: { hidden: 'true' } }), t('load.legendCap'))));
  if (!periods.length || !all.length) { box.append(h('p', { class: 'hint', text: t('load.empty') })); return; }
  const tables = [];
  for (const r of all.filter(x => Load.res.has(x.id))) {
    const { chart, occ } = loadChart(r, periods);
    const total = occ.reduce((a, o) => a + o.load, 0);
    box.append(h('section', { class: 'load-res' }, h('h4', { text: `${r.name} — ${t('rs.load', { load: I18n.number(total, total % 1 ? 1 : 0) }).replace(/\.$/, '')} ${t('load.capacity', { cap: r.capacity })}` }),
      h('div', { class: 'chart-scroll' }, chart)));
    tables.push([r, occ]);
  }
  if (Load.showValues) {
    box.append(h('div', { class: 'table-scroll', id: 'ld-values' }, h('table', { class: 'manage values' },
      h('caption', { text: t('load.values') }),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: t('dash.period') }), tables.map(([r]) => h('th', { scope: 'col', text: r.name })))),
      h('tbody', {}, periods.map((p, i) => h('tr', {}, h('th', { scope: 'row', text: periodLabel(p) }), tables.map(([, occ]) => h('td', { text: occText(occ[i]) }))))))));
  }
}

action('loadUnit', (arg, el) => { Load.unit = ['day', 'week', 'month'].includes(el.value) ? el.value : 'week'; repaintDashboard('#ld-' + Load.unit); });
action('loadRes', (id, el) => { if (el.checked) Load.res.add(id); else Load.res.delete(id); repaintDashboard('#ld-r-' + CSS.escape(id)); });
action('loadValues', () => { Load.showValues = !Load.showValues; repaintDashboard('[data-click="loadValues"]'); });
