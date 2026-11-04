# Taux 14 — Clavier et lecteur d'écran

**Ce qui change** : les profils et les taux s'utilisent au clavier, avec des champs nommés pour un lecteur d'écran, y compris en thème sombre.
**Fichier à ouvrir** : `tests/fixtures/taux-profils-base.json`, par « Importer ».
**Durée** : 10 minutes

- [ ] 1. Au clavier seul, ouvrez **Ressources**, puis **Profils de coût…**. → Attendu : tout s'atteint par Tab et les boutons s'activent par Entrée ou Espace.
- [ ] 2. Ajoutez un profil et une ligne de taux, saisissez un taux, supprimez la ligne, toujours au clavier. → Attendu : chaque action fonctionne sans souris.
- [ ] 3. Appuyez sur Échap dans chaque fenêtre. → Attendu : elle se ferme et le focus revient au bouton qui l'a ouverte.
- [ ] 4. Parcourez les champs (lecteur d'écran ou nom accessible). → Attendu : chaque champ a un nom qui contient son texte visible (par exemple « Taux par jour (Analyste, Depuis le début) (€) »).
- [ ] 5. Saisissez une valeur invalide dans un taux. → Attendu : l'erreur est annoncée et le champ est signalé invalide.
- [ ] 6. Cliquez **Masquer les montants** et parcourez les valeurs. → Attendu : elles sont annoncées « montant masqué ».
- [ ] 7. Passez en thème sombre. → Attendu : la fenêtre des profils, la rubrique de coût et la section du tableau de bord restent lisibles.

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

Étape C du budget, PR #14. EF-147, EF-148.
