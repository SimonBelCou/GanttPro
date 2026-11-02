/*
 * Onglets de projets (EF-98) : jusqu'à dix projets ouverts. Chaque onglet garde son projet, son
 * zoom, sa vue (recherche, filtres, regroupement), sa sélection, son historique d'annulation, son
 * indicateur « modifié », sa place dans la bibliothèque et son emplacement de récupération.
 * Seul l'onglet actif vit dans App ; les autres sont des instantanés en mémoire.
 *
 * Appelle : App, Dates, Dialog, Editor, Model, Recovery
 * Appelée par : 50-render.js, 80-files.js, 84-tabs.js, 85-library.js, 87-settings.js, 99-main.js, Recovery
 */
const Tabs = (() => {
  const MAX = 10;
  const FIELDS = ['project', 'selected', 'multi', 'zoom', 'view', 'undo', 'redo', 'dirty', 'showAlerts', 'libKey', 'recKey'];
  let list = [], active = 0, seq = 0;

  /**
   * Appelle : aucune
   * Appelée par : openLibrary(), saveAsTemplate(), saveToLibrary(), Tabs.close(), Tabs.init(), Tabs.open(),
   *   Tabs.replace()
   */
  const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''));
  /**
   * Appelle : aucune
   * Appelée par : Tabs.open(), Tabs.replace()
   */
  const freshView = () => ({ query: '', highlight: false, filters: null, groupBy: '', collapsedGroups: new Set(), panel: false, showTags: App.view.showTags });
  /**
   * Appelle : aucune
   * Appelée par : Tabs.open(), Tabs.stateOf(), Tabs.switchTo()
   */
  const snapshot = () => { const s = {}; for (const f of FIELDS) s[f] = App[f]; return s; };
  /**
   * Appelle : recompute()
   * Appelée par : Tabs.close(), Tabs.switchTo()
   */
  const restore = s => { for (const f of FIELDS) App[f] = s[f]; recompute(); };
  /**
   * Appelle : aucune
   * Appelée par : Tabs.close(), Tabs.open(), Tabs.switchTo()
   */
  const tabOf = uid => list.find(x => x.uid === uid);
  /**
   * Appelle : Tabs.snapshot()
   * Appelée par : Tabs.all(), Tabs.anyDirty(), Tabs.close(), Tabs.paint()
   */
  const stateOf = tab => (tab.uid === active ? snapshot() : tab.state);

  /**
   * Appelle : Tabs.newKey()
   * Appelée par : init()
   */
  function init() {
    seq = 1; active = 1;
    App.libKey = ''; App.recKey = newKey();
    list = [{ uid: 1, state: null }];
  }
  /**
   * Appelle : aucune
   * Appelée par : aucune dans le code (point d'entrée ou appel dynamique)
   */
  const count = () => list.length;
  /**
   * Appelle : aucune
   * Appelée par : confirmOpen(), Tabs.open()
   */
  const canOpen = () => list.length < MAX;
  /**
   * Appelle : Tabs.stateOf()
   * Appelée par : init()
   */
  const anyDirty = () => list.some(tab => stateOf(tab).dirty);
  /**
   * Onglets avec leur état (pour la sauvegarde automatique).
   * Appelle : Tabs.stateOf()
   * Appelée par : Recovery.flushSync(), Recovery.saveAll()
   */
  const all = () => list.map(tab => ({ uid: tab.uid, state: stateOf(tab) }));
  /**
   * L'onglet actif est-il un projet initial jamais touché (qu'un projet ouvert peut remplacer) ?
   * Appelle : aucune
   * Appelée par : confirmOpen(), newFromTemplate(), openLibrary(), Recovery.offer()
   */
  const pristine = () => list.length === 1 && !App.dirty && !App.undo.length && !App.libKey;

  /**
   * Ouvre un projet dans un nouvel onglet. Renvoie false (et le dit) au-delà de dix.
   * Appelle : Dialog.message(), Editor.close(), loadProject(), Recovery.touch(), render(), t(), Tabs.canOpen(),
   *   Tabs.freshView(), Tabs.newKey(), Tabs.snapshot(), Tabs.tabOf()
   * Appelée par : confirmOpen(), newFromTemplate(), newProjectAction(), openLibrary(), Recovery.offer()
   */
  function open(project, { dirty = false, libKey = '', recKey = '' } = {}) {
    if (!canOpen()) { Dialog.message(t('tabs.title'), t('tabs.max', { max: MAX })); return false; }
    Editor.close();
    tabOf(active).state = snapshot();
    const uid = ++seq;
    list.push({ uid, state: null });
    active = uid;
    loadProject(project);
    App.multi = new Set(); App.view = freshView(); App.zoom = 100; App.showAlerts = true;
    App.dirty = !!dirty; App.libKey = libKey; App.recKey = recKey || newKey();
    render();
    if (typeof Recovery !== 'undefined' && App.dirty) Recovery.touch();
    return true;
  }

  /**
   * Remplace le projet de l'onglet actif (import « remplacer », restauration au lancement).
   * Appelle : Editor.close(), loadProject(), Recovery.drop(), render(), Tabs.freshView(), Tabs.newKey()
   * Appelée par : confirmOpen(), initHome(), newFromTemplate(), openLibrary(), Recovery.offer(), Tabs.close()
   */
  function replace(project, { dirty = false, libKey = '', recKey = '' } = {}) {
    Editor.close();
    if (App.recKey && recKey && App.recKey !== recKey && typeof Recovery !== 'undefined') Recovery.drop(App.recKey);
    loadProject(project);
    App.multi = new Set(); App.view = freshView();
    App.dirty = !!dirty; App.libKey = libKey; App.recKey = recKey || App.recKey || newKey();
    render();
  }

  /**
   * Appelle : announce(), Editor.close(), render(), t(), Tabs.restore(), Tabs.snapshot(), Tabs.tabOf()
   * Appelée par : action « tabSwitch »
   */
  function switchTo(uid) {
    const target = tabOf(uid);
    if (!target || uid === active) return;
    Editor.close();
    tabOf(active).state = snapshot();
    restore(target.state);
    target.state = null;
    active = uid;
    render();
    announce(t('tabs.switched', { name: App.project.name }));
  }

  /**
   * Appelle : 15 fonctions
   * Appelée par : action « tabClose »
   */
  async function close(uid) {
    const tab = tabOf(uid);
    if (!tab) return;
    const st = stateOf(tab);
    if (st.dirty && !(await Dialog.confirm(t('tabs.close'), [t('tabs.closeDirty', { name: st.project.name })], t('tabs.closeConfirm'), true))) return;
    if (typeof Recovery !== 'undefined') Recovery.drop(st.recKey);
    if (list.length === 1) {
      replace(Model.newProject(Dates.toISO(Dates.todayDn()), Date.now(), initialNames()), { recKey: newKey() });
      App.libKey = '';
      announce(t('tabs.closed', { name: st.project.name }));
      return;
    }
    const i = list.indexOf(tab);
    list.splice(i, 1);
    if (uid === active) {
      const next = list[Math.min(i, list.length - 1)];
      Editor.close();
      restore(next.state); next.state = null; active = next.uid;
    }
    render();
    announce(t('tabs.closed', { name: st.project.name }));
    const btn = document.querySelector(`#tabs button.tab[aria-current="page"]`);
    if (btn) btn.focus();
  }

  /**
   * Bande d'onglets (au-dessus de la barre du haut).
   * Appelle : $(), clear(), h(), t(), Tabs.stateOf()
   * Appelée par : renderAll()
   */
  function paint() {
    const ul = $('tabs-list');
    if (!ul) return;
    clear(ul);
    for (const tab of list) {
      const st = stateOf(tab), p = st.project, cur = tab.uid === active;
      ul.append(h('li', { class: cur ? 'current' : '' },
        h('button', { type: 'button', class: 'tab', data: { click: 'tabSwitch', arg: String(tab.uid) }, aria: { current: cur ? 'page' : undefined } },
          h('span', { text: `${p.emoji} ${p.name}` }),
          st.dirty ? h('span', { class: 'dot', text: ' ●', aria: { hidden: 'true' } }) : null,
          st.dirty ? h('span', { class: 'sr-only', text: ` (${t('tabs.modified')})` }) : null),
        h('button', { type: 'button', class: 'icon tab-close', data: { click: 'tabClose', arg: String(tab.uid) }, aria: { label: t('tabs.closeOne', { name: p.name }) } }, '✕')));
    }
    $('tabs-count').textContent = t('tabs.count', { count: list.length, max: MAX });
  }

  return { init, open, replace, switchTo, close, paint, count, canOpen, anyDirty, all, pristine, newKey, MAX };
})();

/**
 * Appelle : Tabs.switchTo()
 * Appelée par : l'événement « tabSwitch » (table ACTIONS)
 */
action('tabSwitch', arg => Tabs.switchTo(Number(arg)));
/**
 * Appelle : Tabs.close()
 * Appelée par : l'événement « tabClose » (table ACTIONS)
 */
action('tabClose', arg => Tabs.close(Number(arg)));

/**
 * « + » : nouveau projet, modèle, fichier ou bibliothèque (EF-98).
 * Appelle : $(), Dialog.open(), h(), newProjectAction(), t()
 * Appelée par : l'événement « tabPlus » (table ACTIONS)
 */
action('tabPlus', async () => {
  const v = await Dialog.open({ title: t('tabs.plus'), body: [h('p', { text: t('tabs.plusHint') })],
    actions: [{ label: t('dlg.cancel'), value: 'cancel' }, { label: t('tabs.new'), value: 'new', kind: 'primary', focus: true },
      { label: t('tpl.newFrom'), value: 'tpl' }, { label: t('top.import'), value: 'file' }, { label: t('lib.title'), value: 'lib' }] });
  if (v === 'new') newProjectAction();
  else if (v === 'tpl') ACTIONS.newFromTemplate();
  else if (v === 'file') $('file-input').click();
  else if (v === 'lib') ACTIONS.openLibrary();
});
