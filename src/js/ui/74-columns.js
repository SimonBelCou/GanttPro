/* Fenêtre « Colonnes » (EF-143 à EF-146, RG-52, RG-53) : affiche, masque et ordonne les colonnes de la liste.
 * Le choix est enregistré dans le projet, annulable comme une modification ; l'identifiant et le nom sont obligatoires. */

const columnName = k => t('col.' + k);

function columnsWindow() {
  const body = h('div', { id: 'cols-win' });
  const paint = (focusSel) => {
    clear(body);
    const rows = Columns.layout(App.project);
    const nShown = rows.filter(r => r.shown).length;
    const tb = h('tbody');
    rows.forEach((r, i) => {
      const name = columnName(r.key), mandatory = Columns.MANDATORY.includes(r.key);
      const move = (delta, label, glyph) => h('button', { type: 'button', id: `col-${delta < 0 ? 'up' : 'down'}-${r.key}`, data: { click: 'colMove', arg: `${r.key}:${delta}` },
        disabled: !r.shown || (delta < 0 ? i === 0 : i >= nShown - 1), aria: { label: t(label, { name }) } }, glyph);
      tb.append(h('tr', {},
        h('td', {}, h('input', { type: 'checkbox', id: 'col-show-' + r.key, checked: r.shown, disabled: mandatory,
          aria: { label: t('cols.show', { name }) }, data: { change: 'colShow', arg: r.key } }),
          h('label', { for: 'col-show-' + r.key, text: ' ' + name }),
          mandatory ? h('span', { class: 'tag-pill', text: t('cols.mandatory') }) : null),
        h('td', { class: 'num', text: r.shown ? String(i + 1) : t('cols.hiddenCol') }),
        h('td', {}, move(-1, 'cols.up', '↑'), ' ', move(1, 'cols.down', '↓'))));
    });
    body.append(h('p', { class: 'hint', text: t('cols.hint') }),
      h('table', { class: 'manage', id: 'cols-table' },
        h('thead', {}, h('tr', {}, [t('cols.shown'), t('cols.order'), ''].map(x => h('th', { scope: 'col', text: x })))), tb),
      h('p', { class: 'hint', text: t('cols.resetHint') }),
      h('button', { type: 'button', id: 'col-reset', data: { click: 'colReset' } }, t('cols.reset')));
    if (focusSel) { const el = body.querySelector(focusSel); if (el) el.focus(); }
  };
  columnsWindow.paint = paint;
  paint();
  return Dialog.open({ title: t('cols.title'), body: [body], size: 'wide', actions: [{ label: t('dlg.close'), value: 'close' }] })
    .then(() => { columnsWindow.paint = null; });
}

action('openColumns', () => { columnsWindow(); });

action('colShow', (key, el) => {
  const next = Columns.toggle(Columns.effective(App.project), key, el.checked);
  if (!next) { if (columnsWindow.paint) columnsWindow.paint('#col-show-' + key); return; }
  commit(p => { p.columns = next; });
  announce(t(el.checked ? 'cols.shownDone' : 'cols.hiddenDone', { name: columnName(key) }));
  if (columnsWindow.paint) columnsWindow.paint('#col-show-' + key);
});

action('colMove', arg => {
  const [key, d] = arg.split(':');
  const list = Columns.effective(App.project);
  const next = Columns.move(list, key, Number(d));
  if (!next) return;
  commit(p => { p.columns = next; });
  announce(t('cols.moved', { name: columnName(key), pos: next.indexOf(key) + 1, total: next.length }));
  // Le focus reste sur le même bouton ; arrivé au bord, sur son contraire.
  const at = next.indexOf(key), stay = Number(d) < 0 ? (at === 0 ? 'down' : 'up') : (at === next.length - 1 ? 'up' : 'down');
  if (columnsWindow.paint) columnsWindow.paint('#col-' + stay + '-' + key);
});

action('colReset', () => {
  commit(p => { p.columns = null; });
  announce(t('cols.resetDone'));
  if (columnsWindow.paint) columnsWindow.paint('#col-reset');
});
