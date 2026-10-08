/* Affichage : barre du haut, chiffres, alertes, liste, grille, légende.
 * Tout est reconstruit à chaque modification (déterministe, < 100 ms pour 1 000 tâches). */
const t = (k, p) => I18n.t(k, p);
const today = () => Dates.todayDn();

function applyStaticTexts() {
  document.documentElement.lang = I18n.getLang();
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-label]')) el.setAttribute('aria-label', t(el.dataset.i18nLabel));
}

function durText(task, r) {
  if (task.type === 'milestone') return t('dur.milestone');
  const d = task.type === 'summary' ? (r && !r.empty ? r.d : 0) : task.dur;
  return t('dur.days', { count: d });
}
function depsText(task) {
  return task.deps.map(d => d.id + (d.type !== 'FS' || d.lag ? ' ' + t('link.short.' + d.type) + (d.lag ? (d.lag > 0 ? '+' : '') + d.lag : '') : '')).join(', ');
}
function resText(task) {
  return task.assign.map(a => { const r = resById(a.res); return r ? r.name + (a.units !== 100 ? ' ' + a.units + ' %' : '') : ''; }).filter(Boolean).join(', ');
}

/** Tâches en conflit et en avertissement, pour les marquer en texte (EF-18, EF-30). */
function flags() {
  const conflict = new Set(), warn = new Set();
  if (App.sched) {
    for (const c of App.sched.conflicts) c.tasks.forEach(id => conflict.add(id));
    for (const w of App.sched.warnings) warn.add(w.task);
  }
  return { conflict, warn };
}

function renderTopbar() {
  const p = App.project;
  const label = $('project-label');
  label.textContent = `${p.emoji} ${p.name}`;
  label.setAttribute('aria-label', t('top.project', { name: p.name }));
  const start = $('project-start');
  if (document.activeElement !== start) start.value = p.projectStart;
  $('zoom-level').textContent = t('top.zoom', { pct: App.zoom });
  $('btn-undo').disabled = !App.undo.length;
  $('btn-redo').disabled = !App.redo.length;
  const theme = Settings.get('theme') || 'system';
  $('btn-theme').textContent = t('top.theme', { theme: t('theme.' + theme) });
  const lang = $('btn-lang');
  lang.textContent = t('top.lang');
  lang.setAttribute('lang', I18n.getLang() === 'fr' ? 'en' : 'fr');
  lang.setAttribute('aria-label', t('top.langLabel'));
  const n = App.sched ? App.sched.conflicts.length + App.sched.warnings.length : 0;
  const badge = $('btn-alerts');
  badge.hidden = n === 0;
  badge.textContent = App.sched && App.sched.conflicts.length ? t('top.conflicts', { count: App.sched.conflicts.length }) : t('top.alerts', { count: n });
  badge.setAttribute('aria-expanded', String(App.showAlerts && n > 0));
  badge.setAttribute('aria-controls', 'alerts');
  $('btn-resolve').hidden = !(App.sched && App.sched.conflicts.length);
  const links = $('btn-links');
  links.textContent = t('top.links', { state: t(App.showLinks ? 'state.on' : 'state.off') });
  links.setAttribute('aria-pressed', String(App.showLinks));
  const lvl = $('leveling-mode');
  if (document.activeElement !== lvl) lvl.value = App.project.leveling || 'level';
}

/** « 3 j de décalage (Alice : surcharge) » pour une tâche décalée par le nivellement (EF-106). */
function shiftText(r) {
  if (!r || !r.shift) return '';
  const res = resById(r.shift.res);
  return t('list.shift', { count: r.shift.days, res: res ? res.name : '', why: t('why.' + r.shift.kind) });
}

function renderKpis() {
  const box = clear($('kpis'));
  if (!App.sched) { box.append(h('p', { class: 'error', text: t(App.calcError || 'calc.error') })); return; }
  const s = App.sched, cal = s.cal;
  let first = Infinity;
  for (const r of s.tasks.values()) if (!r.empty) first = Math.min(first, r.s);
  if (first === Infinity) first = 0;
  let offDays = 0;
  for (let dn = cal.dnOf(first); dn <= s.projectEndDn; dn++) {
    const info = cal.dayInfo(dn);
    if (info && (info.kind === 'holiday' || info.kind === 'off')) offDays++;
  }
  const pct = Metrics.globalProgress(App.project);
  const item = (label, ...value) => h('div', { class: 'kpi' }, h('dt', { text: label }), h('dd', {}, value));
  const crit = s.criticalPath.join(' → ') || t('kpi.none');
  box.append(h('dl', {},
    item(t('kpi.duration'), t('kpi.days', { count: s.projectEnd - first + 1 })),
    item(t('kpi.start'), I18n.date(cal.dnOf(first))),
    item(t('kpi.end'), I18n.date(s.projectEndDn)),
    item(t('kpi.holidays'), String(offDays)),
    item(t('kpi.critical'), h('span', { class: 'critical-path', text: crit })),
    item(t('kpi.progress'), `${I18n.number(pct)} % `, h('progress', { max: 100, value: Math.round(pct), aria: { label: t('kpi.progress') } }))));
  if (typeof viewActive === 'function' && viewActive()) box.append(h('p', { class: 'hint whole', text: t('view.whole') }));
}

function alertMessages() {
  if (!App.sched) return [];
  const s = App.sched, out = [];
  for (const c of s.conflicts) {
    const r = resById(c.res);
    let peak = 0;
    for (let i = c.s; i <= c.e; i++) peak = Math.max(peak, s.loadOf(c.res, i) * 100 / (r.capacity || 100));
    out.push({ kind: 'conflict', text: t(c.kind === 'absence' ? 'alert.absence' : 'alert.overload', {
      res: r.name, pct: Math.round(peak), start: I18n.shortDate(c.startDn), end: I18n.shortDate(c.endDn), tasks: c.tasks.join(', ') }) });
  }
  for (const w of s.warnings) {
    const r = s.tasks.get(w.task);
    if (w.kind === 'deadline') out.push({ kind: 'warning', text: t('alert.deadline', { task: w.task, count: w.days }) });
    else if (w.kind === 'smooth') { const res = resById(w.res); out.push({ kind: 'warning', text: t('alert.smooth', { task: w.task, res: res ? res.name : '' }) }); }
    else {
      const p = s.tasks.get(w.pred);
      const own = w.type === 'FF' || w.type === 'SF' ? r.endDn : r.startDn;
      const other = w.type === 'SS' || w.type === 'SF' ? p.startDn : p.endDn;
      out.push({ kind: 'warning', text: t('alert.link.' + w.type, { task: w.task, date: I18n.shortDate(own), pred: w.pred, predDate: I18n.shortDate(other) }) });
    }
  }
  return out;
}

function renderAlerts() {
  const msgs = alertMessages();
  const box = $('alerts');
  box.hidden = !App.showAlerts || msgs.length === 0;
  const ul = clear($('alerts-list'));
  for (const m of msgs) ul.append(h('li', { class: m.kind }, h('span', { aria: { hidden: 'true' }, text: '⚠ ' }), m.text));
}

function statusOf(task) {
  if (!App.sched) return null;
  return Metrics.status(task, App.sched, today());
}

/** Libellé et totaux d'un groupe (EF-86). */
function groupLabel(g) {
  const name = g.none ? t(App.view.groupBy === 'res' ? 'view.noRes' : 'view.noCat') : App.view.groupBy === 'status' ? t('status.' + g.key) : g.label;
  return { name, totals: t('view.groupTotals', { count: g.count, dur: g.dur, pct: g.pct }) };
}

function renderList(items, fl) {
  const body = clear($('task-rows'));
  const s = App.sched;
  const frag = document.createDocumentFragment();
  const auto = (key, dn) => h('tr', { class: 'auto-ms' },
    h('td', { text: '◆' }), h('td', { text: `${t(key)} — ${dn != null ? I18n.date(dn) : ''}` }), h('td'), h('td'), h('td'), h('td'));
  frag.append(auto('list.msStart', s ? s.cal.dnOf(0) : null));
  for (const it of items) {
    if (it.group) {
      const { name, totals } = groupLabel(it.group);
      const open = !App.view.collapsedGroups.has(it.group.key);
      frag.append(h('tr', { class: 'group-row' }, h('td', { colspan: 6 },
        h('button', { type: 'button', class: 'toggle', data: { click: 'toggleGroup', arg: it.group.key }, aria: { expanded: String(open) } },
          open ? '▾ ' : '▸ ', h('strong', { text: name }), ` — ${totals}`))));
      continue;
    }
    const task = it.task;
    const r = s && s.tasks.get(task.id);
    const depth = it.flat ? 0 : ancestorsOf(task.id).length;
    const crit = r && r.critical && task.type !== 'summary';
    const st = statusOf(task);
    const marks = [];
    if (crit) marks.push(t('list.critical'));
    if (fl.conflict.has(task.id)) marks.push(t('list.conflict'));
    if (fl.warn.has(task.id)) marks.push(t('list.warning'));
    if (r && r.shift) marks.push(shiftText(r));
    const nameCell = h('td', { class: 'name' });
    nameCell.style.setProperty('--depth', String(depth));
    if (task.type === 'summary' && !it.flat) {
      nameCell.append(h('button', { type: 'button', class: 'toggle icon', data: { click: 'toggleCollapse', arg: task.id },
        aria: { expanded: String(!task.collapsed), label: task.name } }, task.collapsed ? '▸' : '▾'));
    }
    nameCell.append(h('button', { type: 'button', class: 'select', data: { click: 'selectTask', arg: task.id },
      aria: { current: App.selected === task.id ? 'true' : undefined } },
      task.type === 'milestone' ? '◆ ' : '', task.name, task.forcedStart ? ' 📌' : ''));
    if (marks.length) nameCell.append(' ', h('span', { class: ['marks', !crit && !fl.conflict.has(task.id) && !fl.warn.has(task.id) && 'info'], text: (fl.conflict.has(task.id) || fl.warn.has(task.id) ? '⚠ ' : '') + marks.join(', ') }));
    frag.append(h('tr', { class: [task.type, crit && 'critical', App.selected === task.id && 'selected', fl.conflict.has(task.id) && 'conflict', it.dim && 'dim', it.hit && 'hit'], data: { id: task.id } },
      h('td', { class: 'id' }, crit ? h('span', { class: 'crit-dot', aria: { hidden: 'true' }, text: '● ' }) : '', task.id),
      nameCell,
      h('td', { text: durText(task, r) }),
      h('td', { text: depsText(task) }),
      h('td', { text: task.type === 'task' ? (resText(task) || t('list.noRes')) : '' }),
      h('td', { class: 'status ' + (st || ''), text: st ? t('status.' + st) : '' })));
  }
  frag.append(auto('list.msEnd', s ? s.projectEndDn : null));
  body.append(frag);
}

/** Fenêtre de temps de la grille (EF-17) : toutes les dates affichées. */
function gridRange() {
  const s = App.sched;
  let lo = s.cal.dnOf(0), hi = s.projectEndDn;
  lo = Math.min(lo, Dates.parse(App.project.projectStart));
  for (const r of s.tasks.values()) if (!r.empty) { lo = Math.min(lo, r.startDn); hi = Math.max(hi, r.endDn); }
  for (const task of App.project.tasks) for (const k of ['realStart', 'realEnd']) { const d = Dates.parse(task[k]); if (d != null) { lo = Math.min(lo, d); hi = Math.max(hi, d); } }
  for (const b of shownBaselines()) for (const bt of b.tasks) { lo = Math.min(lo, Dates.parse(bt.start)); hi = Math.max(hi, Dates.parse(bt.end)); }
  return { from: Dates.mondayOf(lo), to: Dates.mondayOf(hi) + 13 };
}

const shownBaselines = () => App.project.baselines.filter(b => b.shownOnGantt);

/** Texte d'une barre de baseline pour le nom accessible et l'infobulle (EF-34). */
function baselineTexts(taskId) {
  return shownBaselines().map(b => {
    const bt = b.tasks.find(x => x.id === taskId);
    return bt ? t('gantt.baseline', { name: b.name, start: I18n.date(Dates.parse(bt.start)), end: I18n.date(Dates.parse(bt.end)) }) : null;
  }).filter(Boolean);
}

function renderGantt(items, fl) {
  const rows = items.filter(it => it.task).map(it => it.task);
  const inner = clear($('gantt-inner'));
  const s = App.sched;
  if (!s) return;
  const { from, to } = gridRange();
  const dayW = 26 * App.zoom / 100 / 7;
  const days = to - from + 1;
  const width = Math.max(1, Math.round(days * dayW));
  inner.style.setProperty('--grid-w', width + 'px');
  const x = dn => (dn - from) * dayW;

  // En-tête sur deux lignes : les mois, puis le lundi de chaque semaine (vue semaine) ;
  // sous 60 % de zoom, les mois seuls (RG-21). Les jours fériés sont signalés par semaine (EF-16).
  const head = h('div', { class: 'g-head', aria: { hidden: 'true' } });
  const monthView = App.zoom < 60;
  const cell = (cls, a, b, text, title) => {
    const c = h('div', { class: cls, text, title: title || undefined });
    c.style.setProperty('left', x(a) + 'px');
    c.style.setProperty('width', ((b - a + 1) * dayW) + 'px');
    return c;
  };
  for (const p of Metrics.periods(from, to, 'month')) {
    const a = Math.max(p.start, from), b = Math.min(p.end, to);
    head.append(cell('g-col month' + (monthView ? ' full' : ''), a, b, (b - a + 1) * dayW > 40 ? I18n.monthLabel(p.start) : ''));
  }
  if (!monthView) {
    for (const p of Metrics.periods(from, to, 'week')) {
      const names = [];
      for (let dn = p.start; dn <= p.end; dn++) { const info = s.cal.dayInfo(dn); if (info && info.kind === 'holiday') names.push(t(info.key)); }
      head.append(cell(['g-col', 'week', names.length && 'has-holiday'].filter(Boolean).join(' '), p.start, p.end,
        String(Dates.ymd(p.start).d).padStart(2, '0'), names.join(', ')));
    }
  }
  inner.append(head);

  const body = h('div', { class: 'g-body' });
  body.style.setProperty('--rows', String(items.length + 2));
  // Jours non travaillés en fond atténué.
  for (let dn = from; dn <= to; dn++) {
    if (s.cal.isWork(dn)) continue;
    let end = dn;
    while (end + 1 <= to && !s.cal.isWork(end + 1)) end++;
    const off = h('div', { class: 'g-off', aria: { hidden: 'true' } });
    off.style.setProperty('left', x(dn) + 'px');
    off.style.setProperty('width', ((end - dn + 1) * dayW) + 'px');
    body.append(off);
    dn = end;
  }
  const td = today();
  if (td >= from && td <= to) {
    const line = h('div', { class: 'g-today', title: t('gantt.today') });
    line.style.setProperty('left', x(td + 0.5) + 'px');
    body.append(line);
  }

  const bls = shownBaselines();
  body.classList.toggle('with-bl', bls.length > 0);
  const row = (...children) => h('div', { class: 'g-row' }, children);
  const rowOf = new Map(); // id → index de ligne visible, pour les flèches
  items.forEach((it, i) => { if (it.task && !rowOf.has(it.task.id)) rowOf.set(it.task.id, i + 1); });
  const msAuto = (dn, cls) => { const m = h('div', { class: 'ms auto ' + cls, aria: { hidden: 'true' } }); m.style.setProperty('left', x(dn + 0.5) + 'px'); return row(m); };
  body.append(msAuto(s.cal.dnOf(0), 'start'));
  for (const it of items) {
    if (it.group) { body.append(h('div', { class: 'g-row g-group', aria: { hidden: 'true' } })); continue; }
    const task = it.task;
    const r = s.tasks.get(task.id);
    if (!r || r.empty) { body.append(row()); continue; }
    const st = statusOf(task);
    const cat = catById(task.cat);
    const color = safeColor(cat && cat.color);
    const pct = Metrics.pctOf(task, s);
    const common = { role: 'button', tabindex: '0', data: { click: 'selectTask', arg: task.id } };
    let el;
    if (task.type === 'milestone') {
      el = h('div', { ...common, class: ['ms', pct >= 100 && 'reached', r.critical && 'critical', App.selected === task.id && 'selected'],
        aria: { label: t('gantt.milestone', { id: task.id, name: task.name, date: I18n.date(r.startDn), status: t('status.' + st) }) } });
      el.style.setProperty('left', x(r.startDn + 0.5) + 'px');
    } else if (task.type === 'summary') {
      el = h('div', { ...common, class: ['sbar', App.selected === task.id && 'selected'],
        aria: { label: t('gantt.summary', { id: task.id, name: task.name, start: I18n.date(r.startDn), end: I18n.date(r.endDn), pct }) } });
      el.style.setProperty('left', x(r.startDn) + 'px');
      el.style.setProperty('width', Math.max(4, (r.endDn - r.startDn + 1) * dayW) + 'px');
    } else {
      const extra = [r.critical && t('list.critical'), fl.conflict.has(task.id) && t('list.conflict'), task.forcedStart && t('gantt.forced'), shiftText(r)].filter(Boolean);
      el = h('div', { ...common, class: ['bar', r.critical && 'critical', fl.conflict.has(task.id) && 'conflict', App.selected === task.id && 'selected'],
        aria: { label: t('gantt.bar', { id: task.id, name: task.name, start: I18n.date(r.startDn), end: I18n.date(r.endDn), dur: durText(task, r), pct, status: t('status.' + st) }) + (extra.length ? ', ' + extra.join(', ') : '') } },
        h('span', { class: 'done', aria: { hidden: 'true' } }),
        h('span', { class: 'bar-label', aria: { hidden: 'true' }, text: task.id + (task.forcedStart ? ' 📌' : '') }));
      el.style.setProperty('left', x(r.startDn) + 'px');
      el.style.setProperty('width', Math.max(4, (r.endDn - r.startDn + 1) * dayW) + 'px');
      el.style.setProperty('--c', color);
      el.style.setProperty('--ink', inkOn(color));
      el.firstChild.style.setProperty('width', pct + '%');
    }
    const blText = baselineTexts(task.id);
    if (blText.length) el.setAttribute('aria-label', el.getAttribute('aria-label') + ', ' + blText.join(', '));
    // Fines barres de baseline, empilées sous la barre (EF-34).
    const minis = bls.map((b, k) => {
      const bt = b.tasks.find(x => x.id === task.id);
      if (!bt) return null;
      const a = Dates.parse(bt.start), z = Dates.parse(bt.end);
      const m = h('div', { class: 'bl', aria: { hidden: 'true' } });
      m.style.setProperty('left', x(a) + 'px');
      m.style.setProperty('width', Math.max(3, (z - a + 1) * dayW) + 'px');
      m.style.setProperty('top', (25 + k * 3) + 'px');
      m.style.setProperty('background', safeColor(b.color));
      return m;
    });
    if (it.dim) el.classList.add('dim');
    body.append(row(el, minis));
  }
  body.append(msAuto(s.projectEndDn, 'end'));
  if (App.showLinks && !App.view.groupBy) body.append(linkArrows(rows, rowOf, x, dayW, items.length));
  inner.append(body);
}

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Élément SVG ; mêmes interdits que h() (pas d'attribut on… ni style). */
function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    if (FORBIDDEN_ATTR.test(k)) throw new Error('attribut interdit : ' + k);
    if (k === 'text') el.textContent = String(v); else el.setAttribute(k, String(v));
  }
  for (const c of children.flat(Infinity)) if (c) el.append(c);
  return el;
}

/** Flèches de dépendance (EF-45) : du bord du prédécesseur au bord du successeur selon le type. */
function linkArrows(rows, rowOf, x, dayW, count) {
  const s = App.sched;
  const rowH = 34, mid = i => i * rowH + rowH / 2;
  const height = (count + 2) * rowH;
  const layer = svg('svg', { class: 'g-links', 'aria-hidden': 'true', height, width: '100%' },
    svg('defs', {}, ['n', 'c'].map(k => svg('marker', { id: 'arrow-' + k, viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      svg('path', { d: 'M0,0 L8,4 L0,8 z', class: 'head-' + k })))));
  for (const task of rows) {
    const rs = s.tasks.get(task.id);
    if (!rs || rs.empty || !rowOf.has(task.id)) continue;
    for (const d of task.deps) {
      const rp = s.tasks.get(d.id);
      if (!rowOf.has(d.id) || !rp) continue;
      const predMs = taskById(d.id).type === 'milestone', succMs = task.type === 'milestone';
      const edge = (r, ms, atEnd) => (ms ? x(r.startDn + 0.5) : atEnd ? x(r.endDn + 1) : x(r.startDn));
      const fromEnd = d.type === 'FS' || d.type === 'FF', toEnd = d.type === 'FF' || d.type === 'SF';
      const x1 = edge(rp, predMs, fromEnd), y1 = mid(rowOf.get(d.id));
      const x2 = edge(rs, succMs, toEnd), y2 = mid(rowOf.get(task.id));
      const out = fromEnd ? 6 : -6, inn = toEnd ? 6 : -6;
      const crit = rp.critical && rs.critical;
      const path = `M${x1},${y1} h${out} V${(y1 + y2) / 2} H${x2 + inn} V${y2} H${x2}`;
      layer.append(svg('path', { d: path, class: crit ? 'link critical' : 'link', 'marker-end': `url(#arrow-${crit ? 'c' : 'n'})` }));
    }
  }
  return layer;
}

function renderLegend() {
  const box = clear($('legend'));
  const swatch = c => { const sw = h('span', { class: 'swatch', aria: { hidden: 'true' } }); sw.style.setProperty('background', safeColor(c)); return sw; };
  const items = [
    ...App.project.categories.map(c => h('li', {}, swatch(c.color), c.name)),
    h('li', {}, h('span', { class: 'swatch critical', aria: { hidden: 'true' } }), t('legend.critical')),
    h('li', {}, t('legend.forced')), h('li', {}, t('legend.milestone')),
    App.project.baselines.some(b => b.shownOnGantt) ? h('li', {}, h('span', { class: 'swatch thin', aria: { hidden: 'true' } }), t('legend.baseline')) : null,
    h('li', {}, h('span', { class: 'swatch today', aria: { hidden: 'true' } }), t('legend.today')),
  ];
  box.append(h('ul', {}, items));
}

function render() {
  // Le DOM est reconstruit : on rend le focus à l'élément équivalent (même id) s'il existait.
  const focusId = document.activeElement && document.activeElement.id;
  Tooltip.hide();
  applyStaticTexts();
  renderTopbar();
  renderKpis();
  renderAlerts();
  const fl = flags();
  const items = viewItems();
  renderViewbar(items);
  renderList(items, fl);
  renderGantt(items, fl);
  renderLegend();
  if (focusId && document.activeElement !== $(focusId) && $(focusId) && !document.querySelector('dialog[open]')) $(focusId).focus();
}
