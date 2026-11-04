# Taux 4 — Dates des lignes de taux

**Ce qui change** : un taux peut changer à une date donnée ; les lignes se classent par date, sans deux lignes le même jour.
**Fichier à ouvrir** : `tests/fixtures/taux-profils-base.json`, par « Importer ».
**Durée** : 7 minutes

- [ ] 1. Cliquez **Profils de coût…**, **Ajouter un profil**, nommez-le « Chef de projet », ajoutez-lui une ligne de taux et saisissez `600`. → Attendu : une ligne « Depuis le début » à `600`.
- [ ] 2. Cliquez deux fois **Ajouter une ligne de taux**. → Attendu : deux lignes « À partir du » apparaissent, aux dates libres d'aujourd'hui et du lendemain, au dernier taux connu (`600`).
- [ ] 3. Mettez la date de la dernière ligne à la même date que l'autre. → Attendu : refusé (« Deux lignes de taux ne peuvent pas commencer le même jour ») ; rien n'est modifié.
- [ ] 4. Mettez une date plus ancienne. → Attendu : les lignes se retrient par date et le focus suit la ligne déplacée.
- [ ] 5. Supprimez une ligne par son bouton ✕ (« Supprimer la ligne de taux … »). → Attendu : la ligne disparaît.
- [ ] 6. Cliquez **Annuler** (barre du haut). → Attendu : la ligne supprimée est rétablie.
- [ ] 7. Fermez la fenêtre (Échap). Dans **Ressources**, choisissez « Chef de projet » comme profil de Bob. → Attendu : son taux du jour affiche le taux de la ligne en vigueur aujourd'hui ; le focus reste sur la liste.

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

Étape C du budget, PR #14. EF-147, EF-148, RG-54, R-98.
