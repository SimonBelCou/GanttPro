# Taux 3 — Saisir un taux par jour

**Ce qui change** : vous pouvez ajouter une ligne de taux à un profil ; les valeurs incorrectes sont refusées avec une explication.
**Fichier à ouvrir** : `tests/fixtures/taux-profils-base.json`, par « Importer ».
**Durée** : 5 minutes

- [ ] 1. Cliquez **Profils de coût…**, **Ajouter un profil**, nommez-le « Chef de projet » (Tab pour valider). → Attendu : une carte « Chef de projet » apparaît.
- [ ] 2. Dans cette carte, cliquez **Ajouter une ligne de taux**. → Attendu : une ligne « Depuis le début » à 0 ; le focus est sur son taux.
- [ ] 3. Saisissez `600` puis Tab. → Attendu : la valeur reste `600`.
- [ ] 4. Saisissez `12abc` puis Tab. → Attendu : refusé avec une explication (écrire un montant comme « 1 234,56 ») ; le champ est signalé en erreur.
- [ ] 5. Saisissez `2000000` puis Tab. → Attendu : refusé (au plus 1 000 000,00).
- [ ] 6. Remettez `600` puis Tab. → Attendu : la valeur `600` est acceptée.

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

Étape C du budget, PR #14. EF-147, EF-148, RG-54, R-98.
