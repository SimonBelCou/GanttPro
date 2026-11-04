# Rapport d'état : bloc « Valeur acquise » avec des points de situation seuls

**Ce qui change** : après un export sans montants puis une réimportation, le rapport d'état garde le bloc « Valeur acquise » avec les indices CPI et SPI des points de situation.
**Fichier à ouvrir** : `tests/fixtures/valeur-acquise-courbes.json` (projet fictif), puis `tests/fixtures/budget-sans-montant.json` à l'étape 6.
**Durée** : 5 minutes.

Départ : ouvrez le premier fichier avec **Importer**.

- [ ] 1. Cliquez sur **Exporter**, choisissez JSON, laissez **Inclure les montants** décoché, enregistrez le fichier. → Attendu : un fichier JSON est téléchargé.
- [ ] 2. Cliquez sur **Importer** et ouvrez le fichier que vous venez d'enregistrer. → Attendu : le projet s'ouvre ; la liste n'affiche plus aucun montant.
- [ ] 3. Ouvrez **Tableau de bord**, onglet **Budget**, section **Courbes PV / EV / AC**. → Attendu : l'onglet Budget est présent ; la section dit qu'aucune courbe ne se trace, car la baseline de référence n'a plus de budget.
- [ ] 4. Fermez la fenêtre, ouvrez **Rapport d'état**. → Attendu : le bloc **Valeur acquise** est présent ; CPI et SPI du jour sont « non calculable (aucun budget de tâche saisi) ».
- [ ] 5. Lisez la fin du bloc. → Attendu : « Points de situation : » puis une ligne par point, par exemple « 09/01/2026 — Revue etude : CPI 0,57, SPI 0,80 » ; le point du 07/01 affiche « SPI — ».
- [ ] 6. Fermez le rapport, ouvrez `budget-sans-montant.json`, puis **Rapport d'état**. → Attendu : aucun bloc Valeur acquise (ni montant ni point de situation).

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

EF-142, EF-151, A.8 ligne 16, R-88 (`Specs_fonctionnelles.md`), décision X2 du 3 novembre 2026 (annexe C).
