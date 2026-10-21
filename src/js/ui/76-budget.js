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
  panel.append(h('dl', { class: 'tiles', id: 'bud-tiles' },
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
  const curve = Budget.costCurve(P, App.sched, Dates.todayDn(), Dash.unit);
  const scale = costScale(curve);
  const opts = {
    max: scale.max, ticks: scale.ticks, axis: v => Money.text(v, { compact: true }), fmt: v => Money.text(v, { compact: true }), fmtFull: v => Money.text(v),
    title: 'bud.curve', desc: (c, last) => t('bud.curveDesc', { planned: Money.text(last(c.planned)), real: Money.text(last(c.real)) }),
  };
  const unit = h('fieldset', { class: 'inline' }, h('legend', { text: t('dash.unit') }),
    ['week', 'month'].map(u => h('span', {}, h('input', { type: 'radio', name: 'sc-unit', id: 'sc-' + u, value: u, checked: Dash.unit === u, data: { change: 'dashUnit' } }),
      h('label', { for: 'sc-' + u, text: ' ' + t('dash.' + u) }))));
  const toggle = h('button', { type: 'button', data: { click: 'dashCostValues' }, aria: { expanded: String(Dash.showCostValues), controls: 'bud-values' } },
    t(Dash.showCostValues ? 'dash.hideValues' : 'dash.showValues'));
  panel.append(h('section', { class: 'dash-section', aria: { labelledby: 'bud-curve-h' } },
    h('h3', { id: 'bud-curve-h', text: t('bud.curve') }), h('div', { class: 'row' }, unit, toggle),
    curveLegend(), sCurveChart(curve, opts), h('p', { class: 'hint', text: t('bud.note') }),
    Dash.showCostValues ? curveTable(curve, v => h('td', { class: 'num' }, Money.node(v)), 'bud-values', 'bud.valuesCaption') : null));
}
