# « Fichier ▾ » et « Colonnes ▾ » au clavier

**Ce qui change :** les listes dépliantes « Fichier ▾ » et « Colonnes ▾ » s'utilisent au clavier et à la souris.  
**Fichier à ouvrir :** `tests/fixtures/legende-nombreuses-ressources.json`.  
**Durée :** 6 minutes.

## Étapes

- [ ] 1. Appuyez sur Tab jusqu'à **Fichier ▾**, puis sur Entrée. → Attendu : la liste se déplie (Nouveau, Importer, Exporter, Bibliothèque) ; un lecteur d'écran annonce « développé ».
- [ ] 2. Appuyez sur Tab. → Attendu : le focus est sur **Nouveau**.
- [ ] 3. Appuyez sur Échap. → Attendu : la liste se replie et le focus revient sur **Fichier ▾** (« réduit »).
- [ ] 4. Appuyez sur Entrée, puis trois fois sur Tab jusqu'à **Exporter**, puis sur Entrée. → Attendu : la fenêtre Exporter s'ouvre et la liste est repliée.
- [ ] 5. Appuyez sur Échap. → Attendu : la fenêtre se ferme et le focus revient sur **Fichier ▾**.
- [ ] 6. Appuyez sur Tab jusqu'à **Colonnes ▾**, sur Espace, puis sur Tab. → Attendu : la liste se déplie et le focus est sur **Figer**.
- [ ] 7. Choisissez « La première colonne ». → Attendu : la liste reste dépliée et la colonne N° reste à gauche quand la liste défile vers la droite.
- [ ] 8. Cliquez ailleurs dans la page. → Attendu : la liste se replie.
- [ ] 9. Appuyez sur Ctrl + S. → Attendu : la bibliothèque s'ouvre, comme avant.
- [ ] 10. Cliquez **English**. → Attendu : les barres affichent « File ▾ », « Create », « Project », « Tracking », « View » et « Columns ▾ ».

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

EF-152 ; EF-110, EF-143 ; 4.2 ; décisions A.9 (ligne 4). Branche `claude/ergonomie-ecran-979ec7`.
