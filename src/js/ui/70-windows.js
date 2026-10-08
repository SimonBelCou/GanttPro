/* Fenêtres de gestion : projet (EF-48), ressources (EF-24, EF-25), catégories (EF-27, EF-28). */

async function editProjectWindow() {
  const p = App.project;
  const name = h('input', { type: 'text', id: 'p-name', value: p.name, maxlength: 60, required: true, aria: { describedby: 'p-name-err' } });
  const desc = h('textarea', { id: 'p-desc', rows: 3, maxlength: 500, text: p.desc });
  const emojis = h('fieldset', { class: 'emojis' }, h('legend', { text: t('dlg.emoji') }),
    Model.EMOJIS.map((e, i) => h('span', { class: 'emoji-opt' },
      h('input', { type: 'radio', id: 'p-emo-' + i, name: 'p-emoji', value: e, checked: e === p.emoji }),
      h('label', { for: 'p-emo-' + i, text: e }))));
  await Dialog.open({
    title: t('dlg.project'),
    body: [h('div', { class: 'field' }, h('label', { for: 'p-name', text: t('f.name') }), name, h('p', { class: 'field-error', id: 'p-name-err', hidden: true })),
      h('div', { class: 'field' }, h('label', { for: 'p-desc', text: t('dlg.desc') }), desc), emojis],
    actions: [{ label: t('dlg.cancel'), value: 'cancel' }, { label: t('edit.save'), value: 'ok', kind: 'primary' }],
    onAction: v => {
      if (v !== 'ok') return true;
      const n = name.value.trim();
      if (!n || n.length > 60) {
        const err = $('p-name-err');
        err.textContent = t('err.text', { field: t('f.name'), min: 1, max: 60 }); err.hidden = false;
        name.setAttribute('aria-invalid', 'true'); name.focus();
        return false;
      }
      const checked = document.querySelector('input[name="p-emoji"]:checked');
      const emoji = checked && Model.EMOJIS.includes(checked.value) ? checked.value : p.emoji;
      commit(pr => { pr.name = n; pr.desc = desc.value.slice(0, 500); pr.emoji = emoji; });
      return true;
    },
  });
}

/** Contrôle d'un nom de ressource ou de catégorie : obligatoire, 100 caractères, unique (casse ignorée). */
function nameError(list, id, value, label) {
  const v = value.trim();
  if (!v || v.length > 100) return t('err.text', { field: label, min: 1, max: 100 });
  if (list.some(x => x.id !== id && x.name.toLocaleLowerCase('fr') === v.toLocaleLowerCase('fr'))) return t('err.nameTaken', { field: label, name: v });
  return null;
}

function resourcesWindow() {
  const body = h('div', { id: 'res-win' });
  const paint = () => {
    clear(body);
    body.append(h('p', { class: 'hint', text: t('res.privacy') }));
    const table = h('table', { class: 'manage' },
      h('thead', {}, h('tr', {}, [t('res.name'), t('res.role'), t('res.capacity'), t('res.color'), '', ''].map(x => h('th', { scope: 'col', text: x })))));
    const tb = h('tbody');
    App.project.resources.forEach(r => {
      const used = App.project.tasks.filter(x => x.assign.some(a => a.res === r.id)).length;
      const nameIn = h('input', { type: 'text', value: r.name, maxlength: 100, aria: { label: `${t('res.name')} (${r.name})`, describedby: 'rerr-' + r.id }, data: { change: 'resField', arg: r.id + ':name' } });
      const roleIn = h('input', { type: 'text', value: r.role, maxlength: 100, aria: { label: `${t('res.role')} (${r.name})` }, data: { change: 'resField', arg: r.id + ':role' } });
      const capIn = h('input', { type: 'number', value: r.capacity, min: 1, max: 100, step: 1, inputmode: 'numeric', aria: { label: `${t('res.capacity')} (${r.name})`, describedby: 'rerr-' + r.id }, data: { change: 'resField', arg: r.id + ':capacity' } });
      const color = h('select', { aria: { label: `${t('res.color')} (${r.name})` }, data: { change: 'resField', arg: r.id + ':color' } },
        Model.PALETTE.map((c, i) => h('option', { value: c, selected: c === r.color }, t('color.pick', { n: i + 1 }))));
      const sw = h('span', { class: 'swatch', aria: { hidden: 'true' } }); sw.style.setProperty('background', safeColor(r.color));
      tb.append(h('tr', {},
        h('td', {}, nameIn, h('p', { class: 'field-error', id: 'rerr-' + r.id, hidden: true })),
        h('td', {}, roleIn), h('td', {}, capIn), h('td', {}, sw, color),
        h('td', { text: t('res.tasks', { count: used }) }),
        h('td', {}, h('button', { type: 'button', data: { click: 'openResourceSheet', arg: r.id } }, `${t('rs.open')} ${r.name}`),
          ' ', h('button', { type: 'button', class: 'danger', data: { click: 'resDelete', arg: r.id } }, `${t('edit.delete')} ${r.name}`))));
    });
    table.append(tb);
    body.append(table, h('button', { type: 'button', data: { click: 'resAdd' } }, t('res.add')));
  };
  resourcesWindow.paint = paint;
  paint();
  return Dialog.open({ title: t('dlg.resources'), body: [body], size: 'wide', actions: [{ label: t('dlg.close'), value: 'close', kind: 'primary' }] })
    .then(() => { resourcesWindow.paint = null; });
}

action('resField', (arg, el) => {
  const [id, k] = arg.split(':');
  const r = resById(id);
  const err = $('rerr-' + id);
  const fail = msg => { err.textContent = msg; err.hidden = false; el.setAttribute('aria-invalid', 'true'); announce(msg); el.focus(); };
  if (err) { err.hidden = true; el.removeAttribute('aria-invalid'); }
  if (k === 'name') { const e = nameError(App.project.resources, id, el.value, t('res.name')); if (e) return fail(e); }
  if (k === 'capacity') {
    const n = Number(el.value);
    const maxUnits = Math.max(1, ...App.project.tasks.flatMap(x => x.assign.filter(a => a.res === id).map(a => a.units)));
    if (!Number.isInteger(n) || n < 1 || n > 100) return fail(t('err.int', { field: t('res.capacity'), min: 1, max: 100 }));
    if (n < maxUnits) return fail(t('err.int', { field: t('res.capacity'), min: maxUnits, max: 100 }));
  }
  if (k === 'color' && !Model.PALETTE.includes(el.value)) return;
  commit(() => {
    if (k === 'name') r.name = el.value.trim();
    else if (k === 'role') r.role = el.value.slice(0, 100);
    else if (k === 'capacity') r.capacity = Number(el.value);
    else if (k === 'color') r.color = el.value;
  });
  // On garde le focus dans la fenêtre : on ne repeint que si la liste change de forme.
  if (k === 'color' && resourcesWindow.paint) { resourcesWindow.paint(); document.querySelector(`[data-arg="${CSS.escape(arg)}"]`).focus(); }
});

action('resAdd', () => {
  if (App.project.resources.length >= Model.LIMITS.resources) { Dialog.message(t('dlg.resources'), t('err.limit', { max: Model.LIMITS.resources, what: t('dlg.resources').toLowerCase() })); return; }
  let n = App.project.resources.length + 1, name;
  do { name = `${t('res.new')} ${n++}`; } while (nameError(App.project.resources, '', name, ''));
  const used = new Set(App.project.resources.map(r => r.color));
  const color = Model.PALETTE.find(c => !used.has(c)) || Model.PALETTE[0];
  let id = 1; while (resById('R' + id)) id++;
  commit(p => p.resources.push({ id: 'R' + id, name, role: '', color, capacity: 100, absences: [] }));
  resourcesWindow.paint && resourcesWindow.paint();
  const inputs = document.querySelectorAll('#res-win tbody tr:last-child input');
  if (inputs[0]) { inputs[0].focus(); inputs[0].select(); }
});

action('resDelete', async id => {
  const r = resById(id);
  const used = App.project.tasks.filter(x => x.assign.some(a => a.res === id)).length;
  const ok = await Dialog.confirm(t('res.delete', { name: r.name }), [used ? t('res.deleteUsed', { count: used }) : ''], t('edit.delete'));
  if (!ok) return;
  commit(p => {
    p.resources = p.resources.filter(x => x.id !== id);
    for (const x of p.tasks) x.assign = x.assign.filter(a => a.res !== id);
  });
  resourcesWindow.paint && resourcesWindow.paint();
});

function categoriesWindow() {
  const body = h('div', { id: 'cat-win' });
  const paint = () => {
    clear(body);
    const table = h('table', { class: 'manage' },
      h('thead', {}, h('tr', {}, [t('res.name'), t('res.color'), '', ''].map(x => h('th', { scope: 'col', text: x })))));
    const tb = h('tbody');
    App.project.categories.forEach(c => {
      const used = App.project.tasks.filter(x => x.cat === c.id).length;
      const sw = h('span', { class: 'swatch', aria: { hidden: 'true' } }); sw.style.setProperty('background', safeColor(c.color));
      const color = h('select', { aria: { label: `${t('res.color')} (${c.name})` }, data: { change: 'catField', arg: c.id + ':color' } },
        Model.PALETTE.map((col, i) => h('option', { value: col, selected: col === c.color }, t('color.pick', { n: i + 1 }))));
      tb.append(h('tr', {},
        h('td', {}, h('input', { type: 'text', value: c.name, maxlength: 100, aria: { label: `${t('res.name')} (${c.name})`, describedby: 'cerr-' + c.id }, data: { change: 'catField', arg: c.id + ':name' } }),
          h('p', { class: 'field-error', id: 'cerr-' + c.id, hidden: true })),
        h('td', {}, sw, color),
        h('td', { text: t('res.tasks', { count: used }) }),
        h('td', {}, h('button', { type: 'button', class: 'danger', data: { click: 'catDelete', arg: c.id } }, `${t('edit.delete')} ${c.name}`))));
    });
    table.append(tb);
    body.append(table, h('button', { type: 'button', data: { click: 'catAdd' } }, t('cat.add')));
  };
  categoriesWindow.paint = paint;
  paint();
  return Dialog.open({ title: t('dlg.categories'), body: [body], size: 'wide', actions: [{ label: t('dlg.close'), value: 'close', kind: 'primary' }] })
    .then(() => { categoriesWindow.paint = null; });
}

action('catField', (arg, el) => {
  const [id, k] = arg.split(':');
  const c = catById(id);
  const err = $('cerr-' + id);
  if (err) { err.hidden = true; el.removeAttribute('aria-invalid'); }
  if (k === 'name') {
    const e = nameError(App.project.categories, id, el.value, t('res.name'));
    if (e) { err.textContent = e; err.hidden = false; el.setAttribute('aria-invalid', 'true'); announce(e); el.focus(); return; }
  }
  if (k === 'color' && !Model.PALETTE.includes(el.value)) return;
  commit(() => { if (k === 'name') c.name = el.value.trim(); else c.color = el.value; });
  if (k === 'color' && categoriesWindow.paint) { categoriesWindow.paint(); document.querySelector(`[data-arg="${CSS.escape(arg)}"]`).focus(); }
});

action('catAdd', () => {
  if (App.project.categories.length >= Model.LIMITS.categories) { Dialog.message(t('dlg.categories'), t('err.limit', { max: Model.LIMITS.categories, what: t('dlg.categories').toLowerCase() })); return; }
  let n = App.project.categories.length + 1, name;
  do { name = `${t('cat.new')} ${n++}`; } while (nameError(App.project.categories, '', name, ''));
  let id = 1; while (catById('C' + id)) id++;
  commit(p => p.categories.push({ id: 'C' + id, name, color: Model.PALETTE[p.categories.length % Model.PALETTE.length] }));
  categoriesWindow.paint && categoriesWindow.paint();
  const inp = document.querySelector('#cat-win tbody tr:last-child input');
  if (inp) { inp.focus(); inp.select(); }
});

action('catDelete', async id => {
  const c = catById(id);
  const others = App.project.categories.filter(x => x.id !== id);
  if (!others.length) { await Dialog.message(t('dlg.categories'), t('err.lastCategory')); return; }
  const used = App.project.tasks.filter(x => x.cat === id).length;
  const ok = await Dialog.confirm(t('cat.delete', { name: c.name }), [used ? t('cat.deleteUsed', { count: used, other: others[0].name }) : ''], t('edit.delete'));
  if (!ok) return;
  commit(p => {
    p.categories = p.categories.filter(x => x.id !== id);
    for (const x of p.tasks) if (x.cat === id) x.cat = others[0].id;
  });
  categoriesWindow.paint && categoriesWindow.paint();
});

/* Résolution des conflits (EF-31) : propositions simulées par Resolve.suggest, appliquées d'un clic. */
let resolveState = null;

function optionLabel(o) {
  const res = id => (resById(id) || { name: '' }).name;
  switch (o.kind) {
    case 'moveForced': return t('rsv.opt.moveForced', { task: o.task, date: I18n.date(Dates.parse(o.date)) });
    case 'unforce': return t('rsv.opt.unforce', { task: o.task });
    case 'reassign': return t('rsv.opt.reassign', { task: o.task, from: res(o.from), to: res(o.to) });
    case 'sequence': return t('rsv.opt.sequence', { first: o.first, task: o.task });
    default: return t('rsv.opt.level');
  }
}
function impactLabel(a) {
  const left = a.conflicts ? t('rsv.left', { count: a.conflicts }) : t('rsv.left0');
  const end = a.endShift > 0 ? t('rsv.endLater', { count: a.endShift }) : a.endShift < 0 ? t('rsv.endEarlier', { count: -a.endShift }) : t('rsv.endSame');
  return `${left} ; ${end}`;
}

function paintResolve(body) {
  clear(body);
  if (!App.sched || !App.sched.conflicts.length) { body.append(h('p', { text: t('rsv.none') })); resolveState = null; return; }
  const sug = Resolve.suggest(App.project, App.sched);
  resolveState = sug;
  body.append(h('p', { class: 'hint', text: t('rsv.intro') }));
  const msgs = alertMessages().filter(m => m.kind === 'conflict');
  const optionRow = (o, arg) => h('li', {},
    h('span', {}, optionLabel(o), h('br'), h('span', { class: 'impact', text: impactLabel(o.after) })),
    h('button', { type: 'button', class: 'primary', data: { click: 'applyResolve', arg }, aria: { label: t('rsv.applyLabel', { what: optionLabel(o) }) } }, t('rsv.apply')));
  sug.conflicts.forEach((c, k) => {
    body.append(h('section', { class: 'rsv-conflict' },
      h('h3', { text: '⚠ ' + (msgs[k] ? msgs[k].text : '') }),
      c.options.length ? h('ul', { class: 'rsv-options' }, c.options.map((o, j) => optionRow(o, `${k}:${j}`))) : h('p', { class: 'hint', text: t('rsv.noOption') })));
  });
  if (sug.global.length) body.append(h('section', { class: 'rsv-conflict' }, h('h3', { text: t('rsv.global') }),
    h('ul', { class: 'rsv-options' }, sug.global.map((o, j) => optionRow(o, `g:${j}`)))));
  if (sug.more) body.append(h('p', { class: 'hint', text: t('rsv.more', { count: sug.more }) }));
}

function resolveWindow() {
  const body = h('div', { id: 'rsv-win' });
  resolveWindow.body = body;
  paintResolve(body);
  return Dialog.open({ title: t('rsv.title'), body: [body], size: 'wide', actions: [{ label: t('dlg.close'), value: 'close', kind: 'primary' }] })
    .then(() => { resolveWindow.body = null; resolveState = null; });
}

action('applyResolve', arg => {
  if (!resolveState) return;
  const [k, j] = arg.split(':');
  const o = k === 'g' ? resolveState.global[Number(j)] : (resolveState.conflicts[Number(k)] || { options: [] }).options[Number(j)];
  if (!o) return;
  commit(p => o.mutate(p));
  const left = App.sched && App.sched.conflicts.length ? t('rsv.left', { count: App.sched.conflicts.length }) : t('rsv.left0');
  announce(t('rsv.applied', { left }));
  if (resolveWindow.body) {
    paintResolve(resolveWindow.body);
    const next = resolveWindow.body.querySelector('button');
    if (next) next.focus(); else resolveWindow.body.closest('dialog').querySelector('.actions button').focus();
  }
});
