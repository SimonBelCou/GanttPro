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
  const byFrom = (a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0); // la ligne sans date ('') d'abord

  /** Profil de coût d'une ressource, ou null. */
  function profileOf(project, res) {
    return (res && res.profile && (project.profiles || []).find(p => p.id === res.profile)) || null;
  }

  /** Lignes de taux en vigueur pour une ressource : les siennes (nominatives) sinon celles de son profil. */
  function linesOf(project, res) {
    if (res && (res.rates || []).length) return res.rates;
    const pf = profileOf(project, res);
    return pf ? pf.rates : [];
  }

  /** D'où vient le taux d'une ressource : 'own' (nominatif), 'profile' ou 'none'. */
  function sourceOf(project, res) {
    if (res && (res.rates || []).length) return 'own';
    const pf = profileOf(project, res);
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

  /** Taux d'une ressource un jour donné (centimes), ou null s'il n'y en a pas. */
  const rateFor = (project, res, dn) => rateOn(linesOf(project, res), dn);

  /** Lignes ramenées une fois pour toutes en index de jours ouvrés (« depuis le début » = -Infinity). */
  const indexed = (lines, cal) => lines.map(l => ({ i: l.from === '' ? -Infinity : cal.ceil(Dates.parse(l.from)), rate: l.rate }));

  /**
   * Coût d'une affectation (RG-55), à partir des lignes indexées : { pd (centièmes de jour-personne), cents, est (coût réel
   * estimé), unrated (jours sans taux) }. Le taux est sommé par tranche entre deux lignes (pas de boucle jour par jour),
   * puis multiplié par le taux d'occupation et arrondi une seule fois, moitié vers le haut (BigInt au-delà de 2^53).
   */
  function costOf(lines, st, units, pct) {
    const days = Math.max(0, st.e - st.s + 1);
    let sum = 0, rated = 0;
    for (let k = 0; k < lines.length; k++) {
      const from = Math.max(st.s, lines[k].i), to = Math.min(st.e, k + 1 < lines.length ? lines[k + 1].i - 1 : st.e);
      if (to < from) continue;
      sum += (to - from + 1) * lines[k].rate;
      rated += to - from + 1;
    }
    const cents = Evm.divRound(sum, 100, units);
    const est = cents == null ? null : Evm.divRound(cents, 100, Math.min(100, Math.max(0, pct || 0)));
    return { pd: days * units, cents, est, unrated: days - rated };
  }

  const zero = () => ({ pd: 0, cents: 0, est: 0, unrated: 0, assignments: 0 });
  /** Ajoute un coût d'affectation à un total ; unrated y compte les affectations PARTIELLES (RG-57). */
  const add = (o, c) => { o.pd += c.pd; o.cents += c.cents || 0; o.est += c.est || 0; o.unrated += c.unrated > 0 ? 1 : 0; o.assignments++; return o; };

  /** Coût d'une affectation d'une tâche (fiche de ressource). */
  function assignment(project, sched, task, a) {
    const res = project.resources.find(r => r.id === a.res);
    return costOf(indexed(linesOf(project, res), sched.cal), sched.tasks.get(task.id), a.units, task.pct);
  }

  /** Coût d'une seule tâche, toutes affectations (fiche de tâche) : sans calculer tout le projet. */
  function ofTask(project, sched, task) {
    return (task.assign || []).reduce((o, a) => (project.resources.some(r => r.id === a.res) ? add(o, assignment(project, sched, task, a)) : o), zero());
  }

  /**
   * Coûts de tout le projet (RG-56) : par tâche (une récapitulative somme sa descendance), par ressource et au total.
   * Les lignes de chaque ressource sont indexées une seule fois.
   * @returns {{byTask:Map<string,object>, byRes:Map<string,object>, total:object}}
   */
  function compute(project, sched) {
    const byTask = new Map(project.tasks.map(t => [t.id, zero()]));
    const byRes = new Map(project.resources.map(r => [r.id, zero()]));
    const lines = new Map(project.resources.map(r => [r.id, indexed(linesOf(project, r), sched.cal)]));
    const byId = new Map(project.tasks.map(t => [t.id, t]));
    const total = zero();
    for (const t of project.tasks) {
      if (t.type !== 'task') continue;
      const st = sched.tasks.get(t.id);
      for (const a of t.assign || []) {
        if (!lines.has(a.res)) continue;
        const c = costOf(lines.get(a.res), st, a.units, t.pct);
        add(byRes.get(a.res), c); add(total, c);
        for (let cur = t, guard = 0; cur && guard++ <= Model.LIMITS.depth + 1; cur = cur.parent ? byId.get(cur.parent) : null) add(byTask.get(cur.id), c);
      }
    }
    return { byTask, byRes, total };
  }

  /** Au moins une ligne de taux dans le projet (EF-147 : sinon rien de nouveau n'apparaît). */
  function hasRates(project) {
    return (project.profiles || []).some(p => p.rates.length) || project.resources.some(r => (r.rates || []).length);
  }

  /** Le projet utilise-t-il la valorisation : un profil, un taux, ou une ressource rattachée à un profil. */
  function inUse(project) {
    return (project.profiles || []).length > 0 || project.resources.some(r => (r.rates || []).length || r.profile);
  }

  /**
   * Règles des lignes de taux, communes à l'import (Model.sanitize) et à la saisie (RG-54) : 10 lignes au plus, date
   * valide ou vide, une seule ligne par date, taux entier de centimes de 0 à LIMITS.rate. Renvoie les lignes triées ou
   * la raison du refus : 'max', 'date', 'dup' ou 'rate'.
   */
  function normalize(lines) {
    if (lines.length > Model.LIMITS.rateLines) return { ok: false, reason: 'max' };
    const seen = new Set();
    for (const l of lines) {
      if (l.from !== '' && Dates.parse(l.from) == null) return { ok: false, reason: 'date' };
      if (seen.has(l.from)) return { ok: false, reason: 'dup' };
      seen.add(l.from);
      if (!Number.isSafeInteger(l.rate) || l.rate < 0 || l.rate > Model.LIMITS.rate) return { ok: false, reason: 'rate' };
    }
    return { ok: true, lines: lines.map(l => ({ from: l.from, rate: l.rate })).sort(byFrom) };
  }

  return { profileOf, linesOf, sourceOf, rateOn, rateFor, assignment, ofTask, compute, hasRates, inUse, normalize };
})();
