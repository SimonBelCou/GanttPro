/* Valeur acquise (étape B, EF-131 et suivantes, RG-44 et suivantes) : moteur sans DOM, en centimes entiers.
 * Les indicateurs se calculent à une date (la date du jour), sur une référence : la baseline de référence du
 * projet, ou le planning actuel quand le projet n'a aucune baseline (A.8 lignes 14 et 15). */
const Evm = (() => {
  /**
   * Baseline de référence (RG-44) : celle que désigne le projet ; à défaut la baseline « initiale », à défaut la
   * première. Sans aucune baseline : null, et le calcul porte sur le planning actuel.
   */
  function reference(project) {
    const list = project.baselines || [];
    if (!list.length) return null;
    return list.find(b => b.id === project.baselineRef) || list.find(b => b.initial) || list[0];
  }

  return { reference };
})();
