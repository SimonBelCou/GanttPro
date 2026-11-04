# Les boutons rangés en trois barres

**Ce qui change :** les commandes sont rangées en trois barres par thème (projet, commandes, affichage), dans l'ordre de lecture.  
**Fichier à ouvrir :** `tests/fixtures/legende-nombreuses-ressources.json`, puis `tests/fixtures/projet-surcharge.json`.  
**Durée :** 8 minutes.

## Étapes

- [ ] 1. Lisez la première barre. → Attendu : nom du projet, « Début projet », Annuler, Rétablir, **Fichier ▾**, puis à droite Thème, English, ⚙, ?.
- [ ] 2. Lisez la deuxième barre. → Attendu : **CRÉER** (+ Tâche, + Jalon, + Récapitulative), **PROJET** (Ressources, Catégories, Étiquettes, Calendrier), **SUIVI** (Baselines, Tableau de bord, Rapport d'état, Versions, Imprimer le Gantt), puis « Charge des ressources ».
- [ ] 3. Lisez la barre **AFFICHAGE**. → Attendu : Rechercher, Surligner, Filtres, Grouper par | Liens, Masquer les montants, Étiquettes | − Zoom 100 % + ↺ | Replier la liste, **Colonnes ▾**, Tout replier, Tout déplier, Trier | Plein écran du Gantt.
- [ ] 4. Cliquez sur le nom du projet, fermez la fenêtre, puis appuyez plusieurs fois sur Tab. → Attendu : le focus suit l'ordre de lecture, barre après barre, de gauche à droite, sans passer par les choix de « Fichier » tant que la liste est repliée.
- [ ] 5. Survolez le nom du projet. → Attendu : une infobulle donne le nom complet s'il est abrégé dans la barre.
- [ ] 6. Ouvrez `projet-surcharge.json` (**Fichier ▾ → Importer**). → Attendu : le badge « n conflits » et **Résoudre…** apparaissent dans le groupe Charge ; le bandeau d'alertes s'affiche et la légende reste en bas de la fenêtre.
- [ ] 7. Ctrl + clic sur deux lignes de la liste. → Attendu : la barre de sélection apparaît au-dessus de la liste ; la légende reste en bas de la fenêtre.

En cas d'écart : notez le numéro de l'étape, ce que vous voyez et le navigateur.

## Références

EF-152, EF-151 ; 4.1, 4.2 ; décisions A.9 (ligne 4). Branche `claude/ergonomie-ecran-979ec7`.
