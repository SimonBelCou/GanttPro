/* Valeur acquise (étape B, EF-131 et suivantes, RG-44 et suivantes) : moteur sans DOM, en centimes entiers.
 *
 * Les indicateurs se calculent à une date (la date du jour, A.8 ligne 15), sur une référence : la baseline de
 * référence du projet, ou le planning actuel quand le projet n'a aucune baseline (A.8 ligne 14). Ils portent sur le
 * budget des TÂCHES seul : la provision n'est pas du travail réalisé (A.8 ligne 6).
 *
 *   BAC = somme des budgets de la référence
 *   PV  = budget des tâches dont la fin prévue est au plus tard aujourd'hui (par palier, A.8 ligne 12(a))
 *   EV  = budget de chaque tâche × son avancement (valeur acquise proportionnelle, A.8 ligne 5)
 *   AC  = coût réel total du projet (RG-37)
 *   CV = EV − AC ; SV = EV − PV ; CPI = EV / AC ; SPI = EV / PV
 *   EAC = BAC / CPI  |  AC + ETC  |  AC + BAC − EV ; VAC = BAC − EAC
 *
 * Aucune somme ni différence n'est faite en nombres à virgule (RG-35) ; les produits qui peuvent dépasser 2^53
 * passent par BigInt. Un indicateur qui ne se calcule pas vaut null et dit pourquoi : jamais 0 ni l'infini (RG-48). */
const Evm = (() => {
  const amt = Budget.amt;
  const LIGHTS = Object.freeze(['green', 'orange', 'red', 'none']);

  /**
   * a × k / b arrondi à l'entier, la moitié vers le haut (a, k >= 0, b > 0), sans perte de précision au-delà de 2^53.
   * @returns {number|null} null si le résultat dépasse la limite des entiers exacts.
   */
  const FAST = 2 ** 52; // en dessous, numérateur et dénominateur sont des entiers exacts, quotient et reste aussi
  function divRound(a, b, k = 1) {
    const n = 2 * a * k + b, d = 2 * b;
    if (n <= FAST && d <= FAST) { // cas courant : sans BigInt, même résultat exact (quotient corrigé par le reste)
      const q = Math.floor(n / d), r = n - q * d;
      return r < 0 ? q - 1 : r >= d ? q + 1 : q;
    }
    const A = BigInt(a) * BigInt(k), B = BigInt(b);
    const q = (2n * A + B) / (2n * B);
    return q > BigInt(Number.MAX_SAFE_INTEGER) ? null : Number(q);
  }

  /**
   * Baseline de référence (RG-44) : celle que désigne le projet ; à défaut la baseline « initiale », à défaut la
   * première. Sans aucune baseline : null, et le calcul porte sur le planning actuel.
   */
  function reference(project) {
    const list = project.baselines || [];
    if (!list.length) return null;
    return list.find(b => b.id === project.baselineRef) || list.find(b => b.initial) || list[0];
  }

  /** Voyant d'un rapport, décidé sur la valeur AFFICHÉE (arrondie au centième) : vert, orange ou rouge (RG-49). */
  function lightOf(hundredths, project) {
    const green = project.evmGreen || 100, red = project.evmRed || 90;
    return hundredths >= green ? 'green' : hundredths >= red ? 'orange' : 'red';
  }

  const none = reason => ({ value: null, hundredths: null, light: 'none', reason });
  function ratio(num, den, project) {
    const h = divRound(num, den, 100);
    const hundredths = h == null ? Model.LIMITS.ratioMax : Math.min(h, Model.LIMITS.ratioMax);
    return { value: num / den, hundredths, light: lightOf(hundredths, project), reason: null };
  }
  const amount = (cents, bac) => ({ cents, vac: bac - cents, reason: null });
  const noAmount = reason => ({ cents: null, vac: null, reason });

  /**
   * Indicateurs de valeur acquise à la date `today` (numéro de jour).
   * @returns {{ref, basis:'baseline'|'plan', bac, pv, ev, ac, cv, sv, cpi, spi, eac:{byCpi,byEtc,byEv}, etc,
   *            added:string[], removed:string[]}}
   *   cpi, spi : { value, hundredths, light, reason } ; reason vaut null, 'noBudget', 'noActual' ou 'noPlanned'.
   *   eac.* : { cents, vac, reason } ; reason vaut null, 'noBudget', 'noActual', 'noEarned', 'noEtc' ou 'overflow'.
   */
  function compute(project, sched, today) {
    const ref = reference(project);
    const entries = [];
    const added = [], removed = [];
    if (ref) {
      // Référence = baseline : budgets et fins prévues figés ; l'avancement est celui d'aujourd'hui. Une tâche supprimée
      // depuis la capture garde son budget dans le BAC et la PV, sans valeur acquise ; une tâche ajoutée depuis n'est
      // pas dans le BAC, mais son coût réel est dans AC (RG-47).
      const byId = new Map(project.tasks.map(t => [t.id, t]));
      const inRef = new Set();
      for (const bt of ref.tasks) {
        inRef.add(bt.id);
        const t = byId.get(bt.id);
        const live = !!t && t.type === 'task';
        entries.push({ budget: amt(bt.budget), endDn: Dates.parse(bt.end), pct: live ? t.pct : 0 });
        if (!live && amt(bt.budget) > 0) removed.push(bt.id);
      }
      for (const t of project.tasks) if (t.type === 'task' && !inRef.has(t.id) && (amt(t.budget) > 0 || amt(t.actual) > 0)) added.push(t.id);
    } else {
      for (const t of project.tasks) {
        if (t.type !== 'task') continue;
        entries.push({ budget: amt(t.budget), endDn: sched.tasks.get(t.id).endDn, pct: t.pct });
      }
    }
    let bac = 0, pv = 0, ev = 0;
    for (const e of entries) {
      bac += e.budget;
      if (e.endDn <= today) pv += e.budget;
      ev += divRound(e.budget, 100, e.pct); // budget × avancement, au centime, moitié vers le haut
    }
    const ac = Budget.totals(project).actual;
    const noBudget = bac === 0;

    const cpi = noBudget ? none('noBudget') : ac === 0 ? none('noActual') : ratio(ev, ac, project);
    const spi = noBudget ? none('noBudget') : pv === 0 ? none('noPlanned') : ratio(ev, pv, project);

    let byCpi;
    if (noBudget) byCpi = noAmount('noBudget');
    else if (ac === 0) byCpi = noAmount('noActual');
    else if (ev === 0) byCpi = noAmount('noEarned');
    else { const c = divRound(bac, ev, ac); byCpi = c == null ? noAmount('overflow') : amount(c, bac); }
    const hasEtc = project.etc != null;
    const eac = {
      byCpi, // BAC / CPI sans arrondir le CPI : 350,00 et non 351 (A.8 ligne 12(b))
      byEtc: hasEtc ? amount(ac + amt(project.etc), bac) : noAmount('noEtc'),
      byEv: noBudget ? noAmount('noBudget') : amount(ac + bac - ev, bac),
    };
    return { ref, basis: ref ? 'baseline' : 'plan', today, bac, pv, ev, ac, cv: ev - ac, sv: ev - pv, cpi, spi, eac, etc: hasEtc ? amt(project.etc) : null, added, removed };
  }

  /** Point de situation (RG-51) : photo des indicateurs à la date du jour, enregistrée sur geste explicite. */
  function point(res, label = '') {
    return {
      date: Dates.toISO(res.today), label: String(label).trim().slice(0, 100), ref: res.ref ? res.ref.name : '',
      cpi: res.cpi.hundredths, spi: res.spi.hundredths, bac: res.bac, pv: res.pv, ev: res.ev, ac: res.ac, etc: res.etc,
    };
  }

  return { LIGHTS, divRound, reference, lightOf, compute, point };
})();
