/* Actions de l'écran principal et démarrage. */


/**
 * Appelle : render(), taskById()
 * Appelée par : l'événement « toggleCollapse » (table ACTIONS)
 */
action('toggleCollapse', id => {
  // Replier ne modifie pas les données au sens d'EF-53 : pas d'historique, pas d'indicateur.
  const task = taskById(id);
  if (!task || task.type !== 'summary') return;
  task.collapsed = !task.collapsed;
  render();
  const btn = document.querySelector(`button.toggle[data-arg="${CSS.escape(id)}"]`);
  if (btn) btn.focus();
});

/**
 * Appelle : $(), ancestorsOf(), announce(), commit(), Dialog.message(), Editor.open(), Model.nextTaskId(), t(),
 *   taskById()
 * Appelée par : l'événement « addTask » (table ACTIONS)
 */
action('addTask', type => {
  if (App.project.tasks.length >= Model.LIMITS.tasks) { Dialog.message(t('top.addTask'), t('err.limit', { max: Model.LIMITS.tasks, what: 'tâches' })); return; }
  const id = Model.nextTaskId(App.project.tasks.map(x => x.id));
  const sel = App.selected && taskById(App.selected);
  let parent = sel && sel.type === 'summary' ? sel.id : (sel ? sel.parent : '');
  if (parent && ancestorsOf(parent).length + 1 > Model.LIMITS.depth) { Dialog.message(t('top.addTask'), t('err.depth', { max: Model.LIMITS.depth })); return; }
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

/**
 * Appelle : announce(), commit(), t(), taskById()
 * Appelée par : l'événement « moveTask » (table ACTIONS)
 */
action('moveTask', dir => {
  if (App.view.groupBy) { announce(t('view.flat')); return; }
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

/**
 * Appelle : announce(), clone(), commit(), Dates.parse(), Schedule.compute(), t()
 * Appelée par : l'événement « setProjectStart » (table ACTIONS)
 */
action('setProjectStart', (arg, el) => {
  if (Dates.parse(el.value) == null) { announce(t('err.date', { field: t('top.start') })); el.value = App.project.projectStart; return; }
  const trial = clone(App.project);
  trial.projectStart = el.value;
  try { Schedule.compute(trial); } catch { announce(t('calc.error')); el.value = App.project.projectStart; return; }
  commit(p => { p.projectStart = el.value; });
});

/**
 * Appelle : announce(), t(), undoStep()
 * Appelée par : l'événement « undo » (table ACTIONS)
 */
action('undo', () => { if (undoStep(App.undo, App.redo)) announce(t('undo.done')); });
/**
 * Appelle : announce(), t(), undoStep()
 * Appelée par : l'événement « redo » (table ACTIONS)
 */
action('redo', () => { if (undoStep(App.redo, App.undo)) announce(t('redo.done')); });

/**
 * Appelle : announce(), render(), t()
 * Appelée par : l'événement « zoom » (table ACTIONS)
 */
action('zoom', step => {
  const s = Number(step);
  App.zoom = s === 0 ? 100 : Math.min(400, Math.max(20, App.zoom + 20 * s));
  render();
  announce(t('top.zoom', { pct: App.zoom }));
});

/**
 * Appelle : $(), render()
 * Appelée par : l'événement « toggleAlerts » (table ACTIONS)
 */
action('toggleAlerts', () => { App.showAlerts = !App.showAlerts; render(); if (!App.showAlerts) $('btn-alerts').focus(); });

/**
 * Appelle : applyTheme(), render(), Settings.get(), Settings.set()
 * Appelée par : l'événement « toggleTheme » (table ACTIONS)
 */
action('toggleTheme', () => {
  const order = ['system', 'light', 'dark'];
  const next = order[(order.indexOf(Settings.get('theme') || DEFAULT_THEME) + 1) % 3];
  Settings.set('theme', next);
  applyTheme();
  render();
});

/**
 * Appelle : $(), I18n.getLang(), setLanguage()
 * Appelée par : l'événement « toggleLang » (table ACTIONS)
 */
action('toggleLang', () => {
  setLanguage(I18n.getLang() === 'fr' ? 'en' : 'fr');
  $('btn-lang').focus();
});

/**
 * Appelle : editProjectWindow()
 * Appelée par : l'événement « editProject » (table ACTIONS)
 */
action('editProject', () => editProjectWindow());
// EF-65 : un lien cliqué s'édite dans le panneau de son successeur.
/**
 * Appelle : $(), Editor.open(), taskById()
 * Appelée par : l'événement « editLink » (table ACTIONS)
 */
action('editLink', id => { if (!taskById(id)) return; Editor.open(id); const box = $('deps-box'); if (box) { box.scrollIntoView({ block: 'nearest' }); const sel = box.querySelector('select'); if (sel) sel.focus(); } });
/**
 * Appelle : resolveWindow()
 * Appelée par : l'événement « openResolve » (table ACTIONS)
 */
action('openResolve', () => resolveWindow());
/**
 * Appelle : baselinesWindow()
 * Appelée par : l'événement « openBaselines » (table ACTIONS)
 */
action('openBaselines', () => baselinesWindow());
/**
 * Appelle : dashboardWindow()
 * Appelée par : l'événement « openDashboard » (table ACTIONS)
 */
action('openDashboard', () => dashboardWindow());
/**
 * Appelle : $(), render()
 * Appelée par : l'événement « toggleLinks » (table ACTIONS)
 */
action('toggleLinks', () => { App.showLinks = !App.showLinks; render(); $('btn-links').focus(); });
/**
 * Appelle : announce(), commit(), t()
 * Appelée par : l'événement « setLeveling » (table ACTIONS)
 */
action('setLeveling', (arg, el) => {
  if (!Schedule.MODES.includes(el.value)) return;
  commit(p => { p.leveling = el.value; });
  const n = App.sched ? App.sched.conflicts.length : 0;
  announce(`${t('top.leveling')} : ${t('lvl.' + el.value)}. ${n ? t('top.conflicts', { count: n }) : t('rsv.left0')}`);
});
/**
 * Appelle : resourcesWindow()
 * Appelée par : l'événement « openResources » (table ACTIONS)
 */
action('openResources', () => resourcesWindow());
/**
 * Appelle : categoriesWindow()
 * Appelée par : l'événement « openCategories » (table ACTIONS)
 */
action('openCategories', () => categoriesWindow());
/**
 * Appelle : newProjectAction()
 * Appelée par : l'événement « newProject » (table ACTIONS)
 */
action('newProject', () => newProjectAction());
/**
 * Appelle : exportWindow()
 * Appelée par : l'événement « exportFile » (table ACTIONS)
 */
action('exportFile', () => exportWindow());
/**
 * Appelle : $()
 * Appelée par : l'événement « importFile » (table ACTIONS)
 */
action('importFile', () => $('file-input').click());
/**
 * Appelle : importFile()
 * Appelée par : l'événement « fileChosen » (table ACTIONS)
 */
action('fileChosen', async (arg, el) => {
  const file = el.files && el.files[0];
  el.value = '';
  if (file) importFile(file);
});

/**
 * Appelle : Settings.get()
 * Appelée par : action « toggleTheme », init(), openSettings()
 */
function applyTheme() {
  const theme = Settings.get('theme') || DEFAULT_THEME;
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Appelle : $(), Editor.close(), Editor.isOpen(), saveToLibrary()
 * Appelée par : init()
 */
function initKeyboard() {
  document.addEventListener('keydown', ev => {
    const inField = ev.target.closest && ev.target.closest('input, textarea, select, [contenteditable]');
    // Ctrl + S : enregistrer dans la bibliothèque (EF-99), y compris depuis un champ.
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !ev.shiftKey && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      if (!document.querySelector('dialog[open]')) saveToLibrary();
      return;
    }
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !inField && !document.querySelector('dialog[open]')) {
      const k = ev.key.toLowerCase();
      if (k === 'z' && !ev.shiftKey) { ev.preventDefault(); ACTIONS.undo(); }
      else if (k === 'y' || (k === 'z' && ev.shiftKey)) { ev.preventDefault(); ACTIONS.redo(); }
    }
    if (ev.key === 'Escape' && !document.querySelector('dialog[open]') && Editor.isOpen()) { ev.preventDefault(); Editor.close(); }
    if (!inField && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !document.querySelector('dialog[open]') && (ev.key === '+' || ev.key === '-' || ev.key === '−')) { ev.preventDefault(); ACTIONS.zoom(ev.key === '+' ? '1' : '-1'); }
  });
  // Ctrl + molette sur la grille : zoom (EF-41).
  $('gantt').addEventListener('wheel', ev => { if (ev.ctrlKey) { ev.preventDefault(); ACTIONS.zoom(ev.deltaY < 0 ? '1' : '-1'); } }, { passive: false });
}

/**
 * Appelle : 27 fonctions
 * Appelée par : (initialisation de 99-main.js)
 */
function init() {
  const lang = Settings.get('lang') || ((navigator.language || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr');
  I18n.setLang(lang);
  applyTheme();
  App.maskAmounts = Settings.get('mask') === 'on';
  initActions();
  initDisclosures();
  initKeyboard();
  Tooltip.init();
  initViewbar();
  initShortcuts();
  initRowDrag();
  initListKeys();
  initGestures();
  initLayout();
  initClipboard();
  loadProject(Model.newProject(Dates.toISO(Dates.todayDn()), Date.now(), initialNames()));
  Tabs.init();
  // Avertissement à la fermeture uniquement si un onglet a des modifications non exportées (EF-53).
  window.addEventListener('beforeunload', ev => {
    Recovery.flushSync();
    if (Tabs.anyDirty()) { ev.preventDefault(); ev.returnValue = ''; }
  });
  // Sauvegarde automatique : écriture immédiate dès que la page passe en arrière-plan ou se ferme (les minuteurs d'un
  // onglet masqué sont ralentis par le navigateur, et la fermeture n'appelle pas toujours beforeunload).
  window.addEventListener('pagehide', () => Recovery.flushSync());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') Recovery.flushSync(); });
  // Champs de saisie : le texte existant est sélectionné à l'arrivée, le premier caractère tapé le remplace (aucune
  // sélection à faire à la main). Le clic de souris ne doit pas défaire cette sélection.
  let pickedInput = null;
  const isTextField = el => el instanceof HTMLInputElement && ['text', 'search', 'number', 'email', 'url', 'tel', ''].includes(el.type) && !el.readOnly && !el.disabled;
  document.addEventListener('focusin', ev => { if (isTextField(ev.target)) { ev.target.select(); pickedInput = ev.target; } });
  document.addEventListener('mouseup', ev => { if (pickedInput && ev.target === pickedInput) ev.preventDefault(); pickedInput = null; }, true);
  // Import par glisser-déposer (EF-52).
  document.addEventListener('dragover', ev => { if (ev.dataTransfer && [...ev.dataTransfer.types].includes('Files')) ev.preventDefault(); });
  document.addEventListener('drop', async ev => {
    const file = ev.dataTransfer && ev.dataTransfer.files[0];
    if (!file) return;
    ev.preventDefault();
    importFile(file);
  });
  render();
  Recovery.paint();
  initHome().then(() => Recovery.offer());
}

init();
