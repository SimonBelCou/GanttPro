# Journal d'erreurs : au clavier, au lecteur d'écran, en thème sombre et en anglais

**Ce qui change :** le bandeau d'erreur et la fenêtre « Journal d'erreurs » s'utilisent sans souris, se lisent au lecteur d'écran et suivent le thème et la langue.
**Fichier à ouvrir :** `tests/fixtures/journal-import-refuse.json`, à importer une fois pour que le journal contienne au moins une ligne.
**Durée :** 10 minutes.

Pour provoquer une erreur inattendue, tapez dans la console du navigateur (F12, onglet « Console ») : `setTimeout(() => { throw new Error('essai') })` puis Entrée.

- [ ] 1. Provoquez une erreur, lecteur d'écran allumé. → Attendu : le bandeau est lu dès qu'il apparaît : « Erreur inattendue (réf. …). Exportez votre projet. »
- [ ] 2. Allez sur la croix du bandeau avec Tab. → Attendu : elle est lue « Fermer le message ». Appuyez sur Entrée : le bandeau disparaît et le focus revient où il était.
- [ ] 3. Au clavier seul, ouvrez Réglages ⚙ et allez jusqu'à « Voir le journal » avec Tab, puis appuyez sur Entrée. → Attendu : la fenêtre « Journal d'erreurs » s'ouvre, avec son titre lu.
- [ ] 4. Appuyez sur Tab jusqu'au tableau, puis utilisez les flèches. → Attendu : le tableau défile et le focus reste visible.
- [ ] 5. Appuyez sur Échap. → Attendu : la fenêtre se ferme et le focus revient sur « Voir le journal ».
- [ ] 6. Ouvrez « Voir le journal », puis provoquez une erreur dans la console sans fermer la fenêtre. → Attendu : le bandeau apparaît et sa croix s'atteint avec Tab sans fermer la fenêtre.
- [ ] 7. Passez en thème sombre et rouvrez le journal. → Attendu : le bandeau et le tableau restent lisibles.
- [ ] 8. Passez en anglais (bouton « English »). → Attendu : la partie s'appelle « Error log » et le bandeau dit « Unexpected error (ref. …). Export your project. ».

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

EF-151, RG-63, EF-103 ; exigences d'accessibilité EX-01 à EX-03 (`Specs_fonctionnelles.md`).
