/* Colonnes de la liste des tâches (EF-143 à EF-146, RG-52, RG-53) : moteur sans DOM.
 * Le projet peut enregistrer la liste ORDONNÉE des colonnes affichées ; sans elle, l'ordre d'origine s'applique et
 * Budget / Coût réel n'apparaissent que si le projet contient un montant (A.8 ligne 17). L'identifiant et le nom sont
 * obligatoires : ils ne se masquent pas, mais se déplacent. */
const Columns = (() => {
  const ALL = Object.freeze(['id', 'name', 'dur', 'start', 'end', 'rstart', 'rend', 'deps', 'res', 'status', 'budget', 'actual']);
  const MANDATORY = Object.freeze(['id', 'name']);
  const AMOUNTS = Object.freeze(['budget', 'actual']);

  /** Colonnes affichées, dans l'ordre : le choix du projet, sinon l'ordre d'origine (montants seulement s'il y en a). */
  function effective(project) {
    if (Array.isArray(project.columns)) return project.columns.slice();
    return ALL.filter(k => !AMOUNTS.includes(k) || Budget.hasAmounts(project));
  }

  /** Liste complète pour la fenêtre : colonnes affichées dans l'ordre, puis colonnes masquées dans l'ordre d'origine. */
  function layout(project) {
    const shown = effective(project);
    return [...shown.map(key => ({ key, shown: true })), ...ALL.filter(k => !shown.includes(k)).map(key => ({ key, shown: false }))];
  }

  /** Contrôle d'une liste lue dans un fichier : clés connues, sans doublon, identifiant et nom présents. */
  function valid(list) {
    return Array.isArray(list) && list.length <= ALL.length && list.every(k => ALL.includes(k))
      && new Set(list).size === list.length && MANDATORY.every(k => list.includes(k));
  }

  /** Nouvelle liste après avoir affiché ou masqué une colonne ; null si la colonne est obligatoire ou inconnue.
   *  Une colonne affichée prend la place qu'elle a dans l'ordre d'origine, après la dernière colonne qui la précède. */
  function toggle(list, key, show) {
    if (!ALL.includes(key) || (!show && MANDATORY.includes(key))) return null;
    const has = list.includes(key);
    if (show === has) return list.slice();
    if (!show) return list.filter(k => k !== key);
    const before = ALL.slice(0, ALL.indexOf(key));
    let at = 0;
    list.forEach((k, i) => { if (before.includes(k)) at = i + 1; });
    return [...list.slice(0, at), key, ...list.slice(at)];
  }

  /** Nouvelle liste après avoir déplacé une colonne affichée d'un cran (-1 vers la gauche, 1 vers la droite) ; null si impossible. */
  function move(list, key, delta) {
    const i = list.indexOf(key), j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return null;
    const out = list.slice();
    [out[i], out[j]] = [out[j], out[i]];
    return out;
  }

  return { ALL, MANDATORY, AMOUNTS, effective, layout, valid, toggle, move };
})();
