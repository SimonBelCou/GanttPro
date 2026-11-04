# Taux 12 — Fichiers refusés

**Ce qui change** : un fichier dont les profils ou taux sont invalides est refusé en entier, sans toucher au projet ouvert.
**Fichier à ouvrir** : `tests/fixtures/taux-profils-base.json` (projet ouvert), puis `refus-taux-negatif.json` et `refus-taux-profil-inconnu.json` (même dossier), par « Importer ».
**Durée** : 5 minutes

- [ ] 1. Importez `refus-taux-negatif.json`. → Attendu : refusé en entier ; le message nomme le profil n° 1 et le champ « rate ».
- [ ] 2. Regardez le projet ouvert. → Attendu : il n'est pas modifié.
- [ ] 3. Importez `refus-taux-profil-inconnu.json`. → Attendu : refusé ; le message nomme la ressource n° 1 et le profil « Directeur » qui n'existe pas.
- [ ] 4. Regardez le projet ouvert. → Attendu : il n'est pas modifié.

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

Étape C du budget, PR #14. R-98.
