/* Tableau de bord (EF-37 à EF-40) : indicateurs, courbe en S, tableau de suivi.
 * Courbe : une seule échelle (0-100 %), traits de 2 px, prévu et réel en couleurs validées pour le
 * daltonisme (outil dataviz), baselines en pointillé, étiquettes directes, survol et focus avec
 * réticule, et un tableau des valeurs pour qui ne lit pas un graphique (EF-40). */
const Dash = { unit: 'week', showValues: false, showCostValues: false, showEvcValues: false, ongoing: false, sort: { key: 'order', dir: 1 }, baseline: '', tab: 'summary' };

/**
 * Appelle : I18n.number()
 * Appelée par : (initialisation de 75-dashboard.js), curveTable(), paintDashboard(), PCT_CHART.desc()
 */
function fmtPct(v) { return `${I18n.number(v)} %`; }

/** Réglages de la courbe d'avancement : une échelle de 0 à 100 %. */
const PCT_CHART = {
  max: 100, ticks: [0, 25, 50, 75, 100], axis: v => `${v} %`, fmt: fmtPct, fmtFull: fmtPct, title: 'dash.curve',
  desc: (curve, last) => t('dash.curveDesc', { planned: fmtPct(last(curve.planned)), real: fmtPct(last(curve.real)) }),
};

/**
 * Séries d'une courbe en S « prévu, réel, baselines cochées », dans l'ordre du tableau des valeurs et de l'infobulle.
 * Une série : { name, vals, cls, color?, mark? } ; vals donne une valeur ou null par période (un tableau plus court que
 * la grille : rien au-delà) ; mark ('circle' ou 'square') marque chaque valeur connue.
 * Appelle : safeColor(), t()
 * Appelée par : curveLegend(), curveTable(), sCurveChart()
 */
function curveSeries(curve) {
  return [{ name: t('dash.planned'), vals: curve.planned, cls: 'planned' }, { name: t('dash.real'), vals: curve.real, cls: 'real' },
    ...App.project.baselines.filter(b => b.shownOnScurve).map(b => ({ name: b.name, vals: curve.baselines[b.id] || [], cls: 'baseline', color: safeColor(b.color), dashed: true }))];
}

/**
 * Courbe en S en SVG : étiquettes directes, repère « aujourd'hui », réticule au survol et au clavier.
 * Réglages (o) : échelle (max, ticks, axis), formats (fmt, fmtFull), titre et description ; id, préfixe des identifiants
 * du titre et de la description (« sc » par défaut : deux courbes d'un même onglet n'ont aucun id en commun) ; series,
 * fonction qui donne les séries (curveSeries() par défaut). Une valeur null n'est pas tracée : une série clairsemée
 * (mesures de la valeur acquise) relie ses seules valeurs connues, chacune marquée d'un rond ou d'un carré.
 * Appelle : curveSeries(), Dates.todayDn(), h(), I18n.monthLabel(), I18n.shortDate(), svg(), t()
 * Appelée par : paintBudget(), paintDashboard(), paintEvmCurves(), reportArticle()
 */
function sCurveChart(curve, o = PCT_CHART) {
  const W = 760, H = 280, m = { l: 78, r: 170, t: 16, b: 34 };
  const n = curve.periods.length, id = o.id || 'sc';
  const series = (o.series || curveSeries)(curve);
  const at = (s, i) => (s.vals[i] == null ? null : s.vals[i]);
  const px = i => m.l + (n <= 1 ? 0 : (i * (W - m.l - m.r)) / (n - 1));
  const py = v => m.t + (1 - v / o.max) * (H - m.t - m.b);
  const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'scurve', role: 'img', 'aria-labelledby': `${id}-title ${id}-desc` });
  const last = a => (a.length ? a[a.length - 1] : 0);
  chart.append(svg('title', { id: id + '-title', text: t(o.title) }), svg('desc', { id: id + '-desc', text: o.desc(curve, last) }));
  for (const v of o.ticks) {
    chart.append(svg('line', { x1: m.l, x2: W - m.r, y1: py(v), y2: py(v), class: 'grid' }),
      svg('text', { x: m.l - 6, y: py(v) + 4, class: 'axis', 'text-anchor': 'end', text: o.axis(v) }));
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
  // Baselines dessous, puis les séries du projet ; chaque série relie ses seules valeurs connues.
  const labels = [];
  for (const s of [...series].sort((a, b) => (b.cls === 'baseline') - (a.cls === 'baseline'))) {
    const known = [];
    for (let i = 0; i < n; i++) if (at(s, i) != null) known.push(i);
    if (!known.length) continue;
    chart.append(svg('polyline', { points: known.map(i => `${px(i)},${py(at(s, i))}`).join(' '), class: 'series ' + s.cls, stroke: s.color || null, fill: 'none' }));
    if (s.mark) for (const i of known) {
      chart.append(s.mark === 'square'
        ? svg('rect', { x: px(i) - 4.5, y: py(at(s, i)) - 4.5, width: 9, height: 9, class: 'mark ' + s.cls })
        : svg('circle', { cx: px(i), cy: py(at(s, i)), r: 4.5, class: 'mark ' + s.cls }));
    }
    const li = known[known.length - 1];
    labels.push({ v: at(s, li), name: s.name, value: o.fmt(at(s, li)), i: li });
  }
  // Étiquettes directes, écartées verticalement pour ne pas se chevaucher.
  labels.sort((a, b) => py(a.v) - py(b.v));
  // Deux lignes par étiquette (nom, puis valeur) : elles tiennent dans la marge de droite ; un nom long est coupé
  // à 18 caractères (le nom entier reste dans <title>, l'infobulle et les tableaux).
  let prev = -Infinity;
  for (const l of labels) {
    const y = Math.max(py(l.v) + 4, prev + 28);
    prev = y;
    const short = l.name.length > 18 ? l.name.slice(0, 17) + '…' : l.name;
    const el = svg('text', { x: px(l.i) + 6, y, class: 'label' });
    el.append(svg('title', { text: `${l.name} ${l.value}` }), svg('tspan', { x: px(l.i) + 6, text: short }), svg('tspan', { x: px(l.i) + 6, dy: 13, text: l.value }));
    chart.append(el);
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
    const parts = [`${Dash.unit === 'month' ? I18n.monthLabel(p.start) : t('gantt.week', { date: I18n.shortDate(p.start) })}`];
    for (const s of series) if (at(s, idx) != null) parts.push(`${s.name} ${o.fmtFull(at(s, idx))}`);
    tip.textContent = parts.join(' · ');
    tip.hidden = false;
  };
  zone.addEventListener('mousemove', ev => {
    const r = chart.getBoundingClientRect();
    const xv = (ev.clientX - r.left) * W / r.width;
    showAt(Math.round(((xv - m.l) * (n - 1)) / (W - m.l - m.r)));
  });
  // Exploration au clavier : le cadre du graphique reçoit le focus, les flèches parcourent les périodes.
  const box = h('div', { class: 'chart-box', tabindex: '0', role: 'group', aria: { label: t(o.title) + ' : ' + t('dash.explore') } }, chart, tip);
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

/**
 * Légende d'une courbe : un trait (continu ou pointillé) et, pour une série clairsemée, sa forme (rond, carré), puis le
 * texte (s.legend, à défaut le nom) ; la couleur n'est jamais seule à distinguer les séries.
 * Appelle : curveSeries(), h(), t()
 * Appelée par : paintBudget(), paintDashboard(), paintEvmCurves()
 */
function curveLegend(series = curveSeries({ planned: [], real: [], baselines: {} })) {
  const item = s => {
    const sw = h('span', { class: 'key ' + s.cls + (s.mark ? ' mark-' + s.mark : ''), aria: { hidden: 'true' } });
    if (s.color) sw.style.setProperty('border-top-color', s.color);
    return h('li', {}, sw, s.legend || (s.dashed ? `${s.name} (${t('dash.dashed')})` : s.name));
  };
  return h('ul', { class: 'chart-legend' }, series.map(item));
}

/**
 * Tableau des valeurs d'une courbe (équivalent texte, EF-40, EF-119, EF-151) : une ligne par période, une colonne par
 * série, « — » quand la série n'a pas de valeur dans la période. Réglages (o) : cell (cellule d'une valeur), id, caption
 * (clé du titre), series (curveSeries() par défaut), extra ({ head, cell(i) } : colonne de plus en fin de ligne).
 * Appelle : curveSeries(), fmtPct(), h(), I18n.monthLabel(), I18n.shortDate(), t()
 * Appelée par : paintBudget(), paintDashboard(), paintEvmCurves()
 */
function curveTable(curve, o = {}) {
  const cell = o.cell || (v => h('td', { text: fmtPct(v) }));
  const series = o.series || curveSeries(curve);
  return h('table', { class: 'manage values', id: o.id || 'sc-values' },
    h('caption', { text: t(o.caption || 'dash.valuesCaption') }),
    h('thead', {}, h('tr', {}, [t('dash.period'), ...series.map(s => s.name), ...(o.extra ? [o.extra.head] : [])].map(x => h('th', { scope: 'col', text: x })))),
    h('tbody', {}, curve.periods.map((p, i) => h('tr', {},
      h('th', { scope: 'row', text: Dash.unit === 'month' ? I18n.monthLabel(p.start) : t('gantt.week', { date: I18n.shortDate(p.start) }) }),
      series.map(s => (s.vals[i] == null ? h('td', { text: '—' }) : cell(s.vals[i]))),
      o.extra ? o.extra.cell(i) : null))));
}

/**
 * Appelle : Dates.parse(), Dates.todayDn(), Metrics.deviation(), Metrics.status()
 * Appelée par : trackingTable()
 */
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
/**
 * Appelle : aucune
 * Appelée par : reportSections(), trackingTable()
 */
const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n) + ' j';

/**
 * Appelle : Dates.parse(), h(), I18n.shortDate(), signed(), t(), trackingRows()
 * Appelée par : paintDashboard()
 */
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

/**
 * Onglets du tableau de bord : « Budget » n'apparaît qu'à partir du premier montant saisi (EF-117), ou dès qu'un point de situation existe : un projet rouvert sans montants garde ainsi ses indices CPI / SPI lisibles (EF-141).
 * Appelle : Budget.hasAmounts(), Rates.hasRates()
 * Appelée par : (initialisation de 75-dashboard.js), paintDashboard()
 */
function dashTabs() {
  const tabs = ['summary', 'load'];
  if (Budget.hasAmounts(App.project) || App.project.statusPoints.length || Rates.hasRates(App.project)) tabs.push('budget');
  if (!tabs.includes(Dash.tab)) Dash.tab = 'summary';
  return tabs;
}

/**
 * Appelle : 15 fonctions
 * Appelée par : dashboardWindow(), repaintDashboard()
 */
function paintDashboard(body) {
  clear(body);
  if (!App.sched) { body.append(h('p', { class: 'error', text: t('calc.error') })); return; }
  // Onglets « Synthèse » et « Charge » (motif ARIA tabs : flèches gauche/droite).
  const tabs = dashTabs();
  body.append(h('div', { role: 'tablist', class: 'tabs', aria: { label: t('top.dashboard') } }, tabs.map(k => h('button', {
    type: 'button', role: 'tab', id: 'dtab-' + k, tabindex: Dash.tab === k ? '0' : '-1', aria: { selected: String(Dash.tab === k), controls: 'dpanel' },
    data: { click: 'dashTab', arg: k } }, t('dash.tab.' + k)))));
  const panel = h('div', { role: 'tabpanel', id: 'dpanel', aria: { labelledby: 'dtab-' + Dash.tab }, tabindex: '0' });
  body.append(panel);
  if (Dash.tab === 'load') { paintLoad(panel); return; }
  if (Dash.tab === 'budget') { paintBudget(panel); return; }
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

/**
 * Appelle : Dialog.open(), h(), paintDashboard(), t()
 * Appelée par : action « openDashboard », repaintDashboard()
 */
function dashboardWindow() {
  if (Dash.baseline && !App.project.baselines.some(b => b.id === Dash.baseline)) Dash.baseline = '';
  const body = h('div', { id: 'dash-win' });
  dashboardWindow.body = body;
  paintDashboard(body);
  return Dialog.open({ title: t('top.dashboard'), body: [body], size: 'wide', maskTool: true, actions: [{ label: t('dlg.close'), value: 'close', kind: 'primary' }] })
    .then(() => { dashboardWindow.body = null; });
}

/**
 * Appelle : dashboardWindow(), paintDashboard()
 * Appelée par : 15 fonctions (usage général)
 */
function repaintDashboard(focusSel) {
  if (!dashboardWindow.body) return;
  paintDashboard(dashboardWindow.body);
  const el = focusSel && dashboardWindow.body.querySelector(focusSel);
  if (el) el.focus();
}
/**
 * Appelle : repaintDashboard()
 * Appelée par : l'événement « dashTab » (table ACTIONS)
 */
action('dashTab', k => { Dash.tab = ['load', 'budget'].includes(k) ? k : 'summary'; repaintDashboard('#dtab-' + Dash.tab); });
document.addEventListener('keydown', ev => {
  const tab = ev.target.closest && ev.target.closest('#dash-win [role="tab"]');
  if (!tab || (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft')) return;
  ev.preventDefault();
  const tabs = dashTabs(), at = tabs.indexOf(Dash.tab);
  ACTIONS.dashTab(tabs[(at + (ev.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]);
});
/**
 * Appelle : repaintDashboard()
 * Appelée par : l'événement « dashUnit » (table ACTIONS)
 */
action('dashUnit', (arg, el) => { Dash.unit = el.value === 'month' ? 'month' : 'week'; repaintDashboard('#' + (el.name === 'evc-unit' ? 'evc-' : 'sc-') + Dash.unit); });
/**
 * Appelle : repaintDashboard()
 * Appelée par : l'événement « dashOngoing » (table ACTIONS)
 */
action('dashOngoing', (arg, el) => { Dash.ongoing = el.checked; repaintDashboard('#bud-ongoing'); });
/**
 * Appelle : repaintDashboard()
 * Appelée par : l'événement « dashCostValues » (table ACTIONS)
 */
action('dashCostValues', () => { Dash.showCostValues = !Dash.showCostValues; repaintDashboard('[data-click="dashCostValues"]'); });
/**
 * Appelle : repaintDashboard()
 * Appelée par : l'événement « dashValues » (table ACTIONS)
 */
action('dashValues', () => { Dash.showValues = !Dash.showValues; repaintDashboard('[data-click="dashValues"]'); });
/**
 * Appelle : repaintDashboard()
 * Appelée par : l'événement « dashBaseline » (table ACTIONS)
 */
action('dashBaseline', (arg, el) => { Dash.baseline = el.value; repaintDashboard('#dash-bl'); });
/**
 * Appelle : repaintDashboard()
 * Appelée par : l'événement « dashSort » (table ACTIONS)
 */
action('dashSort', k => {
  Dash.sort = Dash.sort.key === k ? { key: k, dir: -Dash.sort.dir } : { key: k, dir: 1 };
  repaintDashboard(`[data-click="dashSort"][data-arg="${CSS.escape(k)}"]`);
});
