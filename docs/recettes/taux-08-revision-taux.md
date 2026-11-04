# Taux 8 — Révision de taux et prestataire externe

**Ce qui change** : un taux qui change à une date donnée est appliqué jour par jour, et un taux nominatif (prestataire) remplace celui du profil.
**Fichier à ouvrir** : `tests/fixtures/taux-historique.json`, par « Importer » (A : Alice, 5 j, du lundi 05/01 au vendredi 09/01/2026 ; B : Dave, 2 j).
**Durée** : 6 minutes

- [ ] 1. Ouvrez **Tableau de bord**, onglet **Budget**, section **Coût des ressources**. → Attendu : Alice `2 040,00 €` (3 jours à 400,00 € puis 2 jours à 420,00 €, le taux changeant le 08/01).
- [ ] 2. Regardez la ligne de Dave. → Attendu : `1 400,00 €` (2 j × 700,00 €, taux nominatif, noté « (nominatif) »).
- [ ] 3. Regardez le total. → Attendu : `3 440,00 €`.
- [ ] 4. Cliquez **Profils de coût…**, profil Analyste : mettez la date de la deuxième ligne au `09/01/2026`. → Attendu : Alice `2 020,00 €` (4 jours à 400,00 €, 1 jour à 420,00 €).
- [ ] 5. Regardez le total. → Attendu : `3 420,00 €`.
- [ ] 6. Mettez la date de cette ligne au `06/01/2026`. → Attendu : Alice `2 080,00 €` (1 jour à 400,00 €, 4 jours à 420,00 €).
- [ ] 7. Supprimez la ligne « Depuis le début » du profil. → Attendu : les jours avant la première date n'ont plus de taux ; Alice est « partielle » (voir la fiche Taux 9).

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

Étape C du budget, PR #14. EF-148, RG-54, R-93, R-96.
