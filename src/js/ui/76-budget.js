/* Onglet « Budget » du tableau de bord (EF-117 à EF-119, RG-37 à RG-40) : indicateurs, tableau par catégorie,
 * courbe en S des coûts séparée de la courbe d'avancement, et son équivalent texte. */

/** Graduations « rondes » (1, 2, 5 × 10^k centimes) jusqu'au maximum des séries. */
function costScale(curve) {
  const all = [...curve.planned, ...curve.real, ...Object.values(curve.baselines).flat()];
  const max = Math.max(0, ...all);
  if (max <= 0) return { max: 10000, ticks: [0, 10000] };
  const raw = max / 4, mag = Math.max(1, 10 ** Math.floor(Math.log10(raw))), norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return { max: top, ticks };
}

function paintBudget(panel) {
  const P = App.project, tot = Budget.totals(P);
  const tile = (label, ...value) => h('div', { class: 'tile' }, h('dt', { text: label }), h('dd', {}, value));
  const remaining = tot.remaining < 0
    ? [t('bud.overrun') + ' ', Money.node(-tot.remaining)]
    : [Money.node(tot.remaining)];
  panel.append(h('dl', { class: 'tiles amounts', id: 'bud-tiles' },
    tile(t('bud.bac'), Money.node(tot.bac)), tile(t('bud.provision'), Money.node(tot.provision)), tile(t('bud.total'), Money.node(tot.total)),
    tile(t('bud.actual'), Money.node(tot.actual)), tile(t('bud.remaining'), ...remaining)));

  // Tableau par catégorie (RG-40).
  const cats = Budget.byCategory(P);
  const num = c => h('td', { class: 'num' }, Money.node(c));
  panel.append(h('section', { class: 'dash-section', aria: { labelledby: 'bud-cat-h' } },
    h('h3', { id: 'bud-cat-h', text: t('bud.byCat') }),
    h('div', { class: 'table-scroll' }, h('table', { class: 'manage', id: 'bud-cats' },
      h('thead', {}, h('tr', {}, [t('bud.cat'), t('f.budget'), t('f.actual'), t('bud.gap')].map(x => h('th', { scope: 'col', text: x })))),
      h('tbody', {}, cats.rows.map(r => h('tr', {}, h('th', { scope: 'row', text: r.id ? r.name : t('view.noCat') }), num(r.budget), num(r.actual), num(r.gap)))),
      h('tfoot', {}, h('tr', {}, h('th', { scope: 'row', text: t('bud.sum') }), num(cats.total.budget), num(cats.total.actual), num(cats.total.gap)))))));

  // Courbe en S des coûts (RG-38, RG-39).
  const curve = Budget.costCurve(P, App.sched, Dates.todayDn(), Dash.unit, { ongoing: Dash.ongoing });
  const scale = costScale(curve);
  const opts = {
    max: scale.max, ticks: scale.ticks, axis: v => (v === 0 ? '0' : Money.text(v, { compact: true }).replace(/[,.]00(?=\D|$)/, '')), fmt: v => Money.text(v, { compact: true }), fmtFull: v => Money.text(v),
    title: 'bud.curve', desc: (c, last) => t('bud.curveDesc', { planned: Money.text(last(c.planned)), real: Money.text(last(c.real)) }),
  };
  const unit = h('fieldset', { class: 'inline' }, h('legend', { text: t('dash.unit') }),
    ['week', 'month'].map(u => h('span', {}, h('input', { type: 'radio', name: 'sc-unit', id: 'sc-' + u, value: u, checked: Dash.unit === u, data: { change: 'dashUnit' } }),
      h('label', { for: 'sc-' + u, text: ' ' + t('dash.' + u) }))));
  const ongoing = h('span', {}, h('input', { type: 'checkbox', id: 'bud-ongoing', checked: Dash.ongoing, data: { change: 'dashOngoing' } }), h('label', { for: 'bud-ongoing', text: ' ' + t('bud.ongoing') }));
  const toggle = h('button', { type: 'button', data: { click: 'dashCostValues' }, aria: { expanded: String(Dash.showCostValues), controls: 'bud-values' } },
    t(Dash.showCostValues ? 'dash.hideValues' : 'dash.showValues'));
  panel.append(h('section', { class: 'dash-section', aria: { labelledby: 'bud-curve-h' } },
    h('h3', { id: 'bud-curve-h', text: t('bud.curve') }), h('div', { class: 'row' }, unit, ongoing, toggle),
    curveLegend(), sCurveChart(curve, opts), h('p', { class: 'hint', text: t(Dash.ongoing ? 'bud.noteOngoing' : 'bud.note') }),
    Dash.showCostValues ? curveTable(curve, v => h('td', { class: 'num' }, Money.node(v)), 'bud-values', 'bud.valuesCaption') : null));
  paintEvm(panel);
}

/* Valeur acquise (EF-131 et suivantes) : indicateurs à la date du jour, diagramme CPI / SPI, prévisions à terminaison,
 * points de situation. Un indice qui ne se calcule pas s'affiche « non calculable » avec sa raison, jamais 0. */
const LIGHT_MARK = { green: '●', orange: '▲', red: '■', none: '○' }; // forme + texte : la couleur ne porte jamais seule le sens

function ratioText(r) {
  return r.hundredths == null ? t('evm.na') : I18n.number(r.hundredths / 100, 2);
}

function evmTile(label, node, r) {
  const dd = h('dd', {}, node);
  const tileEl = h('div', { class: 'tile' }, h('dt', { text: label }), dd);
  if (r && r.light) {
    tileEl.classList.add('light-' + r.light);
    dd.append(h('span', { class: 'light-tag' }, ' ' + LIGHT_MARK[r.light] + ' ' + t('evm.light.' + r.light)));
    if (r.reason) dd.append(h('span', { class: 'hint block', text: t('evm.na.' + r.reason) }));
  }
  return tileEl;
}

function cpiSpiDiagram(res) {
  const W = 360, H = 300, m = { l: 44, r: 16, t: 14, b: 38 }, MAX = 2;
  const px = v => m.l + (Math.min(Math.max(v, 0), MAX) / MAX) * (W - m.l - m.r);
  const py = v => H - m.b - (Math.min(Math.max(v, 0), MAX) / MAX) * (H - m.t - m.b);
  const ok = res.cpi.value != null && res.spi.value != null;
  const desc = ok ? t('evm.diagramDesc', { cpi: ratioText(res.cpi), spi: ratioText(res.spi) }) : t('evm.diagramNone');
  const c = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'cpispi', role: 'img', 'aria-labelledby': 'evmd-title evmd-desc', id: 'evm-diagram' });
  c.append(svg('title', { id: 'evmd-title', text: t('evm.diagram') }), svg('desc', { id: 'evmd-desc', text: desc }));
  c.append(svg('rect', { x: px(1), y: m.t, width: px(MAX) - px(1), height: py(1) - m.t, class: 'zone ok' }));
  for (const v of [0, 0.5, 1, 1.5, 2]) {
    c.append(svg('line', { x1: m.l, x2: W - m.r, y1: py(v), y2: py(v), class: 'grid' }), svg('line', { x1: px(v), x2: px(v), y1: m.t, y2: H - m.b, class: 'grid' }),
      svg('text', { x: m.l - 6, y: py(v) + 4, class: 'axis', 'text-anchor': 'end', text: I18n.number(v, 1) }),
      svg('text', { x: px(v), y: H - m.b + 16, class: 'axis', 'text-anchor': 'middle', text: I18n.number(v, 1) }));
  }
  c.append(svg('text', { x: (m.l + W - m.r) / 2, y: H - 6, class: 'axis', 'text-anchor': 'middle', text: t('evm.axisCpi') }),
    svg('text', { x: 10, y: m.t + 8, class: 'axis', text: t('evm.axisSpi') }));
  for (const p of App.project.statusPoints) if (p.cpi != null && p.spi != null) c.append(svg('circle', { cx: px(p.cpi / 100), cy: py(p.spi / 100), r: 3.5, class: 'pt' }));
  if (ok) c.append(svg('circle', { cx: px(res.cpi.value), cy: py(res.spi.value), r: 6, class: 'now' }));
  return c;
}

function paintEvm(panel) {
  const P = App.project, today = Dates.todayDn();
  const res = Evm.compute(P, App.sched, today);
  const money = v => h('span', {}, v < 0 ? '−' : '', Money.node(Math.abs(v)));
  const ratioNode = r => h('span', { class: 'money', text: ratioText(r) });
  const sec = h('section', { class: 'dash-section', id: 'evm', aria: { labelledby: 'evm-h' } },
    h('h3', { id: 'evm-h', text: t('evm.title') }),
    h('p', { class: 'hint', id: 'evm-ref', text: res.ref ? t('evm.refBaseline', { name: res.ref.name }) : t('evm.refPlan') }),
    h('p', { class: 'hint', text: t('evm.asOf', { date: I18n.date(today) }) }));
  if (res.added.length || res.removed.length) sec.append(h('p', { class: 'note', id: 'evm-scope', text: t('evm.scope', { added: res.added.length, removed: res.removed.length }) }));
  sec.append(h('dl', { class: 'tiles amounts', id: 'evm-tiles' },
    evmTile(t('evm.pv'), Money.node(res.pv)), evmTile(t('evm.ev'), Money.node(res.ev)), evmTile(t('evm.ac'), Money.node(res.ac)),
    evmTile(t('evm.cv'), money(res.cv)), evmTile(t('evm.sv'), money(res.sv)),
    evmTile(t('evm.cpi'), ratioNode(res.cpi), res.cpi), evmTile(t('evm.spi'), ratioNode(res.spi), res.spi)),
    h('p', { class: 'hint', text: t('evm.pvNote') }));

  // Prévisions à terminaison : trois hypothèses, jamais une seule présentée comme la vérité.
  const eacRow = (key, e) => h('tr', {}, h('th', { scope: 'row', text: t(key) }),
    h('td', { class: 'num' }, e.cents == null ? h('span', { text: t('evm.na') + ' (' + t('evm.na.' + e.reason) + ')' }) : Money.node(e.cents)),
    h('td', { class: 'num' }, e.cents == null ? '' : money(e.vac)));
  sec.append(h('h4', { text: t('evm.eac') }), h('div', { class: 'table-scroll' }, h('table', { class: 'manage', id: 'evm-eac' },
    h('thead', {}, h('tr', {}, [t('evm.eacMethod'), t('evm.eacValue'), t('evm.vac')].map(x => h('th', { scope: 'col', text: x })))),
    h('tbody', {}, eacRow('evm.eac1', res.eac.byCpi), eacRow('evm.eac2', res.eac.byEtc), eacRow('evm.eac3', res.eac.byEv)))),
    h('p', { class: 'hint', text: t('evm.endNote') }));

  sec.append(h('h4', { text: t('evm.diagram') }), cpiSpiDiagram(res));

  // Points de situation : photo enregistrée sur geste explicite (RG-51), 60 au plus.
  const pts = P.statusPoints;
  const cell = v => h('td', { class: 'num', text: v == null ? t('evm.pointNoRatio') : I18n.number(v / 100, 2) });
  sec.append(h('h4', { text: t('evm.points') }), h('p', { class: 'hint', text: t('evm.pointsHint') }),
    pts.length ? h('div', { class: 'table-scroll' }, h('table', { class: 'manage', id: 'evm-points' },
      h('thead', {}, h('tr', {}, [t('evm.colDate'), t('evm.colLabel'), t('evm.colRef'), t('evm.colCpi'), t('evm.colSpi'), ''].map(x => h('th', { scope: 'col', text: x })))),
      h('tbody', {}, pts.map(p => h('tr', {}, h('td', { text: I18n.date(Dates.parse(p.date)) }), h('td', { text: p.label }), h('td', { text: p.ref }), cell(p.cpi), cell(p.spi),
        h('td', {}, h('button', { type: 'button', class: 'danger', data: { click: 'evmPointDelete', arg: p.id } }, t('evm.pointDelete', { date: I18n.date(Dates.parse(p.date)) }))))))))
      : h('p', { class: 'hint', text: t('evm.pointsNone') }),
    h('div', { class: 'field' }, h('label', { for: 'evm-label', text: t('evm.pointLabel') }), h('input', { type: 'text', id: 'evm-label', maxlength: 100 })),
    h('button', { type: 'button', id: 'evm-add', data: { click: 'evmPointAdd' } }, t('evm.pointAdd')));
  panel.append(sec);
}

action('evmPointAdd', () => {
  const P = App.project;
  if (P.statusPoints.length >= Model.LIMITS.statusPoints) { Dialog.message(t('evm.points'), t('evm.pointLimit', { max: Model.LIMITS.statusPoints })); return; }
  const res = Evm.compute(P, App.sched, Dates.todayDn());
  const label = $('evm-label') ? $('evm-label').value : '';
  let n = 1; while (P.statusPoints.some(x => x.id === 'S' + n)) n++;
  const pt = { id: 'S' + n, ...Evm.point(res, label) };
  commit(pr => pr.statusPoints.push(pt));
  announce(t('evm.pointDone', { date: I18n.date(Dates.parse(pt.date)) }));
  repaintDashboard('#evm-add');
});

action('evmPointDelete', id => {
  if (!App.project.statusPoints.some(x => x.id === id)) return;
  commit(pr => { pr.statusPoints = pr.statusPoints.filter(x => x.id !== id); });
  repaintDashboard('#evm-add');
});
