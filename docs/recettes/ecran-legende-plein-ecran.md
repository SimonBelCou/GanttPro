# En plein écran, la légende se replie

**Ce qui change :** en plein écran du Gantt, la légende reste en bas et se replie ou se déplie par son titre.  
**Fichier à ouvrir :** `tests/fixtures/legende-nombreuses-ressources.json`, fenêtre d'au moins 1280 × 720.  
**Durée :** 4 minutes.

## Étapes

- [ ] 1. Cliquez **Plein écran du Gantt** (barre « Affichage »). → Attendu : les barres du haut disparaissent ; la liste et le Gantt occupent la fenêtre ; la barre zoom − / + / **Quitter le plein écran** est au-dessus de la légende ; un titre **▾ Légende** apparaît.
- [ ] 2. Cliquez **▾ Légende**. → Attendu : la légende se replie, le titre devient **▸ Légende** et le Gantt s'agrandit vers le bas ; un lecteur d'écran annonce « réduit ».
- [ ] 3. Appuyez sur Entrée (le focus est sur le titre). → Attendu : la légende se déplie ; un lecteur d'écran annonce « développé ».
- [ ] 4. Cliquez de nouveau sur le titre pour la replier, puis appuyez sur Échap. → Attendu : sortie du plein écran, focus sur **Plein écran du Gantt**, légende dépliée et sans titre.

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

EF-111, EF-151 ; décisions A.9 (ligne 1). Branche `claude/ergonomie-ecran-979ec7`.
