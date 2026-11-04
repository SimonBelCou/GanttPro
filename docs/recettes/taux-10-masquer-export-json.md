# Taux 10 — Masquer les montants et exporter en JSON

**Ce qui change** : les montants peuvent être masqués, et l'export JSON n'emporte les taux que si vous le demandez.
**Fichier à ouvrir** : `tests/fixtures/taux-historique.json`, par « Importer ».
**Durée** : 12 minutes

- [ ] 1. Cliquez **Masquer les montants**, puis ouvrez **Ressources**. → Attendu : les taux du jour sont `••••`.
- [ ] 2. Ouvrez **Profils de coût…**. → Attendu : les lignes de taux sont grisées et un message explique qu'il faut désactiver le masquage.
- [ ] 3. Ouvrez l'onglet Budget du **Tableau de bord**. → Attendu : `••••` pour tous les montants, mais les jours-personne restent visibles. Réactivez ensuite les montants.
- [ ] 4. **Exporter** (JSON), **sans** « Inclure les montants », et ouvrez le fichier dans un éditeur de texte. → Attendu : aucune valeur de taux ; les profils gardent leur nom avec `"rates": []`.
- [ ] 5. Exportez **avec** « Inclure les montants » et ouvrez le fichier. → Attendu : `profiles` avec leurs lignes (`"rate": 40000`, en centimes) et le taux nominatif de Dave dans sa ressource.
- [ ] 6. Réimportez ce fichier et regardez l'onglet Budget. → Attendu : le coût `3 440,00 €` est identique.
- [ ] 7. Exportez avec les montants **et** « Exporter sans noms de personnes », et ouvrez le fichier. → Attendu : aucun nom et **aucun taux nominatif** (le `70000` de Dave n'apparaît pas).
- [ ] 8. Cherchez le taux du profil dans ce même fichier. → Attendu : le taux du profil y reste.

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

Étape C du budget, PR #14. EF-150, RG-58, R-98 à R-100.
