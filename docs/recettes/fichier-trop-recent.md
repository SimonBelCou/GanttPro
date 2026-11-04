# Fiche : un fichier d'une version plus récente est refusé

- **Ce qui change** : un projet enregistré dans un format plus récent est refusé avec un message qui dit quelle version de GanttPro il faut ; les anciens fichiers s'ouvrent toujours.
- **Fichier à ouvrir** : `tests/fixtures/refus-format-trop-recent.json`, puis `tests/fixtures/projet-exemple.json`
- **Durée** : 5 minutes

- [ ] 1. Ouvrez `GanttPro.html`, cliquez sur **Importer** et choisissez `refus-format-trop-recent.json`. → Attendu : le fichier est refusé avec le message « Ce fichier est au format 5 : GanttPro 4.0.0 ou ultérieur est requis pour l'ouvrir. ».
- [ ] 2. Fermez le message. → Attendu : le projet affiché n'a pas changé.
- [ ] 3. Passez l'interface en anglais (bouton de langue), puis importez de nouveau `refus-format-trop-recent.json`. → Attendu : « This file uses format 5: GanttPro 4.0.0 or later is required to open it. ».
- [ ] 4. Revenez en français, puis importez `projet-exemple.json` (un fichier de format 3). → Attendu : l'aperçu de l'import s'affiche normalement et le projet s'ouvre.

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

RG-59, R-101 (Specs_fonctionnelles.md).
