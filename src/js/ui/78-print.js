/* Impression du Gantt (EF-89, EX-26) : période, échelle, orientation, légende, colonnes.
 * Mise en page par un tableau dont l'en-tête (colonnes et échelle de temps) se répète sur chaque
 * page ; en couleur, mais lisible sans couleur (contours, motifs, ● et colonne Catégorie). */
const PrintOpt = { amounts: false, period: 'all', from: '', to: '', scale: 'fit', orient: 'landscape', legend: true, cols: { id: true, name: true, cat: true, start: true, end: true, dur: true, deps: true, res: true, status: true } };

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
  if (PrintOpt.amounts) cols.push('budget', 'actual'); // colonnes Budget et Coût réel : seulement si les montants sont inclus (EF-124)
  const amts = PrintOpt.amounts ? Budget.amounts(App.project) : null;
  // Largeur imprimable approximative en px CSS (A4, marges 12 mm, prudente) ; les colonnes de texte sont réduites
  // ensemble si elles laissent moins de 200 px à l'échelle de temps. Rien n'est tronqué : les textes passent à la ligne.
  const pageW = PrintOpt.orient === 'landscape' ? 1000 : 690;
  const base = { id: 32, name: 130, cat: 64, start: 56, end: 56, dur: 40, deps: 70, res: 80, status: 66, budget: 56, actual: 56 };
  const isDate = k => k === 'start' || k === 'end'; // les dates ne se réduisent pas (jamais coupées)
  const dateTotal = cols.filter(isDate).reduce((a, k) => a + base[k], 0);
  const textTotal = cols.filter(k => !isDate(k)).reduce((a, k) => a + base[k], 0);
  const shrink = Math.min(1, (pageW - 200 - dateTotal) / Math.max(1, textTotal));
  const colW = Object.fromEntries(cols.map(k => [k, isDate(k) ? base[k] : Math.floor(base[k] * shrink)]));
  const colsW = cols.reduce((a, k) => a + colW[k], 0);
  const availW = Math.max(200, pageW - colsW);
  // « Ajuster » : tout le planning sur la largeur d'une page. « Zoom actuel » : à l'échelle de l'écran, découpé en bandes
  // de semaines entières, une par page en largeur, chacune répétant les colonnes de texte (aucune information perdue).
  const fit = PrintOpt.scale === 'fit';
  const dayW = fit ? availW / days : 26 * App.zoom / 100 / 7;
  const sliceDays = fit ? days : Math.max(7, Math.floor(availW / dayW / 7) * 7);
  const slices = [];
  for (let a = from; a <= to; a += sliceDays) slices.push({ a, b: Math.min(to, a + sliceDays - 1) });
  const labels = { id: t('col.id'), name: t('col.name'), cat: t('col.cat'), start: t('col.start'), end: t('col.end'), dur: t('col.dur'), deps: t('col.deps'), res: t('col.res'), status: t('col.status'), budget: t('col.budget'), actual: t('col.actual') };
  const fl = flags();
  const wrap = h('div', { class: 'print-wrap' });
  slices.forEach((sl, idx) => {
    const x = dn => (dn - sl.a) * dayW;
    const laneW = (sl.b - sl.a + 1) * dayW;
    const head = h('div', { class: 'pg-time' });
    head.style.setProperty('width', laneW + 'px');
    for (const p of Metrics.periods(sl.a, sl.b, dayW * 7 < 36 ? 'month' : 'week')) {
      const a = Math.max(p.start, sl.a), b = Math.min(p.end, sl.b);
      const c = h('div', { class: 'pg-col', text: dayW * 7 < 36 ? I18n.monthLabel(p.start) : I18n.shortDate(p.start) });
      c.style.setProperty('left', x(a) + 'px'); c.style.setProperty('width', ((b - a + 1) * dayW) + 'px');
      head.append(c);
    }
    const caption = `${App.project.emoji} ${App.project.name} — ${I18n.date(sl.a)} → ${I18n.date(sl.b)}` + (slices.length > 1 ? ` — ${t('print.part', { n: idx + 1, m: slices.length })}` : '');
    const heads = cols.map(k => { const th = h('th', { scope: 'col', text: labels[k] }); th.style.setProperty('width', colW[k] + 'px'); return th; });
    const timeTh = h('th', { scope: 'col', class: 'pg-timecell' }, head);
    timeTh.style.setProperty('width', laneW + 'px');
    const table = h('table', { class: 'print-gantt' }, h('caption', { text: caption }), h('thead', {}, h('tr', {}, heads, timeTh)));
    table.style.setProperty('width', (colsW + laneW) + 'px');
    const tb = h('tbody');
    for (const task of tasks) {
      const r = s.tasks.get(task.id);
      const st = statusOf(task);
      const cells = {
        id: task.id, name: task.name, cat: task.type === 'summary' ? '' : ((catById(task.cat) || {}).name || ''), start: r && !r.empty ? I18n.numDate(r.startDn, true) : '', end: r && !r.empty ? I18n.numDate(r.endDn, true) : '',
        dur: durText(task, r), deps: depsText(task), res: task.type === 'task' ? resText(task) : '',
        status: (st ? t('status.' + st) : '') + (r && r.critical && task.type !== 'summary' ? ' ● ' + t('list.critical') : '') + (fl.conflict.has(task.id) ? ' ⚠' : ''),
        budget: amts && task.type !== 'milestone' ? Money.plain(amts.get(task.id).budget, { compact: true }) : '',
        actual: amts && task.type !== 'milestone' ? Money.plain(amts.get(task.id).actual, { compact: true }) : '',
      };
      const lane = h('div', { class: 'pg-lane' });
      lane.style.setProperty('width', laneW + 'px');
      if (r && !r.empty && r.endDn >= sl.a && r.startDn <= sl.b) {
        const a = Math.max(r.startDn, sl.a), b = Math.min(r.endDn, sl.b);
        const el = h('div', { class: ['pg-bar', task.type, r.critical && 'critical'], text: task.type === 'milestone' ? '◆' : '' });
        el.style.setProperty('left', x(task.type === 'milestone' ? r.startDn : a) + 'px');
        { const cat = catById(task.cat); if (cat) el.style.setProperty('--c', safeColor(cat.color)); }
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
    wrap.append(table);
  });
  if (PrintOpt.legend) {
    const cats = App.project.categories.map(c => { const sw = h('span', { class: 'pg-sw' }); sw.style.setProperty('--c', safeColor(c.color)); return h('span', {}, sw, c.name, '  '); });
    wrap.append(h('p', { class: 'pg-legend' }, t('print.legend'), cats.length ? ' ' : '', ...cats));
  }
  return wrap;
}

function printWindow() {
  if (!App.sched) return;
  PrintOpt.amounts = false; // décochée à chaque ouverture (EF-124)
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
    h('div', {}, chk('pr-amounts', t('out.amounts'), PrintOpt.amounts, 'amounts'), h('p', { class: 'hint', text: t('out.amountsHint') })),
    h('p', { class: 'hint', text: t('print.hint') }));
  return Dialog.open({ title: t('top.print'), size: 'wide', body: [body], actions: [{ label: t('dlg.cancel'), value: 'cancel' }, { label: t('print.go'), value: 'ok', kind: 'primary' }],
    onAction: v => { if (v === 'ok') setTimeout(() => printNode(buildPrintGantt(), 'print-gantt', `A4 ${PrintOpt.orient}`), 50); return true; } });
}
action('openPrint', () => printWindow());
action('printOpt', (arg, el) => {
  if (arg === 'period' || arg === 'scale' || arg === 'orient') PrintOpt[arg] = el.value;
  else if (arg === 'from' || arg === 'to') { PrintOpt[arg] = Dates.parse(el.value) != null ? el.value : ''; PrintOpt.period = 'range'; }
  else if (arg === 'legend') PrintOpt.legend = el.checked;
  else if (arg === 'amounts') PrintOpt.amounts = el.checked;
  else if (arg.startsWith('col:')) PrintOpt.cols[arg.slice(4)] = el.checked;
});
