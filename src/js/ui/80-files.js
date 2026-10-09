/* Fichiers : nouveau projet (EF-49), import (EF-52, EF-95, EF-96), export (EF-50, EF-51, EF-92 à
 * EF-97), fichiers protégés par mot de passe (EF-102). Tout fichier est contrôlé en entier AVANT
 * tout changement : en cas de refus, le projet ouvert reste intact (EX-14). */

/** Nom de fichier : « <nom>_gantt.<ext> », a-z et 0-9 seulement (EF-50). */
function exportFileName(name, ext = 'json') {
  const base = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '_') || 'projet';
  return `${base}_gantt.${ext}`;
}

function download(data, filename, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ── Export (EF-92) ─────────────────────────────────────────────────────────────────────── */
const ExportOpt = { format: 'json', anonymize: false, protect: false, scale: 1, legend: true, white: true, period: 'all', from: '', to: '' };
const FORMATS = ['json', 'xlsx', 'csv', 'msp', 'png'];

function exportBody() {
  const o = ExportOpt;
  const radio = f => h('span', { class: 'check' }, h('input', { type: 'radio', name: 'exp-format', id: 'exp-f-' + f, value: f, checked: o.format === f, data: { change: 'expOpt', arg: 'format' } }),
    h('label', { for: 'exp-f-' + f, text: t('exp.f.' + f) }));
  const chk = (id, key, label) => h('div', { class: 'field check' }, h('input', { type: 'checkbox', id, checked: o[key], data: { change: 'expOpt', arg: key } }), h('label', { for: id, text: label }));
  const box = h('div', { id: 'exp-win' }, h('fieldset', { class: 'sub' }, h('legend', { text: t('exp.format') }), FORMATS.map(radio)));
  box.append(h('p', { class: 'field-error', id: 'exp-err', role: 'alert', hidden: true }));
  if (o.format !== 'png') box.append(chk('exp-anon', 'anonymize', t('exp.anonymize')));
  if (o.format === 'json') {
    box.append(h('p', { class: 'hint', text: t('exp.notice') }), chk('exp-protect', 'protect', t('exp.protect')));
    if (o.protect) box.append(
      h('div', { class: 'field' }, h('label', { for: 'exp-pwd', text: t('pwd.label') }), h('input', { type: 'password', id: 'exp-pwd', autocomplete: 'new-password', aria: { describedby: 'exp-pwd-hint' } })),
      h('div', { class: 'field' }, h('label', { for: 'exp-pwd2', text: t('pwd.confirm') }), h('input', { type: 'password', id: 'exp-pwd2', autocomplete: 'new-password' })),
      h('p', { class: 'warning', id: 'exp-pwd-hint', text: t('pwd.warn', { min: Secure.MIN_PASSWORD }) }));
  }
  if (o.format === 'msp') box.append(h('p', { class: 'hint', text: t('exp.mspNote') }));
  if (o.format === 'csv' || o.format === 'xlsx') box.append(h('p', { class: 'hint', text: t('exp.sheetNote') }));
  if (o.format === 'png') {
    box.append(h('fieldset', { class: 'inline' }, h('legend', { text: t('print.period') }),
      h('span', { class: 'check' }, h('input', { type: 'radio', name: 'exp-period', id: 'exp-p-all', value: 'all', checked: o.period === 'all', data: { change: 'expOpt', arg: 'period' } }), h('label', { for: 'exp-p-all', text: t('print.all') })),
      h('span', { class: 'check' }, h('input', { type: 'radio', name: 'exp-period', id: 'exp-p-range', value: 'range', checked: o.period === 'range', data: { change: 'expOpt', arg: 'period' } }), h('label', { for: 'exp-p-range', text: t('print.range') })),
      h('label', { for: 'exp-from', text: t('view.f.from') }), h('input', { type: 'date', id: 'exp-from', value: o.from, data: { change: 'expOpt', arg: 'from' } }),
      h('label', { for: 'exp-to', text: t('view.f.to') }), h('input', { type: 'date', id: 'exp-to', value: o.to, data: { change: 'expOpt', arg: 'to' } })),
      h('fieldset', { class: 'inline' }, h('legend', { text: t('exp.resolution') }),
        [1, 2].map(k => h('span', { class: 'check' }, h('input', { type: 'radio', name: 'exp-scale', id: 'exp-s-' + k, value: k, checked: o.scale === k, data: { change: 'expOpt', arg: 'scale' } }), h('label', { for: 'exp-s-' + k, text: t('exp.scale' + k) })))),
      chk('exp-legend', 'legend', t('print.withLegend')), chk('exp-white', 'white', t('exp.white')),
      h('p', { class: 'hint', text: t('exp.pngA11y') }));
  }
  return box;
}

function exportWindow() {
  const holder = h('div', {}, exportBody());
  exportWindow.holder = holder;
  return Dialog.open({
    title: t('top.export'), body: [holder],
    actions: [{ label: t('dlg.cancel'), value: 'cancel' }, { label: t('top.export'), value: 'ok', kind: 'primary', focus: true }],
    onAction: v => { if (v === 'ok') { doExport(); return false; } return true; },
  }).then(() => { exportWindow.holder = null; });
}

action('expOpt', (key, el) => {
  const o = ExportOpt;
  if (key === 'format') o.format = FORMATS.includes(el.value) ? el.value : 'json';
  else if (key === 'scale') o.scale = el.value === '2' ? 2 : 1;
  else if (key === 'period') o.period = el.value === 'range' ? 'range' : 'all';
  else if (key === 'from' || key === 'to') { o[key] = Dates.parse(el.value) != null ? el.value : ''; o.period = 'range'; }
  else o[key] = el.checked;
  if (['format', 'protect'].includes(key) && exportWindow.holder) {
    clear(exportWindow.holder).append(exportBody());
    const f = $(key === 'format' ? 'exp-f-' + o.format : 'exp-protect'); if (f) f.focus();
  }
});

async function doExport() {
  const o = ExportOpt, p = App.project, s = App.sched, today = Dates.todayDn();
  const err = msg => { const e = $('exp-err'); if (e) { e.textContent = msg; e.hidden = false; } announce(msg); };
  if (!s) { err(t('calc.error')); return; }
  try {
    if (o.format === 'json') {
      const text = JSON.stringify(Model.serialize(p, { anonymize: o.anonymize }), null, 2);
      if (o.protect) {
        const a = $('exp-pwd').value, b = $('exp-pwd2').value;
        if (!Secure.passwordOk(a)) { err(t('pwd.short', { min: Secure.MIN_PASSWORD })); $('exp-pwd').focus(); return; }
        if (a !== b) { err(t('pwd.mismatch')); $('exp-pwd2').focus(); return; }
        announce(t('pwd.working'));
        const env = await Secure.encrypt(text, a);
        download(JSON.stringify(env, null, 2), exportFileName(p.name), 'application/json');
      } else download(text, exportFileName(p.name), 'application/json');
      if (!o.anonymize) { App.dirty = false; Recovery.clearCurrent(); }
    } else if (o.format === 'csv') download(Exchange.csv(p, s, today, { anonymize: o.anonymize }), exportFileName(p.name, 'csv'), 'text/csv;charset=utf-8');
    else if (o.format === 'xlsx') download(Exchange.xlsx(p, s, today, { anonymize: o.anonymize }), exportFileName(p.name, 'xlsx'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    else if (o.format === 'msp') {
      const q = o.anonymize ? Model.sanitize(Model.serialize(p, { anonymize: true })).project : p;
      download(Exchange.mspXml(q, o.anonymize ? Schedule.compute(q) : s), exportFileName(p.name, 'xml'), 'application/xml');
    } else if (o.format === 'png') download(await ganttPng(o), exportFileName(p.name, 'png'), 'image/png');
  } catch (e) {
    err(e instanceof Model.Invalid ? I18n.error(e) : t('exp.failed'));
    return;
  }
  document.querySelector('dialog[open] [data-dlg="cancel"]').click();
  toast(t('exp.done', { format: t('exp.f.' + o.format) }));
}

/* ── Image PNG du Gantt (EF-97) ───────────────────────────────────────────────────────────── */
function ganttPng(o) {
  const s = App.sched;
  const tasks = viewItems().filter(it => it.task).map(it => it.task);
  let { from, to } = gridRange();
  if (o.period === 'range') { const a = Dates.parse(o.from), b = Dates.parse(o.to); if (a != null) from = Dates.mondayOf(a); if (b != null) to = Math.max(from + 6, b); }
  const dayW = Math.max(4, 26 * App.zoom / 100 / 7), rowH = 24, left = 260, head = 40;
  const legendH = o.legend ? 30 : 0;
  const W = Math.round(left + (to - from + 1) * dayW + 10), H = head + tasks.length * rowH + legendH + 10;
  if (W * H * o.scale * o.scale > 16e7) throw new Model.Invalid('exp.pngTooBig');
  const canvas = document.createElement('canvas');
  canvas.width = W * o.scale; canvas.height = H * o.scale;
  const g = canvas.getContext('2d');
  g.scale(o.scale, o.scale);
  const css = getComputedStyle(document.documentElement);
  const col = name => css.getPropertyValue(name).trim();
  const white = o.white;
  const ink = white ? '#141a26' : col('--text'), muted = white ? '#4a5468' : col('--muted'), line = white ? '#c7cedb' : col('--line');
  g.fillStyle = white ? '#ffffff' : col('--panel'); g.fillRect(0, 0, W, H);
  g.font = '600 12px Sora, sans-serif'; g.textBaseline = 'middle';
  const x = dn => left + (dn - from) * dayW;
  for (let dn = from; dn <= to; dn++) if (!s.cal.isWork(dn)) { g.fillStyle = white ? 'rgba(20,26,38,.06)' : col('--off'); g.fillRect(x(dn), head, dayW, H - head - legendH); }
  g.fillStyle = muted; g.font = '11px Sora, sans-serif';
  for (const p of Metrics.periods(from, to, dayW * 7 < 22 ? 'month' : 'week')) {
    g.fillRect(x(Math.max(p.start, from)), 0, 1, H - legendH);
    g.fillText(dayW * 7 < 22 ? I18n.monthLabel(p.start) : I18n.shortDate(p.start), x(Math.max(p.start, from)) + 3, head / 2);
  }
  g.fillStyle = ink; g.font = '700 13px Sora, sans-serif';
  g.fillText(`${App.project.name}`, 8, head / 2);
  tasks.forEach((task, i) => {
    const y = head + i * rowH, r = s.tasks.get(task.id);
    g.fillStyle = line; g.fillRect(0, y + rowH - 1, W, 1);
    g.fillStyle = ink; g.font = (task.type === 'summary' ? '700 ' : '') + '12px Sora, sans-serif';
    const depth = ancestorsOf(task.id).length;
    const label = `${task.id}  ${task.name}`;
    g.save(); g.beginPath(); g.rect(0, y, left - 6, rowH); g.clip(); g.fillText(label, 8 + depth * 12, y + rowH / 2); g.restore();
    if (!r || r.empty || r.endDn < from || r.startDn > to) return;
    const cat = catById(task.cat), c = safeColor(cat && cat.color);
    if (task.type === 'milestone') {
      const cx = x(r.startDn) + dayW / 2, cy = y + rowH / 2;
      g.beginPath(); g.moveTo(cx, cy - 7); g.lineTo(cx + 7, cy); g.lineTo(cx, cy + 7); g.lineTo(cx - 7, cy); g.closePath();
      g.fillStyle = task.pct >= 100 ? ink : (white ? '#fff' : col('--panel')); g.fill(); g.strokeStyle = r.critical ? '#c21f1f' : ink; g.lineWidth = 2; g.stroke();
      return;
    }
    const a = Math.max(r.startDn, from), b = Math.min(r.endDn, to);
    const bx = x(a), bw = Math.max(3, (b - a + 1) * dayW);
    if (task.type === 'summary') { g.fillStyle = ink; g.fillRect(bx, y + 8, bw, 6); return; }
    g.fillStyle = c; g.fillRect(bx, y + 5, bw, rowH - 10);
    const pct = Metrics.pctOf(task, s);
    if (pct) { g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(bx, y + 5, bw * pct / 100, rowH - 10); }
    if (r.critical) { g.strokeStyle = '#c21f1f'; g.lineWidth = 2; g.strokeRect(bx, y + 5, bw, rowH - 10); }
  });
  const td = Dates.todayDn();
  if (td >= from && td <= to) { g.fillStyle = '#c21f1f'; g.fillRect(x(td) + dayW / 2, head, 2, tasks.length * rowH); }
  if (o.legend) {
    g.font = '11px Sora, sans-serif'; g.fillStyle = muted;
    let lx = 8;
    const ly = H - legendH / 2 - 5;
    for (const c of App.project.categories) { g.fillStyle = safeColor(c.color); g.fillRect(lx, ly - 5, 10, 10); g.fillStyle = ink; g.fillText(c.name, lx + 14, ly); lx += 24 + g.measureText(c.name).width; }
    g.fillStyle = ink; g.fillText(t('png.legend'), lx + 10, ly);
  }
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
}

/* ── Import (EF-52, EF-95, EF-96, EF-102) ─────────────────────────────────────────────────── */
async function importFile(file) {
  if (file.size > 20 * 1024 * 1024) { await Dialog.message(t('top.import'), t('imp.tooBig')); return; }
  const ext = (file.name.match(/\.([a-z0-9]+)$/i) || [])[1] || '';
  try {
    // Aiguillage par le contenu (signature) puis par l'extension : un fichier mal nommé est lu correctement.
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    if (head[0] === 0x50 && head[1] === 0x4b && head[2] === 3 && head[3] === 4) return await sheetWizard({ kind: 'xlsx', bytes: new Uint8Array(await file.arrayBuffer()), name: file.name });
    if (file.size > Model.MAX_BYTES) { await Dialog.message(t('top.import'), t('imp.tooBig')); return; }
    const text = await file.text(), lead = text.replace(/^\uFEFF/, '').trimStart();
    if (lead.startsWith('<')) return await importMsp(text);
    if (lead.startsWith('{')) return await importText(text);
    if (/^(csv|tsv|txt)$/i.test(ext) || !ext) return await sheetWizard({ kind: 'csv', text, name: file.name });
    return await importText(text);
  } catch (e) {
    await Dialog.message(t('top.import'), e instanceof Model.Invalid ? I18n.error(e) : /^zip/.test(e.message) ? t('imp.zip') : t('imp.unreadable'));
  }
}

/** Demande un mot de passe (jamais conservé). Renvoie la chaîne ou null. */
async function askPassword(title, hint) {
  let pwd = null;
  const inp = h('input', { type: 'password', id: 'ask-pwd', autocomplete: 'current-password' });
  const v = await Dialog.open({ title, body: [h('p', { text: hint }), h('div', { class: 'field' }, h('label', { for: 'ask-pwd', text: t('pwd.label') }), inp)],
    actions: [{ label: t('dlg.cancel'), value: 'cancel' }, { label: t('dlg.ok'), value: 'ok', kind: 'primary' }],
    onAction: val => { pwd = inp.value; inp.value = ''; return true; } });
  return v === 'ok' ? pwd : null;
}

async function importText(text, origin = 'file') {
  let result;
  try {
    result = Model.parseFile(text);
    if (result.encrypted) {
      const pwd = await askPassword(t('pwd.openTitle'), t('pwd.openHint'));
      if (pwd === null) return;
      announce(t('pwd.working'));
      result = Model.parseFile(await Secure.decrypt(result.envelope, pwd));
    }
  } catch (e) {
    await Dialog.message(t('top.import'), e instanceof Model.Invalid ? I18n.error(e) : t('imp.unreadable'));
    return;
  }
  const p = result.project;
  const extra = [
    result.notices.unknown ? t('imp.notice.unknown', { count: result.notices.unknown }) : '',
    result.notices.createdResources.length ? t('imp.notice.resources', { names: result.notices.createdResources.join(', ') }) : '',
    result.notices.createdCategories.length ? t('imp.notice.categories', { names: result.notices.createdCategories.join(', ') }) : '',
  ];
  await confirmOpen(p, extra, origin);
}

/** Aperçu commun d'un projet à ouvrir (EF-52) : nouvel onglet ou remplacement. */
async function confirmOpen(p, extraLines, origin) {
  const avg = Math.round(Metrics.globalProgress(p));
  const lines = [
    h('p', { class: 'strong', text: `${p.emoji} ${p.name}` }),
    p.desc ? h('p', { text: p.desc }) : null,
    h('p', { text: t('imp.summary', { tasks: p.tasks.length, resources: p.resources.length, categories: p.categories.length, baselines: p.baselines.length,
      start: I18n.date(Dates.parse(p.projectStart)), pct: avg }) }),
    ...extraLines.filter(Boolean).map(x => h('p', { class: 'hint', text: x })),
  ];
  const canTab = Tabs.canOpen() && !Tabs.pristine();
  if (!Tabs.canOpen()) lines.push(h('p', { class: 'hint', text: t('tabs.max', { max: Tabs.MAX }) }));
  const actions = [{ label: t('dlg.cancel'), value: 'cancel', focus: true }];
  if (canTab) actions.push({ label: t('imp.newTab'), value: 'tab', kind: 'primary' });
  actions.push({ label: t('imp.replace'), value: 'ok', kind: canTab ? '' : 'primary' });
  const v = await Dialog.open({ title: t('imp.title'), body: lines, actions });
  if (v === 'cancel') return false;
  if (v === 'ok' && App.dirty && !(await Dialog.confirm(t('imp.replace'), [t('dlg.unsaved')], t('imp.replace')))) return false;
  if (v === 'tab') Tabs.open(p, { dirty: origin !== 'file' });
  else { clearSelection(); Tabs.replace(p, { dirty: origin !== 'file' }); }
  announce(t('imp.opened', { name: p.name }));
  return true;
}

async function importMsp(text) {
  const { raw, ignored } = Exchange.fromMspXml(text);
  const res = Model.sanitize(raw);
  await confirmOpen(res.project, [ignored.length ? t('msp.ignored', { list: ignored.join(', ') }) : '', t('msp.calNote')], 'msp');
}

/* ── Assistant d'import de tableur (EF-96) : fichier/feuille → colonnes → aperçu ──────────── */
async function sheetWizard(src) {
  let sheets;
  if (src.kind === 'xlsx') sheets = await Xlsx.read(src.bytes);
  else { const { rows } = Csv.parse(src.text); sheets = [{ name: src.name, rows }]; }
  sheets = sheets.filter(s => s.rows.length);
  if (!sheets.length) throw new Model.Invalid('imp.emptySheet');
  const W = { step: 1, sheet: 0, header: true, map: null, mode: 'add', result: null };
  const body = h('div', { id: 'wiz' });
  const rowsOf = () => sheets[W.sheet].rows.map(r => r.map(c => (typeof c === 'number' ? c : String(c ?? ''))));
  const paint = focus => {
    clear(body);
    body.append(h('p', { class: 'hint', text: t('wiz.step', { n: W.step }) }), h('p', { class: 'field-error', id: 'wiz-err', role: 'alert', hidden: true }));
    const rows = rowsOf();
    if (W.step === 1) {
      if (sheets.length > 1) body.append(h('div', { class: 'field' }, h('label', { for: 'wiz-sheet', text: t('wiz.sheet') }),
        h('select', { id: 'wiz-sheet' }, sheets.map((s, i) => h('option', { value: i, selected: i === W.sheet }, `${s.name} (${s.rows.length})`)))));
      body.append(h('div', { class: 'field check' }, h('input', { type: 'checkbox', id: 'wiz-header', checked: W.header }), h('label', { for: 'wiz-header', text: t('wiz.header') })),
        h('p', { text: t('wiz.rows', { count: rows.length - (W.header ? 1 : 0), name: sheets[W.sheet].name }) }));
    } else if (W.step === 2) {
      const n = Math.max(...rows.slice(0, 50).map(r => r.length));
      const colLabel = i => (W.header ? `${Xlsx.colName(i)} — ${rows[0][i] ?? ''}` : `${Xlsx.colName(i)} — ${rows[0][i] ?? ''}…`);
      body.append(h('p', { text: t('wiz.mapHint') }), h('table', { class: 'manage' },
        h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: t('wiz.field') }), h('th', { scope: 'col', text: t('wiz.column') }))),
        h('tbody', {}, Exchange.FIELDS.map(f => h('tr', {}, h('th', { scope: 'row' }, h('label', { for: 'wiz-map-' + f, text: t('wiz.f.' + f) })),
          h('td', {}, h('select', { id: 'wiz-map-' + f }, h('option', { value: '' }, t('f.none')),
            Array.from({ length: n }, (_, i) => h('option', { value: i, selected: W.map[f] === i }, String(colLabel(i)).slice(0, 60))))))))));
    } else {
      const r = W.result;
      body.append(h('p', { class: 'strong', text: t('wiz.valid', { count: r.rows.length, total: r.total }) }));
      if (r.errors.length) body.append(h('div', { class: 'table-scroll' }, h('table', { class: 'manage' }, h('caption', { text: t('wiz.errors') }),
        h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: t('wiz.line') }), h('th', { scope: 'col', text: t('wiz.problem') }))),
        h('tbody', {}, r.errors.slice(0, 200).map(e => h('tr', {}, h('td', { text: String(e.line) }), h('td', { text: e.msg })))))));
      body.append(h('fieldset', { class: 'inline' }, h('legend', { text: t('wiz.mode') }),
        ['add', 'replace'].map(m => h('span', { class: 'check' }, h('input', { type: 'radio', name: 'wiz-mode', id: 'wiz-m-' + m, value: m, checked: W.mode === m }), h('label', { for: 'wiz-m-' + m, text: t('wiz.m.' + m) })))));
    }
    const dlg = body.closest('dialog');
    if (dlg) {
      const next = dlg.querySelector('button[data-dlg="next"]'), back = dlg.querySelector('button[data-dlg="back"]');
      next.textContent = W.step === 3 ? t('wiz.import') : t('wiz.next');
      back.disabled = W.step === 1;
    }
    const el = focus && body.querySelector(focus) || body.querySelector('select, input');
    if (el) el.focus();
  };
  const readStep = () => {
    if (W.step === 1) {
      if ($('wiz-sheet')) W.sheet = Number($('wiz-sheet').value) || 0;
      W.header = $('wiz-header').checked;
      W.map = W.header ? Exchange.guessMapping(rowsOf()[0]) : {};
    } else if (W.step === 2) {
      W.map = {};
      for (const f of Exchange.FIELDS) { const v = $('wiz-map-' + f).value; if (v !== '') W.map[f] = Number(v); }
    } else W.mode = document.querySelector('input[name="wiz-mode"]:checked').value === 'replace' ? 'replace' : 'add';
  };
  paint();
  let done = false;
  queueMicrotask(() => paint());
  await Dialog.open({
    title: t('wiz.title'), body: [body], size: 'wide',
    actions: [{ label: t('dlg.cancel'), value: 'cancel' }, { label: t('wiz.back'), value: 'back' }, { label: t('wiz.next'), value: 'next', kind: 'primary' }],
    onAction: v => {
      const err = msg => { const e = $('wiz-err'); e.textContent = msg; e.hidden = false; announce(msg); return false; };
      readStep();
      if (v === 'back') { if (W.step > 1) W.step--; paint(); return false; }
      if (W.step === 1) { W.step = 2; paint(); return false; }
      if (W.step === 2) {
        if (W.map.name === undefined) return err(t('wiz.needName'));
        try { W.result = Exchange.rowsToTasks(rowsOf(), W.map, App.project.tasks.map(x => x.id), { skipHeader: W.header }); } catch (e) { return err(e instanceof Model.Invalid ? I18n.error(e) : t('imp.unreadable')); }
        W.step = 3; paint(); return false;
      }
      if (!W.result.rows.length) return err(t('wiz.none'));
      let merged;
      try { merged = Exchange.mergeRows(App.project, W.result.rows, W.mode); } catch (e) { return err(e instanceof Model.Invalid ? I18n.error(e) : t('imp.unreadable')); }
      commit(p => { for (const k of Object.keys(merged.project)) if (k !== 'versions') p[k] = merged.project[k]; });
      announce(t('wiz.imported', { count: merged.added.length }));
      done = true;
      return true;
    },
  });
  return done;
}

/** Noms du projet initial dans la langue choisie (3.8). */
function initialNames() {
  return { project: t('init.project'), task: t('init.task'), resource: t('init.resource'), category: t('init.category') };
}

async function newProjectAction() {
  // Nouveau projet dans un nouvel onglet (EF-49, EF-98) ; au-delà de dix, la limite est annoncée.
  Tabs.open(Model.newProject(Dates.toISO(Dates.todayDn()), Date.now(), initialNames()));
}
