/* Échanges de fichiers (EF-93 à EF-96, 8.6) : tableur (CSV, Excel), MS Project (XML), import de
 * tâches depuis un tableau. Tout ce qui entre repasse par Model.sanitize (section 8.3). */
const Exchange = (() => {
  const t = (k, p) => I18n.t(k, p);
  const LINK_FR = { FS: 'FD', SS: 'DD', FF: 'FF', SF: 'DF' };
  const LINK_IN = { FD: 'FS', DD: 'SS', FF: 'FF', DF: 'SF', FS: 'FS', SS: 'SS', SF: 'SF' };

  /** Numérotation hiérarchique 1, 1.1, 1.2, 2… selon l'ordre de la liste. */
  function outline(project) {
    const num = new Map(), counters = new Map();
    for (const x of project.tasks) {
      const base = x.parent ? num.get(x.parent) : '';
      const n = (counters.get(x.parent || '') || 0) + 1;
      counters.set(x.parent || '', n);
      num.set(x.id, base ? `${base}.${n}` : String(n));
    }
    return num;
  }

  function depsCell(task) {
    const codes = I18n.getLang() === 'fr' ? LINK_FR : { FS: 'FS', SS: 'SS', FF: 'FF', SF: 'SF' };
    return task.deps.map(d => d.id + (d.type !== 'FS' || d.lag ? ` ${codes[d.type]}${d.lag ? (d.lag > 0 ? '+' : '') + d.lag : ''}` : '')).join('; ');
  }

  /** Lignes du tableau des tâches (EF-93) : en-tête puis une ligne par tâche. */
  function taskRows(project, sched, today, { anonymize = false } = {}) {
    const rIndex = new Map(project.resources.map((r, i) => [r.id, i]));
    const resName = id => (anonymize ? `${t('init.resource')} ${rIndex.get(id) + 1}` : (project.resources.find(r => r.id === id) || { name: '' }).name);
    const cat = id => (project.categories.find(c => c.id === id) || { name: '' }).name;
    const num = outline(project);
    const head = ['xp.outline', 'xp.id', 'xp.name', 'xp.type', 'xp.parent', 'xp.dur', 'xp.start', 'xp.end', 'xp.deps', 'xp.res', 'xp.cat', 'xp.pct',
      'xp.status', 'xp.critical', 'xp.slack', 'xp.realStart', 'xp.realEnd', 'xp.forced', 'xp.notBefore', 'xp.deadline', 'xp.tags', 'xp.notes'].map(k => t(k));
    const rows = [head];
    for (const x of project.tasks) {
      const r = sched.tasks.get(x.id);
      const st = r && !r.empty ? Metrics.status(x, sched, today) : null;
      rows.push([
        num.get(x.id), x.id, x.name, t('type.' + x.type), x.parent, x.type === 'summary' ? (r && !r.empty ? r.d : 0) : (x.type === 'milestone' ? 0 : x.dur),
        r && !r.empty ? Dates.toISO(r.startDn) : '', r && !r.empty ? Dates.toISO(r.endDn) : '', depsCell(x),
        x.assign.map(a => resName(a.res) + (a.units !== 100 ? ` ${a.units} %` : '')).join('; '), cat(x.cat), Metrics.pctOf(x, sched),
        st ? t('status.' + st) : '', r && r.critical && x.type !== 'summary' ? t('xp.yes') : '', x.type !== 'summary' && r ? r.slack : '',
        x.realStart, x.realEnd, x.forcedStart, x.notBefore, x.deadline, x.tags.join('; '), x.notes,
      ]);
    }
    return rows;
  }

  const csv = (project, sched, today, opts) => Csv.write(taskRows(project, sched, today, opts));

  /** Classeur de cinq feuilles (EF-94). */
  function xlsx(project, sched, today, { anonymize = false } = {}) {
    const rName = (r, i) => (anonymize ? `${t('init.resource')} ${i + 1}` : r.name);
    const loadOf = r => project.tasks.reduce((a, x) => a + x.assign.filter(z => z.res === r.id).reduce((b, z) => b + x.dur * z.units / 100, 0), 0);
    const cal = project.calendar;
    return Xlsx.build([
      { name: t('xp.sheet.tasks'), rows: taskRows(project, sched, today, { anonymize }) },
      { name: t('xp.sheet.resources'), rows: [[t('res.name'), t('res.role'), t('res.capacity'), t('xp.loadPd')],
        ...project.resources.map((r, i) => [rName(r, i), anonymize ? '' : r.role, r.capacity, Math.round(loadOf(r) * 10) / 10])] },
      { name: t('xp.sheet.absences'), rows: [[t('res.name'), t('cal.from'), t('xp.to'), t('cal.label')],
        ...(anonymize ? [] : project.resources.flatMap((r, i) => r.absences.map(a => [rName(r, i), a.start, a.end, a.label])))] },
      { name: t('xp.sheet.calendar'), rows: [[t('xp.kind'), t('cal.from'), t('xp.to'), t('cal.label')],
        [t('cal.holidays'), '', '', t('cal.set.' + cal.holidays)],
        [t('cal.week'), '', '', cal.workDays.map((v, i) => (v ? I18n.dayName(i) : '')).filter(Boolean).join(' ')],
        ...cal.daysOff.map(d => [t('cal.daysOff'), d.start, d.end, d.label]), ...cal.daysWorked.map(d => [t('cal.daysWorked'), d.start, d.end, d.label])] },
      { name: t('xp.sheet.baselines'), rows: [[t('xp.id'), t('xp.name'), ...project.baselines.flatMap(b => [`${b.name} — ${t('xp.start')}`, `${b.name} — ${t('xp.end')}`])],
        ...project.tasks.filter(x => x.type !== 'summary').map(x => [x.id, x.name, ...project.baselines.flatMap(b => { const bt = b.tasks.find(y => y.id === x.id); return bt ? [bt.start, bt.end] : ['', '']; })])] },
    ]);
  }

  /* ── MS Project XML (EF-95, 8.6) ─────────────────────────────────────────────────────────── */
  const MSP_TYPE = { FF: 0, FS: 1, SF: 2, SS: 3 }, MSP_BACK = ['FF', 'FS', 'SF', 'SS'];
  const X = Xml.escape;

  function mspXml(project, sched) {
    const cal = Calendar.create(project.calendar, project.projectStart);
    const uid = new Map(project.tasks.map((x, i) => [x.id, i + 1]));
    const ruid = new Map(project.resources.map((r, i) => [r.id, i + 1]));
    const level = new Map();
    for (const x of project.tasks) level.set(x.id, x.parent ? level.get(x.parent) + 1 : 1);
    const iso = dn => Dates.toISO(dn);
    const lo = sched.startDn, hi = sched.projectEndDn;
    // Jours fériés et chômés de la période : exceptions non travaillées ; jours travaillés exceptionnels : exceptions travaillées.
    const exc = [];
    for (let dn = lo - 7; dn <= hi + 31; dn++) {
      const info = cal.dayInfo(dn);
      if (!info) continue;
      if ((info.kind === 'holiday' || info.kind === 'off')) exc.push({ dn, working: false, name: info.kind === 'holiday' ? t(info.key) : info.label });
      if (info.kind === 'worked') exc.push({ dn, working: true, name: info.label });
    }
    const wt = '<WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes>';
    const mspDay = k => (k + 1) % 7 + 1; // lundi (0) → 2 … dimanche (6) → 1
    const weekDays = project.calendar.workDays.map((w, k) => `<WeekDay><DayType>${mspDay(k)}</DayType><DayWorking>${w}</DayWorking>${w ? wt : ''}</WeekDay>`).join('');
    const exceptions = exc.map(e => `<Exception><EnteredByOccurrences>0</EnteredByOccurrences><TimePeriod><FromDate>${iso(e.dn)}T00:00:00</FromDate><ToDate>${iso(e.dn)}T23:59:00</ToDate></TimePeriod><Occurrences>1</Occurrences><Name>${X(e.name)}</Name><Type>1</Type><DayWorking>${e.working ? 1 : 0}</DayWorking>${e.working ? wt : ''}</Exception>`).join('');
    const tasks = project.tasks.map(x => {
      const r = sched.tasks.get(x.id);
      const dur = x.type === 'summary' ? (r && !r.empty ? r.d : 0) : x.type === 'milestone' ? 0 : x.dur;
      const start = r && !r.empty ? `${iso(r.startDn)}T08:00:00` : `${project.projectStart}T08:00:00`;
      const finish = r && !r.empty ? `${iso(r.endDn)}T${x.type === 'milestone' ? '08:00:00' : '17:00:00'}` : start;
      let ctype = 0, cdate = '';
      if (x.forcedStart) { ctype = 2; cdate = x.forcedStart; } else if (x.notBefore) { ctype = 4; cdate = x.notBefore; }
      return `<Task><UID>${uid.get(x.id)}</UID><ID>${uid.get(x.id)}</ID><Name>${X(x.name)}</Name><WBS>${X(x.id)}</WBS><OutlineLevel>${level.get(x.id)}</OutlineLevel>` +
        `<Start>${start}</Start><Finish>${finish}</Finish><Duration>PT${dur * 8}H0M0S</Duration><DurationFormat>7</DurationFormat>` +
        `<Milestone>${x.type === 'milestone' ? 1 : 0}</Milestone><Summary>${x.type === 'summary' ? 1 : 0}</Summary><PercentComplete>${Metrics.pctOf(x, sched)}</PercentComplete>` +
        `<ConstraintType>${ctype}</ConstraintType>${cdate ? `<ConstraintDate>${cdate}T08:00:00</ConstraintDate>` : ''}` +
        (x.deadline ? `<Deadline>${x.deadline}T17:00:00</Deadline>` : '') +
        (x.realStart ? `<ActualStart>${x.realStart}T08:00:00</ActualStart>` : '') + (x.realEnd ? `<ActualFinish>${x.realEnd}T17:00:00</ActualFinish>` : '') +
        x.deps.map(d => `<PredecessorLink><PredecessorUID>${uid.get(d.id)}</PredecessorUID><Type>${MSP_TYPE[d.type]}</Type><LinkLag>${d.lag * 4800}</LinkLag><LagFormat>7</LagFormat></PredecessorLink>`).join('') +
        (x.notes ? `<Notes>${X(x.notes)}</Notes>` : '') + '</Task>';
    }).join('');
    const resources = project.resources.map(r => `<Resource><UID>${ruid.get(r.id)}</UID><ID>${ruid.get(r.id)}</ID><Name>${X(r.name)}</Name><Type>1</Type><MaxUnits>${(r.capacity / 100).toFixed(2)}</MaxUnits></Resource>`).join('');
    let auid = 0;
    const assigns = project.tasks.flatMap(x => x.assign.map(a => `<Assignment><UID>${++auid}</UID><TaskUID>${uid.get(x.id)}</TaskUID><ResourceUID>${ruid.get(a.res)}</ResourceUID><Units>${(a.units / 100).toFixed(2)}</Units></Assignment>`)).join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Project xmlns="http://schemas.microsoft.com/project">' +
      `<SaveVersion>14</SaveVersion><Name>${X(project.name)}</Name><Title>${X(project.name)}</Title><StartDate>${project.projectStart}T08:00:00</StartDate>` +
      `<FinishDate>${iso(hi)}T17:00:00</FinishDate><CalendarUID>1</CalendarUID><MinutesPerDay>480</MinutesPerDay><MinutesPerWeek>2400</MinutesPerWeek><DaysPerMonth>20</DaysPerMonth>` +
      `<Calendars><Calendar><UID>1</UID><Name>Standard</Name><IsBaseCalendar>1</IsBaseCalendar><WeekDays>${weekDays}</WeekDays><Exceptions>${exceptions}</Exceptions></Calendar></Calendars>` +
      `<Tasks>${tasks}</Tasks><Resources>${resources}</Resources><Assignments>${assigns}</Assignments></Project>\n`;
  }

  /** XML MS Project → {raw (objet au format 8.2, à contrôler par Model.sanitize), ignored:[libellés]}. */
  function fromMspXml(text) {
    let doc;
    try { doc = Xml.parse(text); } catch { throw new Model.Invalid('imp.unreadable'); }
    const P = Xml.child(doc, 'Project');
    if (!P) throw new Model.Invalid('imp.unreadable');
    const ignored = new Set();
    const day = s => (s || '').slice(0, 10);
    const calUid = Xml.textOf(P, 'CalendarUID') || '1';
    const cals = Xml.children(Xml.child(P, 'Calendars'), 'Calendar');
    const base = cals.find(c => Xml.textOf(c, 'UID') === calUid) || cals[0];
    const calendar = { workDays: [1, 1, 1, 1, 1, 0, 0], holidays: 'NONE', daysOff: [], daysWorked: [] };
    if (base) {
      for (const wd of Xml.children(Xml.child(base, 'WeekDays'), 'WeekDay')) {
        const dt = Number(Xml.textOf(wd, 'DayType'));
        if (dt >= 1 && dt <= 7 && !Xml.child(wd, 'TimePeriod')) calendar.workDays[(dt + 5) % 7] = Xml.textOf(wd, 'DayWorking') === '1' ? 1 : 0;
      }
      for (const e of [...Xml.children(Xml.child(base, 'Exceptions'), 'Exception'), ...Xml.children(Xml.child(base, 'WeekDays'), 'WeekDay').filter(w => Xml.child(w, 'TimePeriod'))]) {
        const tp = Xml.child(e, 'TimePeriod');
        const from = day(Xml.textOf(tp, 'FromDate')), to = day(Xml.textOf(tp, 'ToDate')) || from;
        if (!Dates.parse(from)) continue;
        const entry = { start: from, end: Dates.parse(to) != null && to >= from ? to : from, label: Xml.textOf(e, 'Name').slice(0, 100) };
        (Xml.textOf(e, 'DayWorking') === '1' ? calendar.daysWorked : calendar.daysOff).push(entry);
      }
      if (cals.length > 1) ignored.add(t('msp.ign.calendars'));
    }
    const rows = Xml.children(Xml.child(P, 'Tasks'), 'Task')
      .filter(x => Xml.textOf(x, 'UID') !== '0' && Xml.textOf(x, 'IsNull') !== '1')
      .sort((a, b) => Number(Xml.textOf(a, 'ID')) - Number(Xml.textOf(b, 'ID')));
    const used = new Set(), byUid = new Map(), stack = [];
    const tasks = rows.map(x => {
      const wbs = Xml.textOf(x, 'WBS').toUpperCase();
      let id = Model.ID_RE.test(wbs) && !used.has(wbs) ? wbs : '';
      if (!id) id = Model.nextTaskId([...used]);
      used.add(id);
      byUid.set(Xml.textOf(x, 'UID'), id);
      const lvl = Math.max(1, Number(Xml.textOf(x, 'OutlineLevel')) || 1);
      stack.length = lvl - 1;
      const parent = stack.length ? stack[stack.length - 1] : '';
      const summary = Xml.textOf(x, 'Summary') === '1', milestone = Xml.textOf(x, 'Milestone') === '1';
      stack[lvl - 1] = id;
      const m = /PT(\d+)H(\d+)M/.exec(Xml.textOf(x, 'Duration'));
      const hours = m ? Number(m[1]) + Number(m[2]) / 60 : 8;
      const ct = Number(Xml.textOf(x, 'ConstraintType') || 0), cd = day(Xml.textOf(x, 'ConstraintDate'));
      if (ct && ct !== 2 && ct !== 4) ignored.add(t('msp.ign.constraint', { n: ct }));
      for (const k of ['Cost', 'Work', 'FixedCost', 'ActualCost', 'ActualWork']) if (Number(Xml.textOf(x, k).replace(/[^\d.]/g, '')) > 0) ignored.add(t('msp.ign.' + (k.includes('Cost') ? 'cost' : 'work')));
      const pct = Math.max(0, Math.min(100, Math.round(Number(Xml.textOf(x, 'PercentComplete')) || 0)));
      const realEnd = day(Xml.textOf(x, 'ActualFinish'));
      return {
        uid: Xml.textOf(x, 'UID'), id, name: (Xml.textOf(x, 'Name') || id).slice(0, 200), parent,
        type: summary ? 'summary' : milestone ? 'milestone' : 'task',
        dur: summary || milestone ? 0 : Math.min(Model.LIMITS.dur, Math.max(1, Math.ceil(hours / 8))),
        pct: milestone ? (pct >= 100 ? 100 : 0) : summary ? 0 : (realEnd ? 100 : pct),
        forcedStart: summary ? '' : ct === 2 ? cd : '', notBefore: summary ? '' : ct === 4 ? cd : '',
        deadline: summary ? '' : day(Xml.textOf(x, 'Deadline')),
        realStart: summary || milestone ? '' : day(Xml.textOf(x, 'ActualStart')), realEnd: summary || milestone ? '' : realEnd,
        notes: Xml.textOf(x, 'Notes').slice(0, 2000), links: summary ? [] : Xml.children(x, 'PredecessorLink'),
      };
    });
    const resources = Xml.children(Xml.child(P, 'Resources'), 'Resource').filter(r => Xml.textOf(r, 'UID') !== '0' && Xml.textOf(r, 'Name'))
      .map(r => ({ uid: Xml.textOf(r, 'UID'), name: Xml.textOf(r, 'Name').slice(0, 100), capacity: Math.max(1, Math.min(100, Math.round((Number(Xml.textOf(r, 'MaxUnits')) || 1) * 100))) }));
    if (Xml.children(Xml.child(P, 'Resources'), 'Resource').some(r => Xml.textOf(r, 'CalendarUID') && Xml.textOf(r, 'CalendarUID') !== calUid && Xml.textOf(r, 'CalendarUID') !== '-1')) ignored.add(t('msp.ign.resCalendars'));
    const resByUid = new Map(resources.map(r => [r.uid, r]));
    const assign = new Map();
    for (const a of Xml.children(Xml.child(P, 'Assignments'), 'Assignment')) {
      const r = resByUid.get(Xml.textOf(a, 'ResourceUID')), tid = Xml.textOf(a, 'TaskUID');
      if (!r) continue;
      let units = Math.round((Number(Xml.textOf(a, 'Units')) || 1) * 100);
      if (units > r.capacity) { units = r.capacity; ignored.add(t('msp.ign.units')); }
      (assign.get(tid) || assign.set(tid, []).get(tid)).push({ res: r.name, units: Math.max(1, units) });
    }
    const raw = {
      format: 3, name: (Xml.textOf(P, 'Title') || Xml.textOf(P, 'Name') || 'Projet MS Project').slice(0, 60),
      projectStart: day(Xml.textOf(P, 'StartDate')) || Dates.toISO(Dates.todayDn()), calendar, leveling: 'smooth',
      tasks: tasks.map(x => ({
        id: x.id, name: x.name, type: x.type, parent: x.parent, dur: x.dur, pct: x.pct,
        deps: x.links.map(l => ({ id: byUid.get(Xml.textOf(l, 'PredecessorUID')), type: MSP_BACK[Number(Xml.textOf(l, 'Type'))] || 'FS',
          lag: Math.max(-365, Math.min(365, Math.round((Number(Xml.textOf(l, 'LinkLag')) || 0) / 4800))) })).filter(d => d.id && d.id !== x.id),
        assign: x.type === 'task' ? (assign.get(x.uid) || []) : [],
        forcedStart: x.forcedStart, notBefore: x.notBefore, deadline: x.deadline, realStart: x.realStart, realEnd: x.realEnd, notes: x.notes,
      })),
      resources: resources.map(r => ({ name: r.name, capacity: r.capacity })),
      categories: [], baselines: [],
    };
    return { raw, ignored: [...ignored] };
  }

  /* ── Import de tâches depuis un tableau (EF-96, RG-30) ─────────────────────────────────── */
  const FIELDS = ['id', 'num', 'name', 'type', 'parent', 'dur', 'deps', 'res', 'cat', 'pct', 'tags', 'notes', 'forcedStart', 'notBefore', 'deadline'];
  const SYN = {
    id: ['identifiant', 'id', 'code'], num: ['n°', 'n', 'no', 'numero', 'num', 'number', 'ligne', 'row', '#', 'wbs', 'edt'], name: ['nom', 'name', 'activite', 'activity', 'tache', 'task', 'libelle'],
    type: ['type'], parent: ['parent', 'recapitulative', 'summary'], dur: ['duree', 'duration', 'jours', 'days'],
    deps: ['predecesseurs', 'predecessors', 'dependances', 'dependencies', 'dep'], res: ['ressource', 'ressources', 'resource', 'resources'],
    cat: ['categorie', 'category'], pct: ['avancement', 'progress', '% acheve', 'percent complete'], tags: ['etiquettes', 'tags', 'etiquette'],
    notes: ['notes', 'note', 'commentaire'], forcedStart: ['debut impose', 'date imposee', 'fixed start date', 'fixed start', 'must start on'],
    notBefore: ['ne pas commencer avant', 'start no earlier than', 'pas avant'], deadline: ['echeance', 'deadline'],
  };
  const norm = s => View.fold(String(s)).replace(/[^a-z0-9%° ]/g, ' ').replace(/\s+/g, ' ').trim();

  /** Association automatique des colonnes à partir de la première ligne (RG-30). */
  function guessMapping(header) {
    const map = {};
    header.forEach((h, i) => {
      const n = norm(h);
      for (const f of FIELDS) if (map[f] === undefined && SYN[f].includes(n)) { map[f] = i; break; }
    });
    return map;
  }

  function parseDate(v) {
    if (typeof v === 'number' && v > 20000 && v < 120000) return Dates.toISO(Math.round(v) - 25569); // date série Excel
    const s = String(v ?? '').trim();
    if (!s) return '';
    if (Dates.parse(s) != null) return s;
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    if (m) { const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; if (Dates.parse(iso) != null) return iso; }
    return null;
  }

  /**
   * Lignes → tâches au format 8.2. Renvoie {tasks, resources, categories, errors:[{line, msg}], valid}.
   * Une ligne en erreur est écartée ; les autres sont gardées. Les prédécesseurs désignent les
   * identifiants du fichier, sinon des tâches existantes du projet (RG-30). Sans colonne
   * d'identifiant, une colonne « N° » sert de référence pour les liens et les parents : les tâches
   * reçoivent alors de nouveaux identifiants et les liens suivent.
   */
  function rowsToTasks(rows, map, existing, { skipHeader = true } = {}) {
    const data = rows.slice(skipHeader ? 1 : 0);
    if (data.length > 1000) throw new Model.Invalid('imp.tooMany', { what: 'lignes', max: 1000 });
    const get = (r, f) => (map[f] === undefined ? '' : r[map[f]] ?? '');
    const errors = [], out = [];
    const fileIds = new Set();
    const refOf = r => String(get(r, 'id')).trim().toUpperCase() || String(get(r, 'num')).trim().toUpperCase();
    for (const r of data) { const id = refOf(r); if (Model.ID_RE.test(id)) fileIds.add(id); }
    const known = new Set([...fileIds, ...existing]);
    data.forEach((r, k) => {
      const line = k + (skipHeader ? 2 : 1);
      const LABEL = { name: 'xp.name', dur: 'xp.dur', pct: 'xp.pct', deps: 'xp.deps', res: 'xp.res', forcedStart: 'xp.forced', notBefore: 'xp.notBefore', deadline: 'xp.deadline' };
      const fail = (field, msg) => errors.push({ line, msg: `${t(LABEL[field])} : ${msg}` });
      const before = errors.length;
      const name = String(get(r, 'name')).trim();
      if (!name || name.length > 200) fail('name', t('rule.text', { min: 1, max: 200 }));
      const typeRaw = norm(get(r, 'type'));
      let type = ['jalon', 'milestone'].includes(typeRaw) ? 'milestone' : ['recapitulative', 'summary task', 'summary'].includes(typeRaw) ? 'summary' : 'task';
      let dur = 5;
      const dRaw = String(get(r, 'dur')).trim();
      if (dRaw !== '') {
        const m = /^(\d+)\s*(j|d|jours?|days?)?$/i.exec(dRaw);
        if (!m) fail('dur', t('imp.durFormat'));
        else { dur = Number(m[1]); if (dur === 0 && type === 'task') type = 'milestone'; else if (type === 'task' && (dur < 1 || dur > Model.LIMITS.dur)) fail('dur', t('rule.int', { min: 1, max: '3 650' })); }
      }
      let pct = 0;
      const pRaw = String(get(r, 'pct')).replace('%', '').trim();
      if (pRaw !== '') { pct = Number(pRaw.replace(',', '.')); if (!Number.isFinite(pct) || pct < 0 || pct > 100) fail('pct', t('rule.int', { min: 0, max: 100 })); else pct = Math.round(pct); }
      const deps = [];
      for (const part of String(get(r, 'deps')).split(/[;,]/).map(x => x.trim()).filter(Boolean)) {
        const m = /^([A-Za-z0-9._-]{1,12})(?:\s+([A-Za-z]{2})\s*([+\-−]\s*\d+)?)?$/.exec(part);
        if (!m || (m[2] && !LINK_IN[m[2].toUpperCase()])) { fail('deps', t('imp.depFormat', { value: part })); continue; }
        const id = m[1].toUpperCase();
        if (!known.has(id)) { fail('deps', t('imp.missingDep', { id })); continue; }
        const lag = m[3] ? Number(m[3].replace(/\s/g, '').replace('\u2212', '-')) : 0;
        if (Math.abs(lag) > Model.LIMITS.lag) { fail('deps', t('rule.int', { min: -365, max: 365 })); continue; }
        deps.push({ id, type: m[2] ? LINK_IN[m[2].toUpperCase()] : 'FS', lag });
      }
      const assign = [];
      for (const part of String(get(r, 'res')).split(';').map(x => x.trim()).filter(Boolean)) {
        const m = /^(.*?)(?:\s+(\d{1,3})\s*%)?$/.exec(part);
        const units = m[2] ? Number(m[2]) : 100;
        if (!m[1] || m[1].length > 100 || units < 1 || units > 100) { fail('res', t('imp.resFormat', { value: part })); continue; }
        assign.push({ res: m[1].trim(), units });
      }
      const dates = {};
      for (const f of ['forcedStart', 'notBefore', 'deadline']) { const v = parseDate(get(r, f)); if (v === null) fail(f, t('rule.date')); else dates[f] = v; }
      const tags = String(get(r, 'tags')).split(/[;,]/).map(x => x.trim()).filter(Boolean).slice(0, Model.LIMITS.tags).map(x => x.slice(0, 30));
      if (errors.length > before) return;
      out.push({
        fileId: String(get(r, 'id')).trim().toUpperCase(), ref: refOf(r), name, type, parent: String(get(r, 'parent')).trim().toUpperCase(),
        dur: type === 'task' ? dur : 0, pct: type === 'milestone' ? (pct >= 100 ? 100 : 0) : type === 'summary' ? 0 : pct,
        deps: type === 'summary' ? [] : deps, assign: type === 'task' ? assign : [], cat: String(get(r, 'cat')).trim().slice(0, 100),
        tags, notes: String(get(r, 'notes')).slice(0, 2000), ...dates, line,
      });
    });
    return { rows: out, errors, total: data.length };
  }

  /**
   * Fusionne les lignes valides dans le projet (ajout ou remplacement), au format 8.2, puis contrôle
   * le tout par Model.sanitize. Renvoie {project, added:[ids]} ou lève Model.Invalid.
   */
  function mergeRows(project, rows, mode) {
    const file = Model.serialize(project, { withVersions: true });
    if (mode === 'replace') file.tasks = [];
    const used = new Set(file.tasks.map(x => x.id));
    const remap = new Map();
    // Identifiant du fichier gardé s'il est libre ; sinon un identifiant libre, et les liens suivent.
    const ids = rows.map(r => {
      const id = Model.ID_RE.test(r.fileId) && !used.has(r.fileId) ? r.fileId : Model.nextTaskId([...used]);
      used.add(id);
      if (r.ref || r.fileId) remap.set(r.ref || r.fileId, id);
      return id;
    });
    const fix = id => remap.get(id) || id;
    rows.forEach((r, i) => file.tasks.push({
      id: ids[i], name: r.name, type: r.type, parent: r.parent ? fix(r.parent) : '', dur: r.dur, pct: r.pct,
      deps: r.deps.map(d => ({ id: fix(d.id), type: d.type, lag: d.lag })), assign: r.assign, cat: r.cat, tags: r.tags, notes: r.notes,
      forcedStart: r.forcedStart || '', notBefore: r.notBefore || '', deadline: r.deadline || '',
    }));
    const { project: p } = Model.sanitize(file);
    return { project: p, added: ids };
  }

  return { taskRows, csv, xlsx, mspXml, fromMspXml, guessMapping, rowsToTasks, mergeRows, FIELDS, outline };
})();
