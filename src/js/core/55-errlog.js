/*
 * Journal local d'erreurs (EF-151, RG-60 à RG-64) : moteur sans DOM ni stockage.
 *
 * Construit, valide, fait tourner et relit les lignes du journal. L'interface (src/js/ui/15-errlog.js) tient les lignes
 * en mémoire pendant la session et ne les écrit sur l'appareil que si l'utilisateur l'a demandé (décision J1).
 *
 * Vie privée (CLAUDE.md §4 et §13.9, décisions J4 à J6) : une ligne ne contient QUE des valeurs de listes fermées ou
 * de motifs stricts. Jamais le message d'une exception (il peut citer un nom de ressource ou un extrait du fichier),
 * jamais un paramètre de message, jamais un chemin de fichier, aucun acteur (application sans compte).
 *   ts   horodatage UTC ISO 8601          lvl  INFO | WARN | ERROR
 *   act  action métier (liste ACTS)       code clé du catalogue des traductions (préfixes CODE_PREFIXES)
 *   cmp  composant d'origine (liste CMPS) res  'refused' (refus attendu) | 'failed' (échec imprévu)
 *   sid  identifiant de corrélation, tiré au hasard à chaque chargement (8 chiffres hexadécimaux)
 *   ver  version de GanttPro              err  type de l'exception (liste ERRS), facultatif
 *   at   « fonction:ligne » du premier cadre de la pile, facultatif
 * Une ligne relue (stockage) est une donnée NON FIABLE : elle repasse par check() champ par champ.
 *
 * Appelle : I18n, Model
 * Appelée par : Journal
 */
const ErrLog = (() => {
  /** Conservation (décision J2) : 200 lignes et 30 jours au plus. */
  const MAX_LINES = 200;
  const MAX_AGE_MS = 30 * 24 * 3600 * 1000;
  /** Au-delà, le texte relu est refusé en entier (200 lignes font environ 50 000 caractères). */
  const MAX_CHARS = 200000;
  const LEVELS = ['INFO', 'WARN', 'ERROR'];
  const ACTS = ['import', 'export', 'open', 'paste', 'restore', 'store', 'calc', 'edit', 'app'];
  const CMPS = ['files', 'library', 'recovery', 'settings', 'home', 'clipboard', 'versions', 'state', 'editor', 'shortcuts', 'bulk', 'gestures',
    'resources', 'calendar', 'main', 'window'];
  const RES = ['refused', 'failed'];
  /** Types d'exception gardés tels quels ; tout autre nom devient « Other » (un nom de classe peut être fabriqué). */
  const ERRS = ['Invalid', 'Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'URIError', 'EvalError', 'AggregateError',
    'DOMException', 'QuotaExceededError', 'SecurityError', 'NotAllowedError', 'DataError', 'OperationError', 'AbortError', 'Other'];
  /** Seuls ces codes sont journalisés : refus d'import, mots de passe, stockage, calcul, et l'erreur imprévue
   * « app.unexpected ». Jamais err.* (refus de saisie). */
  const CODE_PREFIXES = ['imp.', 'pwd.', 'store.', 'calc.'];
  const UNEXPECTED = 'app.unexpected';
  const CODE_RE = /^[a-z]{2,8}\.[A-Za-z]{1,30}$/;
  const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  const SID_RE = /^[0-9a-f]{8}$/;
  const VER_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  /** Décision J4 : nom de fonction et numéro de ligne, rien d'autre. */
  const AT_RE = /^[\w$.]{1,40}:\d+$/;
  const FIELDS = ['ts', 'lvl', 'act', 'code', 'cmp', 'res', 'sid', 'ver', 'err', 'at'];

  /**
   * Le code existe dans le catalogue français (source de vérité des clés) et porte un préfixe journalisable.
   * Appelle : aucune
   * Appelée par : ErrLog.check()
   */
  const knownCode = code => typeof code === 'string' && CODE_RE.test(code) && (code === UNEXPECTED || CODE_PREFIXES.some(p => code.startsWith(p)))
    && Object.prototype.hasOwnProperty.call(I18n.CATALOGS.fr, code);

  /**
   * Nom du type d'une exception, ramené à la liste fermée ERRS.
   * Appelle : aucune
   * Appelée par : ErrLog.make()
   */
  function errName(e) {
    if (e === null || e === undefined) return undefined;
    let n;
    try { n = e instanceof Model.Invalid ? 'Invalid' : typeof e.name === 'string' ? e.name : 'Other'; } catch { n = 'Other'; }
    return ERRS.includes(n) ? n : 'Other';
  }

  /**
   * Premier cadre utile d'une pile, réduit à « fonction:ligne » (décision J4). Formats Chromium
   * (« at nom (adresse:ligne:colonne) ») et Firefox/WebKit (« nom@adresse:ligne:colonne »). L'adresse (chemin du
   * fichier, qui peut révéler un nom de personne) n'est jamais gardée ; un cadre sans nom devient « anonymous ».
   * Renvoie undefined si rien ne correspond au motif strict.
   * `head` est l'en-tête « Type: message » que Chromium place avant les cadres : il est retiré d'abord, pour qu'un
   * message sur plusieurs lignes ne puisse pas imiter un cadre (le message lui-même n'est jamais gardé).
   * Appelle : aucune
   * Appelée par : ErrLog.make()
   */
  function frame(stack, head = '') {
    if (typeof stack !== 'string') return undefined;
    let text = stack.slice(0, 8000);
    if (head && text.startsWith(head)) text = text.slice(head.length);
    for (const raw of text.split('\n').slice(0, 12)) {
      const s = raw.trim();
      let name, line;
      let m = /^at (?:async )?(?:(.+?) \()?.*:(\d+):\d+\)?$/.exec(s);
      if (m) { name = m[1]; line = m[2]; } else {
        m = /^(?:([^@\s]*)@)?.*:(\d+):\d+$/.exec(s);
        if (m) { name = m[1]; line = m[2]; }
      }
      if (!line) continue;
      name = (name || 'anonymous').replace(/^(?:new |Object\.)/, '').split(' ')[0];
      const at = `${name}:${Number(line)}`;
      if (AT_RE.test(at)) return at;
    }
    return undefined;
  }

  /**
   * Contrôle une ligne (construite ou relue) par liste blanche ; renvoie une copie propre ou null.
   * Appelle : ErrLog.knownCode()
   * Appelée par : ErrLog.make(), ErrLog.parse()
   */
  function check(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    if (Object.keys(o).some(k => !FIELDS.includes(k))) return null;
    if (typeof o.ts !== 'string' || !TS_RE.test(o.ts) || !Number.isFinite(Date.parse(o.ts))) return null;
    if (!LEVELS.includes(o.lvl) || !ACTS.includes(o.act) || !CMPS.includes(o.cmp) || !RES.includes(o.res)) return null;
    if (!knownCode(o.code)) return null;
    if (typeof o.sid !== 'string' || !SID_RE.test(o.sid) || typeof o.ver !== 'string' || !VER_RE.test(o.ver)) return null;
    if (o.err !== undefined && !ERRS.includes(o.err)) return null;
    if (o.at !== undefined && (typeof o.at !== 'string' || !AT_RE.test(o.at))) return null;
    const out = { ts: o.ts, lvl: o.lvl, act: o.act, code: o.code, cmp: o.cmp, res: o.res, sid: o.sid, ver: o.ver };
    if (o.err !== undefined) out.err = o.err;
    if (o.at !== undefined) out.at = o.at;
    return out;
  }

  /**
   * Construit une ligne. `error` (facultatif) ne fournit que son type et sa pile réduite, jamais son message.
   * @param {{code:string, act:string, cmp:string, lvl?:string, res?:string, error?:*}} ev
   * @param {{now:number, sid:string, ver:string}} ctx
   * @returns {object|null} null si un champ sort des listes fermées
   * Appelle : ErrLog.check(), ErrLog.errName(), ErrLog.frame()
   * Appelée par : Journal.record()
   */
  function make(ev, ctx) {
    const o = { ts: new Date(ctx.now).toISOString(), lvl: ev.lvl || (ev.code === UNEXPECTED ? 'ERROR' : 'WARN'), act: ev.act, code: ev.code,
      cmp: ev.cmp, res: ev.res || (ev.code === UNEXPECTED ? 'failed' : 'refused'), sid: ctx.sid, ver: ctx.ver };
    if (ev.error !== undefined && ev.error !== null) {
      o.err = errName(ev.error);
      let stack, head = '';
      try { stack = ev.error.stack; head = `${ev.error.name}: ${ev.error.message}`; } catch { stack = undefined; }
      const at = frame(stack, head);
      if (at) o.at = at;
    }
    return check(o);
  }

  /**
   * Rotation et purge (décision J2) : lignes de plus de 30 jours ou datées du futur retirées, 200 dernières gardées.
   * Appelle : aucune
   * Appelée par : ErrLog.parse(), ErrLog.push()
   */
  function purge(lines, now) {
    const kept = lines.filter(l => { const t = Date.parse(l.ts); return t >= now - MAX_AGE_MS && t <= now + 60000; });
    return kept.slice(-MAX_LINES);
  }

  /**
   * Ajoute une ligne et applique la rotation (la plus ancienne sort).
   * Appelle : ErrLog.purge()
   * Appelée par : Journal.record()
   */
  const push = (lines, line, now) => purge([...lines, line], now);

  /**
   * Relecture tolérante du journal stocké : texte absent, illisible ou trop gros = journal vide (remis à zéro) ;
   * ligne hostile ou mal formée = ignorée ; puis purge.
   * Appelle : ErrLog.check(), ErrLog.purge()
   * Appelée par : Journal.init()
   */
  function parse(text, now) {
    if (typeof text !== 'string' || !text || text.length > MAX_CHARS) return [];
    let raw;
    try { raw = JSON.parse(text); } catch { return []; }
    if (!Array.isArray(raw)) return [];
    return purge(raw.slice(-MAX_LINES * 2).map(check).filter(Boolean), now);
  }

  /**
   * Texte stocké : un tableau JSON.
   * Appelle : aucune
   * Appelée par : Journal.save()
   */
  const serialize = lines => JSON.stringify(lines);

  /**
   * Fichier exporté (décision J3) : JSON Lines, une première ligne d'en-tête (application, version, langue, date),
   * puis une ligne par entrée. JSON.stringify échappe les retours à la ligne : aucune ligne ne peut en fabriquer une autre.
   * Appelle : aucune
   * Appelée par : Journal.exportFile()
   */
  function toJsonl(lines, { ver, lang, now }) {
    const head = { app: 'GanttPro', ver: VER_RE.test(ver) ? ver : '0.0.0', lang: lang === 'en' ? 'en' : 'fr', exported: new Date(now).toISOString(), lines: lines.length };
    return [head, ...lines].map(l => JSON.stringify(l)).join('\n') + '\n';
  }

  return { make, check, frame, purge, push, parse, serialize, toJsonl, knownCode, UNEXPECTED, MAX_LINES, MAX_AGE_MS, MAX_CHARS, ACTS, CMPS };
})();
