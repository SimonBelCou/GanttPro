# Taux 2 — Créer des profils de coût

**Ce qui change** : vous pouvez créer et nommer des profils de coût (un profil regroupe des lignes de taux par jour, partagées par les ressources qui l'utilisent).
**Fichier à ouvrir** : `tests/fixtures/taux-profils-base.json`, par « Importer », puis ouvrez **Ressources**.
**Durée** : 5 minutes

- [ ] 1. Regardez le tableau des ressources. → Attendu : deux colonnes de plus, **Profil de coût** (Alice : Analyste, Bob : Développeur).
- [ ] 2. Regardez la colonne **Taux par jour**. → Attendu : `400,00 €` et `450,00 €`, chacun suivi de « (profil) ».
- [ ] 3. Cliquez **Profils de coût…**. → Attendu : une fenêtre avec deux cartes, Analyste et Développeur, chacune avec son nom, sa ligne « Depuis le début » et son taux.
- [ ] 4. Lisez le bas de chaque carte. → Attendu : « 1 ressource utilise ce profil. » et un bouton « Supprimer le profil … ».
- [ ] 5. Cliquez **Ajouter un profil**. → Attendu : une carte « Profil 3 » apparaît et le focus est sur son nom.
- [ ] 6. Renommez-le « Chef de projet », puis Tab pour valider. → Attendu : le nom est conservé.
- [ ] 7. Renommez-le « analyste », puis Tab. → Attendu : refusé, avec un message sous le champ (nom déjà pris, majuscules ignorées).

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

Étape C du budget, PR #14. EF-147, EF-148, RG-54, R-98. Les montants sont des exemples fictifs.
