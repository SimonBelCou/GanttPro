# Recette manuelle de GanttPro

Ce document guide, pas à pas, la validation de **tout l'outil** par le propriétaire du produit.

- **Partie A — Recette générale** : les parcours G1 à G15 couvrent l'ensemble des fonctions. On les rejoue en entier
  avant une version majeure, et en partie quand une mise à jour touche une zone précise (le tableau « Quand rejouer quoi »
  l'indique).
- **Partie B — Mises à jour** : un chapitre par évolution (Budget, étapes A et B, pour l'instant), à suivre pour valider cette
  évolution seule.

Il est complété à chaque évolution visible (règle 5 de `CLAUDE.md`) : **une mise à jour n'est livrée qu'avec son
parcours à jour et ses fichiers d'essai**, et les parcours généraux sont adaptés si la mise à jour change un
comportement existant.

## Comment l'utiliser

1. Ouvrez `GanttPro.html` (double-clic, aucun serveur nécessaire) dans un navigateur récent. Langue : français,
   sauf indication contraire.
2. Les projets d'essai sont dans `tests/fixtures/`. Ce sont de **faux projets** : aucune donnée réelle. On les ouvre
   par le bouton **Importer** de la barre du haut. L'aperçu propose de les ouvrir dans un nouvel onglet ou de
   **Remplacer le projet ouvert** (avec une confirmation de plus si celui-ci est modifié).
3. Chaque parcours indique l'état de départ, des actions numérotées et le résultat attendu. Cochez la case quand le
   résultat constaté est conforme. En cas d'écart, notez le numéro de l'étape, ce que vous voyez et le navigateur.
4. Les références (EF, RG, R-xx) renvoient au cahier des charges
   (<https://claude.ai/code/artifact/76a646d0-34e1-42f9-a540-a79b741f91d7>). Le détail des fonctions est dans le
   guide utilisateur (`docs/guide-utilisateur.md`), dont les sections sont citées « (§ n) ».
5. **Les statuts dépendent de la date du jour** (Terminé, En retard, À venir…). Quand un attendu en dépend, le
   parcours l'indique ; sinon il ne repose que sur les dates prévues, le chemin critique et les conflits, qui ne
   dépendent pas de la date du jour.
6. Les espaces entre les groupes de chiffres des montants sont des espaces insécables : ne cherchez pas à les
   reproduire à l'identique.

### Projets d'essai

| Fichier | Ce qu'il montre | Parcours |
| --- | --- | --- |
| `projet-exemple.json` | Deux phases, tâches, jalon, liens avec délai, échéance, notes, étiquettes, deux ressources | G2 à G11, G14 |
| `projet-surcharge.json` | Une ressource surchargée et absente, sans nivellement : un conflit | G5, G6 |
| `projet-retard.json` | Projet daté d'août 2026, en retard : tâche critique, échéance dépassée, voyant ROUGE | G9, G11 |
| `projet-atlas-budget.json` | Projet complet de 49 éléments avec budgets, coûts réels, provision, un montant en millions, une baseline prise avant des dépassements, 4 conflits voulus | B13, et tout parcours sur un grand projet |
| `projet-noms-pieges.json` | Trois tâches dont le nom ressemble à du code (`<img onerror…>`, `=1+1`, guillemets) | G12 7, G15 6 |
| `projet-1000-taches.json` | 1 000 tâches fictives liées, pour la fluidité | G15 7 |
| `budget-*.json`, `refus-*.json`, `tableur-montants.csv` | Budget (partie B) | B |
| `valeur-acquise-passe.json` | Projet daté de 2025 : tout est planifié, avancement 55 %, CPI 1,16, SPI 0,55, ETC saisi | B16, B19, B20 |
| `valeur-acquise-futur.json` | Projet daté de 2035 : rien n'est encore planifié, SPI « non calculable », CPI 0,50 | B17 |
| `colonnes-personnalisees.json` | Projet de 2025 sans montant, dont la liste affiche six colonnes dans un ordre choisi (Activité, N°, Début, Fin, Statut, Budget) | Colonnes 1 |
| `valeur-acquise-derive.json` | Projet de 2025 avec deux baselines (initiale et replanifiée), une tâche ajoutée depuis | B15, B18 |

### Quand rejouer quoi

| La mise à jour touche… | Rejouer au minimum |
| --- | --- |
| Le calcul des dates, des liens, du calendrier | G2, G4, G9 |
| Les ressources, la charge, le nivellement | G5, G6 |
| La liste, la grille, les gestes | G3, G6, G7, Colonnes 1 |
| Les fichiers (export, import, chiffrement) | G12, G13 |
| Le tableau de bord, le rapport, l'impression | G10, G11 |
| L'interface en général (thème, langue, clavier, accessibilité) | G14, G15 |

---

## Partie A — Recette générale

### G1 — Premier lancement et nouveau projet (§ 1, § 2)

Départ : ouvrez `GanttPro.html` dans une fenêtre de navigation privée (aucun réglage mémorisé).

- [ ] 1. *Attendu :* un projet « Nouveau projet » commence à la date du jour, avec une tâche A de 10 jours
  « Renommer cette tâche… », une ressource et une catégorie « Général ». Les zones de l'écran décrites au § 1 sont
  présentes (onglets, barre du haut, barre de chiffres, liste et grille, légende).
- [ ] 2. Cliquez sur l'étiquette du projet, saisissez un nom de 61 caractères. *Attendu :* refus avec un message
  (60 caractères au plus) ; le nom de 60 caractères est accepté.
- [ ] 3. Choisissez un emoji au clavier (Tab puis flèches), enregistrez. *Attendu :* l'emoji précède le nom.
- [ ] 4. Cliquez sur **Nouveau**. *Attendu :* un second onglet s'ouvre ; le premier est conservé.

### G2 — Début du projet et calendrier (§ 2, R-02, R-06 à R-11, R-48 à R-51)

Départ : importez `projet-exemple.json`.

- [ ] 1. Lisez la barre de chiffres. *Attendu :* le jalon « Fin » est au **lundi 30 novembre 2026** ; la durée de
  « Phase 1 — Cadrage » est 5 j et celle de « Phase 2 — Réalisation » 14 j.
- [ ] 2. Mettez **Début projet** au samedi 7 novembre 2026. *Attendu :* la date saisie reste affichée ; les tâches
  commencent le premier jour ouvré suivant (lundi 9 novembre).
- [ ] 3. Annulez (**Annuler**). *Attendu :* retour au 2 novembre et à la fin du 30 novembre.
- [ ] 4. Ouvrez **Calendrier**. *Attendu :* semaine lundi–vendredi cochée, jeu « France métropolitaine » ; l'aperçu
  du mois grise les week-ends et nomme le 11 novembre.
- [ ] 5. Décochez tous les jours de la semaine. *Attendu :* refus (au moins un jour travaillé).
- [ ] 6. Ajoutez un jour chômé le mardi 3 novembre 2026 avec un libellé, enregistrez. *Attendu :* les tâches
  s'allongent d'un jour ouvré ; la fin dépasse le 30 novembre. Ajoutez la même date en jour travaillé : refus
  (une date ne peut pas être chômée et travaillée).
- [ ] 7. Changez le jeu de jours fériés pour « Aucun » : la fin avance d'un jour par férié retiré. Remettez
  « France métropolitaine ». (Facultatif : « France Alsace-Moselle » ajoute le Vendredi saint et le 26 décembre.)
- [ ] 8. Annulez tout (Annuler autant de fois que nécessaire) pour revenir à l'état de départ.

### G3 — Tâches, jalons et récapitulatives (§ 3, R-24, R-31, R-41, R-42)

Départ : `projet-exemple.json` ouvert.

- [ ] 1. **+ Ajouter tâche**. *Attendu :* une ligne apparaît, l'édition s'ouvre, le nom est prêt à être saisi ;
  l'identifiant proposé est libre (A).
- [ ] 2. Saisissez une durée `0` puis **Enregistrer**. *Attendu :* refus avec le message « Durée (jours ouvrés) :
  entier de 1 à 3 650. » sous le champ ; le curseur y va ; rien n'est enregistré.
- [ ] 3. Mettez durée `4`, nom « Tâche d'essai », **Enregistrer**. *Attendu :* la ligne est mise à jour.
- [ ] 4. Renommez l'identifiant de T3 en `T3B`. *Attendu :* le lien de T4 vers T3 devient T3B.
- [ ] 5. Sélectionnez « Tâche d'essai » et cliquez **Mettre en retrait** : elle devient enfant de la
  récapitulative située au-dessus ; **Remonter d'un niveau** l'en sort.
- [ ] 6. Repliez « Phase 1 — Cadrage » (chevron ▸). *Attendu :* ses enfants disparaissent, ses dates et son
  avancement restent. Dépliez.
- [ ] 7. Ctrl + D sur « Tâche d'essai ». *Attendu :* « Tâche d'essai (copie) » juste dessous, sans avancement.
- [ ] 8. Supprimez la copie. *Attendu :* confirmation qui nomme la tâche ; après validation elle disparaît.
- [ ] 9. Supprimez T1 : la confirmation dit combien de tâches perdent un prédécesseur. **Annuler** les rétablit
  avec leur lien.
- [ ] 10. Imbriquez des récapitulatives les unes sous les autres (sélectionnez la dernière créée, puis **+ Ajouter
  récapitulative**, de nouveau). *Attendu :* quand la limite de cinq niveaux est atteinte, un message de refus
  s'affiche et **aucune ligne n'est créée** (la nouvelle ligne ne retombe plus au premier niveau).
- [ ] 11. **Saisie.** Ouvrez la fiche d'une tâche et cliquez dans le champ « Nom » (ou tabulez jusqu'à lui).
  *Attendu :* tout le texte existant est sélectionné ; taper un premier caractère le remplace, sans avoir à
  effacer l'ancien nom. Même comportement pour la durée et les autres champs texte ou nombre.
- [ ] 11b. **Fiche d'édition.** Réduisez la hauteur de la fenêtre du navigateur puis ouvrez une tâche. *Attendu :*
  le titre « Modifier … » reste fixe en haut, la rangée de boutons (Enregistrer, Annuler, etc.) reste visible en bas,
  et seuls les champs au milieu défilent.
- [ ] 12. **Colonnes de dates.** Dans la liste, repérez les colonnes **Début**, **Fin**, **Début réel** et
  **Fin réel** (après Durée). *Attendu :* pour chaque tâche les dates prévues (calculées) ; les dates réelles sont
  vides tant qu'elles ne sont pas saisies dans la fiche ; une récapitulative affiche ses dates prévues. Ouvrez
  `projet-atlas-budget.json` : A1 affiche 07/09/2026, 08/09/2026, 07/09/2026, 08/09/2026 ; A2 n'a pas de début
  réel mais une fin réelle 21/09/2026. Les largeurs de ces colonnes se règlent comme les autres.

### G4 — Liens, contraintes et chemin critique (§ 4, R-01, R-05, R-12 à R-14, R-36 à R-44, R-55)

Départ : `projet-exemple.json` ouvert.

- [ ] 1. Lisez la colonne Dépendances. *Attendu :* T3 : `M1 FD+1` ; T4 : `T3`.
- [ ] 2. Ouvrez T3 : le lien vers M1 est de type fin → début avec délai +1. Passez le délai à `-1` puis `0` :
  T3 se rapproche d'un jour à chaque fois. Revenez à `+1`.
- [ ] 3. Ouvrez T1, ajoutez le prédécesseur T4. *Attendu :* refus avec le chemin de la boucle
  (« Cette dépendance créerait la boucle … »).
- [ ] 4. Ajoutez à T2 un prédécesseur de type début → début sur T1 : T2 peut démarrer avec T1. Supprimez-le.
- [ ] 5. Ouvrez la fiche de la récapitulative P1. *Attendu :* durée et avancement « calculés », aucun champ de lien.
- [ ] 6. Donnez à T3 une **date imposée** au 4 novembre 2026. *Attendu :* 📌 sur la ligne, ⚠ et une alerte,
  car la date précède la fin de M1 ; le bandeau nomme les dates. Retirez la date imposée.
- [ ] 7. Ajoutez « Ne pas commencer avant » le 30 novembre sur T3 : ⏳ ; T3 et T4 se décalent. Retirez-le.
- [ ] 8. Mettez l'échéance de T4 au 20 novembre 2026. *Attendu :* le drapeau 🚩 passe au rouge, la ligne indique
  « échéance dépassée », une alerte s'affiche, T4 reste critique. Remettez le 18 décembre.
- [ ] 9. Vérifiez le **chemin critique** (barre de chiffres) : T1 → T2 → M1 → T3 → T4. Les lignes critiques
  portent ● et le mot « critique ».

### G5 — Ressources, absences et charge (§ 5, R-16, R-25, R-32, R-45 à R-47, R-52, R-65 à R-70)

Départ : importez `projet-surcharge.json` (mode « Sans nivellement »).

- [ ] 1. *Attendu :* le badge **1 conflit** apparaît ; les lignes A et B portent ⚠ « en conflit » (Alice affectée à
  100 % sur deux tâches en même temps, et en absence les 9 et 10 novembre).
- [ ] 2. Cliquez sur le badge : le bandeau explique chaque conflit avec les dates et les tâches.
- [ ] 3. **Résoudre…** *Attendu :* pour chaque conflit, des propositions déjà simulées, classées de la plus efficace
  à la plus coûteuse, avec leur effet (conflits restants, décalage de la fin). Rien ne change avant **Appliquer**.
- [ ] 4. Appliquez « faire passer A avant B ». *Attendu :* B reçoit un lien fin → début A → B, visible dans sa fiche.
  **Annuler** le retire.
- [ ] 5. Changez **Charge des ressources** pour « Nivellement automatique ». *Attendu :* plus de conflit, une tâche
  porte un message de décalage (« j de décalage (Alice : surcharge) ») et la fin du projet peut reculer.
- [ ] 6. Passez en « Lissage dans la marge » : la fin du projet ne bouge pas d'elle-même ; un éventuel conflit
  restant est signalé « ne tient pas dans sa marge ».
- [ ] 7. **Ressources** : ajoutez « alice » → refus (nom déjà pris, casse ignorée). Renommez Alice en « Alice M. » :
  les deux tâches restent affectées.
- [ ] 8. Supprimez Alice : la confirmation annonce « 2 tâches deviendront sans ressource » ; annulez la suppression.
- [ ] 9. Ouvrez la **Fiche** de Bob : ses tâches, sa charge en jours-personne, sa capacité, ses absences.
- [ ] 10. Dans une tâche, affectez Bob avec un taux de 150 %. *Attendu :* refus (jamais plus que sa capacité).
- [ ] 11. Remettez le mode « Sans nivellement » (état de départ) : le conflit réapparaît.

### G6 — La grille de Gantt et ses gestes (§ 6, R-33, R-34, R-55)

Départ : `projet-exemple.json` ouvert, puis `projet-surcharge.json` pour les conflits.

- [ ] 1. Repérez : barres colorées par catégorie, barres critiques rouges avec ● sur la ligne, losange ◆ du jalon,
  crochet des récapitulatives, ligne rouge « Aujourd'hui » (si la date du jour est dans la grille), week-ends et
  jours fériés grisés (11 novembre).
- [ ] 2. Survolez ou mettez au focus une barre. *Attendu :* infobulle (dates, durée, avancement, statut,
  prédécesseurs, ressources, marge). Échap la ferme.
- [ ] 3. Zoom : boutons −, +, ↺, touches + et −, Ctrl + molette. *Attendu :* 20 à 400 % (le bouton + s'arrête à 400 %) ; sous 60 %, vue mois ; à tout niveau de zoom, les libellés
  de mois de l'en-tête sont lisibles et jamais coupés : « nov. 2026 », puis « nov. 26 », « 11/26 », enfin « 11 »
  quand la place diminue (le nom complet reste dans l'infobulle).
- [ ] 4. **Liens : ON / OFF** masque et affiche les flèches ; les flèches entre tâches critiques sont rouges.
- [ ] 5. Glissez la barre de T2 de deux jours vers la droite. *Attendu :* date imposée 📌 ; un message de
  confirmation avec **Annuler**. Annulez.
- [ ] 6. Tirez le bord droit de la barre de T2 : la durée change. Annulez.
- [ ] 7. Reliez deux barres par leurs poignées rondes : un lien est créé. Essayez de créer une boucle : refus.
- [ ] 8. Tirez le triangle sous une barre : l'avancement change par pas de 5 %. Annulez.
- [ ] 9. Tirez la séparation liste / Gantt ; double-clic dessus : la largeur par défaut revient. Tirez le bord d'un
  en-tête de colonne ; **Largeurs par défaut** rétablit.
  *Attendu aussi :* les titres de colonnes ne sont jamais coupés, même en réduisant une colonne au minimum ou en
  rétrécissant la fenêtre (la liste défile alors horizontalement) ; un double-clic sur la poignée d'une colonne
  rétablit **sa** largeur par défaut, les autres gardent la leur.
- [ ] 10. **Figer** les deux premières colonnes, défilez la liste vers la droite : ils restent visibles.
- [ ] 11. **Plein écran du Gantt**, puis Échap. *Attendu :* le reste de la page est désactivé pendant le plein
  écran ; le focus revient au bouton à la sortie.
- [ ] 12. Même geste au clavier uniquement : Alt + → sur une tâche sélectionnée déplace sa date imposée d'un jour.
- [ ] 13. **Barres de défilement** (EX-29). Ouvrez `projet-atlas-budget.json` (projet long), la page étant en haut.
  *Attendu :* sous la liste **et** sous le Gantt, une barre de défilement horizontale est visible tout de suite, sans
  avoir à descendre dans la page ; la liste et le Gantt défilent verticalement ensemble (défilez l'un, l'autre suit) ;
  l'en-tête (colonnes, échelle de temps) reste en haut pendant le défilement. Réduisez la fenêtre : les barres
  restent visibles.

### G7 — Sélection multiple, modification en masse, copier-coller (§ 7, R-54)

Départ : `projet-exemple.json` ouvert.

- [ ] 1. Maj + clic de T1 à T2, puis Ctrl + clic sur T4. *Attendu :* la barre « 3 tâches sélectionnées »
  apparaît avec Modifier en masse, Dupliquer, Mettre en retrait… ; Ctrl + A sélectionne toutes les lignes affichées.
- [ ] 2. **Modifier en masse** : catégorie « Réalisation », **Appliquer**. *Attendu :* la catégorie change sur les
  trois tâches seulement. **Annuler** une seule fois revient sur les trois.
- [ ] 3. Ctrl + C puis Ctrl + V. *Attendu :* trois nouvelles tâches avec des identifiants libres et leurs liens
  internes ; **Annuler** les retire d'un coup.
- [ ] 4. Dans un tableur, copiez deux lignes (Nom, Durée), collez dans la liste : les colonnes sont reconnues avec
  une ligne d'en-tête.
- [ ] 5. **Regrouper sous une récapitulative** : un groupe est créé au-dessus des tâches choisies.
- [ ] 6. Échap ou « Effacer la sélection » vide la sélection.

### G8 — Rechercher, filtrer, regrouper, trier (§ 8, R-53)

Départ : `projet-exemple.json` ouvert.

- [ ] 1. **Rechercher** « lot » : seules les tâches correspondantes restent visibles (T3, T4) ; **Surligner** les
  met en évidence sans masquer les autres.
- [ ] 2. **Filtres** par catégorie « Conception » : seules T1 et T2 restent.
- [ ] 3. **Grouper par** ressource : des en-têtes de groupe avec totaux (« n élément(s), x j ») ; le groupe peut
  se replier.
- [ ] 4. **Étiquettes** : cochez **Étiquettes**. *Attendu :* une pastille arrondie après le nom de T1 (« cadrage »)
  et de T3 (« lot 1 »), jamais de texte du genre « [object HTMLSpanElement] ». Filtrez ensuite sur « lot 1 » :
  seule T3 (avec sa récapitulative) reste, pastille visible.
- [ ] 5. **Tout replier** puis **Tout déplier**.
- [ ] 6. **Trier** : une confirmation rappelle l'effet sur la priorité ; après validation chaque prédécesseur est
  avant ses successeurs.
- [ ] 7. Effacez tous les filtres : la liste est complète.

### G9 — Suivre l'avancement (§ 9, R-18 à R-23)

Départ : importez `projet-retard.json` (daté d'août 2026, donc en retard à toute date de recette après le
23 septembre 2026).

- [ ] 1. *Attendu* (barre de chiffres) : avancement global **43 %** ; la fin prévue est le **mercredi
  23 septembre 2026** ; chemin critique A → B → C → M.
- [ ] 2. Statuts : A « Terminé » ; B, C et M « En retard ».
- [ ] 3. Alerte : C signale « échéance dépassée » (drapeau rouge, bandeau avec les dates).
- [ ] 4. Ouvrez B : mettez l'avancement à 100 %. *Attendu :* l'avancement global augmente ; B devient « Terminé ».
- [ ] 5. Saisissez une fin réelle sur C. *Attendu :* l'avancement de C passe à 100 %. Ramenez-le à 50 % :
  la fin réelle est effacée et un
  **message visible** (bandeau en bas de l'écran, une dizaine de secondes) l'indique.
- [ ] 6. Saisissez une fin réelle antérieure au début réel. *Attendu :* refus.
- [ ] 7. Ouvrez le tableau de bord, « Tableau de suivi » : colonne Écart en jours ouvrés (+ pour un retard) ;
  tri par un clic sur un en-tête.
- [ ] 8. Annulez toutes les modifications.

### G10 — Baselines et versions (§ 10, R-33, R-34)

Départ : `projet-exemple.json` ouvert.

- [ ] 1. **Baselines** → **Capturer une baseline**. *Attendu :* « Baseline 1 » est créée avec sa date et le nombre
  de tâches ; deux cases (Sur le Gantt, Sur la courbe en S) cochées par défaut.
- [ ] 2. Allongez T3 de 3 jours. *Attendu :* la baseline ne bouge pas ; une fine barre sous T3 montre l'ancienne
  position ; son nom apparaît au survol.
- [ ] 3. Tableau de bord : choisissez la colonne « Écart vs baseline » : la différence de fin apparaît.
- [ ] 4. Renommez la baseline, changez sa couleur ; capturez-en jusqu'à dix en tout, la onzième est refusée (voir aussi Budget 15 pour l'affichage, limité à trois).
- [ ] 5. **Versions** : nommez « V1 », **Enregistrer l'état actuel**. Modifiez le projet, puis **Restaurer** :
  confirmation, projet remis dans l'état de V1 ; **Annuler** annule la restauration.

### G11 — Tableau de bord, rapport d'état, impression (§ 11, R-32, R-56)

Départ : importez `projet-retard.json`.

- [ ] 1. **Tableau de bord**, onglet **Synthèse** : quatre indicateurs (avancement global 43 %, terminées 1, en
  cours 0, en retard 3) et la courbe en S (prévu / réel, semaines / mois). Flèches ← / → parcourent les
  périodes ; **Afficher les valeurs** ouvre le tableau des chiffres.
- [ ] 2. Onglet **Charge** (si le projet a des ressources) : barres d'occupation par ressource ; la surcharge est
  rouge et marquée ▲. Importez `projet-surcharge.json` pour la voir.
- [ ] 3. **Rapport d'état** (avec `projet-retard.json`). *Attendu :* voyant **ROUGE** écrit en toutes lettres
  (tâche critique en retard) ; indicateurs, retards, échéances, alertes.
- [ ] 4. Décochez des blocs : ils disparaissent de l'aperçu. Saisissez une note : elle reste dans le projet.
- [ ] 5. **Copier le texte** : collez dans un éditeur de texte, le contenu est lisible.
- [ ] 6. Avec `projet-exemple.json`, le voyant dépend de la date du jour : ROUGE si une tâche critique est en
  retard, ORANGE pour un autre retard, VERT sinon.
- [ ] 7. **Imprimer le Gantt** (EF-89, EX-26, EX-30, EX-32), avec `projet-atlas-budget.json`. *Attendu :* la
  fenêtre s'adapte à son contenu, **sans barre de défilement horizontale** (réduisez aussi la fenêtre du navigateur :
  les choix passent à la ligne). Dans l'aperçu d'impression : les barres sont **en couleur** (celle de leur
  catégorie) ; une tâche critique a un contour rouge épais et des hachures ; la partie réalisée est foncée et
  rayée ; la colonne **Catégorie** nomme la catégorie de chaque ligne et la légende donne les couleurs. *Lisible sans
  couleur :* choisissez « noir et blanc » dans la fenêtre d'impression du navigateur : critique, réalisé, jalon et
  catégorie restent distinguables. Aucun texte n'est coupé (les noms longs passent à la ligne) ; les colonnes Début,
  Fin et Dépendances sont proposées et cochées ; **Ajuster à la largeur de la page** met tout le planning sur une
  page en largeur ; **Zoom actuel** le découpe en bandes (« partie 1 sur N ») sur de nouvelles pages, chacune
  répétant les colonnes de texte.

### G12 — Exporter et importer (§ 12, R-26 à R-29, R-57 à R-61)

Départ : `projet-exemple.json` ouvert.

- [ ] 1. Cliquez **Exporter**, laissez « Projet GanttPro (.json) », cliquez **Exporter** : le navigateur enregistre
  `<nom>_gantt.json` (dossier Téléchargements, ou la boîte « Enregistrer sous » selon votre navigateur) et un message
  « Export « Projet GanttPro (.json) » terminé » s'affiche : cherchez le fichier. Puis **Importer** ce fichier :
  l'aperçu d'import s'ouvre ; choisissez **Remplacer le projet ouvert**. *Attendu :* un projet identique (mêmes
  tâches, liens, dates). Si rien n'apparaît, notez le navigateur et le message affiché.
- [ ] 2. Exportez en **Excel (.xlsx)** : ouvrez dans un tableur, feuilles Tâches, Ressources, Absences, Calendrier,
  Baselines, en-tête figée.
- [ ] 3. Exportez en **CSV** puis réimportez via l'assistant (trois étapes) : les tâches reviennent.
- [ ] 4. Exportez en **MS Project (.xml)** puis réimportez : tâches, hiérarchie, liens et durées conservés.
- [ ] 5. Exportez l'**Image du Gantt (.png)** avec `projet-atlas-budget.json` : le fichier s'ouvre et reproduit la
  grille. *Attendu :* l'en-tête a deux lignes (mois, puis semaines « 07/09 » ou « 07 » selon la place) ; aucun
  libellé n'en chevauche un autre, quel que soit le zoom de l'écran au moment de l'export ; la fenêtre d'export
  n'a pas de défilement horizontal.
- [ ] 6. **Exporter sans noms de personnes** (JSON) : les ressources deviennent « Ressource 1 », « Ressource 2 ».
- [ ] 7. Avec `projet-surcharge.json`, créez une tâche nommée `=1+1` puis exportez en CSV et Excel et ouvrez dans un
  tableur : le texte reste du texte (apostrophe), aucune formule ne s'exécute.
- [ ] 8. Créez un fichier JSON invalide (supprimez une accolade) et importez-le. *Attendu :* refus en entier avec
  la raison ; le projet ouvert est intact.
- [ ] 9. Un fichier de plus de 5 Mo est refusé.

### G13 — Onglets, bibliothèque, modèles, sauvegarde automatique, protection par mot de passe (§ 13, R-30, R-61)

- [ ] 1. Ouvrez trois projets d'essai dans trois onglets : chacun garde son zoom, ses filtres, sa sélection et son
  historique d'annulation. Un point ● signale les modifications non enregistrées.
- [ ] 2. Fermez un onglet modifié (✕) : confirmation. Fermez la fenêtre du navigateur avec un onglet modifié :
  avertissement. Après un export, plus d'avertissement ; sélectionner, zoomer ou changer de thème n'en déclenche pas.
- [ ] 3. Ctrl + S : première fois, un message explique où sont gardées les données. Le projet figure dans la
  **Bibliothèque** (ouvrir, renommer, dupliquer, supprimer).
- [ ] 4. **Enregistrer comme modèle** (avec puis sans ressources), puis **Nouveau projet à partir d'un modèle** :
  nom et date de début demandés ; avancement, dates réelles, commentaires, baselines et versions absents.
  Les deux modèles fournis (« Projet en 5 phases », « Événement ») s'ouvrent.
- [ ] 5. Cliquez **Exporter**, laissez le format JSON, cochez **Protéger par mot de passe** (la case est sous « Exporter
  sans noms de personnes ») : deux champs apparaissent (mot de passe, confirmation). Saisissez 12 caractères au
  moins (une phrase de passe convient), **Exporter**. *Attendu :* le fichier est illisible dans un éditeur ;
  l'import demande le mot de passe ; un mauvais mot de passe est refusé ; un fichier altéré est refusé. Un mot de
  passe trop court ou deux saisies différentes sont refusés avec un message. Le mot de passe n'est jamais
  conservé : le perdre rend le fichier définitivement illisible.
- [ ] 6. **Réglages** (⚙) : cochez la sauvegarde automatique, **puis cliquez « Activer » dans la fenêtre de
  confirmation** (sans ce clic elle reste désactivée) ; un message confirme l'activation et l'indicateur apparaît
  en haut. Modifiez un projet (la sauvegarde ne concerne que les projets **modifiés** depuis leur ouverture ou leur
  dernier export), attendez 5 secondes : « Sauvegardé sur cet appareil à … ». Fermez l'onglet du navigateur puis
  rouvrez `GanttPro.html` : GanttPro propose de restaurer. Avec plusieurs fenêtres : la proposition apparaît
  dans toute fenêtre ouverte ensuite, car les copies sont gardées par appareil ; une fenêtre ouverte avant la
  modification reste vide. Désactivez l'option et effacez les données depuis les réglages.

### G14 — Réglages, langue, thème, aide, raccourcis (§ 14, § 15)

- [ ] 1. Bouton de langue : toute l'interface passe en anglais (barre, fenêtres, messages, dates, légende), puis
  revient en français sans perte.
- [ ] 2. Au premier lancement (ou après « Effacer toutes les données » des réglages), le thème est **clair**, quel que
  soit le thème de l'ordinateur. Bouton de thème : clair → sombre → système → clair ; les textes restent lisibles
  dans les deux thèmes. Le choix fait dans Réglages ou par le bouton est conservé seulement si le stockage local est
  disponible.
- [ ] 3. `?` ouvre l'aide ; Échap la ferme et rend le focus.
- [ ] 4. Raccourcis : Ctrl + Z / Ctrl + Y, Ctrl + D, Ctrl + S, + / −, Alt + flèches, Ctrl + Maj + flèches,
  Suppr, comme listés dans la section 15 du guide.
- [ ] 5. **Réglages** : les options de stockage sont décochées par défaut et chacune est effaçable.
- [ ] 6. **Raccourcis au survol.** Survolez (ou mettez au focus) les boutons Annuler, Rétablir, −, +, Bibliothèque, Aide,
  Plein écran du Gantt, et dans une fiche Dupliquer, Mettre en retrait, Remonter d'un niveau. *Attendu :* une
  infobulle donne le nom et le raccourci, par exemple « Annuler (Ctrl + Z) », « Zoom avant (+) ». Ouvrez
  **Réglages**, décochez « Afficher les raccourcis clavier au survol des boutons » : les infobulles disparaissent ;
  recochez : elles reviennent. L'option est cochée par défaut.

### G15 — Accessibilité, vie privée, sécurité, performance (§ 16, R-34, EX)

- [ ] 1. Au clavier seul (sans souris), faites : ajouter une tâche, la modifier, la lier, ouvrir chaque fenêtre.
  *Attendu :* tout est atteignable, le focus est toujours visible, Échap ferme et rend le focus au bon bouton.
- [ ] 2. Avec un lecteur d'écran (si disponible) : chaque barre porte un nom complet ; statuts, criticité et
  conflits sont dits en toutes lettres, jamais par la seule couleur.
- [ ] 3. Zoomez le navigateur à 200 % puis réduisez la fenêtre à la largeur d'un téléphone : rien n'est coupé ni
  inaccessible.
- [ ] 4. Activez « réduire les animations » dans le système : les animations s'arrêtent.
- [ ] 5. Ouvrez les outils de développement du navigateur, onglet Réseau, puis utilisez l'application pendant
  quelques minutes : **aucune requête** n'est émise ; la console ne signale aucune violation de politique de
  sécurité ; aucun cookie n'est créé.
  Le journal ne doit contenir que `GanttPro.html` : l'icône de l'onglet est intégrée à la page (aucune requête `favicon.ico`). Les messages « autoconsent.js » ou « sandbox eval code » viennent de Firefox ou d'une extension, pas de GanttPro ; testez au besoin dans une fenêtre privée sans extension.
- [ ] 6. Importez `projet-noms-pieges.json` (un nom de tâche est `<img src=x onerror=alert(1)>`) : le texte
  s'affiche tel quel, aucune alerte ne se déclenche.
- [ ] 7. Importez `projet-1000-taches.json` (1 000 tâches) : l'affichage reste fluide, les gestes restent utilisables.

---

## Partie B — Mises à jour : Budget, étapes A et B

*Étape B (valeur acquise) : parcours Budget 15 à 20, fichiers `valeur-acquise-*.json`, exigences EF-131 à EF-141, RG-44 à RG-51, scénarios R-80 à R-82 et R-85 à R-88.*

Exigences : EF-112 à EF-127, RG-35 à RG-43. Scénarios : R-71 à R-84.
Fichiers (dans `tests/fixtures/`) : `budget-base.json`, `budget-avec-baseline.json`, `budget-montants-geants.json`, `budget-sans-montant.json`,
`refus-montant-negatif.json`, `refus-montant-trop-grand.json`, `refus-jalon-avec-montant.json`, `tableur-montants.csv`.

### Budget 1 — Un projet sans montant ne montre pas de budget (EF-117)

Départ : ouvrez `budget-sans-montant.json`.

- [ ] 1. Dans la liste, repérez les deux colonnes **Budget** et **Coût réel** (EF-128). *Attendu :* chaque tâche affiche `0,00 €` dans chacune.
- [ ] 2. Ouvrez **Tableau de bord**. *Attendu :* seulement deux onglets, **Synthèse** et **Charge** (pas d'onglet
  Budget). Fermez avec Échap.

### Budget 2 — Saisir et lire les montants d'une tâche (EF-112, EF-113, EF-115, RG-35, RG-36, R-71)

Départ : ouvrez `budget-base.json`. Il contient deux tâches (Etude, Realisation) et un jalon.

- [ ] 1. Lisez les colonnes **Budget** et **Coût réel** (deux colonnes distinctes, EF-128). *Attendu :* Etude
  Budget `100,00 €` et Coût réel `90,00 €` ; Realisation Budget `300,00 €` et Coût réel `100,00 €` ; le jalon est
  vide dans les deux. Chaque colonne se redimensionne séparément (poignée de son en-tête).
- [ ] 2. Cliquez sur **Etude** pour ouvrir sa fiche. *Attendu :* un groupe **Budget** avec les champs budget (`100`)
  et **Coût réel cumulé** (`90`), une aide sur le format du montant, et le texte qui précise que le coût réel
  compte les factures engagées ou payées.
- [ ] 3. Dans le budget, tapez `12,345` puis **Enregistrer**. *Attendu :* la fiche reste ouverte, le champ est
  signalé en erreur (deux décimales au plus).
- [ ] 4. Essayez `-5`, puis `abc`, puis `50 000 000 000,01`. *Attendu :* un message d'erreur clair à chaque fois
  (négatif refusé ; « écrire un montant » ; limite de `50 000 000 000,00` rappelée).
- [ ] 5. Tapez `1 234,56` dans le budget et `1234.5` dans le coût réel, puis **Enregistrer**. *Attendu :*
  `1 234,56 € / 1 234,50 €` sur la ligne.
- [ ] 6. Cliquez **Annuler** (barre du haut). *Attendu :* retour à `100,00 € / 90,00 €`.
- [ ] 7. Ouvrez la fiche du jalon. *Attendu :* aucun champ de budget ni de coût réel.

### Budget 3 — L'onglet Budget et la courbe des coûts (EF-117, EF-118, EF-119, RG-37 à RG-40, R-72, R-74)

Départ : `budget-base.json` ouvert. La date du jour importe peu pour les chiffres ci-dessous (tuiles et catégories).

- [ ] 1. **Tableau de bord**, onglet **Budget**. *Attendu :* BAC `400,00 €`, Provision `40,00 €`, Budget total
  `440,00 €`, Coût réel total `190,00 €`, Reste `250,00 €`.
- [ ] 2. Lisez le tableau **Budget par catégorie**. *Attendu :* Etudes `400,00 €` / `190,00 €` / écart `210,00 €` ;
  Sans catégorie `0,00 €` ; Total `400,00 €` / `190,00 €` / `210,00 €`.
- [ ] 3. Repérez la **Courbe en S des coûts** avec sa note (le coût réel d'une tâche non terminée n'est pas dans la
  courbe ; la provision non plus) et la case **Inclure le coût réel des tâches en cours** (voir Budget 14). *Attendu :* la courbe est lisible, un titre et un résumé écrit l'accompagnent.
- [ ] 4. Cliquez sur **Afficher les valeurs**. *Attendu :* un tableau de valeurs cumulées apparaît (par semaine).
  Passez en **mois** : une seule ligne si le projet tient sur un mois.
- [ ] 5. Naviguez au clavier (Tab, Entrée) : tous les boutons de l'onglet sont atteignables, le focus est visible.

### Budget 4 — Devise et provision (EF-114, RG-35)

Départ : `budget-base.json` ouvert.

- [ ] 1. Cliquez sur le nom du projet (en haut) pour ouvrir ses réglages. *Attendu :* **Symbole de la devise**
  (`€`) et **Provision globale** (`40`).
- [ ] 2. Videz la devise et enregistrez. *Attendu :* refus avec un message (1 à 5 caractères).
- [ ] 3. Saisissez `CHF` et provision `12,5`, enregistrez. *Attendu :* la liste affiche `100,00 CHF / 90,00 CHF`
  (symbole **après** le montant en français). L'onglet Budget indique `12,50 CHF` de provision.
- [ ] 4. Remettez `€` et `40`.

### Budget 5 — Affichage compact des grands montants (EF-125, RG-43, R-83, R-84)

Départ : ouvrez `budget-montants-geants.json` (cinq tâches, du petit montant au plafond).

- [ ] 1. Lisez les colonnes **Budget** et **Coût réel**. *Attendu* (Budget ; Coût réel) : `999 999,99 €` ; `0,00 €`
  (affiché en entier) ; `1 M €` ; `1,23 M €` ; `1,23 M €` ; `0,00 €` ; `2,5 Md €` ; `0,00 €` ; `50 Md €` ; `50 Md €`.
  (En français : M = million, Md = milliard.)
- [ ] 2. Ouvrez la fiche de la tâche « Un million », champ coût réel. *Attendu :* le montant **complet**
  (`1234567,89`), jamais abrégé.
- [ ] 3. Onglet Budget du tableau de bord. *Attendu :* les tuiles et tableaux affichent les montants en entier
  (BAC `52 503 234 567,88 €`).
- [ ] 4. Passez en anglais (bouton de langue). *Attendu :* symbole **avant** le montant (`€1M`, `€2.5B`, `€50B`),
  séparateurs anglais ; milliard = `B`. Revenez en français.
- [ ] 5. (Facultatif, lecteur d'écran) Sur une ligne abrégée, le lecteur annonce le montant abrégé puis le
  montant complet entre parenthèses.

### Budget 6 — Masquer les montants à l'écran (EF-126, RG-41, R-78)

Départ : `budget-base.json` ouvert.

- [ ] 1. Cliquez **Masquer les montants** (barre du haut). *Attendu :* le bouton paraît enfoncé ; la colonne
  affiche `••••` partout ; aucun chiffre de montant n'est visible.
- [ ] 2. Ouvrez la fiche d'Etude. *Attendu :* les champs budget et coût réel sont **désactivés**.
- [ ] 3. Ouvrez le tableau de bord, onglet Budget. *Attendu :* tuiles, tableau des catégories et valeurs de la
  courbe sont masqués.
- [ ] 4. Rechargez la page (F5). *Attendu :* le masquage est conservé (réglage mémorisé sur votre poste).
- [ ] 5. Cliquez de nouveau sur le bouton. *Attendu :* les montants reviennent. Le masquage n'a modifié aucune
  donnée (le bouton **Annuler** reste grisé).

### Budget 7 — Baselines et BAC (EF-121, RG-39, R-75)

Départ : ouvrez `budget-avec-baseline.json` (une baseline à 400,00 €, le budget courant de Realisation passé à
350,00 €).

- [ ] 1. Ouvrez **Baselines**. *Attendu :* la colonne **BAC** affiche `400,00 €` pour la baseline ; la ligne
  « BAC du projet » indique `450,00 €`.
- [ ] 2. Capturez une nouvelle baseline. *Attendu :* son BAC est `450,00 €` ; la précédente reste inchangée.

### Budget 8 — Rapport, impression et exports : « Inclure les montants » (EF-120, EF-124, RG-41, R-76)

Départ : `budget-avec-baseline.json` ouvert.

- [ ] 1. Ouvrez **Rapport**. *Attendu :* la case **Inclure les montants** est **décochée** ; aucun bloc Budget.
- [ ] 2. Cochez-la. *Attendu :* un bloc Budget apparaît (BAC `450,00 €`, provision `40,00 €`, budget total
  `490,00 €`, coût réel `190,00 €`, reste `300,00 €`). Avec la baseline, la variation du BAC est `+50,00 €`.
- [ ] 3. Fermez puis rouvrez le rapport. *Attendu :* la case est de nouveau **décochée**.
- [ ] 4. Faites de même avec **Imprimer le Gantt** : colonne montants seulement si la case est cochée.
- [ ] 5. **Exporter** en JSON **sans** cocher la case, puis ouvrez le fichier dans un éditeur de texte.
  *Attendu :* aucun champ `budget`, `actual`, `provision` ; la devise reste présente.
- [ ] 6. Exportez en JSON **avec** la case cochée. *Attendu :* les champs existent, en **centimes**
  (ex. `"budget": 10000` pour 100,00 €).
- [ ] 7. Exportez en CSV sans, puis avec. *Attendu :* colonnes Budget et Coût réel absentes, puis présentes avec
  deux décimales.
- [ ] 8. Activez **Masquer les montants**, exportez avec la case cochée. *Attendu :* le fichier contient bien les
  montants (le masquage ne concerne que l'écran).

### Budget 9 — Importer un tableur avec montants (RG-42, R-77)

Départ : un projet quelconque ouvert.

- [ ] 1. Ouvrez `tableur-montants.csv`. L'assistant d'import s'affiche. *Attendu :* les colonnes **Budget** et
  **Coût réel** sont reconnues automatiquement.
- [ ] 2. Avancez jusqu'à l'avant-dernière étape. *Attendu :* un tableau d'avertissements liste les montants non
  pris en compte (`abc`, `99,999`) avec leur ligne.
- [ ] 3. Importez. *Attendu :* les trois tâches importées affichent `1 234,56 € / 10,00 €`, `0,00 € / 0,00 €`
  (montant invalide ignoré) et `250,50 € / 0,00 €` (le coût réel `99,999` est ignoré).

### Budget 10 — Fichiers refusés (RG-37, R-77)

Départ : `budget-base.json` ouvert.

- [ ] 1. Ouvrez `refus-montant-negatif.json`. *Attendu :* une fenêtre d'erreur nomme la tâche et le champ
  `budget` ; le projet ouvert est **intact**.
- [ ] 2. Même chose avec `refus-montant-trop-grand.json` (limite de 5 000 000 000 000 centimes rappelée).
- [ ] 3. Même chose avec `refus-jalon-avec-montant.json` (« un jalon ou une récapitulative n'a ni budget ni coût
  réel propre »).

### Budget 11 — Modification en masse (EF-116)

Départ : `budget-base.json` ouvert.

- [ ] 1. Ctrl + clic sur Etude et Realisation, puis **Modifier en masse**. *Attendu :* des champs budget et coût
  réel, vides par défaut (« garder »).
- [ ] 2. Budget `10`, **Appliquer**. *Attendu :* `10,00 €` en budget sur les deux lignes, coûts réels inchangés.
- [ ] 3. **Annuler** : un seul pas ramène aux montants d'origine.

### Budget 12 — Infobulle des barres (EF-115)

Départ : `budget-base.json` ouvert.

- [ ] 1. Survolez la barre d'Etude. *Attendu :* l'infobulle contient une ligne avec budget et coût réel.
- [ ] 2. Activez le masquage et survolez de nouveau. *Attendu :* `••••` à la place des montants.

### Budget 13 — Un projet complet avec budget (EF-112 à EF-127, R-72, R-75, R-83)

Départ : importez `projet-atlas-budget.json` (49 éléments, 6 ressources, provision de 15 000,00 €, une baseline
« Baseline initiale »). Ce projet a aussi 4 conflits de ressources voulus : ils n'ont pas de lien avec le budget.

- [ ] 1. Colonnes **Budget** et **Coût réel**. *Attendu* (Budget ; Coût réel) : « Recueil des besoins » (A2)
  `8 000,00 €` ; `9 200,00 €` (coût réel au-dessus du budget) ; « API réservations » (C3) `29 000,00 €` ; `0,00 €` ;
  « Infrastructure de production » (F1) `1,5 M €` (forme abrégée) ; `0,00 €` ; les jalons sont vides.
- [ ] 2. Les récapitulatives affichent la somme de leurs tâches : « Cadrage » (P1) Budget `19 300,00 €`, Coût réel
  `18 800,00 €` ; « Développement » (P3) Budget `189 000,00 €`, Coût réel `0,00 €`. Une récapitulative n'a pas de champ de montant dans sa fiche.
- [ ] 3. Tableau de bord, onglet **Budget**. *Attendu :* BAC `1 836 700,00 €`, provision `15 000,00 €`, budget total
  `1 851 700,00 €`, coût réel total `26 100,00 €`, reste `1 825 600,00 €`.
  Aucun montant ne déborde de sa tuile ni du graphique (EX-04) ; réduisez la fenêtre et rouvrez l'onglet, puis
  recommencez avec `budget-montants-geants.json` : les montants restent dans leur tuile, en plus petit.
- [ ] 4. Tableau par catégorie (colonnes Catégorie, Budget, Coût réel, Écart ; l'écart est le budget moins le coût
  réel, négatif en cas de dépassement). *Attendu*, exactement ces 7 lignes dans cet ordre (alphabétique) :

  | Catégorie | Budget | Coût réel | Écart |
  |---|---:|---:|---:|
  | Design | `37 900,00 €` | `3 300,00 €` | `34 600,00 €` |
  | Dév | `193 800,00 €` | `0,00 €` | `193 800,00 €` |
  | Études | `30 100,00 €` | `19 200,00 €` | `10 900,00 €` |
  | Ops | `1 506 500,00 €` | `0,00 €` | `1 506 500,00 €` |
  | Pilotage | `27 100,00 €` | `3 600,00 €` | `23 500,00 €` |
  | Tests | `41 300,00 €` | `0,00 €` | `41 300,00 €` |
  | **Total** | `1 836 700,00 €` | `26 100,00 €` | `1 810 600,00 €` |

  Le total du budget (`1 836 700,00 €`) est le BAC de l'étape 3 ; le total du coût réel est le coût réel total.
  Ops pèse le plus à cause de l'infrastructure. La provision n'est dans aucune catégorie.
- [ ] 5. **Baselines**. *Attendu :* « Baseline initiale », BAC `1 831 700,00 €`, provision `15 000,00 €` ; BAC du projet
  `1 836 700,00 €`, soit **+5 000,00 €** (C3 et E2 ont augmenté, G2 a diminué depuis la capture).
- [ ] 6. Ouvrez **Rapport d'état**, cochez **Inclure les montants** et choisissez la baseline : la variation du BAC
  `+5 000,00 €` figure dans le bloc Budget.
- [ ] 7. Activez **Masquer les montants** puis ouvrez les trois endroits ci-dessus : aucun montant visible.
- [ ] 8. Exportez en Excel avec puis sans montants : sans, aucune colonne de montant dans la feuille Tâches ni dans
  Baselines ; avec, les montants sont en unités à deux décimales.

### Budget 14 — Courbe des coûts à jour, tâches en cours, bouton des montants dans les fenêtres (EF-129, EF-130, RG-20, RG-38)

Départ : ouvrez `budget-courbe-terminee.json` (projet fictif ancien : la date du jour dépasse sa fin ; Etude
`100,00 €` budget et `90,00 €` réel, terminée ; Realisation `300,00 €` budget, terminée avec `500,00 €` de coût réel).

- [ ] 1. **Tableau de bord**, onglet **Budget**, bouton **Afficher les valeurs**. *Attendu :* le Coût réel total est
  `590,00 €` ; dans le tableau des valeurs, la **dernière ligne** de la colonne Réel affiche `590,00 €` (et non plus
  `90,00 €` : la tâche terminée ce jour-là compte dans la période en cours, ici la dernière de la grille).
- [ ] 2. Fermez, ouvrez `budget-base.json` (Realisation à 40 %, `100,00 €` de coût réel), rouvrez l'onglet Budget et
  les valeurs. *Attendu :* la case **Inclure le coût réel des tâches en cours** est décochée ; la dernière ligne du Réel
  affiche `90,00 €` seulement ; la note sous la courbe dit que le coût des tâches non terminées n'y figure pas.
- [ ] 3. Cochez la case. *Attendu :* le focus reste sur la case ; la dernière ligne du Réel passe à `190,00 €` ; la
  note précise que le coût des tâches non terminées est compté dans la période en cours. Décochez : retour à `90,00 €`.
- [ ] 4. Dans le Tableau de bord, repérez en haut à droite le bouton **Masquer les montants**. Cliquez dessus.
  *Attendu :* tous les montants de la fenêtre deviennent `••••` sans la fermer, le bouton est enfoncé, le focus y reste
  et le bouton de la barre du haut est lui aussi enfoncé. Recliquez : les montants reviennent.
- [ ] 5. Faites de même dans **Baselines** et **Rapport d'état** (le bouton est dans leur en-tête). *Attendu :* même
  comportement ; le réglage est le même que celui de la barre du haut.

### Budget 15 — Baselines : dix au plus, trois affichées, initiale protégée (EF-131 à EF-133, RG-44 à RG-46, R-85)

Départ : ouvrez `valeur-acquise-derive.json`, puis **Baselines**.

- [ ] 1. Observez le tableau. *Attendu :* deux baselines ; « Baseline initiale » porte la pastille **Initiale** ; une
  seule case radio **Référence** est cochée (sur l'initiale) ; une phrase indique « 2 sur 3 » baselines affichées sur chaque vue.
- [ ] 2. Cliquez **Capturer une baseline** deux fois. *Attendu :* 4 baselines ; la quatrième n'est cochée ni sur le Gantt
  ni sur la courbe, et un message dit qu'elle n'est pas affichée parce que trois le sont déjà.
- [ ] 3. Essayez de cocher **Sur le Gantt** pour la quatrième. *Attendu :* la case se décoche d'elle-même avec un message
  « Trois baselines au plus… » ; décochez-en une autre, puis recochez la quatrième : cela fonctionne.
- [ ] 4. Capturez jusqu'à 10 baselines, puis une onzième. *Attendu :* la onzième est refusée avec un message (« 10 baselines au plus »).
- [ ] 5. Cochez la case **Référence** d'une autre baseline. *Attendu :* le focus reste sur la case ; **Annuler** de la barre du
  haut annule ce choix.
- [ ] 6. Supprimez la baseline **initiale**. *Attendu :* une confirmation renforcée explique qu'il s'agit de la référence
  d'origine ; le bouton par défaut est **Annuler**. Annulez : elle est toujours là. Recommencez et confirmez : elle disparaît ;
  si elle était la référence, la première baseline restante la remplace.

### Budget 16 — Valeur acquise à la date du jour (EF-134 à EF-138, RG-47 à RG-50, R-80)

Départ : ouvrez `valeur-acquise-passe.json` (budgets : Etude `100,00 €` terminée, coût réel `90,00 €` ; Realisation
`300,00 €` à 40 %, coût réel `100,00 €` ; provision `40,00 €`), **Tableau de bord**, onglet **Budget**, section **Valeur acquise**.

- [ ] 1. Lisez la ligne de référence. *Attendu :* « Référence : planning actuel (aucune baseline capturée) ».
- [ ] 2. Lisez les tuiles. *Attendu :* PV `400,00 €` (tout est planifié à ce jour) ; EV `220,00 €` (100 + 40 % de 300) ;
  AC `190,00 €` ; CV `30,00 €` ; SV `−180,00 €` ; CPI `1,16` « ● conforme » ; SPI `0,55` « ■ en dérive ». La provision n'entre pas dans ces valeurs.
- [ ] 3. Lisez le tableau **Prévision à terminaison**. *Attendu :* BAC / CPI = `345,45 €` (et non 351 : le CPI n'est pas
  arrondi avant la division) ; AC + ETC = `290,00 €` (ETC saisi à `100,00 €`) ; AC + BAC − EV = `370,00 €` ; les écarts finaux (VAC) sont `+54,55 €`, `+110,00 €`, `+30,00 €`. Une phrase rappelle que ces indicateurs sont moins pertinents en fin de projet.
- [ ] 4. Observez le diagramme CPI / SPI. *Attendu :* un point courant placé à droite de la ligne CPI = 1 et sous la ligne SPI = 1 (zone « coût maîtrisé, délai en retard ») ; un titre et une description sont lus par un lecteur d'écran.
- [ ] 5. *(Contrôle du masquage, utile quand vous partagez votre écran : le but n'est pas de lire les valeurs mais de vérifier qu'on peut montrer l'état du projet sans montrer d'argent.)* Cliquez **Masquer les montants**. *Attendu :* PV, EV, AC, CV, SV et les prévisions deviennent `••••` ; CPI et SPI (des rapports, pas des montants) restent lisibles, avec leur voyant. Cliquez à nouveau : les montants reviennent.

### Budget 17 — Un indice qui ne se calcule pas n'est jamais 0 (RG-48, R-82)

Départ : ouvrez `valeur-acquise-futur.json` (projet daté de 2035), onglet **Budget**.

- [ ] 1. *Attendu :* PV `0,00 €` ; EV `10,00 €` ; AC `20,00 €` ; CPI `0,50` « ■ en dérive » ; SPI affiché **« non calculable »** avec la raison « aucun budget n'est planifié à ce jour » (ni 0, ni infini).
- [ ] 2. Dans le tableau des prévisions, la ligne AC + ETC dit « non calculable (reste à faire non saisi) ».
- [ ] 3. Le diagramme CPI / SPI n'a pas de point courant et sa description dit que la position n'est pas calculable.

### Budget 18 — Référence : baseline ou planning actuel (EF-131, RG-44, RG-47, R-87)

Départ : ouvrez `valeur-acquise-derive.json`, onglet **Budget**. (La tâche « Recette » a été ajoutée depuis la baseline initiale ; « Realisation » a changé de budget et de durée.)

- [ ] 1. *Attendu (référence = Baseline initiale)* : BAC `400,00 €` ; PV `400,00 €` ; EV `220,00 €` ; AC `210,00 €` ; CPI `1,05` ; SPI `0,55` ; un encadré dit « 1 tâche ajoutée, 0 supprimée » (le coût réel de la tâche ajoutée pèse sur le CPI).
- [ ] 2. **Baselines** → cochez la référence **Baseline replanifiee**, fermez. *Attendu :* BAC `510,00 €` ; PV `510,00 €` ; EV `244,00 €` ; AC `210,00 €` ; CPI `1,16` ; SPI `0,48` ; plus d'encadré de tâche ajoutée.
- [ ] 3. Rouvrez **Baselines** et supprimez toutes les baselines restantes. *Attendu :* la ligne de référence redevient « planning actuel ».

### Budget 19 — Seuils des voyants et reste à faire (EF-139, EF-140, RG-49, R-82)

Départ : `valeur-acquise-passe.json`, **Projet** (clic sur le nom du projet).

- [ ] 1. Dans le groupe **Valeur acquise**, mettez le seuil vert à `80` et le seuil rouge à `90`, **Enregistrer**. *Attendu :* refus avec un message (le seuil rouge ne dépasse pas le vert), le champ fautif reçoit le focus.
- [ ] 2. Mettez vert `120`, rouge `110`, vide l'ETC, **Enregistrer**. *Attendu :* onglet Budget : CPI `1,16` passe à « ▲ à surveiller » ; la ligne AC + ETC devient « non calculable ».
- [ ] 3. Saisissez un ETC de `50`, enregistrez. *Attendu :* AC + ETC = `240,00 €`. Avec **Masquer les montants**, le champ ETC est désactivé et affiche `••••`.
- [ ] 4. Barre du haut, **Annuler**. *Attendu :* les seuils reviennent à leur valeur précédente.

### Budget 20 — Points de situation (EF-141, RG-51, R-88)

Départ : `valeur-acquise-passe.json`, onglet **Budget**, section **Points de situation**.

- [ ] 1. Saisissez le libellé « Revue 1 », **Enregistrer un point de situation**. *Attendu :* une ligne apparaît avec la date du jour, le libellé, la référence, CPI `1,16`, SPI `0,55`, le focus revient sur le bouton ; le projet est marqué modifié.
- [ ] 2. Un point se supprime par son bouton « Supprimer le point du … ». *Attendu :* la ligne disparaît (annulable).
- [ ] 3. Enregistrez un point, puis **Exporter** sans montants et réimportez le fichier. *Attendu :* le projet n'a plus aucun montant, mais l'onglet **Budget** du tableau de bord reste présent grâce au point de situation ; dans **Points de situation**, la ligne garde sa date, son libellé, CPI `1,16` et SPI `0,55` (PV, EV, AC et ETC ne sont plus dans le fichier). Un projet sans montant et sans point n'a pas d'onglet Budget.
- [ ] 4. **Rapport d'état** : *Attendu :* le bloc Budget affiche CPI et SPI avec leur voyant, sans aucun montant ; en cochant « Inclure les montants », PV, EV, AC, CV, SV et l'EAC (BAC / CPI) s'ajoutent.
- [ ] 5. Aucun point ne se crée tout seul : rouvrez le projet, la liste est telle que vous l'avez laissée.

## Partie B — Colonnes de la liste

Exigences : EF-143 à EF-146, RG-52, RG-53. Scénarios : R-89 à R-91. Fichier : `colonnes-personnalisees.json`.

### Colonnes 1 — Choisir, ordonner et enregistrer les colonnes de la liste (EF-143 à EF-146, RG-52, RG-53, R-89 à R-91)

Départ : ouvrez `colonnes-personnalisees.json` (projet fictif sans montant dont la liste affiche déjà six colonnes).

- [ ] 1. Lisez les en-têtes de la liste. *Attendu :* **Activité, N°, Début, Fin, Statut, Budget** dans cet ordre ; la colonne
  Budget est affichée bien que le projet n'ait aucun montant, parce que le projet l'a demandée.
- [ ] 2. Cliquez **Colonnes…** (barre de la liste). *Attendu :* une fenêtre liste les 12 colonnes ; les six affichées sont
  cochées, dans l'ordre, avec leur rang ; **N°** et **Activité** portent « obligatoire » et leur case est grisée ;
  Activité n'a pas de bouton ↑, Budget (dernière affichée) pas de bouton ↓.
- [ ] 3. Cochez **Durée**. *Attendu :* la colonne apparaît juste après N° (son rang d'origine) ; le focus reste sur la case.
- [ ] 4. Décochez **Statut**. *Attendu :* la colonne disparaît de la liste, sans fermer la fenêtre.
- [ ] 5. Cliquez le bouton **Monter Fin**. *Attendu :* Fin passe avant Début, dans la fenêtre et dans la liste ; le focus
  reste sur le même bouton ; un lecteur d'écran annonce la nouvelle position.
- [ ] 6. Cliquez **Descendre Activité**. *Attendu :* N° devient la première colonne, Activité la deuxième.
- [ ] 7. Fermez la fenêtre. Choisissez **Figer : les deux premières colonnes** et faites défiler la liste vers la droite.
  *Attendu :* N° et Activité (les deux premières colonnes affichées, pas forcément l'identifiant et le nom) restent
  visibles. Remettez **Figer : Aucune colonne**.
- [ ] 8. Le projet est marqué « modifié » : **Annuler** (barre du haut) défait le dernier changement de colonnes.
- [ ] 9. **Exporter** le projet (JSON), ouvrez-le de nouveau avec **Importer**. *Attendu :* mêmes colonnes, même ordre.
  Dans un autre projet, les colonnes sont celles de **ce** projet (le choix n'est pas global).
- [ ] 10. Rouvrez la fenêtre, cliquez **Rétablir l'ordre d'origine**. *Attendu :* ordre d'origine ; ici, sans montant
  dans le projet, Budget et Coût réel disparaissent. Saisissez un budget sur une tâche : les deux colonnes apparaissent
  d'elles-mêmes, en fin de liste.
- [ ] 11. Contrôle du bouton **Largeurs par défaut** : il rétablit les largeurs, pas les colonnes affichées.
- [ ] 12b. **Dans chaque navigateur utilisé (Edge, Firefox, Chrome)** : tirez la poignée de largeur d'une colonne, puis d'une autre, puis affichez une colonne avec **Colonnes…**. *Attendu :* toutes les colonnes restent visibles, la liste défile horizontalement si elle est plus large que son cadre ; **Largeurs par défaut** rétablit tout. (Défaut signalé sous Firefox le 30 octobre : seule la première colonne restait visible.)
- [ ] 12. Clavier : dans la fenêtre, Tab parcourt cases et boutons ; Espace coche ; Entrée active ↑ et ↓ ; Échap ferme
  et rend le focus à **Colonnes…**.

### Contrôle final de la mise à jour

- [ ] Aucune erreur visible, aucun message inattendu pendant les parcours.
- [ ] Navigation au clavier possible dans les nouvelles fenêtres et l'onglet Budget ; thème sombre lisible.
- [ ] Rien ne part vers l'extérieur (l'application fonctionne hors connexion).

Validé par : ______________________  Date : ____ / ____ / ________
