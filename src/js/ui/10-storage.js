/* Seul module autorisé à toucher au stockage du navigateur (contrôlé par tools/build.py).
 *
 * Vie privée (EX-10, EX-22) : ne sont conservés sur l'appareil que les RÉGLAGES (langue, thème),
 * jamais un projet ni un nom de ressource. Pas de cookie. Chaque lecture est validée (le stockage
 * est une donnée non fiable : une autre page locale peut l'avoir modifié) et chaque accès est
 * protégé, car le stockage peut être indisponible (navigation privée, fichier local). */
const Settings = (() => {
  const PREFIX = 'ganttpro.settings.';
  const ALLOWED = { theme: ['system', 'light', 'dark'], lang: ['fr', 'en'] };

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
  /** Efface tout ce que GanttPro a écrit sur l'appareil (EF-104). */
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
