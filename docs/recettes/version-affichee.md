# Fiche : le numéro de version est visible partout

- **Ce qui change** : le numéro de version de GanttPro (3.0.0) apparaît dans l'onglet du navigateur, l'aide, le rapport et les fichiers enregistrés.
- **Fichier à ouvrir** : `tests/fixtures/projet-exemple.json`
- **Durée** : 5 minutes

- [ ] 1. Ouvrez `GanttPro.html` et regardez le titre de l'onglet du navigateur. → Attendu : « GanttPro 3.0.0 ».
- [ ] 2. Cliquez sur « ? » (aide). → Attendu : la fenêtre indique « version 3.0.0 ».
- [ ] 3. Fermez l'aide, importez `projet-exemple.json` et cliquez sur **Rapport**. → Attendu : sous le dernier bloc, la ligne « Rapport établi avec GanttPro 3.0.0. ».
- [ ] 4. Cliquez sur **Copier le texte**, puis collez dans un éditeur de texte. → Attendu : la dernière ligne est « Rapport établi avec GanttPro 3.0.0. ».
- [ ] 5. Fermez le rapport, cliquez sur **Exporter**, gardez « Projet GanttPro », cliquez sur **Exporter** et ouvrez le fichier dans un éditeur de texte. → Attendu : en tête du fichier, `"format": 4` puis `"app": "3.0.0"`.

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

EF-151, R-102 (Specs_fonctionnelles.md).
