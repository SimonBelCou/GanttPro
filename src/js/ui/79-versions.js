/* Versions (EF-54) : copies nommées et datées de l'état complet, dix au plus, enregistrées dans le
 * fichier exporté. Restaurer est confirmé et s'annule avec « Annuler » (un pas d'historique). */
function versionsWindow() {
  const body = h('div', { id: 'ver-win' });
  const paint = focusSel => {
    clear(body);
    const list = App.project.versions;
    body.append(h('p', { class: 'field-error', id: 'ver-err', role: 'alert', hidden: true }),
      h('div', { class: 'add-row' }, h('label', { for: 'ver-name', text: t('ver.name') }), h('input', { type: 'text', id: 'ver-name', maxlength: 100 }),
        h('button', { type: 'button', class: 'primary', data: { click: 'verSave' } }, t('ver.save'))));
    if (!list.length) body.append(h('p', { class: 'hint', text: t('ver.none') }));
    else body.append(h('table', { class: 'manage' },
      h('thead', {}, h('tr', {}, [t('res.name'), t('ver.date'), t('ver.tasks'), ''].map(x => h('th', { scope: 'col', text: x })))),
      h('tbody', {}, [...list].reverse().map(v => h('tr', {},
        h('td', { text: v.label }), h('td', { text: I18n.dateTime(v.ts) }), h('td', { text: String((v.state.tasks || []).length) }),
        h('td', {}, h('button', { type: 'button', data: { click: 'verRestore', arg: v.id } }, `${t('ver.restore')} ${v.label}`), ' ',
          h('button', { type: 'button', class: 'danger', data: { click: 'verDelete', arg: v.id } }, `${t('edit.delete')} ${v.label}`)))))));
    const el = focusSel && body.querySelector(focusSel);
    if (el) el.focus();
  };
  versionsWindow.paint = paint;
  paint('#ver-name');
  return Dialog.open({ title: t('top.versions'), body: [body], size: 'wide', actions: [{ label: t('dlg.close'), value: 'close' }] }).then(() => { versionsWindow.paint = null; });
}
action('openVersions', () => versionsWindow());
action('verSave', () => {
  const inp = $('ver-name'), err = $('ver-err');
  const label = inp.value.trim();
  if (!label || label.length > 100) { err.textContent = t('err.text', { field: t('ver.name'), min: 1, max: 100 }); err.hidden = false; inp.focus(); return; }
  if (App.project.versions.length >= Model.LIMITS.versions) { err.textContent = t('err.limit', { max: Model.LIMITS.versions, what: t('top.versions').toLowerCase() }); err.hidden = false; return; }
  const state = Model.serialize(App.project, { withVersions: false });
  let n = 1; while (App.project.versions.some(v => v.id === 'V' + n)) n++;
  commit(p => { p.versions.push({ id: 'V' + n, label, ts: Date.now(), state }); });
  announce(t('ver.saved', { name: label }));
  versionsWindow.paint && versionsWindow.paint('#ver-name');
});
action('verRestore', async id => {
  const v = App.project.versions.find(x => x.id === id);
  if (!v) return;
  if (!(await Dialog.confirm(t('ver.restoreQ', { name: v.label }), [t('ver.restoreHint')], t('ver.restore'), false))) return;
  let restored;
  try { restored = Model.sanitize(v.state, { nested: true }).project; } catch (e) { Dialog.message(t('top.versions'), e instanceof Model.Invalid ? I18n.error(e) : t('imp.unreadable')); return; }
  commit(p => {
    const keep = p.versions;
    for (const k of Object.keys(restored)) p[k] = restored[k];
    p.versions = keep;
  });
  Editor.close(); clearSelection();
  render();
  announce(t('ver.restored', { name: v.label }));
  versionsWindow.paint && versionsWindow.paint();
});
action('verDelete', async id => {
  const v = App.project.versions.find(x => x.id === id);
  if (!v || !(await Dialog.confirm(t('ver.deleteQ', { name: v.label }), [], t('edit.delete')))) return;
  commit(p => { p.versions = p.versions.filter(x => x.id !== id); });
  versionsWindow.paint && versionsWindow.paint();
});
