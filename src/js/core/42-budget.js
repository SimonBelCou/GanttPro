/* Budget, étape A (EF-112 à EF-127, RG-35 à RG-43).
 *
 * Tout montant est un ENTIER de centimes (RG-35) : aucune somme ni différence n'est faite en nombres à virgule.
 * Avec au plus 1 000 tâches de 50 000 000 000,00 chacune plus la provision, un total reste sous 5,01e15, donc
 * sous la limite des entiers exacts du moteur. Moteur sans DOM : l'affichage reçoit la langue en paramètre. */
const Budget = (() => {
  const NBSP = ' ', NNBSP = ' ', MINUS = '−';
  const MAX = Model.LIMITS.amount;
  const COMPACT_FROM = 100000000; // 1 000 000,00 en centimes (RG-43)

  const amt = v => (Number.isSafeInteger(v) && v > 0 ? v : 0);

  /**
   * Saisie d'un montant en unités (EF-112) : virgule ou point décimal, espaces ignorés, au plus deux décimales.
   * Les espaces et le symbole de la devise éventuel sont ignorés (RG-42) ; une saisie vide vaut 0.
   * @returns {{ok:true, cents:number}|{ok:false, reason:'format'|'negative'|'decimals'|'max'}}
   */
  function parse(text, symbol = '') {
    let s = String(text == null ? '' : text);
    if (symbol) s = s.split(symbol).join('');
    s = s.replace(/[\s  ]/g, '');
    if (s === '') return { ok: true, cents: 0 };
    if (s[0] === '-' || s[0] === '−') return /^[-−]\d+([.,]\d*)?$/.test(s) ? { ok: false, reason: 'negative' } : { ok: false, reason: 'format' };
    const m = /^(\d+)(?:([.,])(\d*))?$/.exec(s);
    if (!m) return { ok: false, reason: 'format' };
    const frac = m[3] || '';
    if (frac.length > 2) return { ok: false, reason: 'decimals' };
    const intPart = m[1].replace(/^0+(?=\d)/, '');
    if (intPart.length > 12) return { ok: false, reason: 'max' };
    const cents = Number(intPart) * 100 + Number(frac.padEnd(2, '0'));
    if (cents > MAX) return { ok: false, reason: 'max' };
    return { ok: true, cents };
  }

  /** Texte d'un champ de saisie (sans groupement, avec le séparateur de la langue) : 123450 → « 1234,5 » (fr). */
  function toInput(cents, lang) {
    const c = amt(cents);
    const frac = String(c % 100).padStart(2, '0').replace(/0+$/, '');
    const sep = lang === 'fr' ? ',' : '.';
    return Math.floor(c / 100) + (frac ? sep + frac : '');
  }

  const groupInt = (n, lang) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'fr' ? NNBSP : ',');

  /** Place le symbole de la devise : après le montant en français (« 1 234,56 € »), avant en anglais (« €1,234.56 »). */
  function withSymbol(body, symbol, lang, negative) {
    const sign = negative ? MINUS : '';
    if (!symbol) return sign + body;
    return lang === 'fr' ? `${sign}${body}${NBSP}${symbol}` : `${sign}${symbol}${body}`;
  }

  /** Montant complet : « 1 234,56 € » (fr) / « €1,234.56 » (en). Accepte une valeur négative (reste, écart). */
  function format(cents, { lang = 'fr', symbol = '' } = {}) {
    const neg = cents < 0, c = Math.abs(cents);
    const body = groupInt(Math.floor(c / 100), lang) + (lang === 'fr' ? ',' : '.') + String(c % 100).padStart(2, '0');
    return withSymbol(body, symbol, lang, neg);
  }

  /**
   * Montant compact (RG-43) : en entier sous 1 000 000,00 ; au-delà, en millions (M), ou en milliards (Md en français,
   * B en anglais) dès que l'arrondi atteint 1 000 M. Deux décimales au plus, moitié vers le haut, calculées sur des
   * entiers ; les zéros de fin sont retirés. Valeur négative acceptée.
   */
  function formatCompact(cents, { lang = 'fr', symbol = '' } = {}) {
    const neg = cents < 0, c = Math.abs(cents);
    if (c < COMPACT_FROM) return format(cents, { lang, symbol });
    let h = Math.floor((c + 500000) / 1000000); // centièmes de million
    let suffix = 'M';
    if (h >= 100000) { h = Math.floor((c + 500000000) / 1000000000); suffix = lang === 'fr' ? 'Md' : 'B'; } // centièmes de milliard
    const whole = Math.floor(h / 100), frac = String(h % 100).padStart(2, '0').replace(/0+$/, '');
    const body = whole + (frac ? (lang === 'fr' ? ',' : '.') + frac : '');
    return withSymbol(lang === 'fr' ? `${body}${NBSP}${suffix}` : body + suffix, symbol, lang, neg);
  }

  /**
   * Montants propres et cumulés de chaque ligne (RG-36) : une tâche porte les siens, un jalon vaut 0, une
   * récapitulative est la somme de sa descendance. @returns {Map<id, {budget, actual}>}
   */
  function amounts(project) {
    const out = new Map();
    const byId = new Map(project.tasks.map(t => [t.id, t]));
    for (const t of project.tasks) out.set(t.id, { budget: 0, actual: 0 });
    for (const t of project.tasks) {
      if (t.type !== 'task') continue;
      const b = amt(t.budget), a = amt(t.actual);
      let cur = t, guard = 0;
      while (cur && guard++ <= Model.LIMITS.depth + 1) {
        const o = out.get(cur.id);
        o.budget += b; o.actual += a;
        cur = cur.parent ? byId.get(cur.parent) : null;
      }
    }
    return out;
  }

  /** Totaux du projet (RG-37) : BAC, provision, budget total, coût réel total, reste (négatif = dépassement). */
  function totals(project) {
    let bac = 0, actual = 0;
    for (const t of project.tasks) if (t.type === 'task') { bac += amt(t.budget); actual += amt(t.actual); }
    const provision = amt(project.provision);
    const total = bac + provision;
    return { bac, provision, total, actual, remaining: total - actual };
  }

  /** Une présence d'au moins un montant (EF-117 : l'onglet Budget n'apparaît qu'à partir de là). */
  function hasAmounts(project) {
    return amt(project.provision) > 0 || project.tasks.some(t => t.type === 'task' && (amt(t.budget) > 0 || amt(t.actual) > 0));
  }

  /**
   * Tableau par catégorie (RG-40) : une ligne par catégorie qui a au moins une tâche (hors récapitulatives), classée par
   * ordre alphabétique, « sans catégorie » (id '') en dernier ; écart = budget moins coût réel ; total en pied.
   */
  function byCategory(project) {
    const rows = new Map();
    for (const t of project.tasks) {
      if (t.type === 'summary') continue;
      const key = project.categories.some(c => c.id === t.cat) ? t.cat : '';
      if (!rows.has(key)) rows.set(key, { id: key, name: key ? project.categories.find(c => c.id === key).name : '', budget: 0, actual: 0 });
      const r = rows.get(key);
      if (t.type === 'task') { r.budget += amt(t.budget); r.actual += amt(t.actual); }
    }
    const list = [...rows.values()].sort((a, b) => (a.id === '') - (b.id === '') || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
    list.forEach(r => { r.gap = r.budget - r.actual; });
    const total = list.reduce((a, r) => ({ budget: a.budget + r.budget, actual: a.actual + r.actual }), { budget: 0, actual: 0 });
    return { rows: list, total: { ...total, gap: total.budget - total.actual } };
  }

  /** BAC d'une baseline (RG-39) : somme des budgets capturés. */
  function baselineBac(baseline) {
    return baseline.tasks.reduce((a, bt) => a + amt(bt.budget), 0);
  }

  /** Variation du BAC (RG-39) : BAC du projet moins celui de la baseline. */
  function bacVariation(project, baseline) {
    return totals(project).bac - baselineBac(baseline);
  }

  /**
   * Courbe en S des coûts (RG-38, RG-39), en centimes cumulés, sur la grille de périodes de RG-17.
   * planned : budget des tâches dont la fin prévue est au plus tard le dernier jour de la période.
   * real : coût réel des tâches terminées (100 %) dont la fin réelle est dans la période ou avant ; une tâche à 100 %
   * sans fin réelle compte dans la période en cours ; s'arrête à la période qui contient aujourd'hui.
   * La provision et le coût réel des tâches non terminées n'y figurent pas.
   */
  function costCurve(project, sched, today, unit = 'week') {
    const work = project.tasks.filter(t => t.type === 'task');
    let last = sched.projectEndDn;
    const shown = (project.baselines || []).filter(b => b.shownOnScurve);
    for (const b of shown) for (const bt of b.tasks) { const e = Dates.parse(bt.end); if (e != null) last = Math.max(last, e); }
    const ps = Metrics.periods(Dates.parse(project.projectStart), last, unit);
    const planned = ps.map(p => work.reduce((a, t) => a + (sched.tasks.get(t.id).endDn <= p.end ? amt(t.budget) : 0), 0));
    const real = [];
    for (const p of ps) {
      if (p.start > today) break;
      const current = p.end >= today;
      real.push(work.reduce((a, t) => {
        if (t.pct < 100) return a;
        const re = Dates.parse(t.realEnd);
        return a + (re != null ? (re <= p.end ? amt(t.actual) : 0) : (current ? amt(t.actual) : 0));
      }, 0));
    }
    const baselines = {};
    for (const b of shown) {
      baselines[b.id] = ps.map(p => b.tasks.reduce((a, bt) => {
        const e = Dates.parse(bt.end);
        return a + (e != null && e <= p.end ? amt(bt.budget) : 0);
      }, 0));
    }
    return { periods: ps, planned, real, baselines };
  }

  return { MAX, parse, toInput, format, formatCompact, amounts, totals, hasAmounts, byCategory, baselineBac, bacVariation, costCurve };
})();
