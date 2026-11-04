# Taux 9 — Une ressource sans taux est signalée

**Ce qui change** : une ressource sans taux n'est jamais valorisée en silence : elle est signalée « sans taux » et le total est annoncé partiel.
**Fichier à ouvrir** : `tests/fixtures/taux-sans-taux.json`, par « Importer ».
**Durée** : 7 minutes

- [ ] 1. Ouvrez **Ressources**. → Attendu : Alice `400,00 €` ; Bob (profil sans ligne de taux) et Camille (aucun profil) affichent « sans taux ».
- [ ] 2. Ouvrez **Tableau de bord**, onglet **Budget**. → Attendu : coût des ressources `2 000,00 €` (Alice seule).
- [ ] 3. Lisez le message sous le tableau. → Attendu : **« Total partiel : 2 affectations n'ont pas de taux pour tous leurs jours »**.
- [ ] 4. Regardez les lignes de Bob et Camille. → Attendu : `0,00 €` et « sans taux ».
- [ ] 5. Ouvrez la fiche de la tâche B (Bob, 4 j). → Attendu : « Coût des ressources selon le planning enregistré : 4 j-p · aucun taux ».
- [ ] 6. Cliquez **Profils de coût…**, profil « Sans taux encore » : ajoutez une ligne et saisissez `500`. → Attendu : Bob passe à `2 000,00 €`.
- [ ] 7. Revenez à l'onglet Budget. → Attendu : le total passe à `4 000,00 €` et le message devient « 1 affectation ».

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

Étape C du budget, PR #14. RG-57, R-95.
