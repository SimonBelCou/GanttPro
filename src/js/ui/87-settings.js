/* Réglages (EF-104), aide et à propos (EF-57, EF-58) et page d'accueil facultative (EF-56). */
const APP_VERSION = '3.0.0';

function setLanguage(next) {
  if (!['fr', 'en'].includes(next) || next === I18n.getLang()) return;
  Settings.set('lang', next);
  I18n.setLang(next);
  render();
  Recovery.paint();
  if (Editor.isOpen()) Editor.open(App.selected);
}

/** Activation de la sauvegarde automatique : message sur ce qui est conservé, où, et le risque. */
async function enableAutosave() {
  if (!Store.available()) { await Dialog.message(t('auto.title'), t('store.off')); return false; }
  const ok = await Dialog.confirm(t('auto.enableTitle'), [t('auto.enable1'), t('auto.enable2'), t('auto.enable3')], t('auto.enableBtn'), false);
  if (!ok) return false;
  Settings.set('noticed', 'yes');
  Settings.set('autosave', 'on');
  Recovery.touch();
  if (App.dirty) Recovery.saveNow();
  return true;
}

async function openSettings() {
  const body = h('div', { id: 'set-win' });
  const paint = focusId => {
    clear(body);
    const auto = Recovery.enabled();
    body.append(
      h('div', { class: 'field' }, h('label', { for: 'set-lang', text: t('set.lang') }),
        h('select', { id: 'set-lang' }, [['fr', 'Français'], ['en', 'English']].map(([v, l]) => h('option', { value: v, selected: I18n.getLang() === v, lang: v }, l)))),
      h('div', { class: 'field' }, h('label', { for: 'set-theme', text: t('set.theme') }),
        h('select', { id: 'set-theme' }, ['system', 'light', 'dark'].map(v => h('option', { value: v, selected: (Settings.get('theme') || 'system') === v }, t('theme.' + v))))),
      h('fieldset', { class: 'sub' }, h('legend', { text: t('auto.title') }),
        h('div', { class: 'field check' }, h('input', { type: 'checkbox', id: 'set-auto', checked: auto, aria: { describedby: 'set-auto-hint' } }), h('label', { for: 'set-auto', text: t('set.autosave') })),
        h('p', { class: 'hint', id: 'set-auto-hint', text: t('set.autosaveHint') }),
        auto ? h('div', { class: 'field check' }, h('input', { type: 'checkbox', id: 'set-recprot', checked: Recovery.protectedMode() }), h('label', { for: 'set-recprot', text: t('set.recProtect') })) : null,
        auto && Recovery.paused() ? h('div', {}, h('p', { class: 'warning', text: t('auto.paused') }),
          h('button', { type: 'button', id: 'set-recpwd' }, t('set.recPwdEnter'))) : null),
      h('fieldset', { class: 'sub' }, h('legend', { text: t('set.data') }),
        h('p', { text: t('lib.usage', { size: I18n.number(Math.round(Store.usage() / 1024)) }) }),
        h('p', { class: 'hint', text: t('set.dataHint') }),
        h('button', { type: 'button', class: 'danger', id: 'set-clear' }, t('set.clearAll'))));
    const el = focusId && $(focusId);
    (el || $('set-lang')).focus();
  };
  const askNewPassword = async () => {
    const prot = protectFields('rec');
    prot.nodes[0].querySelector('input').checked = true; prot.nodes[1].hidden = false;
    let pwd = null;
    const v = await Dialog.open({ title: t('set.recProtect'), body: [h('p', { class: 'field-error', id: 'recset-err', role: 'alert', hidden: true }), prot.nodes[1]],
      actions: [{ label: t('dlg.cancel'), value: 'cancel' }, { label: t('dlg.ok'), value: 'ok', kind: 'primary' }],
      onAction: val => {
        if (val !== 'ok') return true;
        const r = prot.read();
        if (r.err) { const e = $('recset-err'); e.textContent = r.err; e.hidden = false; $(r.focus).focus(); return false; }
        pwd = r.pwd; return true;
      } });
    return v === 'ok' ? pwd : null;
  };
  body.addEventListener('change', async ev => {
    const id = ev.target.id;
    if (id === 'set-lang') { setLanguage(ev.target.value); closeDlg(); openSettings(); return; }
    if (id === 'set-theme') { Settings.set('theme', ev.target.value); applyTheme(); render(); return; }
    if (id === 'set-auto') {
      if (ev.target.checked) { if (!(await enableAutosave())) ev.target.checked = false; }
      else { Settings.set('autosave', 'off'); Settings.set('recprotect', 'off'); Recovery.stop(); Recovery.clearAllCopies(); announce(t('auto.disabled')); }
      Recovery.paint(); paint('set-auto'); return;
    }
    if (id === 'set-recprot') {
      if (ev.target.checked) {
        const pwd = await askNewPassword();
        if (pwd) { Settings.set('recprotect', 'on'); Recovery.clearAllCopies(); Recovery.setPassword(pwd); Recovery.saveNow(); }
      } else { Settings.set('recprotect', 'off'); Recovery.clearAllCopies(); Recovery.setPassword(null); Recovery.saveNow(); }
      paint('set-recprot');
    }
  });
  body.addEventListener('click', async ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.id === 'set-recpwd') {
      const pwd = await askPassword(t('set.recProtect'), t('set.recPwdHint'));
      if (pwd && Secure.passwordOk(pwd)) { Recovery.setPassword(pwd); Recovery.saveNow(); }
      paint('set-auto');
    } else if (b.id === 'set-clear') {
      if (!(await Dialog.confirm(t('set.clearAll'), [t('set.clearConfirm1'), t('set.clearConfirm2')], t('set.clearBtn')))) { paint('set-clear'); return; }
      Recovery.stop();
      Settings.clearAll();
      for (const k of Store.keys('rec')) Store.remove('rec', k);
      App.libKey = '';
      applyTheme();
      Recovery.paint(); render();
      announce(t('set.cleared'));
      paint('set-clear');
    }
  });
  let closeDlg = () => {};
  const p = Dialog.open({ title: t('set.title'), body: [body], actions: [{ label: t('dlg.close'), value: 'cancel' }] });
  const dlg = body.closest('dialog');
  closeDlg = () => { const c = dlg && dlg.querySelector('button[value="cancel"]'); if (c) c.click(); };
  paint();
  await p;
}

/* ── Aide, à propos et déclaration d'accessibilité (EF-57, EF-58, EX-05, EX-09) ─────────── */
function openHelp() {
  const sec = (key, ...nodes) => h('section', { class: 'help-sec', aria: { labelledby: 'help-' + key } }, h('h3', { id: 'help-' + key, text: t('help.' + key) }), ...nodes);
  const para = keys => keys.map(k => h('p', { text: t(k) }));
  const KEYS = [['↑ / ↓', 'help.k.move'], ['Entrée / Enter', 'help.k.edit'], ['Maj + clic, Ctrl + clic', 'help.k.multi'], ['Ctrl + A', 'help.k.all'],
    ['Suppr / Delete', 'help.k.del'], ['Échap / Esc', 'help.k.esc'], ['Ctrl + Z, Ctrl + Y', 'help.k.undo'], ['Ctrl + C, Ctrl + V', 'help.k.copy'],
    ['Ctrl + D', 'help.k.dup'], ['Alt + ← / →', 'help.k.nudge'], ['Alt + Maj + ← / →', 'help.k.nudgeDur'], ['Ctrl + Maj + → / ←', 'help.k.indent'], ['/', 'help.k.search'], ['Ctrl + S', 'help.k.save'],
    ['+ / − (Gantt)', 'help.k.zoom'], ['?', 'help.k.help']];
  const body = h('div', { id: 'help-win', class: 'help', tabindex: '-1', autofocus: true },
    sec('about', h('p', { class: 'strong', text: t('help.version', { version: APP_VERSION }) }), ...para(['help.license', 'help.fonts']),
      h('details', { class: 'ofl' }, h('summary', { text: t('help.oflShow') }), h('pre', { lang: 'en', text: OFL_TEXT }))),
    sec('start', h('ol', {}, ['help.s1', 'help.s2', 'help.s3', 'help.s4', 'help.s5', 'help.s6'].map(k => h('li', { text: t(k) })))),
    sec('keys', h('p', { class: 'hint', text: t('help.keysHint') }), h('table', { class: 'manage' },
      h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: t('help.key') }), h('th', { scope: 'col', text: t('help.action') }))),
      h('tbody', {}, KEYS.map(([k, d]) => h('tr', {}, h('th', { scope: 'row' }, h('kbd', { text: k })), h('td', { text: t(d) })))))),
    sec('privacy', ...para(['help.p1', 'help.p2', 'help.p3', 'help.p4'])),
    sec('a11y', ...para(['help.a1', 'help.a2', 'help.a3', 'help.a4'])));
  return Dialog.open({ title: t('help.title'), body: [body], size: 'wide', actions: [{ label: t('dlg.close'), value: 'cancel' }] });
}

/* ── Page d'accueil facultative (EF-56, 8.4) ──────────────────────────────────────────────── */
const Home = { url: null };

/** Au lancement : projet transmis (contrôlé comme un import) et adresse de retour validée. */
async function initHome() {
  Home.url = HomeLink.homeUrl();
  $('btn-home').hidden = !Home.url;
  $('btn-homesave').hidden = !Home.url;
  const raw = HomeLink.takeProject();
  if (raw === null) return;
  try {
    const r = Model.parseFile(raw);
    if (r.encrypted) throw new Model.Invalid('imp.unreadable');
    Tabs.replace(r.project, { dirty: false });
    announce(t('imp.opened', { name: r.project.name }));
  } catch (e) {
    await Dialog.message(t('top.import'), e instanceof Model.Invalid ? I18n.error(e) : t('imp.unreadable'));
  }
}

function homeSave() {
  const r = HomeLink.saveProject(JSON.stringify(Model.serialize(App.project, { withVersions: true })));
  if (r !== 'ok') { Dialog.message(t('home.save'), r === 'full' ? t('store.full') : t('store.off')); return false; }
  App.dirty = false;
  Recovery.clearCurrent();
  render();
  toast(t('home.saved'));
  return true;
}

action('homeSave', () => homeSave());
action('goHome', () => {
  if (!Home.url || !homeSave()) return;
  window.location.assign(Home.url); // adresse déjà validée : même origine, http(s) ou file
});
action('openSettings', () => openSettings());
action('openHelp', () => openHelp());
