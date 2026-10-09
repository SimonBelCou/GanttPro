/* Seul module autorisé à toucher au stockage du navigateur (contrôlé par tools/build.py).
 *
 * Vie privée (EX-10, EX-22) : sont conservés sur l'appareil, sans cookie,
 *  - les RÉGLAGES (langue, thème, sauvegarde automatique, message de première utilisation vu) ;
 *  - la BIBLIOTHÈQUE (projets et modèles), uniquement sur un geste explicite de l'utilisateur ;
 *  - la RÉCUPÉRATION, uniquement si l'utilisateur a activé la sauvegarde automatique (RG-31) ;
 *  - dans la mémoire de session de l'onglet, les trois clés du contrat de page d'accueil (8.4).
 * Rien n'est jamais envoyé. Toute lecture est une donnée NON FIABLE (une autre page locale peut
 * l'avoir modifiée) : les réglages sont validés ici par liste blanche, les projets sont relus par
 * Model.sanitize chez l'appelant. Chaque accès est protégé, le stockage pouvant être indisponible
 * (navigation privée, fichier local) ou plein : l'échec est rendu à l'appelant, qui le dit (EX-22). */
const Settings = (() => {
  const PREFIX = 'ganttpro.settings.';
  const ALLOWED = { theme: ['system', 'light', 'dark'], lang: ['fr', 'en'], autosave: ['on', 'off'], recprotect: ['on', 'off'], noticed: ['yes'] };

  function get(key) {
    try {
      const v = window.localStorage.getItem(PREFIX + key);
      return ALLOWED[key] && ALLOWED[key].includes(v) ? v : null;
    } catch { return null; }
  }
  function set(key, value) {
    if (!ALLOWED[key] || !ALLOWED[key].includes(value)) return false;
    try { window.localStorage.setItem(PREFIX + key, value); return true; } catch { return false; }
  }
  /** Efface tout ce que GanttPro a écrit sur l'appareil (EF-104) : réglages, bibliothèque, récupération. */
  function clearAll() {
    try {
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith('ganttpro.')) window.localStorage.removeItem(k);
      }
      return true;
    } catch { return false; }
  }
  return { get, set, clearAll };
})();

/** Entrepôt de textes sous des espaces de noms fixes (bibliothèque et récupération). */
const Store = (() => {
  const SPACES = { lib: 'ganttpro.lib.', rec: 'ganttpro.rec.' };
  const KEY_RE = /^[a-z0-9-]{1,40}$/;
  const full = (space, key) => {
    if (!SPACES[space] || !KEY_RE.test(key)) throw new Error('store.key');
    return SPACES[space] + key;
  };
  /** Écrit un texte. Renvoie 'ok', 'full' (espace insuffisant) ou 'off' (stockage indisponible). */
  function write(space, key, text) {
    try { window.localStorage.setItem(full(space, key), text); return 'ok'; } catch (e) {
      return e && (e.name === 'QuotaExceededError' || e.code === 22) ? 'full' : 'off';
    }
  }
  function read(space, key) {
    try { return window.localStorage.getItem(full(space, key)); } catch { return null; }
  }
  function remove(space, key) {
    try { window.localStorage.removeItem(full(space, key)); return true; } catch { return false; }
  }
  /** Clés présentes dans un espace. */
  function keys(space) {
    const out = [];
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(SPACES[space])) { const s = k.slice(SPACES[space].length); if (KEY_RE.test(s)) out.push(s); }
      }
    } catch { /* stockage indisponible : liste vide */ }
    return out;
  }
  /** Octets occupés par GanttPro (approximation : 2 octets par caractère). */
  function usage() {
    let n = 0;
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith('ganttpro.')) n += 2 * (k.length + (window.localStorage.getItem(k) || '').length);
      }
    } catch { return 0; }
    return n;
  }
  const available = () => { try { const k = 'ganttpro.probe'; window.localStorage.setItem(k, '1'); window.localStorage.removeItem(k); return true; } catch { return false; } };
  return { write, read, remove, keys, usage, available };
})();

/** Contrat avec une page d'accueil (EF-56, 8.4) : trois clés de la mémoire de session, rien d'autre. */
const HomeLink = (() => {
  const KEYS = { project: 'gantt_project', saved: 'gantt_saved_project', home: 'gantt_home_url' };
  const get = k => { try { return window.sessionStorage.getItem(KEYS[k]); } catch { return null; } };
  /** Projet transmis : lu une seule fois puis supprimé. */
  function takeProject() {
    const v = get('project');
    try { window.sessionStorage.removeItem(KEYS.project); } catch { /* indisponible */ }
    return v;
  }
  function saveProject(text) {
    try { window.sessionStorage.setItem(KEYS.saved, text); return 'ok'; } catch (e) {
      return e && (e.name === 'QuotaExceededError' || e.code === 22) ? 'full' : 'off';
    }
  }
  /** Adresse de retour validée : http(s) ou file, de même origine que l'application ; sinon null. */
  function homeUrl() {
    const raw = get('home');
    if (!raw || raw.length > 2000) return null;
    let u;
    try { u = new URL(raw, window.location.href); } catch { return null; }
    const here = new URL(window.location.href);
    if (!['http:', 'https:', 'file:'].includes(u.protocol) || u.protocol !== here.protocol) return null;
    if (u.protocol !== 'file:' && u.origin !== here.origin) return null;
    if (u.protocol === 'file:' && u.host !== here.host) return null;
    return u.href;
  }
  return { takeProject, saveProject, homeUrl };
})();
