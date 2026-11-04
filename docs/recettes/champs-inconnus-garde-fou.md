# Fiche : des données inconnues ne sont jamais perdues sans prévenir

- **Ce qui change** : quand un projet contient des données que cette version ne connaît pas, GanttPro le dit à l'ouverture, puis demande confirmation avant le premier enregistrement et propose un autre nom de fichier pour garder l'original.
- **Fichier à ouvrir** : `tests/fixtures/champs-inconnus-version-recente.json` (projet fictif avec deux données inconnues)
- **Durée** : 15 minutes

- [ ] 1. Ouvrez `GanttPro.html`, cliquez sur **Importer** et choisissez `champs-inconnus-version-recente.json`. → Attendu : l'aperçu affiche, mis en évidence, « 2 champs inconnus ont été ignorés : ils viennent probablement d'une version plus récente de GanttPro et seront perdus si vous réenregistrez ce projet. ».
- [ ] 2. Cliquez sur **Remplacer le projet ouvert**, puis sur **Exporter**, gardez « Projet GanttPro » et cliquez sur **Exporter**. → Attendu : une fenêtre « Données ignorées à l'ouverture » rappelle que ces données seront perdues et annonce le nom « projet_venu_d_une_version_plus_recente_gantt_v3_0_0.json » ; le bouton **Annuler** est sélectionné.
- [ ] 3. Cliquez sur **Annuler**. → Attendu : rien n'est téléchargé et la fenêtre d'export est toujours ouverte.
- [ ] 4. Cliquez sur **Exporter**, puis sur **Enregistrer quand même**. → Attendu : le fichier téléchargé s'appelle « projet_venu_d_une_version_plus_recente_gantt_v3_0_0.json » ; ouvert dans un éditeur de texte, il ne contient ni `registreRisques` ni `priorite`.
- [ ] 5. Exportez une seconde fois au même format. → Attendu : aucune fenêtre de confirmation ; le fichier s'appelle « projet_venu_d_une_version_plus_recente_gantt.json ».
- [ ] 6. Importez de nouveau `champs-inconnus-version-recente.json`, remplacez le projet, puis ouvrez **Bibliothèque** et enregistrez le projet. → Attendu : la même confirmation apparaît et dit qu'une nouvelle entrée sera créée ; après **Enregistrer quand même**, la bibliothèque a une entrée de plus.
- [ ] 7. Dans **Réglages**, activez la sauvegarde automatique. Importez de nouveau le fichier, remplacez le projet, modifiez le nom d'une tâche, attendez 5 secondes, rechargez la page et choisissez de restaurer la copie. → Attendu : le projet restauré s'ouvre avec la modification.
- [ ] 8. Exportez ce projet restauré en « Projet GanttPro ». → Attendu : la fenêtre « Données ignorées à l'ouverture » apparaît encore.
- [ ] 9. Avec le clavier seulement, appuyez sur Échap dans cette fenêtre. → Attendu : elle se ferme et la fenêtre d'export reprend la main ; rien n'est téléchargé.
- [ ] 10. Passez au thème sombre et refaites l'étape 8. → Attendu : la fenêtre et son texte restent lisibles. Désactivez ensuite la sauvegarde automatique dans **Réglages**.

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

EF-152, RG-59, R-103 (Specs_fonctionnelles.md).
