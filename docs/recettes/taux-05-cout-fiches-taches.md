# Taux 5 — Le coût dans la fiche d'une tâche

**Ce qui change** : la fiche d'une tâche affiche son coût calculé à partir des taux de ses ressources.
**Fichier à ouvrir** : `tests/fixtures/taux-profils-base.json`, par « Importer ».
**Durée** : 5 minutes

- [ ] 1. Ouvrez la fiche de la tâche **T1** (Conception, 10 j, Alice à 50 %). → Attendu : sous les affectations, « Coût des ressources selon le planning enregistré : 5 j-p · 2 000,00 € » (5 jours-personne × 400,00 €).
- [ ] 2. Ouvrez la fiche de **T2** (20 j, Bob à 100 %). → Attendu : `20 j-p · 9 000,00 €`.
- [ ] 3. Ouvrez la fiche de **T3** (5 j, Alice à 100 %). → Attendu : `5 j-p · 2 000,00 €`.

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

Étape C du budget, PR #14. RG-55, R-92, R-94. « j-p » = jours-personne : jours ouvrés × taux d'occupation de la ressource (10 jours à 50 % = 5 jours-personne).
