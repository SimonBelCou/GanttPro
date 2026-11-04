/*
 * Dates « civiles » sans fuseau : un jour est un entier (dn), nombre de jours depuis le
 * 01/01/1970. Tous les calculs se font sur ces entiers, jamais sur des Date locales, ce qui
 * évite les décalages d'heure d'été et de fuseau (défaut A-23 de la version 2.3).
 * La date du jour est lue dans le fuseau de l'utilisateur (todayDn).
 *
 * Appelle : aucune
 * Appelée par : 31 modules et fichiers (voir Architecture.md)
 */
const Dates = (() => {
  const MIN_YEAR = 1970;
  const MAX_YEAR = 2199; // borne de sûreté : un fichier ne peut pas forcer un calcul sur des millénaires
  const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

  /**
   * 'AAAA-MM-JJ' → dn, ou null si la chaîne n'est pas une date existante dans les bornes.
   * Appelle : aucune
   * Appelée par : 51 fonctions (usage général)
   */
  function parse(s) {
    if (typeof s !== 'string') return null;
    const m = ISO.exec(s);
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    if (y < MIN_YEAR || y > MAX_YEAR || mo < 1 || mo > 12 || d < 1) return null;
    const t = Date.UTC(y, mo - 1, d);
    const back = new Date(t);
    if (back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
    return Math.round(t / 86400000);
  }

  /**
   * Appelle : aucune
   * Appelée par : (initialisation de Dates), action « calMonth », Calendar.easter(), Calendar.holidaysGB(),
   *   Calendar.holidaysOf(), Calendar.holidaysUS(), Calendar.nthWeekday(), Dates, Dates.monthEnd(),
   *   Dates.monthStart(), Dates.todayDn(), I18n.dateTime()
   */
  function fromYMD(y, m, d) { return Math.round(Date.UTC(y, m - 1, d) / 86400000); }

  /**
   * Appelle : aucune
   * Appelée par : 18 fonctions (usage général)
   */
  function toISO(dn) {
    const t = new Date(dn * 86400000);
    const p = (n, w) => String(n).padStart(w, '0');
    return `${p(t.getUTCFullYear(), 4)}-${p(t.getUTCMonth() + 1, 2)}-${p(t.getUTCDate(), 2)}`;
  }

  /**
   * {y, m (1-12), d} d'un dn.
   * Appelle : aucune
   * Appelée par : 13 fonctions (usage général)
   */
  function ymd(dn) {
    const t = new Date(dn * 86400000);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  }

  /**
   * Jour de la semaine : 0 = lundi … 6 = dimanche (le 01/01/1970 était un jeudi).
   * Appelle : aucune
   * Appelée par : Calendar.create(), Calendar.holidaysGB(), Calendar.holidaysUS(), Calendar.nthWeekday(),
   *   Dates.mondayOf(), I18n.date()
   */
  function weekday(dn) { return ((dn + 3) % 7 + 7) % 7; }

  /**
   * Date du jour dans le fuseau de l'ordinateur de l'utilisateur.
   * Appelle : Dates.fromYMD()
   * Appelée par : 25 fonctions (usage général)
   */
  function todayDn(now = new Date()) {
    return fromYMD(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }

  /**
   * Appelle : Dates.weekday()
   * Appelée par : buildPrintGantt(), calPreview(), ganttPng(), gridRange(), Metrics.periods()
   */
  function mondayOf(dn) { return dn - weekday(dn); }
  /**
   * Appelle : Dates.fromYMD(), Dates.ymd()
   * Appelée par : action « calAdd », calendarWindow(), Metrics.periods()
   */
  function monthStart(dn) { const { y, m } = ymd(dn); return fromYMD(y, m, 1); }
  /**
   * Appelle : Dates.fromYMD(), Dates.ymd()
   * Appelée par : calPreview(), Metrics.periods()
   */
  function monthEnd(dn) { const { y, m } = ymd(dn); return fromYMD(y, m + 1, 1) - 1; }

  const MAX_DN = fromYMD(MAX_YEAR, 12, 31);
  const MIN_DN = fromYMD(MIN_YEAR, 1, 1);

  return { parse, fromYMD, toISO, ymd, weekday, todayDn, mondayOf, monthStart, monthEnd, MIN_DN, MAX_DN, MIN_YEAR, MAX_YEAR };
})();
