/* Taux des ressources (étape C, EF-147 et suivantes, RG-54 et suivantes) : moteur sans DOM, en centimes entiers.
 *
 * Un taux est un montant en centimes par JOUR ouvré (A.8 ligne 18). Il est porté par un profil de coût (taux moyen fixé
 * par la comptabilité) ou, en exception, par la ressource elle-même (taux nominatif, prestataire externe). Il peut
 * changer en cours de projet : des lignes « à partir du » ; le coût se calcule au taux en vigueur chaque jour ouvré.
 *
 *   jours-personne d'une affectation = jours ouvrés de la tâche x taux d'occupation (en centièmes de jour-personne)
 *   coût prévu  = somme, jour ouvré par jour ouvré, du taux du jour x taux d'occupation, arrondie UNE fois au centime
 *   coût réel estimé = coût prévu x avancement de la tâche : une ESTIMATION indicative, jamais injectée dans le coût
 *                      réel (AC) ni dans les indicateurs de valeur acquise (A.8 ligne 18).
 *
 * Le budget saisi de chaque tâche reste la référence du BAC, de l'EVM et des baselines (A.8 ligne 18, option 1).
 * Une ressource sans taux n'est pas valorisée (0) et est signalée : jamais un 0 sans explication (RG-57). */
const Rates = (() => {
  const amt = v => (Number.isSafeInteger(v) && v > 0 ? v : 0);

  /** Lignes de taux en vigueur pour une ressource : les siennes (nominatives) sinon celles de son profil. */
  function linesOf(project, res) {
    if (res && (res.rates || []).length) return res.rates;
    const pf = res && res.profile ? (project.profiles || []).find(p => p.id === res.profile) : null;
    return pf ? pf.rates : [];
  }

  /** D'où vient le taux d'une ressource : 'own' (nominatif), 'profile' ou 'none'. */
  function sourceOf(project, res) {
    if (res && (res.rates || []).length) return 'own';
    const pf = res && res.profile ? (project.profiles || []).find(p => p.id === res.profile) : null;
    return pf && pf.rates.length ? 'profile' : 'none';
  }

  /** Taux en vigueur un jour (numéro de jour) : la dernière ligne dont la date est atteinte ; null avant la première. */
  function rateOn(lines, dn) {
    let rate = null;
    for (const l of lines) {
      if (l.from === '' || Dates.parse(l.from) <= dn) rate = l.rate; else break;
    }
    return rate;
  }

  /**
   * Somme des taux de chaque jour ouvré d'une tâche, et nombre de jours sans taux (avant la première ligne datée, ou aucune
   * ligne). Par tranches entre deux lignes : pas de boucle jour par jour. Indices en jours ouvrés (sched.cal).
   * @returns {{days:number, sum:number, unrated:number}}
   */
  function weighted(lines, cal, s, e) {
    const days = e - s + 1;
    if (days <= 0) return { days: 0, sum: 0, unrated: 0 };
    if (!lines.length) return { days, sum: 0, unrated: days };
    let sum = 0, rated = 0;
    for (let k = 0; k < lines.length; k++) {
      const from = lines[k].from === '' ? s : Math.max(s, cal.ceil(Dates.parse(lines[k].from)));
      const to = k + 1 < lines.length ? Math.min(e, cal.ceil(Dates.parse(lines[k + 1].from)) - 1) : e;
      if (to < from) continue;
      sum += (to - from + 1) * lines[k].rate;
      rated += to - from + 1;
    }
    return { days, sum, unrated: days - rated };
  }

  /**
   * Coût d'une affectation (RG-55) : { pd (centièmes de jour-personne), cents, est (coût réel estimé), unrated (jours sans taux) }.
   * Arrondi à la moitié vers le haut, une seule fois, sur des entiers (BigInt au-delà de 2^53).
   */
  function assignment(project, sched, task, a) {
    const res = project.resources.find(r => r.id === a.res);
    const st = sched.tasks.get(task.id);
    const w = weighted(linesOf(project, res), sched.cal, st.s, st.e);
    const cents = Evm.divRound(w.sum, 100, a.units);
    const pct = Math.min(100, Math.max(0, task.pct || 0));
    const est = cents == null ? null : Evm.divRound(cents, 100, pct);
    return { pd: w.days * a.units, cents, est, unrated: w.unrated };
  }

  const zero = () => ({ pd: 0, cents: 0, est: 0, unrated: 0, assignments: 0 });
  const add = (o, c) => { o.pd += c.pd; o.cents += amt(c.cents); o.est += amt(c.est); o.unrated += c.unrated > 0 ? 1 : 0; o.assignments++; };

  /**
   * Coûts de tous les projets (RG-56) : par tâche (une récapitulative somme sa descendance), par ressource et au total.
   * unrated = nombre d'affectations dont au moins un jour est sans taux (le total est alors PARTIEL, RG-57).
   * @returns {{byTask:Map<string,object>, byRes:Map<string,object>, byProfile:Map<string,object>, total:object, any:boolean}}
   */
  function compute(project, sched) {
    const byTask = new Map(project.tasks.map(t => [t.id, zero()]));
    const byRes = new Map(project.resources.map(r => [r.id, zero()]));
    const byId = new Map(project.tasks.map(t => [t.id, t]));
    const resById = new Map(project.resources.map(r => [r.id, r]));
    const total = zero();
    for (const t of project.tasks) {
      if (t.type !== 'task') continue;
      for (const a of t.assign || []) {
        if (!resById.has(a.res)) continue;
        const c = assignment(project, sched, t, a);
        add(byRes.get(a.res), c); add(total, c);
        let cur = t, guard = 0;
        while (cur && guard++ <= Model.LIMITS.depth + 1) { add(byTask.get(cur.id), c); cur = cur.parent ? byId.get(cur.parent) : null; }
      }
    }
    // Par profil : une ressource sans profil est rangée sous '' (taux nominatif ou aucun).
    const byProfile = new Map();
    for (const r of project.resources) {
      const key = r.profile || '';
      if (!byProfile.has(key)) byProfile.set(key, zero());
      const o = byProfile.get(key), c = byRes.get(r.id);
      o.pd += c.pd; o.cents += c.cents; o.est += c.est; o.unrated += c.unrated; o.assignments += c.assignments;
    }
    return { byTask, byRes, byProfile, total, any: hasRates(project) };
  }

  /** Au moins une ligne de taux dans le projet (EF-147 : sinon rien de nouveau n'apparaît). */
  function hasRates(project) {
    return (project.profiles || []).some(p => p.rates.length) || project.resources.some(r => (r.rates || []).length);
  }

  /** Le projet utilise-t-il la valorisation : un profil, un taux, ou une affectation à valoriser. */
  function inUse(project) {
    return (project.profiles || []).length > 0 || project.resources.some(r => (r.rates || []).length || r.profile);
  }

  /** Contrôle des lignes saisies dans l'interface (mêmes règles qu'à l'import) : renvoie la liste triée ou une raison. */
  function normalize(lines) {
    if (lines.length > Model.LIMITS.rateLines) return { ok: false, reason: 'max' };
    const seen = new Set();
    for (const l of lines) {
      if (l.from !== '' && Dates.parse(l.from) == null) return { ok: false, reason: 'date' };
      if (seen.has(l.from)) return { ok: false, reason: 'dup' };
      seen.add(l.from);
      if (!Number.isSafeInteger(l.rate) || l.rate < 0 || l.rate > Model.LIMITS.rate) return { ok: false, reason: 'rate' };
    }
    return { ok: true, lines: lines.map(l => ({ from: l.from, rate: l.rate })).sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0)) };
  }

  return { linesOf, sourceOf, rateOn, weighted, assignment, compute, hasRates, inUse, normalize };
})();
