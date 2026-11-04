/*
 * Valeur acquise (étape B, EF-131 et suivantes, RG-44 et suivantes) : moteur sans DOM, en centimes entiers.
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
 * passent par BigInt. Un indicateur qui ne se calcule pas vaut null et dit pourquoi : jamais 0 ni l'infini (RG-48).
 *
 * Appelle : Budget, Dates, Metrics, Model
 * Appelée par : 72-baselines.js, 76-budget.js, 77-report.js, Rates
 */
const Evm = (() => {
  const amt = Budget.amt;
  const LIGHTS = Object.freeze(['green', 'orange', 'red', 'none']);

  /**
   * a × k / b arrondi à l'entier, la moitié vers le haut (a, k >= 0, b > 0), sans perte de précision au-delà de 2^53.
   * @returns {number|null} null si le résultat dépasse la limite des entiers exacts.
   */
  const FAST = 2 ** 52; // en dessous, numérateur et dénominateur sont des entiers exacts, quotient et reste aussi
  /**
   * Appelle : aucune
   * Appelée par : Evm.compute(), Evm.ratio(), Rates.costOf()
   */
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
   * Appelle : aucune
   * Appelée par : baselinesWindow(), Evm.compute(), Evm.curves()
   */
  function reference(project) {
    const list = project.baselines || [];
    if (!list.length) return null;
    return list.find(b => b.id === project.baselineRef) || list.find(b => b.initial) || list[0];
  }

  /**
   * Voyant d'un rapport, décidé sur la valeur AFFICHÉE (arrondie au centième) : vert, orange ou rouge (RG-49).
   * Appelle : aucune
   * Appelée par : Evm.ratio()
   */
  function lightOf(hundredths, project) {
    const green = project.evmGreen || 100, red = project.evmRed || 90;
    return hundredths >= green ? 'green' : hundredths >= red ? 'orange' : 'red';
  }

  /**
   * Appelle : aucune
   * Appelée par : Evm.compute()
   */
  const none = reason => ({ value: null, hundredths: null, light: 'none', reason });
  /**
   * Appelle : Evm.divRound(), Evm.lightOf()
   * Appelée par : Evm.compute()
   */
  function ratio(num, den, project) {
    const h = divRound(num, den, 100);
    const hundredths = h == null ? Model.LIMITS.ratioMax : Math.min(h, Model.LIMITS.ratioMax);
    return { value: num / den, hundredths, light: lightOf(hundredths, project), reason: null };
  }
  /**
   * Appelle : aucune
   * Appelée par : Evm.compute()
   */
  const amount = (cents, bac) => ({ cents, vac: bac - cents, reason: null });
  /**
   * Appelle : aucune
   * Appelée par : Evm.compute()
   */
  const noAmount = reason => ({ cents: null, vac: null, reason });

  /**
   * Indicateurs de valeur acquise à la date `today` (numéro de jour).
   * @returns {{ref, basis:'baseline'|'plan', bac, pv, ev, ac, cv, sv, cpi, spi, eac:{byCpi,byEtc,byEv}, etc,
   *            added:string[], removed:string[]}}
   *   cpi, spi : { value, hundredths, light, reason } ; reason vaut null, 'noBudget', 'noActual' ou 'noPlanned'.
   *   eac.* : { cents, vac, reason } ; reason vaut null, 'noBudget', 'noActual', 'noEarned', 'noEtc' ou 'overflow'.
   * Appelle : Budget.totals(), Dates.parse(), Evm.amount(), Evm.divRound(), Evm.noAmount(), Evm.none(), Evm.ratio(),
   *   Evm.reference()
   * Appelée par : action « evmPointAdd », Evm.curves(), paintEvm(), reportSections()
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

  /**
   * Point de situation (RG-51) : photo des indicateurs à la date du jour, enregistrée sur geste explicite.
   * Appelle : Dates.toISO()
   * Appelée par : action « evmPointAdd »
   */
  function point(res, label = '') {
    return {
      date: Dates.toISO(res.today), label: String(label).trim().slice(0, 100), ref: res.ref ? res.ref.name : '',
      cpi: res.cpi.hundredths, spi: res.spi.hundredths, bac: res.bac, pv: res.pv, ev: res.ev, ac: res.ac, etc: res.etc,
    };
  }

  /**
   * Courbes PV / EV / AC dans le temps (EF-151, RG-59), en centimes cumulés, par semaine ou par mois.
   *
   * PV est continue : à la fin de chaque période, budget des tâches de la baseline de référence dont la fin prévue est au
   * plus tard le dernier jour de la période (même palier que compute()). EV et AC ne sont connues qu'aux mesures : les
   * points de situation qui ont leurs montants (un point relu d'un export « sans montants » n'en a plus) et la date du
   * jour (calcul de compute()). Aucune valeur passée n'est reconstituée ni enregistrée automatiquement (A.8 ligne 15).
   * Dans une période, la mesure la plus récente l'emporte ; celle du jour passe devant un point du même jour. Un point
   * daté après aujourd'hui (horloge de l'appareil reculée) ou avant le début de la grille n'est pas tracé : la
   * grille reste à la taille du projet (un point ancien ne l'allonge pas, GR491_Backend_4). L'AC est le coût réel TOTAL du projet
   * (RG-47), et non la courbe réelle des coûts de RG-38, qui ne compte que les tâches terminées.
   *
   * @returns {{reason:'noBaseline'|'noBudget'}|{reason:null, ref, bac, periods:{start,end}[], pv:number[],
   *            ev:(number|null)[], ac:(number|null)[], marks:({dn,label,today:boolean}|null)[], skipped:number}}
   *   Sans baseline de référence, ou si elle n'a aucun budget, rien n'est tracé et la raison est donnée (jamais 0).
   *   skipped : points de situation non tracés (sans montants, datés après aujourd'hui ou avant la grille).
   *   now : résultat de compute() pour aujourd'hui s'il est déjà calculé (sinon calculé ici).
   * Appelle : Dates.parse(), Evm.compute(), Evm.reference(), Metrics.periods()
   * Appelée par : paintEvmCurves()
   */
  function curves(project, sched, today, unit = 'week', now = null) {
    const ref = reference(project);
    if (!ref) return { reason: 'noBaseline' };
    const ends = ref.tasks.map(bt => ({ budget: amt(bt.budget), endDn: Dates.parse(bt.end) }))
      .filter(e => e.budget > 0 && e.endDn != null).sort((a, b) => a.endDn - b.endDn);
    const bac = ends.reduce((a, e) => a + e.budget, 0);
    if (bac === 0) return { reason: 'noBudget', ref };

    if (!now) now = compute(project, sched, today);
    // Grille : du début du projet (ou d'une fin prévue plus ancienne) à la fin la plus tardive, aujourd'hui compris.
    const first = Math.min(Dates.parse(project.projectStart), ends[0].endDn, today);
    const last = Math.max(sched.projectEndDn, ends[ends.length - 1].endDn, today);
    const periods = Metrics.periods(first, last, unit);
    const n = periods.length;
    const marks = [];
    let skipped = 0;
    for (const p of project.statusPoints || []) {
      const dn = Dates.parse(p.date);
      if (dn == null || dn > today || dn < periods[0].start || p.ev == null || p.ac == null) { skipped++; continue; }
      marks.push({ dn, ev: p.ev, ac: p.ac, label: p.label, today: false });
    }
    marks.sort((a, b) => a.dn - b.dn); // tri stable : à date égale, l'ordre d'enregistrement
    marks.push({ dn: today, ev: now.ev, ac: now.ac, label: '', today: true });

    const pv = new Array(n), ev = new Array(n).fill(null), ac = new Array(n).fill(null), at = new Array(n).fill(null);
    // Parcours fusionné (fins triées, périodes croissantes) : O(tâches + périodes).
    let k = 0, acc = 0;
    periods.forEach((p, i) => {
      while (k < ends.length && ends[k].endDn <= p.end) acc += ends[k++].budget;
      pv[i] = acc;
    });
    let i = 0;
    for (const m of marks) {
      while (i < n - 1 && periods[i].end < m.dn) i++;
      ev[i] = m.ev; ac[i] = m.ac; at[i] = { dn: m.dn, label: m.label, today: m.today };
    }
    return { reason: null, ref, bac, periods, pv, ev, ac, marks: at, skipped };
  }

  return { LIGHTS, divRound, reference, lightOf, compute, point, curves };
})();
