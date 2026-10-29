/* Sélection simple et multiple (EF-03, EF-81), actions groupées (EF-82), hiérarchie (EF-59, EF-60,
 * EF-61, EF-63), suppression (EF-06), tri (EF-09), réordonnancement par glisser-déposer (EF-10),
 * repli de la liste (EF-43), largeur des colonnes (EF-44), raccourcis de liste (EF-58). */
App.multi = new Set();
let selAnchor = null;

/** Identifiants sélectionnés, dans l'ordre de la liste. */
function selectedIds() {
  if (App.multi.size) return App.project.tasks.filter(x => App.multi.has(x.id)).map(x => x.id);
  return App.selected && taskById(App.selected) ? [App.selected] : [];
}
/** Sélection sans les éléments dont un ancêtre est aussi sélectionné (ils suivent leur parent). */
function topSelected() {
  const ids = new Set(selectedIds());
  return [...ids].filter(id => !ancestorsOf(id).some(a => ids.has(a)));
}
const visibleOrder = () => [...document.querySelectorAll('#task-rows tr[data-id]')].map(tr => tr.dataset.id).filter((v, i, a) => a.indexOf(v) === i);
const isSelected = id => App.multi.has(id) || App.selected === id;

function clearSelection(keepPrimary = false) {
  App.multi.clear();
  if (!keepPrimary) App.selected = null;
}

action('selectTask', (id, el, ev) => {
  if (!taskById(id)) return;
  const mod = ev && (ev.ctrlKey || ev.metaKey), range = ev && ev.shiftKey;
  if (mod || range) {
    ev.preventDefault();
    if (!App.multi.size && App.selected) App.multi.add(App.selected);
    if (range && selAnchor) {
      const order = visibleOrder();
      const a = order.indexOf(selAnchor), b = order.indexOf(id);
      if (a >= 0 && b >= 0) for (let i = Math.min(a, b); i <= Math.max(a, b); i++) App.multi.add(order[i]);
    } else if (App.multi.has(id)) App.multi.delete(id); else App.multi.add(id);
    if (!range) selAnchor = id;
    App.selected = App.multi.has(id) ? id : [...App.multi][0] || null;
    if (Editor.isOpen()) Editor.close();
    render();
    announce(t('sel.count', { count: App.multi.size }));
    const btn = document.querySelector(`button.select[data-arg="${CSS.escape(id)}"]`);
    if (btn) btn.focus();
    return;
  }
  App.multi.clear();
  selAnchor = id;
  Editor.open(id);
});

function renderSelbar() {
  const bar = $('selbar');
  const n = App.multi.size;
  bar.hidden = n < 2;
  if (n < 2) return;
  clear(bar);
  const grouped = !!App.view.groupBy;
  bar.append(h('strong', { text: t('sel.count', { count: n }) }),
    h('button', { type: 'button', data: { click: 'bulkEdit' } }, t('sel.bulk')),
    h('button', { type: 'button', data: { click: 'duplicateSelection' } }, t('edit.duplicate')),
    h('button', { type: 'button', data: { click: 'indent' }, disabled: grouped, aria: { keyshortcuts: 'Control+Shift+ArrowRight' } }, t('sel.indent')),
    h('button', { type: 'button', data: { click: 'outdent' }, disabled: grouped, aria: { keyshortcuts: 'Control+Shift+ArrowLeft' } }, t('sel.outdent')),
    h('button', { type: 'button', data: { click: 'groupUnder' }, disabled: grouped }, t('sel.group')),
    h('button', { type: 'button', class: 'danger', data: { click: 'deleteTask' } }, t('edit.delete')),
    h('button', { type: 'button', class: 'link-btn', data: { click: 'clearSelection' } }, t('sel.clear')));
}
action('clearSelection', () => { clearSelection(); render(); $('main').focus(); });

/* ── Suppression (EF-06, EF-63) ─────────────────────────────────────────────────────────── */
const DELETE_NAMES_SHOWN = 5;
action('deleteTask', async () => {
  const ids = topSelected();
  if (!ids.length) return;
  const all = new Set(ids.flatMap(id => [id, ...descendants(id).map(x => x.id)]));
  const summaries = ids.filter(id => taskById(id).type === 'summary');
  const desc = [...all].filter(id => !ids.includes(id)).length;
  const losing = App.project.tasks.filter(x => !all.has(x.id) && x.deps.some(d => all.has(d.id))).length;
  const first = taskById(ids[0]);
  const title = ids.length === 1 ? t('dlg.deleteTask', { id: first.id, name: first.name }) : t('sel.deleteN', { count: ids.length });
  const lines = [losing ? t('dlg.deleteTaskDeps', { count: losing }) : ''];
  if (ids.length > 1) {
    // A-55 : la confirmation nomme les éléments concernés (les cinq premiers, puis le nombre des autres).
    const shown = ids.slice(0, DELETE_NAMES_SHOWN).map(id => `${id} « ${taskById(id).name} »`).join(', ');
    const more = ids.length - DELETE_NAMES_SHOWN;
    lines.unshift(t('sel.deleteNames', { names: shown }) + (more > 0 ? ' ' + t('sel.deleteMore', { count: more }) : ''));
  }
  let keep = false;
  if (summaries.length && desc) {
    lines.unshift(t('dlg.deleteSummary', { count: desc }));
    const v = await Dialog.open({ title, body: lines.filter(Boolean).map(x => h('p', { text: x })), actions: [
      { label: t('dlg.cancel'), value: 'cancel', focus: true },
      { label: t('sel.keepChildren'), value: 'keep' },
      { label: t('sel.deleteAll', { count: desc }), value: 'all', kind: 'danger' }] });
    if (v === 'cancel') return;
    keep = v === 'keep';
  } else if (!(await Dialog.confirm(title, lines, t('edit.delete')))) return;
  const gone = keep ? new Set(ids) : all;
  commit(p => {
    if (keep) for (const x of p.tasks) if (gone.has(x.parent)) { let up = p.tasks.find(y => y.id === x.parent); while (up && gone.has(up.id)) up = p.tasks.find(y => y.id === up.parent); x.parent = up ? up.id : ''; }
    p.tasks = p.tasks.filter(x => !gone.has(x.id));
    for (const x of p.tasks) x.deps = x.deps.filter(d => !gone.has(d.id));
  });
  clearSelection();
  Editor.close();
  render();
  announce(ids.length === 1 ? t('deleted', { id: ids[0] }) : t('sel.deleted', { count: gone.size }));
  $('main').focus();
});

/* ── Hiérarchie (EF-59, EF-60) ──────────────────────────────────────────────────────────── */
/** Hauteur d'un sous-arbre (0 pour une feuille). */
function heightOf(id, tasks) { const kids = tasks.filter(x => x.parent === id); return kids.length ? 1 + Math.max(...kids.map(k => heightOf(k.id, tasks))) : 0; }
function depthOk(p) { return p.tasks.every(x => ancestorsOf(x.id, p.tasks).length <= Model.LIMITS.depth); }

function hierarchyChange(mutate, okMsg) {
  const trial = clone(App.project);
  const err = mutate(trial);
  if (err) { announce(err); Dialog.message(t('sel.hierarchy'), err); return false; }
  normalizeOrder(trial);
  if (!depthOk(trial)) { Dialog.message(t('sel.hierarchy'), t('err.depth', { max: Model.LIMITS.depth })); return false; }
  const cycle = Model.findCycle(trial.tasks);
  if (cycle) { Dialog.message(t('sel.hierarchy'), t('err.cycle', { path: cycle.join(' → ') })); return false; }
  // Un lien entre une tâche et sa propre récapitulative est interdit (RG-09).
  for (const x of trial.tasks) for (const d of x.deps) if (ancestorsOf(x.id, trial.tasks).includes(d.id) || ancestorsOf(d.id, trial.tasks).includes(x.id)) {
    Dialog.message(t('sel.hierarchy'), t('sel.linkHierarchy', { a: d.id, b: x.id })); return false;
  }
  commit(p => { mutate(p); });
  // Fiche ouverte : son champ « Récapitulative parente » suit le changement, sans perdre la saisie.
  Editor.syncParent();
  announce(okMsg);
  return true;
}

action('indent', () => {
  const ids = topSelected();
  if (!ids.length || App.view.groupBy) return;
  hierarchyChange(p => {
    for (const id of ids) {
      const x = p.tasks.find(y => y.id === id);
      const sibs = p.tasks.filter(y => y.parent === x.parent);
      const prev = sibs.slice(0, sibs.indexOf(x)).reverse().find(y => !ids.includes(y.id));
      if (!prev || prev.type !== 'summary') return t('sel.needSummary');
      x.parent = prev.id;
      // Devient le dernier enfant de cette récapitulative : on le place après sa descendance.
      const block = [x, ...descendants(x.id, p.tasks)];
      p.tasks = p.tasks.filter(y => !block.includes(y));
      const d = descendants(prev.id, p.tasks);
      p.tasks.splice(p.tasks.indexOf(d.length ? d[d.length - 1] : prev) + 1, 0, ...block);
    }
    return null;
  }, t('sel.indented', { count: ids.length }));
});

action('outdent', () => {
  const ids = topSelected();
  if (!ids.length || App.view.groupBy) return;
  hierarchyChange(p => {
    for (const id of [...ids].reverse()) {
      const x = p.tasks.find(y => y.id === id);
      if (!x.parent) return t('sel.topLevel');
      const parent = p.tasks.find(y => y.id === x.parent);
      const block = [x, ...descendants(x.id, p.tasks)];
      p.tasks = p.tasks.filter(y => !block.includes(y));
      x.parent = parent.parent;
      const d = descendants(parent.id, p.tasks);
      p.tasks.splice(p.tasks.indexOf(d.length ? d[d.length - 1] : parent) + 1, 0, ...block);
    }
    return null;
  }, t('sel.outdented', { count: ids.length }));
});

action('groupUnder', () => {
  const ids = topSelected();
  if (!ids.length || App.view.groupBy) return;
  const parents = new Set(ids.map(id => taskById(id).parent));
  if (parents.size > 1) { Dialog.message(t('sel.hierarchy'), t('sel.sameLevel')); return; }
  if (App.project.tasks.length >= Model.LIMITS.tasks) { Dialog.message(t('sel.hierarchy'), t('err.limit', { max: Model.LIMITS.tasks, what: 'tâches' })); return; }
  const sid = Model.nextTaskId(App.project.tasks.map(x => x.id));
  const ok = hierarchyChange(p => {
    const first = p.tasks.find(y => y.id === ids[0]);
    const summary = { id: sid, name: t('newSummary'), type: 'summary', parent: first.parent, dur: 0, deps: [], assign: [], cat: '', pct: 0,
      forcedStart: '', notBefore: '', deadline: '', realStart: '', realEnd: '', tags: [], notes: '', comments: [], collapsed: false };
    p.tasks.splice(p.tasks.indexOf(first), 0, summary);
    for (const id of ids) p.tasks.find(y => y.id === id).parent = sid;
    return null;
  }, t('sel.grouped', { id: sid, count: ids.length }));
  if (ok) { clearSelection(); Editor.open(sid); }
});

/* ── Replier tout (EF-61), tri (EF-09), liste repliée (EF-43) ─────────────────────────────── */
action('collapseAll', v => { for (const x of App.project.tasks) if (x.type === 'summary') x.collapsed = v === '1'; render(); });

/** Tri topologique stable : chaque prédécesseur avant ses successeurs, ordre actuel sinon (EF-09). */
function sortedOrder(tasks) {
  const index = new Map(tasks.map((x, i) => [x.id, i]));
  const indeg = new Map(tasks.map(x => [x.id, 0]));
  const succ = new Map(tasks.map(x => [x.id, []]));
  for (const x of tasks) for (const d of x.deps) if (succ.has(d.id)) { succ.get(d.id).push(x.id); indeg.set(x.id, indeg.get(x.id) + 1); }
  const ready = tasks.filter(x => !indeg.get(x.id)).map(x => x.id);
  const rank = new Map();
  while (ready.length) {
    ready.sort((a, b) => index.get(a) - index.get(b));
    const id = ready.shift();
    rank.set(id, rank.size);
    for (const s of succ.get(id)) { indeg.set(s, indeg.get(s) - 1); if (!indeg.get(s)) ready.push(s); }
  }
  // Une récapitulative prend le rang de son premier descendant.
  const rankOf = x => (x.type === 'summary' ? Math.min(Infinity, ...descendants(x.id, tasks).map(rankOf)) : rank.get(x.id) ?? index.get(x.id));
  return [...tasks].sort((a, b) => rankOf(a) - rankOf(b) || index.get(a.id) - index.get(b.id));
}
action('sortTasks', async () => {
  if (!(await Dialog.confirm(t('view.sort'), [t('sort.warn')], t('view.sort'), false))) return;
  commit(p => { p.tasks = sortedOrder(p.tasks); });
  announce(t('sort.done'));
});

App.listCollapsed = false;
action('toggleList', () => {
  App.listCollapsed = !App.listCollapsed;
  $('planner').classList.toggle('list-collapsed', App.listCollapsed);
  $('list').hidden = App.listCollapsed;
  renderListToggle();
  $('btn-list').focus();
});
function renderListToggle() {
  const b = $('btn-list');
  b.textContent = t(App.listCollapsed ? 'view.listShow' : 'view.listHide');
  b.setAttribute('aria-expanded', String(!App.listCollapsed));
}
action('showTags', (arg, el) => { App.view.showTags = el.checked; render(); });

/* ── Largeur des colonnes (EF-44) : poignées utilisables à la souris et au clavier ─────────── */
const COL_LIMITS = { id: [36, 300], name: [120, 1000], dur: [64, 300], start: [96, 220], end: [96, 220], rstart: [104, 220], rend: [96, 220], deps: [124, 800], res: [100, 800], status: [80, 500], budget: [88, 500], actual: [88, 500] };
/** Largeur par défaut d'une colonne, rétablie par le double-clic ou la touche Début sur sa poignée. */
const COL_DEFAULT = { id: 48, name: 310, dur: 64, start: 96, end: 96, rstart: 104, rend: 96, deps: 124, res: 154, status: 80, budget: 100, actual: 100 };
App.colWidths = {};
/** Fige toutes les colonnes à leur largeur actuelle avant un réglage : en mise en page fixe, les colonnes laissées
 *  automatiques seraient sinon comprimées sous leur titre par la colonne que l'on élargit. */
function snapshotColWidths() {
  for (const th of $('tasks-table').querySelectorAll('thead th')) {
    const k = th.querySelector('.col-resize') && th.querySelector('.col-resize').dataset.col;
    if (k && !App.colWidths[k]) App.colWidths[k] = Math.max(COL_LIMITS[k][0], Math.min(COL_LIMITS[k][1], Math.round(th.getBoundingClientRect().width)));
  }
}
function applyColWidths() {
  const table = $('tasks-table');
  const any = Object.keys(App.colWidths).length > 0;
  const all = Object.keys(COL_LIMITS).every(k => App.colWidths[k]);
  if (all) table.style.setProperty('width', Object.keys(COL_LIMITS).reduce((a, k) => a + App.colWidths[k], 0) + 'px'); else table.style.removeProperty('width');
  table.classList.toggle('fixed', any);
  for (const col of table.querySelectorAll('col')) {
    const w = App.colWidths[col.dataset.col];
    if (w) col.style.setProperty('width', w + 'px'); else col.style.removeProperty('width');
  }
  for (const sep of table.querySelectorAll('.col-resize')) {
    const k = sep.dataset.col;
    const th = sep.closest('th');
    const w = Math.round(App.colWidths[k] || th.getBoundingClientRect().width);
    sep.setAttribute('aria-valuenow', String(Math.max(COL_LIMITS[k][0], Math.min(COL_LIMITS[k][1], w))));
  }
  if (typeof applyFreeze === 'function') applyFreeze();
}
function initColumns() {
  const ths = $('tasks-table').querySelectorAll('thead th');
  const keys = ['id', 'name', 'dur', 'start', 'end', 'rstart', 'rend', 'deps', 'res', 'status', 'budget', 'actual'];
  ths.forEach((th, i) => {
    const k = keys[i];
    const sep = h('span', { class: 'col-resize', role: 'separator', tabindex: '0', data: { col: k },
      aria: { orientation: 'vertical', valuemin: COL_LIMITS[k][0], valuemax: COL_LIMITS[k][1], label: t('col.resize', { col: th.textContent }),
        valuenow: Math.max(COL_LIMITS[k][0], Math.min(COL_LIMITS[k][1], Math.round(th.getBoundingClientRect().width) || COL_LIMITS[k][0])) } });
    th.append(sep);
    const set = w => { snapshotColWidths(); App.colWidths[k] = Math.max(COL_LIMITS[k][0], Math.min(COL_LIMITS[k][1], Math.round(w))); applyColWidths(); };
    sep.addEventListener('keydown', ev => {
      if (ev.key === 'Home') { ev.preventDefault(); snapshotColWidths(); App.colWidths[k] = COL_DEFAULT[k]; applyColWidths(); return; }
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      ev.preventDefault();
      snapshotColWidths();
      set((App.colWidths[k] || th.getBoundingClientRect().width) + (ev.key === 'ArrowRight' ? 10 : -10));
    });
    sep.addEventListener('dblclick', () => { snapshotColWidths(); App.colWidths[k] = COL_DEFAULT[k]; applyColWidths(); if (typeof applyFreeze === 'function') applyFreeze(); });
    sep.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      sep.setPointerCapture(ev.pointerId);
      const x0 = ev.clientX, w0 = th.getBoundingClientRect().width;
      const move = e => set(w0 + e.clientX - x0);
      const up = () => { sep.removeEventListener('pointermove', move); sep.removeEventListener('pointerup', up); };
      sep.addEventListener('pointermove', move);
      sep.addEventListener('pointerup', up);
    });
  });
}

/* ── Glisser-déposer dans la liste (EF-10, EF-64) ────────────────────────────────────────── */
function initRowDrag() {
  const body = $('task-rows');
  let dragId = null;
  body.addEventListener('dragstart', ev => {
    const tr = ev.target.closest('tr[data-id]');
    if (!tr || App.view.groupBy) { ev.preventDefault(); return; }
    dragId = tr.dataset.id;
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', dragId);
  });
  body.addEventListener('dragover', ev => { if (dragId && ev.target.closest('tr[data-id]')) ev.preventDefault(); });
  body.addEventListener('drop', ev => {
    const tr = ev.target.closest('tr[data-id]');
    if (!dragId || !tr) return;
    ev.preventDefault();
    const target = tr.dataset.id, id = dragId;
    dragId = null;
    if (target === id) return;
    if (descendants(id).some(x => x.id === target)) { Dialog.message(t('sel.hierarchy'), t('sel.intoSelf')); return; }
    hierarchyChange(p => {
      const x = p.tasks.find(y => y.id === id), tg = p.tasks.find(y => y.id === target);
      const block = [x, ...descendants(id, p.tasks)];
      p.tasks = p.tasks.filter(y => !block.includes(y));
      x.parent = tg.parent;
      p.tasks.splice(p.tasks.indexOf(tg), 0, ...block);
      return null;
    }, t('sel.moved', { id, target }));
  });
  body.addEventListener('dragend', () => { dragId = null; });
}

/* ── Raccourcis de liste (EF-58, EF-60, EF-81) ───────────────────────────────────────────── */
function initListKeys() {
  document.addEventListener('keydown', ev => {
    if (document.querySelector('dialog[open]')) return;
    const inField = ev.target.closest && ev.target.closest('input, textarea, select, [contenteditable]');
    if (inField) return;
    const inList = ev.target.closest && ev.target.closest('#task-rows');
    if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && inList && !ev.altKey) {
      ev.preventDefault();
      const order = visibleOrder();
      const cur = ev.target.closest('tr[data-id]');
      const i = cur ? order.indexOf(cur.dataset.id) : -1;
      const next = order[Math.max(0, Math.min(order.length - 1, i + (ev.key === 'ArrowDown' ? 1 : -1)))];
      if (!next) return;
      if (ev.shiftKey) {
        if (!App.multi.size && App.selected) App.multi.add(App.selected);
        App.multi.add(next);
      } else App.multi.clear();
      App.selected = next;
      render();
      const b = document.querySelector(`button.select[data-arg="${CSS.escape(next)}"]`);
      if (b) { b.focus(); b.scrollIntoView({ block: 'nearest' }); }
      return;
    }
    if (ev.key === 'Delete' || ev.key === 'Suppr') {
      // A-55 (15/10/2026) : Suppr agit sur la sélection explicite, jamais en la remplaçant par la ligne qui a le focus.
      // La ligne qui a le focus n'est visée que s'il n'y a aucune sélection ; la confirmation nomme les tâches concernées.
      const tr = inList && ev.target.closest('tr[data-id]');
      if (!selectedIds().length && tr) App.selected = tr.dataset.id;
      if (selectedIds().length) { ev.preventDefault(); ACTIONS.deleteTask(); }
      return;
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'a' && !ev.altKey) {
      ev.preventDefault();
      App.multi = new Set(visibleOrder());
      App.selected = [...App.multi][0] || null;
      render();
      announce(t('sel.count', { count: App.multi.size }));
      return;
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) {
      ev.preventDefault();
      ACTIONS[ev.key === 'ArrowRight' ? 'indent' : 'outdent']();
      return;
    }
    if (ev.key === '?' && typeof ACTIONS.openHelp === 'function') { ev.preventDefault(); ACTIONS.openHelp(); return; }
    if (ev.key === 'Escape' && App.multi.size) { clearSelection(true); render(); }
  });
}
