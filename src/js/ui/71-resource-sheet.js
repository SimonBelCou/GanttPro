/* Fiche de ressource (EF-26, EF-71) : avatar, rôle, capacité, absences, tâches et charge. */

const initials = name => name.split(/[\s'-]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';

function paintResourceSheet(body, id, focusSel) {
  clear(body);
  const r = resById(id);
  if (!r) return;
  const color = safeColor(r.color);
  const av = h('span', { class: 'avatar', aria: { hidden: 'true' }, text: initials(r.name) });
  av.style.setProperty('background', color); av.style.setProperty('color', inkOn(color));
  body.append(h('div', { class: 'res-head' }, av, h('div', {}, h('strong', { text: r.name }), r.role ? h('div', { class: 'hint', text: r.role }) : null)));
  body.append(h('p', { class: 'field-error', id: 'rs-err', role: 'alert', hidden: true }));
  body.append(h('div', { class: 'field' }, h('label', { for: 'rs-cap', text: t('res.capacity') }),
    h('input', { type: 'number', id: 'rs-cap', min: 1, max: 100, step: 1, inputmode: 'numeric', value: r.capacity, data: { change: 'rsCapacity', arg: id }, aria: { describedby: 'rs-err' } })));

  const abs = [...r.absences].map((a, i) => ({ ...a, i })).sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const absBox = h('fieldset', { class: 'sub' }, h('legend', { text: t('rs.absences') }));
  if (!abs.length) absBox.append(h('p', { class: 'hint', text: t('cal.none') }));
  else absBox.append(h('ul', { class: 'rows' }, abs.map(a => {
    const what = a.start === a.end ? I18n.date(Dates.parse(a.start)) : t('cal.range', { from: I18n.date(Dates.parse(a.start)), to: I18n.date(Dates.parse(a.end)) });
    return h('li', {}, h('span', { class: 'who', text: what + (a.label ? ` — ${a.label}` : '') }),
      h('button', { type: 'button', class: 'icon', data: { click: 'rsAbsRemove', arg: `${id}:${a.i}` }, aria: { label: t('f.remove', { name: what }) } }, '✕'));
  })));
  absBox.append(h('div', { class: 'add-row' },
    h('label', { for: 'rs-from', text: t('cal.from') }), h('input', { type: 'date', id: 'rs-from', min: '1970-01-01', max: '2199-12-31' }),
    h('label', { for: 'rs-to', text: t('cal.to') }), h('input', { type: 'date', id: 'rs-to', min: '1970-01-01', max: '2199-12-31' }),
    h('label', { for: 'rs-label', text: t('cal.label') }), h('input', { type: 'text', id: 'rs-label', maxlength: 100 }),
    h('button', { type: 'button', data: { click: 'rsAbsAdd', arg: id } }, t('rs.addAbsence'))));
  body.append(absBox);

  const tasks = App.project.tasks.filter(x => x.assign.some(a => a.res === id));
  let load = 0;
  const rows = tasks.map(x => {
    const a = x.assign.find(z => z.res === id), sr = App.sched && App.sched.tasks.get(x.id);
    load += x.dur * a.units / 100;
    return h('tr', {}, h('td', { class: 'id', text: x.id }), h('td', { text: x.name }), h('td', { text: `${a.units} %` }),
      h('td', { text: sr ? I18n.shortDate(sr.startDn) : '' }), h('td', { text: sr ? I18n.shortDate(sr.endDn) : '' }));
  });
  body.append(h('h3', { text: t('rs.tasks', { count: tasks.length }) }),
    h('p', { text: t('rs.load', { load: I18n.number(load, load % 1 ? 1 : 0) }) }),
    tasks.length ? h('table', { class: 'manage' }, h('thead', {}, h('tr', {}, [t('col.id'), t('col.name'), t('rs.units'), t('dash.pStart'), t('dash.pEnd')].map(x => h('th', { scope: 'col', text: x })))), h('tbody', {}, rows)) : null);
  const el = focusSel && body.querySelector(focusSel);
  if (el) el.focus();
}

function resourceSheet(id) {
  const r = resById(id);
  if (!r) return Promise.resolve();
  const body = h('div', { id: 'rs-win' });
  resourceSheet.body = body; resourceSheet.id = id;
  paintResourceSheet(body, id);
  return Dialog.open({ title: t('rs.title', { name: r.name }), body: [body], size: 'wide', actions: [{ label: t('dlg.close'), value: 'close', kind: 'primary' }] })
    .then(() => { resourceSheet.body = null; if (resourcesWindow.paint) resourcesWindow.paint(); });
}

function rsError(msg, focusId) { const e = $('rs-err'); e.textContent = msg; e.hidden = false; announce(msg); if (focusId) $(focusId).focus(); }

action('openResourceSheet', id => resourceSheet(id));
action('rsCapacity', (id, el) => {
  const n = Number(el.value);
  if (!Number.isInteger(n) || n < 1 || n > 100) return rsError(t('err.int', { field: t('res.capacity'), min: 1, max: 100 }), 'rs-cap');
  const over = App.project.tasks.find(x => x.assign.some(a => a.res === id && a.units > n));
  if (over) return rsError(t('rs.capTooLow', { task: `${over.id} ${over.name}`, units: over.assign.find(a => a.res === id).units }), 'rs-cap');
  commit(p => { p.resources.find(x => x.id === id).capacity = n; });
  paintResourceSheet(resourceSheet.body, id, '#rs-cap');
});
action('rsAbsAdd', id => {
  const from = $('rs-from').value, to = $('rs-to').value || from, label = $('rs-label').value.trim().slice(0, 100);
  if (Dates.parse(from) == null || Dates.parse(to) == null) return rsError(t('err.date', { field: t('cal.from') }), 'rs-from');
  if (to < from) return rsError(t('rs.order'), 'rs-to');
  const r = resById(id);
  if (r.absences.length >= Model.LIMITS.absences) return rsError(t('err.limit', { max: Model.LIMITS.absences, what: t('rs.absences').toLowerCase() }));
  const trial = clone(App.project);
  trial.resources.find(x => x.id === id).absences.push({ start: from, end: to, label });
  try { Schedule.compute(trial); } catch { return rsError(t('calc.error')); }
  commit(p => { p.resources.find(x => x.id === id).absences.push({ start: from, end: to, label }); });
  announce(t('rs.absAdded', { name: r.name }));
  paintResourceSheet(resourceSheet.body, id, '#rs-from');
});
action('rsAbsRemove', arg => {
  const [id, i] = arg.split(':');
  commit(p => { p.resources.find(x => x.id === id).absences.splice(Number(i), 1); });
  paintResourceSheet(resourceSheet.body, id, '#rs-from');
});
