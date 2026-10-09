/* Calendrier du projet (EF-69, 3.9, RG-01, RG-02).
 * La fenêtre travaille sur un brouillon ; « Enregistrer » le contrôle avec les mêmes règles
 * qu'un import (Model.checkCalendar) puis l'applique en un seul pas d'annulation. */
const CalWin = { draft: null, month: null };

function calRangeList(kind) {
  const list = CalWin.draft[kind];
  const box = h('fieldset', { class: 'sub' }, h('legend', { text: t('cal.' + kind) }));
  if (!list.length) box.append(h('p', { class: 'hint', text: t('cal.none') }));
  else box.append(h('ul', { class: 'rows' }, list.map((r, i) => {
    const what = r.start === r.end ? I18n.date(Dates.parse(r.start)) : t('cal.range', { from: I18n.date(Dates.parse(r.start)), to: I18n.date(Dates.parse(r.end)) });
    return h('li', {}, h('span', { class: 'who', text: what + (r.label ? ` — ${r.label}` : '') }),
      h('button', { type: 'button', class: 'icon', data: { click: 'calRemove', arg: `${kind}:${i}` }, aria: { label: t('f.remove', { name: what }) } }, '✕'));
  })));
  const p = kind === 'daysOff' ? 'off' : 'wk';
  box.append(h('div', { class: 'add-row' },
    h('label', { for: `cal-${p}-from`, text: t('cal.from') }), h('input', { type: 'date', id: `cal-${p}-from`, min: '1970-01-01', max: '2199-12-31' }),
    h('label', { for: `cal-${p}-to`, text: t('cal.to') }), h('input', { type: 'date', id: `cal-${p}-to`, min: '1970-01-01', max: '2199-12-31' }),
    h('label', { for: `cal-${p}-label`, text: t('cal.label') }), h('input', { type: 'text', id: `cal-${p}-label`, maxlength: 100 }),
    h('button', { type: 'button', data: { click: 'calAdd', arg: kind } }, t(kind === 'daysOff' ? 'cal.addOff' : 'cal.addWorked'))));
  return box;
}

function calPreview() {
  let cal;
  try { cal = Calendar.create(CalWin.draft, App.project.projectStart); } catch { return h('p', { class: 'field-error', text: t('imp.noWorkday') }); }
  const first = CalWin.month, { y, m } = Dates.ymd(first);
  const start = Dates.mondayOf(first), last = Dates.monthEnd(first);
  const rows = [];
  for (let wk = start; wk <= last; wk += 7) {
    rows.push(h('tr', {}, [0, 1, 2, 3, 4, 5, 6].map(k => {
      const dn = wk + k;
      if (Dates.ymd(dn).m !== m) return h('td', { class: 'out' });
      const info = cal.dayInfo(dn);
      let cls = '', desc = '';
      if (!cal.isWork(dn)) { cls = 'off'; desc = t('cal.dayOff'); }
      if (info && info.kind === 'holiday') { cls = 'off holiday'; desc = t('cal.dayHoliday', { name: t(info.key) }); }
      if (info && info.kind === 'off') { cls = 'off holiday'; desc = t('cal.dayAdded', { name: info.label || '' }); }
      if (info && info.kind === 'weekend' && info.key) desc = t('cal.dayHoliday', { name: t(info.key) });
      if (info && info.kind === 'worked') { cls = 'worked'; desc = t('cal.dayWorked') + (info.label ? ` : ${info.label}` : ''); }
      return h('td', { class: cls, title: desc || undefined }, String(Dates.ymd(dn).d), desc ? h('span', { class: 'sr-only', text: ' ' + desc }) : null);
    })));
  }
  return h('div', { class: 'cal-preview' },
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'icon', data: { click: 'calMonth', arg: '-1' }, aria: { label: t('cal.prev') } }, '‹'),
      h('strong', { id: 'cal-month', text: `${I18n.monthName(m)} ${y}` }),
      h('button', { type: 'button', class: 'icon', data: { click: 'calMonth', arg: '1' }, aria: { label: t('cal.next') } }, '›')),
    h('table', { class: 'month', aria: { labelledby: 'cal-month' } },
      h('thead', {}, h('tr', {}, [0, 1, 2, 3, 4, 5, 6].map(k => h('th', { scope: 'col', text: I18n.dayName(k) })))),
      h('tbody', {}, rows)),
    h('p', { class: 'hint', text: t('cal.legend') }));
}

function paintCalendar(body, focusSel) {
  clear(body);
  const d = CalWin.draft;
  body.append(h('p', { class: 'field-error', id: 'cal-err', role: 'alert', hidden: true }));
  body.append(h('fieldset', { class: 'inline week' }, h('legend', { text: t('cal.week') }),
    [0, 1, 2, 3, 4, 5, 6].map(k => h('span', {},
      h('input', { type: 'checkbox', id: 'cal-wd-' + k, checked: d.workDays[k] === 1, data: { change: 'calWeekday', arg: String(k) } }),
      h('label', { for: 'cal-wd-' + k, text: ' ' + I18n.dayName(k) })))));
  body.append(h('div', { class: 'field' }, h('label', { for: 'cal-set', text: t('cal.holidays') }),
    h('select', { id: 'cal-set', data: { change: 'calSet' } }, Calendar.HOLIDAY_SETS.map(k => h('option', { value: k, selected: d.holidays === k }, t('cal.set.' + k))))));
  body.append(h('div', { class: 'cal-grid' }, h('div', {}, calRangeList('daysOff'), calRangeList('daysWorked')),
    h('section', { aria: { label: t('cal.preview') } }, h('h3', { text: t('cal.preview') }), calPreview())));
  const el = focusSel && body.querySelector(focusSel);
  if (el) el.focus();
}

function calError(msg) { const e = $('cal-err'); e.textContent = msg; e.hidden = false; announce(msg); }

function calendarWindow() {
  CalWin.draft = clone(App.project.calendar);
  CalWin.month = Dates.monthStart(App.sched ? App.sched.startDn : Dates.parse(App.project.projectStart));
  const body = h('div', { id: 'cal-win' });
  calendarWindow.body = body;
  paintCalendar(body);
  return Dialog.open({
    title: t('cal.title'), body: [body], size: 'wide',
    actions: [{ label: t('dlg.cancel'), value: 'cancel' }, { label: t('edit.save'), value: 'ok', kind: 'primary' }],
    onAction: v => {
      if (v !== 'ok') return true;
      let checked;
      try { checked = Model.checkCalendar(CalWin.draft); } catch (e) { if (e instanceof Model.Invalid) { calError(I18n.error(e)); return false; } throw e; }
      const trial = clone(App.project); trial.calendar = checked;
      try { Schedule.compute(trial); } catch { calError(t('calc.error')); return false; }
      commit(p => { p.calendar = checked; });
      announce(t('cal.saved'));
      return true;
    },
  }).then(() => { calendarWindow.body = null; CalWin.draft = null; });
}

const repaintCal = sel => calendarWindow.body && paintCalendar(calendarWindow.body, sel);
action('openCalendar', () => calendarWindow());
action('calWeekday', (arg, el) => { CalWin.draft.workDays[Number(arg)] = el.checked ? 1 : 0; repaintCal('#cal-wd-' + arg); });
action('calSet', (arg, el) => { if (Calendar.HOLIDAY_SETS.includes(el.value)) CalWin.draft.holidays = el.value; repaintCal('#cal-set'); });
action('calMonth', dir => {
  const { y, m } = Dates.ymd(CalWin.month);
  CalWin.month = Dates.fromYMD(y, m + Number(dir), 1);
  repaintCal(`[data-click="calMonth"][data-arg="${dir}"]`);
});
action('calRemove', arg => { const [kind, i] = arg.split(':'); CalWin.draft[kind].splice(Number(i), 1); repaintCal(`[data-click="calAdd"][data-arg="${kind}"]`); });
action('calAdd', kind => {
  const p = kind === 'daysOff' ? 'off' : 'wk';
  const from = $(`cal-${p}-from`).value, to = $(`cal-${p}-to`).value || from, label = $(`cal-${p}-label`).value.trim().slice(0, 100);
  if (Dates.parse(from) == null || Dates.parse(to) == null) { calError(t('err.date', { field: t('cal.from') })); $(`cal-${p}-from`).focus(); return; }
  if (to < from) { calError(t('imp.rangeOrder', { obj: t('cal.' + kind), n: CalWin.draft[kind].length + 1 })); $(`cal-${p}-to`).focus(); return; }
  CalWin.draft[kind].push({ start: from, end: to, label });
  CalWin.draft[kind].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  CalWin.month = Dates.monthStart(Dates.parse(from));
  repaintCal(`#cal-${p}-from`);
});
