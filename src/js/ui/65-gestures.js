/* Gestes sur la grille (EF-74 à EF-77, EF-79, RG-29) : déplacer une barre (date imposée), tirer son
 * bord droit (durée), tirer d'une poignée de lien à une autre (lien typé), tirer l'avancement.
 * Souris : le geste démarre après 3 px ; doigt : appui long de 0,3 s. Échap annule. Un geste = un
 * pas d'annulation. Aucun geste n'est indispensable : édition et Alt + flèches font de même (EX-01). */
const Gesture = { g: null, suppressClick: false };

function toast(text, undoable) {
  const box = $('toast');
  clear(box);
  box.append(h('span', { text }));
  if (undoable) box.append(h('button', { type: 'button', data: { click: 'toastUndo' } }, t('top.undo')));
  box.hidden = false;
  announce(text);
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { box.hidden = true; }, 8000);
}
action('toastUndo', () => { $('toast').hidden = true; ACTIONS.undo(); });

function gestureTip(text, x, y) {
  const tip = $('tooltip');
  clear(tip); tip.append(h('div', { text })); tip.hidden = false;
  tip.style.setProperty('left', Math.min(window.innerWidth - 220, x + 12) + 'px');
  tip.style.setProperty('top', (y + 16) + 'px');
}

function endGesture(cancelled) {
  const g = Gesture.g;
  if (!g) return;
  Gesture.g = null;
  clearTimeout(g.timer);
  if (g.ghost) g.ghost.remove();
  if (g.line) g.line.remove();
  document.querySelectorAll('.lk.target').forEach(el => el.classList.remove('target'));
  document.body.classList.remove('dragging');
  $('tooltip').hidden = true;
  if (g.active) { Gesture.suppressClick = true; setTimeout(() => { Gesture.suppressClick = false; }, 0); }
  if (cancelled && g.active) announce(t('gst.cancelled'));
}

/** Poignées d'une barre ou d'un jalon (EF-74 à EF-77), ajoutées à la première approche. */
function ensureHandles(el) {
  if (!el || el.querySelector('.lk')) return;
  const span = cls => h('span', { class: cls, aria: { hidden: 'true' } });
  if (el.classList.contains('bar')) {
    const hp = span('h-pct');
    hp.style.setProperty('left', (Number(el.dataset.pct) || 0) + '%');
    el.append(span('h-end'), hp);
  }
  el.append(span('lk lk-s'), span('lk lk-e'));
}

function linkType(fromEnd, toEnd) { return fromEnd ? (toEnd ? 'FF' : 'FS') : (toEnd ? 'SF' : 'SS'); }

/** Contrôle d'un nouveau lien pred → succ (EF-76) ; renvoie un message d'erreur ou null. */
function linkError(predId, succId) {
  const pred = taskById(predId), succ = taskById(succId);
  if (!pred || !succ || predId === succId) return t('gst.linkSelf');
  if (pred.type === 'summary' || succ.type === 'summary') return t('gst.linkSummary');
  if (succ.deps.some(d => d.id === predId)) return t('gst.linkDup', { pred: predId, succ: succId });
  if (ancestorsOf(succId).includes(predId) || ancestorsOf(predId).includes(succId)) return t('sel.linkHierarchy', { a: predId, b: succId });
  const trial = App.project.tasks.map(x => (x.id === succId ? { ...x, deps: [...x.deps, { id: predId, type: 'FS', lag: 0 }] } : x));
  const cycle = Model.findCycle(trial);
  return cycle ? t('err.cycle', { path: cycle.join(' → ') }) : null;
}

function startGesture(g, ev) {
  g.active = true;
  document.body.classList.add('dragging');
  if (g.kind === 'link') {
    const layer = document.querySelector('.g-body');
    g.line = svg('svg', { class: 'g-drag', 'aria-hidden': 'true' }, svg('line', { x1: g.ox, y1: g.oy, x2: g.ox, y2: g.oy }));
    layer.append(g.line);
    for (const bar of document.querySelectorAll('#gantt .bar, #gantt .ms[data-arg]')) ensureHandles(bar);
    for (const el of document.querySelectorAll('#gantt .lk')) if (el.closest('[data-arg]').dataset.arg !== g.id) el.classList.add('target');
  } else {
    g.ghost = g.el.cloneNode(false);
    g.ghost.className = 'ghost';
    g.ghost.removeAttribute('role'); g.ghost.removeAttribute('tabindex'); g.ghost.removeAttribute('aria-label');
    for (const k of Object.keys(g.ghost.dataset)) delete g.ghost.dataset[k];
    g.ghost.setAttribute('aria-hidden', 'true');
    g.el.parentNode.append(g.ghost);
  }
  moveGesture(ev);
}

function moveGesture(ev) {
  const g = Gesture.g;
  if (!g || !g.active) return;
  const s = App.sched, cal = s.cal, dayW = App.grid.dayW;
  const dx = ev.clientX - g.x0, days = Math.round(dx / dayW);
  if (g.kind === 'move') {
    let dn = g.r.startDn + days;
    dn = cal.dnOf(cal.ceil(dn));
    g.value = Dates.toISO(dn);
    g.ghost.style.setProperty('left', (App.grid.pad + (dn - App.grid.from) * dayW + (g.task.type === 'milestone' ? dayW / 2 : 0)) + 'px');
    gestureTip(t('gst.moveTo', { date: I18n.date(dn) }), ev.clientX, ev.clientY);
  } else if (g.kind === 'resize') {
    const target = Math.max(g.r.startDn, g.r.endDn + days);
    const d = Math.min(Model.LIMITS.dur, Math.max(1, cal.count(g.r.startDn, target)));
    g.value = d;
    const endDn = cal.dnOf(g.r.s + d - 1);
    g.ghost.style.setProperty('width', Math.max(4, (endDn - g.r.startDn + 1) * dayW) + 'px');
    gestureTip(t('gst.dur', { count: d, date: I18n.date(endDn) }), ev.clientX, ev.clientY);
  } else if (g.kind === 'pct') {
    const rect = g.el.getBoundingClientRect();
    const raw = ((ev.clientX - rect.left) / rect.width) * 100;
    const step = ev.shiftKey ? 1 : 5;
    g.value = Math.max(0, Math.min(100, Math.round(raw / step) * step));
    g.ghost.classList.add('pct');
    g.ghost.style.setProperty('width', rect.width + 'px');
    g.ghost.style.setProperty('--pct', g.value + '%');
    gestureTip(t('gst.pct', { pct: g.value }), ev.clientX, ev.clientY);
  } else if (g.kind === 'link') {
    const layer = document.querySelector('.g-body').getBoundingClientRect();
    const line = g.line.firstChild;
    line.setAttribute('x2', ev.clientX - layer.left);
    line.setAttribute('y2', ev.clientY - layer.top);
    const over = document.elementFromPoint(ev.clientX, ev.clientY);
    const lk = over && over.closest && over.closest('.lk.target');
    g.drop = lk ? { id: lk.closest('[data-arg]').dataset.arg, end: lk.classList.contains('lk-e') } : null;
    gestureTip(g.drop ? t('gst.linkTo', { type: t('link.' + linkType(g.fromEnd, g.drop.end)), pred: g.id, succ: g.drop.id }) : t('gst.linkHint'), ev.clientX, ev.clientY);
  }
}

function finishGesture() {
  const g = Gesture.g;
  if (!g || !g.active || g.value === undefined && g.kind !== 'link') { endGesture(false); return; }
  const id = g.id;
  endGesture(false);
  if (g.kind === 'move') {
    const trial = clone(App.project); trial.tasks.find(x => x.id === id).forcedStart = g.value;
    try { Schedule.compute(trial); } catch { toast(t('calc.error')); return; }
    commit(p => { p.tasks.find(x => x.id === id).forcedStart = g.value; });
    toast(t('gst.moved', { id, date: I18n.shortDate(Dates.parse(g.value)) }), true);
  } else if (g.kind === 'resize') {
    if (g.value === g.task.dur) return;
    commit(p => { p.tasks.find(x => x.id === id).dur = g.value; });
    toast(t('gst.resized', { id, count: g.value }), true);
  } else if (g.kind === 'pct') {
    commit(p => { const x = p.tasks.find(y => y.id === id); x.pct = g.value; if (g.value < 100) x.realEnd = ''; });
    toast(t('gst.pctDone', { id, pct: g.value }), true);
  } else if (g.kind === 'link') {
    if (!g.drop) return;
    const err = linkError(id, g.drop.id);
    if (err) { toast(err); return; }
    const type = linkType(g.fromEnd, g.drop.end);
    commit(p => { p.tasks.find(x => x.id === g.drop.id).deps.push({ id, type, lag: 0 }); });
    toast(t('gst.linked', { type: t('link.' + type), pred: id, succ: g.drop.id }), true);
  }
}

function initGestures() {
  const grid = $('gantt');
  const handlesFor = ev => { const el = ev.target.closest && ev.target.closest('#gantt .bar, #gantt .ms[data-arg]'); if (el) ensureHandles(el); };
  grid.addEventListener('pointerover', handlesFor);
  grid.addEventListener('focusin', handlesFor);
  grid.addEventListener('pointerdown', ev => {
    if (ev.button !== 0 && ev.pointerType === 'mouse') return;
    const el = ev.target.closest('.bar, .ms[data-arg]');
    if (!el || !App.sched) return;
    const task = taskById(el.dataset.arg);
    if (!task || task.type === 'summary') return;
    const part = ev.target.closest('.h-end, .lk, .h-pct');
    const kind = !part ? 'move' : part.classList.contains('h-end') ? 'resize' : part.classList.contains('h-pct') ? 'pct' : 'link';
    if (App.zoom < 60 && kind !== 'link') { toast(t('gst.monthView')); return; }
    const body = document.querySelector('.g-body').getBoundingClientRect();
    const pr = (part || el).getBoundingClientRect();
    Gesture.g = { el, id: task.id, task, kind, r: App.sched.tasks.get(task.id), x0: ev.clientX, y0: ev.clientY, active: false,
      fromEnd: part ? part.classList.contains('lk-e') : false, ox: pr.left + pr.width / 2 - body.left, oy: pr.top + pr.height / 2 - body.top, pointerId: ev.pointerId };
    if (part) ev.preventDefault();
    if (ev.pointerType === 'touch') Gesture.g.timer = setTimeout(() => { if (Gesture.g) { el.setPointerCapture(ev.pointerId); startGesture(Gesture.g, ev); } }, 300);
  });
  document.addEventListener('pointermove', ev => {
    const g = Gesture.g;
    if (!g) return;
    if (!g.active) {
      const dist = Math.hypot(ev.clientX - g.x0, ev.clientY - g.y0);
      if (ev.pointerType === 'touch') { if (dist > 8) endGesture(true); return; }
      if (dist >= 3) { try { g.el.setPointerCapture(g.pointerId); } catch { /* déjà relâché */ } startGesture(g, ev); }
      return;
    }
    ev.preventDefault();
    moveGesture(ev);
  });
  document.addEventListener('pointerup', () => { if (Gesture.g) finishGesture(); });
  document.addEventListener('pointercancel', () => endGesture(true));
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && Gesture.g) { ev.preventDefault(); ev.stopPropagation(); endGesture(true); } }, true);
  // Un clic qui termine un geste ne sélectionne pas la tâche.
  document.addEventListener('click', ev => { if (Gesture.suppressClick) { ev.stopPropagation(); ev.preventDefault(); } }, true);
}
