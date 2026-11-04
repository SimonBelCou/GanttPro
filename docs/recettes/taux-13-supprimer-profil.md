# Taux 13 — Supprimer un profil, annuler

**Ce qui change** : supprimer un profil demande confirmation et peut être annulé, profil des ressources compris.
**Fichier à ouvrir** : `tests/fixtures/taux-profils-base.json`, par « Importer », puis **Profils de coût…**.
**Durée** : 5 minutes

- [ ] 1. Cliquez **Supprimer le profil Analyste**. → Attendu : une confirmation nomme le profil et dit que « 1 ressource perdra son profil et ne sera plus valorisée ».
- [ ] 2. Regardez le bouton qui a le focus. → Attendu : « Annuler » a le focus par défaut.
- [ ] 3. Cliquez « Annuler ». → Attendu : le profil est toujours là.
- [ ] 4. Recommencez la suppression et confirmez. → Attendu : le profil disparaît et Alice n'a plus de profil (« sans taux »).
- [ ] 5. Regardez le focus. → Attendu : il passe sur **Ajouter un profil**.
- [ ] 6. Cliquez **Annuler** (barre du haut). → Attendu : le profil et le profil d'Alice reviennent ensemble.

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

Étape C du budget, PR #14. EF-147.
