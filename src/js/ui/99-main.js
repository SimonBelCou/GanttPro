/* Actions de l'écran principal et démarrage. */

action('selectTask', id => { if (taskById(id)) Editor.open(id); });

action('toggleCollapse', id => {
  // Replier ne modifie pas les données au sens d'EF-53 : pas d'historique, pas d'indicateur.
  const task = taskById(id);
  if (!task || task.type !== 'summary') return;
  task.collapsed = !task.collapsed;
  render();
  const btn = document.querySelector(`button.toggle[data-arg="${CSS.escape(id)}"]`);
  if (btn) btn.focus();
});

action('addTask', type => {
  if (App.project.tasks.length >= Model.LIMITS.tasks) { Dialog.message(t('top.addTask'), t('err.limit', { max: Model.LIMITS.tasks, what: 'tâches' })); return; }
  const id = Model.nextTaskId(App.project.tasks.map(x => x.id));
  const sel = App.selected && taskById(App.selected);
  let parent = sel && sel.type === 'summary' ? sel.id : (sel ? sel.parent : '');
  if (parent && ancestorsOf(parent).length + 1 > Model.LIMITS.depth) parent = '';
  const name = t(type === 'milestone' ? 'newMilestone' : type === 'summary' ? 'newSummary' : 'newTask');
  commit(p => p.tasks.push({
    id, name, type, parent, dur: type === 'task' ? 5 : 0, deps: [], assign: [], cat: type === 'summary' ? '' : (p.categories[0] ? p.categories[0].id : ''),
    pct: 0, forcedStart: '', notBefore: '', deadline: '', realStart: '', realEnd: '', tags: [], notes: '', comments: [], collapsed: false,
  }));
  announce(t('added', { id }));
  Editor.open(id);
  const nameIn = $('f-name');
  if (nameIn) nameIn.select();
});

action('deleteTask', async () => {
  const id = App.selected;
  const task = taskById(id);
  if (!task) return;
  const desc = descendants(id);
  const gone = new Set([id, ...desc.map(x => x.id)]);
  const losing = App.project.tasks.filter(x => !gone.has(x.id) && x.deps.some(d => gone.has(d.id))).length;
  const ok = await Dialog.confirm(t('dlg.deleteTask', { id, name: task.name }),
    [desc.length ? t('dlg.deleteSummary', { count: desc.length }) : '', losing ? t('dlg.deleteTaskDeps', { count: losing }) : ''], t('edit.delete'));
  if (!ok) return;
  commit(p => {
    p.tasks = p.tasks.filter(x => !gone.has(x.id));
    for (const x of p.tasks) x.deps = x.deps.filter(d => !gone.has(d.id));
  });
  App.selected = null;
  Editor.close();
  render();
  announce(t('deleted', { id }));
  $('main').focus();
});

action('moveTask', dir => {
  const id = App.selected;
  const task = taskById(id);
  if (!task) return;
  const siblings = App.project.tasks.filter(x => x.parent === task.parent);
  const i = siblings.indexOf(task), j = i + Number(dir);
  if (j < 0 || j >= siblings.length) return;
  commit(p => {
    // Échange des deux blocs (tâche + descendance) ; normalizeOrder garde la hiérarchie contiguë.
    const a = p.tasks.find(x => x.id === id), b = p.tasks.find(x => x.id === siblings[j].id);
    const ia = p.tasks.indexOf(a), ib = p.tasks.indexOf(b);
    p.tasks[ia] = b; p.tasks[ib] = a;
  });
  const btn = document.querySelector(`#editor [data-click="moveTask"][data-arg="${dir}"]`);
  if (btn) btn.focus();
});

action('setProjectStart', (arg, el) => {
  if (Dates.parse(el.value) == null) { announce(t('err.date', { field: t('top.start') })); el.value = App.project.projectStart; return; }
  const trial = clone(App.project);
  trial.projectStart = el.value;
  try { Schedule.compute(trial); } catch { announce(t('calc.error')); el.value = App.project.projectStart; return; }
  commit(p => { p.projectStart = el.value; });
});

action('undo', () => { if (undoStep(App.undo, App.redo)) announce(t('undo.done')); });
action('redo', () => { if (undoStep(App.redo, App.undo)) announce(t('redo.done')); });

action('zoom', step => {
  const s = Number(step);
  App.zoom = s === 0 ? 100 : Math.min(300, Math.max(20, App.zoom + 20 * s));
  render();
  announce(t('top.zoom', { pct: App.zoom }));
});

action('toggleAlerts', () => { App.showAlerts = !App.showAlerts; render(); if (!App.showAlerts) $('btn-alerts').focus(); });

action('toggleTheme', () => {
  const order = ['system', 'light', 'dark'];
  const next = order[(order.indexOf(Settings.get('theme') || 'system') + 1) % 3];
  Settings.set('theme', next);
  applyTheme();
  render();
});

action('toggleLang', () => {
  const next = I18n.getLang() === 'fr' ? 'en' : 'fr';
  Settings.set('lang', next);
  I18n.setLang(next);
  render();
  if (Editor.isOpen()) Editor.open(App.selected);
  $('btn-lang').focus();
});

action('editProject', () => editProjectWindow());
action('openResources', () => resourcesWindow());
action('openCategories', () => categoriesWindow());
action('newProject', () => newProjectAction());
action('exportFile', () => exportWindow());
action('importFile', () => $('file-input').click());
action('fileChosen', async (arg, el) => {
  const file = el.files && el.files[0];
  el.value = '';
  if (!file) return;
  if (file.size > Model.MAX_BYTES) { await Dialog.message(t('top.import'), t('imp.tooBig')); return; }
  importText(await file.text());
});

function applyTheme() {
  const theme = Settings.get('theme') || 'system';
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}

function initKeyboard() {
  document.addEventListener('keydown', ev => {
    const inField = ev.target.closest && ev.target.closest('input, textarea, select, [contenteditable]');
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !inField && !document.querySelector('dialog[open]')) {
      const k = ev.key.toLowerCase();
      if (k === 'z' && !ev.shiftKey) { ev.preventDefault(); ACTIONS.undo(); }
      else if (k === 'y' || (k === 'z' && ev.shiftKey)) { ev.preventDefault(); ACTIONS.redo(); }
    }
    if (ev.key === 'Escape' && !document.querySelector('dialog[open]') && Editor.isOpen()) { ev.preventDefault(); Editor.close(); }
    if (!inField && ev.target.closest && ev.target.closest('#gantt') && (ev.key === '+' || ev.key === '-')) { ev.preventDefault(); ACTIONS.zoom(ev.key === '+' ? '1' : '-1'); }
  });
  // Ctrl + molette sur la grille : zoom (EF-41).
  $('gantt').addEventListener('wheel', ev => { if (ev.ctrlKey) { ev.preventDefault(); ACTIONS.zoom(ev.deltaY < 0 ? '1' : '-1'); } }, { passive: false });
}

function init() {
  const lang = Settings.get('lang') || ((navigator.language || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr');
  I18n.setLang(lang);
  applyTheme();
  initActions();
  initKeyboard();
  loadProject(Model.newProject(Dates.toISO(Dates.todayDn()), Date.now(), initialNames()));
  // Avertissement à la fermeture uniquement si des données ont changé (EF-53).
  window.addEventListener('beforeunload', ev => { if (App.dirty) { ev.preventDefault(); ev.returnValue = ''; } });
  // Import par glisser-déposer (EF-52).
  document.addEventListener('dragover', ev => { if (ev.dataTransfer && [...ev.dataTransfer.types].includes('Files')) ev.preventDefault(); });
  document.addEventListener('drop', async ev => {
    const file = ev.dataTransfer && ev.dataTransfer.files[0];
    if (!file) return;
    ev.preventDefault();
    if (file.size > Model.MAX_BYTES) { await Dialog.message(t('top.import'), t('imp.tooBig')); return; }
    importText(await file.text());
  });
  render();
}

init();
