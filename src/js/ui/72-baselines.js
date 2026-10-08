/* Baselines (EF-33 à EF-36, RG-22) : copies figées des dates calculées, trois au plus. */

function captureBaseline(p, sched, name, color) {
  const catName = id => (p.categories.find(c => c.id === id) || { name: '' }).name;
  let n = 1; while (p.baselines.some(b => b.id === 'B' + n)) n++;
  return {
    id: 'B' + n, name, color, createdAt: Date.now(), projectStart: p.projectStart, shownOnGantt: true, shownOnScurve: true,
    tasks: p.tasks.filter(x => x.type !== 'summary').map(x => {
      const r = sched.tasks.get(x.id);
      return { id: x.id, name: x.name, dur: x.type === 'task' ? x.dur : 0, deps: x.deps.map(d => d.id), cat: catName(x.cat), start: Dates.toISO(r.startDn), end: Dates.toISO(r.endDn) };
    }),
  };
}

function baselinesWindow() {
  const body = h('div', { id: 'bl-win' });
  const paint = () => {
    clear(body);
    const list = App.project.baselines;
    if (!list.length) body.append(h('p', { class: 'hint', text: t('bl.none') }));
    else {
      const tb = h('tbody');
      for (const b of list) {
        const sw = h('span', { class: 'swatch', aria: { hidden: 'true' } }); sw.style.setProperty('background', safeColor(b.color));
        tb.append(h('tr', {},
          h('td', {}, h('input', { type: 'text', value: b.name, maxlength: 100, aria: { label: `${t('res.name')} (${b.name})`, describedby: 'blerr-' + b.id }, data: { change: 'blField', arg: b.id + ':name' } }),
            h('p', { class: 'field-error', id: 'blerr-' + b.id, hidden: true })),
          h('td', {}, sw, h('select', { aria: { label: `${t('res.color')} (${b.name})` }, data: { change: 'blField', arg: b.id + ':color' } },
            Model.BASELINE_COLORS.map((c, i) => h('option', { value: c, selected: c === b.color }, t('color.pick', { n: i + 1 }))))),
          h('td', {}, h('input', { type: 'checkbox', id: 'blg-' + b.id, checked: b.shownOnGantt, data: { change: 'blField', arg: b.id + ':gantt' } }),
            h('label', { for: 'blg-' + b.id, text: ' ' + t('bl.onGantt') })),
          h('td', {}, h('input', { type: 'checkbox', id: 'bls-' + b.id, checked: b.shownOnScurve, data: { change: 'blField', arg: b.id + ':scurve' } }),
            h('label', { for: 'bls-' + b.id, text: ' ' + t('bl.onScurve') })),
          h('td', { text: t('bl.captured', { date: I18n.date(Dates.todayDn(new Date(b.createdAt || 0))), count: b.tasks.length }) }),
          h('td', {}, h('button', { type: 'button', class: 'danger', data: { click: 'blDelete', arg: b.id } }, `${t('edit.delete')} ${b.name}`))));
      }
      body.append(h('table', { class: 'manage' },
        h('thead', {}, h('tr', {}, [t('res.name'), t('res.color'), t('bl.onGantt'), t('bl.onScurve'), t('bl.content'), ''].map(x => h('th', { scope: 'col', text: x })))), tb));
    }
    body.append(h('button', { type: 'button', class: 'primary', data: { click: 'blCapture' } }, t('bl.capture')));
  };
  baselinesWindow.paint = paint;
  paint();
  return Dialog.open({ title: t('top.baselines'), body: [body], size: 'wide', actions: [{ label: t('dlg.close'), value: 'close' }] })
    .then(() => { baselinesWindow.paint = null; });
}

action('blCapture', () => {
  const p = App.project;
  if (p.baselines.length >= Model.LIMITS.baselines) { Dialog.message(t('top.baselines'), t('bl.limit', { max: Model.LIMITS.baselines })); return; }
  if (!App.sched) return;
  let n = p.baselines.length + 1;
  while (p.baselines.some(b => b.name === `Baseline ${n}`)) n++;
  const used = new Set(p.baselines.map(b => b.color));
  const color = Model.BASELINE_COLORS.find(c => !used.has(c)) || Model.BASELINE_COLORS[0];
  const b = captureBaseline(p, App.sched, `Baseline ${n}`, color);
  commit(pr => pr.baselines.push(b));
  announce(t('bl.done', { name: b.name }));
  if (baselinesWindow.paint) { baselinesWindow.paint(); const inp = document.querySelector('#bl-win tbody tr:last-child input'); if (inp) inp.focus(); }
});

action('blField', (arg, el) => {
  const [id, k] = arg.split(':');
  const b = App.project.baselines.find(x => x.id === id);
  if (!b) return;
  if (k === 'name') {
    const v = el.value.trim();
    const err = $('blerr-' + id);
    if (!v || v.length > 100) { err.textContent = t('err.text', { field: t('res.name'), min: 1, max: 100 }); err.hidden = false; el.setAttribute('aria-invalid', 'true'); el.focus(); return; }
    err.hidden = true; el.removeAttribute('aria-invalid');
    commit(() => { b.name = v; });
  } else if (k === 'color') {
    if (!Model.BASELINE_COLORS.includes(el.value)) return;
    commit(() => { b.color = el.value; });
  } else if (k === 'gantt' || k === 'scurve') {
    // Afficher ou masquer n'est pas une modification de données (EF-53) : pas d'historique.
    b[k === 'gantt' ? 'shownOnGantt' : 'shownOnScurve'] = el.checked;
    render();
  }
});

action('blDelete', async id => {
  const b = App.project.baselines.find(x => x.id === id);
  if (!b) return;
  if (!(await Dialog.confirm(t('bl.delete', { name: b.name }), [], t('edit.delete')))) return;
  commit(p => { p.baselines = p.baselines.filter(x => x.id !== id); });
  if (baselinesWindow.paint) baselinesWindow.paint();
});
