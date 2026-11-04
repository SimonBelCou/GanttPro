# Fiche — Montants masqués : un texte « •••• » au lieu d'un champ grisé

**Ce qui change :** quand les montants sont masqués, un champ de montant (budget, coût réel, provision, reste à faire, taux) devient un simple texte `••••`, lu « montant masqué », au lieu d'un champ grisé qui contenait `••••`.
**Fichier à ouvrir :** `tests/fixtures/taux-historique.json` (bouton **Importer**, puis **Remplacer le projet ouvert**).
**Durée :** 10 minutes (lecteur d'écran conseillé : NVDA sous Windows, VoiceOver sous macOS).

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

- [ ] 1. Cliquez **Masquer les montants** (barre du haut). → Attendu : le bouton paraît enfoncé et la colonne « Budget / Réel » affiche `••••`.
- [ ] 2. Cliquez sur le nom de la tâche A « Analyse ». → Attendu : sous les étiquettes « Budget (€) » et « Coût réel cumulé (€) », le texte `••••` (plus de cadre de champ), et la phrase « Les montants sont masqués : désactivez « Masquer les montants » pour les modifier. »
- [ ] 3. Avec le lecteur d'écran, lisez la rubrique Budget de la fiche. → Attendu : il lit « Budget (€) », puis « montant masqué », puis « Coût réel cumulé (€) », puis « montant masqué » (jamais « point point point point »).
- [ ] 4. Appuyez plusieurs fois sur **Tab** dans la fiche. → Attendu : le curseur ne s'arrête jamais sur ces deux textes `••••`. Fermez la fiche par Échap.
- [ ] 5. Cliquez sur le nom du projet, dans la barre du haut. → Attendu : « Provision globale (€) » et « Reste à faire estimé, ETC (€) » affichent le texte `••••`, lu « montant masqué ». Fermez par Échap.
- [ ] 6. Cliquez **Ressources**, puis **Profils de coût…**. → Attendu : chaque taux du profil « Analyste » est le texte `••••`, précédé de l'étiquette « Taux par jour (€) » ; les dates et les boutons des lignes sont grisés ; une phrase dit de désactiver le masquage pour modifier les taux.
- [ ] 7. Avec le lecteur d'écran, placez-vous sur le premier taux. → Attendu : il lit « Taux par jour (€) (Analyste, Depuis le début) » puis « montant masqué ». Fermez les deux fenêtres.
- [ ] 8. Cliquez de nouveau **Masquer les montants**, puis sur le nom de la tâche A. → Attendu : les champs reviennent, avec « 3000 » dans « Budget (€) » : rien n'a été modifié.

## Références

EF-125, RG-41, RG-58, R-78 ; annexe A.8 ligne 11 (c) et journal C du 3 novembre 2026 (`Specs_fonctionnelles.md`). Tests automatiques : `tests/test_v3_budget.py`.
