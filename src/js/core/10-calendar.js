/* Calendrier du projet (RG-01 à RG-03, 3.9).
 *
 * Les jours ouvrés sont numérotés : l'index 0 est le premier jour ouvré à partir du début du
 * projet, les suivants 1, 2…, les précédents −1, −2… Une durée, un délai ou un écart en jours
 * ouvrés devient alors une simple soustraction d'index. Les tables s'étendent à la demande,
 * dans la limite de Dates.MIN_DN … Dates.MAX_DN (au-delà : RangeError, signalée à l'utilisateur). */
const Calendar = (() => {
  const HOLIDAY_SETS = ['FR', 'FR-AM', 'BE', 'DE', 'GB', 'US', 'CH', 'NONE'];
  const DEFAULT = Object.freeze({ workDays: [1, 1, 1, 1, 1, 0, 0], holidays: 'FR', daysOff: [], daysWorked: [] });

  /** Dimanche de Pâques (calendrier grégorien, algorithme de Meeus/Jones/Butcher). */
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return Dates.fromYMD(y, month, day);
  }

  /** n-ième jour de semaine wd (0 = lundi … 6 = dimanche) du mois m de l'année y ; n = −1 pour le dernier. */
  function nthWeekday(y, m, wd, n) {
    if (n > 0) { const first = Dates.fromYMD(y, m, 1); return first + ((wd - Dates.weekday(first) + 7) % 7) + 7 * (n - 1); }
    const last = Dates.fromYMD(y, m + 1, 1) - 1;
    return last - ((Dates.weekday(last) - wd + 7) % 7);
  }

  /** Royaume-Uni, Angleterre et pays de Galles (gov.uk) : un férié un week-end est remplacé par le premier jour de semaine libre qui suit. */
  function holidaysGB(y, E, out) {
    out.set(E - 2, 'hol.goodFriday');
    out.set(E + 1, 'hol.easterMonday');
    out.set(nthWeekday(y, 5, 0, 1), 'hol.earlyMay');
    out.set(nthWeekday(y, 5, 0, -1), 'hol.springBank');
    out.set(nthWeekday(y, 8, 0, -1), 'hol.summerBank');
    const weekend = [];
    for (const [m, d, key] of [[1, 1, 'hol.newYear'], [12, 25, 'hol.christmas'], [12, 26, 'hol.boxingDay']]) {
      const dn = Dates.fromYMD(y, m, d);
      if (Dates.weekday(dn) < 5) out.set(dn, key); else weekend.push([dn, key]);
    }
    for (const [dn, key] of weekend) { let s = dn; do { s++; } while (Dates.weekday(s) >= 5 || out.has(s)); out.set(s, key); }
    return out;
  }

  /** États-Unis, jours fédéraux (OPM) en dates observées : un samedi devient le vendredi, un dimanche le lundi. */
  function holidaysUS(y, out) {
    const observed = dn => { const w = Dates.weekday(dn); return w === 5 ? dn - 1 : w === 6 ? dn + 1 : dn; };
    const fixed = (m, d, key) => { const dn = observed(Dates.fromYMD(y, m, d)); if (Dates.ymd(dn).y === y) out.set(dn, key); };
    fixed(1, 1, 'hol.newYear');
    // Le 1er janvier de l'année suivante, tombant un samedi, est observé le 31 décembre de celle-ci.
    const nextNewYear = Dates.fromYMD(y + 1, 1, 1);
    if (Dates.weekday(nextNewYear) === 5) out.set(nextNewYear - 1, 'hol.newYear');
    if (y >= 1986) out.set(nthWeekday(y, 1, 0, 3), 'hol.mlk');
    out.set(nthWeekday(y, 2, 0, 3), 'hol.presidents');
    out.set(nthWeekday(y, 5, 0, -1), 'hol.memorial');
    if (y >= 2021) fixed(6, 19, 'hol.juneteenth');
    fixed(7, 4, 'hol.independence');
    out.set(nthWeekday(y, 9, 0, 1), 'hol.laborDay');
    out.set(nthWeekday(y, 10, 0, 2), 'hol.columbus');
    fixed(11, 11, 'hol.veterans');
    out.set(nthWeekday(y, 11, 3, 4), 'hol.thanksgiving');
    fixed(12, 25, 'hol.christmas');
    return out;
  }

  /** Jours fériés d'une année pour un jeu donné : Map dn → clé de libellé (traduite par l'interface). */
  function holidaysOf(set, y) {
    const out = new Map();
    if (set === 'NONE') return out;
    const E = easter(y);
    const add = (dn, key) => out.set(dn, key);
    const fixed = (m, d, key) => add(Dates.fromYMD(y, m, d), key);
    if (set === 'GB') return holidaysGB(y, E, out);
    if (set === 'US') return holidaysUS(y, out);
    if (set === 'CH') {
      // Seul le 1er août est férié par la loi fédérale ; les autres jours listés sont ceux observés dans presque tous les cantons.
      // Lundi de Pâques, lundi de Pentecôte, 26 décembre, etc. varient selon le canton : à ajouter dans « Jours chômés ».
      fixed(1, 1, 'hol.newYear'); add(E - 2, 'hol.goodFriday'); add(E + 39, 'hol.ascension');
      fixed(8, 1, 'hol.swissNational'); fixed(12, 25, 'hol.christmas');
      return out;
    }
    fixed(1, 1, 'hol.newYear');
    if (set === 'DE' || set === 'FR-AM') add(E - 2, 'hol.goodFriday');
    add(E + 1, 'hol.easterMonday');
    fixed(5, 1, 'hol.labour');
    if (set === 'FR' || set === 'FR-AM') fixed(5, 8, 'hol.victory');
    add(E + 39, 'hol.ascension');
    add(E + 50, 'hol.whitMonday');
    if (set === 'FR' || set === 'FR-AM') fixed(7, 14, 'hol.bastille');
    if (set === 'BE') fixed(7, 21, 'hol.belgium');
    if (set !== 'DE') { fixed(8, 15, 'hol.assumption'); fixed(11, 1, 'hol.allSaints'); fixed(11, 11, 'hol.armistice'); }
    if (set === 'DE') fixed(10, 3, 'hol.germanUnity');
    fixed(12, 25, 'hol.christmas');
    if (set === 'DE' || set === 'FR-AM') fixed(12, 26, 'hol.stStephen');
    return out;
  }

  /** Développe une liste de plages {start, end, label} en Map dn → libellé. */
  function expandRanges(list) {
    const out = new Map();
    for (const r of list || []) {
      const a = Dates.parse(r.start), b = Dates.parse(r.end || r.start);
      if (a == null || b == null) continue;
      for (let dn = a; dn <= b; dn++) out.set(dn, r.label || '');
    }
    return out;
  }

  /**
   * Crée le calendrier de calcul.
   * @param {object} def   calendrier du projet (3.9)
   * @param {string} startIso  début du projet : l'index 0 est le premier jour ouvré à partir de cette date
   */
  function create(def, startIso) {
    const cfg = def || DEFAULT;
    const workDays = (cfg.workDays || DEFAULT.workDays).map(v => !!v);
    const set = HOLIDAY_SETS.includes(cfg.holidays) ? cfg.holidays : 'FR';
    const off = expandRanges(cfg.daysOff);
    const worked = expandRanges(cfg.daysWorked);
    const holCache = new Map();

    function holidayKey(dn) {
      const y = Dates.ymd(dn).y;
      if (!holCache.has(y)) holCache.set(y, holidaysOf(set, y));
      return holCache.get(y).get(dn) || null;
    }

    /** RG-01 : le jour travaillé exceptionnel l'emporte sur tout. */
    function isWork(dn) {
      if (worked.has(dn)) return true;
      if (!workDays[Dates.weekday(dn)]) return false;
      if (off.has(dn)) return false;
      return holidayKey(dn) == null;
    }

    /** Pourquoi un jour n'est pas travaillé : {kind:'holiday', key} | {kind:'off', label} | {kind:'weekend'} | null. */
    function dayInfo(dn) {
      if (worked.has(dn)) return { kind: 'worked', label: worked.get(dn) };
      if (off.has(dn) && workDays[Dates.weekday(dn)]) return { kind: 'off', label: off.get(dn) };
      const hk = holidayKey(dn);
      if (hk && workDays[Dates.weekday(dn)]) return { kind: 'holiday', key: hk };
      if (!workDays[Dates.weekday(dn)]) return { kind: 'weekend', key: hk };
      return null;
    }

    const start = Dates.parse(startIso);
    if (start == null) throw new RangeError('calendar.start');
    if (!workDays.some(Boolean) && worked.size === 0) throw new RangeError('calendar.noWorkday');

    // fwd[i] = dn du jour ouvré d'index i (i ≥ 0) ; bwd[j] = dn du jour ouvré d'index −(j+1).
    const fwd = [], bwd = [];
    let fwdScan = start - 1;   // dernier dn examiné vers l'avant
    let bwdScan = start;       // dernier dn examiné vers l'arrière

    function growFwd(untilDn) {
      while (fwdScan < untilDn) {
        fwdScan++;
        if (fwdScan > Dates.MAX_DN) throw new RangeError('calendar.range');
        if (isWork(fwdScan)) fwd.push(fwdScan);
      }
    }
    function growFwdIdx(i) {
      // Une semaine sans aucun jour ouvré est possible (fermeture) : on avance jusqu'à trouver.
      while (fwd.length <= i) growFwd(fwdScan + 7);
    }
    function growBwd(untilDn) {
      while (bwdScan > untilDn) {
        bwdScan--;
        if (bwdScan < Dates.MIN_DN) throw new RangeError('calendar.range');
        if (isWork(bwdScan)) bwd.push(bwdScan);
      }
    }
    function growBwdIdx(j) { while (bwd.length <= j) growBwd(bwdScan - 7); }

    growFwdIdx(0);

    /** dn du jour ouvré d'index i. */
    function dnOf(i) {
      if (i >= 0) { growFwdIdx(i); return fwd[i]; }
      growBwdIdx(-i - 1); return bwd[-i - 1];
    }

    // Recherche dichotomique : premier index de arr (croissant) dont la valeur est ≥ v.
    function lowerBound(arr, v) {
      let lo = 0, hi = arr.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < v) lo = mid + 1; else hi = mid; }
      return lo;
    }

    /** Index du premier jour ouvré ≥ dn. */
    function ceil(dn) {
      if (dn >= fwd[0]) {
        growFwd(dn);
        // Garantit l'existence d'un jour ouvré ≥ dn, sans étendre la table à chaque appel.
        while (fwd[fwd.length - 1] < dn) growFwdIdx(fwd.length);
        return lowerBound(fwd, dn);
      }
      // dn avant le premier jour ouvré du projet : on cherche parmi les jours précédents.
      growBwd(dn);
      // bwd est décroissant : le plus petit jour ouvré ≥ dn est le dernier élément ≥ dn.
      let j = -1;
      for (let lo = 0, hi = bwd.length - 1; lo <= hi;) {
        const mid = (lo + hi) >> 1;
        if (bwd[mid] >= dn) { j = mid; lo = mid + 1; } else hi = mid - 1;
      }
      return j < 0 ? 0 : -(j + 1);
    }

    /** Index du dernier jour ouvré ≤ dn. */
    function floor(dn) {
      const c = ceil(dn);
      return dnOf(c) === dn ? c : c - 1;
    }

    /** Nombre de jours ouvrés de a à b inclus (0 si b < a). */
    function count(a, b) { return b < a ? 0 : Math.max(0, floor(b) - ceil(a) + 1); }

    return { isWork, dayInfo, holidayKey, dnOf, ceil, floor, count, startDn: start, set };
  }

  return { create, easter, holidaysOf, HOLIDAY_SETS, DEFAULT };
})();
