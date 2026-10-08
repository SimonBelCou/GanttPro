/* Recherche, filtres et regroupements (RG-27, EF-84 à EF-86).
 * Affichage seulement : ces fonctions ne modifient jamais le projet ni le planning. */
const View = (() => {
  const EMPTY = Object.freeze({ status: [], res: [], cat: [], tag: [], type: [], critical: false, alerts: false, from: '', to: '' });

  /** Minuscules sans accents, pour une recherche qui ignore casse et accents. */
  const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const words = q => fold(q).split(/\s+/).filter(Boolean);

  function haystack(project, task) {
    const res = task.assign.map(a => (project.resources.find(r => r.id === a.res) || {}).name || '');
    const cat = (project.categories.find(c => c.id === task.cat) || {}).name || '';
    return fold([task.id, task.name, ...res, cat, ...task.tags, task.notes].join(' \u0001 '));
  }

  /** La tâche contient-elle tous les mots de la recherche ? */
  function matches(project, task, query) {
    const w = words(query);
    if (!w.length) return true;
    const hay = haystack(project, task);
    return w.every(x => hay.includes(x));
  }

  function isActive(f) {
    return !!(f && (f.status.length || f.res.length || f.cat.length || f.tag.length || f.type.length || f.critical || f.alerts || f.from || f.to));
  }

  /** Filtres : ET entre critères, OU à l'intérieur d'un critère (RG-27). */
  function passes(project, sched, task, f, today, flagged) {
    if (f.type.length && !f.type.includes(task.type)) return false;
    if (task.type === 'summary') return !isActive({ ...f, type: [] }); // jugée par ses enfants
    const r = sched && sched.tasks.get(task.id);
    if (f.status.length && !f.status.includes(Metrics.status(task, sched, today))) return false;
    if (f.res.length) {
      const ids = task.assign.map(a => a.res);
      if (!f.res.some(x => (x === '' ? ids.length === 0 : ids.includes(x)))) return false;
    }
    if (f.cat.length && !f.cat.includes(task.cat)) return false;
    if (f.tag.length) { const tags = task.tags.map(fold); if (!f.tag.some(x => tags.includes(fold(x)))) return false; }
    if (f.critical && !(r && r.critical)) return false;
    if (f.alerts && !flagged.has(task.id)) return false;
    if (f.from || f.to) {
      if (!r || r.empty) return false;
      const a = Dates.parse(f.from), b = Dates.parse(f.to);
      if (a != null && r.endDn < a) return false;
      if (b != null && r.startDn > b) return false;
    }
    return true;
  }

  /**
   * Identifiants retenus par la recherche ET les filtres. Une récapitulative dont un descendant est
   * retenu reste visible, de même que les ancêtres d'une tâche retenue (RG-27).
   * @returns {{ids:Set<string>, matched:Set<string>}} matched : retenus par eux-mêmes.
   */
  function select(project, sched, { query = '', filters = EMPTY } = {}, today = Dates.todayDn()) {
    const flagged = new Set();
    if (sched) { for (const c of sched.conflicts) c.tasks.forEach(id => flagged.add(id)); for (const w of sched.warnings) flagged.add(w.task); }
    const byId = new Map(project.tasks.map(t => [t.id, t]));
    const matched = new Set();
    for (const t of project.tasks) {
      if (t.type === 'summary' && (words(query).length || isActive({ ...filters, type: [] }))) continue;
      if (matches(project, t, query) && passes(project, sched, t, filters, today, flagged)) matched.add(t.id);
    }
    const ids = new Set(matched);
    for (const id of matched) { let p = byId.get(id).parent; while (p && !ids.has(p)) { ids.add(p); p = byId.get(p) && byId.get(p).parent; } }
    return { ids, matched };
  }

  /**
   * Regroupement (RG-27) par 'res', 'cat' ou 'status' des tâches et jalons retenus (vue plate).
   * Une tâche à plusieurs ressources figure dans chaque groupe. Groupes triés par ordre
   * alphabétique, « Sans ressource » / « Sans catégorie » en dernier.
   * @returns {{key, label, none:boolean, ids:string[], count, dur, pct}[]} label vide si none.
   */
  function group(project, sched, ids, by, today = Dates.todayDn()) {
    const groups = new Map();
    const add = (key, label, none, t) => {
      if (!groups.has(key)) groups.set(key, { key, label, none, ids: [], count: 0, dur: 0, w: 0 });
      const g = groups.get(key);
      g.ids.push(t.id); g.count++;
      if (t.type === 'task') { g.dur += t.dur; g.w += t.dur * t.pct; }
    };
    const STATUS_ORDER = ['late', 'ongoing', 'notStarted', 'upcoming', 'done'];
    for (const t of project.tasks) {
      if (t.type === 'summary' || !ids.has(t.id)) continue;
      if (by === 'res') {
        if (!t.assign.length) add('', '', true, t);
        for (const a of t.assign) { const r = project.resources.find(x => x.id === a.res); if (r) add(r.id, r.name, false, t); }
      } else if (by === 'cat') {
        const c = project.categories.find(x => x.id === t.cat);
        if (c) add(c.id, c.name, false, t); else add('', '', true, t);
      } else {
        const st = Metrics.status(t, sched, today) || 'upcoming';
        add(st, st, false, t);
      }
    }
    const list = [...groups.values()].map(g => ({ key: g.key, label: g.label, none: g.none, ids: g.ids, count: g.count, dur: g.dur, pct: g.dur ? Math.round(g.w / g.dur) : 0 }));
    if (by === 'status') return list.sort((a, b) => STATUS_ORDER.indexOf(a.key) - STATUS_ORDER.indexOf(b.key));
    return list.sort((a, b) => (a.none - b.none) || a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }));
  }

  return { EMPTY, fold, matches, isActive, select, group };
})();
