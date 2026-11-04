# Taux 1 — Sans profil ni taux, rien ne change

**Ce qui change** : tant qu'aucun profil de coût n'existe, l'application se comporte comme avant.
**Fichier à ouvrir** : `tests/fixtures/budget-base.json` (projet avec budgets, sans profil de coût), par « Importer ».
**Durée** : 5 minutes

- [ ] 1. Ouvrez **Ressources**. → Attendu : les colonnes sont celles d'avant (Nom, Rôle, Capacité, Couleur, nombre de tâches), sans colonne « Profil de coût » ni colonne « Taux par jour ».
- [ ] 2. Regardez sous le tableau des ressources. → Attendu : un bouton **Profils de coût…** est présent.
- [ ] 3. Cliquez **Fiche** d'une ressource. → Attendu : la fiche n'a pas de rubrique « Coût des ressources ».
- [ ] 4. Ouvrez **Tableau de bord**, onglet **Budget**. → Attendu : aucune section « Coût des ressources ».
- [ ] 5. Ouvrez la fiche d'une tâche qui a une ressource. → Attendu : aucune ligne de coût sous les affectations.

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

Étape C du budget, PR #14. EF-147.
