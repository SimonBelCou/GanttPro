# Fiche : publier une version sur GitHub

- **Ce qui change** : une version se publie par un bouton sur GitHub ; la release contient le fichier GanttPro et de quoi vérifier qu'il n'a pas été altéré. À faire au moment de publier, pas pendant la recette de la branche.
- **Fichier à ouvrir** : aucun (dépôt GitHub `SimonBelCou/GanttPro`)
- **Durée** : 15 minutes

- [ ] 1. Dans une pull request, écrivez le numéro dans `VERSION` et transformez « ## Non publié » de `CHANGELOG.md` en « ## [3.0.0] - AAAA-MM-JJ » (en gardant une section « ## Non publié » vide au-dessus). → Attendu : la CI de la pull request est verte.
- [ ] 2. Fusionnez la pull request dans `main`. → Attendu : la CI de `main` est verte.
- [ ] 3. Sur GitHub, onglet **Actions**, ouvrez « Étiquette de version », cliquez sur **Run workflow**, choisissez `main` et saisissez `3.0.0`. → Attendu : le workflow réussit et l'étiquette `v3.0.0` apparaît dans la liste des étiquettes.
- [ ] 4. Ouvrez la page **Releases**. → Attendu : la release « GanttPro 3.0.0 » contient `GanttPro.html` et `GanttPro.html.sha256`, et ses notes reprennent la section 3.0.0 du CHANGELOG.
- [ ] 5. Téléchargez les deux fichiers dans un même dossier et lancez `sha256sum -c GanttPro.html.sha256`. → Attendu : « GanttPro.html: OK ».
- [ ] 6. Relancez « Étiquette de version » avec `3.0.0`. → Attendu : le workflow échoue en disant que l'étiquette existe déjà.

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

EX-42 (Specs_fonctionnelles.md) ; procédure : CLAUDE.md §13.6 bis.
