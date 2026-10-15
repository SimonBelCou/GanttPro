/* Suivi et indicateurs (RG-13 à RG-20, RG-26, RG-28).
 * Un seul calcul de statut pour toute l'application (défaut A-06 de la version 2.3). */
const Metrics = (() => {
  const STATUS = Object.freeze({ DONE: 'done', LATE: 'late', ONGOING: 'ongoing', NOT_STARTED: 'notStarted', UPCOMING: 'upcoming' });

  /** Avancement effectif : une récapitulative prend celui calculé à partir de ses enfants (RG-23). */
  function pctOf(t, sched) { return t.type === 'summary' ? sched.tasks.get(t.id).pct : t.pct; }

  /** RG-14. today : dn. Renvoie null pour une récapitulative sans enfant. */
  function status(t, sched, today) {
    const r = sched.tasks.get(t.id);
    if (!r || r.empty) return null;
    const pct = pctOf(t, sched);
    if (t.type === 'milestone') {
      if (pct >= 100) return STATUS.DONE;
      return r.endDn < today ? STATUS.LATE : STATUS.UPCOMING;
    }
    if (pct >= 100) return STATUS.DONE;
    if (r.endDn < today) return STATUS.LATE;
    if (pct > 0) return STATUS.ONGOING;
    if (r.startDn <= today) return STATUS.NOT_STARTED;
    return STATUS.UPCOMING;
  }

  /** RG-15 : écart en jours ouvrés entre fin prévue et fin réelle ; {days, ongoing} ou null. */
  function deviation(t, sched, today) {
    const r = sched.tasks.get(t.id);
    if (!r || r.empty || t.type === 'summary') return null;
    const real = Dates.parse(t.realEnd);
    if (real != null) return { days: sched.cal.floor(real) - r.e, ongoing: false };
    if (t.pct < 100 && r.endDn < today) return { days: sched.cal.floor(today) - r.e, ongoing: true };
    return null;
  }

  const countsInProgress = t => t.type === 'task';

  /** RG-16 : avancement global = moyenne simple des avancements des tâches (poids 1 par tâche), en pourcentage (non arrondi). */
  function globalProgress(project) {
    let n = 0, acc = 0;
    for (const t of project.tasks) if (countsInProgress(t)) { n++; acc += t.pct; }
    return n ? acc / n : 0;
  }

  /** RG-16 : compteurs par statut (tâches et jalons, hors récapitulatives). */
  function counters(project, sched, today) {
    const c = { done: 0, ongoing: 0, late: 0, notStarted: 0, upcoming: 0, total: 0 };
    for (const t of project.tasks) {
      if (t.type === 'summary') continue;
      c.total++;
      c[status(t, sched, today)]++;
    }
    return c;
  }

  /** RG-17 : périodes (semaines du lundi au dimanche, ou mois civils) couvrant [fromDn, toDn]. */
  function periods(fromDn, toDn, unit) {
    const out = [];
    let a = unit === 'month' ? Dates.monthStart(fromDn) : Dates.mondayOf(fromDn);
    while (a <= toDn) {
      const b = unit === 'month' ? Dates.monthEnd(a) : a + 6;
      out.push({ start: a, end: b });
      a = b + 1;
    }
    return out;
  }

  /**
   * Courbe en S (RG-17 à RG-20). Renvoie {periods, planned[], real[], baselines: {id: []}} en pourcentages.
   * real s'arrête à la période qui contient aujourd'hui.
   */
  function sCurve(project, sched, today, unit = 'week') {
    const work = project.tasks.filter(countsInProgress);
    const total = work.length; // poids 1 par tâche (RG-18)
    let last = sched.projectEndDn;
    const shownBaselines = (project.baselines || []).filter(b => b.shownOnScurve);
    for (const b of shownBaselines) for (const bt of b.tasks) { const e = Dates.parse(bt.end); if (e != null) last = Math.max(last, e); }
    const ps = periods(Dates.parse(project.projectStart), last, unit);
    // Tâches dont la fin prévue est atteinte, cumulées par jour ouvré (tableau de comptage) : O(tâches + jours),
    // pas O(tâches × périodes). Une tâche vaut 1 point, acquis à sa fin prévue (RG-18).
    const lo = Math.min(0, ...work.map(t => sched.tasks.get(t.id).e));
    const hi = Math.max(0, ...work.map(t => sched.tasks.get(t.id).e));
    const endsAt = new Float64Array(hi - lo + 1);
    for (const t of work) endsAt[sched.tasks.get(t.id).e - lo] += 1;
    const cumul = new Float64Array(hi - lo + 1);
    for (let i = 0, acc = 0; i <= hi - lo; i++) { acc += endsAt[i]; cumul[i] = acc; }
    const plannedUpTo = dn => { const i = Math.min(sched.cal.floor(dn), hi) - lo; return i < 0 ? 0 : cumul[i]; };
    const planned = ps.map(p => (total ? 100 * plannedUpTo(p.end) / total : 0));
    // RG-20 : une tâche terminée (100 %) vaut 1 point à sa fin réelle ; sans fin réelle, elle compte dans la période en cours.
    const real = [];
    for (const p of ps) {
      if (p.start > today) break;
      if (!total) { real.push(0); continue; }
      const current = p.end >= today;
      real.push(100 * work.reduce((a, t) => {
        if (t.pct < 100) return a;
        const re = Dates.parse(t.realEnd);
        return a + (re != null ? (re <= p.end ? 1 : 0) : (current ? 1 : 0));
      }, 0) / total);
    }
    const baselines = {};
    for (const b of shownBaselines) {
      const bts = b.tasks.filter(bt => bt.dur > 0);
      baselines[b.id] = ps.map(p => bts.length ? 100 * bts.reduce((a, bt) => {
        const e = Dates.parse(bt.end);
        return a + (e != null && e <= p.end ? 1 : 0);
      }, 0) / bts.length : 0);
    }
    return { periods: ps, planned, real, baselines };
  }

  /** RG-26 : occupation d'une ressource sur [fromDn, toDn]. */
  function occupation(sched, resId, fromDn, toDn) {
    const cal = sched.cal;
    let loadPd = 0, availPd = 0;
    for (let i = cal.ceil(fromDn), last = cal.floor(toDn); i <= last; i++) {
      loadPd += sched.loadOf(resId, i) / 100;
      availPd += sched.capacityOf(resId, i) / 100;
    }
    let state;
    if (availPd === 0) state = loadPd > 0 ? 'overload' : 'absent';
    else state = loadPd > availPd + 1e-9 ? 'overload' : 'ok';
    return { load: loadPd, available: availPd, ratio: availPd ? loadPd / availPd : null, state };
  }

  /** RG-28 : voyant du rapport d'état ('red' | 'orange' | 'green') et écart avec la baseline. */
  function statusLight(project, sched, today, baseline) {
    let lateCritical = false, lateOther = false;
    for (const t of project.tasks) {
      if (t.type === 'summary' || status(t, sched, today) !== STATUS.LATE) continue;
      if (sched.tasks.get(t.id).critical) lateCritical = true; else lateOther = true;
    }
    let drift = null;
    if (baseline && baseline.tasks.length) {
      const bEnd = Math.max(...baseline.tasks.map(bt => Dates.parse(bt.end)).filter(v => v != null));
      drift = sched.projectEnd - sched.cal.floor(bEnd);
    }
    let light = 'green';
    if (lateCritical || (drift != null && drift > 5)) light = 'red';
    else if (lateOther || (drift != null && drift >= 1)) light = 'orange';
    return { light, drift };
  }

  /** RG-28 : avancement prévu à ce jour = moyenne, sur les tâches, de la part de chacune écoulée (jours ouvrés prévus écoulés / durée). */
  function plannedToDate(project, sched, today) {
    const work = project.tasks.filter(countsInProgress);
    if (!work.length) return 0;
    const upto = sched.cal.floor(today);
    return 100 * work.reduce((a, t) => {
      const r = sched.tasks.get(t.id);
      return a + Math.max(0, Math.min(upto, r.e) - r.s + 1) / Math.max(1, r.e - r.s + 1);
    }, 0) / work.length;
  }

  /** RG-28 : contenu du rapport d'état (listes d'identifiants, chiffres, voyant). */
  function report(project, sched, today, baseline) {
    const byId = new Map(project.tasks.map(t => [t.id, t]));
    const items = project.tasks.filter(t => t.type !== 'summary');
    const late = items.filter(t => status(t, sched, today) === STATUS.LATE)
      .map(t => ({ id: t.id, dev: (deviation(t, sched, today) || { days: 0 }).days }))
      .sort((a, b) => b.dev - a.dev || 0);
    const soon = items.filter(t => { const r = sched.tasks.get(t.id); return r.startDn >= today && r.startDn <= today + 14; })
      .sort((a, b) => sched.tasks.get(a.id).startDn - sched.tasks.get(b.id).startDn).map(t => t.id);
    const msPast = items.filter(t => t.type === 'milestone' && t.pct >= 100 && sched.tasks.get(t.id).startDn >= today - 14 && sched.tasks.get(t.id).startDn <= today).map(t => t.id);
    const msNext = items.filter(t => t.type === 'milestone' && sched.tasks.get(t.id).startDn > today && sched.tasks.get(t.id).startDn <= today + 30).map(t => t.id);
    const progress = globalProgress(project), planned = plannedToDate(project, sched, today);
    const light = statusLight(project, sched, today, baseline);
    return { progress, planned, gap: progress - planned, counters: counters(project, sched, today), late, soon, msPast, msNext,
      critical: sched.criticalPath.filter(id => byId.get(id)), light: light.light, drift: light.drift };
  }

  return { plannedToDate, report, STATUS, status, deviation, globalProgress, counters, periods, sCurve, occupation, statusLight, pctOf };
})();
