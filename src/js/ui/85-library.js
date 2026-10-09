/* Bibliothèque locale (EF-99) et modèles (EF-100), éventuellement protégés par mot de passe (EF-102).
 * Un enregistrement est toujours un geste explicite de l'utilisateur. Le sommaire (« index ») et
 * chaque contenu relu du stockage sont des données non fiables : le sommaire est validé champ par
 * champ, chaque projet repasse par Model.parseFile (même contrôle qu'un import). */
const Library = (() => {
  const INDEX = 'index', MAX_ENTRIES = 200;

  function index() {
    let raw;
    try { raw = JSON.parse(Store.read('lib', INDEX) || '[]'); } catch { return []; }
    if (!Array.isArray(raw)) return [];
    const keys = new Set(Store.keys('lib'));
    return raw.slice(0, MAX_ENTRIES).filter(e => e && typeof e === 'object' && typeof e.key === 'string' && /^[a-z0-9-]{1,40}$/.test(e.key) && e.key !== INDEX && keys.has(e.key)
      && (e.kind === 'project' || e.kind === 'template') && typeof e.name === 'string' && e.name.length <= 200)
      .map(e => ({ key: e.key, kind: e.kind, name: e.name, emoji: typeof e.emoji === 'string' ? [...e.emoji].slice(0, 2).join('') : '📁',
        date: Number.isFinite(e.date) ? e.date : 0, tasks: Number.isInteger(e.tasks) && e.tasks >= 0 ? e.tasks : 0, enc: e.enc === true, withRes: e.withRes === true }));
  }
  const writeIndex = list => Store.write('lib', INDEX, JSON.stringify(list));

  /** Enregistre un texte (projet sérialisé) ; renvoie 'ok' | 'full' | 'off'. */
  async function put(entry, project, password) {
    const text = JSON.stringify(Model.serialize(project, { withVersions: entry.kind === 'project' }));
    const data = password ? JSON.stringify(await Secure.encrypt(text, password)) : text;
    const r = Store.write('lib', entry.key, data);
    if (r !== 'ok') return r;
    const list = index().filter(e => e.key !== entry.key);
    list.unshift({ ...entry, name: project.name, emoji: project.emoji, date: Date.now(), tasks: project.tasks.length, enc: !!password });
    const w = writeIndex(list);
    if (w !== 'ok') Store.remove('lib', entry.key);
    return w;
  }

  /** Relit une entrée → projet contrôlé (demande le mot de passe si besoin) ; null si abandon. */
  async function load(entry) {
    const text = Store.read('lib', entry.key);
    if (text === null) throw new Model.Invalid('lib.missing');
    let r = Model.parseFile(text);
    if (r.encrypted) {
      const pwd = await askPassword(t('pwd.openTitle'), t('lib.pwdHint', { name: entry.name }));
      if (pwd === null) return null;
      announce(t('pwd.working'));
      r = Model.parseFile(await Secure.decrypt(r.envelope, pwd));
    }
    return r.project;
  }

  function remove(key) { writeIndex(index().filter(e => e.key !== key)); Store.remove('lib', key); }
  function rename(key, name) { const list = index(); const e = list.find(x => x.key === key); if (e) { e.name = name; writeIndex(list); } }
  return { index, put, load, remove, rename };
})();

/** Message à la première écriture sur l'appareil (EX-22). Renvoie false si l'utilisateur renonce. */
async function storageNotice() {
  if (!Store.available()) { await Dialog.message(t('lib.title'), t('store.off')); return false; }
  if (Settings.get('noticed') === 'yes') return true;
  const v = await Dialog.open({ title: t('store.noticeTitle'), body: [t('store.notice1'), t('store.notice2'), t('store.notice3')].map(x => h('p', { text: x })),
    actions: [{ label: t('dlg.cancel'), value: 'cancel' }, { label: t('store.understood'), value: 'ok', kind: 'primary', focus: true }] });
  if (v !== 'ok') return false;
  Settings.set('noticed', 'yes');
  return true;
}

function storeFailed(r) {
  return Dialog.message(t('lib.title'), r === 'full' ? t('store.full') : t('store.off'));
}

/** Mot de passe facultatif pour un enregistrement : '' = sans, null = abandon. */
function protectFields(prefix) {
  const box = h('div', { class: 'pwd-box', hidden: true },
    h('div', { class: 'field' }, h('label', { for: prefix + '-pwd', text: t('pwd.label') }), h('input', { type: 'password', id: prefix + '-pwd', autocomplete: 'new-password', aria: { describedby: prefix + '-pwd-hint' } })),
    h('div', { class: 'field' }, h('label', { for: prefix + '-pwd2', text: t('pwd.confirm') }), h('input', { type: 'password', id: prefix + '-pwd2', autocomplete: 'new-password' })),
    h('p', { class: 'warning', id: prefix + '-pwd-hint', text: t('pwd.warn', { min: Secure.MIN_PASSWORD }) }));
  const chk = h('input', { type: 'checkbox', id: prefix + '-protect' });
  chk.addEventListener('change', () => { box.hidden = !chk.checked; if (chk.checked) $(prefix + '-pwd').focus(); });
  const nodes = [h('div', { class: 'field check' }, chk, h('label', { for: prefix + '-protect', text: t('exp.protect') })), box];
  const read = () => {
    if (!chk.checked) return { pwd: '' };
    const a = $(prefix + '-pwd').value, b = $(prefix + '-pwd2').value;
    if (!Secure.passwordOk(a)) return { err: t('pwd.short', { min: Secure.MIN_PASSWORD }), focus: prefix + '-pwd' };
    if (a !== b) return { err: t('pwd.mismatch'), focus: prefix + '-pwd2' };
    return { pwd: a };
  };
  return { nodes, read };
}

/** Enregistre le projet courant dans la bibliothèque (EF-99, Ctrl + S). */
async function saveToLibrary() {
  if (!(await storageNotice())) return;
  const existing = App.libKey && Library.index().find(e => e.key === App.libKey && e.kind === 'project');
  const prot = protectFields('lib');
  let pwd = '';
  const v = await Dialog.open({ title: t('lib.save'), body: [h('p', { text: existing ? t('lib.saveOver', { name: App.project.name }) : t('lib.saveNew', { name: App.project.name }) }),
    h('p', { class: 'field-error', id: 'lib-err', role: 'alert', hidden: true }), ...prot.nodes],
  actions: [{ label: t('dlg.cancel'), value: 'cancel' }, { label: t('lib.saveBtn'), value: 'ok', kind: 'primary', focus: true }],
  onAction: val => {
    if (val !== 'ok') return true;
    const r = prot.read();
    if (r.err) { const e = $('lib-err'); e.textContent = r.err; e.hidden = false; $(r.focus).focus(); return false; }
    pwd = r.pwd; return true;
  } });
  if (v !== 'ok') return;
  const key = existing ? existing.key : Tabs.newKey();
  if (pwd) announce(t('pwd.working'));
  const r = await Library.put({ key, kind: 'project' }, App.project, pwd);
  if (r !== 'ok') { await storeFailed(r); return; }
  App.libKey = key; App.dirty = false;
  if (typeof Recovery !== 'undefined') Recovery.clearCurrent();
  render();
  toast(t('lib.saved', { name: App.project.name }));
}

/* ── Modèles (EF-100) ─────────────────────────────────────────────────────────────────────── */
/** Projet → modèle : sans avancement, dates réelles, commentaires, baselines ni versions. */
function toTemplate(project, keepResources) {
  const p = clone(project);
  p.baselines = []; p.versions = [];
  for (const x of p.tasks) {
    x.pct = 0; x.realStart = ''; x.realEnd = ''; x.comments = [];
    if (!keepResources) x.assign = [];
  }
  if (!keepResources) p.resources = [];
  return p;
}

/** Modèles fournis (aucune donnée réelle), traduits dans la langue courante. */
function builtinTemplates() {
  const mk = (code, emoji, tasks) => ({ key: 'builtin-' + code, kind: 'template', builtin: true, name: t(`tpl.${code}.name`), emoji, tasks: tasks.length,
    build: start => Model.sanitize({ format: Model.FORMAT, name: t(`tpl.${code}.name`), emoji, projectStart: start, leveling: 'smooth',
      tasks: tasks.map(([id, dur, dep, type], i) => ({ id, name: t(`tpl.${code}.t${i + 1}`), dur, type: type || 'task', deps: dep ? [dep] : [] })) }).project });
  return [
    mk('phases', '🎯', [['A', 5], ['B', 10, 'A'], ['C', 20, 'B'], ['D', 5, 'C'], ['E', 1, 'D'], ['F', 0, 'E', 'milestone']]),
    mk('event', '🏆', [['A', 3], ['B', 5, 'A'], ['C', 10, 'B'], ['D', 7, 'B'], ['E', 1, 'C'], ['F', 2, 'E']]),
  ];
}

/** Décale les dates d'un modèle sur un nouveau début (dates imposées, « pas avant », échéances). */
function shiftTemplate(p, start) {
  const from = Dates.parse(p.projectStart), to = Dates.parse(start), d = to - from;
  const mv = s => (s ? Dates.toISO(Math.min(Dates.parse('2199-12-31'), Math.max(0, Dates.parse(s) + d))) : s);
  p.projectStart = start;
  for (const x of p.tasks) { x.forcedStart = mv(x.forcedStart); x.notBefore = mv(x.notBefore); x.deadline = mv(x.deadline); }
  for (const r of p.resources) r.absences = (r.absences || []).map(a => ({ ...a, from: mv(a.from), to: mv(a.to) }));
  return p;
}

async function saveAsTemplate() {
  if (!(await storageNotice())) return;
  const name = h('input', { type: 'text', id: 'tpl-name', maxlength: 60, value: App.project.name, required: true });
  const keep = h('input', { type: 'checkbox', id: 'tpl-res' });
  let opts = null;
  const v = await Dialog.open({ title: t('tpl.save'), body: [h('p', { text: t('tpl.saveHint') }), h('p', { class: 'field-error', id: 'tpl-err', role: 'alert', hidden: true }),
    h('div', { class: 'field' }, h('label', { for: 'tpl-name', text: t('tpl.name') }), name),
    h('div', { class: 'field check' }, keep, h('label', { for: 'tpl-res', text: t('tpl.keepRes') }))],
  actions: [{ label: t('dlg.cancel'), value: 'cancel' }, { label: t('tpl.saveBtn'), value: 'ok', kind: 'primary' }],
  onAction: val => {
    if (val !== 'ok') return true;
    const n = name.value.trim();
    if (!n) { const e = $('tpl-err'); e.textContent = t('tpl.needName'); e.hidden = false; name.focus(); return false; }
    opts = { name: n, keep: keep.checked }; return true;
  } });
  if (v !== 'ok') return;
  const p = toTemplate(App.project, opts.keep);
  p.name = opts.name;
  const r = await Library.put({ key: Tabs.newKey(), kind: 'template', withRes: opts.keep }, p, '');
  if (r !== 'ok') { await storeFailed(r); return; }
  toast(t('tpl.saved', { name: opts.name }));
}

/** Nouveau projet à partir d'un modèle : modèle, nom et date de début (EF-100). */
async function newFromTemplate() {
  const all = [...builtinTemplates(), ...Library.index().filter(e => e.kind === 'template')];
  const sel = h('select', { id: 'tpl-pick' }, all.map((e, i) => h('option', { value: i }, `${e.emoji} ${e.name} — ${t('lib.tasks', { count: e.tasks })}${e.builtin ? ` (${t('tpl.builtin')})` : ''}`)));
  const name = h('input', { type: 'text', id: 'tpl-pname', maxlength: 60, required: true });
  const start = h('input', { type: 'date', id: 'tpl-start', value: Dates.toISO(Dates.todayDn()), min: '1970-01-01', max: '2199-12-31', required: true });
  let chosen = null;
  const v = await Dialog.open({ title: t('tpl.newFrom'), body: [h('p', { class: 'field-error', id: 'tpl-err', role: 'alert', hidden: true }),
    h('div', { class: 'field' }, h('label', { for: 'tpl-pick', text: t('tpl.pick') }), sel),
    h('div', { class: 'field' }, h('label', { for: 'tpl-pname', text: t('f.name') }), name),
    h('div', { class: 'field' }, h('label', { for: 'tpl-start', text: t('top.start') }), start)],
  actions: [{ label: t('dlg.cancel'), value: 'cancel' }, { label: t('tpl.create'), value: 'ok', kind: 'primary' }],
  onAction: val => {
    if (val !== 'ok') return true;
    const err = (m, el) => { const e = $('tpl-err'); e.textContent = m; e.hidden = false; el.focus(); return false; };
    if (!name.value.trim()) return err(t('tpl.needName'), name);
    if (Dates.parse(start.value) == null) return err(t('rule.date'), start);
    chosen = { entry: all[Number(sel.value)], name: name.value.trim().slice(0, 60), start: start.value }; return true;
  } });
  if (v !== 'ok') return;
  let p;
  try {
    if (chosen.entry.builtin) p = chosen.entry.build(chosen.start);
    else { p = await Library.load(chosen.entry); if (!p) return; p = shiftTemplate(toTemplate(p, true), chosen.start); }
  } catch (e) { await Dialog.message(t('tpl.newFrom'), e instanceof Model.Invalid ? I18n.error(e) : t('imp.unreadable')); return; }
  p.name = chosen.name; p.id = 'P' + Date.now().toString(36); p.createdAt = Date.now();
  if (Tabs.pristine()) Tabs.replace(p, { dirty: true }); else if (!Tabs.open(p, { dirty: true })) return;
  announce(t('imp.opened', { name: p.name }));
}

/* ── Fenêtre Bibliothèque ─────────────────────────────────────────────────────────────────── */
async function openLibrary(focusSel) {
  const body = h('div', { id: 'lib-win' });
  const fmt = ms => (ms ? I18n.dateTime(ms) : '—');
  const paint = sel => {
    clear(body);
    const list = Library.index();
    body.append(h('p', { class: 'hint', text: t('lib.warn') }),
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'primary', id: 'lib-save', data: { dlg: 'save' } }, t('lib.saveCurrent')),
        h('button', { type: 'button', id: 'lib-tpl', data: { dlg: 'tpl' } }, t('tpl.save')),
        h('button', { type: 'button', id: 'lib-new', data: { dlg: 'newtpl' } }, t('tpl.newFrom'))));
    for (const kind of ['project', 'template']) {
      const rows = list.filter(e => e.kind === kind);
      body.append(h('h3', { text: t(kind === 'project' ? 'lib.projects' : 'lib.templates') }));
      if (!rows.length) { body.append(h('p', { class: 'hint', text: t('lib.empty') })); continue; }
      body.append(h('div', { class: 'table-scroll' }, h('table', { class: 'manage' },
        h('caption', { class: 'sr-only', text: t(kind === 'project' ? 'lib.projects' : 'lib.templates') }),
        h('thead', {}, h('tr', {}, ['lib.name', 'lib.date', 'lib.count', 'lib.actions'].map(k => h('th', { scope: 'col', text: t(k) })))),
        h('tbody', {}, rows.map(e => h('tr', {},
          h('th', { scope: 'row' }, `${e.emoji} ${e.name}`, e.enc ? h('span', { class: 'hint', text: ` 🔒 ${t('lib.protected')}` }) : null),
          h('td', { text: fmt(e.date) }), h('td', { text: String(e.tasks) }),
          h('td', { class: 'row-actions' },
            kind === 'project' ? h('button', { type: 'button', id: `lib-open-${e.key}`, data: { dlg: 'open:' + e.key }, aria: { label: t('lib.openOne', { name: e.name }) } }, t('lib.open')) : null,
            h('button', { type: 'button', id: `lib-ren-${e.key}`, data: { dlg: 'ren:' + e.key }, aria: { label: t('lib.renameOne', { name: e.name }) } }, t('lib.rename')),
            h('button', { type: 'button', id: `lib-dup-${e.key}`, data: { dlg: 'dup:' + e.key }, aria: { label: t('lib.duplicateOne', { name: e.name }) } }, t('lib.duplicate')),
            h('button', { type: 'button', class: 'danger', id: `lib-del-${e.key}`, data: { dlg: 'del:' + e.key }, aria: { label: t('lib.deleteOne', { name: e.name }) } }, t('lib.delete')))))))));
    }
    body.append(h('p', { class: 'hint', text: t('lib.usage', { size: I18n.number(Math.round(Store.usage() / 1024)) }) }));
    const el = sel && body.querySelector(sel);
    (el || $('lib-save')).focus();
  };
  // Boutons de la fenêtre : délégation sur data-dlg (aucun gestionnaire inline).
  body.addEventListener('click', async ev => {
    const b = ev.target.closest('button[data-dlg]');
    if (!b) return;
    const [cmd, key] = b.dataset.dlg.split(':');
    const entry = key && Library.index().find(e => e.key === key);
    if (cmd === 'save') { await saveToLibrary(); paint('#lib-save'); return; }
    if (cmd === 'tpl') { await saveAsTemplate(); paint('#lib-tpl'); return; }
    if (cmd === 'newtpl') { closeDlg(); await newFromTemplate(); return; }
    if (!entry) { paint(); return; }
    if (cmd === 'open') {
      let p;
      try { p = await Library.load(entry); } catch (e) { await Dialog.message(t('lib.title'), e instanceof Model.Invalid ? I18n.error(e) : t('imp.unreadable')); paint(); return; }
      if (!p) { paint(`#lib-open-${key}`); return; }
      closeDlg();
      if (Tabs.pristine()) Tabs.replace(p, { libKey: key }); else Tabs.open(p, { libKey: key });
      announce(t('imp.opened', { name: p.name }));
    } else if (cmd === 'ren') {
      const inp = h('input', { type: 'text', id: 'lib-newname', maxlength: 60, value: entry.name });
      let n = null;
      const v = await Dialog.open({ title: t('lib.rename'), body: [h('div', { class: 'field' }, h('label', { for: 'lib-newname', text: t('lib.name') }), inp)],
        actions: [{ label: t('dlg.cancel'), value: 'cancel' }, { label: t('dlg.ok'), value: 'ok', kind: 'primary' }], onAction: () => { n = inp.value.trim().slice(0, 60); return true; } });
      if (v === 'ok' && n) {
        // Le nom est aussi celui du projet enregistré : on le change dans le contenu s'il est lisible en clair.
        Library.rename(key, n);
        if (!entry.enc) { try { const r = Model.parseFile(Store.read('lib', key)); r.project.name = n; await Library.put(entry, r.project, ''); } catch { /* contenu illisible : sommaire seul */ } }
      }
      paint(`#lib-ren-${key}`);
    } else if (cmd === 'dup') {
      const text = Store.read('lib', key);
      const nk = Tabs.newKey();
      const r = text === null ? 'off' : Store.write('lib', nk, text);
      if (r !== 'ok') await storeFailed(r);
      else {
        const list = Library.index();
        list.unshift({ ...entry, key: nk, name: t('lib.copyOf', { name: entry.name }).slice(0, 60), date: Date.now() });
        const w = Store.write('lib', 'index', JSON.stringify(list));
        if (w !== 'ok') { Store.remove('lib', nk); await storeFailed(w); }
      }
      paint(`#lib-dup-${key}`);
    } else if (cmd === 'del') {
      if (await Dialog.confirm(t('lib.delete'), [t('lib.deleteConfirm', { name: entry.name })], t('lib.delete'))) {
        Library.remove(key);
        if (App.libKey === key) App.libKey = '';
        announce(t('lib.deleted', { name: entry.name }));
      }
      paint('#lib-save');
    }
  });
  let closeDlg = () => {};
  const p = Dialog.open({ title: t('lib.title'), body: [body], size: 'wide', actions: [{ label: t('dlg.close'), value: 'cancel' }] });
  const dlg = body.closest('dialog');
  closeDlg = () => { const c = dlg && dlg.querySelector('button[value="cancel"]'); if (c) c.click(); };
  paint(focusSel);
  await p;
}

action('openLibrary', () => openLibrary());
action('saveLibrary', () => saveToLibrary());
action('newFromTemplate', () => newFromTemplate());
