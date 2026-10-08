/* Impression du Gantt (EF-89, EX-26) : période, échelle, orientation, légende, colonnes.
 * Mise en page par un tableau dont l'en-tête (colonnes et échelle de temps) se répète sur chaque
 * page ; couleurs remplacées par des motifs noir et blanc et par du texte. */
const PrintOpt = { period: 'all', from: '', to: '', scale: 'fit', orient: 'landscape', legend: true, cols: { id: true, name: true, dur: true, deps: false, res: true, status: true } };

function buildPrintGantt() {
  const s = App.sched;
  const tasks = viewItems().filter(it => it.task).map(it => it.task);
  let { from, to } = gridRange();
  if (PrintOpt.period === 'range') {
    const a = Dates.parse(PrintOpt.from), b = Dates.parse(PrintOpt.to);
    if (a != null) from = Dates.mondayOf(a);
    if (b != null) to = Math.max(from + 6, b);
  }
  const days = to - from + 1;
  const cols = Object.keys(PrintOpt.cols).filter(k => PrintOpt.cols[k]);
  // Largeur imprimable approximative en px CSS (A4, marges 12 mm) moins les colonnes.
  const pageW = PrintOpt.orient === 'landscape' ? 1045 : 715;
  const colW = { id: 40, name: 180, dur: 50, deps: 80, res: 110, status: 80 };
  const ganttW = PrintOpt.scale === 'fit' ? Math.max(200, pageW - cols.reduce((a, k) => a + colW[k], 0)) : Math.round(days * 26 * App.zoom / 100 / 7);
  const dayW = ganttW / days;
  const x = dn => (dn - from) * dayW;
  const head = h('div', { class: 'pg-time' });
  head.style.setProperty('width', ganttW + 'px');
  for (const p of Metrics.periods(from, to, dayW * 7 < 22 ? 'month' : 'week')) {
    const a = Math.max(p.start, from), b = Math.min(p.end, to);
    const c = h('div', { class: 'pg-col', text: dayW * 7 < 22 ? I18n.monthLabel(p.start) : I18n.shortDate(p.start) });
    c.style.setProperty('left', x(a) + 'px'); c.style.setProperty('width', ((b - a + 1) * dayW) + 'px');
    head.append(c);
  }
  const labels = { id: t('col.id'), name: t('col.name'), dur: t('col.dur'), deps: t('col.deps'), res: t('col.res'), status: t('col.status') };
  const table = h('table', { class: 'print-gantt' },
    h('caption', { text: `${App.project.emoji} ${App.project.name} — ${I18n.date(from)} → ${I18n.date(to)}` }),
    h('thead', {}, h('tr', {}, cols.map(k => h('th', { scope: 'col', text: labels[k] })), h('th', { scope: 'col', class: 'pg-timecell' }, head))));
  const tb = h('tbody');
  const fl = flags();
  for (const task of tasks) {
    const r = s.tasks.get(task.id);
    const st = statusOf(task);
    const cells = {
      id: task.id, name: task.name, dur: durText(task, r), deps: depsText(task), res: task.type === 'task' ? resText(task) : '',
      status: (st ? t('status.' + st) : '') + (r && r.critical && task.type !== 'summary' ? ' ● ' + t('list.critical') : '') + (fl.conflict.has(task.id) ? ' ⚠' : ''),
    };
    const lane = h('div', { class: 'pg-lane' });
    lane.style.setProperty('width', ganttW + 'px');
    if (r && !r.empty && r.endDn >= from && r.startDn <= to) {
      const a = Math.max(r.startDn, from), b = Math.min(r.endDn, to);
      const el = h('div', { class: ['pg-bar', task.type, r.critical && 'critical'], text: task.type === 'milestone' ? '◆' : '' });
      el.style.setProperty('left', x(task.type === 'milestone' ? r.startDn : a) + 'px');
      if (task.type !== 'milestone') {
        el.style.setProperty('width', Math.max(3, (b - a + 1) * dayW) + 'px');
        const pct = Metrics.pctOf(task, s);
        const done = h('span', { class: 'pg-done' }); done.style.setProperty('width', pct + '%'); el.append(done);
      }
      lane.append(el);
    }
    tb.append(h('tr', { class: task.type }, cols.map(k => h('td', { class: 'pg-' + k, text: cells[k] })), h('td', { class: 'pg-timecell' }, lane)));
  }
  table.append(tb);
  const wrap = h('div', { class: 'print-wrap' }, table);
  if (PrintOpt.legend) wrap.append(h('p', { class: 'pg-legend', text: t('print.legend') }));
  return wrap;
}

function printWindow() {
  if (!App.sched) return;
  const chk = (id, label, checked, arg) => h('span', { class: 'check' }, h('input', { type: 'checkbox', id, checked, data: { change: 'printOpt', arg } }), h('label', { for: id, text: label }));
  const radio = (name, value, label, checked) => h('span', { class: 'check' }, h('input', { type: 'radio', name, id: `pr-${name}-${value}`, value, checked, data: { change: 'printOpt', arg: name } }), h('label', { for: `pr-${name}-${value}`, text: label }));
  const body = h('div', { id: 'print-win' },
    h('fieldset', { class: 'inline' }, h('legend', { text: t('print.period') }), radio('period', 'all', t('print.all'), PrintOpt.period === 'all'), radio('period', 'range', t('print.range'), PrintOpt.period === 'range'),
      h('label', { for: 'pr-from', text: t('view.f.from') }), h('input', { type: 'date', id: 'pr-from', value: PrintOpt.from, data: { change: 'printOpt', arg: 'from' } }),
      h('label', { for: 'pr-to', text: t('view.f.to') }), h('input', { type: 'date', id: 'pr-to', value: PrintOpt.to, data: { change: 'printOpt', arg: 'to' } })),
    h('fieldset', { class: 'inline' }, h('legend', { text: t('print.scale') }), radio('scale', 'fit', t('print.fit'), PrintOpt.scale === 'fit'), radio('scale', 'zoom', t('print.zoom'), PrintOpt.scale === 'zoom')),
    h('fieldset', { class: 'inline' }, h('legend', { text: t('print.orient') }), radio('orient', 'landscape', t('print.landscape'), PrintOpt.orient === 'landscape'), radio('orient', 'portrait', t('print.portrait'), PrintOpt.orient === 'portrait')),
    h('fieldset', { class: 'inline' }, h('legend', { text: t('print.cols') }), Object.keys(PrintOpt.cols).map(k => chk('pr-col-' + k, t('col.' + k), PrintOpt.cols[k], 'col:' + k))),
    chk('pr-legend', t('print.withLegend'), PrintOpt.legend, 'legend'),
    h('p', { class: 'hint', text: t('print.hint') }));
  return Dialog.open({ title: t('top.print'), body: [body], actions: [{ label: t('dlg.cancel'), value: 'cancel' }, { label: t('print.go'), value: 'ok', kind: 'primary' }],
    onAction: v => { if (v === 'ok') setTimeout(() => printNode(buildPrintGantt(), 'print-gantt', `A4 ${PrintOpt.orient}`), 50); return true; } });
}
action('openPrint', () => printWindow());
action('printOpt', (arg, el) => {
  if (arg === 'period' || arg === 'scale' || arg === 'orient') PrintOpt[arg] = el.value;
  else if (arg === 'from' || arg === 'to') { PrintOpt[arg] = Dates.parse(el.value) != null ? el.value : ''; PrintOpt.period = 'range'; }
  else if (arg === 'legend') PrintOpt.legend = el.checked;
  else if (arg.startsWith('col:')) PrintOpt.cols[arg.slice(4)] = el.checked;
});
