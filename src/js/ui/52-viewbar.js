/* Barre de recherche, filtres et regroupement (EF-84 à EF-86, RG-27). Affichage seulement :
 * rien n'est enregistré dans le projet, rien ne compte comme une modification (EF-53). */
const viewFilters = () => App.view.filters || (App.view.filters = clone(View.EMPTY));
const viewActive = () => !!(App.view.query.trim() || View.isActive(viewFilters()));

/** Lignes à afficher : {task, flat?, dim?, hit?} ou {group}. */
function viewItems() {
  const v = App.view;
  App.viewMatched = null;
  if (!App.sched) return visibleTasks().map(task => ({ task }));
  const sel = viewActive() ? View.select(App.project, App.sched, { query: v.query, filters: viewFilters() }) : null;
  App.viewMatched = sel ? sel.matched : null;
  const hasQuery = !!v.query.trim();
  if (v.groupBy) {
    const ids = sel ? sel.matched : new Set(App.project.tasks.map(x => x.id));
    const out = [];
    for (const g of View.group(App.project, App.sched, ids, v.groupBy)) {
      out.push({ group: g });
      if (!v.collapsedGroups.has(g.key)) for (const id of g.ids) out.push({ task: taskById(id), flat: true, hit: hasQuery });
    }
    return out;
  }
  let base = visibleTasks();
  if (sel && !v.highlight) base = base.filter(x => sel.ids.has(x.id));
  return base.map(task => ({
    task,
    dim: !!(sel && v.highlight && task.type !== 'summary' && !sel.matched.has(task.id)),
    hit: !!(sel && hasQuery && sel.matched.has(task.id)),
  }));
}

/** Valeurs proposées par critère : [valeur, libellé]. */
function filterOptions() {
  const p = App.project;
  const tags = [...new Map(p.tasks.flatMap(x => x.tags).map(tg => [View.fold(tg), tg])).values()].sort((a, b) => a.localeCompare(b, 'fr'));
  return {
    status: ['late', 'ongoing', 'notStarted', 'upcoming', 'done'].map(k => [k, t('status.' + k)]),
    res: [['', t('view.noRes')], ...p.resources.map(r => [r.id, r.name])],
    cat: p.categories.map(c => [c.id, c.name]),
    tag: tags.map(tg => [tg, tg]),
    type: ['task', 'milestone', 'summary'].map(k => [k, t('type.' + k)]),
  };
}

function renderViewbar(items) {
  const v = App.view, f = viewFilters();
  const search = $('search');
  if (document.activeElement !== search && search.value !== v.query) search.value = v.query;
  $('search-hl').checked = v.highlight;
  $('group-by').value = v.groupBy;
  const btn = $('btn-filters');
  btn.setAttribute('aria-expanded', String(v.panel));
  btn.classList.toggle('active', View.isActive(f));
  // Compteur « 12 sur 40 » (tâches et jalons).
  const total = App.project.tasks.filter(x => x.type !== 'summary').length;
  const count = $('view-count');
  if (App.viewMatched) {
    const shown = [...App.viewMatched].filter(id => { const x = taskById(id); return x && x.type !== 'summary'; }).length;
    count.textContent = v.query.trim() && !View.isActive(f) ? t('view.results', { count: shown }) : t('view.count', { shown, total });
  } else count.textContent = v.groupBy ? t('view.flat') : '';
  // Pastilles des filtres actifs.
  const chips = clear($('view-chips'));
  const opts = filterOptions();
  const chip = (what, value, arg) => h('button', { type: 'button', class: 'chip', data: { click: 'filterRemove', arg }, aria: { label: t('view.chipRemove', { what, value }) } },
    t('view.chip', { what, value }), ' ✕');
  for (const k of ['status', 'res', 'cat', 'tag', 'type']) {
    for (const val of f[k]) {
      const o = opts[k].find(x => x[0] === val);
      chips.append(chip(t('view.f.' + k), o ? o[1] : val, `${k}:${val}`));
    }
  }
  if (f.critical) chips.append(chip(t('view.f.critical'), t('view.on'), 'critical:'));
  if (f.alerts) chips.append(chip(t('view.f.alerts'), t('view.on'), 'alerts:'));
  if (f.from || f.to) chips.append(chip(t('view.f.period'), `${f.from ? I18n.shortDate(Dates.parse(f.from)) : '…'} → ${f.to ? I18n.shortDate(Dates.parse(f.to)) : '…'}`, 'period:'));
  if (View.isActive(f)) chips.append(h('button', { type: 'button', class: 'link-btn', data: { click: 'filtersClear' } }, t('view.clear')));
  chips.hidden = !chips.firstChild;
  // Panneau des filtres.
  const panel = $('filters-panel');
  panel.hidden = !v.panel;
  if (!v.panel) return;
  clear(panel);
  for (const k of ['status', 'res', 'cat', 'tag', 'type']) {
    if (!opts[k].length) continue;
    panel.append(h('fieldset', { class: 'inline' }, h('legend', { text: t('view.f.' + k) }),
      opts[k].map(([val, label], i) => h('span', { class: 'check' },
        h('input', { type: 'checkbox', id: `flt-${k}-${i}`, checked: f[k].includes(val), data: { change: 'filterToggle', arg: `${k}:${val}` } }),
        h('label', { for: `flt-${k}-${i}`, text: label })))));
  }
  panel.append(h('fieldset', { class: 'inline' }, h('legend', { text: t('view.f.period') }),
    h('label', { for: 'flt-from', text: t('view.f.from') }), h('input', { type: 'date', id: 'flt-from', value: f.from, data: { change: 'filterDate', arg: 'from' } }),
    h('label', { for: 'flt-to', text: t('view.f.to') }), h('input', { type: 'date', id: 'flt-to', value: f.to, data: { change: 'filterDate', arg: 'to' } })));
  panel.append(h('div', { class: 'inline' },
    h('span', { class: 'check' }, h('input', { type: 'checkbox', id: 'flt-critical', checked: f.critical, data: { change: 'filterFlag', arg: 'critical' } }), h('label', { for: 'flt-critical', text: t('view.f.critical') })),
    h('span', { class: 'check' }, h('input', { type: 'checkbox', id: 'flt-alerts', checked: f.alerts, data: { change: 'filterFlag', arg: 'alerts' } }), h('label', { for: 'flt-alerts', text: t('view.f.alerts') })),
    h('button', { type: 'button', data: { click: 'filtersClear' } }, t('view.clear'))));
}

let searchTimer = 0;
action('search', (arg, el) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { App.view.query = el.value.slice(0, 200); render(); }, 120);
});
action('searchHighlight', (arg, el) => { App.view.highlight = el.checked; render(); });
action('toggleFilters', () => { App.view.panel = !App.view.panel; render(); });
action('groupBy', (arg, el) => { App.view.groupBy = ['res', 'cat', 'status'].includes(el.value) ? el.value : ''; App.view.collapsedGroups = new Set(); render(); });
action('toggleGroup', key => {
  const c = App.view.collapsedGroups;
  if (c.has(key)) c.delete(key); else c.add(key);
  render();
  const b = document.querySelector(`[data-click="toggleGroup"][data-arg="${CSS.escape(key)}"]`);
  if (b) b.focus();
});
action('filterToggle', (arg, el) => {
  const i = arg.indexOf(':'), k = arg.slice(0, i), val = arg.slice(i + 1);
  const f = viewFilters();
  f[k] = el.checked ? [...f[k], val] : f[k].filter(x => x !== val);
  render();
});
action('filterFlag', (k, el) => { viewFilters()[k] = el.checked; render(); });
action('filterDate', (k, el) => { viewFilters()[k] = Dates.parse(el.value) != null ? el.value : ''; render(); });
action('filterRemove', arg => {
  const i = arg.indexOf(':'), k = arg.slice(0, i), val = arg.slice(i + 1);
  const f = viewFilters();
  if (k === 'critical' || k === 'alerts') f[k] = false;
  else if (k === 'period') { f.from = ''; f.to = ''; }
  else f[k] = f[k].filter(x => x !== val);
  render();
  const next = document.querySelector('#view-chips button') || $('btn-filters');
  next.focus();
});
action('filtersClear', () => { App.view.filters = clone(View.EMPTY); render(); $('btn-filters').focus(); });

/** Entrée / Maj + Entrée : résultat suivant ou précédent, sélectionné et rendu visible (EF-84). */
function searchStep(dir) {
  const hits = [...document.querySelectorAll('#task-rows tr.hit')].map(tr => tr.dataset.id);
  if (!hits.length) return;
  const i = hits.indexOf(App.selected);
  App.selected = hits[(i + dir + hits.length) % hits.length];
  render();
  const row = document.querySelector(`#task-rows tr[data-id="${CSS.escape(App.selected)}"]`);
  if (row) row.scrollIntoView({ block: 'nearest' });
  const task = taskById(App.selected);
  announce(`${App.selected} ${task ? task.name : ''}`);
}
function initViewbar() {
  $('search').addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); clearTimeout(searchTimer); App.view.query = ev.target.value; searchStep(ev.shiftKey ? -1 : 1); }
    if (ev.key === 'Escape' && ev.target.value) { ev.preventDefault(); ev.stopPropagation(); ev.target.value = ''; App.view.query = ''; render(); }
  });
  document.addEventListener('keydown', ev => {
    const inField = ev.target.closest && ev.target.closest('input, textarea, select, [contenteditable]');
    if (ev.key === '/' && !inField && !document.querySelector('dialog[open]')) { ev.preventDefault(); $('search').focus(); }
  });
}
