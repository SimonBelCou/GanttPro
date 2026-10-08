/* Tableau de bord (EF-37 à EF-40) : indicateurs, courbe en S, tableau de suivi.
 * Courbe : une seule échelle (0-100 %), traits de 2 px, prévu et réel en couleurs validées pour le
 * daltonisme (outil dataviz), baselines en pointillé, étiquettes directes, survol et focus avec
 * réticule, et un tableau des valeurs pour qui ne lit pas un graphique (EF-40). */
const Dash = { unit: 'week', showValues: false, sort: { key: 'order', dir: 1 }, baseline: '', tab: 'summary' };

function fmtPct(v) { return `${I18n.number(v)} %`; }

function sCurveChart(curve) {
  const W = 760, H = 280, m = { l: 44, r: 140, t: 16, b: 34 };
  const n = curve.periods.length;
  const px = i => m.l + (n <= 1 ? 0 : (i * (W - m.l - m.r)) / (n - 1));
  const py = v => m.t + (1 - v / 100) * (H - m.t - m.b);
  const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'scurve', role: 'img', 'aria-labelledby': 'sc-title sc-desc' });
  const last = a => (a.length ? a[a.length - 1] : 0);
  chart.append(svg('title', { id: 'sc-title', text: t('dash.curve') }),
    svg('desc', { id: 'sc-desc', text: t('dash.curveDesc', { planned: fmtPct(last(curve.planned)), real: fmtPct(last(curve.real)) }) }));
  for (const v of [0, 25, 50, 75, 100]) {
    chart.append(svg('line', { x1: m.l, x2: W - m.r, y1: py(v), y2: py(v), class: 'grid' }),
      svg('text', { x: m.l - 6, y: py(v) + 4, class: 'axis', 'text-anchor': 'end', text: `${v} %` }));
  }
  const step = Math.max(1, Math.ceil(n / 8));
  curve.periods.forEach((p, i) => {
    if (i % step && i !== n - 1) return;
    chart.append(svg('text', { x: px(i), y: H - m.b + 18, class: 'axis', 'text-anchor': 'middle',
      text: Dash.unit === 'month' ? I18n.monthLabel(p.start) : I18n.shortDate(p.start) }));
  });
  const td = Dates.todayDn();
  const ti = curve.periods.findIndex(p => p.start <= td && td <= p.end);
  if (ti >= 0) chart.append(svg('line', { x1: px(ti), x2: px(ti), y1: m.t, y2: H - m.b, class: 'today' }),
    svg('text', { x: px(ti) + 4, y: m.t + 10, class: 'axis', text: t('gantt.today') }));
  const line = (vals, cls, color) => {
    if (!vals.length) return;
    const pts = vals.map((v, i) => `${px(i)},${py(v)}`).join(' ');
    chart.append(svg('polyline', { points: pts, class: 'series ' + cls, stroke: color || null, fill: 'none' }));
  };
  const labels = [];
  for (const b of App.project.baselines.filter(x => x.shownOnScurve)) {
    line(curve.baselines[b.id] || [], 'baseline', safeColor(b.color));
    labels.push({ v: last(curve.baselines[b.id] || []), text: `${b.name} ${fmtPct(last(curve.baselines[b.id] || []))}`, i: n - 1 });
  }
  line(curve.planned, 'planned');
  line(curve.real, 'real');
  labels.push({ v: last(curve.planned), text: `${t('dash.planned')} ${fmtPct(last(curve.planned))}`, i: n - 1 });
  if (curve.real.length) labels.push({ v: last(curve.real), text: `${t('dash.real')} ${fmtPct(last(curve.real))}`, i: curve.real.length - 1 });
  // Étiquettes directes, écartées verticalement pour ne pas se chevaucher.
  labels.sort((a, b) => py(a.v) - py(b.v));
  let prev = -Infinity;
  for (const l of labels) {
    const y = Math.max(py(l.v) + 4, prev + 14);
    prev = y;
    chart.append(svg('text', { x: px(l.i) + 6, y, class: 'label', text: l.text }));
  }
  // Réticule au survol et au clavier (flèches gauche/droite).
  const cross = svg('line', { y1: m.t, y2: H - m.b, class: 'cross', visibility: 'hidden' });
  const zone = svg('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, class: 'hit' });
  chart.append(cross, zone);
  const tip = h('div', { class: 'chart-tip', hidden: true, role: 'status' });
  let idx = -1;
  const showAt = i => {
    idx = Math.max(0, Math.min(n - 1, i));
    cross.setAttribute('x1', px(idx)); cross.setAttribute('x2', px(idx)); cross.setAttribute('visibility', 'visible');
    const p = curve.periods[idx];
    const parts = [`${Dash.unit === 'month' ? I18n.monthLabel(p.start) : t('gantt.week', { date: I18n.shortDate(p.start) })}`,
      `${t('dash.planned')} ${fmtPct(curve.planned[idx])}`];
    if (idx < curve.real.length) parts.push(`${t('dash.real')} ${fmtPct(curve.real[idx])}`);
    for (const b of App.project.baselines.filter(x => x.shownOnScurve)) parts.push(`${b.name} ${fmtPct((curve.baselines[b.id] || [])[idx] || 0)}`);
    tip.textContent = parts.join(' · ');
    tip.hidden = false;
  };
  zone.addEventListener('mousemove', ev => {
    const r = chart.getBoundingClientRect();
    const xv = (ev.clientX - r.left) * W / r.width;
    showAt(Math.round(((xv - m.l) * (n - 1)) / (W - m.l - m.r)));
  });
  // Exploration au clavier : le cadre du graphique reçoit le focus, les flèches parcourent les périodes.
  const box = h('div', { class: 'chart-box', tabindex: '0', role: 'group', aria: { label: t('dash.explore') } }, chart, tip);
  zone.addEventListener('mouseleave', () => { if (document.activeElement !== box) { cross.setAttribute('visibility', 'hidden'); tip.hidden = true; } });
  box.addEventListener('focus', () => showAt(idx < 0 ? (ti >= 0 ? ti : n - 1) : idx));
  box.addEventListener('blur', () => { cross.setAttribute('visibility', 'hidden'); tip.hidden = true; });
  box.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') { ev.preventDefault(); showAt(idx + (ev.key === 'ArrowLeft' ? -1 : 1)); }
    if (ev.key === 'Home') { ev.preventDefault(); showAt(0); }
    if (ev.key === 'End') { ev.preventDefault(); showAt(n - 1); }
  });
  return box;
}

function curveLegend() {
  const item = (cls, label, color) => {
    const sw = h('span', { class: 'key ' + cls, aria: { hidden: 'true' } });
    if (color) sw.style.setProperty('border-top-color', safeColor(color));
    return h('li', {}, sw, label);
  };
  return h('ul', { class: 'chart-legend' }, item('planned', t('dash.planned')), item('real', t('dash.real')),
    App.project.baselines.filter(b => b.shownOnScurve).map(b => item('baseline', `${b.name} (${t('dash.dashed')})`, b.color)));
}

function curveTable(curve) {
  const bls = App.project.baselines.filter(b => b.shownOnScurve);
  return h('table', { class: 'manage values', id: 'sc-values' },
    h('caption', { text: t('dash.valuesCaption') }),
    h('thead', {}, h('tr', {}, [t('dash.period'), t('dash.planned'), t('dash.real'), ...bls.map(b => b.name)].map(x => h('th', { scope: 'col', text: x })))),
    h('tbody', {}, curve.periods.map((p, i) => h('tr', {},
      h('th', { scope: 'row', text: Dash.unit === 'month' ? I18n.monthLabel(p.start) : t('gantt.week', { date: I18n.shortDate(p.start) }) }),
      h('td', { text: fmtPct(curve.planned[i]) }), h('td', { text: i < curve.real.length ? fmtPct(curve.real[i]) : '—' }),
      bls.map(b => h('td', { text: fmtPct((curve.baselines[b.id] || [])[i] || 0) }))))));
}

function trackingRows() {
  const s = App.sched, today = Dates.todayDn();
  const bl = App.project.baselines.find(b => b.id === Dash.baseline);
  return App.project.tasks.filter(x => x.type !== 'summary').map((task, order) => {
    const r = s.tasks.get(task.id);
    const dev = Metrics.deviation(task, s, today);
    let vsBl = null;
    if (bl) { const bt = bl.tasks.find(x => x.id === task.id); if (bt) vsBl = r.e - s.cal.floor(Dates.parse(bt.end)); }
    return { task, order, r, dev, vsBl, status: Metrics.status(task, s, today) };
  });
}
const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n) + ' j';

function trackingTable() {
  const cols = [
    ['order', t('col.id')], ['name', t('col.name')], ['pct', t('f.pct')], ['start', t('dash.pStart')], ['end', t('dash.pEnd')],
    ['realStart', t('f.realStart')], ['realEnd', t('f.realEnd')], ['dev', t('dash.dev')], ['status', t('col.status')],
  ];
  if (Dash.baseline) cols.push(['vsBl', t('dash.vsBl')]);
  const key = {
    order: x => x.order, name: x => x.task.name.toLocaleLowerCase(), pct: x => x.task.pct, start: x => x.r.startDn, end: x => x.r.endDn,
    realStart: x => x.task.realStart || '~', realEnd: x => x.task.realEnd || '~', dev: x => (x.dev ? x.dev.days : -1e9),
    status: x => ['late', 'ongoing', 'notStarted', 'upcoming', 'done'].indexOf(x.status), vsBl: x => (x.vsBl == null ? -1e9 : x.vsBl),
  }[Dash.sort.key] || (x => x.order);
  const rows = trackingRows().sort((a, b) => { const ka = key(a), kb = key(b); return (ka < kb ? -1 : ka > kb ? 1 : 0) * Dash.sort.dir || a.order - b.order; });
  const dateCell = v => (v ? I18n.shortDate(Dates.parse(v)) : '—');
  return h('table', { class: 'manage tracking', id: 'tracking' },
    h('caption', { class: 'sr-only', text: t('dash.tracking') }),
    h('thead', {}, h('tr', {}, cols.map(([k, label]) => h('th', { scope: 'col', aria: { sort: Dash.sort.key === k ? (Dash.sort.dir > 0 ? 'ascending' : 'descending') : undefined } },
      h('button', { type: 'button', class: 'sort', data: { click: 'dashSort', arg: k } }, label, Dash.sort.key === k ? (Dash.sort.dir > 0 ? ' ▲' : ' ▼') : ''))))),
    h('tbody', {}, rows.map(x => h('tr', {},
      h('td', { class: 'id', text: x.task.id }), h('td', { text: x.task.name }), h('td', { text: `${x.task.pct} %` }),
      h('td', { text: I18n.shortDate(x.r.startDn) }), h('td', { text: I18n.shortDate(x.r.endDn) }),
      h('td', { text: dateCell(x.task.realStart) }), h('td', { text: dateCell(x.task.realEnd) }),
      h('td', { text: x.dev ? signed(x.dev.days) + (x.dev.ongoing ? ' ' + t('dash.ongoing') : '') : '' }),
      h('td', { class: 'status ' + (x.status || ''), text: x.status ? t('status.' + x.status) : '' }),
      Dash.baseline ? h('td', { text: x.vsBl == null ? '—' : signed(x.vsBl) }) : null))));
}

function paintDashboard(body) {
  clear(body);
  if (!App.sched) { body.append(h('p', { class: 'error', text: t('calc.error') })); return; }
  // Onglets « Synthèse » et « Charge » (motif ARIA tabs : flèches gauche/droite).
  const tabs = ['summary', 'load'];
  body.append(h('div', { role: 'tablist', class: 'tabs', aria: { label: t('top.dashboard') } }, tabs.map(k => h('button', {
    type: 'button', role: 'tab', id: 'dtab-' + k, tabindex: Dash.tab === k ? '0' : '-1', aria: { selected: String(Dash.tab === k), controls: 'dpanel' },
    data: { click: 'dashTab', arg: k } }, t('dash.tab.' + k)))));
  const panel = h('div', { role: 'tabpanel', id: 'dpanel', aria: { labelledby: 'dtab-' + Dash.tab }, tabindex: '0' });
  body.append(panel);
  if (Dash.tab === 'load') { paintLoad(panel); return; }
  body = panel;
  const today = Dates.todayDn();
  const c = Metrics.counters(App.project, App.sched, today);
  const tile = (label, value) => h('div', { class: 'tile' }, h('dt', { text: label }), h('dd', { text: value }));
  body.append(h('dl', { class: 'tiles' },
    tile(t('kpi.progress'), fmtPct(Math.round(Metrics.globalProgress(App.project)))),
    tile(t('dash.done'), String(c.done)), tile(t('dash.ongoingN'), String(c.ongoing)), tile(t('dash.late'), String(c.late))));

  const curve = Metrics.sCurve(App.project, App.sched, today, Dash.unit);
  const unit = h('fieldset', { class: 'inline' }, h('legend', { text: t('dash.unit') }),
    ['week', 'month'].map(u => h('span', {}, h('input', { type: 'radio', name: 'sc-unit', id: 'sc-' + u, value: u, checked: Dash.unit === u, data: { change: 'dashUnit' } }),
      h('label', { for: 'sc-' + u, text: ' ' + t('dash.' + u) }))));
  const toggle = h('button', { type: 'button', data: { click: 'dashValues' }, aria: { expanded: String(Dash.showValues), controls: 'sc-values' } },
    t(Dash.showValues ? 'dash.hideValues' : 'dash.showValues'));
  body.append(h('section', { class: 'dash-section', aria: { labelledby: 'dash-curve-h' } },
    h('h3', { id: 'dash-curve-h', text: t('dash.curve') }), h('div', { class: 'row' }, unit, toggle),
    curveLegend(), sCurveChart(curve), Dash.showValues ? curveTable(curve) : null));

  const blSel = h('select', { id: 'dash-bl', data: { change: 'dashBaseline' } },
    h('option', { value: '', selected: !Dash.baseline }, t('dash.noBl')),
    App.project.baselines.map(b => h('option', { value: b.id, selected: Dash.baseline === b.id }, b.name)));
  body.append(h('section', { class: 'dash-section', aria: { labelledby: 'dash-track-h' } },
    h('h3', { id: 'dash-track-h', text: t('dash.tracking') }),
    h('div', { class: 'row' }, h('label', { for: 'dash-bl', text: t('dash.vsBlPick') }), blSel),
    h('div', { class: 'table-scroll' }, trackingTable())));
}

function dashboardWindow() {
  if (Dash.baseline && !App.project.baselines.some(b => b.id === Dash.baseline)) Dash.baseline = '';
  const body = h('div', { id: 'dash-win' });
  dashboardWindow.body = body;
  paintDashboard(body);
  return Dialog.open({ title: t('top.dashboard'), body: [body], size: 'wide', actions: [{ label: t('dlg.close'), value: 'close', kind: 'primary' }] })
    .then(() => { dashboardWindow.body = null; });
}

function repaintDashboard(focusSel) {
  if (!dashboardWindow.body) return;
  paintDashboard(dashboardWindow.body);
  const el = focusSel && dashboardWindow.body.querySelector(focusSel);
  if (el) el.focus();
}
action('dashTab', k => { Dash.tab = k === 'load' ? 'load' : 'summary'; repaintDashboard('#dtab-' + Dash.tab); });
document.addEventListener('keydown', ev => {
  const tab = ev.target.closest && ev.target.closest('#dash-win [role="tab"]');
  if (!tab || (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft')) return;
  ev.preventDefault();
  ACTIONS.dashTab(Dash.tab === 'load' ? 'summary' : 'load');
});
action('dashUnit', (arg, el) => { Dash.unit = el.value === 'month' ? 'month' : 'week'; repaintDashboard('#sc-' + Dash.unit); });
action('dashValues', () => { Dash.showValues = !Dash.showValues; repaintDashboard('[data-click="dashValues"]'); });
action('dashBaseline', (arg, el) => { Dash.baseline = el.value; repaintDashboard('#dash-bl'); });
action('dashSort', k => {
  Dash.sort = Dash.sort.key === k ? { key: k, dir: -Dash.sort.dir } : { key: k, dir: 1 };
  repaintDashboard(`[data-click="dashSort"][data-arg="${CSS.escape(k)}"]`);
});
