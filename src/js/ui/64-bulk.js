/* Actions groupées : dupliquer la sélection et modifier en masse (EF-82). Tout ou rien :
 * si une tâche refuse une valeur, rien n'est appliqué et le message liste les tâches en cause. */

action('duplicateSelection', () => {
  const ids = topSelected();
  if (!ids.length) return;
  const trial = clone(App.project);
  const created = [];
  for (const id of ids) { const c = duplicateBlock(trial, id); if (!c) { Dialog.message(t('edit.duplicate'), t('err.limit', { max: Model.LIMITS.tasks, what: 'tâches' })); return; } created.push(...c); }
  try { Schedule.compute(trial); } catch { announce(t('calc.error')); return; }
  commit(p => { for (const id of ids) duplicateBlock(p, id); });
  App.multi = new Set(created.filter(id => ids.some(o => taskById(o) && created.includes(id))));
  render();
  announce(t('dup.done', { count: created.length, ids: created.join(', ') }));
});

function bulkWindow() {
  const ids = selectedIds().filter(id => taskById(id).type !== 'summary');
  if (!ids.length) return;
  const p = App.project;
  const opt = (v, label) => h('option', { value: v }, label);
  const fld = (id, label, control) => { control.id = id; return h('div', { class: 'field' }, h('label', { for: id, text: label }), control); };
  const body = h('div', { id: 'bulk-win' },
    h('p', { class: 'hint', text: t('bulk.intro', { count: ids.length }) }),
    h('p', { class: 'field-error', id: 'bulk-err', role: 'alert', hidden: true }),
    fld('bk-cat', t('f.cat'), h('select', {}, opt('-', t('bulk.keep')), opt('', t('f.none')), p.categories.map(c => opt(c.id, c.name)))),
    h('fieldset', { class: 'sub' }, h('legend', { text: t('f.assign') }),
      fld('bk-res-mode', t('bulk.resMode'), h('select', {}, opt('', t('bulk.keep')), opt('add', t('bulk.resAdd')), opt('replace', t('bulk.resReplace')), opt('remove', t('bulk.resRemove')))),
      fld('bk-res', t('col.res'), h('select', {}, p.resources.map(r => opt(r.id, r.name)))),
      fld('bk-units', t('rs.units') + ' (%)', h('input', { type: 'number', min: 1, max: 100, step: 1, value: 100, inputmode: 'numeric' }))),
    fld('bk-pct', t('f.pct'), h('input', { type: 'number', min: 0, max: 100, step: 1, inputmode: 'numeric', placeholder: t('bulk.keepShort') })),
    fld('bk-tag-add', t('bulk.tagAdd'), h('input', { type: 'text', maxlength: 30 })),
    fld('bk-tag-remove', t('bulk.tagRemove'), h('input', { type: 'text', maxlength: 30 })),
    fld('bk-shift', t('bulk.shift'), h('input', { type: 'number', min: -365, max: 365, step: 1, inputmode: 'numeric', placeholder: '0' })),
    fld('bk-nb', t('f.notBefore'), h('input', { type: 'date', min: '1970-01-01', max: '2199-12-31' })),
    fld('bk-dl', t('f.deadline'), h('input', { type: 'date', min: '1970-01-01', max: '2199-12-31' })));
  return Dialog.open({
    title: t('sel.bulk'), body: [body], actions: [{ label: t('dlg.cancel'), value: 'cancel' }, { label: t('bulk.apply'), value: 'ok', kind: 'primary' }],
    onAction: v => {
      if (v !== 'ok') return true;
      const err = msg => { const e = $('bulk-err'); e.textContent = msg; e.hidden = false; announce(msg); return false; };
      const val = id => $(id).value;
      const cat = val('bk-cat'), mode = val('bk-res-mode'), res = val('bk-res'), units = Number(val('bk-units'));
      const pctRaw = val('bk-pct'), tagAdd = val('bk-tag-add').trim(), tagRm = val('bk-tag-remove').trim(), shiftRaw = val('bk-shift'), nb = val('bk-nb'), dl = val('bk-dl');
      if (pctRaw !== '' && !(Number.isInteger(Number(pctRaw)) && Number(pctRaw) >= 0 && Number(pctRaw) <= 100)) return err(t('err.int', { field: t('f.pct'), min: 0, max: 100 }));
      if (shiftRaw !== '' && !(Number.isInteger(Number(shiftRaw)) && Math.abs(Number(shiftRaw)) <= 365)) return err(t('err.int', { field: t('bulk.shift'), min: -365, max: 365 }));
      if (mode && mode !== 'remove' && !(Number.isInteger(units) && units >= 1 && units <= 100)) return err(t('err.int', { field: t('rs.units'), min: 1, max: 100 }));
      const refused = [];
      const apply = pr => {
        const r = pr.resources.find(x => x.id === res);
        for (const id of ids) {
          const x = pr.tasks.find(y => y.id === id);
          if (cat !== '-') x.cat = cat;
          if (mode && x.type === 'task' && r) {
            if (mode === 'remove') x.assign = x.assign.filter(a => a.res !== res);
            else {
              if (units > r.capacity) { refused.push(`${id} (${t('err.capacity', { field: r.name, name: r.name, cap: r.capacity })})`); continue; }
              if (mode === 'replace') x.assign = [{ res, units }];
              else if (!x.assign.some(a => a.res === res)) {
                if (x.assign.length >= Model.LIMITS.assign) { refused.push(`${id} (${t('err.limit', { max: Model.LIMITS.assign, what: t('f.assign').toLowerCase() })})`); continue; }
                x.assign.push({ res, units });
              }
            }
          }
          if (pctRaw !== '') {
            const n = Number(pctRaw);
            if (x.type === 'milestone') x.pct = n >= 100 ? 100 : 0; else { x.pct = n; if (n < 100) x.realEnd = ''; }
          }
          if (tagAdd && !x.tags.some(g => g.toLowerCase() === tagAdd.toLowerCase())) {
            if (x.tags.length >= Model.LIMITS.tags) { refused.push(`${id} (${t('err.limit', { max: Model.LIMITS.tags, what: t('view.f.tag').toLowerCase() })})`); continue; }
            x.tags.push(tagAdd);
          }
          if (tagRm) x.tags = x.tags.filter(g => g.toLowerCase() !== tagRm.toLowerCase());
          if (shiftRaw !== '' && Number(shiftRaw) && x.forcedStart) {
            const cal = App.sched.cal;
            x.forcedStart = Dates.toISO(cal.dnOf(cal.ceil(Dates.parse(x.forcedStart)) + Number(shiftRaw)));
          }
          if (nb) x.notBefore = nb;
          if (dl) x.deadline = dl;
        }
      };
      const trial = clone(App.project);
      apply(trial);
      if (refused.length) return err(t('bulk.refused', { list: refused.join(' ; ') }));
      try { Schedule.compute(trial); } catch { return err(t('calc.error')); }
      commit(apply);
      announce(t('bulk.done', { count: ids.length }));
      return true;
    },
  });
}
action('bulkEdit', () => bulkWindow());
