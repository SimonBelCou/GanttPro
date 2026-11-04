# Taux 6 — Le coût dans la fiche d'une ressource

**Ce qui change** : la fiche d'une ressource affiche son coût, accepte un taux nominatif et arrondit au centime une seule fois.
**Fichier à ouvrir** : `tests/fixtures/taux-profils-base.json`, par « Importer ».
**Durée** : 12 minutes

- [ ] 1. Ouvrez **Ressources**, cliquez **Fiche** d'Alice. → Attendu : une rubrique « Coût des ressources » avec son profil, son taux du jour et « Coût prévu : 4 000,00 € ».
- [ ] 2. Regardez plus bas dans la fiche. → Attendu : « Charge totale : 10 jours-personne ».
- [ ] 3. Regardez la liste de ses tâches. → Attendu : deux colonnes Jours-personne et Coût prévu (T1 : `5 j-p`, `2 000,00 €` ; T3 : `5 j-p`, `2 000,00 €`).
- [ ] 4. Cliquez **Ajouter une ligne de taux** (taux nominatif) et saisissez `650`. → Attendu : le coût d'Alice passe à `6 500,00 €` (le taux nominatif remplace celui du profil).
- [ ] 5. Regardez la liste des ressources. → Attendu : « (nominatif) » est indiqué pour Alice.
- [ ] 6. Cliquez **Supprimer le taux nominatif**. → Attendu : retour à `4 000,00 €`.
- [ ] 7. Ajoutez une tâche « Essai » de durée `1`, affectez-lui Alice à `33` %, enregistrez. → Attendu : la tâche apparaît dans la liste des tâches d'Alice.
- [ ] 8. Dans la fiche d'Alice, donnez-lui un taux nominatif de `123,45`. → Attendu : la ligne « Essai » affiche `0,33 j-p`.
- [ ] 9. Regardez le coût de la ligne « Essai ». → Attendu : `40,74 €` (40,7385 arrondi au centime, une seule fois).
- [ ] 10. Supprimez le taux nominatif et la tâche « Essai ». → Attendu : la tâche n'apparaît plus dans la liste d'Alice.

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

Étape C du budget, PR #14. RG-55, R-92, R-94. « j-p » = jours-personne : jours ouvrés × taux d'occupation de la ressource (10 jours à 50 % = 5 jours-personne).
