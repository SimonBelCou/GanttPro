/* Panneau d'édition d'une tâche (EF-04 à EF-08, EF-19, EF-20, EF-60, EF-65 à EF-68).
 * Rien n'est appliqué avant « Enregistrer » : le formulaire travaille sur un brouillon.
 * Chaque champ refusé affiche un message précis sous lui, annoncé, et reçoit le focus (EX-06). */
const Editor = (() => {
  let draft = null;     // copie de la tâche en cours d'édition
  let originalId = null;

  const field = (name, label, control, hint) => {
    const id = 'f-' + name;
    control.id = id;
    control.name = name;
    const err = h('p', { class: 'field-error', id: id + '-err', hidden: true });
    control.setAttribute('aria-describedby', id + '-err');
    return h('div', { class: 'field', data: { field: name } }, h('label', { for: id, text: label }), control, hint ? h('p', { class: 'hint', text: hint }) : null, err);
  };
  const input = (type, value, attrs = {}) => h('input', { type, value: value ?? '', ...attrs });
  const select = (options, value) => h('select', {}, options.map(([v, label]) => h('option', { value: v, selected: v === value }, label)));

  function eligiblePreds() {
    const banned = new Set([originalId, ...descendants(originalId).map(t => t.id), ...ancestorsOf(originalId)]);
    return App.project.tasks.filter(t => t.type !== 'summary' && !banned.has(t.id) && !draft.deps.some(d => d.id === t.id));
  }

  function depsEditor() {
    const box = h('fieldset', { class: 'sub', id: 'deps-box' }, h('legend', { text: t('f.deps') }));
    const list = h('ul', { class: 'rows' });
    draft.deps.forEach((d, i) => {
      const other = taskById(d.id);
      const type = select(Model.LINK_TYPES.map(k => [k, t('link.' + k)]), d.type);
      type.setAttribute('aria-label', t('f.linkType', { id: d.id }));
      type.dataset.change = 'draftDep'; type.dataset.arg = i + ':type';
      const lag = input('number', d.lag, { min: -Model.LIMITS.lag, max: Model.LIMITS.lag, step: 1, inputmode: 'numeric', aria: { label: t('f.lag', { id: d.id }) } });
      lag.dataset.change = 'draftDep'; lag.dataset.arg = i + ':lag';
      list.append(h('li', {}, h('span', { class: 'who', text: `${d.id} ${other ? other.name : ''}` }), type, lag,
        h('button', { type: 'button', class: 'icon', data: { click: 'draftRemoveDep', arg: String(i) }, aria: { label: t('f.remove', { name: d.id }) } }, '✕')));
    });
    box.append(list);
    const opts = eligiblePreds();
    if (opts.length && draft.deps.length < Model.LIMITS.deps) {
      const pick = select([['', t('f.depPick')], ...opts.map(o => [o.id, `${o.id} ${o.name}`])], '');
      pick.id = 'dep-pick';
      pick.setAttribute('aria-label', t('f.depPick'));
      box.append(h('div', { class: 'add-row' }, pick, h('button', { type: 'button', data: { click: 'draftAddDep' } }, t('f.addDep'))));
    }
    box.append(h('p', { class: 'field-error', id: 'deps-err', hidden: true, role: 'alert' }));
    return box;
  }

  function assignEditor() {
    const box = h('fieldset', { class: 'sub', id: 'assign-box' }, h('legend', { text: t('f.assign') }));
    const list = h('ul', { class: 'rows' });
    draft.assign.forEach((a, i) => {
      const r = resById(a.res);
      const units = input('number', a.units, { min: 1, max: r ? r.capacity : 100, step: 1, inputmode: 'numeric', aria: { label: t('f.units', { name: r ? r.name : '' }) } });
      units.dataset.change = 'draftUnits'; units.dataset.arg = String(i);
      list.append(h('li', {}, h('span', { class: 'who', text: r ? r.name : '' }), units,
        h('button', { type: 'button', class: 'icon', data: { click: 'draftRemoveAssign', arg: String(i) }, aria: { label: t('f.remove', { name: r ? r.name : '' }) } }, '✕')));
    });
    box.append(list);
    const free = App.project.resources.filter(r => !draft.assign.some(a => a.res === r.id));
    if (free.length && draft.assign.length < Model.LIMITS.assign) {
      const pick = select([['', t('f.resPick')], ...free.map(r => [r.id, r.name])], '');
      pick.id = 'res-pick';
      pick.setAttribute('aria-label', t('f.resPick'));
      box.append(h('div', { class: 'add-row' }, pick, h('button', { type: 'button', data: { click: 'draftAddAssign' } }, t('f.addAssign'))));
    }
    box.append(h('p', { class: 'field-error', id: 'assign-err', hidden: true, role: 'alert' }));
    return box;
  }

  function build() {
    const box = clear($('edit-fields'));
    const d = draft;
    $('editor-title').textContent = t('edit.title', { id: originalId });
    const idIn = input('text', d.id, { maxlength: 12, autocomplete: 'off', spellcheck: 'false', class: 'upper', required: true });
    idIn.dataset.input = 'upperCase';
    box.append(field('id', t('f.id'), idIn));
    box.append(field('name', t('f.name'), input('text', d.name, { maxlength: 200, required: true })));
    if (d.type !== 'summary') {
      const typeSel = select([['task', t('type.task')], ['milestone', t('type.milestone')]], d.type);
      typeSel.dataset.change = 'draftType';
      box.append(field('type', t('f.type'), typeSel));
    }
    const banned = new Set([originalId, ...descendants(originalId).map(x => x.id)]);
    const parents = App.project.tasks.filter(x => x.type === 'summary' && !banned.has(x.id));
    box.append(field('parent', t('f.parent'), select([['', t('f.none')], ...parents.map(p => [p.id, `${p.id} ${p.name}`])], d.parent)));
    if (d.type === 'task') box.append(field('dur', t('f.dur'), input('number', d.durRaw ?? d.dur, { min: 1, max: Model.LIMITS.dur, step: 1, inputmode: 'numeric', required: true })));
    if (d.type !== 'summary') {
      box.append(depsEditor());
      if (d.type === 'task') box.append(assignEditor());
      box.append(field('cat', t('f.cat'), select([['', t('f.none')], ...App.project.categories.map(c => [c.id, c.name])], d.cat)));
    }
    if (d.type === 'task') {
      box.append(field('pct', t('f.pct'), input('number', d.pctRaw ?? d.pct, { min: 0, max: 100, step: 1, inputmode: 'numeric' })));
    } else if (d.type === 'milestone') {
      const cb = input('checkbox', '', { checked: d.pct >= 100 });
      box.append(h('div', { class: 'field check' }, cb, h('label', { for: 'f-reached', text: t('f.reached') })));
      cb.id = 'f-reached'; cb.name = 'reached';
    }
    if (d.type !== 'summary') {
      box.append(field('forcedStart', t('f.forced'), input('date', d.forcedStart, { min: '1970-01-01', max: '2199-12-31' })));
      box.append(field('notBefore', t('f.notBefore'), input('date', d.notBefore, { min: '1970-01-01', max: '2199-12-31' })));
      box.append(field('deadline', t('f.deadline'), input('date', d.deadline, { min: '1970-01-01', max: '2199-12-31' })));
    }
    if (d.type === 'task') {
      box.append(field('realStart', t('f.realStart'), input('date', d.realStart, { min: '1970-01-01', max: '2199-12-31' })));
      box.append(field('realEnd', t('f.realEnd'), input('date', d.realEnd, { min: '1970-01-01', max: '2199-12-31' })));
    }
    box.append(field('tags', t('f.tags'), input('text', d.tagsRaw ?? d.tags.join(', '), { maxlength: 400 })));
    box.append(field('notes', t('f.notes'), h('textarea', { rows: 3, maxlength: 2000, text: d.notes })));
  }

  /** Relit les champs simples du formulaire dans le brouillon (sans valider). */
  function readForm() {
    const f = $('edit-form').elements;
    const val = n => (f[n] ? f[n].value : undefined);
    const d = draft;
    d.id = (val('id') || '').trim().toUpperCase();
    d.name = (val('name') || '').trim();
    if (f.parent) d.parent = val('parent');
    if (f.dur) d.durRaw = val('dur');
    if (f.cat) d.cat = val('cat');
    if (f.pct) d.pctRaw = val('pct');
    if (f.reached) d.pct = f.reached.checked ? 100 : 0;
    for (const k of ['forcedStart', 'notBefore', 'deadline', 'realStart', 'realEnd']) if (f[k]) d[k] = val(k);
    d.tagsRaw = val('tags') || '';
    d.notes = val('notes') || '';
  }

  function open(id) {
    const task = taskById(id);
    if (!task) return;
    originalId = id;
    draft = clone(task);
    App.selected = id;
    $('editor').hidden = false;
    build();
    render();
    $('f-name').focus();
  }

  function close() {
    $('editor').hidden = true;
    draft = null;
    const sel = App.selected && document.querySelector(`button.select[data-arg="${CSS.escape(App.selected)}"]`);
    if (sel) sel.focus();
  }

  function showErrors(errors) {
    for (const el of document.querySelectorAll('#editor .field-error')) { el.hidden = true; el.textContent = ''; }
    for (const el of document.querySelectorAll('#editor [aria-invalid]')) el.removeAttribute('aria-invalid');
    let first = null;
    for (const [name, msg] of Object.entries(errors)) {
      const ctl = $('f-' + name) || $(name + '-box');
      const err = $('f-' + name + '-err') || $(name + '-err');
      if (err) { err.textContent = msg; err.hidden = false; }
      if (ctl && ctl.tagName !== 'FIELDSET') ctl.setAttribute('aria-invalid', 'true');
      if (!first) first = ctl;
    }
    if (first) { (first.tagName === 'FIELDSET' ? first.querySelector('select, input, button') || first : first).focus(); announce(Object.values(errors)[0]); }
  }

  function intIn(raw, min, max) { const n = Number(raw); return raw !== '' && Number.isInteger(n) && n >= min && n <= max ? n : null; }

  function validate() {
    readForm();
    const d = draft, e = {};
    if (!Model.ID_RE.test(d.id)) e.id = t('err.idFormat', { field: t('f.id') });
    else if (d.id !== originalId && taskById(d.id)) e.id = t('err.idTaken', { field: t('f.id'), id: d.id });
    if (!d.name) e.name = t('err.required', { field: t('f.name') });
    if (d.type === 'task') {
      const dur = intIn(d.durRaw, 1, Model.LIMITS.dur);
      if (dur == null) e.dur = t('err.int', { field: t('f.dur'), min: 1, max: '3 650' }); else d.dur = dur;
      const pct = intIn(d.pctRaw, 0, 100);
      if (pct == null) e.pct = t('err.int', { field: t('f.pct'), min: 0, max: 100 }); else d.pct = pct;
    }
    for (const k of ['forcedStart', 'notBefore', 'deadline', 'realStart', 'realEnd']) {
      if (d[k] && Dates.parse(d[k]) == null) e[k] = t('err.date', { field: t('f.' + ({ forcedStart: 'forced' }[k] || k)) });
    }
    if (!e.realStart && !e.realEnd && d.realStart && d.realEnd && d.realEnd < d.realStart) e.realEnd = t('err.realOrder', { field: t('f.realEnd') });
    d.deps.forEach(dep => { if (!Number.isInteger(dep.lag) || Math.abs(dep.lag) > Model.LIMITS.lag) e.deps = t('err.int', { field: t('f.lag', { id: dep.id }), min: -365, max: 365 }); });
    d.assign.forEach(a => { const r = resById(a.res); if (!r || !Number.isInteger(a.units) || a.units < 1 || a.units > r.capacity) e.assign = t('err.capacity', { field: t('f.units', { name: r ? r.name : '' }), name: r ? r.name : '', cap: r ? r.capacity : 100 }); });
    const tags = d.tagsRaw.split(',').map(s => s.trim()).filter(Boolean);
    if (tags.length > Model.LIMITS.tags || tags.some(s => s.length > 30)) e.tags = t('err.text', { field: t('f.tags'), min: 1, max: 30 });
    else d.tags = tags.filter((s, i) => tags.findIndex(x => x.toLowerCase() === s.toLowerCase()) === i);
    if (d.parent) {
      const height = Math.max(0, ...descendants(originalId).map(x => ancestorsOf(x.id).length - ancestorsOf(originalId).length));
      if (ancestorsOf(d.parent).length + 1 + height > Model.LIMITS.depth) e.parent = t('err.depth', { max: Model.LIMITS.depth });
    }
    return e;
  }

  async function save() {
    const e = validate();
    if (Object.keys(e).length) { showErrors(e); return; }
    const d = draft;
    let cleared = false;
    if (d.type === 'task') {
      if (d.realEnd && d.pct < 100) {
        // Une fin réelle porte l'avancement à 100 % (RG-13), sauf si l'utilisateur vient de le baisser.
        const before = taskById(originalId);
        if (before.realEnd === d.realEnd && before.pct === 100) { d.realEnd = ''; cleared = true; } else d.pct = 100;
      }
    }
    const oldId = originalId, newId = d.id;
    const final = {
      id: newId, name: d.name, type: d.type, parent: d.parent, dur: d.type === 'task' ? d.dur : 0,
      deps: d.type === 'summary' ? [] : d.deps.map(x => ({ id: x.id, type: x.type, lag: x.lag })),
      assign: d.type === 'task' ? d.assign.map(a => ({ res: a.res, units: a.units })) : [],
      cat: d.cat, pct: d.type === 'summary' ? 0 : d.pct,
      forcedStart: d.type === 'summary' ? '' : d.forcedStart, notBefore: d.type === 'summary' ? '' : d.notBefore, deadline: d.type === 'summary' ? '' : d.deadline,
      realStart: d.type === 'task' ? d.realStart : '', realEnd: d.type === 'task' ? d.realEnd : '',
      tags: d.tags, notes: d.notes, comments: d.comments, collapsed: d.collapsed,
    };
    // Simulation : le planning doit rester calculable (dates ≤ 2199).
    const trial = clone(App.project);
    applyTask(trial, oldId, final);
    try { Schedule.compute(trial); } catch { showErrors({ forcedStart: t('calc.error') }); return; }
    commit(p => applyTask(p, oldId, final));
    App.selected = newId;
    originalId = newId;
    $('editor').hidden = true;
    draft = null;
    render();
    announce(t('saved', { id: newId }) + (cleared ? ' ' + t('err.realEndCleared') : ''));
    const sel = document.querySelector(`button.select[data-arg="${CSS.escape(newId)}"]`);
    if (sel) sel.focus();
  }

  /** Remplace la tâche oldId ; un changement d'identifiant est répercuté partout (EF-05). */
  function applyTask(p, oldId, final) {
    const i = p.tasks.findIndex(x => x.id === oldId);
    const parentChanged = p.tasks[i].parent !== final.parent;
    p.tasks[i] = final;
    if (oldId !== final.id) {
      for (const x of p.tasks) {
        for (const dep of x.deps) if (dep.id === oldId) dep.id = final.id;
        if (x.parent === oldId) x.parent = final.id;
      }
      for (const b of p.baselines) for (const bt of b.tasks) {
        if (bt.id === oldId) bt.id = final.id;
        bt.deps = bt.deps.map(x => (x === oldId ? final.id : x));
      }
    }
    if (parentChanged && final.parent) {
      // Se place à la fin de sa nouvelle récapitulative.
      const block = [final, ...descendants(final.id, p.tasks)];
      p.tasks = p.tasks.filter(x => !block.includes(x));
      const pi = p.tasks.findIndex(x => x.id === final.parent);
      const after = descendants(final.parent, p.tasks);
      const at = after.length ? p.tasks.indexOf(after[after.length - 1]) + 1 : pi + 1;
      p.tasks.splice(at, 0, ...block);
    }
  }

  // ── Actions du brouillon ───────────────────────────────────────────────────────────────
  action('upperCase', (arg, el) => { const pos = el.selectionStart; el.value = el.value.toUpperCase(); el.setSelectionRange(pos, pos); });
  action('draftType', (arg, el) => { readForm(); draft.type = el.value; if (draft.type === 'milestone') { draft.assign = []; draft.pct = draft.pct >= 100 ? 100 : 0; } else if (!draft.dur) draft.dur = 5; build(); $('f-type').focus(); });
  action('draftDep', (arg, el) => {
    const [i, k] = arg.split(':');
    const dep = draft.deps[Number(i)];
    if (k === 'type') dep.type = Model.LINK_TYPES.includes(el.value) ? el.value : 'FS';
    else dep.lag = el.value === '' ? NaN : Number(el.value);
  });
  action('draftRemoveDep', arg => { readForm(); draft.deps.splice(Number(arg), 1); build(); const p = $('dep-pick'); if (p) p.focus(); });
  action('draftAddDep', () => {
    readForm();
    const pick = $('dep-pick');
    if (!pick || !pick.value) return;
    const trialTasks = App.project.tasks.map(x => (x.id === originalId ? { ...x, deps: [...draft.deps, { id: pick.value, type: 'FS', lag: 0 }] } : x));
    const cycle = Model.findCycle(trialTasks);
    if (cycle) { const err = $('deps-err'); err.textContent = t('err.cycle', { path: cycle.join(' → ') }); err.hidden = false; pick.focus(); return; }
    draft.deps.push({ id: pick.value, type: 'FS', lag: 0 });
    build();
    const again = $('dep-pick'); if (again) again.focus();
  });
  action('draftUnits', (arg, el) => { draft.assign[Number(arg)].units = el.value === '' ? NaN : Number(el.value); });
  action('draftRemoveAssign', arg => { readForm(); draft.assign.splice(Number(arg), 1); build(); const p = $('res-pick'); if (p) p.focus(); });
  action('draftAddAssign', () => {
    readForm();
    const pick = $('res-pick');
    if (!pick || !pick.value) return;
    const r = resById(pick.value);
    draft.assign.push({ res: r.id, units: Math.min(100, r.capacity) });
    build();
    const again = $('res-pick'); if (again) again.focus();
  });
  action('saveTask', () => save());
  action('closeEditor', () => close());

  return { open, close, isOpen: () => !!draft };
})();
