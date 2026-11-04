# Petits écrans et zoom de 200 %

**Ce qui change :** sous 901 × 560 px (téléphone, zoom de 200 %), la page garde son défilement ordinaire ; l'impression ne change pas.  
**Fichier à ouvrir :** `tests/fixtures/legende-nombreuses-ressources.json`.  
**Durée :** 5 minutes.

## Étapes

- [ ] 1. Sur un écran de 1280 × 720 ou moins, mettez le zoom du navigateur à 200 % (Ctrl + +). → Attendu : la page défile normalement, la légende est sous le Gantt, pas de défilement horizontal de la page.
- [ ] 2. Ouvrez **Colonnes ▾**. → Attendu : la liste s'insère sous le bouton sans sortir de la fenêtre.
- [ ] 3. Dans les outils du navigateur, passez en mode téléphone de 360 px de large. → Attendu : même chose ; la liste puis le Gantt sont l'un sous l'autre.
- [ ] 4. Revenez à 100 %, puis cliquez **Imprimer le Gantt** (groupe Suivi). → Attendu : l'aperçu est le même qu'avant cette mise à jour.

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

EF-151, EF-152 ; EX-04 ; 4.4 ; décisions A.9 (lignes 1 et 5). Branche `claude/ergonomie-ecran-979ec7`.
