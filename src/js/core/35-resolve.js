/* Résolution des conflits de ressource (EF-31, RG-34).
 *
 * Pour chaque conflit, propose des corrections et SIMULE chacune sur une copie du projet avant de
 * l'afficher : nombre de conflits restants et décalage de la fin du projet. Rien n'est appliqué
 * sans un clic de l'utilisateur. Propositions, de la moins à la plus intrusive :
 *   moveForced  déplacer la date imposée d'une tâche au premier jour où ses ressources sont libres ;
 *   reassign    confier la tâche à une autre ressource libre sur toute sa période ;
 *   unforce     lever la date imposée (la tâche est alors placée par le nivellement) ;
 *   level       passer le projet en nivellement automatique (si lissage ou désactivé).
 * Les propositions sont classées par conflits restants, puis par décalage de la fin. */
const Resolve = (() => {
  const MAX_REASSIGN = 3;
  const SEARCH_DAYS = 520; // environ deux ans ouvrés de recherche pour une date libre

  const copy = p => JSON.parse(JSON.stringify(p));

  /** Premier début ≥ from où toutes les ressources de la tâche sont libres, sa propre charge retirée. */
  function firstFreeStart(sched, task, from) {
    const r = sched.tasks.get(task.id);
    const d = task.dur;
    for (let i = from; i < from + SEARCH_DAYS; i++) {
      let ok = true;
      for (let k = i; k < i + d && ok; k++) {
        for (const a of task.assign) {
          const own = k >= r.s && k <= r.e ? a.units : 0;
          const cap = sched.capacityOf(a.res, k);
          if (cap === 0 || sched.loadOf(a.res, k) - own + a.units > cap) { ok = false; break; }
        }
      }
      if (ok) return i;
    }
    return null;
  }

  /** La ressource res est-elle libre pour units sur les jours [s, e] ? */
  function isFree(sched, res, units, s, e) {
    for (let k = s; k <= e; k++) {
      const cap = sched.capacityOf(res, k);
      if (cap === 0 || sched.loadOf(res, k) + units > cap) return false;
    }
    return true;
  }

  function simulate(project, sched, mutate) {
    const p = copy(project);
    mutate(p);
    let after;
    try { after = Schedule.compute(p); } catch { return null; }
    const endShift = after.projectEndDn >= sched.projectEndDn
      ? sched.cal.count(sched.projectEndDn + 1, after.projectEndDn)
      : -sched.cal.count(after.projectEndDn + 1, sched.projectEndDn);
    return { conflicts: after.conflicts.length, endDn: after.projectEndDn, endShift };
  }

  /**
   * @returns {{conflicts: {conflict, options: object[]}[], global: object[]}}
   * Chaque option : {kind, task?, from?, to?, date?, mutate(p), after:{conflicts, endDn, endShift}}.
   */
  function suggest(project, sched, { max = 20 } = {}) {
    const byId = new Map(project.tasks.map(t => [t.id, t]));
    const result = { conflicts: [], global: [], more: Math.max(0, sched.conflicts.length - max) };
    const seen = new Set();
    // Chaque proposition coûte un calcul complet : on analyse les `max` premiers conflits, dans l'ordre.
    for (const c of sched.conflicts.slice(0, max)) {
      const options = [];
      const add = (o, mutate) => {
        const key = JSON.stringify([o.kind, o.task, o.to, o.date]);
        const after = simulate(project, sched, mutate);
        if (!after) return;
        options.push({ ...o, mutate, after, key });
      };
      for (const id of c.tasks) {
        const t = byId.get(id);
        if (!t || t.type !== 'task') continue;
        const r = sched.tasks.get(id);
        if (t.forcedStart) {
          const i = firstFreeStart(sched, t, r.s + 1);
          if (i != null) {
            const date = Dates.toISO(sched.cal.dnOf(i));
            add({ kind: 'moveForced', task: id, date }, p => { p.tasks.find(x => x.id === id).forcedStart = date; });
          }
          add({ kind: 'unforce', task: id }, p => { p.tasks.find(x => x.id === id).forcedStart = ''; });
        }
        const a = t.assign.find(x => x.res === c.res);
        if (!a) continue;
        let n = 0;
        for (const other of project.resources) {
          if (n >= MAX_REASSIGN) break;
          if (other.id === c.res || t.assign.some(x => x.res === other.id) || a.units > other.capacity) continue;
          if (!isFree(sched, other.id, a.units, r.s, r.e)) continue;
          n++;
          add({ kind: 'reassign', task: id, from: c.res, to: other.id }, p => {
            const pt = p.tasks.find(x => x.id === id);
            pt.assign = pt.assign.map(x => (x.res === c.res ? { res: other.id, units: x.units } : x));
          });
        }
      }
      options.sort((x, y) => x.after.conflicts - y.after.conflicts || x.after.endShift - y.after.endShift);
      result.conflicts.push({ conflict: c, options: options.filter(o => !seen.has(o.key) && seen.add(o.key)) });
    }
    if (sched.conflicts.length && sched.mode !== 'level') {
      const after = simulate(project, sched, p => { p.leveling = 'level'; });
      if (after) result.global.push({ kind: 'level', mutate: p => { p.leveling = 'level'; }, after });
    }
    return result;
  }

  return { suggest, firstFreeStart };
})();
