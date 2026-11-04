# Fiche — « sans taux » au lieu de 0,00 € dans la fiche d'une ressource

**Ce qui change :** dans la fiche d'une ressource, une tâche dont aucun jour n'a de taux affiche « sans taux » au lieu de « 0,00 € (sans taux) » ; un coût partiel garde son montant. Les montants exportés ne changent pas.
**Fichier à ouvrir :** `tests/fixtures/taux-cout-partiel.json` (bouton **Importer**, puis **Remplacer le projet ouvert**).
**Durée :** 8 minutes.

Le projet : Alice (taux de 400,00 € par jour) sur la tâche A ; Bob, dont le profil n'a aucun taux, sur la tâche B (4 jours) ; Camille, dont le profil n'a un taux de 500,00 € qu'à partir du mercredi 7 janvier, sur la tâche C (4 jours, du lundi 5 au jeudi 8 janvier).

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

- [ ] 1. Cliquez **Ressources**, puis **Fiche Bob**. → Attendu : dans le tableau des tâches, colonne « Coût prévu », la tâche B affiche seulement « sans taux », sans aucun montant.
- [ ] 2. Lisez la rubrique « Coût des ressources » de la fiche. → Attendu : « Coût prévu : 0,00 € — Total partiel : 1 affectation n'a pas de taux pour tous ses jours. »
- [ ] 3. Fermez la fiche (Échap), puis cliquez **Fiche Camille**. → Attendu : colonne « Coût prévu », la tâche C affiche « 1 000,00 € (sans taux) » (2 jours à 500,00 €, les 2 premiers jours n'ont pas de taux).
- [ ] 4. Fermez la fiche, puis cliquez **Fiche Alice**. → Attendu : la tâche A affiche « 2 000,00 € », sans mention « sans taux ».
- [ ] 5. Fermez les fenêtres, ouvrez le **Tableau de bord**, onglet **Budget**, section « Coût des ressources ». → Attendu : coût des ressources « 3 000,00 € » et le message « Total partiel : 2 affectations n'ont pas de taux pour tous leurs jours. »
- [ ] 6. Fermez le tableau de bord. **Exporter**, format **Classeur Excel (.xlsx)**, cochez **Inclure les montants**, puis **Exporter**, et ouvrez le fichier. → Attendu : feuille « Tâches », dernière colonne « Coût des ressources » : 2000 pour A, 0 pour B, 1000 pour C (présentation des nombres selon le tableur).

## Références

RG-57 (jamais un 0 sans indication), EF-149, EF-150, R-95, R-100 ; CLAUDE.md §11. Tests automatiques : `tests/test_v3_budget.py`, `tests/core/taux.test.mjs`.
