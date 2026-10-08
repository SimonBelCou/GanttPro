/* Données du projet : limites (3.7), projet initial (3.8), contrôle complet d'un fichier (8.3)
 * et écriture au format 3 (8.2).
 *
 * Sécurité (A03, A08 – SECURITY.md) : un fichier importé est une donnée NON FIABLE. Il n'est
 * jamais copié tel quel : chaque objet est reconstruit champ par champ à partir d'une liste
 * blanche, chaque valeur est contrôlée (type, longueur, bornes, format), et toute erreur refuse
 * le fichier entier sans toucher au projet ouvert (EX-14). Les messages sont des clés de
 * traduction avec paramètres : ils ne contiennent jamais de HTML. */
const Model = (() => {
  const FORMAT = 3;
  const MAX_BYTES = 5 * 1024 * 1024;
  const LIMITS = Object.freeze({
    tasks: 1000, depth: 5, resources: 100, categories: 100, deps: 50, assign: 10, tags: 10, projectTags: 200,
    comments: 50, absences: 100, calendarDays: 366, baselines: 3, versions: 10, dur: 3650, lag: 365,
  });
  const ID_RE = /^[A-Z0-9._-]{1,12}$/;
  const COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  const EMOJIS = Object.freeze(['🚁', '🚀', '🏗️', '💡', '🎯', '📱', '🌍', '⚙️', '🔬', '🎨', '🏭', '📦', '🔧', '🛸', '🌿', '🏆', '📊', '🔐', '🚂', '💊', '📁']);
  const PALETTE = Object.freeze(['#4d9fff', '#ff5757', '#36d9a0', '#f0b429', '#b57bff', '#ff9a3c', '#e879f9', '#34d399', '#fb923c', '#38bdf8']);
  const BASELINE_COLORS = Object.freeze(['#f0b429', '#e879f9', '#ff9a3c', '#38bdf8', '#34d399', '#ff5757']);
  const LINK_TYPES = Object.freeze(['FS', 'SS', 'FF', 'SF']);
  const TYPES = Object.freeze(['task', 'milestone', 'summary']);

  /** Erreur de contrôle : clé de message + paramètres (texte brut, jamais interprété). */
  class Invalid extends Error {
    constructor(key, params = {}) { super(key); this.key = key; this.params = params; }
  }
  const fail = (key, params) => { throw new Invalid(key, params); };

  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const lower = s => s.toLocaleLowerCase('fr');

  /** Lecteur de champs d'un objet du fichier : compte les champs inconnus, contrôle chaque valeur. */
  function reader(src, where, allowed, stats) {
    for (const k of Object.keys(src)) if (!allowed.includes(k)) stats.unknown++;
    const err = (field, rule, extra = {}) => fail('imp.field', { ...where, field, rule, ...extra });
    const present = k => has(src, k) && src[k] !== undefined && src[k] !== null;
    return {
      present,
      text(k, { min = 0, max, def = '', trim = false } = {}) {
        if (!present(k)) { if (min > 0 && def === '') err(k, 'rule.text', { min, max }); return def; }
        if (typeof src[k] !== 'string') err(k, 'rule.text', { min, max });
        const v = trim ? src[k].trim() : src[k];
        if (v.length < min || v.length > max) err(k, 'rule.text', { min, max });
        return v;
      },
      int(k, { min, max, def }) {
        if (!present(k)) return def;
        const v = src[k];
        if (!Number.isInteger(v) || v < min || v > max) err(k, 'rule.int', { min, max });
        return v;
      },
      num(k, { def = 0 } = {}) {
        if (!present(k)) return def;
        if (typeof src[k] !== 'number' || !Number.isFinite(src[k]) || src[k] < 0) err(k, 'rule.number');
        return src[k];
      },
      bool(k, def = false) {
        if (!present(k)) return def;
        if (typeof src[k] !== 'boolean') err(k, 'rule.bool');
        return src[k];
      },
      date(k, { required = false, def = '' } = {}) {
        if (!present(k) || src[k] === '') { if (required) err(k, 'rule.date'); return def; }
        if (Dates.parse(src[k]) == null) err(k, 'rule.date');
        return src[k];
      },
      color(k, def) {
        if (!present(k)) return def;
        if (typeof src[k] !== 'string' || !COLOR_RE.test(src[k])) err(k, 'rule.color');
        return src[k];
      },
      oneOf(k, values, def) {
        if (!present(k)) return def;
        if (!values.includes(src[k])) err(k, 'rule.enum', { values: values.join(', ') });
        return src[k];
      },
      list(k, max) {
        if (!present(k)) return [];
        if (!Array.isArray(src[k])) err(k, 'rule.list', { max });
        if (src[k].length > max) err(k, 'rule.list', { max });
        return src[k];
      },
      obj(k) {
        if (!present(k)) return null;
        if (!isObj(src[k])) err(k, 'rule.object');
        return src[k];
      },
      raw: k => src[k],
    };
  }

  function ranges(list, where, field, stats, maxDays) {
    let days = 0;
    return list.map((r, i) => {
      if (!isObj(r)) fail('imp.field', { ...where, field, rule: 'rule.object' });
      const f = reader(r, { ...where, field }, ['start', 'end', 'label'], stats);
      const start = f.date('start', { required: true });
      const end = f.date('end', { def: start }) || start;
      if (Dates.parse(end) < Dates.parse(start)) fail('imp.rangeOrder', { ...where, field, n: i + 1 });
      days += Dates.parse(end) - Dates.parse(start) + 1;
      if (maxDays && days > maxDays) fail('imp.tooMany', { what: field, max: maxDays });
      return { start, end, label: f.text('label', { max: 100 }) };
    });
  }

  function sanitizeCalendar(src, stats) {
    if (src == null) return { workDays: [1, 1, 1, 1, 1, 0, 0], holidays: 'FR', daysOff: [], daysWorked: [] };
    if (!isObj(src)) fail('imp.field', { obj: 'project', field: 'calendar', rule: 'rule.object' });
    const where = { obj: 'calendar' };
    const f = reader(src, where, ['workDays', 'holidays', 'daysOff', 'daysWorked'], stats);
    let workDays = [1, 1, 1, 1, 1, 0, 0];
    if (f.present('workDays')) {
      const w = f.raw('workDays');
      if (!Array.isArray(w) || w.length !== 7 || !w.every(v => v === 0 || v === 1)) fail('imp.field', { ...where, field: 'workDays', rule: 'rule.week' });
      workDays = w.slice();
    }
    if (!workDays.includes(1)) fail('imp.noWorkday');
    const holidays = f.oneOf('holidays', Calendar.HOLIDAY_SETS, 'FR');
    const daysOff = ranges(f.list('daysOff', LIMITS.calendarDays), where, 'daysOff', stats, LIMITS.calendarDays);
    const daysWorked = ranges(f.list('daysWorked', LIMITS.calendarDays), where, 'daysWorked', stats, LIMITS.calendarDays);
    const offSet = new Set();
    for (const r of daysOff) for (let d = Dates.parse(r.start); d <= Dates.parse(r.end); d++) offSet.add(d);
    for (const r of daysWorked) for (let d = Dates.parse(r.start); d <= Dates.parse(r.end); d++) if (offSet.has(d)) fail('imp.calendarClash', { date: Dates.toISO(d) });
    return { workDays, holidays, daysOff, daysWorked };
  }

  /** Recherche d'une boucle de dépendances (RG-09) ; renvoie le chemin ['A','B','A'] ou null. */
  function findCycle(tasks) {
    const deps = new Map(tasks.map(t => [t.id, t.deps.map(d => d.id)]));
    const state = new Map(), stack = [];
    function visit(id) {
      state.set(id, 1); stack.push(id);
      for (const p of deps.get(id) || []) {
        if (state.get(p) === 1) return stack.slice(stack.indexOf(p)).concat(p);
        if (!state.has(p)) { const c = visit(p); if (c) return c; }
      }
      state.set(id, 2); stack.pop();
      return null;
    }
    for (const t of tasks) if (!state.has(t.id)) { const c = visit(t.id); if (c) return c.reverse(); }
    return null;
  }

  /** Ancêtres d'une tâche (du parent à la racine). */
  function ancestors(byId, id) {
    const out = [];
    let cur = byId.get(id);
    while (cur && cur.parent) { out.push(cur.parent); cur = byId.get(cur.parent); if (out.length > LIMITS.depth + 1) break; }
    return out;
  }

  /**
   * Contrôle complet d'un objet projet (section 8.3).
   * @returns {{project, notices:{unknown:number, createdResources:string[], createdCategories:string[]}}}
   * @throws {Invalid}
   */
  function sanitize(raw, { nested = false } = {}) {
    const stats = { unknown: 0 };
    if (!isObj(raw)) fail('imp.unreadable');
    if (has(raw, 'format') && !(Number.isInteger(raw.format) && raw.format >= 1)) fail('imp.field', { obj: 'project', field: 'format', rule: 'rule.int', min: 1, max: FORMAT });
    if (raw.format > FORMAT) fail('imp.newer');
    if (!Array.isArray(raw.tasks)) fail('imp.noTasks');
    const P = reader(raw, { obj: 'project' }, ['format', 'id', 'createdAt', 'name', 'desc', 'emoji', 'projectStart', 'reportNote', 'calendar',
      'tasks', 'resources', 'categories', 'baselines', 'versions'], stats);

    const lim = (list, max, what) => { if (list.length > max) fail('imp.tooMany', { what, max }); return list; };
    const rawTasks = lim(raw.tasks, LIMITS.tasks, 'tasks');
    const rawRes = lim(P.list('resources', Infinity), LIMITS.resources, 'resources');
    const rawCats = lim(P.list('categories', Infinity), LIMITS.categories, 'categories');
    const rawBl = lim(P.list('baselines', Infinity), LIMITS.baselines, 'baselines');
    const rawVer = nested ? [] : lim(P.list('versions', Infinity), LIMITS.versions, 'versions');
    if (nested && P.present('versions')) fail('imp.field', { obj: 'version', field: 'versions', rule: 'rule.absent' });

    const project = {
      id: P.text('id', { max: 64, def: '' }),
      createdAt: P.num('createdAt', { def: 0 }),
      name: P.text('name', { min: 1, max: 60, def: 'Nouveau projet', trim: true }) || 'Nouveau projet',
      desc: P.text('desc', { max: 500 }),
      emoji: P.oneOf('emoji', EMOJIS, '📁'),
      projectStart: P.date('projectStart', { def: Dates.toISO(Dates.todayDn()) }),
      reportNote: P.text('reportNote', { max: 2000 }),
      calendar: sanitizeCalendar(P.raw('calendar'), stats),
    };
    if (project.id && !/^[A-Za-z0-9._-]+$/.test(project.id)) fail('imp.field', { obj: 'project', field: 'id', rule: 'rule.ident' });

    // Ressources et catégories : identités internes neuves ; les noms doivent être uniques (casse ignorée).
    const resources = [], resByName = new Map();
    rawRes.forEach((r, i) => {
      const where = { obj: 'resource', n: i + 1 };
      if (!isObj(r)) fail('imp.field', { ...where, field: '', rule: 'rule.object' });
      const f = reader(r, where, ['id', 'name', 'role', 'color', 'capacity', 'absences'], stats);
      const name = f.text('name', { min: 1, max: 100, trim: true });
      if (resByName.has(lower(name))) fail('imp.dupResource', { name });
      const res = {
        id: 'R' + (i + 1), name, role: f.text('role', { max: 100 }),
        color: f.color('color', PALETTE[i % PALETTE.length]),
        capacity: f.int('capacity', { min: 1, max: 100, def: 100 }),
        absences: ranges(f.list('absences', LIMITS.absences), where, 'absences', stats),
      };
      if (f.present('id') && (typeof r.id !== 'string' || r.id.length > 64)) fail('imp.field', { ...where, field: 'id', rule: 'rule.ident' });
      resources.push(res); resByName.set(lower(name), res);
    });
    const categories = [], catByName = new Map();
    rawCats.forEach((c, i) => {
      const where = { obj: 'category', n: i + 1 };
      if (!isObj(c)) fail('imp.field', { ...where, field: '', rule: 'rule.object' });
      const f = reader(c, where, ['id', 'name', 'color'], stats);
      const name = f.text('name', { min: 1, max: 100, trim: true });
      if (catByName.has(lower(name))) fail('imp.dupCategory', { name });
      if (f.present('id') && (typeof c.id !== 'string' || c.id.length > 64)) fail('imp.field', { ...where, field: 'id', rule: 'rule.ident' });
      const cat = { id: 'C' + (i + 1), name, color: f.color('color', PALETTE[i % PALETTE.length]) };
      categories.push(cat); catByName.set(lower(name), cat);
    });
    const createdResources = [], createdCategories = [];
    const resolveRes = name => {
      let r = resByName.get(lower(name));
      if (!r) {
        if (resources.length >= LIMITS.resources) fail('imp.tooMany', { what: 'resources', max: LIMITS.resources });
        r = { id: 'R' + (resources.length + 1), name, role: '', color: PALETTE[resources.length % PALETTE.length], capacity: 100, absences: [] };
        resources.push(r); resByName.set(lower(name), r); createdResources.push(name);
      }
      return r;
    };
    const resolveCat = name => {
      let c = catByName.get(lower(name));
      if (!c) {
        if (categories.length >= LIMITS.categories) fail('imp.tooMany', { what: 'categories', max: LIMITS.categories });
        c = { id: 'C' + (categories.length + 1), name, color: PALETTE[categories.length % PALETTE.length] };
        categories.push(c); catByName.set(lower(name), c); createdCategories.push(name);
      }
      return c;
    };

    // Tâches.
    const ids = new Set(), tagSet = new Set();
    const tasks = rawTasks.map((t, i) => {
      const where = { obj: 'task', n: i + 1 };
      if (!isObj(t)) fail('imp.field', { ...where, field: '', rule: 'rule.object' });
      const f = reader(t, where, ['id', 'name', 'type', 'parent', 'dur', 'deps', 'res', 'assign', 'cat', 'pct', 'forcedStart', 'notBefore',
        'deadline', 'realStart', 'realEnd', 'tags', 'notes', 'comments', 'collapsed'], stats);
      if (typeof t.id !== 'string' || !ID_RE.test(t.id)) fail('imp.badId', { n: i + 1 });
      if (ids.has(t.id)) fail('imp.dupId', { id: t.id });
      ids.add(t.id);
      const type = f.oneOf('type', TYPES, 'task');
      const isTask = type === 'task';
      let dur = 0;
      if (isTask) dur = f.int('dur', { min: 1, max: LIMITS.dur, def: 5 });
      else if (type === 'milestone') f.int('dur', { min: 0, max: 0, def: 0 });
      else f.int('dur', { min: 0, max: LIMITS.dur, def: 0 });
      let pct = f.int('pct', { min: 0, max: 100, def: 0 });
      if (type === 'milestone' && pct !== 0 && pct !== 100) fail('imp.field', { ...where, field: 'pct', rule: 'rule.milestonePct' });
      if (type === 'summary') pct = 0;

      const deps = f.list('deps', LIMITS.deps).map(d => {
        if (typeof d === 'string') return { id: d, type: 'FS', lag: 0 };
        if (!isObj(d)) fail('imp.field', { ...where, field: 'deps', rule: 'rule.link' });
        const g = reader(d, { ...where, field: 'deps' }, ['id', 'type', 'lag'], stats);
        if (typeof d.id !== 'string') fail('imp.field', { ...where, field: 'deps', rule: 'rule.link' });
        return { id: d.id, type: g.oneOf('type', LINK_TYPES, 'FS'), lag: g.int('lag', { min: -LIMITS.lag, max: LIMITS.lag, def: 0 }) };
      });

      let assign;
      if (f.present('assign')) {
        assign = f.list('assign', LIMITS.assign).map(a => {
          if (!isObj(a)) fail('imp.field', { ...where, field: 'assign', rule: 'rule.object' });
          const g = reader(a, { ...where, field: 'assign' }, ['res', 'units'], stats);
          const name = g.text('res', { min: 1, max: 100, trim: true });
          return { name, units: g.int('units', { min: 1, max: 100, def: 100 }) };
        });
      } else {
        const name = f.text('res', { max: 100, trim: true });
        assign = name ? [{ name, units: 100 }] : [];
      }
      if (!isTask && assign.length) fail(type === 'summary' ? 'imp.summaryField' : 'imp.milestoneRes', { n: i + 1, id: t.id, field: 'assign' });
      const seenRes = new Set();
      assign = assign.map(a => {
        const r = resolveRes(a.name);
        if (seenRes.has(r.id)) fail('imp.dupAssign', { n: i + 1, name: r.name });
        seenRes.add(r.id);
        if (a.units > r.capacity) fail('imp.overCapacity', { n: i + 1, units: a.units, capacity: r.capacity, name: r.name });
        return { res: r.id, units: a.units };
      });

      const catName = f.text('cat', { max: 100, trim: true });
      const cat = catName ? resolveCat(catName).id : '';

      const task = {
        id: t.id, name: f.text('name', { min: 1, max: 200, trim: true }), type, parent: f.text('parent', { max: 12 }), dur, deps, assign, cat, pct,
        forcedStart: f.date('forcedStart'), notBefore: f.date('notBefore'), deadline: f.date('deadline'),
        realStart: f.date('realStart'), realEnd: f.date('realEnd'),
        tags: [], notes: f.text('notes', { max: 2000 }), comments: [], collapsed: false,
      };
      if (task.realStart && task.realEnd && task.realEnd < task.realStart) fail('imp.realOrder', { n: i + 1 });
      if (task.realEnd && task.pct < 100 && type !== 'summary') fail('imp.realEndPct', { n: i + 1 });
      if (type === 'summary' && (deps.length || task.forcedStart || task.notBefore || task.deadline)) fail('imp.summaryField', { n: i + 1, id: t.id });
      const tagsSeen = new Set();
      task.tags = f.list('tags', LIMITS.tags).map(tag => {
        if (typeof tag !== 'string' || !tag.trim() || tag.trim().length > 30) fail('imp.field', { ...where, field: 'tags', rule: 'rule.text', min: 1, max: 30 });
        const v = tag.trim();
        if (tagsSeen.has(lower(v))) fail('imp.field', { ...where, field: 'tags', rule: 'rule.unique' });
        tagsSeen.add(lower(v)); tagSet.add(lower(v));
        return v;
      });
      task.comments = f.list('comments', LIMITS.comments).map(c => {
        if (!isObj(c)) fail('imp.field', { ...where, field: 'comments', rule: 'rule.object' });
        const g = reader(c, { ...where, field: 'comments' }, ['ts', 'text'], stats);
        return { ts: g.num('ts'), text: g.text('text', { min: 1, max: 500 }) };
      });
      task.collapsed = type === 'summary' ? f.bool('collapsed') : (f.bool('collapsed'), false);
      return task;
    });
    if (tagSet.size > LIMITS.projectTags) fail('imp.tooMany', { what: 'tags', max: LIMITS.projectTags });

    // Hiérarchie (RG-23).
    const byId = new Map(tasks.map(t => [t.id, t]));
    tasks.forEach((t, i) => {
      if (!t.parent) return;
      const p = byId.get(t.parent);
      if (!p || p.type !== 'summary' || p.id === t.id) fail('imp.badParent', { n: i + 1, parent: t.parent });
      const up = ancestors(byId, t.id);
      if (up.includes(t.id)) fail('imp.parentCycle', { id: t.id });
      if (up.length > LIMITS.depth) fail('imp.tooDeep', { id: t.id, max: LIMITS.depth });
    });
    // Liens.
    tasks.forEach((t, i) => {
      const seen = new Set();
      const up = new Set(ancestors(byId, t.id));
      for (const d of t.deps) {
        const p = byId.get(d.id);
        if (!p) fail('imp.missingPred', { n: i + 1, pred: d.id });
        if (d.id === t.id) fail('imp.selfLink', { n: i + 1 });
        if (seen.has(d.id)) fail('imp.dupLink', { n: i + 1, pred: d.id });
        if (p.type === 'summary') fail('imp.linkSummary', { n: i + 1, pred: d.id });
        if (up.has(d.id) || ancestors(byId, d.id).includes(t.id)) fail('imp.linkHierarchy', { n: i + 1, pred: d.id });
        seen.add(d.id);
      }
    });
    const cycle = findCycle(tasks);
    if (cycle) fail('imp.cycle', { path: cycle.join(' → ') });

    // Baselines : copies figées, contrôlées pour leur forme.
    const baselines = rawBl.map((b, i) => {
      const where = { obj: 'baseline', n: i + 1 };
      if (!isObj(b)) fail('imp.field', { ...where, field: '', rule: 'rule.object' });
      const f = reader(b, where, ['id', 'name', 'color', 'createdAt', 'projectStart', 'shownOnGantt', 'shownOnScurve', 'tasks'], stats);
      const bl = {
        id: 'B' + (i + 1), name: f.text('name', { min: 1, max: 100, trim: true }), color: f.color('color', BASELINE_COLORS[i % BASELINE_COLORS.length]),
        createdAt: f.num('createdAt'), projectStart: f.date('projectStart', { def: project.projectStart }),
        shownOnGantt: f.bool('shownOnGantt', true), shownOnScurve: f.bool('shownOnScurve', true), tasks: [],
      };
      if (f.present('id') && (typeof b.id !== 'string' || b.id.length > 64)) fail('imp.field', { ...where, field: 'id', rule: 'rule.ident' });
      bl.tasks = f.list('tasks', LIMITS.tasks).map((bt, j) => {
        const w = { obj: 'baselineTask', n: j + 1, baseline: i + 1 };
        if (!isObj(bt)) fail('imp.field', { ...w, field: '', rule: 'rule.object' });
        const g = reader(bt, w, ['id', 'name', 'dur', 'deps', 'cat', 'start', 'end'], stats);
        if (typeof bt.id !== 'string' || !ID_RE.test(bt.id)) fail('imp.badId', { n: j + 1 });
        const start = g.date('start', { required: true }), end = g.date('end', { required: true });
        if (end < start) fail('imp.rangeOrder', { ...w, field: 'end' });
        const deps = g.list('deps', LIMITS.deps).map(d => {
          const did = typeof d === 'string' ? d : (isObj(d) ? d.id : null);
          if (typeof did !== 'string' || !ID_RE.test(did)) fail('imp.field', { ...w, field: 'deps', rule: 'rule.link' });
          return did;
        });
        return { id: bt.id, name: g.text('name', { max: 200 }), dur: g.int('dur', { min: 0, max: LIMITS.dur, def: 0 }), deps, cat: g.text('cat', { max: 100 }), start, end };
      });
      return bl;
    });

    // Versions : chaque état est contrôlé comme un projet complet, sans versions imbriquées.
    const versions = rawVer.map((v, i) => {
      const where = { obj: 'version', n: i + 1 };
      if (!isObj(v)) fail('imp.field', { ...where, field: '', rule: 'rule.object' });
      const f = reader(v, where, ['id', 'label', 'ts', 'state'], stats);
      const state = f.obj('state');
      if (!state) fail('imp.field', { ...where, field: 'state', rule: 'rule.object' });
      let inner;
      try { inner = sanitize(state, { nested: true }); } catch (e) { if (e instanceof Invalid) fail('imp.version', { n: i + 1, inner: e }); throw e; }
      stats.unknown += inner.notices.unknown;
      return { id: 'V' + (i + 1), label: f.text('label', { min: 1, max: 100, trim: true }), ts: f.num('ts'), state: serialize(inner.project, { withVersions: false }) };
    });

    Object.assign(project, { tasks, resources, categories, baselines, versions });
    // Dernier contrôle : le planning doit pouvoir se calculer (dates dans les bornes 1970-2199).
    try { Schedule.compute(project); } catch (e) { if (e instanceof RangeError) fail('imp.horizon'); throw e; }
    return { project, notices: { unknown: stats.unknown, createdResources, createdCategories } };
  }

  /**
   * Lecture d'un texte de fichier : taille, JSON, enveloppe chiffrée, puis sanitize.
   * @returns {{encrypted:true, envelope}|{project, notices}}
   */
  function parseFile(text) {
    if (typeof text !== 'string') fail('imp.unreadable');
    if (new TextEncoder().encode(text).length > MAX_BYTES) fail('imp.tooBig');
    let raw;
    try { raw = JSON.parse(text); } catch { fail('imp.unreadable'); }
    if (isObj(raw) && raw.encrypted === true) return { encrypted: true, envelope: raw };
    return sanitize(raw);
  }

  const resName = (project, id) => (project.resources.find(r => r.id === id) || { name: '' }).name;

  /** Écriture au format 3 (8.2). anonymize : « Ressource 1 », sans rôle (EF-51). */
  function serialize(project, { anonymize = false, withVersions = true } = {}) {
    const rIndex = new Map(project.resources.map((r, i) => [r.id, i]));
    const nameOf = id => (anonymize ? `Ressource ${rIndex.get(id) + 1}` : resName(project, id));
    const catName = id => (project.categories.find(c => c.id === id) || { name: '' }).name;
    const file = {
      format: FORMAT, id: project.id, createdAt: project.createdAt,
      name: project.name, desc: project.desc, emoji: project.emoji, projectStart: project.projectStart, reportNote: project.reportNote,
      calendar: JSON.parse(JSON.stringify(project.calendar)),
      tasks: project.tasks.map(t => ({
        id: t.id, name: t.name, type: t.type, parent: t.parent, dur: t.dur,
        deps: t.deps.map(d => (d.type === 'FS' && !d.lag ? d.id : { id: d.id, type: d.type, lag: d.lag })),
        res: t.assign.length ? nameOf(t.assign[0].res) : '',
        assign: t.assign.map(a => ({ res: nameOf(a.res), units: a.units })),
        cat: catName(t.cat), pct: t.pct,
        forcedStart: t.forcedStart, notBefore: t.notBefore, deadline: t.deadline, realStart: t.realStart, realEnd: t.realEnd,
        tags: t.tags.slice(), notes: t.notes, comments: t.comments.map(c => ({ ts: c.ts, text: c.text })), collapsed: t.collapsed,
      })),
      resources: project.resources.map((r, i) => ({
        id: r.id, name: anonymize ? `Ressource ${i + 1}` : r.name, role: anonymize ? '' : r.role, color: r.color,
        capacity: r.capacity, absences: anonymize ? [] : r.absences.map(a => ({ ...a })),
      })),
      categories: project.categories.map(c => ({ id: c.id, name: c.name, color: c.color })),
      baselines: project.baselines.map(b => ({ ...b, tasks: b.tasks.map(bt => ({ ...bt, deps: bt.deps.slice() })) })),
    };
    // Les versions contiennent des noms : elles ne sont pas exportées dans un fichier anonymisé.
    if (withVersions) file.versions = anonymize ? [] : (project.versions || []).map(v => ({ id: v.id, label: v.label, ts: v.ts, state: v.state }));
    return file;
  }

  /** Prochain identifiant libre dans la suite A, B, … Z, AA, AB… (3.2). */
  function nextTaskId(existing) {
    const used = new Set(existing);
    for (let n = 1; ; n++) {
      let s = '', k = n;
      while (k > 0) { k--; s = String.fromCharCode(65 + (k % 26)) + s; k = Math.floor(k / 26); }
      if (!used.has(s)) return s;
    }
  }

  /** Projet initial (3.8). */
  function newProject(todayIso, now = 0, names = {}) {
    const n = { project: 'Nouveau projet', task: 'Renommer cette tâche…', resource: 'Ressource', category: 'Général', ...names };
    return {
      id: 'P' + now.toString(36), createdAt: now, name: n.project, desc: '', emoji: '📁', projectStart: todayIso, reportNote: '',
      calendar: { workDays: [1, 1, 1, 1, 1, 0, 0], holidays: 'FR', daysOff: [], daysWorked: [] },
      tasks: [{ id: 'A', name: n.task, type: 'task', parent: '', dur: 10, deps: [], assign: [], cat: 'C1', pct: 0,
        forcedStart: '', notBefore: '', deadline: '', realStart: '', realEnd: '', tags: [], notes: '', comments: [], collapsed: false }],
      resources: [{ id: 'R1', name: n.resource, role: '', color: PALETTE[0], capacity: 100, absences: [] }],
      categories: [{ id: 'C1', name: n.category, color: PALETTE[0] }],
      baselines: [], versions: [],
    };
  }

  return { FORMAT, MAX_BYTES, LIMITS, ID_RE, COLOR_RE, EMOJIS, PALETTE, BASELINE_COLORS, LINK_TYPES, Invalid, sanitize, parseFile, serialize, nextTaskId, newProject, findCycle };
})();
