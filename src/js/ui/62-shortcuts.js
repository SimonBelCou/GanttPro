/* Dupliquer (EF-80) et équivalents clavier des gestes (EF-78). Chaque action = un pas d'annulation. */

/** Copie d'une tâche (et de sa descendance) juste sous l'original ; liens internes rattachés aux copies. */
function duplicateBlock(p, id) {
  const src = p.tasks.find(x => x.id === id);
  if (!src) return [];
  const block = [src, ...descendants(id, p.tasks)];
  if (p.tasks.length + block.length > Model.LIMITS.tasks) return null;
  const used = p.tasks.map(x => x.id), map = new Map();
  for (const x of block) { const nid = Model.nextTaskId(used); used.push(nid); map.set(x.id, nid); }
  const suffix = t('dup.suffix');
  const copies = block.map(x => ({
    ...clone(x), id: map.get(x.id), name: (x.name.slice(0, 200 - suffix.length) + (x === src ? suffix : '')),
    parent: x === src ? x.parent : map.get(x.parent), pct: 0, realStart: '', realEnd: '', comments: [],
    deps: x.deps.map(d => ({ ...d, id: map.get(d.id) || d.id })),
  }));
  const last = block[block.length - 1];
  p.tasks.splice(p.tasks.indexOf(last) + 1, 0, ...copies);
  return copies.map(c => c.id);
}

action('duplicateTask', () => {
  const id = App.selected;
  if (!taskById(id)) return;
  let ids = null;
  const trial = clone(App.project);
  ids = duplicateBlock(trial, id);
  if (!ids) { Dialog.message(t('edit.duplicate'), t('err.limit', { max: Model.LIMITS.tasks, what: 'tâches' })); return; }
  try { Schedule.compute(trial); } catch { announce(t('calc.error')); return; }
  commit(p => { duplicateBlock(p, id); });
  Editor.close();
  App.selected = ids[0];
  render();
  announce(t('dup.done', { count: ids.length, ids: ids.join(', ') }));
  const btn = document.querySelector(`button.select[data-arg="${CSS.escape(ids[0])}"]`);
  if (btn) btn.focus();
});

/** Alt + ←/→ : date imposée d'un jour ouvré ; Alt + Maj + ←/→ : durée d'un jour (EF-78). */
function nudge(dir, duration) {
  const task = taskById(App.selected);
  if (!task || !App.sched) return;
  if (task.type === 'summary') { announce(t('kb.notTask')); return; }
  const r = App.sched.tasks.get(task.id), cal = App.sched.cal;
  if (duration) {
    if (task.type !== 'task') { announce(t('kb.notTask')); return; }
    const d = Math.min(Model.LIMITS.dur, Math.max(1, task.dur + dir));
    if (d === task.dur) return;
    commit(p => { p.tasks.find(x => x.id === task.id).dur = d; });
    announce(t('kb.dur', { count: d }));
  } else {
    const iso = Dates.toISO(cal.dnOf(r.s + dir));
    const trial = clone(App.project); trial.tasks.find(x => x.id === task.id).forcedStart = iso;
    try { Schedule.compute(trial); } catch { announce(t('calc.error')); return; }
    commit(p => { p.tasks.find(x => x.id === task.id).forcedStart = iso; });
    announce(t('kb.forced', { date: I18n.date(Dates.parse(iso)) }));
  }
}

function initShortcuts() {
  document.addEventListener('keydown', ev => {
    if (document.querySelector('dialog[open]')) return;
    const inField = ev.target.closest && ev.target.closest('input, textarea, select, [contenteditable]');
    if (inField) return;
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && ev.key.toLowerCase() === 'd' && App.selected) { ev.preventDefault(); ACTIONS.duplicateTask(); }
    if (ev.altKey && !ev.ctrlKey && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') && App.selected) {
      ev.preventDefault();
      nudge(ev.key === 'ArrowRight' ? 1 : -1, ev.shiftKey);
    }
  });
}
