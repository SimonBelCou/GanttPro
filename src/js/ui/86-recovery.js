/* Sauvegarde automatique (EF-101, RG-31) — DÉSACTIVÉE par défaut (EX-10).
 * Quand elle est activée, l'état de chaque onglet modifié est écrit 5 secondes après la dernière
 * modification dans un emplacement de récupération propre à l'onglet. L'emplacement est vidé par
 * un export, un enregistrement dans la bibliothèque ou la fermeture de l'onglet ; s'il existe au
 * lancement suivant, l'application propose de le restaurer.
 * Protection (EF-102) : si l'utilisateur l'a demandé, le contenu est chiffré avec un mot de passe
 * gardé UNIQUEMENT en mémoire pendant la session ; après un rechargement, la sauvegarde reste en
 * pause tant que le mot de passe n'a pas été ressaisi (Réglages ou fenêtre de récupération). */
const Recovery = (() => {
  const DELAY = 5000;
  let timer = 0, password = null, lastSaved = 0, failed = '';

  const enabled = () => Settings.get('autosave') === 'on';
  const protectedMode = () => Settings.get('recprotect') === 'on';
  const paused = () => enabled() && protectedMode() && !password;

  /** Enveloppe stockée : {v, savedAt, name, emoji, tasks, enc, data}. */
  async function wrap(project) {
    const text = JSON.stringify(Model.serialize(project, { withVersions: true }));
    const enc = protectedMode();
    const data = enc ? JSON.stringify(await Secure.encrypt(text, password)) : text;
    return JSON.stringify({ v: 1, savedAt: Date.now(), name: project.name, emoji: project.emoji, tasks: project.tasks.length, enc, data });
  }

  async function saveAll() {
    timer = 0;
    if (!enabled() || paused()) { paint(); return; }
    let r = 'ok';
    for (const { state } of Tabs.all()) {
      if (!state.dirty) continue;
      try { r = Store.write('rec', state.recKey, await wrap(state.project)); } catch { r = 'off'; }
      if (r !== 'ok') break;
    }
    if (r === 'ok') { lastSaved = Date.now(); failed = ''; }
    else if (failed !== r) { failed = r; Dialog.message(t('auto.title'), r === 'full' ? t('store.full') : t('store.off')); }
    paint();
  }

  /** À appeler après chaque modification : sauvegarde différée de 5 secondes. */
  function touch() {
    if (!enabled()) return;
    clearTimeout(timer);
    timer = setTimeout(saveAll, DELAY);
  }
  function drop(key) { if (key) Store.remove('rec', key); }
  function clearCurrent() { drop(App.recKey); }
  function clearAllCopies() { for (const k of Store.keys('rec')) Store.remove('rec', k); }

  /** Copies trouvées (enveloppes validées champ par champ ; le contenu sera relu par Model.parseFile). */
  function found() {
    const out = [];
    for (const key of Store.keys('rec')) {
      let e;
      try { e = JSON.parse(Store.read('rec', key) || ''); } catch { continue; }
      if (!e || e.v !== 1 || typeof e.data !== 'string' || typeof e.name !== 'string') continue;
      out.push({ key, savedAt: Number.isFinite(e.savedAt) ? e.savedAt : 0, name: e.name.slice(0, 60), emoji: typeof e.emoji === 'string' ? [...e.emoji].slice(0, 2).join('') : '📁',
        tasks: Number.isInteger(e.tasks) ? e.tasks : 0, enc: e.enc === true, data: e.data });
    }
    return out.sort((a, b) => b.savedAt - a.savedAt);
  }

  async function unwrap(entry, pwd) {
    let r = Model.parseFile(entry.data);
    if (r.encrypted) r = Model.parseFile(await Secure.decrypt(r.envelope, pwd));
    return r.project;
  }

  /** Au lancement : pour chaque copie, restaurer dans un onglet, ignorer ou supprimer (EF-101). */
  async function offer() {
    const list = found();
    if (!list.length) return;
    const groups = list.map((e, i) => h('fieldset', { class: 'sub' },
      h('legend', { text: `${e.emoji} ${e.name} — ${t('auto.savedAt', { time: I18n.dateTime(e.savedAt) })}, ${t('lib.tasks', { count: e.tasks })}${e.enc ? ' 🔒' : ''}` }),
      ['restore', 'ignore', 'delete'].map(c => h('span', { class: 'check' },
        h('input', { type: 'radio', name: 'rec-' + i, id: `rec-${i}-${c}`, value: c, checked: c === 'restore' }), h('label', { for: `rec-${i}-${c}`, text: t('auto.' + c) })))));
    const needPwd = list.some(e => e.enc);
    const pwdInp = needPwd ? h('input', { type: 'password', id: 'rec-pwd', autocomplete: 'current-password' }) : null;
    let choices = null;
    const v = await Dialog.open({ title: t('auto.foundTitle'), size: 'wide',
      body: [h('p', { text: t('auto.found', { count: list.length }) }), ...groups,
        needPwd ? h('div', { class: 'field' }, h('label', { for: 'rec-pwd', text: t('auto.pwd') }), pwdInp) : null,
        h('p', { class: 'field-error', id: 'rec-err', role: 'alert', hidden: true })],
      actions: [{ label: t('auto.later'), value: 'cancel' }, { label: t('dlg.ok'), value: 'ok', kind: 'primary', focus: true }],
      onAction: () => { choices = list.map((e, i) => document.querySelector(`input[name="rec-${i}"]:checked`).value); return true; } });
    if (v !== 'ok') return;
    const pwd = pwdInp ? pwdInp.value : null;
    if (pwdInp) pwdInp.value = '';
    let bad = 0, restored = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i], c = choices[i];
      if (c === 'delete') { drop(e.key); continue; }
      if (c !== 'restore') continue;
      let p;
      try { p = await unwrap(e, pwd); } catch { bad++; continue; }
      if (e.enc && protectedMode()) password = pwd; // la sauvegarde protégée reprend
      const ok = Tabs.pristine() ? (Tabs.replace(p, { dirty: true, recKey: e.key }), true) : Tabs.open(p, { dirty: true, recKey: e.key });
      if (!ok) break;
      restored++;
    }
    if (restored) announce(t('auto.restored', { count: restored }));
    if (bad) await Dialog.message(t('auto.foundTitle'), t('auto.bad', { count: bad }));
    paint();
  }

  /** Indicateur discret de la barre du haut. */
  function paint() {
    const el = $('autosave-status');
    if (!el) return;
    if (!enabled()) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = paused() ? t('auto.paused') : failed ? t('auto.failed') : lastSaved ? t('auto.saved', { time: I18n.dateTime(lastSaved).split(' ').pop() }) : t('auto.on');
  }

  /** Écriture immédiate à la fermeture de la page (sans chiffrement possible, donc seulement en clair). */
  function flushSync() {
    if (!enabled() || protectedMode() || !timer) return;
    clearTimeout(timer); timer = 0;
    for (const { state } of Tabs.all()) {
      if (!state.dirty) continue;
      const text = JSON.stringify(Model.serialize(state.project, { withVersions: true }));
      Store.write('rec', state.recKey, JSON.stringify({ v: 1, savedAt: Date.now(), name: state.project.name, emoji: state.project.emoji, tasks: state.project.tasks.length, enc: false, data: text }));
    }
  }

  function setPassword(p) { password = p; touch(); paint(); }
  function stop() { clearTimeout(timer); timer = 0; password = null; lastSaved = 0; failed = ''; paint(); }
  return { touch, drop, clearCurrent, clearAllCopies, offer, paint, flushSync, setPassword, stop, enabled, paused, protectedMode, saveNow: saveAll };
})();
