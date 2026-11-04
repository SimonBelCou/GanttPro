# Fiche — Profils de coût et Ressources lisibles au lecteur d'écran

**Ce qui change :** chaque profil de coût a un titre à son nom, chaque taux a une étiquette visible, et une erreur dans la fenêtre Ressources est lue par le lecteur d'écran.
**Fichier à ouvrir :** `tests/fixtures/taux-sans-taux.json` (bouton **Importer**, puis **Remplacer le projet ouvert**).
**Durée :** 10 minutes (lecteur d'écran conseillé : NVDA sous Windows, VoiceOver sous macOS).

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

- [ ] 1. Cliquez **Ressources**, puis **Profils de coût…**. → Attendu : deux blocs, chacun avec un titre à son nom, « Analyste » puis « Sans taux encore », au-dessus de son champ **Nom**.
- [ ] 2. Avec le lecteur d'écran, passez de titre en titre (touche H avec NVDA). → Attendu : il annonce « Analyste » puis « Sans taux encore » comme titres de niveau 3.
- [ ] 3. Dans le bloc « Sans taux encore », cliquez **Ajouter une ligne de taux**. → Attendu : une ligne « Depuis le début » apparaît, avec devant le champ de taux l'étiquette visible « Taux par jour (€) ».
- [ ] 4. Cliquez sur le texte « Taux par jour (€) ». → Attendu : le curseur se place dans le champ de taux.
- [ ] 5. Avec le lecteur d'écran, placez-vous sur ce champ. → Attendu : il lit « Taux par jour (€) (Sans taux encore, Depuis le début) ».
- [ ] 6. Cliquez le bouton **✕** de cette ligne. → Attendu : la ligne disparaît, le bloc n'a plus aucune ligne de taux.
- [ ] 7. Cliquez **Fermer**. → Attendu : la fenêtre Ressources est de nouveau au premier plan.
- [ ] 8. Effacez entièrement le nom de Bob, puis appuyez sur **Tab**. → Attendu : sous le nom, le message « Nom : 1 à 100 caractères. » s'affiche et le lecteur d'écran le lit sans que vous ayez à y revenir.
- [ ] 9. Tapez de nouveau « Bob » dans ce champ, puis appuyez sur **Tab**. → Attendu : le message disparaît et la ressource s'appelle toujours Bob.

## Références

RGAA 9.1 (titres), 11.2 (étiquettes), 11.10 (erreurs annoncées) ; WCAG 2.5.3 (le nom lu contient le texte visible).
EF-147, EF-148 ; `Specs_fonctionnelles.md`. Tests automatiques : `tests/test_v3.py`, `tests/test_v3_budget.py`.
