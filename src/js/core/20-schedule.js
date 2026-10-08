/* Ordonnancement (RG-04 à RG-12, RG-23 à RG-25, RG-33).
 *
 * Gestion de la charge des ressources, au choix du projet (project.leveling) :
 *   'level'  nivellement automatique (défaut) : une tâche est décalée jusqu'à ce que ses ressources
 *            soient libres, quitte à repousser la fin du projet (RG-08) ;
 *   'smooth' lissage : une tâche n'est décalée que dans sa marge — jamais après sa date de début au
 *            plus tard calculée SANS nivellement — donc la fin du projet et les échéances ne bougent
 *            pas ; une surcharge qui ne tient pas dans la marge reste un conflit (RG-33) ;
 *   'off'    aucun décalage : chaque chevauchement est un conflit.
 *
 * Calcul déterministe : mêmes données, même ordre de liste → mêmes dates. Tout se fait en
 * index de jours ouvrés (voir Calendar) ; les dates ne sont reconstituées qu'à la fin.
 * Entrée : un projet déjà contrôlé par Model.sanitize (aucune boucle, références valides).
 * Liens : type FS (fin-début, FD), SS (DD), FF, SF (DF), délai entier en jours ouvrés. */
const Schedule = (() => {
  const isMilestone = t => t.type === 'milestone';
  const isSummary = t => t.type === 'summary';
  const durOf = t => (isMilestone(t) ? 0 : t.dur);
  /** Décalage début → fin : une tâche de n jours finit n−1 jours ouvrés après son début (RG-05). */
  const spanOf = t => Math.max(durOf(t) - 1, 0);

  const MODES = Object.freeze(['level', 'smooth', 'off']);

  function compute(project, opts = {}) {
    const mode = opts.mode || (MODES.includes(project.leveling) ? project.leveling : 'level');
    // Lissage : dates de début au plus tard d'un calcul sans nivellement ni enchaînement de ressource.
    const smoothCap = mode === 'smooth' ? lateStartsWithoutLeveling(project) : null;
    const cal = Calendar.create(project.calendar, project.projectStart);
    const tasks = project.tasks;
    const order = new Map(tasks.map((t, i) => [t.id, i]));
    const byId = new Map(tasks.map(t => [t.id, t]));
    const resources = new Map(project.resources.map(r => [r.id, r]));
    const out = new Map();
    const warnings = [];

    // Absences (RG-25) en index de jours ouvrés ; charge par ressource et par jour.
    const absent = new Map(), load = new Map();
    for (const r of project.resources) {
      const set = new Set();
      for (const a of r.absences || []) {
        const from = cal.ceil(Dates.parse(a.start)), to = cal.floor(Dates.parse(a.end));
        for (let i = from; i <= to; i++) set.add(i);
      }
      absent.set(r.id, set);
      load.set(r.id, new Map());
    }
    const assignsOf = t => (isMilestone(t) || isSummary(t) ? [] : (t.assign || []).filter(a => resources.has(a.res)));

    /** Début au plus tôt imposé par un lien (RG-06, RG-10). */
    function linkBound(t, dep) {
      const p = out.get(dep.id), lag = dep.lag || 0;
      switch (dep.type) {
        case 'SS': return p.s + lag;
        case 'FF': return p.e + lag - spanOf(t);
        case 'SF': return p.s - 1 + lag - spanOf(t);
        default:   return p.e + lag + (isMilestone(t) ? 0 : 1); // FS : le jalon tombe le même jour
      }
    }

    /** Premier jour fautif (surcharge ou absence) de la période [s, s+d−1] : {i, res, kind}, ou null. */
    function firstFault(assigns, s, d) {
      for (let i = s; i < s + d; i++) {
        for (const a of assigns) {
          if (absent.get(a.res).has(i)) return { i, res: a.res, kind: 'absence' };
          const cap = resources.get(a.res).capacity;
          // Un taux supérieur à la capacité est refusé à la saisie ; par sûreté il n'est pas nivelé.
          if (a.units <= cap && (load.get(a.res).get(i) || 0) + a.units > cap) return { i, res: a.res, kind: 'overload' };
        }
      }
      return null;
    }

    /**
     * RG-08 : tant qu'un jour est fautif, la tâche commence le jour ouvré qui suit le premier jour fautif.
     * cap (lissage, RG-33) : début à ne pas dépasser ; au-delà, la tâche reste à son début au plus tôt.
     * Renvoie {s, cause} — cause : première ressource qui a imposé un décalage — ou {s, unresolved}.
     */
    function level(assigns, s, d, cap = Infinity) {
      const start = s;
      let cause = null;
      for (let guard = 0; guard < 1e6; guard++) {
        const f = firstFault(assigns, s, d);
        if (!f) return { s, cause };
        if (!cause) cause = f;
        if (f.i + 1 > cap) return { s: start, cause, unresolved: true };
        s = f.i + 1;
      }
      return { s, cause };
    }

    const state = new Map();
    function place(t) {
      if (isSummary(t) || state.get(t.id) === 2) return;
      if (state.get(t.id) === 1) throw new Error('schedule.cycle'); // impossible après Model.sanitize
      state.set(t.id, 1);
      for (const dep of t.deps) { const p = byId.get(dep.id); if (p) place(p); }

      const d = durOf(t), assigns = assignsOf(t);
      let earliest = 0; // point de départ (RG-03) : index 0
      if (t.notBefore && !t.forcedStart) earliest = Math.max(earliest, cal.ceil(Dates.parse(t.notBefore)));
      for (const dep of t.deps) if (out.has(dep.id)) earliest = Math.max(earliest, linkBound(t, dep));

      let s, shift = null;
      if (t.forcedStart) {
        s = cal.ceil(Dates.parse(t.forcedStart)); // RG-07 : l'emporte sur les liens et le nivellement
        for (const dep of t.deps) {
          if (!out.has(dep.id)) continue;
          const bound = linkBound(t, dep);
          if (s < bound) warnings.push({ kind: 'link', task: t.id, pred: dep.id, type: dep.type, lag: dep.lag || 0, days: bound - s });
        }
      } else if (assigns.length && d > 0 && mode !== 'off') {
        const cap = smoothCap ? smoothCap.get(t.id) : Infinity;
        const r = level(assigns, earliest, d, cap);
        s = r.s;
        if (r.unresolved) warnings.push({ kind: 'smooth', task: t.id, res: r.cause.res });
        // Traçabilité (EF-106) : décalage dû aux ressources, en jours ouvrés, et sa cause.
        else if (s > earliest) shift = { days: s - earliest, res: r.cause.res, kind: r.cause.kind };
      } else {
        s = earliest;
      }
      const e = d === 0 ? s : s + d - 1;
      for (const a of assigns) {
        const m = load.get(a.res);
        for (let i = s; i <= e; i++) m.set(i, (m.get(i) || 0) + a.units);
      }
      out.set(t.id, shift ? { s, e, d, shift, earliestDn: null, earliest } : { s, e, d });
      state.set(t.id, 2);
    }
    for (const t of tasks) place(t);

    // Récapitulatives (RG-23) : dates et avancement tirés de leurs enfants.
    const children = new Map();
    for (const t of tasks) if (t.parent) (children.get(t.parent) || children.set(t.parent, []).get(t.parent)).push(t);
    const leafTasks = new Map(); // id récap → tâches feuilles (hors jalons) de sa descendance
    function summarize(t) {
      if (out.has(t.id)) return out.get(t.id);
      let s = Infinity, e = -Infinity, leaves = [];
      for (const c of children.get(t.id) || []) {
        if (isSummary(c)) { const r = summarize(c); if (!r.empty) { s = Math.min(s, r.s); e = Math.max(e, r.e); } leaves = leaves.concat(leafTasks.get(c.id)); }
        else { const r = out.get(c.id); s = Math.min(s, r.s); e = Math.max(e, r.e); if (!isMilestone(c)) leaves.push(c); }
      }
      leafTasks.set(t.id, leaves);
      const wsum = leaves.reduce((acc, c) => acc + c.dur, 0);
      const pct = wsum ? Math.round(leaves.reduce((acc, c) => acc + c.dur * c.pct, 0) / wsum) : 0;
      const r = s === Infinity ? { empty: true, s: null, e: null, d: 0, pct } : { s, e, d: e - s + 1, pct };
      out.set(t.id, r);
      return r;
    }
    for (const t of tasks) if (isSummary(t)) summarize(t);

    // Fin du projet : fin la plus tardive de toutes les tâches et jalons (RG-11).
    let projectEnd = 0;
    for (const t of tasks) if (!isSummary(t)) projectEnd = Math.max(projectEnd, out.get(t.id).e);

    // Successeurs : par lien, et pour une tâche de ressource, la suivante sur cette ressource (RG-11).
    const succ = new Map(tasks.map(t => [t.id, []]));
    for (const t of tasks) for (const dep of t.deps) if (succ.has(dep.id)) succ.get(dep.id).push({ to: t, type: dep.type, lag: dep.lag || 0 });
    for (const r of (mode === 'off' || opts.noResourceEdges ? [] : project.resources)) {
      const on = tasks.filter(t => assignsOf(t).some(a => a.res === r.id))
        .sort((a, b) => out.get(a.id).s - out.get(b.id).s || order.get(a.id) - order.get(b.id));
      for (let k = 0; k < on.length; k++) {
        const te = out.get(on[k].id).e;
        for (let j = k + 1; j < on.length; j++) {
          if (out.get(on[j].id).s > te) { succ.get(on[k].id).push({ to: on[j], type: 'RES', lag: 0 }); break; }
        }
      }
    }

    // Fin au plus tard (passe arrière) ; une date imposée ne bouge pas.
    const lateFinish = new Map(), visiting = new Set();
    function lf(t) {
      if (lateFinish.has(t.id)) return lateFinish.get(t.id);
      if (visiting.has(t.id)) return projectEnd; // garde-fou (liens + enchaînement de ressource)
      visiting.add(t.id);
      let L = projectEnd;
      if (t.deadline) L = Math.min(L, cal.floor(Dates.parse(t.deadline)));
      const oT = spanOf(t);
      for (const { to: S, type, lag } of succ.get(t.id)) {
        const rs = out.get(S.id);
        const LS = S.forcedStart ? rs.s : lf(S) - spanOf(S);
        const LE = S.forcedStart ? rs.e : lf(S);
        switch (type) {
          case 'SS': L = Math.min(L, LS - lag + oT); break;
          case 'FF': L = Math.min(L, LE - lag); break;
          case 'SF': L = Math.min(L, LE + 1 - lag + oT); break;
          case 'RES': L = Math.min(L, LS - 1); break;
          default: L = Math.min(L, isMilestone(S) ? LS - lag : LS - 1 - lag);
        }
      }
      visiting.delete(t.id);
      lateFinish.set(t.id, L);
      return L;
    }
    for (const t of tasks) {
      if (isSummary(t)) continue;
      const r = out.get(t.id);
      r.slack = lf(t) - r.e;
      r.critical = r.slack <= 0;
      if (t.deadline) {
        const late = r.e - cal.floor(Dates.parse(t.deadline));
        if (late > 0) warnings.push({ kind: 'deadline', task: t.id, days: late });
      }
    }

    // Dates civiles.
    for (const r of out.values()) {
      if (r.empty) continue;
      r.startDn = cal.dnOf(r.s);
      r.endDn = cal.dnOf(r.e);
      if (r.shift) r.earliestDn = cal.dnOf(r.earliest);
    }

    const criticalPath = tasks.filter(t => !isSummary(t) && out.get(t.id).critical)
      .sort((a, b) => out.get(a.id).s - out.get(b.id).s || out.get(a.id).e - out.get(b.id).e || order.get(a.id) - order.get(b.id))
      .map(t => t.id);

    // Conflits (RG-12) : périodes continues de jours en surcharge ou en absence.
    const conflicts = [];
    for (const r of project.resources) {
      const m = load.get(r.id), abs = absent.get(r.id);
      const bad = [...m.keys()].filter(i => m.get(i) > 0 && (abs.has(i) || m.get(i) > r.capacity)).sort((a, b) => a - b);
      for (let k = 0; k < bad.length;) {
        let j = k;
        while (j + 1 < bad.length && bad[j + 1] === bad[j] + 1) j++;
        const from = bad[k], to = bad[j];
        const involved = tasks.filter(t => assignsOf(t).some(a => a.res === r.id) && out.get(t.id).s <= to && out.get(t.id).e >= from).map(t => t.id);
        const kind = bad.slice(k, j + 1).some(i => abs.has(i)) ? 'absence' : 'overload';
        conflicts.push({ res: r.id, kind, s: from, e: to, startDn: cal.dnOf(from), endDn: cal.dnOf(to), tasks: involved });
        k = j + 1;
      }
    }

    return {
      mode, cal, tasks: out, projectEnd, projectEndDn: cal.dnOf(projectEnd), startDn: cal.dnOf(0),
      criticalPath, conflicts, warnings,
      /** Charge d'une ressource un jour ouvré (somme des taux, RG-25). */
      loadOf: (resId, i) => (load.get(resId) && load.get(resId).get(i)) || 0,
      /** Capacité du jour : 0 un jour d'absence (RG-25). */
      capacityOf: (resId, i) => (absent.get(resId) && absent.get(resId).has(i) ? 0 : (resources.get(resId) || { capacity: 0 }).capacity),
    };
  }

  /** Début au plus tard de chaque tâche dans un planning sans nivellement (borne du lissage, RG-33). */
  function lateStartsWithoutLeveling(project) {
    const free = compute(project, { mode: 'off', noResourceEdges: true });
    const caps = new Map();
    for (const t of project.tasks) {
      const r = free.tasks.get(t.id);
      if (r && !r.empty && !isSummary(t)) caps.set(t.id, r.s + Math.max(0, r.slack));
    }
    return caps;
  }

  return { compute, durOf, isMilestone, isSummary, MODES };
})();
