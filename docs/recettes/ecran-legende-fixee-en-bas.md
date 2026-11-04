# La légende reste en bas de la fenêtre

**Ce qui change :** la légende est fixée en bas de la fenêtre, toujours visible ; la liste et le Gantt prennent la hauteur restante.  
**Fichier à ouvrir :** `tests/fixtures/legende-nombreuses-ressources.json` (30 personnes et 12 catégories fictives), dans une fenêtre d'au moins 1280 × 720, zoom du navigateur à 100 %.  
**Durée :** 5 minutes.

## Étapes

- [ ] 1. Ouvrez le fichier avec **Fichier ▾ → Importer**, puis regardez le bas de la fenêtre. → Attendu : la légende est visible en bas, dépliée, sans faire défiler la page ; aucun bouton « Légende » au-dessus d'elle.
- [ ] 2. Faites tourner la molette de la souris au-dessus de la légende. → Attendu : la légende défile dans sa zone (lignes « Personne … ») ; le reste de la page ne bouge pas.
- [ ] 3. Appuyez sur Tab jusqu'à la légende, puis sur la flèche bas. → Attendu : un contour de focus entoure la légende, qui défile au clavier.
- [ ] 4. Faites défiler la liste et le Gantt tout en bas, puis vers la droite. → Attendu : les deux barres de défilement horizontales sont visibles juste au-dessus de la légende, jamais recouvertes.
- [ ] 5. Agrandissez puis réduisez la hauteur de la fenêtre. → Attendu : la zone liste + Gantt s'allonge ou se raccourcit ; la légende reste collée en bas.

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

EF-46, EF-151 ; EX-29 ; décisions A.9 (lignes 1 et 2), 4.1. Branche `claude/ergonomie-ecran-979ec7`.
